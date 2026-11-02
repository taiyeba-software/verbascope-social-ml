import hmac
import os
import traceback
from threading import Thread

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from models.sentiment_sarcasm import SentimentSarcasmModel
from models.english_sarcasm import EnglishSarcasmModel
from models.toxicity import ToxicityModel
from models.english_toxicity import EnglishToxicityModel

from pipelines.analyzer import Analyzer
from rabbit_consumer import get_status, start_consumer

# Load .env first so ML_API_KEY / RABBITMQ_URL are visible below.
load_dotenv()


# --------------------------------------------------
# FastAPI application
# --------------------------------------------------

app = FastAPI(
    title="VerbaScope ML Brain",
    version="1.0.0",
    description="Machine Learning service for VerbaScope",
)


# --------------------------------------------------
# Optional API key for /analyze
# --------------------------------------------------
# This service is reachable from the internet (for example through an ngrok
# tunnel), and /analyze runs CPU-heavy inference. When ML_API_KEY is set, every
# /analyze call must send it in an "X-API-Key" header. When it is not set the
# endpoint stays open, which is only appropriate on a trusted local machine.

ML_API_KEY = os.getenv("ML_API_KEY", "").strip()

if not ML_API_KEY:
    print(
        "WARNING: ML_API_KEY is not set. /analyze is open to anyone who can "
        "reach this service. Set ML_API_KEY before exposing it publicly."
    )


def require_api_key(x_api_key: str | None = Header(default=None)):
    if not ML_API_KEY:
        return
    if not x_api_key or not hmac.compare_digest(x_api_key, ML_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


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
# The consumer shares the same Analyzer instance as the HTTP /analyze
# endpoint, so both entry points run identical routing/model logic.
# start_consumer() reconnects by itself; this wrapper only catches a
# fatal start-up error (for example RABBITMQ_URL not set) and prints it.

def start_rabbitmq_consumer():
    try:
        start_consumer(analyzer)
    except Exception:
        traceback.print_exc()


rabbit_thread = Thread(
    target=start_rabbitmq_consumer,
    name="rabbit-consumer",
    daemon=True,
)

rabbit_thread.start()


# --------------------------------------------------
# Request / response schemas
# --------------------------------------------------

class AnalyzeRequest(BaseModel):
    # Upper bound so one huge request cannot tie up the CPU.
    text: str = Field(..., max_length=10000)


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
    toxicity_top_label: str | None = None        # only set for the English pipeline
    toxicity_top_label_score: float | None = None  # only set for the English pipeline
    toxicity_explanation: str | None = None      # model-level explanation, distinct from risk.explanation

    risk_flag: str
    toxicity_level: str
    explanation: str
    confidence: float


# --------------------------------------------------
# Health check
# --------------------------------------------------
# "status" still means "the HTTP API is up". The queue consumer's real state is
# reported separately, so a dead or disconnected consumer is visible instead of
# hiding behind a constant "ok". No URLs or secrets are included.

@app.get("/health")
def health():
    consumer = get_status()
    consumer["thread_alive"] = rabbit_thread.is_alive()

    return {
        "status": "ok",
        "service": "verbascope-ml-brain",
        "model_loaded": True,
        "queue_consumer": consumer,
    }


# --------------------------------------------------
# Text analysis
# --------------------------------------------------

@app.post(
    "/analyze",
    response_model=AnalyzeResponse,
    dependencies=[Depends(require_api_key)],
)
def analyze(request: AnalyzeRequest):
    return analyzer.analyze(request.text)