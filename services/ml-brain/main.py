from fastapi import FastAPI
from pydantic import BaseModel
from threading import Thread
import traceback

from models.sentiment_sarcasm import SentimentSarcasmModel
from models.english_sarcasm import EnglishSarcasmModel
from models.toxicity import ToxicityModel

from routing.router import route
from risk.risk_engine import calculate_signal
from rabbit_consumer import start_consumer


# --------------------------------------------------
# FastAPI application
# --------------------------------------------------

app = FastAPI(
    title="VerbaScope ML Brain",
    version="1.0.0",
    description="Machine Learning service for VerbaScope",
)


# --------------------------------------------------
# Load models once at startup
# --------------------------------------------------

print("Starting VerbaScope ML Brain...")

print("Loading Bangla sentiment/sarcasm model...")
bangla_model = SentimentSarcasmModel()

print("Loading English sarcasm model...")
english_model = EnglishSarcasmModel()

print("Loading toxicity model...")
toxicity_model = ToxicityModel()

print("ML Brain ready.")


# --------------------------------------------------
# RabbitMQ
# --------------------------------------------------

def start_rabbitmq_consumer():
    try:
        start_consumer(
            bangla_model,
            english_model,
            toxicity_model,
        )
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

    language: str
    language_confidence: float

    sentiment: str
    sarcasm: bool
    sarcasm_probability: float

    toxicity: float

    risk_flag: str
    toxicity_level: str
    explanation: str


# --------------------------------------------------
# Health check
# --------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "verbascope-ml-brain",
        "model_loaded": True,
    }


# --------------------------------------------------
# Text analysis
# --------------------------------------------------

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):

    route_decision = route(request.text)

    # --------------------------------------
    # Language-aware model routing
    # --------------------------------------

    if route_decision.language == "Bangla":

        result = bangla_model.predict(request.text)

        sentiment = result["sentiment"]
        sarcasm = result["sarcasm"] == "Sarcastic"
        sarcasm_probability = result["sarcasm_probability"]

    elif route_decision.language == "English":

        result = english_model.predict(request.text)

        # No English sentiment model yet
        sentiment = "Neutral"

        sarcasm = result["sarcasm"]
        sarcasm_probability = result["sarcasm_probability"]

    else:
        # Banglish / Mixed / Unknown
        # No reliable sentiment/sarcasm models yet

        sentiment = "Unknown"
        sarcasm = False
        sarcasm_probability = 0.0

    # Toxicity model (currently shared)
    toxicity = toxicity_model.predict(request.text)

    # Calculate risk
    risk = calculate_signal(
        sentiment=sentiment,
        sarcasm=sarcasm,
        toxicity_score=toxicity,
        sarcasm_probability=sarcasm_probability,
    )

    return {
        "text": request.text,

        "language": route_decision.language,
        "language_confidence": route_decision.language_confidence,

        "sentiment": sentiment,
        "sarcasm": sarcasm,
        "sarcasm_probability": sarcasm_probability,

        "toxicity": toxicity,

        "risk_flag": risk.signal,
        "toxicity_level": risk.toxicity_level,
        "explanation": risk.explanation,
    }