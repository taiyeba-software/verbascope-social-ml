import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


MODEL_NAME = "unitary/toxic-bert"

# Converts a 0.0-1.0 probability into your existing 1-5 toxicity scale,
# so risk_engine.calculate_signal() and everything downstream (Mongo
# schema, signal mapper, frontend) needs zero changes.
def _score_to_scale(score: float) -> int:
    if score < 0.20:
        return 1
    if score < 0.40:
        return 2
    if score < 0.60:
        return 3
    if score < 0.80:
        return 4
    return 5


_LEVEL_BY_SCALE = {
    1: "Low",
    2: "Low",
    3: "Medium",
    4: "High",
    5: "High",
}

# Explanation text per label, used when that label is the top-scoring one.
_LABEL_EXPLANATIONS = {
    "threat": "High confidence threat detected.",
    "severe_toxic": "Severe toxic language detected.",
    "identity_hate": "Identity-based hate speech detected.",
    "insult": "Insulting language detected.",
    "obscene": "Obscene language detected.",
    "toxic": "Toxic language detected.",
}

EXPLAIN_THRESHOLD = 0.50


class EnglishToxicityModel:

    def __init__(self):

        print("Loading English Toxicity model...")

        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

        self.model = AutoModelForSequenceClassification.from_pretrained(
            MODEL_NAME
        )

        self.model.eval()

        # id2label from the model config, e.g.
        # {0: "toxic", 1: "severe_toxic", 2: "obscene",
        #  3: "threat", 4: "insult", 5: "identity_hate"}
        self.id2label = self.model.config.id2label

        print("English Toxicity model loaded successfully.")

    def predict(self, text):
        """
        Predict toxicity for English text.

        Returns:
        {
            "score": int,              # 1-5, same scale as the Bangla model
            "level": str,               # "Low" / "Medium" / "High"
            "top_label": str,           # e.g. "threat"
            "top_label_score": float,   # 0.0-1.0
            "labels": dict,             # all six label probabilities
            "explanation": str,
        }
        """

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
        )

        with torch.no_grad():
            outputs = self.model(**inputs)

        # This is multi-label (a comment can be both "toxic" and "threat"
        # at once), so each label gets its own independent sigmoid rather
        # than one softmax across all labels.
        probs = torch.sigmoid(outputs.logits)[0]

        labels = {
            self.id2label[i]: probs[i].item()
            for i in range(len(probs))
        }

        top_label, top_label_score = max(labels.items(), key=lambda kv: kv[1])

        scale_score = _score_to_scale(top_label_score)
        level = _LEVEL_BY_SCALE[scale_score]

        explanation = "No toxic language detected."
        if top_label_score >= EXPLAIN_THRESHOLD:
            explanation = _LABEL_EXPLANATIONS.get(top_label, "Toxic language detected.")

        return {
            "score": scale_score,
            "level": level,
            "top_label": top_label,
            "top_label_score": top_label_score,
            "labels": labels,
            "explanation": explanation,
        }


if __name__ == "__main__":
    model = EnglishToxicityModel()

    tests = [
        "I will kill a man for sure.",
        "Thank you so much!",
        "You are such an idiot.",
        "Have a wonderful day!",
        "I hate this product.",
        "I'm going to find you and hurt you.",
    ]

    for text in tests:
        result = model.predict(text)
        print("-" * 50)
        print(text)
        print(result)