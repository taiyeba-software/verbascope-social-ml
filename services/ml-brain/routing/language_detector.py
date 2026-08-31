"""
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

Each call returns a (language, confidence) tuple. Confidence is not
used for routing decisions yet, but recording it lets your evaluation
table report per-post language confidence (e.g. Bangla / 0.97,
Mixed / 0.61), which is useful evidence for the MuRIL / Banglish
discussion in MODEL_SELECTION.md.
"""

import re

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


def _banglish_word_ratio(text: str) -> float:
    """Fraction of alphabetic tokens that look like romanized Bangla."""
    tokens = re.findall(r"[A-Za-z']+", text.lower())
    if not tokens:
        return 0.0
    hits = sum(1 for tok in tokens if tok in BANGLISH_WORDS)
    return hits / len(tokens)


def detect_language(text: str) -> tuple[str, float]:
    """
    Classify text and return (language, confidence).

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
        return "Unknown", 0.0

    bangla_chars = len(BANGLA_RANGE.findall(text))
    latin_chars = len(LATIN_RANGE.findall(text))
    total_script_chars = bangla_chars + latin_chars

    if total_script_chars == 0:
        # No Bangla or Latin letters at all (emoji-only, numbers, punctuation)
        return "Unknown", 0.0

    bangla_ratio = bangla_chars / total_script_chars

    # Thresholds are deliberately loose — this is a routing heuristic,
    # not a classifier that needs to be evaluated for its own accuracy.
    if bangla_ratio >= 0.85:
        return "Bangla", round(bangla_ratio, 2)

    if bangla_ratio <= 0.15:
        # Almost entirely Latin script — decide English vs. Banglish
        banglish_ratio = _banglish_word_ratio(text)
        if banglish_ratio >= 0.20:
            return "Banglish", round(min(1.0, banglish_ratio * 2), 2)
        return "English", round(1 - bangla_ratio, 2)

    # Meaningful presence of both scripts — confidence rises the
    # closer the split is to an even 50/50 mix.
    mixed_confidence = 1 - abs(bangla_ratio - 0.5) * 2
    return "Mixed", round(mixed_confidence, 2)


if __name__ == "__main__":
    # Quick manual smoke test — not a substitute for real unit tests.
    samples = [
        "বাংলাদেশ আজ দারুণ খেলেছে!",
        "This is a great day for VerbaScope.",
        "ami ajke onek happy, tumi kmn acho?",
        "আজকে আমি খুব happy কারণ exam ভালো হয়েছে।",
        "🎉🔥",
    ]
    for s in samples:
        lang, conf = detect_language(s)
        print(f"{lang:10s}  {conf:.2f}  |  {s}")