from transformers import AutoConfig

config = AutoConfig.from_pretrained("YamenRM/sarcasm_model")

print("id2label:", config.id2label)
print("label2id:", config.label2id)
