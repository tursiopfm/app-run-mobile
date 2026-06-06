#!/usr/bin/env python3
# Itération logo TrailCockpit — massif + trajectoire orange + drapeau damier au sommet.
import cairosvg, os

OUT = "/home/user/app-run-mobile/web/public/brand-iteration"
TMP = "/tmp/logo"
os.makedirs(OUT, exist_ok=True)

DARK   = "#0B0F14"
ORANGE = "#FF7900"
WHITE  = "#FFFFFF"
ROCK   = "#E9EEF3"   # corps neige/roche légèrement bleuté

# Massif : pieds/sommets alternés
MASSIF = "M6,34.5 L15.5,21 L20.5,26.5 L28,12 L33.5,22.5 L38.5,17.5 L42,34.5 Z"

# Capuchon de neige propre sur le sommet principal (petit chevron blanc pur)
SNOWCAP = "M28,12 L25,18 L26.4,17.3 L28,18.4 L29.6,17.3 L31,19 Z"

RIDGES = [
    "M15.5,21 L18.3,26.2",
    "M28,12 L31,18.5",
    "M38.5,17.5 L40.6,27",
]

# Trajectoire orange — montée switchback fluide vers la base du drapeau
TRAIL = "M11.5,33 C14.5,32.2 14.8,29.2 17.6,28.5 C20.4,27.8 21.2,29.6 23.4,28.7 C26,27.6 25.8,22.8 27.8,17.4"
START       = (11.5, 33)
CP_REACHED  = (17.6, 28.5)   # plein (accompli)
CP_UPCOMING = (23.4, 28.7)   # creux (à venir)
TRAIL_LEN   = 28.2           # longueur approx pour dasharray
SOLID_FRAC  = 0.46           # part accomplie (plein)

FLAG_BASE = (27.8, 17.4)
FLAG_TOP  = (27.8, 7.6)

def flag_svg():
    x, ytop = FLAG_TOP
    fw, fh = 9.0, 5.8
    cols, rows = 3, 2
    cw, ch = fw/cols, fh/rows
    cells = ""
    for r in range(rows):
        for c in range(cols):
            col = ORANGE if (r+c) % 2 == 0 else WHITE
            cells += (f'<rect x="{x+c*cw:.2f}" y="{ytop+r*ch:.2f}" '
                      f'width="{cw:.2f}" height="{ch:.2f}" fill="{col}"/>')
    return (f'<line x1="{x}" y1="{FLAG_BASE[1]}" x2="{x}" y2="{ytop}" stroke="{WHITE}" '
            f'stroke-width="1.6" stroke-linecap="round"/>'
            f'{cells}'
            f'<rect x="{x}" y="{ytop}" width="{fw}" height="{fh}" fill="none" '
            f'stroke="{DARK}" stroke-width="0.45"/>')

def glyph(massif_fill):
    solid = TRAIL_LEN * SOLID_FRAC
    p = []
    p.append(f'<path d="{MASSIF}" fill="{massif_fill}" stroke="none"/>')
    p.append(f'<path d="{SNOWCAP}" fill="{WHITE}"/>')
    for r in RIDGES:
        p.append(f'<path d="{r}" fill="none" stroke="{DARK}" stroke-opacity="0.16" '
                 f'stroke-width="1.0" stroke-linecap="round"/>')
    # trace : pointillé fin (à venir) + plein (accompli)
    p.append(f'<path d="{TRAIL}" fill="none" stroke="{ORANGE}" stroke-opacity="0.5" '
             f'stroke-width="2.2" stroke-linecap="round" stroke-dasharray="0.3 2.3"/>')
    p.append(f'<path d="{TRAIL}" fill="none" stroke="{ORANGE}" stroke-width="2.2" '
             f'stroke-linecap="round" stroke-linejoin="round" '
             f'stroke-dasharray="{solid:.2f} {TRAIL_LEN}"/>')
    p.append(f'<circle cx="{START[0]}" cy="{START[1]}" r="2.0" fill="{ORANGE}"/>')
    p.append(f'<circle cx="{CP_REACHED[0]}" cy="{CP_REACHED[1]}" r="1.8" fill="{ORANGE}"/>')
    p.append(f'<circle cx="{CP_UPCOMING[0]}" cy="{CP_UPCOMING[1]}" r="1.9" '
             f'fill="{massif_fill}" stroke="{ORANGE}" stroke-width="1.3"/>')
    p.append(flag_svg())
    return "".join(p)

def compact_glyph(massif_fill):
    # Palier petites tailles : massif + trace pleine épaisse + départ + drapeau.
    x, ytop = FLAG_TOP
    fw, fh = 9.5, 6.2
    cw, ch = fw/3, fh/2
    cells = "".join(
        f'<rect x="{x+c*cw:.2f}" y="{ytop+r*ch:.2f}" width="{cw:.2f}" height="{ch:.2f}" '
        f'fill="{ORANGE if (r+c)%2==0 else WHITE}"/>'
        for r in range(2) for c in range(3))
    p = [f'<path d="{MASSIF}" fill="{massif_fill}" stroke="none"/>',
         f'<path d="{SNOWCAP}" fill="{WHITE}"/>',
         f'<path d="{TRAIL}" fill="none" stroke="{ORANGE}" stroke-width="3.0" '
         f'stroke-linecap="round" stroke-linejoin="round"/>',
         f'<circle cx="{START[0]}" cy="{START[1]}" r="2.4" fill="{ORANGE}"/>',
         f'<line x1="{x}" y1="{FLAG_BASE[1]}" x2="{x}" y2="{ytop}" stroke="{WHITE}" '
         f'stroke-width="2.0" stroke-linecap="round"/>',
         cells]
    return "".join(p)

def svg(bg="deep", shape="squircle", size=512, tier="full"):
    bgcol = {"deep": DARK, "orange": ORANGE, "none": "none"}[bg]
    massif_fill = ROCK if bg == "deep" else WHITE
    rect = ""
    if bgcol != "none":
        if shape == "squircle":
            rect = f'<rect x="3" y="3" width="42" height="42" rx="13" fill="{bgcol}"/>'
        elif shape == "bleed":
            rect = f'<rect width="48" height="48" fill="{bgcol}"/>'
    body = compact_glyph(massif_fill) if tier == "compact" else glyph(massif_fill)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
            f'viewBox="0 0 48 48">{rect}{body}</svg>')

def render(name, **kw):
    s = svg(**kw)
    open(f"{TMP}/{name}.svg","w").write(s)
    sz = kw.get("size",512)
    cairosvg.svg2png(bytestring=s.encode(), write_to=f"{OUT}/{name}.png",
                     output_width=sz, output_height=sz)

render("v2-deep-512",       bg="deep",   size=512)
render("v2-compact-deep-48", bg="deep",  size=48,  tier="compact")
render("v2-compact-deep-32", bg="deep",  size=32,  tier="compact")
render("v2-compact-deep-512", bg="deep", size=512, tier="compact")
print("done")
