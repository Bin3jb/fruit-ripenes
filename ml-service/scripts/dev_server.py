"""
Development server: runs the full Flask API with a synthetic detector.

Why this exists: the web tier (auth, uploads, chat, history, the Arabic UI) has
to be built and demonstrated before the detector has finished training, and
installing torch just to click through the interface is a waste. This boots the
real application — real routes, real knowledge base, real annotated images — with
a stub that reports one plausible detection per image.

    python scripts/dev_server.py            # http://localhost:5001
    python scripts/dev_server.py --stage overripe --fruit pear

Never use it for anything you will quote a number from.
"""

import argparse
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config                                    # noqa: E402
import app as flask_app                          # noqa: E402
from utils.detector import RipenessDetector      # noqa: E402
from tests.stub_model import StubYOLO            # noqa: E402


class DemoModel(StubYOLO):
    """Reports one centred box whose class is fixed, or random per request."""

    def __init__(self, names, fruit=None, stage=None):
        super().__init__(names)
        self.fruit, self.stage = fruit, stage

    def predict(self, image, **kwargs):
        h, w = image.shape[:2]
        fruit = self.fruit or random.choice(config.FRUITS)
        stage = self.stage or random.choice(config.STAGES)
        self.rows = [{
            "box": [w * 0.18, h * 0.18, w * 0.82, h * 0.82],
            "conf": round(random.uniform(0.62, 0.94), 3),
            "cls": config.CLASS_TO_ID[f"{fruit}__{stage}"],
        }]
        return super().predict(image, **kwargs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fruit", choices=config.FRUITS, default=None)
    ap.add_argument("--stage", choices=config.STAGES, default=None)
    ap.add_argument("--port", type=int, default=int(os.getenv("PORT", "5001")))
    args = ap.parse_args()

    names = {i: n for i, n in enumerate(config.CLASSES)}
    flask_app.set_detector(RipenessDetector(
        weights="dev-stub", model=DemoModel(names, args.fruit, args.stage)))

    os.makedirs(config.ANNOTATED_DIR, exist_ok=True)
    print(f"[dev] synthetic detector on http://localhost:{args.port} "
          f"(fruit={args.fruit or 'random'}, stage={args.stage or 'random'})")
    flask_app.app.run(host="0.0.0.0", port=args.port, debug=False)


if __name__ == "__main__":
    main()
