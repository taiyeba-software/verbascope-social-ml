import json
import os

import pika
from dotenv import load_dotenv

from risk.risk_engine import calculate_signal
from routing.router import route

load_dotenv()

RABBITMQ_URL = os.getenv("RABBITMQ_URL")

print("RabbitMQ URL:", RABBITMQ_URL)

ML_ANALYZE_QUEUE = "ml_analyze"
ML_RESULTS_QUEUE = "ml_results"


def start_consumer(
    bangla_model,
    english_model,
    toxicity_model,
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
                "explanation": risk.explanation,
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