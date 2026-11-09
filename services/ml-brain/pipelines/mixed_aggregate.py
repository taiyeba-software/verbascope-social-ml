"""
pipelines/mixed_aggregate.py

Chunk 4: merge the per-sentence results from mixed_runner into ONE
analysis dict with exactly the same keys the Bangla/English pipelines
return, so the rest of Analyzer (risk engine, explanation, response)
does not need to know the post was code-mixed.

Rules (conservative: one problem sentence is enough to flag a post)
  toxicity  : highest score over all sentences and both models.
              Bangla scores are floats 1-5, English scores are 1/3/4/5;
              both use the same scale, so max() is meaningful.
  sentiment : any Negative -> Negative; else any Mixed -> Mixed;
              else any Positive -> Positive; else Neutral.
  sarcasm   : true if any sentence is sarcastic.
"""

_NEGATIVE = "Negative"


def _pick_sentiment(candidates):
    """candidates: list of (sentiment, confidence_or_None, source)."""
    for wanted in (_NEGATIVE, "Mixed", "Positive"):
        hits = [c for c in candidates if c[0] == wanted]
        if hits:
            # prefer the hit that has a confidence value, then the highest
            hits.sort(key=lambda c: (c[1] is not None, c[1] or 0.0), reverse=True)
            return hits[0]
    return ("Neutral", None, None)


def aggregate_segments(segments: list[dict]) -> dict:
    sentiments = []
    best_tox = 1.0
    tox_source = None            # "bangla" / "english" / None
    tox_en = None                # english dict that produced the max score

    sarcasm = False
    max_prob_sarcastic = 0.0      # highest probability among sarcastic sentences
    max_prob_any = 0.0            # highest probability among all sentences

    for seg in segments:
        b, e = seg["bangla"], seg["english"]

        if b is not None:
            sentiments.append((b["sentiment"], None, "bangla"))
            if b["toxicity"] > best_tox:
                best_tox, tox_source, tox_en = b["toxicity"], "bangla", None

        if e is not None:
            if e["sentiment"] is not None:
                sentiments.append(
                    (e["sentiment"], e["sentiment_confidence"], "english")
                )
            if e["toxicity"] > best_tox:
                best_tox, tox_source, tox_en = e["toxicity"], "english", e

        max_prob_any = max(max_prob_any, seg["sarcasm_probability"])
        if seg["sarcasm"]:
            sarcasm = True
            max_prob_sarcastic = max(max_prob_sarcastic, seg["sarcasm_probability"])

    # If the post is sarcastic, report the probability of a sentence that
    # was actually judged sarcastic (not a higher value from a sentence
    # that was judged NOT sarcastic).
    sarcasm_prob = max_prob_sarcastic if sarcasm else max_prob_any

    sentiment, sentiment_conf, sentiment_source = _pick_sentiment(sentiments)

    return {
        "sentiment": sentiment,
        "sentiment_confidence": sentiment_conf,
        "sarcasm": sarcasm,
        "sarcasm_probability": sarcasm_prob,
        "toxicity": best_tox,
        "toxicity_top_label": tox_en["toxicity_top_label"] if tox_en else None,
        "toxicity_top_label_score": (
            tox_en["toxicity_top_label_score"] if tox_en else None
        ),
        "toxicity_explanation": tox_en["toxicity_explanation"] if tox_en else None,
        # extra, for debugging only (analyzer does not put these in the response)
        "toxicity_source": tox_source,
        "sentiment_source": sentiment_source,
    }