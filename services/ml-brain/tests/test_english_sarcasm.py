from models.english_sarcasm import EnglishSarcasmModel


model = EnglishSarcasmModel()

tests = [
    "Yeah right, this is the best day ever.",
    "I absolutely love waiting in traffic.",
    "Thank you so much!",
    "Hello",
    "I hate this product.",
    "What a wonderful surprise!",
    "Oh great, another meeting...",
    "i hate you 😘"
]

for text in tests:
    print("-" * 50)
    print(text)
    print(model.predict(text))
