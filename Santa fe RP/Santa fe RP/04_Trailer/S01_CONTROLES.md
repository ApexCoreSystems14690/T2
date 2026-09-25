---
name: S01_CONTROLES
description: Onde fica cada controle do plano S01 (rua da Barbearia) no trailer_santafe.blend — o que mexer pra mudar carro, rodas, andarilho e câmera. Ler antes de animar qualquer coisa nessa cena.
sources: [cowork]
---

# S01 — a rua da Barbearia: o que mexer

Arquivo: `D:\T2\Claude outputs\trailer\trailer_santafe.blend`
Backup de antes das fatias: `trailer_santafe_ANTES_FATIAS.blend`
Linha do tempo: **frames 1 a 192, 24 fps** (8 segundos)

## Onde está cada coisa

| Coleção | O que tem |
|---|---|
| `FATIA_astorga` e as outras 5 | a cidade, 20.404 peças separadas |
| `S01_CARRO` | `V_Hilux` (o controle) + 12 peças de carroceria + `RODA_1..4` |
| `S01_CENA` | `CAM_S01_RUA`, `RIG_ANDARILHO`, `SOL_TRAILER`, as 6 peças do corpo `LX_*` |
| `CARROS_SEPARADOS` | os 5 carros crus do `Carros.obj`, escondida. É daqui que sai carro novo |

## O CARRO

`V_Hilux` é um **Empty de setas**. Tudo do carro é filho dele — mexeu nele, mexeu no carro inteiro.

- **Onde ele passa:** 2 keyframes na `location`, frame 1 em `x = -132` e frame 191 em `x = -78,167`. `y = -33` (meio da avenida), `z = 12,10` (a rua, medida por raycast).
- **Mais rápido / mais devagar:** arrasta o keyframe 191 no Dope Sheet. Mais perto do 1 = mais rápido.
- **Muda a trajetória:** seleciona `V_Hilux`, vai pro frame que quiser, move com `G`, e `I → Location`.
- **Trocar de carro:** liga `CARROS_SEPARADOS`, escolhe outro (os 5 estão em fila no eixo X), e refaz o mesmo esquema. Os grupos de roda são `Mesheswheels1-4` (BOPE preto), `5-8`, `9-12`, `13-16` (a branca, a que está em cena) e `Tire1-4`.

## AS RODAS

Não têm keyframe. Giram sozinhas por **driver**, ligado na posição X do carro:

```
rotation_euler[1] = (x - (-132.0)) / 0.4611
```

`0,4611` é o raio da roda em metros (medido: 3,293 studs x 0,28 / 2). `-132` é onde o carro começa.

- **Se você mudar de onde o carro parte**, troca o `-132` pelo novo X inicial nos 4 drivers, senão a roda começa já girada.
- **Se a roda girar pro lado errado** (dá pra ver em velocidade, não em foto parada), põe um menos: `-(x - (-132.0)) / 0.4611`.
- **Roda de outro tamanho:** mede o diâmetro em studs, multiplica por 0,28, divide por 2, e põe no lugar do `0,4611`.
- Pra editar: seleciona a roda → aba Object → botão direito em Rotation Y → **Edit Driver**.

## O ANDARILHO

`RIG_ANDARILHO` é um Empty. `LX_Torso` é filho dele, e cabeça/braços/pernas são filhos do torso.

- **Por onde ele anda:** 96 keyframes na `location` do rig, de `x = -101` até `x = -114,53`, `y = -38,6` (calçada), `z` balançando entre 12,23 e 12,26 — é o sobe-e-desce do passo.
- **Velocidade:** 1,71 m/s. Pra mudar, escala os keyframes no Dope Sheet (`S` com tudo selecionado).
- **Mudar o caminho:** mexe só no `RIG_ANDARILHO`. O corpo vai junto.
- **A animação de andar** vive nas rotações de `LX_PernaE/D`, `LX_BracoE/D`, `LX_Torso` e `LX_Cabeca` — 96 keyframes cada, ciclo de 4 passos. Perna vai de -24° a +24°, braço de -17,6° a +17,6°.
- **Cuidado:** se mudar a velocidade do rig sem mudar a do ciclo, o pé patina no chão.

## A CÂMERA

`CAM_S01_RUA`, lente 50 mm, sensor 72 mm (o mesmo da viewport do Blender — é o que faz o enquadramento bater com o que você vê).

- 2 keyframes: frame 1 em `(-119,84 / -27,31 / 13,78)`, frame 192 em `(-119,38 / -30,48 / 13,78)`. A rotação Z vai de -138,8° a -145,4°.
- É a deriva lenta em direção ao poste, pra servir de transição.
- **Mais movimento:** mexe só no keyframe do frame 192.

## Altura do chão (medido por raycast, não chutado)

| Onde | z |
|---|---|
| Avenida Presidente Getúlio Vargas (a rua) | **12,10** |
| Calçada em `y = -38` | **12,23** |
| Câmera | 13,78 (1,68 m acima da rua) |

Qualquer coisa nova que você puser na rua vai em `z = 12,10`. Na calçada, `12,23`.

## Luz

- `SOL_TRAILER`: energia 13, cor (1,0 / 0,83 / 0,63), elevação 22°, azimute 118°
- Mundo: céu x 0,35
- O **ambiente chapado do Roblox** (`OutdoorAmbient` 0,2745) não está no mundo — está na **Emission de cada material**, porque no Blender a luz do mundo é ocluída e a do Roblox não é. Se mexer nisso, mexe no Emission Strength, não no mundo.
