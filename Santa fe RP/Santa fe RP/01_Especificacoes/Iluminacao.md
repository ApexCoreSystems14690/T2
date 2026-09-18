---
name: Iluminacao
description: A correção de luz do Santa Fé (18/09) — por que tudo parecia neon, os valores antigos e novos do Lighting, o teto de brilho das luzes e o critério de quem pode ser Neon. Ler antes de mexer em Lighting, Bloom, Atmosphere ou material de peça.
sources: [cowork]
aliases: [luz, lighting, neon, bloom, atmosfera, brilho, exposicao]
---
# Iluminação — a correção de 18/09

> Queixa do Julio: *"todas estão com uma cor muito intensa e forte, ao meio dia a luz
> tá praticamente deixando tudo ao redor neon"*. Não era culpa de trabalho recente —
> é assim desde sempre.

## O diagnóstico (medido, não chutado)
Três coisas **somando**, não uma:

1. **`ExposureCompensation = 1`** (o padrão do Roblox é 0). Isso é **1 EV**: dobra a
   luz da cena inteira **antes** do Bloom. Aí tudo passa do limiar do Bloom (que estava
   em 1.99) e vira borrão branco. **Era o motor do problema.**
2. **438 luzes acima do brilho 5**, incluindo 48 `SurfaceLight` em **17.5** (asset de
   free model — o pai se chama literalmente *"Put this inside your block."*) e 41
   `SpotLight` em **20** com alcance 60. Uma lâmpada realista no Roblox fica entre 1 e 3.
3. **6.014 peças com material Neon**, incluindo a **pintura de rua** (faixa de pedestres,
   setas, linhas). Neon ignora iluminação e **emite** luz — por isso a faixa brilhava
   sozinha no escuro.

## A armadilha que quase me pegou
Baixar a exposição resolveu o estouro, mas o Julio notou na hora: *"parece que perdeu
aquela intensidade atmosférica, a mistura da luz com ambiente"*. E ele estava certo —
o `EnvironmentDiffuseScale` estava em **0**, ou seja, **a cena nunca teve luz de
ambiente**: só sol direto, sombra chapada. A exposição estourada estava **fingindo
atmosfera**. A correção certa é dar atmosfera de verdade, não subir a exposição.

## Valores — Lighting
| Propriedade | Antes | Agora | Por quê |
|---|---|---|---|
| `ExposureCompensation` | **1** | **0.25** | 1 EV lavava tudo; 0.25 dá um toque |
| `EnvironmentDiffuseScale` | **0** | **0.35** | o céu passa a iluminar as sombras |
| `Atmosphere.Haze` | 0 | **1.6** | profundidade no ar |
| `Atmosphere.Glare` | 0 | **0.30** | halo do sol, sem lavar |
| `Atmosphere.Decay` | branco (1,1,1) | **104,112,124** | horizonte com cor |
| `Bloom.Threshold` | 1.99 | **1.70** | só o que é claro floresce |
| `Bloom.Intensity` | 1.00 | **0.80** | — |
| `Bloom.Size` | 26 | **24** | — |
| `Brightness` | 3 | **3 (intocado)** | quem manda nele é o `ClimaHandler` em Play |
| `Atmosphere.Density` | 0.341 | **0.341 (intocado)** | — |

## Teto de brilho das luzes
**438 luzes** com `Brightness > 5` foram travadas em **5**. Soma de brilho do mapa:
**3872 → 2190 (−43%)**. Nada mais foi tocado: alcance, cor e quem está ligada seguem iguais.

| Quantas | O quê | Era | Virou |
|---|---|---|---|
| 314 | `SpotLight` | 6.0 | 5 |
| 48 | `SurfaceLight` (Taxiway Light) | **17.5** | 5 |
| 41 | `SpotLight` (Lampada) | **20.0** | 5 |
| 26 | `PointLight` | 8.3 | 5 |
| 9 | resto | 11.6–12.6 | 5 |

## Critério do Neon (o Julio delegou a decisão)
**Pode ser Neon:** lâmpada, letreiro, farol de carro, giroflex, tela, placa luminosa —
e qualquer peça que tenha uma `Light` dentro.
**Não pode:** pintura de chão. Faixa de pedestres não emite luz.

Filtro aplicado — peça Neon que seja **clara** (média RGB > 0.75) **+ fina** (Y < 0.8)
**+ comprida** (maior lado > 2.5) **+ horizontal** (±12°) **+ sem `Light` dentro**
**+ sem palavra de luz no nome nem no pai** (`lamp, luz, light, bolb, bulb, neon, led,
farol, giro, tela, letreiro, placa, screen`).

**512 peças** viraram `SmoothPlastic`. Neon no workspace: **6.014 → 5.502**.
O filtro protegeu de propósito: **121** que tinham `Light` dentro, 8 com nome de luz,
3.868 que não eram pintura clara.

## Como reverter (tudo é reversível peça a peça)
- Lighting: os valores antigos estão na tabela acima, e também em atributos
  `QA_orig_*` no próprio `Lighting`.
- Cada luz mexida tem o atributo **`QA_brilho_orig`** com o valor antigo.
- Cada peça despromovida tem o atributo **`QA_material_orig` = "Neon"**.

## Em aberto
- **`ClockTime`**: no Edit está **0** (meia-noite), que é o valor que já estava. Em Play
  quem escreve é o ciclo do Realism Mod. Não mexi.
- As 5.502 peças Neon que sobraram nunca foram auditadas uma a uma — se aparecer outro
  ponto estourando, é por aí que se procura.
- `Atmosphere.Density 0.341` não foi tocada; se a névoa incomodar de dia, é esse número.
