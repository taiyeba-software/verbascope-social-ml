"""
diff_runs.py   (put in services/ml-brain, next to main.py)

Shows which posts changed between two evaluate_api.py runs, and which
columns changed for them. Use it to understand a regression; do NOT use
it to tune thresholds on the evaluation set.

  python diff_runs.py results\\OLD_results.csv results\\NEW_results.csv
"""

import sys

import pandas as pd

if len(sys.argv) != 3:
    sys.exit("Usage: python diff_runs.py OLD_results.csv NEW_results.csv")

old = pd.read_csv(sys.argv[1])
new = pd.read_csv(sys.argv[2])
print("OLD columns:", list(old.columns))
print("NEW columns:", list(new.columns))

if len(old) != len(new):
    sys.exit(f"Different row counts: {len(old)} vs {len(new)}. Cannot align.")

text_col = next((c for c in old.columns if c.lower() in ("text", "post", "content")), None)
pred_col = next((c for c in old.columns if "pred" in c.lower()), None)
exp_col = next((c for c in old.columns if c.lower() in ("expected", "label", "expected_label", "true")), None)

if text_col and text_col in new.columns:
    mismatch = (old[text_col].astype(str) != new[text_col].astype(str)).sum()
    if mismatch:
        sys.exit(f"{mismatch} rows have different text; the two runs are not aligned.")
else:
    print("WARNING: no text column found, aligning by row order only.")

if not pred_col or pred_col not in new.columns:
    sys.exit("Could not find the predicted-label column (name containing 'pred').")

changed = old[pred_col].astype(str) != new[pred_col].astype(str)
print(f"\n{changed.sum()} of {len(old)} rows changed prediction.\n")

for i in old.index[changed]:
    print("=" * 70)
    if text_col:
        print("text    :", new.at[i, text_col])
    if exp_col:
        print("expected:", new.at[i, exp_col])
    print(f"{pred_col}: {old.at[i, pred_col]} -> {new.at[i, pred_col]}")
    for c in new.columns:
        if c in (text_col, pred_col, exp_col) or c not in old.columns:
            continue
        if str(old.at[i, c]) != str(new.at[i, c]):
            print(f"  {c}: {old.at[i, c]} -> {new.at[i, c]}")