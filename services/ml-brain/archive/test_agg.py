from pipelines.mixed_aggregate import aggregate_segments as ag

def seg(s, p):
    return {"bangla": None, "english": None, "sarcasm": s, "sarcasm_probability": p}

r = ag([seg(False, 0.92), seg(True, 0.67)])
print(r["sarcasm"], r["sarcasm_probability"], "(expect True 0.67)")

r = ag([seg(False, 0.92), seg(False, 0.3)])
print(r["sarcasm"], r["sarcasm_probability"], "(expect False 0.92)")