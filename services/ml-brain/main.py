from fastapi import FastAPI
from pydantic import BaseModel
from models.toxicity import ToxicityModel
from risk_engine import calculate_risk

from models.sentiment_sarcasm import SentimentSarcasmModel
from threading import Thread
import traceback

from rabbit_consumer import start_consumer


# --------------------------------------------------
# FastAPI application
# --------------------------------------------------

app = FastAPI(
    title="VerbaScope ML Brain",
    version="1.0.0",
    description="Machine Learning service for VerbaScope"
)


# --------------------------------------------------
# Load ML model once when the service starts
# --------------------------------------------------

print("Starting VerbaScope ML Brain...")
print("Loading ML model...")

ml_model = SentimentSarcasmModel()
toxicity_model = ToxicityModel()

print("ML Brain ready.")


def start_rabbitmq_consumer():
    try:
        start_consumer(ml_model, toxicity_model)
    except Exception:
        traceback.print_exc()


        


rabbit_thread = Thread(
    target=start_rabbitmq_consumer,
    daemon=True,
)

rabbit_thread.start()


# --------------------------------------------------
# Request schema
# --------------------------------------------------

class AnalyzeRequest(BaseModel):
    text: str


# --------------------------------------------------
# Response schema
# --------------------------------------------------

class AnalyzeResponse(BaseModel):
    text: str
    sentiment: str
    sarcasm: bool
    sarcasm_probability: float
    toxicity: float | None
    risk_flag: str | None


# --------------------------------------------------
# Health check
# --------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "verbascope-ml-brain",
        "model_loaded": True
    }


# --------------------------------------------------
# Text analysis
# --------------------------------------------------

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):

    # Sentiment + sarcasm
    result = ml_model.predict(request.text)

    sentiment = result["sentiment"]

    sarcasm = result["sarcasm"] == "Sarcastic"

    sarcasm_probability = result["sarcasm_probability"]

    # Toxicity
    toxicity = toxicity_model.predict(request.text)

    # Explainable risk engine
    risk_flag = calculate_risk(
        sentiment=sentiment,
        sarcasm=sarcasm,
        toxicity_score=toxicity
    )

    return {
        "text": request.text,
        "sentiment": sentiment,
        "sarcasm": sarcasm,
        "sarcasm_probability": sarcasm_probability,
        "toxicity": toxicity,
        "risk_flag": risk_flag
    }