#!/usr/bin/env python3
"""Rendu fidele de l'ecran FINAL du rapport matinal (takeover design A,
tous les blocs reels conserves avec donnees representatives)."""
import cairosvg

BG="#0B0F14"; SURFACE="#121821"; CARD="#18202B"; BORDER="#25303E"
PRIMARY="#FF7900"; PRIM_TXT="#FF8A33"; ORANGE2="#FF6B35"
TEXT="#E2ECE9"; SECOND="#B7C6C1"; MUTED="#8BA8A3"
SUCCESS="#4ADE80"; ACCENT="#38BDF8"; WARNING="#FBBF24"; PURPLE="#8B5CF6"
ORG_TINT="#2A1B0E"; GRN_TINT="#10261A"
F="Inter, Arial, sans-serif"; D="'Space Grotesk', Inter, Arial, sans-serif"
W=390

e=[]
def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
def rect(x,y,w,h,r,fill,stroke=None,sw=1,op=1,dash=None):
    s=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" ry="{r}" fill="{fill}" opacity="{op}"'
    if stroke: s+=f' stroke="{stroke}" stroke-width="{sw}"'
    if dash: s+=f' stroke-dasharray="{dash}"'
    return s+"/>"
def t(x,y,s,size,fill,w=400,a="start",font=F,ls=0,op=1):
    extra=f' letter-spacing="{ls}"' if ls else ""
    return f'<text x="{x}" y="{y}" font-family="{font}" font-size="{size}" fill="{fill}" font-weight="{w}" text-anchor="{a}" opacity="{op}"{extra}>{esc(s)}</text>'
def card(x,y,w,h,fill=CARD,stroke=BORDER):
    e.append(rect(x,y,w,h,12,fill,stroke,1))

PAD=14; CW=W-2*PAD  # 362

# ── fond + hero degrade aube ──
H=1500
e.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
e.append(f'''<defs>
  <linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0B0F14"/><stop offset="0.32" stop-color="#101A2B"/>
    <stop offset="0.55" stop-color="#1E2336"/><stop offset="0.72" stop-color="#3A2A24"/>
    <stop offset="0.94" stop-color="#0B0F14"/>
  </linearGradient>
  <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#FFB066"/><stop offset="0.4" stop-color="#FF7900"/>
    <stop offset="1" stop-color="#FF7900" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="coach" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#221A3A"/><stop offset="1" stop-color="#10222E"/>
  </linearGradient>
  <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0B0F14" stop-opacity="0"/><stop offset="0.45" stop-color="#0B0F14"/>
  </linearGradient>
</defs>''')
e.append(rect(0,0,W,H,0,BG))
e.append(f'<rect x="0" y="0" width="{W}" height="440" fill="url(#dawn)"/>')
e.append('<circle cx="312" cy="270" r="115" fill="url(#sun)" opacity="0.5"/>')
e.append('<circle cx="312" cy="270" r="30" fill="#FFC98A" opacity="0.85"/>')

# ── 1. top bar : pastille + croix ──
e.append(rect(PAD,24,176,28,14,ORG_TINT,PRIMARY,1))
e.append(f'<circle cx="{PAD+14}" cy="38" r="3" fill="{PRIMARY}"/>')
e.append(t(PAD+26,42,"RAPPORT MATINAL",11,PRIM_TXT,700,ls=1.5))
e.append(rect(W-PAD-30,24,30,30,15,"#0B0F1466",BORDER,1))
e.append(t(W-PAD-15,43,"✕",13,TEXT,400,"middle"))

# ── 2. coiffe editoriale ──
e.append(t(PAD+2,92,"JEUDI 19 JUIN 2026",11,MUTED,600,ls=2.5))
e.append(t(PAD,128,"Bonjour",36,TEXT,600,font=D,ls=-0.5))
e.append(t(PAD,166,"Franck",36,PRIM_TXT,700,font=D,ls=-0.5))
e.append(rect(W-PAD-112,86,112,58,12,"#0B0F1466",BORDER,1))
e.append(t(W-PAD-56,104,"UTMB · CCC",9,MUTED,600,"middle",ls=1.5))
e.append(t(W-PAD-56,132,"J-42",24,PRIMARY,700,"middle",font=D))
# tagline
e.append(t(PAD+2,196,"Ta journée en un coup d'œil.",14,SECOND,400))

y=214
# ── 4. Séance du jour (carte teintée orange) ──
ch=128
e.append(rect(PAD,y,CW,ch,12,CARD,"#FF6B3559",1))
e.append(t(PAD+14,y+24,"Séance du jour",15,MUTED,600,font=D))
e.append(t(PAD+14,y+52,"Sortie longue",26,TEXT,600,font=D))
e.append(t(PAD+14,y+72,"Endurance",12,MUTED,400))
e.append(f'<rect x="{PAD+14}" y="{y+82}" width="{CW-28}" height="1" fill="{BORDER}"/>')
kpis=[("Durée","1h45"),("Distance","18 km"),("D+","650 m")]
kw=(CW-28-2*8)/3
for i,(lab,val) in enumerate(kpis):
    kx=PAD+14+i*(kw+8)
    e.append(rect(kx,y+92,kw,32,10,SURFACE))
    e.append(t(kx+kw/2,y+104,lab,11,MUTED,600,"middle"))
    e.append(t(kx+kw/2,y+120,val,17,TEXT,600,"middle",font=D))
y+=ch+12

# ── 5. Forme (BlockCard + verdict + 3 KPI cells) ──
ch=150
card(PAD,y,CW,ch)
e.append(t(PAD+14,y+24,"Forme",15,MUTED,600,font=D))
e.append(t(W-PAD-14,y+24,"?",12,MUTED,600,"end"))
e.append(t(PAD+14,y+48,"Tu peux charger aujourd'hui",14,TEXT,700))
e.append(t(PAD+14,y+66,"Forme et fatigue à l'équilibre.",12,MUTED,400))
cells=[("Fatigue récente",ORANGE2,"Habituelle","Dans tes habitudes"),
       ("Fitness de base",ACCENT,"Solide","Bon socle d'endurance"),
       ("Fraîcheur",WARNING,"Plutôt frais","Plutôt reposé")]
cw=(CW-28-2*8)/3
for i,(lab,col,word,hint) in enumerate(cells):
    cx=PAD+14+i*(cw+8)
    e.append(rect(cx,y+78,cw,60,10,SURFACE))
    e.append(t(cx+cw/2,y+94,lab,9,col,600,"middle"))
    e.append(t(cx+cw/2,y+112,word,13,TEXT,700,"middle",font=D))
    # hint sur 2 lignes courtes
    words=hint.split(' ')
    mid=len(words)//2 or 1
    l1=' '.join(words[:mid]); l2=' '.join(words[mid:])
    e.append(t(cx+cw/2,y+126,l1,8,MUTED,500,"middle"))
    e.append(t(cx+cw/2,y+135,l2,8,MUTED,500,"middle"))
y+=ch+12

# ── 6. Fitness/Fatigue 10j (chart) ──
ch=240
card(PAD,y,CW,ch)
e.append(t(PAD+14,y+24,"Forme & fatigue (10 j)",15,MUTED,600,font=D))
gx,gy,gw,gh=PAD+34,y+40,CW-48,150
# grille
for i in range(4):
    yy=gy+i*(gh/3)
    e.append(f'<line x1="{gx}" y1="{yy:.0f}" x2="{gx+gw}" y2="{yy:.0f}" stroke="{BORDER}" stroke-width="1" stroke-dasharray="2 2"/>')
import math
n=10
def path(vals,col,sw=2):
    pts=[]
    for i,v in enumerate(vals):
        px=gx+i*(gw/(n-1)); py=gy+gh-(v*gh)
        pts.append(f"{px:.1f},{py:.1f}")
    e.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{col}" stroke-width="{sw}"/>')
ctl=[0.42,0.44,0.45,0.47,0.48,0.5,0.52,0.53,0.55,0.57]
atl=[0.30,0.50,0.46,0.62,0.55,0.40,0.58,0.66,0.52,0.48]
tsb=[0.60,0.45,0.52,0.40,0.48,0.62,0.50,0.42,0.55,0.60]
# aire tsb
apts=[f"{gx},{gy+gh}"]+[f"{gx+i*(gw/(n-1)):.1f},{gy+gh-tsb[i]*gh:.1f}" for i in range(n)]+[f"{gx+gw},{gy+gh}"]
e.append(f'<polygon points="{" ".join(apts)}" fill="{WARNING}" opacity="0.16"/>')
path(atl,ORANGE2); path(ctl,ACCENT)
# axe x labels
for i in range(0,n,3):
    e.append(t(gx+i*(gw/(n-1)),gy+gh+14,f"{10+i}/06",9,MUTED,400,"middle"))
# legende
ly=y+ch-20
e.append(f'<rect x="{PAD+14}" y="{ly}" width="12" height="2" rx="1" fill="{ORANGE2}"/>')
e.append(t(PAD+30,ly+4,"Fatigue récente",11,MUTED,400))
e.append(f'<rect x="{PAD+130}" y="{ly}" width="12" height="2" rx="1" fill="{ACCENT}"/>')
e.append(t(PAD+146,ly+4,"Fitness de base",11,MUTED,400))
e.append(f'<rect x="{PAD+248}" y="{ly-3}" width="12" height="8" rx="1" fill="{WARNING}" opacity="0.5"/>')
e.append(t(PAD+264,ly+4,"Fraîcheur",11,MUTED,400))
y+=ch+12

# ── 7. Meteo : 2 cartes cote a cote ──
ch=150
half=(CW-10)/2
# Là-dehors
card(PAD,y,half,ch)
e.append(t(PAD+12,y+22,"Là-dehors",13,MUTED,600))
e.append(t(PAD+half-12,y+22,"☀",13,WARNING,400,"end"))
e.append(t(PAD+12,y+50,"14°",28,TEXT,600,font=D))
e.append(t(PAD+52,y+50,"/12°",11,MUTED,400))
e.append(t(PAD+12,y+64,"Chamonix",10,MUTED,400))
stats=[("Vent","12 km/h"),("Pluie","10%"),("Hum","65%"),("Lever","06:12")]
for i,(a,b) in enumerate(stats):
    sx=PAD+12+(i%2)*(half/2-6); sy=y+82+(i//2)*16
    e.append(t(sx,sy,f"{a} {b}",10,SECOND,400))
e.append(rect(PAD+12,y+ch-26,half/2-14,16,8,GRN_TINT,SUCCESS,0.7))
e.append(t(PAD+12+(half/2-14)/2,y+ch-15,"UV 3 · modéré",8.5,SUCCESS,600,"middle"))
e.append(rect(PAD+half/2+2,y+ch-26,half/2-14,16,8,GRN_TINT,SUCCESS,0.7))
e.append(t(PAD+half/2+2+(half/2-14)/2,y+ch-15,"Air 18 · très bon",8,SUCCESS,600,"middle"))
# Météo journée
mx=PAD+half+10
card(mx,y,half,ch)
e.append(t(mx+12,y+22,"Météo journée",13,MUTED,600))
slots=[("8h","11°",WARNING),("12h","18°",WARNING),("16h","17°",MUTED),("20h","13°",ACCENT)]
sw=(half-24-3*6)/4
for i,(hh,tp,col) in enumerate(slots):
    sx=mx+12+i*(sw+6)
    e.append(rect(sx,y+38,sw,90,8,SURFACE))
    e.append(t(sx+sw/2,y+56,hh,10,MUTED,400,"middle"))
    e.append(f'<circle cx="{sx+sw/2}" cy="{y+78}" r="7" fill="{col}" opacity="0.8"/>')
    e.append(t(sx+sw/2,y+108,tp,14,TEXT,600,"middle",font=D))
y+=ch+12

# ── 8. Meilleur creneau ──
ch=96
card(PAD,y,CW,ch)
e.append(t(PAD+14,y+22,"MEILLEUR CRÉNEAU AUJOURD'HUI",11,MUTED,600,ls=0.8))
bx=PAD+14; bw=CW-28; bars=17
scores=[0.3,0.4,0.55,0.7,0.85,0.95,0.9,0.8,0.6,0.5,0.45,0.5,0.55,0.6,0.5,0.4,0.3]
bwid=(bw-(bars-1)*3)/bars
for i,s in enumerate(scores):
    col=SUCCESS if s>=0.85 else (WARNING if s>=0.55 else ACCENT)
    bh=8+s*28
    best= 4<=i<=6
    e.append(rect(bx+i*(bwid+3),y+62-bh,bwid,bh,2,col,PRIMARY if best else None, 1.5 if best else 0))
e.append(t(PAD+14,y+86,"8h-10h",11,PRIMARY,700))
e.append(t(PAD+64,y+86,"optimal · score moyen 91/100",11,SECOND,400))
y+=ch+12

# ── 9. Volume semaine (2/3) + Ce mois (1/3) ──
ch=120
w2=CW*2/3-5
card(PAD,y,w2,ch)
e.append(t(PAD+12,y+22,"Volume semaine",13,MUTED,600))
e.append(t(PAD+12,y+50,"42 km",24,TEXT,600,font=D))
e.append(t(PAD+92,y+50,"1250 m D+",10,MUTED,400))
days=["L","M","M","J","V","S","D"]
vols=[0.5,0,0.8,0.4,0,1.0,0]; today=5
dw=(w2-24-6*4)/7
for i,d in enumerate(days):
    dx=PAD+12+i*(dw+4)
    e.append(rect(dx,y+62,dw,28,3,SURFACE if vols[i]==0 else "transparent",BORDER if vols[i]==0 else None,1,dash="2 2" if vols[i]==0 else None))
    if vols[i]>0:
        bh=max(6,vols[i]*28)
        col=PRIMARY if i==today else SUCCESS
        e.append(rect(dx,y+62+28-bh,dw,bh,3,col))
    e.append(t(dx+dw/2,y+102,d,9,PRIMARY if i==today else MUTED,400,"middle"))
# Ce mois
mx=PAD+w2+10; w3=CW/3-5
card(mx,y,w3,ch)
e.append(t(mx+12,y+22,"Ce mois",13,MUTED,600))
e.append(t(mx+12,y+58,"168",22,PRIMARY,700,font=D))
e.append(t(mx+54,y+58,"km",10,MUTED,400))
e.append(t(mx+12,y+88,"4820",22,ACCENT,700,font=D))
e.append(t(mx+62,y+88,"m D+",10,MUTED,400))
y+=ch+12

# ── 10. Mot du coach ──
ch=78
e.append(rect(PAD,y,CW,ch,12,"url(#coach)","#8B5CF64D",1))
e.append(f'<circle cx="{PAD+22}" cy="{y+24}" r="9" fill="#2A2140"/>')
e.append(t(PAD+22,y+28,"AI",9,"#C4B5FD",700,"middle"))
e.append(t(PAD+40,y+28,"Mot du coach",15,MUTED,600,font=D))
e.append(rect(W-PAD-86,y+14,72,18,9,"#2A2140",PURPLE,0.6))
e.append(t(W-PAD-50,y+27,"IA · bientôt",10,"#C4B5FD",700,"middle"))
e.append(t(PAD+14,y+54,"Bientôt — un mot personnalisé chaque matin selon ta",12,MUTED,400))
e.append(t(PAD+14,y+70,"forme, ta séance et la météo.",12,MUTED,400))
y+=ch+12

# ── 11. Hier ──
ch=96
card(PAD,y,CW,ch)
e.append(t(PAD+14,y+24,"Hier · Trail matinal",15,MUTED,600,font=D))
hc=[("Durée","1h12"),("Allure","5'45"),("FC moy","148"),("D+","420")]
hw=(CW-28-3*8)/4
for i,(lab,val) in enumerate(hc):
    hx=PAD+14+i*(hw+8)
    e.append(rect(hx,y+38,hw,46,10,SURFACE))
    e.append(t(hx+hw/2,y+56,lab,10,MUTED,400,"middle"))
    e.append(t(hx+hw/2,y+76,val,18,TEXT,600,"middle",font=D))
y+=ch

# ── CTA flottant bas (fixe dans l'app) ──
e.append(f'<rect x="0" y="{H-110}" width="{W}" height="110" fill="url(#fade)"/>')
e.append(rect(PAD,H-66,CW,48,14,PRIMARY))
e.append(t(W/2,H-37,"Commencer ma journée  →",16,"#0B0F14",700,"middle"))

e.append("</svg>")
out="/home/user/app-run-mobile/mockups/morning-report/mockup-A-final.png"
cairosvg.svg2png(bytestring="".join(e).encode("utf-8"),write_to=out,output_width=W*2,output_height=H*2)
print("wrote",out)
