import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


MODEL_NAME = "unitary/toxic-bert"

# ---------------------------------------------------------------------
# Probability bands -> 1-5 toxicity scale
# ---------------------------------------------------------------------
# risk_engine.calculate_signal() treats score >= 2.0 as Medium (Yellow)
# and score >= 3.5 as High (Red). This English model can only return
# whole numbers, so a score of 2 would always be read as Medium. To keep
# the two files consistent, score 2 is NOT used: below MEDIUM_FROM the
# score is 1 (Low), so low-probability text no longer turns Yellow by
# itself (sentiment / sarcasm can still make it Yellow in the risk engine).
#
#   probability < MEDIUM_FROM  -> 1  (Low)
#   MEDIUM_FROM .. HIGH_FROM   -> 3  (Medium)
#   HIGH_FROM   .. SEVERE_FROM -> 4  (High)
#   >= SEVERE_FROM             -> 5  (High)
MEDIUM_FROM = 0.40
HIGH_FROM = 0.60
SEVERE_FROM = 0.80


def _score_to_scale(score: float) -> int:
    if score < MEDIUM_FROM:
        return 1
    if score < HIGH_FROM:
        return 3
    if score < SEVERE_FROM:
        return 4
    return 5


_LEVEL_BY_SCALE = {
    1: "Low",
    2: "Medium",  # not produced any more; matches risk_engine (>= 2.0)
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

# Same cut-off as the Medium band, so the explanation text and the
# Medium/Yellow decision can never disagree.
EXPLAIN_THRESHOLD = MEDIUM_FROM


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
            "score": int,              # 1, 3, 4 or 5 (see bands above)
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