from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import json
import os

import pika

from risk_engine import calculate_risk

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://localhost:5672")
ML_ANALYZE_QUEUE = "ml_analyze"
ML_RESULTS_QUEUE = "ml_results"


def start_consumer(ml_model, toxicity_model):
    connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
    channel = connection.channel()

    channel.queue_declare(queue=ML_ANALYZE_QUEUE, durable=True)
    channel.queue_declare(queue=ML_RESULTS_QUEUE, durable=True)

    print("RabbitMQ connected (ML Brain)")
    print(f"Listening on queue: {ML_ANALYZE_QUEUE}")

    def process_message(ch, method, properties, body):
        try:
            message = json.loads(body.decode("utf-8"))
            post_id = message.get("postId")
            text = message.get("text", "")

            if not text:
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            result = ml_model.predict(text)
            sentiment = result["sentiment"]
            sarcasm = result["sarcasm"] == "Sarcastic"
            sarcasm_probability = result["sarcasm_probability"]
            toxicity = toxicity_model.predict(text)

            result_message = {
                "type": "ml.analysis.completed",
                "postId": post_id,
                "text": text,
                "sentiment": sentiment,
                "sarcasm": sarcasm,
                "sarcasm_probability": sarcasm_probability,
                "toxicity": toxicity,
                "risk_flag": calculate_risk(
                    sentiment=sentiment,
                    sarcasm=sarcasm,
                    toxicity_score=toxicity,
                ),
            }

            ch.basic_publish(
                exchange="",
                routing_key=ML_RESULTS_QUEUE,
                body=json.dumps(result_message),
                properties=pika.BasicProperties(delivery_mode=2),
            )

            ch.basic_ack(delivery_tag=method.delivery_tag)
            print("ML analysis completed:", result_message)

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

    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        channel.stop_consuming()
        connection.close()