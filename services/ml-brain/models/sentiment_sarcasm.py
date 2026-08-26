import torch
import numpy as np

from huggingface_hub import hf_hub_download
from transformers import AutoTokenizer

from model_architecture import DualHeadModel


REPO_ID = "ahs95/sentiment-sarcasm-detection-BanglaBERT"


class SentimentSarcasmModel:

    def __init__(self):

        print("Loading Sentiment + Sarcasm model...")

        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(REPO_ID)

        # Create model architecture
        self.model = DualHeadModel(
            num_sentiment_classes=4,
            num_sarcasm_classes=2
        )

        # Download/load trained weights
        model_path = hf_hub_download(
            repo_id=REPO_ID,
            filename="model.pth"
        )

        self.model.load_state_dict(
            torch.load(
                model_path,
                map_location="cpu",
                weights_only=True
            )
        )

        self.model.eval()

        # Load calibrated thresholds
        self.sent_thresholds = np.load(
            hf_hub_download(
                repo_id=REPO_ID,
                filename="sent_thresholds.npy"
            )
        )

        self.sarc_thresholds = np.load(
            hf_hub_download(
                repo_id=REPO_ID,
                filename="sarc_thresholds.npy"
            )
        )

        # Labels
        self.sentiment_labels = [
            "Positive",
            "Neutral",
            "Negative",
            "Mixed"
        ]

        self.sarcasm_labels = [
            "Sarcastic",
            "Non-Sarcastic"
        ]

        print("Model loaded successfully.")


    def predict(self, text, max_len=512):

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=max_len,
            padding="max_length"
        )

        with torch.no_grad():

            sent_logits, sarc_logits = self.model(
                inputs["input_ids"],
                inputs["attention_mask"]
            )

        # Sentiment probabilities
        sent_probs = torch.softmax(
            sent_logits.squeeze(0),
            dim=-1
        )

        # Sarcasm probability
        sarc_prob = torch.sigmoid(
            sarc_logits.squeeze(0)
        )[0]

        # Apply calibrated sentiment thresholds
        sentiment = "Neutral"

        for i, probability in enumerate(sent_probs):

            if probability >= self.sent_thresholds[i]:
                sentiment = self.sentiment_labels[i]
                break

        # Apply calibrated sarcasm threshold
        if sarc_prob >= self.sarc_thresholds[0]:
            sarcasm = self.sarcasm_labels[0]
        else:
            sarcasm = self.sarcasm_labels[1]

        return {
            "sentiment": sentiment,
            "sarcasm": sarcasm,
            "sentiment_probabilities": sent_probs.tolist(),
            "sarcasm_probability": sarc_prob.item()
        }