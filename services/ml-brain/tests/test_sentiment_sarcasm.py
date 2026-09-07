import torch
import numpy as np

from huggingface_hub import hf_hub_download
from transformers import AutoTokenizer
from model_architecture import DualHeadModel


REPO_ID = "ahs95/sentiment-sarcasm-detection-BanglaBERT"

print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(REPO_ID)

print("Creating model...")
model = DualHeadModel(
    num_sentiment_classes=4,
    num_sarcasm_classes=2
)

print("Downloading model weights...")
model_path = hf_hub_download(
    repo_id=REPO_ID,
    filename="model.pth"
)

print("Loading model weights...")
model.load_state_dict(
    torch.load(
        model_path,
        map_location="cpu",
        weights_only=True
    )
)

model.eval()

print("Loading calibrated thresholds...")

sent_thresholds = np.load(
    hf_hub_download(
        repo_id=REPO_ID,
        filename="sent_thresholds.npy"
    )
)

sarc_thresholds = np.load(
    hf_hub_download(
        repo_id=REPO_ID,
        filename="sarc_thresholds.npy"
    )
)


sentiment_labels = [
    "Positive",
    "Neutral",
    "Negative",
    "Mixed"
]

sarcasm_labels = [
    "Sarcastic",
    "Non-Sarcastic"
]


def predict(text, max_len=512):

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=max_len,
        padding="max_length"
    )

    with torch.no_grad():

        sent_logits, sarc_logits = model(
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
    sent_pred = "Neutral"

    for i, prob in enumerate(sent_probs):

        if prob >= sent_thresholds[i]:
            sent_pred = sentiment_labels[i]
            break

    # Apply calibrated sarcasm threshold
    if sarc_prob >= sarc_thresholds[0]:
        sarc_pred = sarcasm_labels[0]
    else:
        sarc_pred = sarcasm_labels[1]

    return {
        "text": text,
        "sentiment": sent_pred,
        "sarcasm": sarc_pred,
        "sentiment_probabilities": sent_probs.tolist(),
        "sarcasm_probability": sarc_prob.item()
    }


# --------------------------------------------------
# Test sentences
# --------------------------------------------------

test_sentences = [
    "আজকে নতুন ফুল ফুটেছে।",
    "আমি আমার ছাদে একটি মৃত পাখি দেখেছি।",
    "১০ বছর আগের একটি সংবাদপত্র খুঁজে পেয়েছি।",
    "বাংলাদেশ আজ দারুণ খেলেছে!",
    "ওয়াও, আবারও অসাধারণ হারলাম!",
]


for text in test_sentences:

    result = predict(text)

    print("\n" + "=" * 60)

    print("Input:", result["text"])
    print("Sentiment:", result["sentiment"])
    print("Sarcasm:", result["sarcasm"])

    print(
        "Sentiment probabilities:",
        result["sentiment_probabilities"]
    )

    print(
        "Sarcasm probability:",
        result["sarcasm_probability"]
    )