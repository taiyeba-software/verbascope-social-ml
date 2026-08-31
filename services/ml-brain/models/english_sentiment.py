import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


MODEL_NAME = "cardiffnlp/twitter-roberta-base-sentiment-latest"


class EnglishSentimentModel:

    def __init__(self):

        print("Loading English Sentiment model...")

        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

        self.model = AutoModelForSequenceClassification.from_pretrained(
            MODEL_NAME
        )

        self.model.eval()

        self.labels = [
            "Negative",
            "Neutral",
            "Positive"
        ]

        print("English Sentiment model loaded successfully.")

    def predict(self, text):

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512
        )

        with torch.no_grad():
            outputs = self.model(**inputs)

        probs = torch.softmax(outputs.logits, dim=1)

        prediction = torch.argmax(probs, dim=1).item()

        return {
            "sentiment": self.labels[prediction],
            "confidence": probs[0][prediction].item()
        }