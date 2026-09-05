"""
Unit tests for the colour-cue refiner. Run with:  python -m pytest tests -q
These do not need the trained weights or a GPU, so they can run in CI.
"""
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.ripeness import extract_color_cues, color_stage_scores, refine_stage  # noqa: E402


def synthetic(bgr_color, size=200, spots=0):
    """A blob of one colour on a white background, optionally with dark spots."""
    img = np.full((size, size, 3), 245, np.uint8)
    cv2.circle(img, (size // 2, size // 2), int(size * 0.4), bgr_color, -1)
    rng = np.random.default_rng(0)
    for _ in range(spots):
        c = (int(rng.integers(70, 130)), int(rng.integers(70, 130)))
        cv2.circle(img, c, 10, (25, 30, 40), -1)
    return img


GREEN = (60, 170, 70)
YELLOW = (40, 220, 240)
BROWN = (40, 70, 110)


def test_green_blob_reads_as_green():
    cues = extract_color_cues(synthetic(GREEN))
    assert cues.green_ratio > 0.5
    assert cues.brown_ratio < 0.3


def test_yellow_blob_reads_as_yellow():
    cues = extract_color_cues(synthetic(YELLOW))
    assert cues.yellow_ratio > 0.5


def test_dark_spots_are_counted():
    clean = extract_color_cues(synthetic(YELLOW))
    spotted = extract_color_cues(synthetic(YELLOW, spots=12))
    assert spotted.dark_spot_ratio > clean.dark_spot_ratio


def test_banana_colour_opinion_tracks_colour():
    assert max(color_stage_scores("banana", extract_color_cues(synthetic(GREEN))),
               key=color_stage_scores("banana", extract_color_cues(synthetic(GREEN))).get) == "unripe"
    yellow = color_stage_scores("banana", extract_color_cues(synthetic(YELLOW)))
    assert yellow["ripe"] > yellow["unripe"]


def test_confident_detector_is_never_overridden():
    cues = extract_color_cues(synthetic(BROWN))
    stage, refined, _ = refine_stage(
        "banana", "ripe", {"unripe": 0.05, "ripe": 0.90, "overripe": 0.05}, cues, 0.20
    )
    assert stage == "ripe" and refined is False


def test_undecided_detector_can_be_flipped_by_colour():
    cues = extract_color_cues(synthetic(GREEN))
    stage, refined, why = refine_stage(
        "banana", "overripe", {"unripe": 0.40, "ripe": 0.28, "overripe": 0.42}, cues, 0.20
    )
    assert stage == "unripe" and refined is True and "colour cues" in why


def test_empty_crop_is_safe():
    cues = extract_color_cues(np.zeros((0, 0, 3), np.uint8))
    assert cues.green_ratio == 0
