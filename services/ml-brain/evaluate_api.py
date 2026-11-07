#!/usr/bin/env python3
"""
Evaluate the RUNNING ml-brain service through POST /analyze.

Why this way: /analyze calls the same Analyzer.analyze() as the RabbitMQ consumer,
so the numbers describe the real production path. The old evaluate.py re-implemented
routing and broke when the router API changed.

Start the service first (from services/ml-brain):
    uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1

Then, from services/ml-brain:
    python evaluate_api.py --csv evaluation/evaluation_dataset.csv
    python evaluate_api.py --csv evaluation/english_evaluation_dataset.csv
    python evaluate_api.py --csv evaluation/evaluation_dataset.csv --check-determinism

If ML_API_KEY is set on the server, set the same variable here (never commit it).
Every number printed comes from the run; nothing is typed in by hand.
"""
import argparse
import json
import os
import re
import statistics
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime

import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score

LABELS = ["Green", "Yellow", "Red"]


def bare(value):
    """'🟡 Yellow' / 'yellow' -> 'Yellow'. Anything else -> None."""
    m = re.search(r"(green|yellow|red)", str(value), re.I)
    return m.group(1).capitalize() if m and len(str(value)) < 30 else None


def call(url, text, key, timeout):
    headers = {"Content-Type": "application/json"}
    if key:
        headers["X-API-Key"] = key
    req = urllib.request.Request(
        url, data=json.dumps({"text": text}).encode("utf-8"), headers=headers, method="POST"
    )
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body, time.perf_counter() - t0


def find_flag(resp):
    """Find the Green/Yellow/Red risk value in the JSON without guessing its key name."""
    found = []

    def walk(obj, path=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                walk(v, f"{path}.{k}" if path else k)
        elif isinstance(obj, str) and bare(obj) and len(obj) < 30:
            found.append((path, bare(obj)))

    walk(resp)
    risky = [f for f in found if "risk" in f[0].lower()]
    pick = risky or found
    if len(pick) == 1:
        return pick[0]
    raise ValueError(f"Cannot tell which field is the risk flag. Candidates: {found}")


def run_once(df, url, key, timeout, raw_path):
    preds, langs, pipes, times = [], [], [], []
    flag_field = None
    with open(raw_path, "w", encoding="utf-8") as raw:
        for i, row in enumerate(df.itertuples(index=False), 1):
            try:
                resp, dt = call(url, row.Text, key, timeout)
            except urllib.error.HTTPError as e:
                sys.exit(f"HTTP {e.code} for ID {row.ID}. Check the API key or the text length.")
            except Exception as e:  # connection refused, timeout ...
                sys.exit(f"Cannot reach {url} ({type(e).__name__}). Is the service running?")
            path, label = find_flag(resp)
            flag_field = flag_field or path
            preds.append(label)
            langs.append(resp.get("language") or resp.get("detected_language") or "")
            pipes.append(resp.get("pipeline") or resp.get("selected_pipeline") or "")
            times.append(dt)
            raw.write(json.dumps({"ID": row.ID, "response": resp}, ensure_ascii=False) + "\n")
            if i % 20 == 0:
                print(f"  {i}/{len(df)} done", flush=True)
    return preds, langs, pipes, times, flag_field


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--url", default="http://127.0.0.1:8000/analyze")
    ap.add_argument("--out-dir", default="results")
    ap.add_argument("--timeout", type=float, default=120)
    ap.add_argument("--limit", type=int, default=0, help="only the first N rows (dry run)")
    ap.add_argument("--check-determinism", action="store_true", help="run twice and compare")
    args = ap.parse_args()

    key = os.environ.get("ML_API_KEY", "")
    df = pd.read_csv(args.csv)
    n_total = len(df)

    if "Exclude" in df.columns:
        df = df[df["Exclude"].fillna("").astype(str).str.strip().str.lower() != "yes"]
    df = df.copy()
    df["Expected"] = df["Expected AI Signal"].map(bare)
    df = df[df["Expected"].notna() & df["Text"].notna()]
    if args.limit:
        df = df.head(args.limit)
    n_excluded = n_total - len(df)

    os.makedirs(args.out_dir, exist_ok=True)
    stem = os.path.splitext(os.path.basename(args.csv))[0]
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = os.path.join(args.out_dir, f"{stem}_{stamp}")

    print(f"Dataset: {args.csv}\nRows in file: {n_total} | evaluated: {len(df)} | skipped: {n_excluded}")
    preds, langs, pipes, times, flag_field = run_once(df, args.url, key, args.timeout, base + "_raw.jsonl")

    out = df[["ID", "Text", "Expected AI Signal"]].copy()
    out["Expected"] = df["Expected"].values
    out["Predicted AI Signal"] = preds
    out["Language"] = langs
    out["Pipeline"] = pipes
    out["Correct?"] = out["Expected"] == out["Predicted AI Signal"]
    out.to_csv(base + "_results.csv", index=False, encoding="utf-8")
    out[~out["Correct?"]].to_csv(base + "_errors.csv", index=False, encoding="utf-8")

    y_true, y_pred = out["Expected"], out["Predicted AI Signal"]
    cm = confusion_matrix(y_true, y_pred, labels=LABELS)
    cm_df = pd.DataFrame(cm, index=[f"true {l}" for l in LABELS], columns=[f"pred {l}" for l in LABELS])
    macro = f1_score(y_true, y_pred, labels=LABELS, average="macro", zero_division=0)
    red_green = int(cm[LABELS.index("Red"), LABELS.index("Green")] + cm[LABELS.index("Green"), LABELS.index("Red")])

    lines = [
        f"Dataset: {args.csv}",
        f"Run time: {stamp} | endpoint: {args.url} | risk field used: {flag_field}",
        f"Test-set size: {len(out)} (skipped {n_excluded})",
        "Class counts (expected): " + ", ".join(f"{l}={int((y_true == l).sum())}" for l in LABELS),
        "",
        "Confusion matrix (rows = expected, columns = predicted):",
        cm_df.to_string(),
        "",
        classification_report(y_true, y_pred, labels=LABELS, digits=3, zero_division=0),
        f"Accuracy: {accuracy_score(y_true, y_pred):.3f}",
        f"Macro-F1: {macro:.3f}",
        f"Red<->Green confusions (either direction): {red_green}",
        "",
        "HTTP round-trip per post on this machine, model inference included (seconds): "
        f"median={statistics.median(times):.3f}, "
        f"p95={sorted(times)[max(0, int(0.95 * len(times)) - 1)]:.3f}, max={max(times):.3f}",
        "Routing seen: " + ", ".join(f"{k}={v}" for k, v in pd.Series(pipes).value_counts().items()),
        "",
        f"Files: {base}_results.csv, {base}_errors.csv, {base}_raw.jsonl",
    ]

    if args.check_determinism:
        print("Second run for the determinism check ...")
        preds2, *_ = run_once(df, args.url, key, args.timeout, base + "_raw_run2.jsonl")
        diff = [int(i) for i, a, b in zip(df["ID"], preds, preds2) if a != b]
        lines.append(f"Determinism: {'IDENTICAL predictions in both runs' if not diff else 'DIFFERENT for IDs ' + str(diff)}")

    report = "\n".join(lines)
    print("\n" + report)
    with open(base + "_report.txt", "w", encoding="utf-8") as f:
        f.write(report + "\n")
    print(f"\nSaved: {base}_report.txt")


if __name__ == "__main__":
    main()
