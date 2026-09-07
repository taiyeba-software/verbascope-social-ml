""""
router.py

Language-aware pipeline routing for VerbaScope's ML Brain.

Version 3 change (SRP cleanup): the router no longer knows anything
about model names. Previously RouteDecision exposed
`sentiment_sarcasm_model` / `toxicity_model` strings, which meant the
router had to know which concrete models existed for each language —
that's an implementation detail of the pipeline layer, not a routing
decision.

Now the router's only job is to answer one question: which pipeline
("bangla" or "english") should handle this text? The pipeline layer
(pipelines/analyzer.py) is the only place that knows which models back
each pipeline.

Routing logic (unchanged from the previous version, just described in
terms of pipelines now):
  * "Bangla"   -> "bangla" pipeline
  * "English"  -> "english" pipeline
  * "Banglish" -> "english" pipeline (temporary fallback — romanized
                  Bangla tokenizes better with English transformers
                  than with BanglaBERT), low_confidence=True
  * "Mixed"    -> whichever script dominates by character count,
                  low_confidence=True
  * "Unknown"  -> "bangla" pipeline (no linguistic signal to route on
                  at all), low_confidence=True
"""

from dataclasses import dataclass

try:
    # Package import
    from .language_detector import detect_language, LanguageDecision
except ImportError:
    # Standalone testing
    from language_detector import detect_language, LanguageDecision


# ---------------------------------------------------------------------
# Pipeline names
# ---------------------------------------------------------------------

BANGLA_PIPELINE = "bangla"
ENGLISH_PIPELINE = "english"


# ---------------------------------------------------------------------
# Route decision returned to the pipeline layer
# ---------------------------------------------------------------------

@dataclass
class RouteDecision:
    language: str
    confidence: float
    pipeline: str
    low_confidence: bool
    note: str


def _decide(decision: LanguageDecision) -> tuple[str, bool, str]:
    """
    Given a LanguageDecision, pick (pipeline_name, low_confidence, note).
    Kept separate from route() so the branching logic is easy to read
    and unit-test on its own. Returns pipeline *names* only — never
    model names.
    """

    if decision.language == "Bangla":
        return (
            BANGLA_PIPELINE,
            False,
            "Native Bangla route.",
        )

    if decision.language == "English":
        return (
            ENGLISH_PIPELINE,
            False,
            "Native English route.",
        )

    if decision.language == "Banglish":
        return (
            ENGLISH_PIPELINE,
            True,
            "No dedicated Banglish pipeline exists yet. Romanized "
            "Bangla tokenizes better with English models, so this is "
            "routed to the English pipeline as a temporary fallback.",
        )

    if decision.language == "Mixed":
        if decision.bangla_chars > decision.latin_chars:
            return (
                BANGLA_PIPELINE,
                True,
                "Mixed text routed to the dominant Bangla pipeline "
                f"({decision.bangla_chars} Bangla vs. "
                f"{decision.latin_chars} Latin characters).",
            )
        if decision.latin_chars > decision.bangla_chars:
            return (
                ENGLISH_PIPELINE,
                True,
                "Mixed text routed to the dominant English pipeline "
                f"({decision.latin_chars} Latin vs. "
                f"{decision.bangla_chars} Bangla characters).",
            )
        # Exact tie: no dominant script. Default to Bangla, consistent
        # with VerbaScope's primary-language focus.
        return (
            BANGLA_PIPELINE,
            True,
            "Mixed text with an exact character-count tie "
            f"({decision.bangla_chars}/{decision.latin_chars}). No "
            "dominant script; defaulting to the Bangla pipeline.",
        )

    # "Unknown": emoji-only, numbers, punctuation, or empty text.
    return (
        BANGLA_PIPELINE,
        True,
        "Unable to determine language (no Bangla or Latin script "
        "characters found). Defaulting to the Bangla pipeline.",
    )


def route(text: str) -> RouteDecision:
    """
    Determine which pipeline should process the given text.
    Purely a routing decision — no models are touched here.
    """

    decision = detect_language(text)
    pipeline, low_confidence, note = _decide(decision)

    return RouteDecision(
        language=decision.language,
        confidence=decision.confidence,
        pipeline=pipeline,
        low_confidence=low_confidence,
        note=note,
    )


# ---------------------------------------------------------------------
# Manual test
# ---------------------------------------------------------------------

if __name__ == "__main__":

    samples = [
        "বাংলাদেশ আজ দারুণ খেলেছে!",
        "This is the best day ever!",
        "ami ajke onek happy",
        "আজকে আমি খুব happy কারণ exam ভালো হয়েছে।",
        "আজ meeting আছে",
        "আজ I am happy",
        "🎉🔥",
        "I will kill a man for sure.",
    ]

    for text in samples:

        decision = route(text)

        flag = "LOW-CONF" if decision.low_confidence else "OK"

        print("=" * 70)
        print(f"Language   : {decision.language}")
        print(f"Confidence : {decision.confidence:.2f}")
        print(f"Pipeline   : {decision.pipeline}")
        print(f"Routing    : {flag}")
        print(f"Note       : {decision.note}")
        print(f"Text       : {text}")