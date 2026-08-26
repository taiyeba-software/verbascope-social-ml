from models.sentiment_sarcasm import SentimentSarcasmModel


print("Creating ML model...")

model = SentimentSarcasmModel()


text = "ওয়াও, আবারও অসাধারণ হারলাম!"

print("\nTesting text:")
print(text)

result = model.predict(text)

print("\nResult:")
print(result)