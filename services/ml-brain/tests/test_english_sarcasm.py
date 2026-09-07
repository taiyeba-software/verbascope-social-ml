from models.english_sarcasm import EnglishSarcasmModel

model = EnglishSarcasmModel()

tests = [
    "Today is amazing.",
    "I love this project.",
    "This is fantastic!",
    "Yeah right, this is the best day ever.",
    "I absolutely love waiting in traffic.",
    "Oh great, another meeting...",
]

for text in tests:
    result = model.predict(text)

    print("-" * 60)
    print(text)
    print(f"Sarcasm: {result['sarcasm']}")
    print(f"Probability: {result['sarcasm_probability']:.4f}")