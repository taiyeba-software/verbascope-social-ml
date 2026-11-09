"""
why_changed.py   (put in services/ml-brain, next to main.py)

For every post whose prediction changed between two evaluate_api.py
runs, print what the service answered in each run (sentiment, sarcasm,
toxicity ...), read from the runs' *_raw.jsonl files.

  python why_changed.py OLD_results.csv NEW_results.csv OLD_raw.jsonl NEW_raw.jsonl
"""

import json
import sys

import pandas as pd

if len(sys.argv) != 5:
    sys.exit("Usage: python why_changed.py OLD_results.csv NEW_results.csv OLD_raw.jsonl NEW_raw.jsonl")

old = pd.read_csv(sys.argv[1])
new = pd.read_csv(sys.argv[2])
pcol = "Predicted AI Signal"
tcol = "Text"


def load_raw(path):
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


old_raw = load_raw(sys.argv[3])
new_raw = load_raw(sys.argv[4])
print(f"rows: results {len(old)}/{len(new)}  raw {len(old_raw)}/{len(new_raw)}")
if not (len(old) == len(new) == len(old_raw) == len(new_raw)):
    print("WARNING: counts differ, row alignment may be wrong.\n")

KEYS = ["language", "routing", "sentiment", "sarcasm", "sarcasm_probability",
        "toxicity", "toxicity_top_label", "toxicity_top_label_score",
        "risk_flag", "explanation"]


def short(rec):
    rec = rec.get("response", rec) if isinstance(rec, dict) else rec
    if not isinstance(rec, dict):
        return str(rec)[:300]
    picked = {k: rec[k] for k in KEYS if k in rec}
    if not picked:
        return json.dumps(rec, ensure_ascii=False)[:600]
    return json.dumps(picked, ensure_ascii=False)


changed = old[pcol].astype(str) != new[pcol].astype(str)
for i in old.index[changed]:
    print("=" * 70)
    print("text    :", str(new.at[i, tcol])[:120].replace("\n", " "))
    print("expected:", new.at[i, "Expected"], "|", old.at[i, pcol], "->", new.at[i, pcol])
    if i < len(old_raw):
        print("OLD raw :", short(old_raw[i]))
    if i < len(new_raw):
        print("NEW raw :", short(new_raw[i]))