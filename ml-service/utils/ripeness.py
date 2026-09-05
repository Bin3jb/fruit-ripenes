"""
Colour-cue ripeness refinement.

Motivation
----------
A single-stage detector learns shape + colour jointly, which works well when
the fruit is clearly unripe or clearly overripe.  The hard cases are the
transitions (a banana that is 80% yellow with the first brown freckles).  In
those cases the detector's top-2 stage probabilities sit close together.

This module extracts cheap, interpretable colour/texture statistics from the
detected crop and produces an independent ripeness opinion.  The opinion is
only allowed to override the network when the network itself is undecided
(top-1 minus top-2 < REFINE_MARGIN), so the CNN stays in charge of the
confident cases and we never trade away accuracy for interpretability.

The statistics are also returned to the client, which lets the UI explain
*why* a fruit was called overripe ("38% of the surface is brown").
"""

from dataclasses import dataclass, asdict

import cv2
import numpy as np


@dataclass
class ColorCues:
    green_ratio: float      # fraction of fruit pixels in the green hue band
    yellow_ratio: float     # fraction in the yellow/orange band
    red_ratio: float        # fraction in the red band
    brown_ratio: float      # dark, low-saturation pixels -> bruising / spots
    dark_spot_ratio: float  # very dark blobs -> rot spots
    mean_saturation: float
    mean_value: float
    texture_energy: float   # Laplacian variance, wrinkling / shrivelling proxy

    def as_dict(self):
        return {k: round(float(v), 4) for k, v in asdict(self).items()}


# HSV bands in OpenCV convention (H: 0-179, S: 0-255, V: 0-255)
_BANDS = {
    "green":  ((35, 60, 40), (85, 255, 255)),
    "yellow": ((20, 80, 80), (34, 255, 255)),
    "red_lo": ((0, 80, 60), (10, 255, 255)),
    "red_hi": ((170, 80, 60), (179, 255, 255)),
    "brown":  ((5, 40, 20), (25, 200, 140)),
}


def _foreground_mask(bgr: np.ndarray) -> np.ndarray:
    """
    Rough fruit mask inside the bounding box.  The box always contains some
    background, so we drop the extreme corners and keep the pixels whose
    saturation/value profile differs from the box border (a cheap stand-in for
    segmentation that costs microseconds instead of a second network).
    """
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, w = hsv.shape[:2]

    border = np.concatenate([
        hsv[0, :, :].reshape(-1, 3), hsv[-1, :, :].reshape(-1, 3),
        hsv[:, 0, :].reshape(-1, 3), hsv[:, -1, :].reshape(-1, 3),
    ])
    bg_sat = float(np.median(border[:, 1]))

    sat = hsv[:, :, 1].astype(np.float32)
    mask = (sat > max(bg_sat + 25, 40)).astype(np.uint8) * 255

    # Central ellipse prior: fruits sit in the middle of their own box.
    prior = np.zeros((h, w), np.uint8)
    cv2.ellipse(prior, (w // 2, h // 2), (int(w * 0.45), int(h * 0.45)), 0, 0, 360, 255, -1)
    mask = cv2.bitwise_and(mask, prior)

    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    if mask.sum() < 0.05 * h * w * 255:      # mask collapsed -> fall back to prior
        mask = prior
    return mask


def extract_color_cues(crop_bgr: np.ndarray) -> ColorCues:
    """Compute interpretable colour/texture statistics for one detection crop."""
    if crop_bgr is None or crop_bgr.size == 0:
        return ColorCues(0, 0, 0, 0, 0, 0, 0, 0)

    crop = cv2.resize(crop_bgr, (128, 128), interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    mask = _foreground_mask(crop)
    total = max(int(np.count_nonzero(mask)), 1)

    def band_ratio(name):
        lo, hi = _BANDS[name]
        m = cv2.inRange(hsv, np.array(lo, np.uint8), np.array(hi, np.uint8))
        m = cv2.bitwise_and(m, mask)
        return np.count_nonzero(m) / total

    red = band_ratio("red_lo") + band_ratio("red_hi")

    v = hsv[:, :, 2]
    dark = ((v < 60) & (mask > 0))
    dark_ratio = np.count_nonzero(dark) / total

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    texture = float(cv2.Laplacian(gray, cv2.CV_64F).var()) / 1000.0

    fg = mask > 0
    return ColorCues(
        green_ratio=band_ratio("green"),
        yellow_ratio=band_ratio("yellow"),
        red_ratio=red,
        brown_ratio=band_ratio("brown"),
        dark_spot_ratio=dark_ratio,
        mean_saturation=float(hsv[:, :, 1][fg].mean()) / 255.0 if fg.any() else 0.0,
        mean_value=float(v[fg].mean()) / 255.0 if fg.any() else 0.0,
        texture_energy=texture,
    )


# Per-fruit rules: which cue pushes towards which stage.  Weights were tuned on
# the validation split; they are deliberately simple so they can be defended in
# the report and adjusted without retraining.
_RULES = {
    "banana":      {"unripe": ("green_ratio", 2.0), "ripe": ("yellow_ratio", 1.6), "overripe": ("brown_ratio", 2.4)},
    "pear":        {"unripe": ("green_ratio", 1.8), "ripe": ("yellow_ratio", 1.4), "overripe": ("brown_ratio", 2.2)},
    "lemon":       {"unripe": ("green_ratio", 2.0), "ripe": ("yellow_ratio", 1.5), "overripe": ("brown_ratio", 2.0)},
    "orange":      {"unripe": ("green_ratio", 1.9), "ripe": ("yellow_ratio", 1.3), "overripe": ("brown_ratio", 2.1)},
    "red_apple":   {"unripe": ("green_ratio", 1.6), "ripe": ("red_ratio", 1.5),    "overripe": ("brown_ratio", 2.3)},
    "green_apple": {"unripe": ("green_ratio", 1.2), "ripe": ("yellow_ratio", 1.2), "overripe": ("brown_ratio", 2.3)},
    "kiwi":        {"unripe": ("texture_energy", 1.0), "ripe": ("brown_ratio", 1.0), "overripe": ("dark_spot_ratio", 2.0)},
    "blueberry":   {"unripe": ("red_ratio", 1.6), "ripe": ("mean_saturation", 1.0), "overripe": ("dark_spot_ratio", 1.8)},
}


def color_stage_scores(fruit: str, cues: ColorCues) -> dict:
    """Return a normalised {stage: score} opinion derived only from colour."""
    rules = _RULES.get(fruit)
    if rules is None:
        return {"unripe": 1 / 3, "ripe": 1 / 3, "overripe": 1 / 3}

    d = cues.as_dict()
    raw = {}
    for stage, (cue, weight) in rules.items():
        raw[stage] = max(float(d.get(cue, 0.0)), 0.0) * weight

    # Heavy dark spotting always argues for overripe, whatever the fruit.
    raw["overripe"] += cues.dark_spot_ratio * 1.5

    total = sum(raw.values())
    if total <= 1e-6:
        return {"unripe": 1 / 3, "ripe": 1 / 3, "overripe": 1 / 3}
    return {k: v / total for k, v in raw.items()}


def refine_stage(fruit, model_stage, model_scores, cues, margin):
    """
    Combine the detector's stage distribution with the colour opinion.

    Returns (stage, refined: bool, explanation: str).
    The colour opinion may only flip the decision when the detector's top-2
    gap is smaller than `margin`.
    """
    ordered = sorted(model_scores.items(), key=lambda kv: kv[1], reverse=True)
    top1, top2 = ordered[0], (ordered[1] if len(ordered) > 1 else (None, 0.0))
    gap = top1[1] - top2[1]

    if gap >= margin:
        return model_stage, False, f"detector confident (top-2 gap {gap:.2f})"

    color = color_stage_scores(fruit, cues)
    blended = {s: 0.6 * model_scores.get(s, 0.0) + 0.4 * color.get(s, 0.0)
               for s in ("unripe", "ripe", "overripe")}
    winner = max(blended, key=blended.get)
    if winner == model_stage:
        return model_stage, False, f"colour cues agree (gap {gap:.2f})"
    return winner, True, (
        f"detector undecided (gap {gap:.2f}); colour cues favour {winner} "
        f"(brown {cues.brown_ratio:.0%}, green {cues.green_ratio:.0%}, "
        f"dark spots {cues.dark_spot_ratio:.0%})"
    )
