# Weights

Two files belong here. Neither is committed — both are large binaries.

| File | What it is | Where it comes from |
|---|---|---|
| `yolov8l.pt` | COCO-pretrained YOLOv8-Large, 80 classes, ~87 MB | Ultralytics release, or the copy you already have |
| `best.pt` | your fine-tuned ripeness detector, 24 classes | written by `scripts/train.py` |

Check what any checkpoint actually contains before building on it:

```bash
python scripts/inspect_weights.py models/yolov8l.pt
# classes   : 80
# first ten : person, bicycle, car, motorcycle, airplane, bus, train, truck, boat, traffic light
# mode      : COCO fallback — stock Ultralytics weights
```

**The service runs in whichever mode the weights imply.** With `best.pt` present
it uses fruit *and* stage from the network. With only `yolov8l.pt` it runs in
COCO fallback: COCO knows `banana`, `apple` and `orange`, so the fruit comes from
the network and the stage comes entirely from the colour cues. Every detection in
that mode is marked `"stage_source": "colour-only"` — useful for building and
demoing the application, not for quoting accuracy.

Fine-tune from the large model:

```bash
python scripts/train.py --data dataset/data.yaml --model models/yolov8l.pt --epochs 120
```

YOLOv8-L is ~43.7M parameters. It is the right choice if you have a GPU and the
transitions matter more than latency; `yolov8s.pt` (~11M) is roughly four times
faster on CPU if the demo has to run on a laptop. Train both and report the
trade-off — that comparison is worth a paragraph in the write-up.
