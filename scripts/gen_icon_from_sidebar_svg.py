#!/usr/bin/env python3
"""
Genera icon-master.png 1024×1024 dal SVG ESATTO della sidebar.

Copia-incolla dei path SVG dalla sidebar di StudyPlan:

  <path d="M22 10v6M2 10l10-5 10 5-10 5z" fill="#8070d0" stroke="#8070d0" stroke-width="2"/>
  <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" fill="none" stroke="white" stroke-width="2"/>

Usa svgpathtools + Pillow.
Poi lancia generate-icons.py.
"""

import subprocess, sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
    from svgpathtools import parse_path
except ImportError as e:
    print(f"❌ Dipendenza mancante: {e}")
    print("   pip3 install Pillow svgpathtools")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
OUT  = ROOT / "assets" / "icon-master.png"
SIZE    = 1024
ICON_PX = 640
OX      = (SIZE - ICON_PX) // 2
OY      = (SIZE - ICON_PX) // 2
SCALE   = ICON_PX / 24.0

PRIMARY_RGB = (128, 112, 208)   # #8070d0 — var(--primary)
WHITE_RGB   = (255, 255, 255)
BG_RGB      = (8, 9, 15)        # #08090f
SW          = max(3, round(SCALE * 2.0))


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

print("📐  Rendering SVG esatto dalla sidebar…")

# ═══ COPIA-INCOLLA ESATTO dalla sidebar ═══
# <path d="M22 10v6M2 10l10-5 10 5-10 5z" fill="#8070d0" stroke="#8070d0" stroke-width="2"/>
# <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" fill="none" stroke="white" stroke-width="2"/>

# ─── PATH 1a — "M22 10v6" → asta verticale destra (stroke PRIMARY) ───────────
pts_vert = [to_px(22+10j), to_px(22+16j)]
draw_stroke(draw, pts_vert, (*PRIMARY_RGB, 255), SW)

# ─── PATH 1b — "M2 10l10-5 10 5-10 5z" → diamante cappello (fill + stroke PRIMARY) ──
d_diamond = "M2 10l10-5 10 5-10 5z"
pts_diamond = sample_path(d_diamond, 500)
flat_diamond = [(x, y) for x, y in pts_diamond]
draw.polygon(flat_diamond, fill=(*PRIMARY_RGB, 255), outline=(*PRIMARY_RGB, 255))
draw_stroke(draw, pts_diamond, (*PRIMARY_RGB, 255), SW)

# ─── PATH 2 — "M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" → base arrotondata (stroke WHITE) ──
d_base = "M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"
pts_base = sample_path(d_base, 400)
draw_stroke(draw, pts_base, (*WHITE_RGB, 255), SW)

# ─── Salva ────────────────────────────────────────────────────────────────────
canvas.save(OUT, "PNG")
print(f"✅  icon-master.png salvato: {OUT}")

gen = ROOT / "scripts" / "generate-icons.py"
print("\n🔧  Avvio generate-icons.py…")
result = subprocess.run([sys.executable, str(gen)], cwd=str(ROOT))
sys.exit(result.returncode)
