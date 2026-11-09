import sys
from try_mixed import analyzer  # মডেল লোড হবে
from pipelines.mixed_runner import run_segments

text = sys.argv[1] if len(sys.argv) > 1 else "আজ meeting আছে"
for r in run_segments(analyzer, text):
    print("সেগমেন্ট:", r["text"], "| English words:", repr(r["latin_view"]))
    print("  Bangla :", r["bangla"])
    print("  English:", r["english"])