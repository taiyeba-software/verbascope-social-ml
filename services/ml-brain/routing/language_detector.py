"""
Script-based language detection: Bangla, English, Mixed (+ Unknown).
Romanized Bangla ("Banglish") is NOT supported; it is Latin script,
so it is detected as English.
"""

import re
from dataclasses import dataclass

BANGLA_RANGE = re.compile(r"[\u0980-\u09FF]")
LATIN_RANGE = re.compile(r"[A-Za-z]")


@dataclass
class LanguageDecision:
    language: str
    confidence: float
    bangla_chars: int
    latin_chars: int
    bangla_ratio: float
    banglish_ratio: float = 0.0  # always 0.0, kept for old code

    def __iter__(self):
        return iter((self.language, self.confidence))


def detect_language(text: str) -> LanguageDecision:
    if not text or not text.strip():
        return LanguageDecision("Unknown", 0.0, 0, 0, 0.0)

    b = len(BANGLA_RANGE.findall(text))
    l = len(LATIN_RANGE.findall(text))
    total = b + l
    if total == 0:
        return LanguageDecision("Unknown", 0.0, b, l, 0.0)

    ratio = b / total
    if ratio >= 0.85:
        return LanguageDecision("Bangla", round(ratio, 2), b, l, round(ratio, 2))
    if ratio <= 0.15:
        return LanguageDecision("English", round(1 - ratio, 2), b, l, round(ratio, 2))

    conf = 1 - abs(ratio - 0.5) * 2
    return LanguageDecision("Mixed", round(conf, 2), b, l, round(ratio, 2))


if __name__ == "__main__":
    for s in [
        "বাংলাদেশ আজ দারুণ খেলেছে!",
        "This is a great day for VerbaScope.",
        "ami ajke onek happy, tumi kmn acho?",
        "আজকে আমি খুব happy কারণ exam ভালো হয়েছে।",
        "আজ meeting আছে",
        "🎉🔥",
    ]:
        d = detect_language(s)
        print(f"{d.language:8s} conf={d.confidence:.2f} | {s}")