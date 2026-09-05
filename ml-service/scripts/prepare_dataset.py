"""
Dataset preparation for the ripeness taxonomy.

Expected input layout (one folder per composite class, images only):

    raw/
      banana__unripe/*.jpg
      banana__ripe/*.jpg
      ...

If you annotated in Roboflow/CVAT and already have YOLO .txt labels, point
--labels at them and the script only performs the split + data.yaml write.

Outputs the standard Ultralytics layout:

    dataset/
      images/{train,val,test}/...
      labels/{train,val,test}/...
      data.yaml

Usage
-----
python scripts/prepare_dataset.py --raw raw --out dataset --split 0.7 0.2 0.1
"""

import argparse
import os
import random
import shutil
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402

IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def collect(raw_dir):
    items = []
    for cls in sorted(os.listdir(raw_dir)):
        folder = os.path.join(raw_dir, cls)
        if not os.path.isdir(folder):
            continue
        if cls not in config.CLASS_TO_ID:
            print(f"  ! skipping unknown class folder '{cls}'")
            continue
        for f in sorted(os.listdir(folder)):
            if os.path.splitext(f)[1].lower() in IMG_EXT:
                items.append((os.path.join(folder, f), cls))
    return items


def stratified_split(items, ratios, seed=42):
    """Split per class so every stage appears in every subset."""
    random.seed(seed)
    by_class = {}
    for path, cls in items:
        by_class.setdefault(cls, []).append(path)

    out = {"train": [], "val": [], "test": []}
    for cls, paths in by_class.items():
        random.shuffle(paths)
        n = len(paths)
        n_tr = int(n * ratios[0])
        n_va = int(n * ratios[1])
        out["train"] += [(p, cls) for p in paths[:n_tr]]
        out["val"] += [(p, cls) for p in paths[n_tr:n_tr + n_va]]
        out["test"] += [(p, cls) for p in paths[n_tr + n_va:]]
    return out


def write_split(split_items, out_dir, subset, labels_dir):
    img_dir = os.path.join(out_dir, "images", subset)
    lbl_dir = os.path.join(out_dir, "labels", subset)
    os.makedirs(img_dir, exist_ok=True)
    os.makedirs(lbl_dir, exist_ok=True)

    missing = 0
    for src, cls in split_items:
        stem = os.path.splitext(os.path.basename(src))[0]
        dst_name = f"{cls}__{stem}"
        shutil.copy2(src, os.path.join(img_dir, dst_name + os.path.splitext(src)[1]))

        label_src = None
        if labels_dir:
            cand = os.path.join(labels_dir, cls, stem + ".txt")
            if os.path.exists(cand):
                label_src = cand
        if label_src:
            # Rewrite the class id so it matches config.CLASSES ordering.
            cid = config.CLASS_TO_ID[cls]
            lines = []
            for line in open(label_src):
                parts = line.split()
                if len(parts) >= 5:
                    lines.append(" ".join([str(cid)] + parts[1:]))
            open(os.path.join(lbl_dir, dst_name + ".txt"), "w").write("\n".join(lines))
        else:
            # Single centred object covering most of the frame: a usable
            # bootstrap label for classification-style folders. Replace with
            # real annotations before reporting final numbers.
            cid = config.CLASS_TO_ID[cls]
            open(os.path.join(lbl_dir, dst_name + ".txt"), "w").write(
                f"{cid} 0.5 0.5 0.85 0.85\n")
            missing += 1
    return missing


def write_yaml(out_dir):
    path = os.path.join(out_dir, "data.yaml")
    with open(path, "w") as fh:
        fh.write(f"path: {os.path.abspath(out_dir)}\n")
        fh.write("train: images/train\nval: images/val\ntest: images/test\n\n")
        fh.write(f"nc: {config.NUM_CLASSES}\nnames:\n")
        for i, name in enumerate(config.CLASSES):
            fh.write(f"  {i}: {name}\n")
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--out", default="dataset")
    ap.add_argument("--labels", default=None, help="folder of YOLO .txt labels mirroring --raw")
    ap.add_argument("--split", nargs=3, type=float, default=[0.7, 0.2, 0.1])
    args = ap.parse_args()

    items = collect(args.raw)
    if not items:
        raise SystemExit("no images found - check --raw")
    print(f"found {len(items)} images across {len(set(c for _, c in items))} classes")

    splits = stratified_split(items, args.split)
    total_missing = 0
    for subset, data in splits.items():
        miss = write_split(data, args.out, subset, args.labels)
        total_missing += miss
        counts = Counter(c for _, c in data)
        print(f"  {subset:5s} {len(data):5d} images  ({len(counts)} classes)")

    yaml_path = write_yaml(args.out)
    print(f"wrote {yaml_path}")
    if total_missing:
        print(f"\n!! {total_missing} images got a bootstrap full-frame box. "
              f"Annotate them properly before quoting mAP in the report.")


if __name__ == "__main__":
    main()
