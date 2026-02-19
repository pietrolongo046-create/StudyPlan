#!/usr/bin/env python3
"""
StudyPlan — Genera la nuova icona basata sul logo sidebar (graduation cap)
Design: cappello di laurea purpureo su sfondo scuro con bordo glass
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math, os

SIZE = 1024
CENTER = SIZE // 2
PAD = SIZE * 0.12

def draw_graduation_cap(draw, cx, cy, scale, primary_color, white_color):
    """Disegna il cappello di laurea stilizzato"""
    s = scale
    
    # Base del cappello (rombo / diamond shape)
    cap_points = [
        (cx, cy - 60*s),           # top
        (cx + 140*s, cy),           # right
        (cx, cy + 50*s),            # bottom
        (cx - 140*s, cy),           # left
    ]
    draw.polygon(cap_points, fill=primary_color)
    
    # Highlight sulla metà superiore del cappello
    highlight_points = [
        (cx, cy - 60*s),
        (cx + 140*s, cy),
        (cx, cy - 5*s),
        (cx - 140*s, cy),
    ]
    # Semi-transparent highlight
    overlay = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    ov_draw.polygon(highlight_points, fill=(255, 255, 255, 30))
    
    # Banda bianca al centro del cappello
    band_y = cy - 5*s
    band_h = 8*s
    band_points = [
        (cx - 120*s, band_y - band_h/2),
        (cx + 120*s, band_y - band_h/2),
        (cx + 120*s, band_y + band_h/2),
        (cx - 120*s, band_y + band_h/2),
    ]
    draw.polygon(band_points, fill=(255, 255, 255, 60))
    
    # Nappa (tassel) — linea che scende dal centro-destra
    tassel_start = (cx + 140*s, cy)
    tassel_mid = (cx + 150*s, cy + 70*s)
    tassel_end = (cx + 145*s, cy + 90*s)
    draw.line([tassel_start, tassel_mid], fill=white_color, width=int(4*s))
    # Pallina alla fine della nappa
    draw.ellipse([
        tassel_end[0] - 8*s, tassel_end[1] - 8*s,
        tassel_end[0] + 8*s, tassel_end[1] + 8*s
    ], fill=white_color)
    
    # Base inferiore (curva che rappresenta l'arco sotto il cappello)
    arc_left = cx - 100*s
    arc_right = cx + 100*s
    arc_top = cy + 20*s
    arc_bottom = cy + 100*s
    
    # Disegna l'arco con linee
    points = []
    for i in range(20):
        t = i / 19
        x = arc_left + (arc_right - arc_left) * t
        curve = math.sin(t * math.pi) * 40 * s
        y = arc_top + curve
        points.append((x, y))
    
    if len(points) > 1:
        draw.line(points, fill=white_color, width=int(5*s), joint='curve')
    
    return overlay


def generate():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    primary = (128, 112, 208)  # #8070d0
    primary_dark = (96, 80, 184)  # #6050b8
    bg_color = (12, 13, 20)  # #0c0d14
    bg_outer = (8, 9, 15)  # #08090f
    
    # ── 1. Sfondo con rounded rect ──
    corner_radius = int(SIZE * 0.22)
    
    # Sfondo esterno
    draw.rounded_rectangle(
        [0, 0, SIZE-1, SIZE-1],
        radius=corner_radius,
        fill=bg_outer
    )
    
    # Sfondo interno con gradient simulato
    inner_margin = int(SIZE * 0.02)
    draw.rounded_rectangle(
        [inner_margin, inner_margin, SIZE-1-inner_margin, SIZE-1-inner_margin],
        radius=corner_radius - inner_margin,
        fill=bg_color
    )
    
    # ── 2. Glow effect dietro il cappello ──
    glow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_radius = int(SIZE * 0.25)
    glow_draw.ellipse(
        [CENTER - glow_radius, CENTER - glow_radius - 20,
         CENTER + glow_radius, CENTER + glow_radius - 20],
        fill=(primary[0], primary[1], primary[2], 40)
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=80))
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)
    
    # ── 3. Cappello di laurea ──
    scale = SIZE / 400
    
    # Cappello principale (rombo)
    cap_cy = CENTER - 30 * scale
    
    # Forma del cappello (piatto superiore)
    flat_top = [
        (CENTER, cap_cy - 70*scale),          # punta top
        (CENTER + 160*scale, cap_cy + 5*scale),  # destra
        (CENTER, cap_cy + 55*scale),            # centro basso
        (CENTER - 160*scale, cap_cy + 5*scale),  # sinistra
    ]
    draw.polygon(flat_top, fill=primary)
    
    # Highlight chiaro sulla parte superiore
    highlight_top = [
        (CENTER, cap_cy - 70*scale),
        (CENTER + 160*scale, cap_cy + 5*scale),
        (CENTER + 10*scale, cap_cy - 10*scale),
        (CENTER - 80*scale, cap_cy - 30*scale),
    ]
    highlight_layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    hl_draw = ImageDraw.Draw(highlight_layer)
    hl_draw.polygon(highlight_top, fill=(255, 255, 255, 25))
    img = Image.alpha_composite(img, highlight_layer)
    draw = ImageDraw.Draw(img)
    
    # Ombra sotto il cappello
    shadow_top = cap_cy + 55*scale
    
    # Base/banda del cappello
    band_y = cap_cy + 50*scale
    band_points = [
        (CENTER - 130*scale, band_y - 6*scale),
        (CENTER + 130*scale, band_y - 6*scale),
        (CENTER + 130*scale, band_y + 6*scale),
        (CENTER - 130*scale, band_y + 6*scale),
    ]
    
    # Parte inferiore (corpo curvo sotto il cappello)
    body_top = cap_cy + 55*scale
    body_bottom = cap_cy + 140*scale
    body_left = CENTER - 110*scale
    body_right = CENTER + 110*scale
    
    # Disegna il corpo come trapezio
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
    
    # Pallina della nappa
    ball_r = 10*scale
    draw.ellipse([
        tassel_mx - ball_r - 2*scale, tassel_ey - ball_r,
        tassel_mx + ball_r - 2*scale, tassel_ey + ball_r
    ], fill=(255, 255, 255, 220))
    
    # ── 4. Bordo glass sottile ──
    draw.rounded_rectangle(
        [0, 0, SIZE-1, SIZE-1],
        radius=corner_radius,
        outline=(255, 255, 255, 18),
        width=2
    )
    
    # ── 5. Piccolo highlight in alto ──
    top_highlight = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    th_draw = ImageDraw.Draw(top_highlight)
    th_draw.rounded_rectangle(
        [SIZE*0.15, 4, SIZE*0.85, SIZE*0.06],
        radius=10,
        fill=(255, 255, 255, 15)
    )
    top_highlight = top_highlight.filter(ImageFilter.GaussianBlur(radius=8))
    img = Image.alpha_composite(img, top_highlight)
    
    return img

def main():
    base = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(base)
    
    img = generate()
    
    # Salva master
    master_path = os.path.join(root, 'assets', 'icon-master.png')
    img.save(master_path, 'PNG')
    print(f"✅ Master: {master_path}")
    
    icons_dir = os.path.join(root, 'src-tauri', 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    
    # Tauri icon sizes
    sizes = {
        'icon.png': 512,
        '32x32.png': 32,
        '64x64.png': 64,
        '128x128.png': 128,
        '128x128@2x.png': 256,
    }
    
    for name, size in sizes.items():
        resized = img.resize((size, size), Image.LANCZOS)
        resized.save(os.path.join(icons_dir, name), 'PNG')
        print(f"  → {name} ({size}x{size})")
    
    # Windows icons
    win_sizes = {
        'Square30x30Logo.png': 30,
        'Square44x44Logo.png': 44,
        'Square71x71Logo.png': 71,
        'Square89x89Logo.png': 89,
        'Square107x107Logo.png': 107,
        'Square142x142Logo.png': 142,
        'Square150x150Logo.png': 150,
        'Square284x284Logo.png': 284,
        'Square310x310Logo.png': 310,
        'StoreLogo.png': 50,
    }
    for name, size in win_sizes.items():
        resized = img.resize((size, size), Image.LANCZOS)
        resized.save(os.path.join(icons_dir, name), 'PNG')
    
    # ICO
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_images = [img.resize((s, s), Image.LANCZOS) for s in ico_sizes]
    ico_images[0].save(os.path.join(icons_dir, 'icon.ico'), format='ICO', sizes=[(s, s) for s in ico_sizes])
    print(f"  → icon.ico")
    
    # ICNS (macOS iconset)
    iconset_dir = os.path.join(icons_dir, 'icon.iconset')
    os.makedirs(iconset_dir, exist_ok=True)
    iconset_sizes = [
        ('icon_16x16.png', 16),
        ('icon_16x16@2x.png', 32),
        ('icon_32x32.png', 32),
        ('icon_32x32@2x.png', 64),
        ('icon_128x128.png', 128),
        ('icon_128x128@2x.png', 256),
        ('icon_256x256.png', 256),
        ('icon_256x256@2x.png', 512),
        ('icon_512x512.png', 512),
        ('icon_512x512@2x.png', 1024),
    ]
    for name, size in iconset_sizes:
        resized = img.resize((size, size), Image.LANCZOS)
        resized.save(os.path.join(iconset_dir, name), 'PNG')
    
    os.system(f'iconutil -c icns "{iconset_dir}" -o "{os.path.join(icons_dir, "icon.icns")}"')
    print(f"  → icon.icns")
    
    # Tray icon (22x22 e 44x44)
    tray_22 = img.resize((22, 22), Image.LANCZOS)
    tray_22.save(os.path.join(icons_dir, 'tray-icon.png'), 'PNG')
    tray_44 = img.resize((44, 44), Image.LANCZOS)
    tray_44.save(os.path.join(icons_dir, 'tray-icon@2x.png'), 'PNG')
    print(f"  → tray-icon.png (22x22 + @2x)")
    
    print("\n✅ Tutte le icone generate!")

if __name__ == '__main__':
    main()
