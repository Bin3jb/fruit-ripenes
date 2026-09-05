"""
YOLO wrapper: loading, inference, stage refinement and annotation.

Two operating modes, decided by the class names inside the checkpoint:

* **ripeness mode** — the checkpoint was trained by ``scripts/train.py`` and its
  classes look like ``banana__ripe``. One forward pass gives fruit *and* stage;
  the colour refiner only arbitrates when the network is undecided.
* **COCO fallback** — the checkpoint is a stock Ultralytics model (yolov8l.pt and
  friends). COCO already contains ``banana``, ``apple`` and ``orange``, so the
  fruit comes from the network and the stage comes entirely from the colour cues.
  Accuracy is lower and the API marks every such detection ``stage_source:
  "colour-only"``, but the whole application runs before a single epoch of
  training — which is what makes the system demonstrable today.
"""

import os
import time
import uuid

import cv2
import numpy as np

import config
from utils.ripeness import extract_color_cues, refine_stage, color_stage_scores


class RipenessDetector:
    def __init__(self, weights: str = None, model=None):
        """`model` is injectable so the API can be tested without torch."""
        self.weights = weights or config.MODEL_PATH

        if model is not None:
            self.model = model
            self.weights = weights or "injected"
        else:
            from ultralytics import YOLO  # imported lazily: heavy, and optional in tests

            if not os.path.exists(self.weights):
                print(f"[detector] {self.weights} not found, falling back to "
                      f"{config.FALLBACK_MODEL}")
                self.weights = config.FALLBACK_MODEL
            self.model = YOLO(self.weights)

        self.names = dict(self.model.names)
        self.mode = "ripeness" if any("__" in n for n in self.names.values()) else "coco"
        if self.mode == "coco":
            print("[detector] COCO fallback mode: fruit from the network, "
                  "ripeness stage from colour cues only")
        self.warm_up()

    def warm_up(self):
        """One dummy pass so the first real request is not the slow one."""
        blank = np.zeros((config.IMG_SIZE, config.IMG_SIZE, 3), np.uint8)
        try:
            self.model.predict(blank, imgsz=config.IMG_SIZE, verbose=False)
        except Exception as err:                       # a stub model in tests
            print(f"[detector] warm-up skipped: {err}")

    # ------------------------------------------------------------------ #

    @staticmethod
    def _stage_distribution(stage: str, conf: float) -> dict:
        """
        Turn one box confidence into a distribution over the three stages.

        YOLO emits a single score per box, so the remaining probability mass is
        split evenly over the other two stages. That is deliberately pessimistic:
        it makes the top-2 gap small whenever the box score is low, which is
        exactly when we want the colour refiner to get a vote.
        """
        dist = {"unripe": 0.0, "ripe": 0.0, "overripe": 0.0}
        dist[stage] = conf
        leftover = max(0.0, 1.0 - conf) / 2.0
        for s in dist:
            if s != stage:
                dist[s] = leftover
        return dist

    def _resolve_apple(self, cues) -> str:
        """COCO has one 'apple' class; colour decides red vs green."""
        return "green_apple" if cues.green_ratio > cues.red_ratio else "red_apple"

    def predict(self, image_bgr: np.ndarray, lang: str = "en") -> dict:
        started = time.time()
        results = self.model.predict(
            image_bgr,
            imgsz=config.IMG_SIZE,
            conf=config.CONF_THRESHOLD,
            iou=config.IOU_THRESHOLD,
            max_det=config.MAX_DETECTIONS,
            verbose=False,
        )[0]

        detections = []
        boxes = results.boxes
        for i in range(len(boxes)):
            x1, y1, x2, y2 = [int(v) for v in boxes.xyxy[i].tolist()]
            conf = float(boxes.conf[i])
            cls_name = self.names[int(boxes.cls[i])]

            crop = image_bgr[max(y1, 0):y2, max(x1, 0):x2]
            cues = extract_color_cues(crop)

            if "__" in cls_name:
                # ---------- trained ripeness model ----------
                fruit, stage = cls_name.split("__")
                dist = self._stage_distribution(stage, conf)
                if config.ENABLE_COLOR_REFINEMENT:
                    final, was_refined, why = refine_stage(
                        fruit, stage, dist, cues, config.REFINE_MARGIN)
                else:
                    final, was_refined, why = stage, False, "refinement disabled"
                source = "detector+colour" if was_refined else "detector"
            else:
                # ---------- COCO fallback ----------
                fruit = config.COCO_FRUIT_MAP.get(cls_name)
                if fruit is None:
                    continue                      # not a fruit we handle: drop it
                if cls_name == "apple":
                    fruit = self._resolve_apple(cues)
                dist = color_stage_scores(fruit, cues)
                stage = max(dist, key=dist.get)
                final, was_refined = stage, False
                why = (f"COCO fallback: fruit from the detector, stage from colour "
                       f"(green {cues.green_ratio:.0%}, brown {cues.brown_ratio:.0%}, "
                       f"dark spots {cues.dark_spot_ratio:.0%})")
                source = "colour-only"

            detections.append({
                "fruit": fruit,
                "stage": final,
                "stage_from_detector": stage,
                "stage_refined": was_refined,
                "stage_source": source,
                "reason": why,
                "confidence": conf,
                "stage_scores": {k: round(float(v), 4) for k, v in dist.items()},
                "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                "color_cues": cues.as_dict(),
            })

        detections.sort(key=lambda d: d["confidence"], reverse=True)
        return {
            "detections": detections,
            "count": len(detections),
            "inference_ms": round((time.time() - started) * 1000, 1),
            "model": os.path.basename(self.weights),
            "mode": self.mode,
        }

    # ------------------------------------------------------------------ #

    def annotate(self, image_bgr: np.ndarray, detections: list) -> str:
        """Draw boxes coloured by ripeness stage; return the saved file path."""
        img = image_bgr.copy()
        scale = max(0.5, min(1.2, img.shape[0] / 700.0))

        for d in detections:
            b = d["box"]
            color = config.STAGE_COLORS_BGR[d["stage"]]
            cv2.rectangle(img, (b["x1"], b["y1"]), (b["x2"], b["y2"]),
                          color, max(2, int(3 * scale)))

            fruit_en = config.FRUIT_LABELS.get(d["fruit"], {}).get("en", d["fruit"])
            stage_en = config.STAGE_LABELS[d["stage"]]["en"]
            label = f"{fruit_en} - {stage_en} {d['confidence']:.2f}"

            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6 * scale, 2)
            top = max(b["y1"] - th - 8, 0)
            cv2.rectangle(img, (b["x1"], top), (b["x1"] + tw + 8, top + th + 8), color, -1)
            cv2.putText(img, label, (b["x1"] + 4, top + th + 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6 * scale, (255, 255, 255), 2, cv2.LINE_AA)

        os.makedirs(config.ANNOTATED_DIR, exist_ok=True)
        name = f"{uuid.uuid4().hex}.jpg"
        path = os.path.join(config.ANNOTATED_DIR, name)
        cv2.imwrite(path, img, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        return path
