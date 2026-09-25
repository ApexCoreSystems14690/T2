---
name: ALFA_QUEBRADO
description: Por que parede e calçada somem ao trocar o modo de visualização no Blender, e como consertar. Ler sempre que algo aparecer em SOLID mas sumir em Material Preview ou Rendered.
sources: [cowork]
aliases: [parede sumindo, calcada sumindo, alfa quebrado, transparencia roblox, solid vs rendered]
---

# PAREDE E CALÇADA SUMINDO — alfa quebrado no glTF do Roblox

## O sintoma

Em **Solid** aparece tudo. Ao trocar pra **Material Preview** ou **Rendered**,
parede, toldo e calçada somem — e no lugar da calçada aparece a **grama** que está por baixo.

Motivo: **Solid ignora o material.** Material Preview e Rendered não.

## A causa, medida

O exportador glTF do Studio escreve PNG com canal alfa, e o importador do Blender
liga esse alfa na entrada **Alpha** do Principled. Quando a textura vem com o alfa
zerado, a superfície fica invisível.

`[FATO]` No mapa: **1602 de 1621 materiais** com Alpha ligado na textura.
Varrendo as **332 imagens** únicas que alimentam Alpha, **7 estavam quebradas**:

| Imagem | Alfa médio | Materiais afetados |
|---|---|---|
| `Part1_diff.png` | **0.002** | 85 |
| `Meshesbalcao61_diff.png` | **0.002** | 31 |
| `Part745_diff.png` | 0.002 | 1 |
| `Head8_diff.png` | 0.023 | 1 |
| `Head6_diff.png` | 0.035 | 2 |
| `Head4_diff.png` | 0.038 | 1 |
| `Part4324_diff.png` | 0.080 | 3 |

**124 materiais** no total. Duas imagens respondem por 116 deles.

## O conserto

Para cada material cujo Alpha vem de uma imagem com **média < 0.10 e mais de 95% dos
pixels transparentes**: desliga o link e põe `Alpha = 1.0`.

```python
al = bsdf.inputs['Alpha']
for lk in list(al.links): mat.node_tree.links.remove(lk)
al.default_value = 1.0
```

O corte de 0.10 importa: **textura com alfa misturado é recorte de verdade**
(alambrado, folhagem, grade) e não pode ser mexida. Alfa uniformemente perto de zero
é defeito. Foi por isso que medi média **e** fração transparente, não só a média.

## O efeito colateral que veio junto

Com o toldo transparente, a luz do sol **atravessava** e a galeria ficava iluminada.
Depois do conserto o toldo faz sombra de verdade e a vitrine escureceu — fisicamente certo,
visualmente morto.

Aumentar a força do céu **não resolve**: testei 0.16 / 0.45 / 0.90 e as três saíram iguais,
porque o toldo bloqueia o céu junto com o sol.

**Solução:** luz de rebote, que é o que um diretor de fotografia faz.
`LUZ_REBOTE_RUA` — Area, retângulo 24 × 6 m, em `(-108, -35, 13.0)` apontada pra
`(-108, -43.5, 14.2)`, cor `(1.0, 0.93, 0.84)`, **sem sombra**, **6000 W**.

`[FATO]` A potência tem que ser alta: a 12 m, 900 W dá ~4% da força do sol e não muda nada
na imagem. Testei 2.000 / 6.000 / 15.000 — 2k ainda é fraco, 15k estoura os pilares brancos.

> Conta pra dimensionar rebote: `E ≈ alvo_em_W/m² × 4π × distância²`.
> Preencher sombra a 20% de um sol de 13 W/m², a 12 m, pede ~4.700 W.

## Como conferir de novo

1. `View › Viewport Render Animation` renderiza com o material de verdade (Solid mente).
2. Durante o **play**, o EEVEE derruba qualidade pra segurar o frame rate — não julgue por ali.
   Arraste o cabeçote quadro a quadro, ou renderize a prévia.
