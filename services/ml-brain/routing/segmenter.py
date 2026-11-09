"""
routing/segmenter.py

Splits a post into sentence-sized Segments for the code-mixed pipeline.

Each Segment carries:
  text        : the sentence exactly as written (Bangla models see this)
  latin_view  : only the English/Latin words of the sentence, joined by
                spaces (English models see this)
  has_bangla  : sentence contains Bangla-script letters
  latin_words : number of Latin words found

Why a "latin_view": English models (toxic-BERT, RoBERTa) cannot read
Bangla script, so feeding them a Bangla sentence gives noise. Feeding
them only the English words lets them judge "fake", "stupid",
"Disgusting" without being confused by the Bangla part.
"""

import re
from dataclasses import dataclass

BANGLA_CHAR = re.compile(r"[\u0980-\u09FF]")
# English word; keeps apostrophes (don't), drops "-এর" suffixes (group-এর -> group)
LATIN_WORD = re.compile(r"[A-Za-z]+(?:['\u2019][A-Za-z]+)*")

# Split AFTER । ! ? or newline, and after "." only when followed by space/end
_SENT_SPLIT = re.compile(r"(?<=[\u0964!?])\s*|(?<=\.)\s+|\n+")

MAX_SEGMENTS = 8        # bounds latency: long posts are grouped, not dropped
MIN_LETTERS = 2         # fragments with fewer letters are merged into a neighbour


@dataclass
class Segment:
    text: str
    latin_view: str
    has_bangla: bool
    latin_words: int


def _letters(s: str) -> int:
    return len(BANGLA_CHAR.findall(s)) + len(re.findall(r"[A-Za-z]", s))


def _split_sentences(text: str) -> list[str]:
    parts = [p.strip() for p in _SENT_SPLIT.split(text) if p and p.strip()]

    merged: list[str] = []
    for p in parts:
        if merged and _letters(p) < MIN_LETTERS:
            merged[-1] += " " + p          # stray "?" / "ok" etc.
        else:
            merged.append(p)

    # A tiny leading fragment joins the next sentence instead
    if len(merged) > 1 and _letters(merged[0]) < MIN_LETTERS:
        merged[1] = merged[0] + " " + merged[1]
        merged = merged[1:]

    # Too many sentences: group neighbours so nothing is skipped
    if len(merged) > MAX_SEGMENTS:
        size = -(-len(merged) // MAX_SEGMENTS)   # ceil division
        merged = [" ".join(merged[i:i + size]) for i in range(0, len(merged), size)]

    return merged


def segment(text: str) -> list[Segment]:
    if not text or not text.strip():
        return []

    out = []
    for s in _split_sentences(text.strip()):
        words = LATIN_WORD.findall(s)
        out.append(Segment(
            text=s,
            latin_view=" ".join(words),
            has_bangla=bool(BANGLA_CHAR.search(s)),
            latin_words=len(words),
        ))
    return out


if __name__ == "__main__":
    samples = [
        "এই group-এর সবাই fake আর stupid, কেউ কিছু বোঝে না। Disgusting লোকজন সব।",
        "আর একবার আমার সাথে লাগলে দেখে নিবো, তোকে ছাড়বো না। Last warning.",
        "I hate this so much",
        "মানুষ সমাজের বোঝা, seriously disgusting.",
        "Wait... what? Price is 3.5 taka! ok",
        "🎉🔥",
    ]
    for t in samples:
        print("=" * 60)
        print(t)
        for sg in segment(t):
            print(f"  seg={sg.text!r}\n    latin_view={sg.latin_view!r} "
                  f"bangla={sg.has_bangla} words={sg.latin_words}")