import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


MODEL_NAME = "Polygl0t/bengali-banglabert-toxicity-classifier"


class ToxicityModel:

    def __init__(self):

        print("Loading Toxicity model...")

        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

        self.model = AutoModelForSequenceClassification.from_pretrained(
            MODEL_NAME
        )

        self.model.eval()

        print("Toxicity model loaded successfully.")

    def predict(self, text):

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512
        )

        with torch.no_grad():
            outputs = self.model(**inputs)

        # Model produces a regression value in [0, 4].
        # Documentation converts this to [1, 5].
        raw_score = outputs.logits.squeeze().item()

        toxicity_score = raw_score + 1

        toxicity_score = max(
            1.0,
            min(5.0, toxicity_score)
        )

        return toxicity_score