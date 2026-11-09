from risk_engine import calculate_risk


tests = [
    {
        "sentiment": "Negative",
        "sarcasm": False,
        "toxicity_score": 4.5
    },
    {
        "sentiment": "Negative",
        "sarcasm": False,
        "toxicity_score": 3.2
    },
    {
        "sentiment": "Negative",
        "sarcasm": True,
        "toxicity_score": 1.5
    },
    {
        "sentiment": "Positive",
        "sarcasm": False,
        "toxicity_score": 1.0
    }
]


for test in tests:

    risk = calculate_risk(
        test["sentiment"],
        test["sarcasm"],
        test["toxicity_score"]
    )

    print(
        f"Sentiment={test['sentiment']}, "
        f"Sarcasm={test['sarcasm']}, "
        f"Toxicity={test['toxicity_score']} "
        f"-> Risk={risk}"
    )