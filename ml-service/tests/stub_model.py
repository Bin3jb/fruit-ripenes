"""
A stand-in for an Ultralytics YOLO model.

It lets the whole Flask service — routing, enrichment, annotation, the knowledge
base, the colour refiner — be tested without torch, CUDA or a checkpoint, which
is what keeps the test suite runnable in CI and on a laptop.
"""

import numpy as np


class _Boxes:
    def __init__(self, rows):
        self.xyxy = [np.array(r["box"], dtype=float) for r in rows]
        self.conf = [float(r["conf"]) for r in rows]
        self.cls = [float(r["cls"]) for r in rows]

    def __len__(self):
        return len(self.conf)


class _Result:
    def __init__(self, rows):
        self.boxes = _Boxes(rows)


class StubYOLO:
    """names: {id: class_name}; rows: what predict() should return."""

    def __init__(self, names, rows=None):
        self.names = names
        self.rows = rows or []
        self.calls = 0

    def predict(self, image, **kwargs):
        self.calls += 1
        return [_Result(self.rows)]
