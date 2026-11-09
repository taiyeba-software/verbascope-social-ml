"""
scope_report.py   (put in services/ml-brain, next to main.py)

Splits an evaluation run into
  IN SCOPE : posts with Bangla-script letters AND English words
             (the only posts the new code-mixed pipeline may change)
  OUT OF SCOPE : everything else (must be IDENTICAL to the old run)
and compares an OLD and a NEW results file on each part.

  python scope_report.py OLD_results.csv NEW_results.csv

It also lists the English words found in every in-scope post, so YOU can
check that they are real English words of the post and not notes added
to the dataset (e.g. "[trimmed]").
"""

import re
import sys

import pandas as pd

from routing.segmenter import BANGLA_CHAR, LATIN_WORD

if len(sys.argv) != 3:
    sys.exit("Usage: python scope_report.py OLD_results.csv NEW_results.csv")

old = pd.read_csv(sys.argv[1])
new = pd.read_csv(sys.argv[2])
T, E, P = "Text", "Expected", "Predicted AI Signal"

if len(old) != len(new) or not (old[T].astype(str) == new[T].astype(str)).all():
    sys.exit("The two files are not the same posts in the same order.")


def in_scope(text):
    return bool(BANGLA_CHAR.search(text)) and bool(LATIN_WORD.search(text))


mask = new[T].astype(str).map(in_scope)


def acc(df, col):
    return (df[col].astype(str).str.lower() == df[E].astype(str).str.lower()).mean()


def report(name, sel):
    o, n = old[sel], new[sel]
    changed = (o[P].astype(str) != n[P].astype(str)).sum()
    print(f"{name}: {len(o)} posts | accuracy old {acc(o, P):.3f} -> new {acc(n, P):.3f} "
          f"| predictions changed: {changed}")


print()
report("IN SCOPE    (Bangla script + English words)", mask)
report("OUT OF SCOPE (everything else)              ", ~mask)
print("\nOUT OF SCOPE should show 'predictions changed: 0' once the scoped "
      "analyzer.py and lexicon.py are used.\n")

print("=" * 72)
print("IN-SCOPE posts and the English words the English models would see:")
for i in new.index[mask]:
    words = " ".join(LATIN_WORD.findall(str(new.at[i, T])))
    flag = "CHANGED" if str(old.at[i, P]) != str(new.at[i, P]) else "same   "
    print(f"\n[{flag}] expected={new.at[i, E]}  {old.at[i, P]} -> {new.at[i, P]}")
    print("   text   :", re.sub(r"\s+", " ", str(new.at[i, T]))[:90])
    print("   English:", words[:140])