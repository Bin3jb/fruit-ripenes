# AI Fruit Ripeness Recognizer

A web application that tells you **which fruit** is in a photo, **how ripe it is**,
and **what to do about it** — then lets you ask follow-up questions in English or
Arabic and answers them from verified data rather than from the language model's
memory.

The original version of this project stopped at "that is a banana." Identifying a
banana is not a problem anyone has. Knowing whether it should be eaten today,
refrigerated, or turned into bread is — roughly a third of the fruit bought by
households is thrown away, most of it because nobody noticed it turning.

---

## What is new in this version

| | v1 (fruit recognition) | v2 (ripeness) |
|---|---|---|
| Classes | 8 fruits | 8 fruits × 3 ripeness stages = 24 |
| Output | a label | a label, a stage, an action, a shelf-life estimate |
| Assistant | free-form chat model | grounded in the detection + a fixed knowledge base |
| Failure handling | none | colour-cue refiner for the ambiguous transitions, user corrections feed retraining |
| Value | naming a fruit | avoiding food waste |

## Architecture

```
Browser (vanilla JS, EN/AR RTL)
        │  JSON + multipart
        ▼
Node.js / Express API  ──── MySQL 8  (users, scans, detections, messages, feedback)
        │                   
        ├── OpenAI Chat Completions  (grounded assistant)
        ▼
Flask ML service ──► YOLOv8 (24 composite classes) ──► colour-cue refiner ──► knowledge base
```

Three processes, one job each. The detector never touches the database and the
API never loads a model, so the ML service can move to a GPU host without
changing a line of the web tier.

### The two-signal ripeness decision

A detector trained on `<fruit>__<stage>` classes is confident at the extremes and
shaky in the middle — a banana that is mostly yellow with the first freckles sits
between `ripe` and `overripe`. So the service computes a second, independent
opinion from interpretable colour and texture statistics of the crop (green /
yellow / red / brown coverage, dark-spot ratio, Laplacian texture energy) and is
allowed to override the network **only** when the network's top-2 gap is under
`REFINE_MARGIN` (0.20 by default).

The rule is deliberately simple, and the statistics are returned to the UI, so the
app can say *why*: "detector undecided (gap 0.06); colour cues favour overripe
(brown 38%, dark spots 11%)". Interpretability here is not decoration — it is what
lets a user disagree usefully, and every disagreement is stored as a labelled
sample for the next training round (`GET /api/admin/retraining-set`).

## Repository layout

```
ml-service/          Flask + YOLOv8
  config.py            class taxonomy, thresholds, labels (EN/AR)
  app.py               REST endpoints
  utils/detector.py    inference, stage refinement, annotation
  utils/ripeness.py    colour-cue extraction and the refinement rule
  utils/knowledge.py   the grounded shelf-life / storage knowledge base
  scripts/             prepare_dataset.py · train.py · evaluate.py
  scripts/dev_server.py    synthetic detector: run the API with no weights
  scripts/inspect_weights.py  what classes are really inside a .pt
  tests/               refiner unit tests + the whole API against a stub model
backend/             Node.js + Express + MySQL
  src/routes|controllers|services|middleware
  db/schema.sql        schema + the rescue-rate view
  tests/               auth, JWT and the grounded fallback
frontend/            vanilla JS, bilingual (EN/AR, RTL), no build step
docs/                API reference, evaluation plan, poster source
.github/workflows/   CI: both test suites on every push
run.sh               start the whole stack locally
SETUP.md             first-run guide, including the database
```

## Two operating modes

The service reads the class names inside whatever checkpoint it loads and picks
its mode from them — nothing to configure.

| | weights | fruit from | stage from | marked as |
|---|---|---|---|---|
| **Ripeness mode** | `models/best.pt` (fine-tuned, 24 classes) | the network | the network, arbitrated by colour when undecided | `detector` / `detector+colour` |
| **COCO fallback** | `models/yolov8l.pt` (stock, 80 classes) | the network (`banana`, `apple`, `orange`) | colour cues alone | `colour-only` |

COCO fallback exists so the *application* can be built, demoed and marked before
the detector has finished training. Check any checkpoint first:

```bash
python scripts/inspect_weights.py models/yolov8l.pt
```

There is also a synthetic detector for front-end work — no torch, no weights:

```bash
python scripts/dev_server.py --fruit banana --stage overripe
```

## Running it

Step-by-step, including the database and the weights: **[SETUP.md](SETUP.md)**.

### 0. Everything at once

```bash
./run.sh          # real detector
./run.sh --dev    # synthetic detector, nothing to install beyond Flask
```

### 1. ML service

```bash
cd ml-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py                 # http://localhost:5001
```

Without `models/best.pt` the service falls back to `models/yolov8l.pt` and runs in
COCO fallback mode, so the rest of the stack still works — see the table above.

### 2. Database and API

```bash
cd backend
npm install
cp .env.example .env          # set DB_PASSWORD, JWT_SECRET, OPENAI_API_KEY
npm run migrate               # creates the schema + an admin account
npm start                     # http://localhost:3000
```

The API serves `frontend/` as static files, so opening `http://localhost:3000`
gives you the whole application. `OPENAI_API_KEY` is optional — without it the
assistant answers from the knowledge base instead of the LLM.

### 3. Docker

```bash
docker compose up --build
```

## Training your own weights

```bash
# raw/banana__unripe/*.jpg, raw/banana__ripe/*.jpg, ...
python scripts/prepare_dataset.py --raw raw --out dataset --split 0.7 0.2 0.1
python scripts/train.py --data dataset/data.yaml --model models/yolov8l.pt --epochs 120
python scripts/evaluate.py --weights models/best.pt --data dataset/data.yaml
```

`evaluate.py` writes `reports/metrics.json` plus three figures, including the
ripeness-only and fruit-only confusion matrices. Report those separately:
confusing `pear__ripe` with `pear__overripe` is a different failure from
confusing a pear with a lemon, and one 24×24 matrix hides that.

**Augmentation warning.** `hsv_h` is set to 0.010, near zero, on purpose. Hue *is*
the ripeness signal; the usual 0.015–0.03 hue jitter teaches the network to ignore
exactly the cue the task depends on.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` · `/login` · `/logout` | accounts, JWT |
| POST | `/api/auth/change-password` | password change |
| POST | `/api/detect` | image → detections + annotated image |
| GET | `/api/detect/history` · `/:id` · `/stats` · `/classes` | past scans, basket statistics, taxonomy |
| GET | `/api/chat/:scanId` | the conversation attached to one scan |
| POST | `/api/chat` | grounded question answering |
| GET | `/advice` (ML service) | language-aware guidance for one fruit/stage pair |
| POST | `/api/feedback` | free text or a stage correction |
| GET | `/api/admin/metrics` · `/feedback` · `/users` · `/retraining-set` | admin |

Full request/response examples: `docs/API.md`.

## Testing

```bash
cd ml-service && python -m pytest tests -q   # 23 tests: colour refiner + the whole Flask API
cd backend    && npm test                    # 9 tests: auth, JWT, grounded fallback
```

The Flask tests inject a stub model (`tests/stub_model.py`), so the full request
path — routing, refinement, knowledge base, annotation, Arabic labels, error
handling — is covered without torch, a GPU or a checkpoint.

## Limitations

* Ripeness is judged from the **surface** only. Internal bruising, and fruit that
  ripens invisibly (a pear ripens from the core outwards), are outside what a
  photograph can show.
* Coloured or tinted lighting shifts the hue statistics. The app asks for even
  lighting; a white-balance normalisation step is the obvious next addition.
* Shelf-life figures are typical values for household storage, not a food-safety
  guarantee. Visible mould overrides any number the app prints.
* Blueberries are scored per punnet, not per berry — a punnet is called overripe
  when a meaningful share of berries is.

## Licence

MIT — see [LICENSE](LICENSE).
