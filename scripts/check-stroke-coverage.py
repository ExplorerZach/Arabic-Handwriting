#!/usr/bin/env python3
"""
Stroke-reveal ink-coverage gate for `src/data/strokeOrder.js`.

Renders each glyph with the shipped Amiri font, then sweeps the same mask the
Show Me animation paints (round-capped segments at BRUSH_RADIUS plus filled-circle
dot reveals at DOT_RADIUS, both 0.2 * max(rendered width/height)) and reports the
% of ink pixels covered. This is the authoritative regression gate for the
hand-authored stroke paths added under ROADMAP #15.

This *cannot* be a Vitest — jsdom has no rasterizer for canvas 2D text. The
rasterization must happen against a real font, which is why the gate is a
Python script run outside `npm test`. It is documented here and wired as
`npm run test:stroke-coverage` so it's discoverable.

Usage:
    python scripts/check-stroke-coverage.py [--target 95] [--data PATH] [--font PATH]

Options:
    --target  passing coverage threshold (default 95)
    --data    strokeOrder.js path (default src/data/strokeOrder.js)
    --font    TrueType font path (default: dist font — converts from
              public/fonts/amiri-400-arabic.woff2 via fonttools when the cached
              .ttf is absent)

Requirements: Python 3.11+, Pillow, numpy, fonttools. Interpreted with the system
Store Python on Windows dev hosts (the only interpreter with all three deps).
Note: only unquoted letter keys are gated. Numerals/diacritics (quoted keys) are
validated by the animation's runtime rendering, not this gate — see
docs/architecture.md §Stroke animation.
Exit 0 if every gated letter covers >= target, exit 1 otherwise.
"""
import argparse
import math
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA = ROOT / "src" / "data" / "strokeOrder.js"
DEFAULT_WOFF2 = ROOT / "public" / "fonts" / "amiri-400-arabic.woff2"
CACHED_TTF = Path.home() / "AppData" / "Local" / "Temp" / "amiri-400-arabic.ttf"

W = H = 400
GLYPH_PX = 200
ALPHA = 16  # must match the app's ink-detection threshold


def ensure_ttf() -> Path:
    if CACHED_TTF.exists():
        return CACHED_TTF
    from fontTools.ttLib import TTFont

    font = TTFont(str(DEFAULT_WOFF2))
    font.flavor = None
    font.save(str(CACHED_TTF))
    return CACHED_TTF


def _parse_block(body: str):
    """Parse a single `{ strokes: [...], dots: [...] }` block."""
    # rsplit: entry comments legitimately contain the literal "dots:".
    stroke_part, dot_part = body.rsplit("dots:", 1)
    strokes = [
        [(float(x), float(y)) for x, y in
         re.findall(r"\{ x: ([\d.]+), y: ([\d.]+)[^}]*\}", arr)]
        for arr in re.findall(r"\[([^\[\]]+)\]", stroke_part)
        if "x" in arr
    ]
    dots = [(float(x), float(y)) for x, y in
            re.findall(r"\{ x: ([\d.]+), y: ([\d.]+)[^}]*\}", dot_part)]
    return strokes, dots


def parse_stroke_data(path: Path):
    """Parse nested per-letter form data → { (letter, form): (strokes, dots) }.

    The file nests each letter as `{ isolated, initial?, medial?, final? }`.
    Only unquoted letter keys are gated. Numerals/diacritics (quoted keys) are
    validated by the animation's runtime rendering, not this gate.
    """
    text = path.read_text(encoding="utf-8")
    data = {}
    for m in re.finditer(r"^  ([^'\":\s]{1,3}): \{(.*?)\n  \},", text, re.M | re.S):
        ch = m.group(1)
        body = m.group(2)
        # Strip leading comments (entry-level doc comments precede `isolated:`)
        # so the nested-form check sees the first form key.
        body_stripped = re.sub(r"^\s*//.*$", "", body, flags=re.M).lstrip()
        nested = body_stripped.startswith(("isolated:", "initial:", "medial:", "final:"))
        if nested:
            for fm in re.finditer(
                r"(isolated|initial|medial|final): \{(.*?)\n    \},", body, re.S
            ):
                form, fbody = fm.group(1), fm.group(2)
                data[(ch, form)] = _parse_block(fbody)
        else:  # legacy flat single-form entry
            data[(ch, "isolated")] = _parse_block(body)
    return data


TATWEEL = "ـ"
FORM_TEXT = {
    "isolated": lambda ch: ch,                 # ch
    "initial": lambda ch: ch + TATWEEL,        # ch+ـ
    "medial": lambda ch: TATWEEL + ch + TATWEEL,  # ـchـ
    "final": lambda ch: TATWEEL + ch,          # ـch
}


def coverage_for(ch, form, strokes, dots, font) -> float:
    img = Image.new("L", (W, H), 0)
    # Render the exact string the app draws for the form (see PracticeView's
    # letter.forms) so the measured shape matches runtime.
    ImageDraw.Draw(img).text(
        (W / 2, H / 2), FORM_TEXT[form](ch), font=font, fill=255, anchor="mm"
    )
    alpha = np.array(img)
    ys, xs = np.where(alpha > ALPHA)
    if xs.size == 0:
        return 0.0
    minX, maxX, minY, maxY = xs.min(), xs.max(), ys.min(), ys.max()
    rw, rh = maxX - minX, maxY - minY
    M = max(rw, rh)

    def map_x(x):
        return minX + x / 100.0 * rw

    def map_y(y):
        return minY + y / 100.0 * rh

    brush_r = M * 0.20
    dot_r = brush_r  # DOT_RADIUS == BRUSH_RADIUS in shipped useAnimation.js

    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    for poly in strokes:
        pts = [(map_x(x), map_y(y)) for (x, y) in poly]
        if len(pts) >= 2:
            md.line(pts, fill=255, width=max(1, int(brush_r * 2)))
        if len(pts) == 1:
            x, y = pts[0]
            md.ellipse([x - brush_r, y - brush_r, x + brush_r, y + brush_r], fill=255)
        # Interpolate sparse authored points so the mask is a continuous tube.
        for a, b in zip(pts, pts[1:]):
            seg = math.hypot(b[0] - a[0], b[1] - a[1])
            n = max(2, int(seg / max(1.0, brush_r * 0.5)))
            for i in range(n + 1):
                x = a[0] + (b[0] - a[0]) * i / n
                y = a[1] + (b[1] - a[1]) * i / n
                md.ellipse([x - brush_r, y - brush_r, x + brush_r, y + brush_r], fill=255)
    for dx, dy in dots:
        x, y = map_x(dx), map_y(dy)
        md.ellipse([x - dot_r, y - dot_r, x + dot_r, y + dot_r], fill=255)

    ink = alpha > ALPHA
    covered = ink & (np.array(mask) > 127)
    total = int(ink.sum())
    return 100.0 * int(covered.sum()) / total if total else 0.0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--target", type=float, default=95.0)
    ap.add_argument("--data", type=Path, default=DEFAULT_DATA)
    ap.add_argument("--font", type=Path, default=None)
    args = ap.parse_args()

    ttf = args.font if args.font else ensure_ttf()
    font = ImageFont.truetype(str(ttf), GLYPH_PX)
    data = parse_stroke_data(args.data)
    if not data:
        print(f"no letter entries found in {args.data}", file=sys.stderr)
        return 2

    rows = sorted(
        (coverage_for(ch, form, s, d, font), ch, form)
        for (ch, form), (s, d) in data.items()
    )
    failing = 0
    for cov, ch, form in rows:
        mark = "" if cov >= args.target else "  <-- FAIL"
        if cov < args.target:
            failing += 1
        label = ch if form == "isolated" else f"{ch} [{form}]"
        print(f"{cov:7.1f}%  {label}{mark}", flush=True)
    print(
        f"\n{failing} / {len(rows)} letter-forms below {args.target:.0f}% coverage"
    )
    return 0 if failing == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
