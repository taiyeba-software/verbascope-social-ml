""""
pipelines/analyzer.py

Coordinates a single request through the full VerbaScope ML Brain
flow:

    text -> route() -> pipeline models -> risk engine -> result dict

This is the one place that knows how to turn a RouteDecision's
`pipeline` name ("bangla" or "english") into actual model calls. It
exists so that main.py (the HTTP layer) and rabbit_consumer.py (the
queue layer) can eventually share identical inference logic instead of
duplicating the language branching in two places — main.py no longer
decides which model to run, it just calls `Analyzer.analyze()`.

Each language-specific "_run_*_pipeline" method returns the same shape
of result so analyze() doesn't need to know which one ran.
"""

from routing.router import route
from risk.risk_engine import calculate_signal


class Analyzer:
    """
    Runs text through routing, the appropriate language models, and the
    risk engine. Holds references to already-loaded models so it can be
    constructed once at startup (in main.py) and reused for every
    request.
    """

    def __init__(
        self,
        bangla_model,
        english_model,
        bangla_toxicity_model,
        english_toxicity_model,
    ):
        self.bangla_model = bangla_model
        self.english_model = english_model
        self.bangla_toxicity_model = bangla_toxicity_model
        self.english_toxicity_model = english_toxicity_model

    # ------------------------------------------------------------
    # Language-specific pipelines
    # ------------------------------------------------------------

    def _run_bangla_pipeline(self, text: str) -> dict:
        result = self.bangla_model.predict(text)

        toxicity = self.bangla_toxicity_model.predict(text)

        return {
            "sentiment": result["sentiment"],
            "sarcasm": result["sarcasm"] == "Sarcastic",
            "sarcasm_probability": result["sarcasm_probability"],
            "toxicity": toxicity,
            "toxicity_top_label": None,
            "toxicity_explanation": None,
        }

    def _run_english_pipeline(self, text: str) -> dict:
        result = self.english_model.predict(text)

        toxicity_result = self.english_toxicity_model.predict(text)

        return {
            # No dedicated English sentiment model yet.
            "sentiment": "Neutral",
            "sarcasm": result["sarcasm"],
            "sarcasm_probability": result["sarcasm_probability"],
            "toxicity": toxicity_result["score"],
            "toxicity_top_label": toxicity_result["top_label"],
            "toxicity_explanation": toxicity_result["explanation"],
        }

    # ------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------

    def analyze(self, text: str) -> dict:
        decision = route(text)

        if decision.pipeline == "bangla":
            analysis = self._run_bangla_pipeline(text)
        else:
            analysis = self._run_english_pipeline(text)

        risk = calculate_signal(
            sentiment=analysis["sentiment"],
            sarcasm=analysis["sarcasm"],
            toxicity_score=analysis["toxicity"],
            sarcasm_probability=analysis["sarcasm_probability"],
        )

        return {
            "text": text,

            "language": decision.language,
            "language_confidence": decision.confidence,
            "routing": decision.pipeline,
            "low_confidence_routing": decision.low_confidence,
            "routing_note": decision.note,

            "sentiment": analysis["sentiment"],
            "sarcasm": analysis["sarcasm"],
            "sarcasm_probability": analysis["sarcasm_probability"],

            "toxicity": analysis["toxicity"],
            "toxicity_top_label": analysis["toxicity_top_label"],
            "toxicity_explanation": analysis["toxicity_explanation"],

            "risk_flag": risk.signal,
            "toxicity_level": risk.toxicity_level,
            "explanation": risk.explanation,
        }