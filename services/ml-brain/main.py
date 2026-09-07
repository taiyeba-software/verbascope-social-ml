from fastapi import FastAPI
from pydantic import BaseModel
from threading import Thread
import traceback

from models.sentiment_sarcasm import SentimentSarcasmModel
from models.english_sarcasm import EnglishSarcasmModel
from models.toxicity import ToxicityModel
from models.english_toxicity import EnglishToxicityModel

from pipelines.analyzer import Analyzer
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

print("Loading English toxicity model...")
english_toxicity_model = EnglishToxicityModel()

# The Analyzer is the only thing that knows how routing decisions map
# to model calls. main.py just hands it text and returns whatever it
# gives back — see pipelines/analyzer.py.
analyzer = Analyzer(
    bangla_model=bangla_model,
    english_model=english_model,
    bangla_toxicity_model=toxicity_model,
    english_toxicity_model=english_toxicity_model,
)

print("ML Brain ready.")


# --------------------------------------------------
# RabbitMQ
# --------------------------------------------------
# NOTE: the consumer still takes the raw models directly rather than
# the Analyzer, for now — see pipelines/analyzer.py docstring. Once the
# consumer is updated to share the same Analyzer, this can be
# simplified to `start_consumer(analyzer)`.

def start_rabbitmq_consumer():
    try:
        start_consumer(
            bangla_model,
            english_model,
            toxicity_model,
            english_toxicity_model,
        )
    except Exception:
        traceback.print_exc()


rabbit_thread = Thread(
    target=start_rabbitmq_consumer,
    daemon=True,
)

rabbit_thread.start()


# --------------------------------------------------
# Request / response schemas
# --------------------------------------------------

class AnalyzeRequest(BaseModel):
    text: str


class AnalyzeResponse(BaseModel):
    text: str

    language: str
    language_confidence: float
    routing: str
    low_confidence_routing: bool
    routing_note: str

    sentiment: str
    sarcasm: bool
    sarcasm_probability: float

    toxicity: float
    toxicity_top_label: str | None = None    # only set for the English pipeline
    toxicity_explanation: str | None = None  # model-level explanation, distinct from risk.explanation

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
    return analyzer.analyze(request.text)