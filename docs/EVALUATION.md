# Evaluation plan

## Dataset

8 fruits × 3 stages. Target ≥ 250 images per composite class (≥ 6,000 total),
photographed so that the *stage* varies independently of everything else:

* the same fruit re-photographed daily as it ripens, not different fruits at
  different stages — otherwise the model can learn the background instead;
* three lighting conditions (daylight, warm indoor, cool indoor);
* three backgrounds (counter, plate, hand);
* single-fruit and multi-fruit frames.

Split 70 / 20 / 10, stratified per composite class. **The split must be by
physical fruit, not by image** — two photos of the same banana an hour apart in
train and test will inflate every number reported here.

## Metrics

| Metric | Why |
|---|---|
| mAP@0.5 and mAP@0.5:0.95 | standard detection quality |
| Fruit-identity accuracy (8×8 matrix) | is the easy part still solved? |
| Ripeness-stage accuracy (3×3 matrix) | the actual contribution |
| Adjacent-stage error rate | unripe↔ripe confusions are tolerable; unripe↔overripe is not |
| **Overripe recall** | the safety-relevant number: missing spoiled fruit is the costly error |
| Latency (ms/image, CPU and GPU) | it has to run on a phone-grade upload |

Report the 3×3 and 8×8 matrices separately. A single 24×24 matrix hides whether a
mistake was about the fruit or the stage, and those are different failures with
different fixes.

## Ablations

1. Detector alone (`ENABLE_COLOR_REFINEMENT=0`).
2. Detector + colour refiner (default, margin 0.20).
3. Refiner margin swept 0.0 → 0.5 — shows how much of any gain is real and where
   the refiner starts hurting confident predictions.
4. Colour rules alone, no network — the baseline that proves the network earns
   its place.

## Field evaluation

`fieldStageAccuracy` in `/api/admin/metrics` is `1 − corrections / detections`.
It is biased (people report mistakes far more often than successes), so treat it
as a monitoring signal, not a headline result — but a sudden drop after a deploy
is exactly the alarm a lab metric cannot give you.

## Threats to validity

* Bootstrap full-frame labels from `prepare_dataset.py` inflate mAP. Annotate
  properly before quoting a final number.
* Ripeness labels are human judgements. Have two people label independently and
  report Cohen's κ; if annotators disagree on 15% of the transitions, the model
  cannot be expected to do better.
* A photograph shows the surface. Internal ripeness is not in the data, so the
  ceiling is set by the task, not by the architecture.
