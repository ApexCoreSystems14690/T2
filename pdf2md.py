"""Converte os PDFs de regulamento do Santa Fé (gerados em reportlab) para o
markdown simples que o site renderiza nativo.

Formato de saída:
  ## Capítulo N · Título
  ### Subtítulo
  Art. 1.1 [NOVO] — texto com **negrito**
  - item de lista
  | Cab A | Cab B |      (tabela; "•" dentro da célula vira lista)
  > nota (parágrafo solto fora de artigo)
"""
import sys, re, pdfplumber

def linhas_da_pagina(p):
    tabelas = p.find_tables()
    caixas = [t.bbox for t in tabelas]
    def dentro(w):
        cx, cy = (w['x0'] + w['x1']) / 2, (w['top'] + w['bottom']) / 2
        return any(b[0] - 2 <= cx <= b[2] + 2 and b[1] - 2 <= cy <= b[3] + 2 for b in caixas)
    words = p.extract_words(extra_attrs=['fontname', 'size'], keep_blank_chars=True, x_tolerance=1.5, use_text_flow=True)
    out = []
    for w in words:
        if dentro(w): continue
        if w['top'] < 45 or w['bottom'] > p.height - 40: continue        # cabeçalho / rodapé
        if out and abs(out[-1]['top'] - w['top']) < 2.5:
            out[-1]['ws'].append(w)
        else:
            out.append({'top': w['top'], 'bottom': w['bottom'], 'ws': [w]})
    itens = []
    for l in out:
        itens.append(('linha', l['top'], l))
    for t in tabelas:
        itens.append(('tabela', t.bbox[1], t.extract()))
    itens.sort(key=lambda x: x[1])
    return itens

def texto_linha(l):
    partes = []
    for w in sorted(l['ws'], key=lambda w: w['x0']):
        b = 'Bold' in w['fontname']
        t = w['text']
        if partes and partes[-1][1] == b: partes[-1][0] += ' ' + t
        else: partes.append([t, b])
    s = ''
    for t, b in partes:
        t = t.strip()
        if not t: continue
        s += (' ' if s else '') + (f'**{t}**' if b else t)
    return re.sub(r'\*\*\s*\*\*', ' ', s).strip()

def info(l):
    w = l['ws'][0]
    return w['size'], w['fontname']

def celula(c):
    c = (c or '').replace('\n', ' ')
    c = re.sub(r'\s+', ' ', c).strip()
    return c.replace('|', '/')

def converter(caminho, pular_paginas=2):
    pdf = pdfplumber.open(caminho)
    md = []
    bloco = None          # parágrafo em construção: [tipo, texto, bottom]
    cap_num = None
    def fecha():
        nonlocal bloco
        if bloco:
            t = re.sub(r'\s+', ' ', bloco[1]).strip()
            t = t.replace('** **', ' ')
            if bloco[0] == 'li': md.append('- ' + t.lstrip('•').strip())
            elif bloco[0] == 'p' and not t.startswith('Art.'): md.append('> ' + t)
            else: md.append(t)
            md.append('')
        bloco = None
    for pi, p in enumerate(pdf.pages):
        if pi < pular_paginas: continue
        for tipo, top, x in linhas_da_pagina(p):
            if tipo == 'tabela':
                fecha()
                for i, row in enumerate(x):
                    md.append('| ' + ' | '.join(celula(c) for c in row) + ' |')
                    if i == 0: md.append('|' + '---|' * len(row))
                md.append('')
                continue
            l = x
            size, font = info(l)
            raw = ' '.join(w['text'] for w in sorted(l['ws'], key=lambda w: w['x0'])).strip()
            txt = texto_linha(l)
            m = re.match(r'^CAP[ÍI]TULO\s+(\d+)', raw)
            if m: fecha(); cap_num = m.group(1); continue
            if size >= 15:
                fecha(); md.append(f'## Capítulo {cap_num} · {raw}' if cap_num else f'## {raw}'); md.append(''); cap_num = None; continue
            if 'Bold' in font and size >= 10 and not raw.startswith('Art.'):
                fecha(); md.append('### ' + raw); md.append(''); continue
            novo = raw.startswith('Art.') or raw.startswith('•')
            colado = bloco and (l['top'] - bloco[2]) < size * 1.25
            if novo or not colado:
                fecha()
                bloco = ['li' if raw.startswith('•') else ('art' if raw.startswith('Art.') else 'p'), txt, l['bottom']]
            else:
                bloco[1] += ' ' + txt; bloco[2] = l['bottom']
    fecha()
    s = '\n'.join(md)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s

if __name__ == '__main__':
    print(converter(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 2))
