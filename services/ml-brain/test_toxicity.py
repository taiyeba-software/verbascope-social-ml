import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


MODEL_NAME = "Polygl0t/bengali-banglabert-toxicity-classifier"


print("Loading toxicity tokenizer...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

print("Loading toxicity model...")

model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)

model.eval()

print("Toxicity model loaded successfully.")


def predict_toxicity(text):

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512
    )

    with torch.no_grad():

        outputs = model(**inputs)

    # Model outputs a regression value in [0, 4]
    raw_score = outputs.logits.squeeze().item()

    # Convert to documented 1–5 scale
    toxicity_score = raw_score + 1

    # Keep score inside expected range
    toxicity_score = max(1.0, min(5.0, toxicity_score))

    return toxicity_score


tests = [
    "বাংলাদেশ আজ দারুণ খেলেছে!",
    "তুমি খুব ভালো মানুষ।",
    "তুই একটা বাজে মানুষ।",
    "আমি এই সিদ্ধান্তে খুবই হতাশ।",
]


for text in tests:

    score = predict_toxicity(text)

    print()
    print("Text:", text)
    print("Toxicity score:", round(score, 3))