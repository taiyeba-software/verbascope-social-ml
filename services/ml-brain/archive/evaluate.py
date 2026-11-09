"""
evaluate.py

Runs the complete ML Brain pipeline (language routing, sentiment/sarcasm,
toxicity, risk engine) against the labeled evaluation dataset(s) and
writes evaluation/results.csv for evaluation_metrics.py to consume.

By default this evaluates evaluation_dataset.csv (Bangla, thesis-scale
evaluation set). If evaluation/english_evaluation_dataset.csv also
exists, it is evaluated too and combined into the same results.csv with
a Language column, so evaluation_metrics.py's confusion matrix reflects
the full multilingual system. Missing the English file is not an error
— evaluate.py just runs on Bangla alone, same as before.

Mirrors the exact routing/model-selection logic used in production
(rabbit_consumer.py), including known current limitations (e.g. English
sentiment is hardcoded to "Neutral" pending a real English sentiment
model) — this script measures the system as it actually behaves in
production, not an idealized version of it.

Run from the ml-brain/ directory:
    python evaluation/evaluate.py
"""

import csv
import os
import sys
import re

# Allow "from routing.router import ..." etc. when running this script
# directly from evaluation/, since it needs the parent ml-brain/ package.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.sentiment_sarcasm import SentimentSarcasmModel
from models.english_sarcasm import EnglishSarcasmModel
from models.toxicity import ToxicityModel
from models.english_toxicity import EnglishToxicityModel
from routing.router import route, ENGLISH_TOXICITY_MODEL
from risk.risk_engine import calculate_signal


BANGLA_DATASET = os.path.join(os.path.dirname(__file__), "evaluation_dataset.csv")
ENGLISH_DATASET = os.path.join(os.path.dirname(__file__), "english_evaluation_dataset.csv")
RESULTS_CSV = os.path.join(os.path.dirname(__file__), "results.csv")

# Rows whose Text is a placeholder/summary rather than the real post
# content (e.g. "[Full text not supplied — summary only: ...]") can't be
# meaningfully scored — running the model on the placeholder text isn't
# evaluating the actual post. These are skipped, with a printed note.
PLACEHOLDER_MARKERS = ["[Full text not supplied", "— summary only"]

SIGNAL_LABEL_RE = re.compile(r"[^A-Za-z ]")  # strips emoji, keeps letters/spaces


def clean_signal(raw: str) -> str:
    """
    '🟡 Yellow' -> 'Yellow', '🔴 Red' -> 'Red', '🟢 Green' -> 'Green'.
    Also handles an already-clean 'Yellow'/'Green'/'Red' unchanged.
    """
    if not raw:
        return ""
    stripped = SIGNAL_LABEL_RE.sub("", raw).strip()
    return stripped.title()


def should_skip(row: dict) -> str | None:
    """Returns a skip reason string, or None if the row should be evaluated."""
    if row.get("Category", "").strip().lower().startswith("system-generated"):
        return "system-generated (not user content)"

    text = row.get("Text", "") or ""
    for marker in PLACEHOLDER_MARKERS:
        if marker in text:
            return "placeholder/summary text, not full post"

    if row.get("Status", "").strip().lower() != "ready":
        return f"status is '{row.get('Status')}', not Ready"

    return None


def load_dataset(path: str, language_label: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for row in rows:
        row["_source_language_label"] = language_label
    return rows


def run_pipeline(text: str, models: dict) -> dict:
    """
    Runs one text through language routing, sentiment/sarcasm, toxicity,
    and the risk engine — the same sequence rabbit_consumer.py uses in
    production.
    """
    decision = route(text)

    # --------------------------------------------------
    # Toxicity — language-aware (English -> toxic-bert, else Bangla model)
    # --------------------------------------------------
    if decision.toxicity_model == ENGLISH_TOXICITY_MODEL:
        toxicity_result = models["english_toxicity"].predict(text)
        toxicity_score = toxicity_result["score"]
    else:
        toxicity_score = models["toxicity"].predict(text)

    # --------------------------------------------------
    # Sentiment + Sarcasm
    # --------------------------------------------------
    if decision.language == "Bangla":
        result = models["bangla"].predict(text)
        sentiment = result["sentiment"]
        sarcasm = result["sarcasm"] == "Sarcastic"
        sarcasm_probability = result["sarcasm_probability"]

    elif decision.language == "English":
        result = models["english_sarcasm"].predict(text)
        # Mirrors the current production placeholder in rabbit_consumer.py —
        # no English sentiment model is wired in yet. Kept identical here
        # so this evaluation measures the system as it actually behaves.
        sentiment = "Neutral"
        sarcasm = result["sarcasm"]
        sarcasm_probability = result["sarcasm_probability"]

    else:
        # Banglish / Mixed / Unknown
        sentiment = "Unknown"
        sarcasm = False
        sarcasm_probability = 0.0

    risk = calculate_signal(
        sentiment=sentiment,
        sarcasm=sarcasm,
        toxicity_score=toxicity_score,
        sarcasm_probability=sarcasm_probability,
    )

    return {
        "language": decision.language,
        "sentiment": sentiment,
        "sarcasm": sarcasm,
        "toxicity_score": toxicity_score,
        "toxicity_level": risk.toxicity_level,
        "signal": risk.signal.title(),  # "red" -> "Red"
    }


def main():
    print("Loading models (this can take a while on first run)...")
    models = {
        "bangla": SentimentSarcasmModel(),
        "english_sarcasm": EnglishSarcasmModel(),
        "toxicity": ToxicityModel(),
        "english_toxicity": EnglishToxicityModel(),
    }
    print("Models loaded.\n")

    rows = load_dataset(BANGLA_DATASET, "Bangla-dataset")
    english_rows = load_dataset(ENGLISH_DATASET, "English-dataset")

    if english_rows:
        print(f"Found {len(english_rows)} rows in english_evaluation_dataset.csv — including in this run.")
        rows += english_rows
    else:
        print("No english_evaluation_dataset.csv found — evaluating Bangla dataset only.")

    if not rows:
        print(f"No rows found. Checked: {BANGLA_DATASET}")
        return

    results = []
    skipped = 0
    category_totals = {}
    language_totals = {}

    total = len(rows)
    for i, row in enumerate(rows, start=1):
        if i % 10 == 0 or i == total:
            print(f"Processing row {i}/{total}...")

        reason = should_skip(row)
        if reason:
            skipped += 1
            continue

        text = row["Text"]
        prediction = run_pipeline(text, models)

        expected_signal = clean_signal(row.get("Expected AI Signal", ""))
        predicted_signal = prediction["signal"]
        correct = "Yes" if predicted_signal == expected_signal else "No"

        category = row.get("Category", "Unknown")
        detected_language = prediction["language"]

        category_totals.setdefault(category, {"pass": 0, "total": 0})
        category_totals[category]["total"] += 1
        if correct == "Yes":
            category_totals[category]["pass"] += 1

        language_totals.setdefault(detected_language, {"pass": 0, "total": 0})
        language_totals[detected_language]["total"] += 1
        if correct == "Yes":
            language_totals[detected_language]["pass"] += 1

        results.append({
            "ID": row.get("ID", ""),
            "Category": category,
            "Text": text,
            "Detected Language": detected_language,
            "Expected Sentiment": row.get("Expected Sentiment", ""),
            "Predicted Sentiment": prediction["sentiment"],
            "Expected Sarcasm": row.get("Expected Sarcasm", ""),
            "Predicted Sarcasm": "Yes" if prediction["sarcasm"] else "No",
            "Expected Toxicity": row.get("Expected Toxicity", ""),
            "Predicted Toxicity": prediction["toxicity_level"],
            "Toxicity Score": prediction["toxicity_score"],
            "Expected AI Signal": expected_signal,
            "Predicted AI Signal": predicted_signal,
            "Model Prediction": (
                f"{prediction['sentiment']} / "
                f"{'Sarcastic' if prediction['sarcasm'] else 'Non-Sarcastic'} / "
                f"{prediction['toxicity_level']} toxicity -> {predicted_signal}"
            ),
            "Correct?": correct,
        })

    if not results:
        print("No rows were evaluated (all skipped). Check Status/Category filters.")
        return

    with open(RESULTS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)

    total_pass = sum(1 for r in results if r["Correct?"] == "Yes")
    total_count = len(results)

    print("\n" + "=" * 70)
    print(f"Evaluated {total_count} rows ({skipped} skipped).")
    print(f"Overall accuracy: {total_pass}/{total_count} ({total_pass / total_count * 100:.1f}%)")

    print("\nAccuracy by category:")
    for category, counts in sorted(category_totals.items()):
        acc = counts["pass"] / counts["total"] * 100 if counts["total"] else 0.0
        print(f"  {category:35s} {counts['pass']:3d}/{counts['total']:3d}  ({acc:.1f}%)")

    print("\nAccuracy by detected language:")
    for lang, counts in sorted(language_totals.items()):
        acc = counts["pass"] / counts["total"] * 100 if counts["total"] else 0.0
        print(f"  {lang:15s} {counts['pass']:3d}/{counts['total']:3d}  ({acc:.1f}%)")

    print("=" * 70)
    print(f"Full results written to {RESULTS_CSV}")
    print("Run evaluation_metrics.py next to generate the classification report and confusion matrix.")


if __name__ == "__main__":
    main()