---
name: CENA_BLENDER
description: A cena do trailer montada no Blender — céu, sol, névoa, chão, câmeras e configuração de gravação. Ler antes de mexer em luz, atmosfera ou ângulo, e antes de importar o elenco.
sources: [cowork]
aliases: [cena blender, luz do trailer, ceu blender, cameras do trailer, angulos]
---

# CENA DO TRAILER — Blender 5.2.2

Arquivo: `D:\T2\Claude outputs\trailer\trailer_santafe.blend` (salvo)
Motor: **EEVEE Next** · 2560×1440 · 24 fps · AgX · saída PNG 16-bit em `...\trailer\render\SF_####`

---

## 1 · A CHAVE DE LUZ (medida, não chutada)

| | valor |
|---|---|
| Céu | Sky Texture `MULTIPLE_SCATTERING`, altitude 600 m, aerosol 3.2, ozônio 1.0, albedo 0.22 |
| Força do céu | **0.16** |
| Sol | elevação **22°**, azimute **118°**, energia **13.0**, cor `(1.0, 0.83, 0.63)`, ângulo 1.0° |
| Névoa global | caixa `NEVOA_GLOBAL`, densidade base **0.0009**, anisotropia 0.35, cor `(0.30,0.34,0.38)` |

### Três hipóteses testadas, duas mortas

**1. "A névoa está lavando a cena" — REPROVADA.**
Varri a densidade de 0 a 0.0011 e medi o contraste (p95−p05) na mesma câmera:

| névoa | 0.0 | 0.0003 | 0.0007 | 0.0011 |
|---|---|---|---|---|
| contraste | 0.541 | 0.544 | 0.530 | 0.508 |

Variação de 6%. A névoa não era o problema.

**2. "O sol está fraco / na elevação errada" — PARCIAL.**
Varri elevação 9°→18°→26°→35° nos planos de rua: **as quatro imagens saíram iguais.**
Motivo real: aqueles dois enquadramentos estão **debaixo de marquise**. Nunca pegam sol,
em elevação nenhuma. O sweep estava medindo a coisa errada.

**3. "O céu está afogando o sol" — CONFIRMADA, era essa.**
Teste de 4 combinações na mesma câmera:

| | céu | sol | resultado |
|---|---|---|---|
| A | 0.55 | 5.5 | leitoso, sem sombra — **era o estado antigo** |
| B | 0.10 | 5.5 | contraste volta, escuro demais |
| C | 0.10 | 14 | **sombras longas e legíveis** |
| D | 0.25 | 10 | sombra com mais preenchimento |

A proporção estava ~10× pró-céu. Fixei entre C e D.

### E um erro meu de hemisfério
Eu tinha posto o sol vindo do **sudoeste**. Paraná fica a −23,5° de latitude:
**o sol da tarde passa pelo noroeste**, e no inverno passa ao norte até ao meio-dia.
Com o sol no lado errado, todas as fachadas do comércio ficavam de costas pra luz.
Corrigido, as vitrines ganharam sol e sombra dura na hora.

---

## 2 · O CHÃO INFINITO — por que ele existe

As fatias que subimos são **ilhas separadas**. Entre o centro e a periferia há um vão
sem geometria nenhuma: `(60,−280)` não devolve nada num raycast. Qualquer plano que
olhasse por ali mostrava o vazio.

`CHAO_INFINITO`: plano de 12 km em z=4, subdividido, com Displace de 3,5 m e material
de pasto (verde escuro → pasto seco por ruído). Os vãos viraram campo.

> **Consequência dura pro roteiro:** de cima, as bordas retas das fatias aparecem como
> placas verdes retangulares. **Plano aéreo largo entrega que é recorte.**
> O trailer tem que viver na altura do olho e em voo baixo. Isso não é limitação de
> luz, é da geometria que subiu — e casa com o roteiro, que já era de rua.

---

## 3 · ATMOSFERA E FUMAÇA

| Objeto | O que é | Onde |
|---|---|---|
| `NEVOA_GLOBAL` | caixa 1140×1420×180, densidade cai com a altura (potência 3) — névoa que gruda no chão | cobre o mapa todo |
| `FUMACA_MORRO` | coluna de queimada, ruído esticado na vertical, some com a altura | topo do morro `(300,−596)` |
| `FUMACA_CIDADE` | fiapo de chaminé | `(−180,−30)` |

Botão principal da névoa: o nó **MULTIPLY** em `MAT_NEVOA`, entrada 2.
Botão das fumaças: o **MULTIPLY** final em `MAT_FUMACA_*`.

---

## 4 · AS CÂMERAS

Linha do tempo já montada: **1 marcador por plano, câmera amarrada**. Scrub troca a câmera sozinho.

| Plano | Câmera | Frames | Lente | Estado |
|---|---|---|---|---|
| S01_ABERTURA | CAM_01_ABERTURA | 1–96 | 30 mm | ⚠ fraco — mostra borda de fatia |
| S02_RUA | CAM_02_RUA | 97–192 | 40 mm | ✅ **o melhor plano** — comércio, marquise, asfalto |
| S03_MORRO | CAM_03_MORRO | 193–288 | 35 mm | ⚠ fraco — morro pelado, frente vazia |
| S04_PERIFERIA | CAM_04_ALTO | 289–384 | 50 mm | ✅ telhados da favela com o morro atrás |
| S05_CIDADE | CAM_05_CIDADE | 385–480 | 40 mm | ◐ serve de estabelecimento |
| S06_DETALHE | CAM_06_DETALHE | 481–576 | 85 mm | ✅ vitrine com sombra dura |

Total 576 frames = 24 s a 24 fps.

### O que ainda não presta e por quê
- **S01 e S05** pegam ângulo alto demais; as placas das fatias aparecem. Ou baixam pra voo rasante, ou entram fatias novas do mapa.
- **S03** olha pra um morro sem nada em cima. A favela está do lado dele, não em cima. Enquadramento tem que vir do noroeste da favela com os blocos no meio-campo.

### Mapa de altura medido (pra posicionar câmera sem enterrar)
Centro: rua a **z=12**, prédios 24–37.
Periferia: laje da favela **z=12–20**, blocos 30–40; **o morro é a crista sul**, `(280,−620) z=51`.
Vão sem geometria em `y=−560` (costura) e em todo `(60,−280)`.
Raycast antes de posicionar — a CAM_03 nasceu **19 m enterrada** dentro do morro.

---

## 5 · QUANDO O ELENCO CHEGAR

1. Importar `elenco.gltf`.
2. **Rodar o fix de MULTIPLY nos materiais** (ver `PERSONAGENS.md` §6) — senão fardas e a pintura da PM chegam cinzas.
3. Posicionar personagens e veículos nos planos; só então travar enquadramento fino e foco (DOF já ligado na CAM_02 e CAM_06).
