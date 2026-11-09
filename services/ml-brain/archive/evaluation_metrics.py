import pandas as pd

from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay
)

import matplotlib.pyplot as plt

# -----------------------------
# Load Results
# -----------------------------

df = pd.read_csv("evaluation/results.csv")

# CHANGE these names if necessary
y_true = df["Expected AI Signal"]
y_pred = df["Predicted AI Signal"]

labels = ["Green", "Yellow", "Red"]

# -----------------------------
# Precision / Recall / F1
# -----------------------------

print("=" * 60)
print("Classification Report")
print("=" * 60)

print(
    classification_report(
        y_true,
        y_pred,
        labels=labels,
        digits=3
    )
)

# -----------------------------
# Confusion Matrix
# -----------------------------

cm = confusion_matrix(
    y_true,
    y_pred,
    labels=labels
)

disp = ConfusionMatrixDisplay(
    confusion_matrix=cm,
    display_labels=labels
)

disp.plot(cmap="Blues")

plt.title("AI Signal Confusion Matrix")

plt.tight_layout()

plt.savefig("evaluation/confusion_matrix.png")

plt.show()