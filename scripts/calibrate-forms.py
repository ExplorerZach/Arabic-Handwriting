#!/usr/bin/env python3
"""Positional-form calibration table generator (ROADMAP #15 Part 2, step B2).

Renders the exact runtime strings the app draws for each positional form
(isolated / initial / medial / final) with the shipped Amiri font, in the SAME
400x400 / 200px / anchor="mm" frame the coverage gate uses, then emits a
per-form ink-run calibration table the path author can trace:

  * for a set of sample y-rows: the [startX, endX] ink runs (0-100 authoring space)
  * for a set of sample x-cols: the [startY, endY] ink runs
  * connected-component dot centroids (small blobs), in 0-100 space

Coordinates are normalized to the glyph's ink bbox exactly as the app maps them:
  mapX(x) = minX + x/100 * renderedW   (and the y analogue)

Usage (Store Python — the only interpreter w/ Pillow+numpy+fonttools+scipy):
    python scripts/calibrate-forms.py ب
    python scripts/calibrate-forms.py --list
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

CACHED_TTF = Path.home() / "AppData" / "Local" / "Temp" / "amiri-400-arabic.ttf"
W = H = 400
GLYPH_PX = 200
ALPHA = 16
TATWEEL = "ـ"

FORM_TEXT = {
    "isolated": lambda ch: ch,
    "initial": lambda ch: ch + TATWEEL,
    "medial": lambda ch: TATWEEL + ch + TATWEEL,
    "final": lambda ch: TATWEEL + ch,
}


def ink_mask(ch, form, font):
    img = Image.new("L", (W, H), 0)
    ImageDraw.Draw(img).text(
        (W / 2, H / 2), FORM_TEXT[form](ch), font=font, fill=255, anchor="mm"
    )
    alpha = np.array(img)
    ys, xs = np.where(alpha > ALPHA)
    if xs.size == 0:
        raise SystemExit(f"no ink for {ch} form={form}")
    minX, maxX, minY, maxY = xs.min(), xs.max(), ys.min(), ys.max()
    return alpha > ALPHA, minX, maxX, minY, maxY


def runs_1d(row_bool):
    """Return [start, end] inclusive runs of True in a 1D bool array."""
    idx = np.where(row_bool)[0]
    if idx.size == 0:
        return []
    splits = np.where(np.diff(idx) > 1)[0] + 1
    groups = np.split(idx, splits)
    return [(int(g[0]), int(g[-1])) for g in groups]


def n(v, lo, size):
    """pixel -> 0-100 authoring coord, clamped."""
    return round(100.0 * (v - lo) / size, 1)


def fmt_runs(rs):
    return [(float(a), float(b)) for a, b in rs]


def report(ch, form, font):
    ink, minX, maxX, minY, maxY = ink_mask(ch, form, font)
    rw = maxX - minX or 1
    rh = maxY - minY or 1
    print(f"\n=== {ch}  form={form}  bbox w={rw} h={rh}  (aspect {rw / rh:.2f}) ===")

    # Ink runs at sample rows (y in authoring space 0..100)
    print(" rows (y -> x-runs):")
    for ay in range(5, 100, 10):
        py = int(minY + ay / 100.0 * rh)
        rs = runs_1d(ink[py, :])
        rs = fmt_runs([(n(a, minX, rw), n(b, minX, rw)) for a, b in rs])
        if rs:
            print(f"  y={ay:3d}  x-runs={rs}")

    print(" cols (x -> y-runs):")
    for ax in range(5, 100, 10):
        px = int(minX + ax / 100.0 * rw)
        rs = runs_1d(ink[:, px])
        rs = fmt_runs([(n(a, minY, rh), n(b, minY, rh)) for a, b in rs])
        if rs:
            print(f"  x={ax:3d}  y-runs={rs}")

    # Connected-component analysis: list blobs. Small blobs = dots.
    lab, ncomp = ndimage.label(ink)
    total = int(ink.sum())
    print(f" components={ncomp}  total_ink={total}px")
    for cid in range(1, ncomp + 1):
        ys, xs = np.where(lab == cid)
        area = int(xs.size)
        cx = n(float(xs.mean()), minX, rw)
        cy = n(float(ys.mean()), minY, rh)
        bw = n(float(xs.max() - xs.min()), 0, rw)
        bh = n(float(ys.max() - ys.min()), 0, rh)
        frac = 100.0 * area / total
        kind = "DOT?" if frac < 8.0 else "body"
        print(
            f"    comp{cid}: centroid=({cx},{cy})  size=({bw}x{bh})  "
            f"area={area} ({frac:.1f}%)  {kind}"
        )


def main():
    font = ImageFont.truetype(str(CACHED_TTF), GLYPH_PX)
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    forms = ["isolated", "initial", "medial", "final"]
    if "--list" in sys.argv or not args:
        chs = list("بتثنيجحخسشصضطظعغفقلمهي")
    else:
        chs = args
    for ch in chs:
        for form in forms:
            report(ch, form, font)


if __name__ == "__main__":
    main()
