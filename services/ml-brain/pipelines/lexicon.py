"""
pipelines/lexicon.py

Chunk 5: a small rule-based "safety floor" for toxicity. It catches
threats, abuse and self-harm phrases the models miss (for example the
Bangla toxicity model gave only 1.49 to a clear threat).

It can only RAISE the toxicity score, never lower it. It is NOT a
complete list: Bangla spelling varies a lot, so it WILL miss things.
Review and extend the pattern lists below for your own data.

SCOPE: Bangla-script text and real English words only. Romanized Bangla
("Banglish", e.g. "ami tore mere felbo") is NOT covered on purpose.

Toxicity scale is the same 1-5 scale the risk engine uses:
  >= 3.5 -> High / Red,   >= 2.0 -> Medium / Yellow.

Rules (per sentence):
  strong threat phrase                          -> 5  (threat_phrase)
  self-harm phrase                              -> 5  (self_harm_phrase)
  2+ different "weak" threat phrases            -> 4  (threat_phrase)
  1 weak threat phrase + a "you" word           -> 3  (threat_phrase)
  abuse word + a "you" word (direct insult)     -> 4  (abuse_phrase)
  abuse word alone                              -> 3  (abuse_phrase)
A weak phrase alone does nothing ("আমি আশা ছাড়বো না" is harmless).
"""

import re
import unicodedata

from routing.segmenter import segment

_B = r"(?<![\u0980-\u09FF])"      # left boundary for Bangla words
_L = r"\b"                         # boundary for Latin words

# -------------------------------------------------------------------
# Pattern lists. Spaces in a phrase match any whitespace.
# -------------------------------------------------------------------

STRONG_THREAT = [
    # Bangla
    _B + r"মেরে\s*ফেল(?:বো|ব|বি|মু|ম)",
    _B + r"খুন\s*(?:করব|করবো|করে\s*ফেল)",
    _B + r"জানে\s*মেরে",
    _B + r"কেটে\s*ফেল(?:বো|ব|বি)",
    _B + r"লাশ\s*ফেল",
    # English
    _L + r"kill\s+(?:you|him|her|them|myself)",
    _L + r"(?:will|gonna|going\s+to)\s+kill\b",
    _L + r"(?:shoot|stab|murder)\s+you",
]

WEAK_THREAT = [
    _B + r"দেখে\s*ন[িে]ব[ো]?",
    _B + r"ছাড়ব[ো]?\s*না",
    _B + r"দেখিয়ে\s*দ[েি]ব[ো]?",
    _B + r"শেষ\s*করে\s*দ[েি]ব[ো]?",
    _B + r"খবর\s*আছে",
    _B + r"সাবধান",
    _L + r"last\s+warning",
    _L + r"watch\s+your\s+back",
    _L + r"you(?:'ll|\s+will)\s+regret",
    _L + r"(?:i'll|i\s+will)\s+find\s+you",
]

SELF_HARM = [
    _B + r"আত্মহত্যা",
    _B + r"আত্মহনন",
    _B + r"মরে\s*যেতে\s*চাই",
    _B + r"মরতে\s*চাই",
    _B + r"বাঁচতে\s*চাই\s*না",
    _L + r"suicide",
    _L + r"kill\s+myself",
    _L + r"want\s+to\s+die",
    _L + r"end\s+my\s+life",
    _L + r"self[-\s]?harm",
]

ABUSE = [
    # Bangla (extend this list for your data)
    _B + r"শুয়োর",
    _B + r"শুওর",
    _B + r"কুত্তা",
    _B + r"হারামি",
    _B + r"হারামজাদ[াি]?",
    _B + r"বেজন্মা",
    _B + r"মাগি",
    _B + r"মাগী",
    _B + r"বেশ্যা",
    _B + r"খানকি",
]

# Words meaning "you" (the target of a direct insult / threat)
SECOND_PERSON = [
    _B + r"(?:তুই|তোকে|তোর|তোদের|তুমি|তোমার|তোমাকে|তোমাদের|আপনি|আপনার|আপনাকে)",
    _L + r"(?:you|your|u|ur)\b",
]


def _compile(patterns):
    return [re.compile(p, re.IGNORECASE) for p in patterns]


_STRONG = _compile(STRONG_THREAT)
_WEAK = _compile(WEAK_THREAT)
_SELF = _compile(SELF_HARM)
_ABUSE = _compile(ABUSE)
_YOU = _compile(SECOND_PERSON)

_ZERO_WIDTH = re.compile("[\u200b\u200c\u200d\u2060\ufeff]")


def normalize(text: str) -> str:
    """NFC, remove zero-width characters, collapse whitespace."""
    text = unicodedata.normalize("NFC", text)
    text = _ZERO_WIDTH.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def _any(patterns, s):
    return any(p.search(s) for p in patterns)


def _count_distinct(patterns, s):
    return sum(1 for p in patterns if p.search(s))


def _score_sentence(s: str):
    """Returns (score, label, explanation) or None."""
    if _any(_STRONG, s):
        return (5, "threat_phrase", "Threatening phrase detected (rule match).")
    if _any(_SELF, s):
        return (5, "self_harm_phrase",
                "Self-harm related phrase detected (rule match). Handle with care.")

    you = _any(_YOU, s)
    weak = _count_distinct(_WEAK, s)
    if weak >= 2:
        return (4, "threat_phrase", "Several threatening phrases detected (rule match).")
    if weak == 1 and you:
        return (3, "threat_phrase", "Possible threat aimed at someone (rule match).")

    if _any(_ABUSE, s):
        if you:
            return (4, "abuse_phrase", "Direct abusive language detected (rule match).")
        return (3, "abuse_phrase", "Abusive word detected (rule match).")
    return None


def scan_lexicon(text: str):
    """
    Returns None when nothing matched, otherwise a dict:
      {"score": 3|4|5, "label": str, "explanation": str}
    The highest-scoring sentence wins.
    """
    best = None
    for seg in segment(normalize(text)):
        hit = _score_sentence(seg.text)
        if hit and (best is None or hit[0] > best[0]):
            best = hit
    if best is None:
        return None
    return {"score": best[0], "label": best[1], "explanation": best[2]}


if __name__ == "__main__":
    tests = [
        ("আর একবার আমার সাথে লাগলে দেখে নিবো, তোকে ছাড়বো না। Last warning.", "4 threat"),
        ("তোকে মেরে ফেলবো", "5 threat"),
        ("ami tore mere felbo", "None (Banglish is out of scope)"),
        ("I will kill you", "5 threat"),
        ("আমি আশা ছাড়বো না", "None (harmless)"),
        ("আমি দেখে নেব কাজটা কেমন হয়েছে", "None (harmless)"),
        ("Last warning.", "None"),
        ("তুই একটা হারামি", "4 abuse"),
        ("হারামি আবহাওয়া", "3 abuse"),
        ("আমি আর বাঁচতে চাই না", "5 self_harm"),
        ("আজ আবহাওয়া খুব সুন্দর", "None"),
        ("I love this", "None"),
    ]
    for t, exp in tests:
        print(f"{str(scan_lexicon(t)):75s} expect {exp:18s} | {t}")