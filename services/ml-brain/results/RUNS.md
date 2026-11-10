# Evaluation runs: which code produced which result

Files in this folder are named `<dataset>_<date>_<time>_<kind>.<ext>`.
This table says which code setting each run used.

"Mixed pipeline ON" = code-mixed posts are split into sentences, Bangla models read
the whole sentence, English models read only the English words, results merged.
"Mixed pipeline OFF" = code-mixed posts go through the old route (dominant-script
pipeline, whole post). The word-list safety floor is active for code-mixed posts in
the 10 Nov runs only.

## Original dataset (`evaluation_dataset.csv`, 142 evaluated)

| Run | Code | Accuracy | Macro-F1 |
|---|---|---|---|
| 20261107_182631 | Before the mixed pipeline existed | 0.641 | 0.497 |
| 20261108_200513 | Mixed pipeline ON | 0.620 | 0.464 |
| 20261109_152501 | Mixed pipeline ON | 0.620 | 0.462 |
| 20261109_210237 | Mixed pipeline ON | 0.620 | 0.462 |

## Clean dataset (`evaluation_dataset_clean.csv`, 5 annotator notes removed, 142 evaluated)

| Run | Code | Accuracy | Macro-F1 |
|---|---|---|---|
| 20261109_182831 | Mixed pipeline ON | 0.606 | 0.453 |
| 20261109_183449 | Old analyzer (before mixed pipeline) | 0.634 | 0.488 |
| 20261110_121213 | Mixed pipeline OFF (`USE_MIXED_PIPELINE=0`) | 0.634 | 0.488 |

## Synthetic code-mixed dev set (`evaluation_code_mixed_test_dataset_extended_fixed.csv`, 50 posts)

| Run | Code | Accuracy | Macro-F1 | Red caught |
|---|---|---|---|---|
| 20261110_115731 | Mixed pipeline ON | 0.580 | 0.563 | 6 of 12 |
| 20261110_120819 | Mixed pipeline OFF | 0.600 | 0.515 | 2 of 12 |

Caution: the 50 posts are synthetic. Use them to compare settings, not to report
real-world accuracy.

## Not in this table

`english_evaluation_dataset_*` runs (English-only set, 7-8 Nov) are not mapped here.
