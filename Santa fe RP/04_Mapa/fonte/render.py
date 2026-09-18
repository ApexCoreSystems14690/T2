# -*- coding: utf-8 -*-
import re, math, sys
from PIL import Image, ImageDraw, ImageFont

X0, Z0, P, CEL, W = -2100, -1875, 6, 24, 164
LADO = 650 * P
PX = 3000
S = PX / LADO
MASK = sys.argv[1] if len(sys.argv) > 1 else "mask_limpa.txt"
SAIDA = sys.argv[2] if len(sys.argv) > 2 else "santafe_malha.png"

def T(x, z): return ((x - X0) * S, (z - Z0) * S)

BG=(13,17,23); QUART=(62,71,85); PATIO=(41,48,59)
VIA=(236,241,247); TERRA=(198,166,118); TXT=(233,238,244)
FRACO=(120,132,148); PONTO=(255,193,58)

img = Image.new("RGB", (PX, PX), BG); d = ImageDraw.Draw(img)

for b, l in enumerate(open(MASK, encoding="utf-8").read().strip().split("\n")):
    a = 0
    for m in re.finditer(r"([.#o])(\d*)", l):
        c = m.group(1); n = int(m.group(2)) if m.group(2) else 1
        if c in "#o":
            x1, z1 = T(X0 + a*CEL, Z0 + b*CEL); x2, z2 = T(X0 + (a+n)*CEL, Z0 + (b+1)*CEL)
            d.rectangle([x1, z1, x2, z2], fill=QUART if c == "#" else PATIO)
        a += n

def pontos(toks):
    out = []
    for t in toks:
        i, j = t.split(","); out.append(T(X0 + (int(i)+0.5)*P, Z0 + (int(j)+0.5)*P))
    return out

vias = []
for l in open("vias.txt", encoding="utf-8").read().strip().split("\n"):
    p = l.split(); vias.append((p[0], int(p[1]), pontos(p[2:])))

for passo in (0, 1):
    for tipo, larg, pts in vias:
        w = max(3, int(larg*S) + 7) if passo == 0 else max(2, int(larg*S))
        cor = BG if passo == 0 else (VIA if tipo == "R" else TERRA)
        d.line(pts, fill=cor, width=w, joint="curve")
        for x, y in pts: d.ellipse([x-w/2, y-w/2, x+w/2, y+w/2], fill=cor)

F = "/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf"
def fonte(t, b=False): return ImageFont.truetype(F % ("-Bold" if b else ""), t)
f_bai, f_via, f_poi, f_tit, f_sub = fonte(42, True), fonte(26, True), fonte(26, True), fonte(56, True), fonte(28)

ocupado = []
def livre(cx, cy, w, h):
    x1, y1, x2, y2 = cx-w/2-6, cy-h/2-4, cx+w/2+6, cy+h/2+4
    for a in ocupado:
        if not (x2 < a[0] or a[2] < x1 or y2 < a[1] or a[3] < y1): return None
    return (x1, y1, x2, y2)

def texto(xy, s, f, cor, ang=0, teste=True):
    bb = d.textbbox((0, 0), s, font=f); w, h = bb[2]-bb[0], bb[3]-bb[1]
    if ang: w, h = h, w
    cx, cy = xy
    cx = min(max(cx, w/2+10), PX-w/2-10); cy = min(max(cy, h/2+10), PX-h/2-10)
    r = livre(cx, cy, w, h)
    if teste and not r: return False
    if r: ocupado.append(r)
    if ang:
        tmp = Image.new("RGBA", (1400, 140), (0,0,0,0)); td = ImageDraw.Draw(tmp)
        for dx in (-2,-1,0,1,2):
            for dy in (-2,-1,0,1,2): td.text((700+dx,70+dy), s, font=f, fill=BG+(255,), anchor="mm")
        td.text((700,70), s, font=f, fill=cor+(255,), anchor="mm")
        tmp = tmp.rotate(ang, resample=Image.BICUBIC, center=(700,70))
        img.paste(tmp, (int(cx)-700, int(cy)-70), tmp)
    else:
        for dx in (-2,-1,0,1,2):
            for dy in (-2,-1,0,1,2): d.text((cx+dx, cy+dy), s, font=f, fill=BG, anchor="mm")
        d.text((cx, cy), s, font=f, fill=cor, anchor="mm")
    return True

import os
nomes = [] if os.environ.get("SEMNOMES") else open("nomes.txt", encoding="utf-8").read().strip().split("\n")

# 0) bairros ao fundo
for l in nomes:
    if l.startswith("BAI "):
        _, x0, x1, z0, z1, *nm = l.split(); nm = " ".join(nm)
        texto(T((int(x0)+int(x1))/2, (int(z0)+int(z1))/2), nm.upper(), f_bai, (86,98,114), teste=False)

# 1) nomes de rua (prioridade)
for l in nomes:
    if l.startswith("VIA "):
        _, eixo, c, de, ate, larg, *nm = l.split(); nm = " ".join(nm)
        c, de, ate = int(c), int(de), int(ate); meio = (de+ate)/2
        alvo = (meio, c) if eixo == "LO" else (c, meio)
        for f in (0.5, 0.3, 0.7, 0.15, 0.85):
            v = de + (ate-de)*f
            xy = T(v, c) if eixo == "LO" else T(c, v)
            if texto(xy, nm, f_via, TXT, ang=0 if eixo == "LO" else 90): break

# 2) POIs e pontos, sem repetir nome perto
pts = []
for l in nomes:
    if l[0] in "PN" and l[1] == " ":
        p = l.split(); pts.append((int(p[1]), int(p[2]), " ".join(p[3:]), l[0]))
usados = []
for x, z, nm, k in pts:
    if any(n == nm and (x-a)**2+(z-b)**2 < 260**2 for a, b, n in usados): continue
    usados.append((x, z, nm))
    px, pz = T(x, z); r = 10
    d.ellipse([px-r, pz-r, px+r, pz+r], fill=PONTO, outline=BG, width=3)
    ocupado.append((px-r-3, pz-r-3, px+r+3, pz+r+3))
    for dy in (-30, 32, -50, 52):
        if texto((px, pz+dy), nm, f_poi, TXT): break


d.rectangle([24,24,860,150], fill=(9,12,17), outline=(46,55,68), width=3)
d.rectangle([24,PX-150,700,PX-24], fill=(9,12,17), outline=(46,55,68), width=3)
fl=fonte(24)
itens=[(VIA,"rua asfaltada"),(TERRA,"estrada de terra"),(QUART,"quarteirao / casas"),(PONTO,"ponto de interesse")]
for k,(cor,nm) in enumerate(itens):
    y=PX-124+k*30
    d.rectangle([48,y-9,86,y+9], fill=cor)
    d.text((102,y), nm, font=fl, fill=FRACO, anchor="lm")
d.rectangle([0,0,PX-1,PX-1], outline=(38,46,58), width=6)
for dx in (-2,-1,0,1,2):
    for dy in (-2,-1,0,1,2):
        d.text((48+dx,42+dy), "SANTA FÉ", font=f_tit, fill=BG, anchor="la")
        d.text((48+dx,106+dy), "malha de ruas · 3900 × 3900 studs · norte = topo", font=f_sub, fill=BG, anchor="la")
d.text((48,42), "SANTA FÉ", font=f_tit, fill=TXT, anchor="la")
d.text((48,106), "malha de ruas · 3900 × 3900 studs · norte = topo", font=f_sub, fill=FRACO, anchor="la")
cx, cy = PX-110, 120
d.polygon([(cx,cy-52),(cx-18,cy+22),(cx,cy+6),(cx+18,cy+22)], fill=TXT)
d.text((cx,cy+50), "N", font=fonte(30, True), fill=TXT, anchor="mm")
img.save(SAIDA); print("ok", SAIDA)
