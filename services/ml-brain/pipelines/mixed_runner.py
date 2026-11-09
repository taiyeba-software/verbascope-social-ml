"""
pipelines/mixed_runner.py

Chunk 3 of the code-mixed pipeline: run the right models on each
sentence of a post. It does NOT merge results into one verdict yet
(that is Chunk 4) and it is not called by Analyzer yet, so nothing in
the live system changes.

Rule: every model only sees text it can read.
  * Bangla models  -> the whole sentence (seg.text)
  * English models -> only the English words (seg.latin_view)

Sarcasm (decision B): when a sentence has BOTH Bangla letters and
English words, both sarcasm models run (Bangla on the whole sentence,
English on the English words) and the sentence is sarcastic only if
BOTH say so. When a sentence has only one language, only that
language's model decides, because the other model cannot read it.
"""

from routing.segmenter import segment, Segment


def _combine_sarcasm(bangla, english):
    """Returns (sarcasm: bool, probability: float, basis: str)."""
    b = bangla["sarcasm"] if bangla else None
    e = english["sarcasm"] if english else None

    if b is not None and e is not None:
        prob = min(bangla["sarcasm_probability"], english["sarcasm_probability"])
        return bool(b and e), prob, "both_models"
    if b is not None:
        return bool(b), bangla["sarcasm_probability"], "bangla_only"
    if e is not None:
        return bool(e), english["sarcasm_probability"], "english_only"
    return False, 0.0, "none"


def run_segment(analyzer, seg: Segment) -> dict:
    bangla = None
    english = None

    # ---- Bangla side: whole sentence --------------------------------
    if seg.has_bangla:
        r = analyzer.bangla_model.predict(seg.text)
        bangla = {
            "sentiment": r["sentiment"],
            "sarcasm": r["sarcasm"] == "Sarcastic",
            "sarcasm_probability": r["sarcasm_probability"],
            "toxicity": analyzer.bangla_toxicity_model.predict(seg.text),
        }

    # ---- English side: English words only ---------------------------
    if seg.latin_words >= 1:
        tox = analyzer.english_toxicity_model.predict(seg.latin_view)

        sentiment = None
        sentiment_confidence = None
        if analyzer.english_sentiment_model is not None:
            s = analyzer.english_sentiment_model.predict(seg.latin_view)
            sentiment = s["sentiment"]
            sentiment_confidence = s["confidence"]

        sarcasm_en = None
        sarcasm_en_prob = None
        if analyzer.english_model is not None:
            sr = analyzer.english_model.predict(seg.latin_view)
            sarcasm_en = sr["sarcasm"]
            sarcasm_en_prob = sr["sarcasm_probability"]

        english = {
            "sarcasm": sarcasm_en,
            "sarcasm_probability": sarcasm_en_prob,
            "sentiment": sentiment,
            "sentiment_confidence": sentiment_confidence,
            "toxicity": tox["score"],
            "toxicity_top_label": tox["top_label"],
            "toxicity_top_label_score": tox["top_label_score"],
            "toxicity_explanation": tox["explanation"],
        }

    sarcasm, sarcasm_prob, basis = _combine_sarcasm(bangla, english)

    return {
        "text": seg.text,
        "latin_view": seg.latin_view,
        "sarcasm": sarcasm,
        "sarcasm_probability": sarcasm_prob,
        "sarcasm_basis": basis,
        "bangla": bangla,     # None if the sentence has no Bangla letters
        "english": english,   # None if the sentence has no English words
    }


def run_segments(analyzer, text: str) -> list[dict]:
    return [run_segment(analyzer, seg) for seg in segment(text)]