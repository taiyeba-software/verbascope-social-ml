import json
import os

import pika
from dotenv import load_dotenv

load_dotenv()

RABBITMQ_URL = os.getenv("RABBITMQ_URL")

print("RabbitMQ URL:", RABBITMQ_URL)

ML_ANALYZE_QUEUE = "ml_analyze"
ML_RESULTS_QUEUE = "ml_results"


def build_result_message(analyzer, post_id: str, text: str) -> dict:
    """
    Run text through the shared Analyzer and shape the output into the
    message format post.controller.js expects. Kept as a standalone
    function (rather than inline in process_message) so it can be unit
    tested without a live RabbitMQ connection.
    """

    result = analyzer.analyze(text)

    return {
        "type": "ml.analysis.completed",
        "postId": post_id,
        "text": result["text"],
        "language": result["language"],
        "language_confidence": result["language_confidence"],
        "low_confidence_routing": result["low_confidence_routing"],
        "routing_note": result["routing_note"],
        "sentiment": result["sentiment"],
        "sarcasm": result["sarcasm"],
        "sarcasm_probability": result["sarcasm_probability"],
        "toxicity": result["toxicity"],
        "risk_flag": result["risk_flag"],
        "toxicity_level": result["toxicity_level"],
        "explanation": result["explanation"],
        "confidence": result["confidence"],
    }


def start_consumer(analyzer):
    """
    Start consuming from ML_ANALYZE_QUEUE, running every message through
    the same Analyzer instance main.py's /analyze endpoint uses. This
    keeps the HTTP API and the queue consumer on one code path — no
    duplicated routing/model-selection logic to drift out of sync.
    """

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

            result_message = build_result_message(analyzer, post_id, text)

            print("Publishing result:")
            print(json.dumps(result_message, indent=2))

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