def calculate_risk(
    sentiment,
    sarcasm,
    toxicity_score,
    sarcasm_probability=0.0
):
    """
    Combine sentiment, sarcasm and toxicity into one
    normalized 0-1 risk score.

    Toxicity receives the highest weight because
    negative emotion alone does not mean a post is dangerous.

    Returns:
        green / yellow / red
    """

    # --------------------------------------------------
    # 1. Sentiment risk
    # --------------------------------------------------

    sentiment_risk_map = {
        "Positive": 0.0,
        "Neutral": 0.15,
        "Mixed": 0.50,
        "Negative": 1.0,
    }

    sentiment_risk = sentiment_risk_map.get(
        sentiment,
        0.15
    )

    # --------------------------------------------------
    # 2. Sarcasm risk
    # --------------------------------------------------

    # Use probability instead of treating sarcasm
    # as a perfect yes/no signal.
    sarcasm_risk = max(
        0.0,
        min(1.0, sarcasm_probability)
    )

    # --------------------------------------------------
    # 3. Toxicity risk
    # --------------------------------------------------

    # Convert toxicity from 1-5 -> 0-1
    toxicity_risk = (
        float(toxicity_score) - 1.0
    ) / 4.0

    toxicity_risk = max(
        0.0,
        min(1.0, toxicity_risk)
    )

    # --------------------------------------------------
    # 4. Overall risk
    # --------------------------------------------------

    overall_risk = (
        sentiment_risk * 0.25
        + sarcasm_risk * 0.15
        + toxicity_risk * 0.60
    )

    # --------------------------------------------------
    # 5. Final signal
    # --------------------------------------------------

    if overall_risk >= 0.65:
        risk_flag = "red"

    elif overall_risk >= 0.35:
        risk_flag = "yellow"

    else:
        risk_flag = "green"

    return risk_flag