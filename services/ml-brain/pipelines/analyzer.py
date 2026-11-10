"""
pipelines/analyzer.py

Coordinates a single request through the full VerbaScope ML Brain
flow:

    text -> route() -> pipeline models -> risk engine -> result dict

This is the ONLY place that knows how to turn a RouteDecision's
`pipeline` name ("bangla" or "english") into actual model calls, fold
toxicity top-label detail into the explanation text, and compute the
single "confidence" number used by the frontend. Both main.py (the
HTTP layer) and rabbit_consumer.py (the queue layer) call
`Analyzer.analyze()` and get back an identical result -- no branching
logic is duplicated between them. This matters in practice: duplicated
routing/branching logic across main.py and rabbit_consumer.py is what
caused rabbit_consumer.py to silently break (still referencing old
RouteDecision fields like `.sentiment_sarcasm_model`) after router.py
was refactored. With a single Analyzer, that class of bug can't
reappear -- there's only one place to update.

Each "_run_*_pipeline" method returns the same shape of result so
analyze() doesn't need to know which one ran.

Code-mixed posts (9 Nov change): a post that contains BOTH Bangla-script
letters and English words goes through `_run_mixed_pipeline`, which
splits it into sentences and lets every model read only the text it
understands (Bangla models: the whole sentence; English models: the
English words). See pipelines/mixed_runner.py and mixed_aggregate.py.
Pure Bangla and pure English posts use the old pipelines unchanged.

Experiment switch (10 Nov): set the environment variable
USE_MIXED_PIPELINE=0 before starting the server to send code-mixed posts
through the old route (dominant-script pipeline, whole post) instead of
the split-and-merge pipeline. The word-list safety floor (lexicon) stays
active for code-mixed posts in BOTH settings. Default (variable not set)
is the split-and-merge pipeline, exactly as before.
"""

import os

from routing.router import route
from routing.segmenter import BANGLA_CHAR, LATIN_WORD
from risk.risk_engine import calculate_signal
from pipelines.mixed_runner import run_segments
from pipelines.mixed_aggregate import aggregate_segments
from pipelines.lexicon import scan_lexicon


MIXED_NOTE = (
    "Code-mixed text analysed sentence by sentence: Bangla models read "
    "the full sentence, English models read the English words."
)

# Default ON. Start the server with USE_MIXED_PIPELINE=0 (or false/no/off)
# to use the old dominant-language route for code-mixed posts.
USE_MIXED_PIPELINE = os.getenv("USE_MIXED_PIPELINE", "1").strip().lower() not in (
    "0", "false", "no", "off",
)
print(f"[analyzer] USE_MIXED_PIPELINE = {USE_MIXED_PIPELINE}")


def _is_code_mixed(text: str) -> bool:
    """True when the post has Bangla-script letters AND English words."""
    return bool(BANGLA_CHAR.search(text)) and bool(LATIN_WORD.search(text))


class Analyzer:
    """
    Runs text through routing, the appropriate language models, and the
    risk engine. Holds references to already-loaded models so it can be
    constructed once at startup (in main.py) and reused for every
    request -- both HTTP (/analyze) and the RabbitMQ consumer share the
    same instance.
    """

    def __init__(
        self,
        bangla_model,
        english_model,
        bangla_toxicity_model,
        english_toxicity_model,
        english_sentiment_model=None,
    ):
        self.bangla_model = bangla_model
        self.english_model = english_model
        self.bangla_toxicity_model = bangla_toxicity_model
        self.english_toxicity_model = english_toxicity_model
        # Optional: if None, English sentiment falls back to "Neutral"
        # (the old behaviour), so older scripts that build an Analyzer
        # without it keep working.
        self.english_sentiment_model = english_sentiment_model

    # ------------------------------------------------------------
    # Language-specific pipelines
    # ------------------------------------------------------------

    def _run_bangla_pipeline(self, text: str) -> dict:
        result = self.bangla_model.predict(text)

        toxicity = self.bangla_toxicity_model.predict(text)

        return {
            "sentiment": result["sentiment"],
            "sentiment_confidence": None,
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

        if self.english_sentiment_model is not None:
            sentiment_result = self.english_sentiment_model.predict(text)
            sentiment = sentiment_result["sentiment"]
            sentiment_confidence = sentiment_result["confidence"]
        else:
            sentiment = "Neutral"
            sentiment_confidence = None

        return {
            "sentiment": sentiment,
            "sentiment_confidence": sentiment_confidence,
            "sarcasm": result["sarcasm"],
            "sarcasm_probability": result["sarcasm_probability"],
            "toxicity": toxicity_result["score"],
            "toxicity_top_label": toxicity_result["top_label"],
            "toxicity_top_label_score": toxicity_result.get("top_label_score"),
            "toxicity_explanation": toxicity_result["explanation"],
        }

    def _run_mixed_pipeline(self, text: str) -> dict:
        segments = run_segments(self, text)
        return aggregate_segments(segments)

    # ------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------

    def analyze(self, text: str) -> dict:
        decision = route(text)

        # code_mixed: the post has Bangla letters AND English words.
        # mixed:      ... AND the split-and-merge pipeline is switched on.
        code_mixed = _is_code_mixed(text)
        mixed = USE_MIXED_PIPELINE and code_mixed

        if mixed:
            analysis = self._run_mixed_pipeline(text)
        elif decision.pipeline == "bangla":
            analysis = self._run_bangla_pipeline(text)
        else:
            analysis = self._run_english_pipeline(text)

        # Safety floor: a small rule list for threats / abuse / self-harm
        # phrases the models can miss. It can only RAISE toxicity.
        # Scope: ONLY Bangla-script + English code-mixed posts, so pure
        # Bangla and pure English posts behave exactly as before.
        lexicon_hit = scan_lexicon(text) if code_mixed else None
        if lexicon_hit and lexicon_hit["score"] > analysis["toxicity"]:
            analysis = dict(analysis)
            analysis["toxicity"] = lexicon_hit["score"]
            analysis["toxicity_top_label"] = lexicon_hit["label"]
            analysis["toxicity_top_label_score"] = None   # rules have no probability
            analysis["toxicity_explanation"] = lexicon_hit["explanation"]
        else:
            lexicon_hit = None

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
        if lexicon_hit and risk.toxicity_level in ("Medium", "High"):
            explanation = f"{explanation} {lexicon_hit['explanation']}"
        elif toxicity_top_label and risk.toxicity_level in ("Medium", "High"):
            explanation = (
                f"{explanation} Top signal: {toxicity_top_label} "
                f"({toxicity_top_label_score:.2f})."
            )

        # A single 0-1 "how sure is the model" number for the frontend's
        # AI Analysis dropdown. It should be the confidence of whichever
        # signal actually drove the result:
        #   - Medium/High toxicity from toxic-bert -> its top-label score
        #     (e.g. "threat" at 0.91).
        #   - Sarcasm detected -> the sarcasm probability.
        #   - Code-mixed text -> the English sentiment model's confidence
        #     when that model chose the sentiment, otherwise the
        #     language-detection confidence (the Bangla sentiment model
        #     gives no usable confidence).
        #   - Otherwise, English pipeline -> the English sentiment
        #     model's confidence in its chosen label. If no English
        #     sentiment model is loaded, fall back to the sarcasm
        #     probability as before.
        #   - Otherwise (Bangla) -> the language-detection
        #     confidence.
        if risk.toxicity_level in ("Medium", "High") and toxicity_top_label_score is not None:
            confidence = toxicity_top_label_score
        elif analysis["sarcasm"]:
            confidence = analysis["sarcasm_probability"]
        elif mixed:
            sentiment_confidence = analysis["sentiment_confidence"]
            confidence = (
                sentiment_confidence
                if sentiment_confidence is not None
                else decision.confidence
            )
        elif decision.pipeline == "english":
            sentiment_confidence = analysis["sentiment_confidence"]
            confidence = (
                sentiment_confidence
                if sentiment_confidence is not None
                else analysis["sarcasm_probability"]
            )
        else:
            confidence = decision.confidence

        return {
            "text": text,

            "language": decision.language,
            "language_confidence": decision.confidence,
            "routing": decision.pipeline,
            "low_confidence_routing": decision.low_confidence,
            "routing_note": MIXED_NOTE if mixed else decision.note,

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