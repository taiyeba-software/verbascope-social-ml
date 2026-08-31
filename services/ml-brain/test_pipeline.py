from transformers import pipeline

print("Loading pipeline...")

classifier = pipeline(
    "text-classification",
    model="YamenRM/sarcasm_model"
)

tests = [
    "Oh great, another Monday morning meeting!",
    "Yeah right, this is the best day ever.",
    "I absolutely love waiting in traffic.",
    "Thanks for ruining my day.",
    "What a wonderful surprise.",
    "Hello",
]

print()

for text in tests:
    print("-" * 50)
    print(text)
    print(classifier(text))