"""
models/english_sentiment.py

English sentiment wrapper (CardiffNLP twitter-roberta-base-sentiment-latest).
Returns one of "Negative", "Neutral", "Positive" plus the probability of
the chosen class.
"""

import re

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


MODEL_NAME = "cardiffnlp/twitter-roberta-base-sentiment-latest"


def _preprocess(text: str) -> str:
    """
    The CardiffNLP model was trained on tweets where user mentions were
    replaced by "@user" and links by "http". Doing the same here matches
    its training data and avoids noisy tokens.
    """
    words = []
    for word in text.split(" "):
        if word.startswith("@") and len(word) > 1:
            word = "@user"
        elif word.startswith("http"):
            word = "http"
        words.append(word)
    return " ".join(words)


class EnglishSentimentModel:

    def __init__(self):
        print("Loading English Sentiment model...")

        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            MODEL_NAME
        )
        self.model.eval()

        # Read the label order from the model's own config instead of
        # hard-coding it: {0: "negative", 1: "neutral", 2: "positive"}.
        id2label = self.model.config.id2label
        self.labels = [
            id2label[i].capitalize() for i in range(len(id2label))
        ]

        print("English Sentiment model loaded successfully.")

    def predict(self, text: str) -> dict:
        inputs = self.tokenizer(
            _preprocess(text),
            return_tensors="pt",
            truncation=True,
            max_length=512,
        )

        with torch.no_grad():
            outputs = self.model(**inputs)

        probs = torch.softmax(outputs.logits, dim=1)
        prediction = torch.argmax(probs, dim=1).item()

        return {
            "sentiment": self.labels[prediction],
            "confidence": probs[0][prediction].item(),
        }