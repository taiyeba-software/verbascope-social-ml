import json
import os

import pika
from dotenv import load_dotenv

from risk.risk_engine import calculate_signal
from routing.router import route, ENGLISH_TOXICITY_MODEL  # NEW: need this key to branch on

load_dotenv()

RABBITMQ_URL = os.getenv("RABBITMQ_URL")

print("RabbitMQ URL:", RABBITMQ_URL)

ML_ANALYZE_QUEUE = "ml_analyze"
ML_RESULTS_QUEUE = "ml_results"


def start_consumer(
    bangla_model,
    english_model,
    toxicity_model,
    english_toxicity_model,  # NEW
):

    print("Connecting ML Brain to RabbitMQ...")

    parameters = pika.URLParameters(RABBITMQ_URL)

    connection = pika.BlockingConnection(parameters)
    channel = connection.channel()

    channel.queue_declare(
        queue=ML_ANALYZE_QUEUE,
        durable=True,
    )

    channel.queue_declare(
        queue=ML_RESULTS_QUEUE,
        durable=True,
    )

    # --------------------------------------------------
    # Loaded models
    # --------------------------------------------------

    models = {
        "sentiment_sarcasm": {
            "banglabert_sentiment_sarcasm_v1": bangla_model,
            "twitter_roberta_irony_v1": english_model,
        },
        "toxicity": {
            "banglabert_toxicity_v1": toxicity_model,
            ENGLISH_TOXICITY_MODEL: english_toxicity_model,  # NEW: "toxic_bert_v1"
        },
    }

    print("RabbitMQ connected (ML Brain)")
    print(f"Listening on queue: {ML_ANALYZE_QUEUE}")

    def process_message(ch, method, properties, body):

        try:
            message = json.loads(body.decode("utf-8"))

            print()
            print("Received ML request:")
            print(message)

            post_id = message.get("postId")
            text = message.get("text", "")

            if not text:
                print("Empty text. Skipping message.")

                ch.basic_ack(
                    delivery_tag=method.delivery_tag
                )
                return

            # --------------------------------------------------
            # Language routing
            # --------------------------------------------------

            decision = route(text)

            sentiment_model = models["sentiment_sarcasm"][
                decision.sentiment_sarcasm_model
            ]

            toxicity_model_selected = models["toxicity"][
                decision.toxicity_model
            ]

            # --------------------------------------------------
            # Toxicity
            # --------------------------------------------------
            # NEW: EnglishToxicityModel.predict() returns a dict
            # (score/level/top_label/labels/explanation), while the
            # Bangla ToxicityModel.predict() returns a bare float.
            # Normalize to a numeric `toxicity` score either way so
            # calculate_signal() below doesn't need to know which model
            # ran, and keep the extra English detail (top_label) around
            # separately to enrich the explanation text.

            toxicity_top_label = None
            toxicity_top_label_score = None

            if decision.toxicity_model == ENGLISH_TOXICITY_MODEL:
                toxicity_result = toxicity_model_selected.predict(text)
                toxicity = toxicity_result["score"]
                toxicity_top_label = toxicity_result["top_label"]
                toxicity_top_label_score = toxicity_result["top_label_score"]
            else:
                toxicity = toxicity_model_selected.predict(text)

            # --------------------------------------------------
            # Sentiment + Sarcasm
            # --------------------------------------------------

            if decision.language == "Bangla":

                result = sentiment_model.predict(text)

                sentiment = result["sentiment"]
                sarcasm = (
                    result["sarcasm"] == "Sarcastic"
                )
                sarcasm_probability = result[
                    "sarcasm_probability"
                ]

            elif decision.language == "English":

                result = sentiment_model.predict(text)

                # Temporary placeholder until an English sentiment model exists
                sentiment = "Neutral"

                sarcasm = result["sarcasm"]
                sarcasm_probability = result[
                    "sarcasm_probability"
                ]

            else:
                # Banglish / Mixed / Unknown

                sentiment = "Unknown"
                sarcasm = False
                sarcasm_probability = 0.0

            # --------------------------------------------------
            # Risk Engine
            # --------------------------------------------------

            risk = calculate_signal(
                sentiment=sentiment,
                sarcasm=sarcasm,
                toxicity_score=toxicity,
                sarcasm_probability=sarcasm_probability,
            )

            explanation = risk.explanation

            # NEW: when toxic-bert actually drove the signal (Medium/High),
            # fold its specific top_label into the explanation text instead
            # of just the generic risk-engine sentence, e.g.
            # "High toxicity (score=5.00) overrides sentiment (Neutral) and
            # sarcasm. Top signal: threat (0.91)."
            # No schema changes needed downstream — this stays a single
            # string in the same `explanation` field post.controller.js
            # already reads.
            if toxicity_top_label and risk.toxicity_level in ("Medium", "High"):
                explanation = (
                    f"{explanation} Top signal: {toxicity_top_label} "
                    f"({toxicity_top_label_score:.2f})."
                )

            # --------------------------------------------------
            # Confidence
            # --------------------------------------------------
            # NEW: a single 0–1 "how sure is the model" number for the
            # frontend's AI Analysis dropdown (the "Confidence" row).
            # Prefer the toxic-bert top-label score — it's the most
            # specific number we have when toxicity actually drove the
            # decision (e.g. "threat" at 0.91 confidence). When that
            # doesn't exist (Bangla posts, or English posts where the
            # toxicity model wasn't confident enough to surface a top
            # label), fall back to the language-detection confidence
            # so the field is never left blank without reason.
            confidence = (
                toxicity_top_label_score
                if toxicity_top_label_score is not None
                else decision.language_confidence
            )

            # --------------------------------------------------
            # Publish result
            # --------------------------------------------------

            result_message = {
                "type": "ml.analysis.completed",
                "postId": post_id,
                "text": text,
                "language": decision.language,
                "language_confidence": decision.language_confidence,
                "low_confidence_routing": decision.low_confidence_routing,
                "routing_note": decision.routing_note,
                "sentiment": sentiment,
                "sarcasm": sarcasm,
                "sarcasm_probability": sarcasm_probability,
                "toxicity": toxicity,
                "risk_flag": risk.signal,
                "toxicity_level": risk.toxicity_level,
                "explanation": explanation,
                "confidence": confidence,
            }

            ch.basic_publish(
                exchange="",
                routing_key=ML_RESULTS_QUEUE,
                body=json.dumps(result_message),
                properties=pika.BasicProperties(
                    delivery_mode=2
                ),
            )

            print("ML analysis completed:")
            print(result_message)

            ch.basic_ack(
                delivery_tag=method.delivery_tag
            )

        except Exception as error:

            print(f"ML analysis failed: {error}")

            ch.basic_nack(
                delivery_tag=method.delivery_tag,
                requeue=False,
            )

    channel.basic_qos(prefetch_count=1)

    channel.basic_consume(
        queue=ML_ANALYZE_QUEUE,
        on_message_callback=process_message,
    )

    print("ML Brain waiting for messages...")

    channel.start_consuming()