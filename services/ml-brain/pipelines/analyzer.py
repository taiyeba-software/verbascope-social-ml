""""
pipelines/analyzer.py

Coordinates a single request through the full VerbaScope ML Brain
flow:

    text -> route() -> pipeline models -> risk engine -> result dict

This is the ONLY place that knows how to turn a RouteDecision's
`pipeline` name ("bangla" or "english") into actual model calls, fold
toxicity top-label detail into the explanation text, and compute the
single "confidence" number used by the frontend. Both main.py (the
HTTP layer) and rabbit_consumer.py (the queue layer) call
`Analyzer.analyze()` and get back an identical result — no branching
logic is duplicated between them. This matters in practice: duplicated
routing/branching logic across main.py and rabbit_consumer.py is what
caused rabbit_consumer.py to silently break (still referencing old
RouteDecision fields like `.sentiment_sarcasm_model`) after router.py
was refactored. With a single Analyzer, that class of bug can't
reappear — there's only one place to update.

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
    request — both HTTP (/analyze) and the RabbitMQ consumer share the
    same instance.
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
            "toxicity_top_label_score": None,
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
            "toxicity_top_label_score": toxicity_result.get("top_label_score"),
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

        toxicity_top_label = analysis["toxicity_top_label"]
        toxicity_top_label_score = analysis["toxicity_top_label_score"]

        # When toxic-bert actually drove the signal (Medium/High), fold
        # its specific top_label into the explanation text instead of
        # just the generic risk-engine sentence, e.g. "High toxicity
        # (score=5.00) overrides sentiment (Neutral) and sarcasm. Top
        # signal: threat (0.91)."
        explanation = risk.explanation
        if toxicity_top_label and risk.toxicity_level in ("Medium", "High"):
            explanation = (
                f"{explanation} Top signal: {toxicity_top_label} "
                f"({toxicity_top_label_score:.2f})."
            )

        # A single 0-1 "how sure is the model" number for the frontend's
        # AI Analysis dropdown. This should reflect the confidence of
        # whichever signal actually drove the result, not a fixed
        # priority order:
        #   - Medium/High toxicity -> the toxicity model's top-label
        #     score (e.g. "threat" at 0.91), since toxicity is what's
        #     driving the risk flag.
        #   - Otherwise, for the English pipeline -> the sarcasm
        #     probability, since toxic-bert's top-label score for a
        #     LOW-toxicity post (e.g. "toxic": 0.0007 for "Today is
        #     amazing") is just "how not-toxic is this text" and is
        #     meaningless as an overall confidence — it isn't the
        #     confidence of any prediction actually being shown.
        #   - Otherwise (Bangla/Banglish/Mixed-to-Bangla) -> the
        #     language-detection confidence, since that's the strongest
        #     signal driving which model ran at all.
        if risk.toxicity_level in ("Medium", "High") and toxicity_top_label_score is not None:
            confidence = toxicity_top_label_score
        elif decision.pipeline == "english":
            confidence = analysis["sarcasm_probability"]
        else:
            confidence = decision.confidence

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
            "toxicity_top_label": toxicity_top_label,
            "toxicity_top_label_score": toxicity_top_label_score,
            "toxicity_explanation": analysis["toxicity_explanation"],

            "risk_flag": risk.signal,
            "toxicity_level": risk.toxicity_level,
            "explanation": explanation,
            "confidence": confidence,
        }