# Getting it running — the short version

Three things have to be true before the app works end to end: Python can see the
weights, MySQL exists, and Node can reach both. This is that path, in order.

## 0. What you have right now

`yolov8l.pt` is the **stock COCO checkpoint** — 80 classes (person, car, banana…),
not a ripeness model. Confirm it yourself:

```bash
cd ml-service
python scripts/inspect_weights.py /path/to/yolov8l.pt
```

Copy it into `ml-service/models/yolov8l.pt`. The app will run in COCO fallback
mode (fruit from the network, stage from colour) until you train.

## 1. ML service

```bash
cd ml-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py                       # http://localhost:5001
```

No GPU and no weights? `python scripts/dev_server.py` runs the same API with a
synthetic detector, so the web tier can be built and demonstrated regardless.

## 2. Database

```sql
CREATE DATABASE fruit_ripeness CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'fruit'@'localhost' IDENTIFIED BY 'a-password';
GRANT ALL ON fruit_ripeness.* TO 'fruit'@'localhost';
```

## 3. API + frontend

```bash
cd backend
npm install
cp .env.example .env                # DB_USER=fruit, DB_PASSWORD=…, JWT_SECRET=…
npm run migrate                     # schema + a seeded admin account
npm start                           # http://localhost:3000  (serves the UI too)
```

`OPENAI_API_KEY` is optional. Without it the assistant answers from the
knowledge base and labels the reply `knowledge-base`.

## 4. Check it

```bash
curl localhost:3000/api/health
# {"api":"ok","database":"ok","mlService":"ok","model":"yolov8l.pt"}
```

Then open http://localhost:3000, register, and upload a photo.

## 5. Train the real thing

```bash
cd ml-service
python scripts/prepare_dataset.py --raw raw --out dataset
python scripts/train.py --data dataset/data.yaml --model models/yolov8l.pt --epochs 120
python scripts/evaluate.py --weights models/best.pt --data dataset/data.yaml
```

`train.py` copies the best checkpoint to `models/best.pt`; restart the ML service
and `/health` will report `"mode": "ripeness"`.

## Tests

```bash
cd ml-service && python -m pytest tests -q   # 23 passed
cd backend    && npm test                    # 9 passed
```

## Common failures

| Symptom | Cause |
|---|---|
| `mlService: unreachable` | the Flask service is not running, or `ML_SERVICE_URL` is wrong |
| `database: unreachable` | MySQL is down, or the credentials in `backend/.env` are wrong |
| every fruit comes back `colour-only` | you are still on `yolov8l.pt`; train and produce `best.pt` |
| detections but no boxes drawn | `ml-service/annotated/` is not writable |
| Arabic text renders left-to-right | the language toggle sets `dir="rtl"`; hard refresh the page |
