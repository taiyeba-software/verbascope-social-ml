# VerbaScope: label definitions (final, 7 Nov 2026)

The ML module detects **linguistic signals**. It does not judge users or topics.
Green / Yellow / Red describe the **text of one post**.

| Label | Definition |
|---|---|
| **Green** | Neutral or positive; no sarcasm; no harmful or abusive signal. |
| **Yellow** | Negative, emotionally charged, sarcastic or sensitive language, but with no direct insult, threat or call for harm. |
| **Red** | Abusive, dehumanizing or threatening language, a call for violence, or safety-related content (self-harm / suicide). |

Yellow means "think twice before reacting". It does not mean "bad post".

## Rules for edge cases

1. **Negative sentiment is Yellow.** A plain complaint ("the service was slow") is Yellow, not Green.
2. **Sarcasm is Yellow**, unless it also contains a direct insult, a threat or a call for harm. Then it is Red.
3. **Quoted or reported content:** label what the poster says. Describe claims as "the post reports ...", never as confirmed facts.
4. **Self-harm / suicide (safety rule):**
   > Any post that depicts, discloses or discusses suicide or self-harm (a personal wish or plan, a survivor account, a news report or a literary depiction) is Red as safety-related content, whatever its tone. Red here means "handle with care", not "abusive".

## Known limits (state them in the report)

- No component of the current system detects self-harm. Posts labelled Red only by rule 4 (Bangla rows 20 and 22) are expected failures.
- Threats without abusive words are often scored Medium toxicity, so they can be predicted Yellow instead of Red.
- Mixed-script sarcasm can be routed to the English pipeline, which does not read the Bangla part.
- English sentiment is not wired into the Analyzer yet, so English negative-but-polite posts are predicted Neutral (Green).
