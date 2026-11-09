"""
try_mixed.py  (put in services/ml-brain, next to main.py)

Manual check for Chunk 3: shows what each model says about every
sentence of a code-mixed post. Does not touch the live system.

Run:   python try_mixed.py
"""

import importlib
import inspect

from models.sentiment_sarcasm import SentimentSarcasmModel
from models.toxicity import ToxicityModel
from models.english_toxicity import EnglishToxicityModel
from pipelines.analyzer import Analyzer
from pipelines.mixed_runner import run_segments


def load_class(module_name: str, must_contain: str):
    """Find the model class inside a module, so we don't depend on its exact name."""
    module = importlib.import_module(module_name)
    for name, obj in inspect.getmembers(module, inspect.isclass):
        if obj.__module__ == module_name and must_contain.lower() in name.lower():
            return obj
    raise ImportError(f"No class with '{must_contain}' found in {module_name}")


EnglishSarcasm = load_class("models.english_sarcasm", "sarcasm")
EnglishSentiment = load_class("models.english_sentiment", "sentiment")

print("Loading models (first run can take a while)...")

analyzer = Analyzer(
    bangla_model=SentimentSarcasmModel(),
    english_model=EnglishSarcasm(),
    bangla_toxicity_model=ToxicityModel(),
    english_toxicity_model=EnglishToxicityModel(),
    english_sentiment_model=EnglishSentiment(),
)

TEXTS = [
    "এই group-এর সবাই fake আর stupid, কেউ কিছু বোঝে না। Disgusting লোকজন সব।",
    "আর একবার আমার সাথে লাগলে দেখে নিবো, তোকে ছাড়বো না। Last warning.",
    "মানুষ সমাজের বোঝা, seriously disgusting.",
    "তোমার মতো মানুষ সমাজের বোঝা, seriously disgusting.",
    "আজকে আমি খুব happy কারণ exam ভালো হয়েছে।",
]


def show_bangla(b):
    if b is None:
        print("   Bangla : (no Bangla text in this sentence)")
        return
    print(
        f"   Bangla : sentiment={b['sentiment']}  "
        f"toxicity={b['toxicity']:.2f}  "
        f"sarcasm={b['sarcasm']} ({b['sarcasm_probability']:.2f})"
    )


def show_english(e):
    if e is None:
        print("   English: (no English words in this sentence)")
        return
    sc = e["sentiment_confidence"]
    sc_text = f"{sc:.2f}" if sc is not None else "-"
    sp = e["sarcasm_probability"]
    sp_text = f"{sp:.2f}" if sp is not None else "-"
    print(
        f"   English: sentiment={e['sentiment']} ({sc_text})  "
        f"toxicity={e['toxicity']} [{e['toxicity_top_label']} "
        f"{e['toxicity_top_label_score']:.2f}]  "
        f"sarcasm={e['sarcasm']} ({sp_text})"
    )


for text in TEXTS:
    print("\n" + "=" * 70)
    print("POST:", text)

    for i, r in enumerate(run_segments(analyzer, text), start=1):
        print(f"\n [{i}] {r['text']}")
        print(f"   English words seen by English models: {r['latin_view']!r}")
        show_bangla(r["bangla"])
        show_english(r["english"])
        print(
            f"   => sentence sarcasm: {r['sarcasm']} "
            f"(basis: {r['sarcasm_basis']})"
        )