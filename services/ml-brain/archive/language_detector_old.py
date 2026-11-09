""""
language_detector.py

Lightweight, dependency-free language detection for VerbaScope's
language-aware ML Brain routing (Version 2 architecture).

This module is intended for lightweight language routing rather than
language identification research. It provides a fast heuristic
suitable for selecting downstream NLP pipelines, not a statistically
validated classifier. It classifies text by Unicode script
composition, with a small Banglish word-list heuristic to distinguish
romanized Bangla from genuine English.

Returned labels: "Bangla", "English", "Banglish", "Mixed", "Unknown"

Each call returns a LanguageDecision. Previously this returned a bare
(language, confidence) tuple, which meant router.py had no way to see
*why* something was classified as "Mixed" — it never had access to the
underlying Bangla/Latin character counts, so a "Mixed" post always fell
back to the Bangla pipeline regardless of which script actually
dominated. LanguageDecision exposes the raw counts and ratios so the
router (and the evaluation table in MODEL_SELECTION.md) can make that
distinction.
"""

import re
from dataclasses import dataclass


# Unicode block for Bangla script (U+0980–U+09FF)
BANGLA_RANGE = re.compile(r"[\u0980-\u09FF]")
LATIN_RANGE = re.compile(r"[A-Za-z]")

# A small set of very common romanized-Bangla ("Banglish") words.
# Not exhaustive — just enough signal to catch typical Banglish posts
# like "ami ajke onek happy" or "tumi kmn acho".
BANGLISH_WORDS = {
    "ami", "tumi", "apni", "amar", "tomar", "amra", "tara", "she",
    "ache", "ase", "asen", "nai", "hobe", "hoise", "hoy", "hocche",
    "korbo", "korsi", "korche", "korte", "koro", "korlam", "korlo",
    "bhalo", "valo", "kharap", "khub", "onek", "kemon", "kmn", "kobe",
    "kothay", "keno", "ki", "naki", "shob", "sobai", "amake", "tomake",
    "bolo", "bolche", "bolsi", "dekho", "dekhi", "jani", "jantam",
    "jabo", "jai", "asho", "ashbo", "khabo", "khaisi", "ghumaisi",
    "ghumabo", "din", "raat", "aj", "ajke", "kal", "porshu", "bari",
    "bashay", "dhonnobad", "insaallah", "mashallah", "alhamdulillah",
    "chilam", "chilo", "lagbe", "lagse", "lagche", "laglo", "ekta",
    "eta", "oita", "eita", "na", "bhai", "vai", "apu",
}


# ---------------------------------------------------------------------
# Decision object returned to callers
# ---------------------------------------------------------------------

@dataclass
class LanguageDecision:
    """
    Rich language-detection result.

    language        : one of "Bangla", "English", "Banglish", "Mixed",
                       "Unknown"
    confidence      : rough heuristic score in [0, 1], not a calibrated
                       probability (see detect_language docstring)
    bangla_chars    : count of Bangla-script characters found
    latin_chars     : count of Latin-script characters found
    bangla_ratio    : bangla_chars / (bangla_chars + latin_chars),
                       0.0 when there are no script characters at all
    banglish_ratio  : fraction of Latin alphabetic tokens that match
                       the BANGLISH_WORDS list. Computed whenever Latin
                       tokens are present (not just when the language
                       ends up "Banglish"), so downstream code can
                       inspect it even for "English" or "Mixed" text.
    """
    language: str
    confidence: float
    bangla_chars: int
    latin_chars: int
    bangla_ratio: float
    banglish_ratio: float

    # Kept for backwards compatibility with any code that still does
    # `language, confidence = detect_language(text)`.
    def __iter__(self):
        return iter((self.language, self.confidence))


def _banglish_word_ratio(text: str) -> float:
    """Fraction of alphabetic tokens that look like romanized Bangla."""
    tokens = re.findall(r"[A-Za-z']+", text.lower())
    if not tokens:
        return 0.0
    hits = sum(1 for tok in tokens if tok in BANGLISH_WORDS)
    return hits / len(tokens)


def detect_language(text: str) -> LanguageDecision:
    """
    Classify text and return a LanguageDecision.

    language is one of: "Bangla", "English", "Banglish", "Mixed", "Unknown"

    Logic:
      1. Empty text, or text with no Bangla/Latin letters at all
         (emoji-only, numbers, punctuation) -> "Unknown". This is
         distinct from "Mixed": an emoji-only post isn't evidence of
         two languages, it's evidence of no linguistic content to
         route on.
      2. Count Bangla-script characters vs. Latin-script characters.
      3. If overwhelmingly Bangla script  -> "Bangla"
      4. If overwhelmingly Latin script   -> check Banglish word ratio
             - high ratio of known Banglish words -> "Banglish"
             - otherwise                          -> "English"
      5. If both scripts appear in meaningful proportion -> "Mixed"
         (e.g. Bangla sentence with an English phrase inline)

    confidence is a rough heuristic score in [0, 1], not a calibrated
    probability. For "Bangla"/"English" it reflects how dominant that
    script is; for "Banglish" it reflects the Banglish-word ratio; for
    "Mixed" it reflects how close the split is to 50/50 (closer to
    50/50 -> higher confidence it's genuinely mixed); "Unknown" is
    always confidence 0.0.
    """
    if not text or not text.strip():
        return LanguageDecision(
            language="Unknown",
            confidence=0.0,
            bangla_chars=0,
            latin_chars=0,
            bangla_ratio=0.0,
            banglish_ratio=0.0,
        )

    bangla_chars = len(BANGLA_RANGE.findall(text))
    latin_chars = len(LATIN_RANGE.findall(text))
    total_script_chars = bangla_chars + latin_chars

    banglish_ratio = _banglish_word_ratio(text) if latin_chars else 0.0

    if total_script_chars == 0:
        # No Bangla or Latin letters at all (emoji-only, numbers, punctuation)
        return LanguageDecision(
            language="Unknown",
            confidence=0.0,
            bangla_chars=bangla_chars,
            latin_chars=latin_chars,
            bangla_ratio=0.0,
            banglish_ratio=0.0,
        )

    bangla_ratio = bangla_chars / total_script_chars

    # Thresholds are deliberately loose — this is a routing heuristic,
    # not a classifier that needs to be evaluated for its own accuracy.
    if bangla_ratio >= 0.85:
        return LanguageDecision(
            language="Bangla",
            confidence=round(bangla_ratio, 2),
            bangla_chars=bangla_chars,
            latin_chars=latin_chars,
            bangla_ratio=round(bangla_ratio, 2),
            banglish_ratio=round(banglish_ratio, 2),
        )

    if bangla_ratio <= 0.15:
        # Almost entirely Latin script — decide English vs. Banglish
        if banglish_ratio >= 0.20:
            return LanguageDecision(
                language="Banglish",
                confidence=round(min(1.0, banglish_ratio * 2), 2),
                bangla_chars=bangla_chars,
                latin_chars=latin_chars,
                bangla_ratio=round(bangla_ratio, 2),
                banglish_ratio=round(banglish_ratio, 2),
            )
        return LanguageDecision(
            language="English",
            confidence=round(1 - bangla_ratio, 2),
            bangla_chars=bangla_chars,
            latin_chars=latin_chars,
            bangla_ratio=round(bangla_ratio, 2),
            banglish_ratio=round(banglish_ratio, 2),
        )

    # Meaningful presence of both scripts — confidence rises the
    # closer the split is to an even 50/50 mix.
    mixed_confidence = 1 - abs(bangla_ratio - 0.5) * 2
    return LanguageDecision(
        language="Mixed",
        confidence=round(mixed_confidence, 2),
        bangla_chars=bangla_chars,
        latin_chars=latin_chars,
        bangla_ratio=round(bangla_ratio, 2),
        banglish_ratio=round(banglish_ratio, 2),
    )


if __name__ == "__main__":
    # Quick manual smoke test — not a substitute for real unit tests.
    samples = [
        "বাংলাদেশ আজ দারুণ খেলেছে!",
        "This is a great day for VerbaScope.",
        "ami ajke onek happy, tumi kmn acho?",
        "আজকে আমি খুব happy কারণ exam ভালো হয়েছে।",
        "আজ meeting আছে",
        "আজ I am happy",
        "🎉🔥",
    ]
    for s in samples:
        d = detect_language(s)
        print(
            f"{d.language:10s} conf={d.confidence:.2f} "
            f"bangla_chars={d.bangla_chars:3d} latin_chars={d.latin_chars:3d} "
            f"bangla_ratio={d.bangla_ratio:.2f} banglish_ratio={d.banglish_ratio:.2f} "
            f"| {s}"
        )