#!/usr/bin/env python3
"""
StudyPlan — Genera icona 1024×1024 con supersampling 4× + tray trasparente
Design: cappello di laurea purpureo su sfondo scuro con bordo glass
Tray: graduation cap bianco su sfondo trasparente
"""

from PIL import Image, ImageDraw, ImageFilter
import math, os

# ── Supersampling 4× ──
SCALE = 4
SIZE = 1024 * SCALE  # 4096
CENTER = SIZE // 2

def generate_app_icon():
    """Genera l'icona app 4096×4096 poi downscale a 1024."""
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    primary = (128, 112, 208)     # #8070d0
    primary_dark = (96, 80, 184)  # #6050b8
    bg_color = (12, 13, 20)       # #0c0d14
    bg_outer = (8, 9, 15)         # #08090f

    # ── 1. Sfondo con rounded rect ──
    corner_radius = int(SIZE * 0.22)

    draw.rounded_rectangle(
        [0, 0, SIZE-1, SIZE-1],
        radius=corner_radius,
        fill=bg_outer
    )

    inner_margin = int(SIZE * 0.02)
    draw.rounded_rectangle(
        [inner_margin, inner_margin, SIZE-1-inner_margin, SIZE-1-inner_margin],
        radius=corner_radius - inner_margin,
        fill=bg_color
    )

    # ── 2. Glow effect ──
    glow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_radius = int(SIZE * 0.25)
    glow_draw.ellipse(
        [CENTER - glow_radius, CENTER - glow_radius - 20*SCALE,
         CENTER + glow_radius, CENTER + glow_radius - 20*SCALE],
        fill=(primary[0], primary[1], primary[2], 40)
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=80*SCALE))
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)

    # ── 3. Cappello di laurea ──
    scale = SIZE / 400
    cap_cy = CENTER - 30 * scale

    # Flat top (rombo)
    flat_top = [
        (CENTER, cap_cy - 70*scale),
        (CENTER + 160*scale, cap_cy + 5*scale),
        (CENTER, cap_cy + 55*scale),
        (CENTER - 160*scale, cap_cy + 5*scale),
    ]
    draw.polygon(flat_top, fill=primary)

    # Highlight
    highlight_top = [
        (CENTER, cap_cy - 70*scale),
        (CENTER + 160*scale, cap_cy + 5*scale),
        (CENTER + 10*scale, cap_cy - 10*scale),
        (CENTER - 80*scale, cap_cy - 30*scale),
    ]
    hl = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(hl).polygon(highlight_top, fill=(255, 255, 255, 25))
    img = Image.alpha_composite(img, hl)
    draw = ImageDraw.Draw(img)

    # Body (trapezio sotto il cappello)
    body_top = cap_cy + 55*scale
    body_bottom = cap_cy + 140*scale
    body_points = [
        (CENTER - 130*scale, body_top),
        (CENTER + 130*scale, body_top),
        (CENTER + 95*scale, body_bottom),
        (CENTER - 95*scale, body_bottom),
    ]
    draw.polygon(body_points, fill=primary_dark)

    # Arco inferiore
    arc_bbox = [
        CENTER - 95*scale, body_bottom - 25*scale,
        CENTER + 95*scale, body_bottom + 25*scale
    ]
    draw.arc(arc_bbox, 0, 180, fill=(255, 255, 255, 80), width=int(3*scale))

    # Nappa (tassel)
    tassel_sx = CENTER + 160*scale
    tassel_sy = cap_cy + 5*scale
    tassel_mx = CENTER + 170*scale
    tassel_my = cap_cy + 90*scale
    tassel_ey = cap_cy + 110*scale

    draw.line([(tassel_sx, tassel_sy), (tassel_mx, tassel_my)],
              fill=(255, 255, 255, 220), width=int(4*scale))
    draw.line([(tassel_mx, tassel_my), (tassel_mx - 2*scale, tassel_ey)],
              fill=(255, 255, 255, 220), width=int(4*scale))

    ball_r = 10*scale
    draw.ellipse([
        tassel_mx - ball_r - 2*scale, tassel_ey - ball_r,
        tassel_mx + ball_r - 2*scale, tassel_ey + ball_r
    ], fill=(255, 255, 255, 220))

    # ── 4. Bordo glass ──
    draw.rounded_rectangle(
        [0, 0, SIZE-1, SIZE-1],
        radius=corner_radius,
        outline=(255, 255, 255, 18),
        width=int(2*SCALE)
    )

    # ── 5. Top highlight ──
    th = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(th).rounded_rectangle(
        [SIZE*0.15, 4*SCALE, SIZE*0.85, SIZE*0.06],
        radius=10*SCALE,
        fill=(255, 255, 255, 15)
    )
    th = th.filter(ImageFilter.GaussianBlur(radius=8*SCALE))
    img = Image.alpha_composite(img, th)

    # Downscale 4× → 1024
    return img.resize((1024, 1024), Image.LANCZOS)


def generate_tray_icon():
    """Genera tray icon: graduation cap bianco su sfondo trasparente."""
    TRAY = 512  # render at 512 then downscale
    img = Image.new('RGBA', (TRAY, TRAY), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = TRAY // 2, TRAY // 2
    white = (255, 255, 255, 255)
    white_semi = (255, 255, 255, 200)
    
    s = TRAY / 400  # scale factor
    
    cap_cy = cy - 20 * s
    
    # Flat top (rombo) — bianco
    flat_top = [
        (cx, cap_cy - 80*s),
        (cx + 180*s, cap_cy + 5*s),
        (cx, cap_cy + 60*s),
        (cx - 180*s, cap_cy + 5*s),
    ]
    draw.polygon(flat_top, fill=white)
    
    # Body (trapezio sotto) — bianco semi-trasparente
    body_top = cap_cy + 60*s
    body_bottom = cap_cy + 150*s
    body_points = [
        (cx - 145*s, body_top),
        (cx + 145*s, body_top),
        (cx + 105*s, body_bottom),
        (cx - 105*s, body_bottom),
    ]
    draw.polygon(body_points, fill=white_semi)
    
    # Arco inferiore
    arc_bbox = [
        cx - 105*s, body_bottom - 30*s,
        cx + 105*s, body_bottom + 30*s
    ]
    draw.arc(arc_bbox, 0, 180, fill=(200, 200, 200, 180), width=int(3*s))
    
    # Nappa
    tassel_sx = cx + 180*s
    tassel_sy = cap_cy + 5*s
    tassel_mx = cx + 190*s
    tassel_my = cap_cy + 100*s
    tassel_ey = cap_cy + 125*s
    
    draw.line([(tassel_sx, tassel_sy), (tassel_mx, tassel_my)],
              fill=white, width=int(5*s))
    draw.line([(tassel_mx, tassel_my), (tassel_mx - 2*s, tassel_ey)],
              fill=white, width=int(5*s))
    
    ball_r = 12*s
    draw.ellipse([
        tassel_mx - ball_r - 2*s, tassel_ey - ball_r,
        tassel_mx + ball_r - 2*s, tassel_ey + ball_r
    ], fill=white)
    
    return img


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(base)

    # ── App icon ──
    app_icon = generate_app_icon()
    master_path = os.path.join(root, 'assets', 'icon-master.png')
    os.makedirs(os.path.dirname(master_path), exist_ok=True)
    app_icon.save(master_path, 'PNG')
    print(f"✅ Master: {master_path} (1024×1024, 4× supersampled)")

    icons_dir = os.path.join(root, 'src-tauri', 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    # Standard Tauri sizes
    sizes = {
        'icon.png': 1024,
        '32x32.png': 32,
        '64x64.png': 64,
        '128x128.png': 128,
        '128x128@2x.png': 256,
    }
    for name, size in sizes.items():
        app_icon.resize((size, size), Image.LANCZOS).save(os.path.join(icons_dir, name))
        print(f"  → {name} ({size}×{size})")

    # Windows
    win_sizes = {
        'Square30x30Logo.png': 30, 'Square44x44Logo.png': 44,
        'Square71x71Logo.png': 71, 'Square89x89Logo.png': 89,
        'Square107x107Logo.png': 107, 'Square142x142Logo.png': 142,
        'Square150x150Logo.png': 150, 'Square284x284Logo.png': 284,
        'Square310x310Logo.png': 310, 'StoreLogo.png': 50,
    }
    for name, size in win_sizes.items():
        app_icon.resize((size, size), Image.LANCZOS).save(os.path.join(icons_dir, name))

    # ICO
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_images = [app_icon.resize((s, s), Image.LANCZOS) for s in ico_sizes]
    ico_images[0].save(os.path.join(icons_dir, 'icon.ico'), format='ICO',
                       sizes=[(s, s) for s in ico_sizes], append_images=ico_images[1:])
    print(f"  → icon.ico (multi-size)")

    # ICNS
    iconset_dir = os.path.join(icons_dir, 'icon.iconset')
    os.makedirs(iconset_dir, exist_ok=True)
    iconset_sizes = [
        ('icon_16x16.png', 16), ('icon_16x16@2x.png', 32),
        ('icon_32x32.png', 32), ('icon_32x32@2x.png', 64),
        ('icon_128x128.png', 128), ('icon_128x128@2x.png', 256),
        ('icon_256x256.png', 256), ('icon_256x256@2x.png', 512),
        ('icon_512x512.png', 512), ('icon_512x512@2x.png', 1024),
    ]
    for name, size in iconset_sizes:
        app_icon.resize((size, size), Image.LANCZOS).save(os.path.join(iconset_dir, name))
    os.system(f'iconutil -c icns "{iconset_dir}" -o "{os.path.join(icons_dir, "icon.icns")}"')
    print(f"  → icon.icns")

    # ── Tray icon — trasparente, solo simbolo bianco ──
    tray = generate_tray_icon()
    tray.resize((22, 22), Image.LANCZOS).save(os.path.join(icons_dir, 'tray-icon.png'))
    tray.resize((44, 44), Image.LANCZOS).save(os.path.join(icons_dir, 'tray-icon@2x.png'))
    print(f"  → tray-icon.png (22×22 + @2x, transparent)")

    print("\n✅ Tutte le icone generate! (4× supersampled, tray trasparente)")

if __name__ == '__main__':
    main()
