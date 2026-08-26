import torch.nn as nn
from transformers import AutoModel


class DualHeadModel(nn.Module):

    def __init__(self, num_sentiment_classes=4, num_sarcasm_classes=2):
        super().__init__()

        self.bert = AutoModel.from_pretrained(
            "csebuetnlp/banglabert_small"
        )

        hidden_size = self.bert.config.hidden_size

        self.hidden = nn.Sequential(
            nn.Linear(hidden_size, 256),
            nn.ReLU(),
            nn.Dropout(0.3)
        )

        self.sentiment_classifier = nn.Linear(
            256,
            num_sentiment_classes
        )

        self.sarcasm_classifier = nn.Linear(
            256,
            num_sarcasm_classes
        )

    def forward(self, input_ids, attention_mask):

        outputs = self.bert(
            input_ids=input_ids,
            attention_mask=attention_mask
        )

        cls_output = outputs.last_hidden_state[:, 0, :]

        features = self.hidden(cls_output)

        sentiment_logits = self.sentiment_classifier(features)

        sarcasm_logits = self.sarcasm_classifier(features)

        return sentiment_logits, sarcasm_logits