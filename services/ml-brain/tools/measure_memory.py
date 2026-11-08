import os
import sys
from pathlib import Path

try:
    import psutil
except ImportError:
    print("psutil is required. Install it with: pip install psutil", file=sys.stderr)
    raise SystemExit(1)


PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

process = psutil.Process(os.getpid())
rows = []


def memory_mb():
    memory = process.memory_full_info()
    return memory.rss / (1024**2), memory.uss / (1024**2)


def record(checkpoint):
    rss_mb, uss_mb = memory_mb()
    rows.append((checkpoint, rss_mb, uss_mb))
    print(f"{checkpoint}: RSS={rss_mb:.2f} MB, USS={uss_mb:.2f} MB", flush=True)


record("Start")

import torch
import transformers

record("After importing torch and transformers")

from models.sentiment_sarcasm import SentimentSarcasmModel
from models.english_sarcasm import EnglishSarcasmModel
from models.toxicity import ToxicityModel
from models.english_toxicity import EnglishToxicityModel

bangla_model = SentimentSarcasmModel()
record("After loading Bangla sentiment/sarcasm")

english_model = EnglishSarcasmModel()
record("After loading English sarcasm")

toxicity_model = ToxicityModel()
record("After loading Bangla toxicity")

english_toxicity_model = EnglishToxicityModel()
record("After loading English toxicity")

from pipelines.analyzer import Analyzer

analyzer = Analyzer(
    bangla_model=bangla_model,
    english_model=english_model,
    bangla_toxicity_model=toxicity_model,
    english_toxicity_model=english_toxicity_model,
)
record("After building Analyzer")

bangla_sentence = "আজকের দিনটি সুন্দর, সবাই মিলে ভালো কাজ করি।"
texts = [
    ("Short Bangla", "আজকের দিনটি খুব ভালো।"),
    ("Short English", "This service is great."),
    (
        "Bangla-English mixed",
        "Wow, দারুণ service! ২ ঘণ্টা wait করে শুনলাম system down. Truly amazing",
    ),
    ("Long Bangla (~1,000 characters)", (bangla_sentence + " ") * 23),
]

for run_number in (1, 2):
    for label, text in texts:
        analyzer.analyze(text)
        record(f"Run {run_number} - {label}")

if os.name == "nt":
    peak_mb = process.memory_info().peak_wset / (1024**2)
    peak_source = "Windows peak_wset"
else:
    import resource

    peak_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    peak_source = "Linux ru_maxrss"

print(f"PEAK memory ({peak_source}): {peak_mb:.2f} MB", flush=True)

table_lines = [
    f"{'Checkpoint':<43} {'RSS MB':>10} {'USS MB':>10} {'Peak MB':>10}",
    f"{'-' * 43} {'-' * 10} {'-' * 10} {'-' * 10}",
]
for checkpoint, rss_mb, uss_mb in rows:
    table_lines.append(
        f"{checkpoint:<43} {rss_mb:>10.2f} {uss_mb:>10.2f} {peak_mb:>10.2f}"
    )
table_lines.append(
    f"{'PEAK (' + peak_source + ')':<43} {'-':>10} {'-':>10} {peak_mb:>10.2f}"
)

table = "\n".join(table_lines)
print("\nFinal memory summary")
print(table)

report_path = Path(__file__).resolve().parent / "memory_report.txt"
report_path.write_text(table + "\n", encoding="utf-8")
print(f"\nSaved report to {report_path}")
