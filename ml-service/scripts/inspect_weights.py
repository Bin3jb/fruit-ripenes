"""
Report what is actually inside a .pt checkpoint — before you build on it.

    python scripts/inspect_weights.py models/yolov8l.pt

Prints the class names, how many there are, and which mode the service will run
in with those weights (trained ripeness model vs COCO fallback). Reads the
checkpoint's pickle directly, so it works without torch installed.
"""

import argparse
import io
import pickletools
import sys
import zipfile


def class_names(path):
    """
    Extract the checkpoint's `names` mapping without unpickling it.

    `pickletools.genops` walks the pickle opcode stream without executing any of
    it, so an untrusted .pt file cannot run code here. We find the string
    "names", then read the (int, str) pairs of the dict that follows.
    """
    with zipfile.ZipFile(path) as z:
        pkl = next(n for n in z.namelist() if n.endswith("data.pkl"))
        raw = z.read(pkl)

    ops = [(op.name, arg) for op, arg, _ in pickletools.genops(io.BytesIO(raw))]

    try:
        i = next(k for k, (_, arg) in enumerate(ops) if arg == "names")
    except StopIteration:
        return []

    names, pending = {}, None
    for name, arg in ops[i + 1:]:
        if name in ("SETITEMS", "SETITEM"):
            break
        if name.startswith("BININT") or name == "LONG1":
            pending = arg
        elif name in ("BINUNICODE", "SHORT_BINUNICODE") and pending is not None:
            names[pending] = arg
            pending = None
    return [names[k] for k in sorted(names)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("weights")
    args = ap.parse_args()

    try:
        names = class_names(args.weights)
    except (zipfile.BadZipFile, StopIteration):
        print("not a PyTorch zip checkpoint")
        return 1

    if not names:
        print("could not read class names from this checkpoint")
        return 1

    ripeness = [n for n in names if "__" in n]
    print(f"file      : {args.weights}")
    print(f"classes   : {len(names)}")
    print(f"first ten : {', '.join(names[:10])}")
    if ripeness:
        print("mode      : ripeness — trained on <fruit>__<stage> classes")
    else:
        coco = [n for n in names if n in ("banana", "apple", "orange")]
        print("mode      : COCO fallback — stock Ultralytics weights")
        print(f"            usable fruit classes present: {coco or 'none'}")
        print("            fine-tune with scripts/train.py before quoting results")
    return 0


if __name__ == "__main__":
    sys.exit(main())
