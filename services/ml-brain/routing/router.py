"""
router.py

Language-aware model routing for VerbaScope's ML Brain.

This module decides which models should process a post based on the
detected language. It does not load or run models itself—it simply
returns the model keys that main.py should use.
"""

from dataclasses import dataclass

try:
    # Package import
    from .language_detector import detect_language
except ImportError:
    # Standalone testing
    from language_detector import detect_language


# ---------------------------------------------------------------------
# Model keys
# ---------------------------------------------------------------------

BANGLA_SENTIMENT_SARCASM_MODEL = "banglabert_sentiment_sarcasm_v1"
ENGLISH_SARCASM_MODEL = "twitter_roberta_irony_v1"
BANGLA_TOXICITY_MODEL = "banglabert_toxicity_v1"


# ---------------------------------------------------------------------
# Route configuration
# ---------------------------------------------------------------------

@dataclass
class RouteConfig:
    sentiment_sarcasm_model: str
    toxicity_model: str
    low_confidence_routing: bool
    routing_note: str


ROUTING_TABLE: dict[str, RouteConfig] = {

    "Bangla": RouteConfig(
        sentiment_sarcasm_model=BANGLA_SENTIMENT_SARCASM_MODEL,
        toxicity_model=BANGLA_TOXICITY_MODEL,
        low_confidence_routing=False,
        routing_note=(
            "Native Bangla route using BanglaBERT sentiment/sarcasm "
            "and Bangla toxicity models."
        ),
    ),

    "English": RouteConfig(
        sentiment_sarcasm_model=ENGLISH_SARCASM_MODEL,
        toxicity_model=BANGLA_TOXICITY_MODEL,
        low_confidence_routing=False,
        routing_note=(
            "English sarcasm is handled by the CardiffNLP Twitter "
            "RoBERTa irony model. Toxicity currently falls back to "
            "the Bangla toxicity model until an English toxicity "
            "model is available."
        ),
    ),

    "Banglish": RouteConfig(
        sentiment_sarcasm_model=BANGLA_SENTIMENT_SARCASM_MODEL,
        toxicity_model=BANGLA_TOXICITY_MODEL,
        low_confidence_routing=True,
        routing_note=(
            "No dedicated Banglish models exist yet. Falling back to "
            "Bangla models. Predictions should be treated as lower "
            "confidence."
        ),
    ),

    "Mixed": RouteConfig(
        sentiment_sarcasm_model=BANGLA_SENTIMENT_SARCASM_MODEL,
        toxicity_model=BANGLA_TOXICITY_MODEL,
        low_confidence_routing=True,
        routing_note=(
            "Mixed Bangla/English text detected. Routed to Bangla "
            "models as a best-effort fallback."
        ),
    ),

    "Unknown": RouteConfig(
        sentiment_sarcasm_model=BANGLA_SENTIMENT_SARCASM_MODEL,
        toxicity_model=BANGLA_TOXICITY_MODEL,
        low_confidence_routing=True,
        routing_note=(
            "Unable to determine language. Falling back to Bangla "
            "models."
        ),
    ),
}


# ---------------------------------------------------------------------
# Route decision returned to the pipeline
# ---------------------------------------------------------------------

@dataclass
class RouteDecision:
    text: str
    language: str
    language_confidence: float
    sentiment_sarcasm_model: str
    toxicity_model: str
    low_confidence_routing: bool
    routing_note: str


def route(text: str) -> RouteDecision:
    """
    Determine which models should process the given text.
    """

    language, confidence = detect_language(text)
    config = ROUTING_TABLE[language]

    return RouteDecision(
        text=text,
        language=language,
        language_confidence=confidence,
        sentiment_sarcasm_model=config.sentiment_sarcasm_model,
        toxicity_model=config.toxicity_model,
        low_confidence_routing=config.low_confidence_routing,
        routing_note=config.routing_note,
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
        "🎉🔥",
    ]

    for text in samples:

        decision = route(text)

        flag = "LOW-CONF" if decision.low_confidence_routing else "OK"

        print("=" * 70)
        print(f"Language      : {decision.language}")
        print(f"Confidence    : {decision.language_confidence:.2f}")
        print(f"Routing       : {flag}")
        print(f"Sentiment     : {decision.sentiment_sarcasm_model}")
        print(f"Toxicity      : {decision.toxicity_model}")
        print(f"Note          : {decision.routing_note}")
        print(f"Text          : {text}")