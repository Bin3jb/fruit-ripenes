"""
Central configuration for the AI Fruit Ripeness Recognizer ML service.

The detector is trained on composite classes of the form  <fruit>_<stage>,
so a single YOLO forward pass yields both *what* the fruit is and *how ripe*
it is.  Keeping the taxonomy in one place guarantees that the training
scripts, the inference server and the evaluation reports all agree on the
class ordering (YOLO stores classes by index, so ordering is load-bearing).
"""

import os

# --------------------------------------------------------------------------- #
# Taxonomy
# --------------------------------------------------------------------------- #

FRUITS = [
    "banana",
    "lemon",
    "red_apple",
    "green_apple",
    "blueberry",
    "kiwi",
    "pear",
    "orange",
]

STAGES = ["unripe", "ripe", "overripe"]

# Composite class list. Index == YOLO class id. DO NOT reorder after training.
CLASSES = [f"{fruit}__{stage}" for fruit in FRUITS for stage in STAGES]
CLASS_TO_ID = {name: i for i, name in enumerate(CLASSES)}
NUM_CLASSES = len(CLASSES)


def split_class(name: str):
    """'banana__ripe' -> ('banana', 'ripe')"""
    fruit, stage = name.split("__")
    return fruit, stage


# Display names (English / Arabic) used by the API responses and the UI.
FRUIT_LABELS = {
    "banana":      {"en": "Banana",      "ar": "موز"},
    "lemon":       {"en": "Lemon",       "ar": "ليمون"},
    "red_apple":   {"en": "Red Apple",   "ar": "تفاح أحمر"},
    "green_apple": {"en": "Green Apple", "ar": "تفاح أخضر"},
    "blueberry":   {"en": "Blueberry",   "ar": "توت أزرق"},
    "kiwi":        {"en": "Kiwi",        "ar": "كيوي"},
    "pear":        {"en": "Pear",        "ar": "كمثرى"},
    "orange":      {"en": "Orange",      "ar": "برتقال"},
}

STAGE_LABELS = {
    "unripe":   {"en": "Unripe",   "ar": "غير ناضج"},
    "ripe":     {"en": "Ripe",     "ar": "ناضج"},
    "overripe": {"en": "Overripe", "ar": "مفرط النضج"},
}

# Colour used when drawing boxes, keyed by ripeness stage (BGR for OpenCV).
STAGE_COLORS_BGR = {
    "unripe":   (96, 176, 92),    # green
    "ripe":     (60, 190, 245),   # amber
    "overripe": (72, 72, 214),    # red
}

# --------------------------------------------------------------------------- #
# Runtime settings
# --------------------------------------------------------------------------- #

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.getenv("MODEL_PATH", os.path.join(BASE_DIR, "models", "best.pt"))
# Base weights to fall back to when no fine-tuned checkpoint exists yet.
# yolov8l.pt is the COCO-pretrained large model; it already knows banana, apple
# and orange, which is enough to run the whole application before training (see
# COCO_FRUIT_MAP below and utils/detector.py).
FALLBACK_MODEL = os.getenv("FALLBACK_MODEL", os.path.join(BASE_DIR, "models", "yolov8l.pt"))

# COCO class name -> our fruit key. Used only in fallback mode: the stage then
# comes entirely from the colour cues, and the API says so in `stage_source`.
COCO_FRUIT_MAP = {
    "banana": "banana",
    "apple": "red_apple",      # refined to green_apple by colour, see detector
    "orange": "orange",
}

CONF_THRESHOLD = float(os.getenv("CONF_THRESHOLD", "0.35"))
IOU_THRESHOLD = float(os.getenv("IOU_THRESHOLD", "0.50"))
IMG_SIZE = int(os.getenv("IMG_SIZE", "640"))
MAX_DETECTIONS = int(os.getenv("MAX_DETECTIONS", "20"))

# When the detector is unsure between two ripeness stages of the *same* fruit
# (top-2 probability gap below this margin) the colour-cue refiner is allowed
# to override the stage. See utils/ripeness.py.
REFINE_MARGIN = float(os.getenv("REFINE_MARGIN", "0.20"))
ENABLE_COLOR_REFINEMENT = os.getenv("ENABLE_COLOR_REFINEMENT", "1") == "1"

UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(BASE_DIR, "uploads"))
ANNOTATED_DIR = os.getenv("ANNOTATED_DIR", os.path.join(BASE_DIR, "annotated"))
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "bmp"}
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB
