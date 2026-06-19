#!/usr/bin/env python3
"""Genere 2 mockups PNG du Rapport matinal (charte Deep Mission)."""
import cairosvg

# ── Tokens charte (globals.css) ────────────────────────────────
BG       = "#0B0F14"   # ink-900
SURFACE  = "#121821"   # ink-800
CARD     = "#18202B"   # ink-700
BORDER   = "#25303E"   # ink-600
PRIMARY  = "#FF7900"
PRIM_TXT = "#FF8A33"
TEXT     = "#E2ECE9"
SECOND   = "#B7C6C1"
MUTED    = "#8BA8A3"
SUCCESS  = "#4ADE80"
ACCENT   = "#38BDF8"
WARNING  = "#FBBF24"
ORG_TINT = "#2A1B0E"   # panneau orange subtil (cairosvg ne gere pas l'alpha hex)
ORG_BOX  = "#3A2510"
GRN_TINT = "#10261A"

W, H = 390, 880
F = "Inter, 'Helvetica Neue', Arial, sans-serif"   # fallback DejaVu
D = "'Space Grotesk', Inter, Arial, sans-serif"     # police chiffres/titres


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def rrect(x, y, w, h, r, fill, stroke=None, sw=1, op=1):
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" ry="{r}" fill="{fill}" opacity="{op}"'
    if stroke:
        s += f' stroke="{stroke}" stroke-width="{sw}"'
    return s + "/>"


def txt(x, y, s, size, fill, weight=400, anchor="start", font=F, ls=0, op=1):
    extra = f' letter-spacing="{ls}"' if ls else ""
    return (f'<text x="{x}" y="{y}" font-family="{font}" font-size="{size}" '
            f'fill="{fill}" font-weight="{weight}" text-anchor="{anchor}" opacity="{op}"{extra}>{esc(s)}</text>')


# ══════════════════════════════════════════════════════════════
#  MOCKUP A — « Briefing plein écran » (prise de contrôle aube)
#  Signaux anti-onglet : pas de bottom-nav, pas de header Trail
#  Cockpit, hero dégradé aube plein-bleed, gros titre editorial,
#  CTA unique en bas. On comprend qu'on est dans un moment à part.
# ══════════════════════════════════════════════════════════════
def mockup_a():
    e = []
    e.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
    e.append(f'''<defs>
      <linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0"    stop-color="#0B0F14"/>
        <stop offset="0.32" stop-color="#101A2B"/>
        <stop offset="0.55" stop-color="#1E2336"/>
        <stop offset="0.72" stop-color="#3A2A24"/>
        <stop offset="0.86" stop-color="#0B0F14"/>
      </linearGradient>
      <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0"   stop-color="#FFB066"/>
        <stop offset="0.4" stop-color="#FF7900"/>
        <stop offset="1"   stop-color="#FF7900" stop-opacity="0"/>
      </radialGradient>
    </defs>''')
    # fond hero
    e.append(rrect(0, 0, W, H, 0, BG))
    e.append(f'<rect x="0" y="0" width="{W}" height="430" fill="url(#dawn)"/>')
    # soleil sur l'horizon
    e.append('<circle cx="300" cy="300" r="120" fill="url(#sun)" opacity="0.55"/>')
    e.append(f'<circle cx="300" cy="300" r="34" fill="#FFC98A" opacity="0.9"/>')
    # ligne d'horizon
    e.append(f'<rect x="0" y="300" width="{W}" height="1" fill="{PRIMARY}" opacity="0.25"/>')

    # ── top bar : overline gauche + croix droite (pas de tab bar) ──
    e.append(rrect(20, 34, 184, 26, 13, ORG_TINT, PRIMARY, 1))
    e.append(f'<circle cx="36" cy="47" r="3" fill="{PRIMARY}"/>')
    e.append(txt(48, 51, "RAPPORT MATINAL", 11, PRIM_TXT, 700, ls=1.5))
    e.append(rrect(330, 34, 26, 26, 13, "#0B0F1499", BORDER, 1))
    e.append(txt(343, 51, "✕", 13, TEXT, 400, "middle"))

    # ── cover editorial ──
    e.append(txt(24, 120, "JEUDI 19 JUIN 2026", 11, MUTED, 600, ls=2.5))
    e.append(txt(22, 162, "Bonjour", 40, TEXT, 600, font=D, ls=-0.5))
    e.append(txt(22, 206, "Franck", 40, PRIM_TXT, 700, font=D, ls=-0.5))
    # chip course J-42
    e.append(rrect(250, 122, 116, 56, 12, "#0B0F1466", BORDER, 1))
    e.append(txt(308, 140, "UTMB · CCC", 9, MUTED, 600, "middle", ls=1.5))
    e.append(txt(308, 166, "J-42", 26, PRIMARY, 700, "middle", font=D))

    # phrase d'intro coach
    e.append(txt(24, 244, "Ta journée en un coup d'oeil.", 14, SECOND, 400))

    # ── blocs briefing (cartes empilees, lecture verticale) ──
    y = 268
    # Séance du jour
    e.append(rrect(20, y, 350, 92, 14, CARD, BORDER, 1))
    e.append(f'<rect x="20" y="{y}" width="4" height="92" rx="2" fill="{PRIMARY}"/>')
    e.append(txt(40, y+24, "SÉANCE DU JOUR", 10, MUTED, 700, ls=1.5))
    e.append(txt(40, y+52, "Sortie longue · 1h45", 19, TEXT, 600, font=D))
    e.append(txt(40, y+76, "Zone 2 · 18 km · +650 m", 12, SECOND, 400))
    e.append(rrect(290, y+18, 64, 56, 10, ORG_BOX))
    e.append(txt(322, y+44, "Z2", 20, PRIMARY, 700, "middle", font=D))
    e.append(txt(322, y+62, "ENDURANCE", 7, SECOND, 600, "middle", ls=1))

    # Forme / TSB
    y += 104
    e.append(rrect(20, y, 350, 88, 14, CARD, BORDER, 1))
    e.append(txt(40, y+24, "FORME DU JOUR", 10, MUTED, 700, ls=1.5))
    e.append(txt(40, y+56, "+8", 30, SUCCESS, 700, font=D))
    e.append(txt(96, y+50, "Frais", 14, SUCCESS, 600))
    e.append(txt(96, y+68, "TSB · prêt à charger", 11, MUTED, 400))
    # mini barres fitness/fatigue
    bx = 250
    for i, (hh, c) in enumerate([(20, ACCENT), (34, ACCENT), (28, PRIMARY), (40, ACCENT),
                                  (30, PRIMARY), (46, ACCENT), (38, PRIMARY)]):
        e.append(rrect(bx + i*16, y+66-hh, 9, hh, 2, c, op=0.8))
    e.append(txt(322, y+82, "FITNESS ↗ FATIGUE", 7, MUTED, 600, "middle", ls=0.5))

    # Météo (mini grid 3)
    y += 100
    e.append(txt(24, y+2, "MÉTÉO COURSE", 10, MUTED, 700, ls=1.5))
    cw = 110
    cols = [("Maintenant", "12°", "Ciel clair", ACCENT),
            ("Fenêtre idéale", "7-9 h", "↑ priming", PRIMARY),
            ("Cet aprem", "21°", "Averses", WARNING)]
    for i, (lab, val, sub, c) in enumerate(cols):
        cx = 20 + i*(cw+5)
        e.append(rrect(cx, y+12, cw, 76, 12, CARD, BORDER, 1))
        e.append(txt(cx+12, y+32, lab, 9, MUTED, 600))
        e.append(txt(cx+12, y+60, val, 22, c, 700, font=D))
        e.append(txt(cx+12, y+80, sub, 9, SECOND, 400))

    # Mot du coach (comble le bas, ton "brief")
    y += 108
    e.append(rrect(20, y, 350, 110, 14, SURFACE, BORDER, 1))
    e.append(f'<rect x="20" y="{y}" width="4" height="110" rx="2" fill="{ACCENT}"/>')
    e.append(f'<circle cx="44" cy="{y+26}" r="9" fill="{ORG_BOX}"/>')
    e.append(txt(44, y+30, "AI", 9, PRIM_TXT, 700, "middle"))
    e.append(txt(62, y+30, "MOT DU COACH", 10, MUTED, 700, ls=1.5))
    e.append(txt(40, y+58, "Belle fenêtre ce matin : pars tôt en Z2,", 13, TEXT, 400))
    e.append(txt(40, y+78, "garde de la marge, tu encaisses du volume", 13, TEXT, 400))
    e.append(txt(40, y+98, "cette semaine avant l'affûtage CCC.", 13, TEXT, 400))

    # ── CTA bas + fermer (signal "moment", pas un onglet) ──
    e.append(rrect(20, 806, 350, 50, 14, PRIMARY))
    e.append(txt(195, 837, "Commencer ma journée  →", 16, "#0B0F14", 700, "middle"))
    e.append(txt(195, 792, "Fermer le rapport", 12, MUTED, 400, "middle"))

    e.append("</svg>")
    return "".join(e)


# ══════════════════════════════════════════════════════════════
#  MOCKUP B — « Feuille superposée » (report sheet / modale)
#  Signaux anti-onglet : l'app reste visible derrière (floutée +
#  scrim), la feuille a un grab-handle, un bord accent, un en-tête
#  "rapport" avec icone aube + indicateur "1 lecture/jour", et un
#  rail timeline vertical (lecture sequentielle, pas une grille).
# ══════════════════════════════════════════════════════════════
def mockup_b():
    e = []
    e.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
    e.append(f'''<defs>
      <linearGradient id="sheet" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#151D27"/>
        <stop offset="1" stop-color="#0E141C"/>
      </linearGradient>
      <radialGradient id="rise" cx="0.5" cy="1" r="0.9">
        <stop offset="0" stop-color="#FF7900" stop-opacity="0.9"/>
        <stop offset="1" stop-color="#FF7900" stop-opacity="0"/>
      </radialGradient>
    </defs>''')
    e.append(rrect(0, 0, W, H, 0, BG))

    # ── app floutée derrière (faux contenu + bottom nav grisé) ──
    for i in range(3):
        e.append(rrect(16, 24 + i*40, 358, 30, 8, SURFACE, op=0.5))
    # bottom nav fantome
    e.append(rrect(0, 824, W, 56, 0, SURFACE, op=0.6))
    for i in range(5):
        e.append(rrect(34 + i*72, 840, 24, 24, 6, BORDER, op=0.6))
    # scrim sombre
    e.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="#05070A" opacity="0.78"/>')

    # ── feuille (panneau superposé) ──
    sx, sy, sw, sh = 12, 78, 366, 740
    e.append(rrect(sx, sy, sw, sh, 22, "url(#sheet)", BORDER, 1.5))
    # bord accent haut
    e.append(f'<path d="M34,{sy} H356 a22,22 0 0 1 22,22 V120 H12 V100 a22,22 0 0 1 22,-22 Z" fill="url(#rise)" opacity="0.16"/>')
    # grab handle
    e.append(rrect(180, sy+10, 30, 4, 2, MUTED, op=0.6))

    # ── en-tete rapport : icone aube + titre + croix ──
    hy = sy + 34
    e.append(rrect(28, hy, 44, 44, 12, ORG_BOX, PRIMARY, 1))
    # petit soleil levant : demi-disque + horizon + rayons
    e.append(f'<path d="M40,{hy+30} a10,10 0 0 1 20,0 Z" fill="{PRIMARY}"/>')
    e.append(f'<rect x="36" y="{hy+30}" width="28" height="1.5" fill="{PRIMARY}"/>')
    e.append(f'<rect x="38" y="{hy+34}" width="24" height="1.5" fill="{PRIM_TXT}" opacity="0.6"/>')
    e.append(txt(84, hy+18, "RAPPORT MATINAL", 11, PRIM_TXT, 700, ls=1.5))
    e.append(txt(84, hy+40, "Jeudi 19 juin · Bonjour Franck", 14, TEXT, 600, font=D))
    e.append(rrect(330, hy, 30, 30, 15, "#0B0F1466", BORDER, 1))
    e.append(txt(345, hy+19, "✕", 13, TEXT, 400, "middle"))
    # indicateur "1 lecture / jour"
    e.append(txt(84, hy+58, "Ton brief du jour · 1 lecture", 10, MUTED, 400))
    e.append(rrect(252, hy+48, 62, 17, 8, GRN_TINT, SUCCESS, 0.8))
    e.append(f'<circle cx="265" cy="{hy+56}" r="3" fill="{SUCCESS}"/>')
    e.append(txt(274, hy+60, "À jour", 9, SUCCESS, 600))

    # separateur
    e.append(f'<rect x="28" y="{hy+78}" width="332" height="1" fill="{BORDER}"/>')

    # ── rail timeline vertical (lecture sequentielle) ──
    rail_x = 40
    ty = hy + 104
    sections = [
        ("HIER",        "Trail 14 km · CES 58 · récup OK",       SUCCESS),
        ("AUJOURD'HUI", "Sortie longue 1h45 · Z2 · +650 m",      PRIMARY),
        ("FORME",       "TSB +8 · frais · prêt à charger",        ACCENT),
        ("MÉTÉO",       "Fenêtre 7-9 h · 9° · ciel clair",        WARNING),
    ]
    gap = 124
    # ligne du rail
    e.append(f'<rect x="{rail_x-1}" y="{ty}" width="2" height="{gap*3+8}" fill="{BORDER}"/>')
    for i, (lab, body, c) in enumerate(sections):
        cy = ty + i*gap
        e.append(f'<circle cx="{rail_x}" cy="{cy}" r="6" fill="{c}"/>')
        e.append(f'<circle cx="{rail_x}" cy="{cy}" r="11" fill="none" stroke="{c}" stroke-width="1" opacity="0.4"/>')
        # carte de section
        cardx, cardw, cardh = 62, 298, 96
        e.append(rrect(cardx, cy-18, cardw, cardh, 13, CARD, BORDER, 1))
        e.append(txt(cardx+16, cy+2, lab, 10, c, 700, ls=1.5))
        e.append(txt(cardx+16, cy+30, body, 13, TEXT, 500))
        # mini valeur a droite
        if i == 1:
            e.append(txt(cardx+cardw-18, cy+30, "Z2", 22, PRIMARY, 700, "end", font=D))
        elif i == 2:
            e.append(txt(cardx+cardw-18, cy+30, "+8", 22, ACCENT, 700, "end", font=D))
        # filler ligne
        e.append(rrect(cardx+16, cy+48, cardw-90, 8, 4, SURFACE))
        e.append(rrect(cardx+16, cy+62, cardw-150, 8, 4, SURFACE))

    # ── CTA bas dans la feuille ──
    e.append(rrect(28, sh+sy-66, 332, 46, 13, PRIMARY))
    e.append(txt(194, sh+sy-37, "Entrer dans le cockpit  →", 15, "#0B0F14", 700, "middle"))

    e.append("</svg>")
    return "".join(e)


for name, svg in [("mockup-A-briefing.png", mockup_a()), ("mockup-B-feuille.png", mockup_b())]:
    out = f"/home/user/app-run-mobile/mockups/morning-report/{name}"
    cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=out, output_width=W*2, output_height=H*2)
    print("wrote", out)
