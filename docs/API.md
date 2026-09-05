# API reference

Base URL: `http://localhost:3000/api`
All authenticated routes expect `Authorization: Bearer <jwt>`.

## Auth

### POST /auth/register
```json
{ "name": "Nawaf", "email": "n@example.com", "password": "at-least-8", "language": "en" }
```
`201` → `{ "user": {...}, "token": "eyJ..." }` · `409` if the email exists.

### POST /auth/login
```json
{ "email": "n@example.com", "password": "..." }
```
`200` → `{ "user": {...}, "token": "..." }` · `401` on bad credentials.
Rate limited to 20 attempts per 15 minutes per IP.

### POST /auth/change-password
`{ "currentPassword": "...", "newPassword": "..." }` → `200 { "message": "password updated" }`

### PATCH /auth/language
`{ "language": "ar" }` → `200 { "language": "ar" }`

## Detection

### POST /detect
`multipart/form-data` — `image` (file, ≤10 MB), `lang` (`en`|`ar`).

`201`:
```json
{
  "scanId": 42,
  "count": 2,
  "inference_ms": 84.2,
  "model": "best.pt",
  "mode": "ripeness",
  "annotated_url": "http://localhost:5001/annotated/9f3c.jpg",
  "detections": [
    {
      "id": 91,
      "fruit": "banana",
      "fruit_label": "Banana",
      "stage": "overripe",
      "stage_label": "Overripe",
      "stage_from_detector": "ripe",
      "stage_refined": true,
      "stage_source": "detector+colour",
      "reason": "detector undecided (gap 0.06); colour cues favour overripe (brown 38%, green 2%, dark spots 11%)",
      "confidence": 0.87,
      "stage_scores": { "unripe": 0.03, "ripe": 0.49, "overripe": 0.43 },
      "box": { "x1": 120, "y1": 84, "x2": 402, "y2": 336 },
      "color_cues": { "green_ratio": 0.02, "yellow_ratio": 0.51, "brown_ratio": 0.38,
                      "dark_spot_ratio": 0.11, "texture_energy": 0.42 },
      "advice": "Very sweet, soft flesh. Best for banana bread, smoothies or freezing.",
      "action": "cook",
      "action_label": "Cook or blend",
      "days_room_temperature": 1,
      "days_refrigerated": 2
    }
  ],
  "grounding": "- banana / overripe (confidence 0.87): ..."
}
```

Errors: `400` no image / unsupported type · `413` over 10 MB · `503` ML service down.

### GET /detect/history?limit=20&offset=0
`{ "scans": [ { "id", "annotated_url", "detection_count", "summary", "created_at" } ] }`

### GET /detect/stats
`{ "byStage": [{ "stage": "ripe", "n": 12 }], "byFruit": [{ "fruit": "banana", "stage": "ripe", "n": 4 }] }`

`mode` is `"ripeness"` (fine-tuned weights) or `"coco"` (stock weights: the fruit
comes from the network, the stage from colour cues alone). `stage_source` is
`detector`, `detector+colour` or `colour-only` per detection — the UI shows a
notice for the last one.

### GET /advice (ML service, port 5001)

`?fruit=banana&stage=overripe&lang=ar` →

```json
{
  "fruit": "banana", "stage": "overripe", "lang": "ar",
  "fruit_label": "موز", "stage_label": "مفرط النضج",
  "advice": "حلوة جدًا ولبها طري...",
  "action": "cook", "action_label": "اطبخها أو اخلطها",
  "days_room_temperature": 1, "days_refrigerated": 2
}
```

The backend calls this when answering a question about a stored scan, so an
Arabic conversation gets Arabic guidance even if the scan was made in English.
`404` for an unknown fruit or stage.

## Assistant

### POST /chat
```json
{ "question": "How long do I have?", "scanId": 42, "lang": "en" }
```
`200` → `{ "answer": "...", "source": "gpt-4o-mini", "grounded": true }`

When `scanId` is supplied the detections and their knowledge-base rows are
injected into the prompt as ground truth, and the last 8 turns of that thread are
included. Without an `OPENAI_API_KEY` the endpoint still answers, from the
knowledge base, with `"source": "knowledge-base"`.

## Feedback

### POST /feedback
```json
{ "detectionId": 91, "correctedStage": "ripe", "message": "it was fine actually" }
```
Either `message` or `correctedStage` is required. Corrections are what
`/admin/retraining-set` exports.

## Admin (role = admin)

| Route | Returns |
|---|---|
| `GET /admin/metrics` | counts, average latency, correction count, field stage accuracy, ML health |
| `GET /admin/feedback` | last 500 feedback rows joined to the detection |
| `GET /admin/users` | users with scan counts |
| `GET /admin/retraining-set` | corrected samples as a JSON manifest |
