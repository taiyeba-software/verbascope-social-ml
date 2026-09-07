from models.english_sentiment import EnglishSentimentModel

model = EnglishSentimentModel()

tests = [
    "hello",
    "I love this product!",
    "This is amazing!",
    "I hate this.",
    "This is terrible.",
    "Worst experience ever.",
]

for text in tests:
    result = model.predict(text)
    print(text)
    print(result)
    print("-" * 40)