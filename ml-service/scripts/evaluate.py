"""
Evaluate the trained detector and produce the figures used in the poster.

    python scripts/evaluate.py --weights models/best.pt --data dataset/data.yaml

Writes to reports/:
  metrics.json            mAP@0.5, mAP@0.5:0.95, per-class AP
  stage_confusion.png     3x3 ripeness confusion matrix (stage only)
  fruit_confusion.png     8x8 fruit-identity confusion matrix
  per_class_ap.png        per composite class AP bar chart

Separating the two confusion matrices matters for the write-up: confusing
`pear__ripe` with `pear__overripe` is a very different failure from confusing
a pear with a lemon, and a single 24x24 matrix hides that distinction.
"""

import argparse
import json
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402

OUT = "reports"


def heatmap(matrix, labels, title, path, cmap="Blues"):
    fig, ax = plt.subplots(figsize=(1 + 0.8 * len(labels), 1 + 0.7 * len(labels)))
    im = ax.imshow(matrix, cmap=cmap)
    ax.set_xticks(range(len(labels)), labels, rotation=45, ha="right")
    ax.set_yticks(range(len(labels)), labels)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(title)
    vmax = matrix.max() if matrix.max() else 1
    for i in range(len(labels)):
        for j in range(len(labels)):
            ax.text(j, i, f"{matrix[i, j]:.0f}", ha="center", va="center",
                    color="white" if matrix[i, j] > vmax * 0.6 else "black", fontsize=9)
    fig.colorbar(im, ax=ax, shrink=0.8)
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def main():
    from ultralytics import YOLO

    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", default="models/best.pt")
    ap.add_argument("--data", default="dataset/data.yaml")
    ap.add_argument("--split", default="test")
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    model = YOLO(args.weights)
    m = model.val(data=args.data, split=args.split, plots=True)

    names = [config.CLASSES[i] if i < len(config.CLASSES) else str(i)
             for i in range(len(m.box.maps))]
    per_class = {n: float(v) for n, v in zip(names, m.box.maps)}

    metrics = {
        "mAP50": float(m.box.map50),
        "mAP50_95": float(m.box.map),
        "precision": float(m.box.mp),
        "recall": float(m.box.mr),
        "per_class_mAP50_95": per_class,
    }

    # Collapse the 24x24 Ultralytics confusion matrix into the two views.
    cm = m.confusion_matrix.matrix  # (nc+1, nc+1), background is the last row/col
    nc = len(config.CLASSES)
    stage_cm = np.zeros((3, 3))
    fruit_cm = np.zeros((len(config.FRUITS), len(config.FRUITS)))
    for t in range(min(nc, cm.shape[0])):
        for p in range(min(nc, cm.shape[1])):
            tf, ts = config.split_class(config.CLASSES[t])
            pf, ps = config.split_class(config.CLASSES[p])
            stage_cm[config.STAGES.index(ts), config.STAGES.index(ps)] += cm[t, p]
            fruit_cm[config.FRUITS.index(tf), config.FRUITS.index(pf)] += cm[t, p]

    stage_acc = float(np.trace(stage_cm) / max(stage_cm.sum(), 1))
    fruit_acc = float(np.trace(fruit_cm) / max(fruit_cm.sum(), 1))
    metrics["stage_accuracy"] = stage_acc
    metrics["fruit_accuracy"] = fruit_acc

    heatmap(stage_cm, config.STAGES,
            f"Ripeness stage confusion (acc {stage_acc:.3f})",
            os.path.join(OUT, "stage_confusion.png"))
    heatmap(fruit_cm, config.FRUITS,
            f"Fruit identity confusion (acc {fruit_acc:.3f})",
            os.path.join(OUT, "fruit_confusion.png"), cmap="Greens")

    fig, ax = plt.subplots(figsize=(11, 6))
    keys = list(per_class.keys())
    ax.bar(range(len(keys)), [per_class[k] for k in keys], color="#4C7BE1")
    ax.set_xticks(range(len(keys)), keys, rotation=90, fontsize=7)
    ax.set_ylabel("AP@0.5:0.95")
    ax.set_title("Per-class average precision")
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, "per_class_ap.png"), dpi=160)
    plt.close(fig)

    with open(os.path.join(OUT, "metrics.json"), "w") as fh:
        json.dump(metrics, fh, indent=2)

    print(json.dumps({k: v for k, v in metrics.items() if k != "per_class_mAP50_95"}, indent=2))
    print(f"figures written to {OUT}/")


if __name__ == "__main__":
    main()
