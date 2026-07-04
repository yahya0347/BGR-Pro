#!/usr/bin/env python3
"""Build pdf-hub-images/<slug>.jpg from the raw "PDF -HUB-Images/" source set.

Two things happen here, both baked into the file (not done via CSS):
  1. Resize down to a sane hero-image width (raw PNGs are ~5.6MB/2752px each;
     this makes ~45KB/1500px JPGs).
  2. Crop off the bottom 16% of each image. Every image has a small Gemini
     watermark stamped at a fixed spot (measured via template matching to be
     at roughly x:89-93%, y:80-87% of the source canvas on every file), so
     trimming the bottom clears it with margin. Cropping ONLY the bottom
     (not also the right side) matters: it keeps the composition symmetric
     left-to-right, so the plain `object-fit: cover; object-position: center`
     CSS in generate-pdf-pages.mjs lands the subject centered in the 16:9
     card instead of pulled toward one corner.

Run: python3 scripts/optimize-hero-images.py
Requires: pillow (pip install pillow)
"""

import glob
import os

from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
SRC = os.path.join(ROOT, "PDF -HUB-Images")
OUT = os.path.join(ROOT, "pdf-hub-images")

NAME_MAP = {
    1: "jpg-to-pdf", 2: "pdf-to-jpg", 3: "merge", 4: "split", 5: "compress", 6: "rotate",
    7: "delete-pages", 8: "reorder", 9: "extract-pages", 10: "page-numbers", 11: "crop",
    12: "png-to-pdf", 13: "word-to-pdf", 14: "ppt-to-pdf", 15: "excel-to-pdf", 16: "html-to-pdf",
    17: "text-to-pdf", 18: "pdf-to-word", 19: "pdf-to-ppt", 20: "pdf-to-excel", 21: "pdf-to-text",
    22: "pdf-to-png", 23: "pdf-to-html", 24: "protect", 25: "unlock", 26: "esign", 27: "watermark",
    28: "redact", 29: "flatten", 30: "repair",
}

BOTTOM_TRIM = 0.16  # fraction of height to remove from the bottom
TARGET_WIDTH = 1500
JPEG_QUALITY = 82


def main():
    if not os.path.isdir(SRC):
        raise SystemExit(f"Source folder not found: {SRC}")
    os.makedirs(OUT, exist_ok=True)

    count = 0
    for path in sorted(glob.glob(os.path.join(SRC, "*.png"))):
        base = os.path.basename(path)
        num = int(base.split(".")[0].strip())
        slug = NAME_MAP[num]

        im = Image.open(path).convert("RGB")
        w, h = im.size
        keep_h = int(h * (1 - BOTTOM_TRIM))
        cropped = im.crop((0, 0, w, keep_h))

        new_h = int(cropped.height * TARGET_WIDTH / cropped.width)
        resized = cropped.resize((TARGET_WIDTH, new_h), Image.LANCZOS)

        out_path = os.path.join(OUT, f"{slug}.jpg")
        resized.save(out_path, "JPEG", quality=JPEG_QUALITY, optimize=True)
        count += 1

    print(f"Wrote {count} images to {OUT}/ (bottom {int(BOTTOM_TRIM * 100)}% trimmed, {TARGET_WIDTH}px wide)")


if __name__ == "__main__":
    main()
