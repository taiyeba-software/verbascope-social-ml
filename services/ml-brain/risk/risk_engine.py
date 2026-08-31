"""
risk_engine.py

Version 2 risk engine for VerbaScope's ML Brain.

Design philosophy:
- Toxicity is always the dominant signal.
- Sentiment and sarcasm provide supporting context.
- Unknown sentiment (unsupported language/model) is treated as
  low-confidence rather than automatically safe.
"""

from dataclasses import dataclass


# --------------------------------------------------
# Thresholds
# --------------------------------------------------

# Toxicity model outputs scores in [1.0, 5.0]
TOXICITY_HIGH_THRESHOLD = 3.5
TOXICITY_MEDIUM_THRESHOLD = 2.0

# English sarcasm probability threshold
SARCASM_PROBABILITY_THRESHOLD = 0.5


# --------------------------------------------------
# Result object
# --------------------------------------------------

@dataclass
class RiskResult:
    signal: str
    toxicity_level: str
    explanation: str


# --------------------------------------------------
# Helpers
# --------------------------------------------------

def _toxicity_level(score: float) -> str:
    if score >= TOXICITY_HIGH_THRESHOLD:
        return "High"

    if score >= TOXICITY_MEDIUM_THRESHOLD:
        return "Medium"

    return "Low"


# --------------------------------------------------
# Main decision function
# --------------------------------------------------

def calculate_signal(
    sentiment: str,
    sarcasm: bool,
    toxicity_score: float,
    sarcasm_probability: float = 0.0,
) -> RiskResult:

    toxicity_level = _toxicity_level(toxicity_score)

    # --------------------------------------------------
    # High toxicity always wins
    # --------------------------------------------------

    if toxicity_level == "High":
        return RiskResult(
            signal="red",
            toxicity_level=toxicity_level,
            explanation=(
                f"High toxicity (score={toxicity_score:.2f}) overrides "
                f"sentiment ({sentiment}) and sarcasm."
            ),
        )

    # --------------------------------------------------
    # Medium toxicity always means Yellow
    # --------------------------------------------------

    if toxicity_level == "Medium":
        return RiskResult(
            signal="yellow",
            toxicity_level=toxicity_level,
            explanation=(
                f"Medium toxicity (score={toxicity_score:.2f}) requires "
                f"review regardless of sentiment."
            ),
        )

    # --------------------------------------------------
    # Low toxicity
    # --------------------------------------------------

    # Unknown sentiment = unsupported language/model
    if sentiment == "Unknown":
        return RiskResult(
            signal="yellow",
            toxicity_level=toxicity_level,
            explanation=(
                "Sentiment could not be determined because no suitable "
                "language model is available. Treat as low-confidence."
            ),
        )

    # Sarcasm with low toxicity
    if sarcasm or sarcasm_probability >= SARCASM_PROBABILITY_THRESHOLD:
        return RiskResult(
            signal="yellow",
            toxicity_level=toxicity_level,
            explanation=(
                f"Low toxicity (score={toxicity_score:.2f}) but sarcasm "
                f"detected (probability={sarcasm_probability:.2f})."
            ),
        )

    # Negative or mixed sentiment
    if sentiment in ("Negative", "Mixed"):
        return RiskResult(
            signal="yellow",
            toxicity_level=toxicity_level,
            explanation=(
                f"Low toxicity (score={toxicity_score:.2f}) but "
                f"{sentiment.lower()} sentiment detected."
            ),
        )

    # Safe
    return RiskResult(
        signal="green",
        toxicity_level=toxicity_level,
        explanation=(
            f"Low toxicity (score={toxicity_score:.2f}), "
            f"{sentiment.lower()} sentiment, and no sarcasm detected."
        ),
    )


# --------------------------------------------------
# Manual test
# --------------------------------------------------

if __name__ == "__main__":

    tests = [

        # High toxicity
        ("Positive", False, 4.5, 0.10),

        # Medium toxicity
        ("Neutral", False, 2.3, 0.10),

        # Sarcasm
        ("Neutral", True, 1.0, 0.96),

        # Negative
        ("Negative", False, 1.1, 0.20),

        # Unknown language/model
        ("Unknown", False, 1.0, 0.0),

        # Safe
        ("Positive", False, 1.0, 0.02),
    ]

    print("=" * 70)

    for sentiment, sarcasm, toxicity, prob in tests:

        result = calculate_signal(
            sentiment=sentiment,
            sarcasm=sarcasm,
            toxicity_score=toxicity,
            sarcasm_probability=prob,
        )

        print(f"Signal      : {result.signal}")
        print(f"Toxicity    : {result.toxicity_level}")
        print(f"Explanation : {result.explanation}")
        print("-" * 70)