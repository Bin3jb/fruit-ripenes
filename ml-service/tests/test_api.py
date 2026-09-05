"""
End-to-end tests for the Flask service with a stubbed detector.

Covers both operating modes, the enrichment layer (labels, advice, shelf life),
the annotated-image round trip and the error paths.
    python -m pytest tests -q
"""
import base64
import os
import sys

import cv2
import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import app as flask_app                     # noqa: E402
import config                               # noqa: E402
from utils.detector import RipenessDetector  # noqa: E402
from tests.stub_model import StubYOLO        # noqa: E402


def make_image(color=(40, 200, 230), size=480):
    img = np.full((size, size, 3), 245, np.uint8)
    cv2.circle(img, (size // 2, size // 2), int(size * 0.3), color, -1)
    return img


def encode(img):
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


@pytest.fixture
def client():
    flask_app.app.config["TESTING"] = True
    with flask_app.app.test_client() as c:
        yield c
    flask_app.set_detector(None)


def use_ripeness_model(rows):
    names = {i: n for i, n in enumerate(config.CLASSES)}
    flask_app.set_detector(RipenessDetector(model=StubYOLO(names, rows)))


def use_coco_model(rows):
    names = {0: "person", 46: "banana", 47: "apple", 49: "orange"}
    flask_app.set_detector(RipenessDetector(model=StubYOLO(names, rows)))


# --------------------------------------------------------------------------- #

def test_health_reports_ripeness_mode(client):
    use_ripeness_model([])
    r = client.get("/health")
    assert r.status_code == 200
    assert r.get_json()["mode"] == "ripeness"


def test_health_reports_coco_fallback(client):
    use_coco_model([])
    assert client.get("/health").get_json()["mode"] == "coco"


def test_classes_endpoint_lists_the_taxonomy(client):
    body = client.get("/classes").get_json()
    assert len(body["fruits"]) == 8
    assert len(body["stages"]) == 3
    assert len(body["composite"]) == 24
    assert body["fruits"][0]["ar"]            # Arabic labels present


def test_predict_returns_enriched_detection(client):
    cid = config.CLASS_TO_ID["banana__ripe"]
    use_ripeness_model([{"box": [100, 100, 380, 380], "conf": 0.91, "cls": cid}])

    r = client.post("/predict", data={
        "image": (open_bytes(), "banana.jpg"), "lang": "en",
    }, content_type="multipart/form-data")

    assert r.status_code == 200
    body = r.get_json()
    d = body["detections"][0]
    assert body["count"] == 1
    assert d["fruit"] == "banana" and d["stage"] == "ripe"
    assert d["fruit_label"] == "Banana" and d["stage_label"] == "Ripe"
    assert d["action"] in ("eat", "ripen", "cook", "discard")
    assert isinstance(d["days_refrigerated"], int)
    assert d["stage_source"] == "detector"
    assert body["annotated_url"].startswith("/annotated/")
    assert "banana / ripe" in body["grounding"]


def test_annotated_image_is_served(client):
    cid = config.CLASS_TO_ID["pear__overripe"]
    use_ripeness_model([{"box": [40, 40, 300, 300], "conf": 0.8, "cls": cid}])
    body = client.post("/predict", data={"image": (open_bytes(), "p.jpg")},
                       content_type="multipart/form-data").get_json()
    img = client.get(body["annotated_url"])
    assert img.status_code == 200
    assert len(img.data) > 1000


def test_arabic_labels_when_lang_is_ar(client):
    cid = config.CLASS_TO_ID["orange__unripe"]
    use_ripeness_model([{"box": [50, 50, 250, 250], "conf": 0.77, "cls": cid}])
    body = client.post("/predict", data={"image": (open_bytes(), "o.jpg"), "lang": "ar"},
                       content_type="multipart/form-data").get_json()
    d = body["detections"][0]
    assert d["fruit_label"] == "برتقال"
    assert d["stage_label"] == "غير ناضج"


def test_coco_fallback_derives_stage_from_colour(client):
    use_coco_model([{"box": [100, 100, 380, 380], "conf": 0.66, "cls": 46}])
    body = client.post("/predict", data={"image": (open_bytes(), "b.jpg")},
                       content_type="multipart/form-data").get_json()
    d = body["detections"][0]
    assert body["mode"] == "coco"
    assert d["fruit"] == "banana"
    assert d["stage_source"] == "colour-only"
    assert d["stage"] in ("unripe", "ripe", "overripe")


def test_coco_fallback_ignores_non_fruit_classes(client):
    use_coco_model([{"box": [10, 10, 200, 200], "conf": 0.95, "cls": 0}])  # person
    body = client.post("/predict", data={"image": (open_bytes(), "x.jpg")},
                       content_type="multipart/form-data").get_json()
    assert body["count"] == 0


def test_coco_apple_split_by_colour(client):
    use_coco_model([{"box": [100, 100, 380, 380], "conf": 0.7, "cls": 47}])
    green = encode(make_image((70, 170, 60)))
    body = client.post("/predict", data={"image": (green_bytes(green), "a.jpg")},
                       content_type="multipart/form-data").get_json()
    assert body["detections"][0]["fruit"] == "green_apple"


def test_predict_base64_matches_multipart(client):
    cid = config.CLASS_TO_ID["kiwi__ripe"]
    use_ripeness_model([{"box": [60, 60, 300, 300], "conf": 0.72, "cls": cid}])
    payload = "data:image/jpeg;base64," + base64.b64encode(encode(make_image())).decode()
    body = client.post("/predict-base64", json={"image": payload}).get_json()
    assert body["detections"][0]["fruit"] == "kiwi"


def test_missing_image_is_rejected(client):
    use_ripeness_model([])
    assert client.post("/predict", data={}).status_code == 400


def test_unsupported_extension_is_rejected(client):
    use_ripeness_model([])
    r = client.post("/predict", data={"image": (open_bytes(), "notes.txt")},
                    content_type="multipart/form-data")
    assert r.status_code == 400


def test_bad_base64_is_rejected(client):
    use_ripeness_model([])
    assert client.post("/predict-base64", json={"image": "not-base64"}).status_code == 400


def test_no_detections_still_answers(client):
    use_ripeness_model([])
    body = client.post("/predict", data={"image": (open_bytes(), "empty.jpg")},
                       content_type="multipart/form-data").get_json()
    assert body["count"] == 0
    assert "no fruit detected" in body["grounding"]


# --------------------------------------------------------------------------- #

def open_bytes():
    import io
    return io.BytesIO(encode(make_image()))


def green_bytes(raw):
    import io
    return io.BytesIO(raw)


def test_advice_endpoint_is_language_aware(client):
    use_ripeness_model([])
    en = client.get("/advice?fruit=banana&stage=overripe&lang=en").get_json()
    ar = client.get("/advice?fruit=banana&stage=overripe&lang=ar").get_json()
    assert en["action"] == "cook" and ar["action"] == "cook"
    assert en["advice"] != ar["advice"]
    assert ar["stage_label"] == "مفرط النضج"
    assert en["days_refrigerated"] == ar["days_refrigerated"]


def test_advice_endpoint_rejects_unknown_pairs(client):
    use_ripeness_model([])
    assert client.get("/advice?fruit=dragonfruit&stage=ripe").status_code == 404
