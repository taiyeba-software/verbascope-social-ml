import torch
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
)

MODEL_NAME = "cardiffnlp/twitter-roberta-base-irony"

# Adjust this if needed after evaluating on your dataset
SARCASM_THRESHOLD = 0.70


class EnglishSarcasmModel:
    def __init__(self):
        print("Loading English Sarcasm model...")

        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

        self.model = AutoModelForSequenceClassification.from_pretrained(
            MODEL_NAME
        )

        self.model.eval()

        print("English Sarcasm model loaded successfully.")

    def _preprocess(self, text: str) -> str:
        """
        Cardiff NLP recommends replacing mentions and URLs with
        placeholder tokens before tokenization.
        """

        processed_tokens = []

        for token in text.split():
            if token.startswith("@") and len(token) > 1:
                token = "@user"
            elif token.startswith("http"):
                token = "http"

            processed_tokens.append(token)

        return " ".join(processed_tokens)

    def predict(self, text: str) -> dict:
        """
        Predict whether a text is ironic/sarcastic.

        Returns:
        {
            "sarcasm": bool,
            "sarcasm_probability": float
        }
        """

        text = self._preprocess(text)

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=self.model.config.max_position_embeddings,
        )

        with torch.no_grad():
            outputs = self.model(**inputs)

        probabilities = torch.softmax(outputs.logits, dim=-1)[0]

        # Cardiff TweetEval Irony labels:
        # 0 = Non-Irony
        # 1 = Irony

        sarcasm_probability = probabilities[1].item()

        sarcasm = sarcasm_probability >= SARCASM_THRESHOLD

        return {
            "sarcasm": sarcasm,
            "sarcasm_probability": sarcasm_probability,
        }


if __name__ == "__main__":
    model = EnglishSarcasmModel()

    tests = [
        "Yeah right, this is the best day ever.",
        "I absolutely love waiting in traffic.",
        "Thank you so much!",
        "Hello",
        "I hate this product.",
        "What a wonderful surprise!",
        "Oh great, another meeting...",
        "i hate you 😘",
    ]

    for text in tests:
        result = model.predict(text)
        print("-" * 50)
        print(text)
        print(result)