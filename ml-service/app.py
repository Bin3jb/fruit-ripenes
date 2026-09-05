"""
Flask inference service for the AI Fruit Ripeness Recognizer.

Endpoints
---------
GET  /health          liveness + which weights are loaded
GET  /classes         the class taxonomy, for the UI legend
POST /predict         multipart image  -> detections + annotated image
POST /predict-base64  JSON base64 image -> same payload
GET  /annotated/<f>   serve an annotated result

The Node backend is the only intended client; it owns auth, storage and the
LLM conversation. This service stays stateless so it can be scaled or moved
to a GPU host without touching the rest of the system.
"""

import base64
import os

import cv2
import numpy as np
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

import config
from utils.detector import RipenessDetector
from utils import knowledge

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH

detector = None


def get_detector() -> RipenessDetector:
    global detector
    if detector is None:
        detector = RipenessDetector()
    return detector


def set_detector(d) -> None:
    """Inject a detector (used by tests, and by any host that pre-loads one)."""
    global detector
    detector = d


def _decode(buf: bytes):
    arr = np.frombuffer(buf, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("could not decode image")
    # Keep very large phone photos manageable without losing detail.
    h, w = img.shape[:2]
    if max(h, w) > 1600:
        s = 1600 / max(h, w)
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    return img


def _allowed(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in config.ALLOWED_EXTENSIONS


def _enrich(result: dict, lang: str) -> dict:
    """Attach display labels and knowledge-base advice to every detection."""
    for d in result["detections"]:
        d["fruit_label"] = config.FRUIT_LABELS.get(d["fruit"], {}).get(lang, d["fruit"])
        d["stage_label"] = config.STAGE_LABELS[d["stage"]][lang]
        d.update(knowledge.describe(d["fruit"], d["stage"], lang))
    result["grounding"] = knowledge.grounding_block(result["detections"])
    return result


# --------------------------------------------------------------------------- #


@app.get("/health")
def health():
    d = get_detector()
    return jsonify(
        status="ok",
        model=os.path.basename(d.weights),
        mode=d.mode,
        mode_note=("fruit and stage both from the trained detector"
                   if d.mode == "ripeness"
                   else "COCO fallback: fruit from the detector, stage from colour cues"),
        classes=config.NUM_CLASSES,
        color_refinement=config.ENABLE_COLOR_REFINEMENT,
    )


@app.get("/classes")
def classes():
    return jsonify(
        fruits=[{"key": f, **config.FRUIT_LABELS[f]} for f in config.FRUITS],
        stages=[{"key": s, **config.STAGE_LABELS[s]} for s in config.STAGES],
        composite=config.CLASSES,
    )


@app.get("/advice")
def advice():
    """
    Language-aware guidance for one fruit/stage pair, straight from the
    knowledge base. The Node backend calls this when answering a question about
    a stored scan, so an Arabic conversation gets Arabic advice even though the
    scan itself was made in English.
    """
    fruit = request.args.get("fruit", "")
    stage = request.args.get("stage", "")
    lang = request.args.get("lang", "en")
    lang = lang if lang in ("en", "ar") else "en"
    if fruit not in config.FRUITS or stage not in config.STAGES:
        return jsonify(error="unknown fruit or stage"), 404
    return jsonify(fruit=fruit, stage=stage, lang=lang,
                   fruit_label=config.FRUIT_LABELS[fruit][lang],
                   stage_label=config.STAGE_LABELS[stage][lang],
                   **knowledge.describe(fruit, stage, lang))


@app.post("/predict")
def predict():
    if "image" not in request.files:
        return jsonify(error="no image field in the request"), 400
    f = request.files["image"]
    if f.filename == "" or not _allowed(secure_filename(f.filename)):
        return jsonify(error="unsupported file type"), 400

    lang = request.form.get("lang", "en")
    lang = lang if lang in ("en", "ar") else "en"

    try:
        img = _decode(f.read())
    except ValueError as e:
        return jsonify(error=str(e)), 400

    d = get_detector()
    result = d.predict(img, lang=lang)
    if result["detections"]:
        path = d.annotate(img, result["detections"])
        result["annotated_url"] = f"/annotated/{os.path.basename(path)}"
    return jsonify(_enrich(result, lang))


@app.post("/predict-base64")
def predict_base64():
    body = request.get_json(silent=True) or {}
    data = body.get("image")
    if not data:
        return jsonify(error="missing 'image'"), 400
    if "," in data:                      # strip data:image/...;base64, prefix
        data = data.split(",", 1)[1]

    lang = body.get("lang", "en")
    lang = lang if lang in ("en", "ar") else "en"

    try:
        img = _decode(base64.b64decode(data))
    except Exception as e:
        return jsonify(error=f"invalid base64 image: {e}"), 400

    d = get_detector()
    result = d.predict(img, lang=lang)
    if result["detections"]:
        path = d.annotate(img, result["detections"])
        result["annotated_url"] = f"/annotated/{os.path.basename(path)}"
    return jsonify(_enrich(result, lang))


@app.get("/annotated/<path:filename>")
def annotated(filename):
    return send_from_directory(config.ANNOTATED_DIR, filename)


@app.errorhandler(413)
def too_large(_):
    return jsonify(error="image larger than 10 MB"), 413


if __name__ == "__main__":
    os.makedirs(config.ANNOTATED_DIR, exist_ok=True)
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5001")), debug=False)
