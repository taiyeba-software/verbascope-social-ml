import psutil, os
process = psutil.Process(os.getpid())
print(f"Memory before: {process.memory_info().rss / 1024**2:.0f} MB")

from models.sentiment_sarcasm import SentimentSarcasmModel
from models.english_sarcasm import EnglishSarcasmModel
from models.toxicity import ToxicityModel
from models.english_toxicity import EnglishToxicityModel

bangla_model = SentimentSarcasmModel()
english_model = EnglishSarcasmModel()
toxicity_model = ToxicityModel()
english_toxicity_model = EnglishToxicityModel()

print(f"Memory after all 4 models loaded: {process.memory_info().rss / 1024**2:.0f} MB")