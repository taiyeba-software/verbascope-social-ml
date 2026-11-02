import json
import logging
import os
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import pika
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
# A dedicated logger so we never touch uvicorn's logging setup. We log
# identifiers and sizes only: never the broker URL and never post text.
logger = logging.getLogger("ml-brain.rabbit")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S")
    )
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False

ML_ANALYZE_QUEUE = "ml_analyze"
ML_RESULTS_QUEUE = "ml_results"

# Heartbeat: a long inference can block pika's BlockingConnection from
# answering heartbeats. A generous value stops the broker from closing the
# connection while a CPU inference is running.
HEARTBEAT_SECONDS = 600
BLOCKED_CONNECTION_TIMEOUT_SECONDS = 300

# Reconnect back-off: 2s, 4s, 8s ... capped at 60s. The delay resets once a
# connection has stayed up for STABLE_AFTER_SECONDS.
RECONNECT_MIN_SECONDS = 2
RECONNECT_MAX_SECONDS = 60
STABLE_AFTER_SECONDS = 60


# Live consumer state, read by GET /health in main.py. It holds no secrets:
# only a flag, a counter, an exception *class name*, and a timestamp.
_status = {
    "connected": False,
    "reconnect_count": 0,
    "last_error_type": None,
    "last_message_at": None,
}


def get_status() -> dict:
    """Snapshot of the consumer state, safe to expose on a health endpoint."""
    return dict(_status)


def _get_url() -> str:
    """
    Read the broker URL at start time (not at import time), so it works when
    the environment variable is set after this module is imported, for
    example from Colab Secrets.
    """
    url = (os.getenv("RABBITMQ_URL") or "").strip()
    if not url:
        raise RuntimeError(
            "RABBITMQ_URL is not set. Set it in services/ml-brain/.env "
            "(local) or in Colab Secrets / the host's environment (cloud)."
        )
    return url


def _broker_host(url: str) -> str:
    """Host name only: no user, no password, no vhost."""
    return urlparse(url).hostname or "unknown-host"


def _redact(text, url: str) -> str:
    """Make sure the broker URL can never appear in a log line."""
    message = str(text)
    return message.replace(url, "<redacted-url>") if url else message


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


def _make_handler(analyzer, url: str):
    """Build the message callback. One analyzer instance is shared with main.py."""

    def process_message(ch, method, properties, body):
        tag = method.delivery_tag

        # 1) Malformed message: it can never succeed, so acknowledge and drop.
        try:
            message = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            logger.warning("Dropping message that is not valid JSON")
            ch.basic_ack(delivery_tag=tag)
            return

        post_id = message.get("postId")
        text = message.get("text") or ""

        # 2) Nothing to analyse: acknowledge and skip.
        if not post_id or not text.strip():
            logger.warning(
                "Skipping message with missing postId or empty text (post_id=%s)",
                post_id,
            )
            ch.basic_ack(delivery_tag=tag)
            return

        logger.info("Received ML request post_id=%s chars=%d", post_id, len(text))

        try:
            result_message = build_result_message(analyzer, post_id, text)

            # Publisher confirms are enabled, so this raises if the broker
            # does not accept the result. In that case we do not ack below.
            ch.basic_publish(
                exchange="",
                routing_key=ML_RESULTS_QUEUE,
                body=json.dumps(result_message),
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    content_type="application/json",
                ),
            )

            logger.info(
                "ML analysis published post_id=%s language=%s risk_flag=%s",
                post_id,
                result_message.get("language"),
                result_message.get("risk_flag"),
            )
            _status["last_message_at"] = datetime.now(timezone.utc).isoformat()

            ch.basic_ack(delivery_tag=tag)

        except Exception as error:
            # Retry once (the broker marks the second delivery as
            # "redelivered"); after that, drop it so one bad message cannot
            # loop forever. A dropped post keeps ml = null and can be fixed
            # later with the reanalyzeStalePosts backfill.
            retry = not method.redelivered
            logger.error(
                "ML analysis failed post_id=%s (%s: %s); %s",
                post_id,
                type(error).__name__,
                _redact(error, url)[:200],
                "requeueing once" if retry else "dropping message",
            )
            ch.basic_nack(delivery_tag=tag, requeue=retry)

    return process_message


def _open_connection(url: str) -> pika.BlockingConnection:
    parameters = pika.URLParameters(url)
    parameters.heartbeat = HEARTBEAT_SECONDS
    parameters.blocked_connection_timeout = BLOCKED_CONNECTION_TIMEOUT_SECONDS
    parameters.connection_attempts = 1  # retries are handled by start_consumer
    parameters.socket_timeout = 10
    # Shows up by this name in the broker's Connections tab.
    parameters.client_properties = {"connection_name": "verbascope-ml-brain"}
    return pika.BlockingConnection(parameters)


def _consume(analyzer, url: str):
    """Open one connection and consume until it breaks (raises) or stops."""
    connection = _open_connection(url)
    try:
        channel = connection.channel()

        channel.queue_declare(queue=ML_ANALYZE_QUEUE, durable=True)
        channel.queue_declare(queue=ML_RESULTS_QUEUE, durable=True)

        channel.confirm_delivery()
        channel.basic_qos(prefetch_count=1)

        channel.basic_consume(
            queue=ML_ANALYZE_QUEUE,
            on_message_callback=_make_handler(analyzer, url),
        )

        logger.info("RabbitMQ connected (ML Brain)")
        logger.info("Listening on queue: %s", ML_ANALYZE_QUEUE)

        _status["connected"] = True
        channel.start_consuming()
    finally:
        _status["connected"] = False
        try:
            if connection.is_open:
                connection.close()
        except Exception:
            pass


def start_consumer(analyzer):
    """
    Start consuming from ML_ANALYZE_QUEUE, running every message through
    the same Analyzer instance main.py's /analyze endpoint uses. This
    keeps the HTTP API and the queue consumer on one code path, with no
    duplicated routing/model-selection logic to drift out of sync.

    This function blocks forever. If the broker connection drops (idle
    timeout, broker restart, network change, rotated password), it logs the
    reason and reconnects with exponential back-off instead of dying.
    """

    url = _get_url()
    host = _broker_host(url)
    delay = RECONNECT_MIN_SECONDS

    while True:
        started = time.monotonic()
        try:
            logger.info("Connecting ML Brain to RabbitMQ at %s ...", host)
            _consume(analyzer, url)
            logger.warning("Consumer stopped without an error; reconnecting")
        except KeyboardInterrupt:
            logger.info("Consumer stopped by user")
            return
        except Exception as error:
            _status["last_error_type"] = type(error).__name__
            logger.error(
                "RabbitMQ connection lost (%s: %s)",
                type(error).__name__,
                _redact(error, url)[:200],
            )

        _status["reconnect_count"] += 1
        if time.monotonic() - started > STABLE_AFTER_SECONDS:
            delay = RECONNECT_MIN_SECONDS

        logger.info("Reconnecting in %ss", delay)
        time.sleep(delay)
        delay = min(delay * 2, RECONNECT_MAX_SECONDS)