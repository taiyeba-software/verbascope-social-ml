"""
try_analyze_mixed.py  (put in services/ml-brain, next to main.py)

Runs the REAL Analyzer.analyze() on code-mixed posts and prints the
final result the frontend would get. Run:  python try_analyze_mixed.py
"""

import importlib
import inspect

from models.sentiment_sarcasm import SentimentSarcasmModel
from models.toxicity import ToxicityModel
from models.english_toxicity import EnglishToxicityModel
from pipelines.analyzer import Analyzer


def load_class(module_name, must_contain):
    module = importlib.import_module(module_name)
    for name, obj in inspect.getmembers(module, inspect.isclass):
        if obj.__module__ == module_name and must_contain.lower() in name.lower():
            return obj
    raise ImportError(f"No class with '{must_contain}' in {module_name}")


analyzer = Analyzer(
    bangla_model=SentimentSarcasmModel(),
    english_model=load_class("models.english_sarcasm", "sarcasm")(),
    bangla_toxicity_model=ToxicityModel(),
    english_toxicity_model=EnglishToxicityModel(),
    english_sentiment_model=load_class("models.english_sentiment", "sentiment")(),
)

# (text, what you expect per LABEL_DEFINITIONS.md)
CASES = [
    ("এই group-এর সবাই fake আর stupid, কেউ কিছু বোঝে না। Disgusting লোকজন সব।", "red"),
    ("আর একবার আমার সাথে লাগলে দেখে নিবো, তোকে ছাড়বো না। Last warning.", "red"),
    ("মানুষ সমাজের বোঝা, seriously disgusting.", "red"),
    ("তোমার মতো মানুষ সমাজের বোঝা, seriously disgusting.", "red"),
    ("আজকে আমি খুব happy কারণ exam ভালো হয়েছে।", "green"),
    ("আজ meeting আছে", "green"),
    ("আজ আবহাওয়া খুব সুন্দর", "green"),   # pure Bangla: old path
    ("I hate this so much", "yellow"),        # pure English: old path
]

ok = 0
for text, expected in CASES:
    r = analyzer.analyze(text)
    match = "OK " if r["risk_flag"] == expected else "DIFF"
    ok += r["risk_flag"] == expected
    print("=" * 70)
    print(f"[{match}] expected={expected}  got={r['risk_flag']}")
    print("text        :", text)
    print("sentiment   :", r["sentiment"], "| sarcasm:", r["sarcasm"])
    print("toxicity    :", r["toxicity"], r["toxicity_level"],
          "| label:", r["toxicity_top_label"])
    print("confidence  :", r["confidence"])
    print("explanation :", r["explanation"])

print("\nMatched", ok, "of", len(CASES))