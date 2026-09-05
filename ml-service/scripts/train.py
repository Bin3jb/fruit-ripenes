"""
Train the ripeness detector.

    python scripts/train.py --data dataset/data.yaml --model models/yolov8l.pt --epochs 120

Design notes
------------
* Augmentation is colour-conservative on purpose: hue is the main ripeness
  signal, so a wide `hsv_h` would teach the network to ignore exactly the cue
  we care about. Geometry and lighting are augmented freely instead.
* `cos_lr` + a long warm-up stabilises the 24-class head, which is more
  fine-grained than the 8-class detector this project started from.
* The default base is `models/yolov8l.pt` (COCO-pretrained, ~43.7M parameters).
  Pass `--model models/yolov8s.pt` for the small model if inference has to run
  on CPU; training both and reporting the accuracy/latency trade-off is cheap
  and makes the evaluation section stronger.
"""

import argparse
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402


def main():
    from ultralytics import YOLO

    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="dataset/data.yaml")
    ap.add_argument("--model", default=os.path.join(config.BASE_DIR, "models", "yolov8l.pt"),
                    help="base weights to fine-tune from (models/yolov8l.pt by default)")
    ap.add_argument("--epochs", type=int, default=120)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--imgsz", type=int, default=config.IMG_SIZE)
    ap.add_argument("--device", default="0")
    ap.add_argument("--name", default="ripeness_v1")
    ap.add_argument("--patience", type=int, default=25)
    args = ap.parse_args()

    model = YOLO(args.model)
    model.train(
        data=args.data,
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        device=args.device,
        name=args.name,
        patience=args.patience,
        optimizer="AdamW",
        lr0=0.001,
        cos_lr=True,
        warmup_epochs=5,
        # --- augmentation: preserve colour, vary everything else -----------
        hsv_h=0.010,   # almost no hue shift: hue *is* the ripeness signal
        hsv_s=0.500,
        hsv_v=0.350,
        degrees=15.0,
        translate=0.10,
        scale=0.45,
        fliplr=0.5,
        flipud=0.0,
        mosaic=1.0,
        close_mosaic=15,
        mixup=0.05,
        seed=42,
        plots=True,
    )

    weights = os.path.join("runs", "detect", args.name, "weights", "best.pt")
    if os.path.exists(weights):
        os.makedirs(os.path.join(config.BASE_DIR, "models"), exist_ok=True)
        target = os.path.join(config.BASE_DIR, "models", "best.pt")
        shutil.copy2(weights, target)
        print(f"copied best weights to {target}")


if __name__ == "__main__":
    main()
