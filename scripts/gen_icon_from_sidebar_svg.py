#!/usr/bin/env python3
"""
Genera icon-master.png 1024×1024 usando i path esatti di lucide-react
GraduationCap (v0.574.0) con il colore primario reale dell'app: #8070d0 (viola).

Paths lucide GraduationCap (viewBox 0 0 24):
  path1: "M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"
  path2: "M22 10v6"
  path3: "M6 12.5V16a6 3 0 0 0 12 0v-3.5"

Disegno con svgpathtools + Pillow.
Poi lancia generate-icons.py.
"""

import subprocess, sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
    from svgpathtools import parse_path
except ImportError as e:
    print(f"❌ Dipendenza mancante: {e}")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
OUT  = ROOT / "assets" / "icon-master.png"
SIZE    = 1024
ICON_PX = 640
OX      = (SIZE - ICON_PX) // 2
OY      = (SIZE - ICON_PX) // 2
SCALE   = ICON_PX / 24.0

PRIMARY_RGB = (128, 112, 208)   # #8070d0 — var(--primary) reale dell'app
WHITE_RGB   = (255, 255, 255)
BG_RGB      = (8, 9, 15)        # #08090f
SW          = max(3, round(SCALE * 1.8))


def to_px(c: complex) -> tuple:
    return (OX + c.real * SCALE, OY + c.imag * SCALE)


def sample_path(d: str, n: int = 400) -> list:
    path = parse_path(d)
    total = path.length()
    pts = []
    for i in range(n + 1):
        pt = path.point(path.ilength(total * i / n))
        pts.append(to_px(pt))
    return pts


def draw_stroke(draw, pts, color, width):
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i+1]], fill=color, width=width)
    for p in [pts[0], pts[-1]]:
        r = width // 2
        draw.ellipse([p[0]-r, p[1]-r, p[0]+r, p[1]+r], fill=color)


# ─── Canvas ───────────────────────────────────────────────────────────────────
canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
bg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
bg_draw = ImageDraw.Draw(bg)
bg_draw.rounded_rectangle([(0,0),(SIZE-1,SIZE-1)], radius=int(SIZE*0.22), fill=(*BG_RGB, 255))
canvas = Image.alpha_composite(canvas, bg)
draw = ImageDraw.Draw(canvas)

print("📐  Campionamento path lucide GraduationCap (v0.574.0)…")

# ─── PATH 1 — forma chiusa cappello (fill + stroke PRIMARY) ──────────────────
d1 = "M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"
pts1 = sample_path(d1, 500)
flat1 = [(x, y) for x, y in pts1]
draw.polygon(flat1, fill=(*PRIMARY_RGB, 255), outline=(*PRIMARY_RGB, 255))

# ─── PATH 2 — asta verticale destra (stroke PRIMARY) ─────────────────────────
draw_stroke(draw, [to_px(22+10j), to_px(22+16j)], (*PRIMARY_RGB, 255), SW)

# ─── PATH 3 — base arrotondata ellisse (stroke WHITE) ────────────────────────
d3 = "M6 12.5V16a6 3 0 0 0 12 0v-3.5"
pts3 = sample_path(d3, 400)
draw_stroke(draw, pts3, (*WHITE_RGB, 255), SW)

# ─── Salva ────────────────────────────────────────────────────────────────────
canvas.save(OUT, "PNG")
print(f"✅  Salvato: {OUT}")

gen = ROOT / "scripts" / "generate-icons.py"
print("\n🔧  Avvio generate-icons.py…")
result = subprocess.run([sys.executable, str(gen)], cwd=str(ROOT))
sys.exit(result.returncode)
