---
name: ASSETS_TRAILER
description: Tudo que precisa existir pra gravar/renderizar o trailer do Santa Fé — regiões do mapa a recortar (com coordenadas medidas), personagens e fardas, veículos, animações, props e o resultado da quarentena da toolbox. Ler antes de exportar qualquer coisa pro Blender.
sources: [cowork]
aliases: [assets trailer, recortes do mapa, o que precisa pro trailer]
---
# ASSETS — Trailer Santa Fé Roleplay

Origem de tudo: place **`85701458730521`** (Santa Fé real) — **SÓ LEITURA**. Nada é alterado lá; tudo é **clonado e exportado**.
Pipeline: Studio ⇄ Blender por HTTP local (skill `porta-malas-nativo`) + regras fixas de transferência (skill `o-olho`: eixo `(x,y,z) → (x,z,−y)`, offset `K` por peça, FBX proibido pra animação, validação obrigatória).

---

## 1 · Regiões do mapa a recortar

Regra: **região inteira e coerente**, nunca peça solta. Ancorar tudo, contar descendentes antes e depois, não alterar o original.
Coordenadas **medidas em 21/09/2026** (raycast de Y=400 pra baixo).

| # | Região | Usada em | Centro medido | Chão Y | Recorte sugerido |
|---|---|---|---|---|---|
| R1 | **Rua N. Sra. Aparecida (ponta SO)** ✅ conferida por foto | P01, P30, P31, P14 | `(-1030..-700, ?, -1199)` | **≈62** | caixa `X −1100..−650`, `Z −1290..−1110` |
| ~~R1 velha~~ | ~~Rodovia do Café~~ | — | — | — | **REPROVADA 21/09**: não é estrada rural, é rua do centro com prédio de vidro e guindaste |
| R2 | **Avenida Paraná (trecho c/ placa)** | P02 | `(-320, ?, -643)` | **43,2** | caixa `X −450..−200`, `Z −750..−550` |
| R3 | **Largo da Feira + R. Fioravante Zavate** | P03 | `(-625, ?, 958)` | **36,7** | caixa `X −750..−450`, `Z 880..1050` |
| R4 | **Praça Santa Fé + Av. Brasil (centro)** | P04, P11 | `(-12, ?, -20)` | **43,8** (praça 71,3) | caixa `X −150..100`, `Z −150..100` |
| R5 | **Periferia (núcleo real)** ✅ conferida por foto | P23–P29 | **`(1275, ?, 1750)`** | **≈72** | `Favela` tem **758 BasePart em 2 núcleos**: o grande em `X 1200..1400 / Z 1650..1850` (467 peças) e um menor em `X 700..850 / Z 900..1100` (188). Recortar o grande. **Não é morro íngreme de laje** — é rua de terra com poste, fiação e parede de tijolo. Melhor vantagem medida por raycast: `cam (1275, 96, 1390)` olhando N/NE (linha de visão LIVRE) |
| R6 | **Trevo do Café** | P06 | `(-11, ?, 1132)` | **36,7** | caixa `X −200..200`, `Z 1000..1300` |
| R7 | **Oficina MEC - CBR** | P12, P13 | `(751, 52, -120)` | **43,8** | a pasta `workspace["MEC - CBR"]` — 104 partes |
| R8 | **Av. Astorga (trecho noturno)** | P20, P21, P22 | `(-338, ?, 92)` | **43,8** | caixa `X −450..−250`, `Z 0..200` |
| R9 | **Av. Getúlio Vargas (calçada leste)** | P15, P17 | `(291, ?, 51)` | **28,4** | caixa `X 200..400`, `Z −50..150` |
| ~~R10~~ | fundiu com a **R1** — é a mesma rua | P14 | — | — | — |
| R11 | **Hotel / base de corporação** | P16 | `(-510, 106, 614)` | **36,3** | a pasta `workspace.Hotel` — 4.485 partes (recortar só a sala) |
| R12 | **Estacionamento (área do lixo)** | P07, P08 | `(-80, 60, 57)` | **44,8** | caixa `X −150..0`, `Z 0..120` |

**Checklist por recorte (obrigatório, skill `o-olho`):**
1. Contar `#GetDescendants()` antes.
2. Clonar pra `ServerStorage.Backups.<regiao>_antes_trailer`.
3. Ancorar tudo.
4. Exportar.
5. Contar descendentes de novo. Divergiu? **para e investiga**, não conserta no olho.
6. Validar por captura **orbitada** (mínimo 3 ângulos), nunca de um ângulo só.

`[LACUNA]` Os envelopes "caixa sugerida" acima são derivados dos pontos medidos, não de um `GetPartBoundsInBox` real de cada recorte. **Medir de verdade na hora de recortar** e corrigir esta tabela.

---

## 2 · Personagens

Base: **`StarterPlayer.StarterCharacter`** — R6, 7 peças, 6 juntas. **Nunca montar rig do zero.**
Roupa/calça/cabelo já vêm aplicados nele. Acervo: **204 camisas, 71 calças, 121 cabelos** em `ReplicatedStorage.Resources.Assets`.

| # | Personagem | Veste | Planos |
|---|---|---|---|
| C1 | Feirante A | camisa + calça comum | P03 |
| C2 | Feirante B | camisa + calça comum | P03 |
| C3 | **Lixeiro** | camisa+calça de `Resources.Roupas` (id a definir) | P07, P08 |
| C4 | **Carteiro** | camisa+calça de `Resources.Roupas` (id a definir) | P14 |
| C5 | **Mecânico** | camisa+calça de `Resources.Roupas` (id a definir) | P12, P13 |
| C6 | Civil do caixa | roupa comum | P11 |
| C7 | Civil do celular | roupa comum | P09, P10 |
| C8 | Civil do chimarrão ×2 | roupa comum | P17 |
| C9 | **PM** | `Vestuarios.PM` | P26, P28, P29 |
| C10 | Suspeito | roupa comum, boné | P21–P29 |

`[FATO]` `Vestuarios` tem **10 conjuntos**: `Samu, PM, PC, PF, CHOQUE, LOJA, ESI, BOPE, ROTAM, Pavuna`.
`[FATO]` **Não existe farda de lixeiro/carteiro/mecânico.** `Vestuarios` só tem os 10 conjuntos de corporação. O uniforme de emprego civil é **camisa + calça do acervo**, que mora em `Resources.Roupas` → 3 módulos: `Camisas`, `Calcas`, `Cabelos`. Montar C3/C4/C5 escolhendo ids desses módulos, e **registrar aqui qual id foi usado em cada um** pra o trailer e o jogo combinarem.

**Como vestir:** reproduzir o caminho do jogo (`PegarEmprego...` → `VerVestuario`, `Client.GuiHandler.RoupasHandler` / `.CabelosHandler`), **nunca vestir na mão**.

---

## 3 · Animações

`[FATO]` 105 clipes em `Resources.Assets.Animations`, carregados por nome pelo `AnimationHandler`. Os que o trailer usa:

| Clipe | Plano |
|---|---|
| `Correr` | P24, P27 |
| `Agachar` / `Agachar Andando` | P24 (se couber) |
| `Segurando Lixo` | P07, P08 |
| `Segurando Carta` | P14 |
| `Segurando Celular` | P09, P10 |
| **`Segurando Chimarrao`** / **`Tomando Chimarrao`** | **P17** |
| `Segurando Algema` | P28 (o PM) |
| `Sendo Algemado` / `Algemado Idle` | P28, P29 (o suspeito) |
| pose de drive-by (`DriveByAnim`, montada por `Motor6D/C0`, não é clipe) | P25 |

**Movimento:** andar **12**, correr **18** (Shift), agachado **8**, rendição **4**. Pulo `JumpPower 40` com cooldown de 3s.
**`TiltHandler` LIGADO em toda gravação.** É a inclinação de corpo ao correr, e é ela que faz o personagem não ler como boneco.

---

## 4 · Veículos

`[FATO]` 21 modelos em `Assets.Carros`: `Corolla, Trator, Saveiro, Trailblazer, AMG, Fusca, Lamborghini, Civic, Hilux, Kombi, Palio, BMW, R1200, M4, Uno, S10Turbo, SaveiroP, S10, Prisma, BMWDEV, GolG6`. Mais 38 chassis em `Resources.Chassis` e 53 veículos em `workspace.VeiculosGovernamentais`.

| # | Veículo | Plano | Nota |
|---|---|---|---|
| V1 | **Trator** | P01 | o plano de abertura inteiro depende dele |
| V2 | **Fusca** | P12, P13 | **capô e tampa de motor abrem de verdade** (refeito no Blender, 16/09) |
| V3 | **Kombi** | P04 | `[FATO]` **não existe ônibus** — conferido em `Assets.Carros` (21) e `Resources.Chassis` (38), 21/09. Kombi no lugar. |
| V4 | Ambulância (governo) | P15 | `workspace.VeiculosGovernamentais` |
| V5 | **Prisma** | P20–P23 | `[FATO]` só 6 carros têm porta-malas funcional: **Fusca (+60), Prisma (2G/3P/3I, −70), GolG6, Corolla (−40), Trailblazer, AMG**. Uno, Palio e Kombi **não têm** — por isso Prisma. |
| V6 | Carro do drive-by | P25 | qualquer 4 portas |
| V7 | Viatura PM | P26, P29 | giroflex ligado |

**Regra do trailer:** `Lamborghini`, `AMG`, `BMW`, `M4` **NÃO aparecem.** Supercarro importado é o que faz servidor BR parecer todos os outros. A frota do trailer é **Fusca, Kombi, Uno, Saveiro, Palio, Trator** — e é ela que sustenta a tese "cidade do interior".

---

## 5 · Clima e luz

| Item | Estado | Onde |
|---|---|---|
| Névoa situacional | **existe** | `ClimaService` / `ClimaPerfis` (19/09) |
| Chão de terra molhado | **existe** | correção de 19/09 |
| **Chuva** | **existe** — `[FATO]` | `ServerScriptService.ClimaService` (filho direto, **não** está em `Server.Services`). Chuva com níveis, chance maior à noite; a névoa sobe **depois** que ela para (90s subindo / 150s no pico / 600s abrindo) |
| Humor do dia | existe | `ReplicatedStorage.DiaClima`: limpo 35% / normal 45% / úmido 20%. Dia limpo ×0,2 de chuva; úmido ×1,9 |
| **Luz noturna por bairro** | existe | à noite o Centro vira âmbar de vapor de sódio (`OutdoorAmbient 31,36,49 → 78,63,45`, Brightness 0,60→0,82) e a zona rural escurece (`→ 24,29,41`, Bri 0,50). **Reproduzir isso no Blender** — é o que faz a cidade parecer cidade e o morro parecer morro |
| Iluminação | corrigida em 18/09 | `01_Especificacoes/Iluminacao.md` |

**Valores de Lighting que valem (não reverter no render):** `ExposureCompensation 0.25`, `EnvironmentDiffuseScale 0.35`, `Atmosphere.Haze 1.6`, `Glare 0.30`, `Decay (104,112,124)`, `Bloom.Threshold 1.70 / Intensity 0.80 / Size 24`. Teto de brilho das luzes = **5**.
No Blender, **reproduzir essa chave de luz**, não a padrão do Cycles — senão o trailer não parece o jogo nem quando alguém entrar.

---

## 6 · Props da toolbox

**Nenhum até agora.** Todos os props do roteiro (placa de rua, lona de feira, caixote, caixa eletrônico, poste, lixeira, cone) **já existem no mapa**.

**Se precisar de algum, a quarentena é obrigatória:**
1. Inserir num lugar isolado, nunca no mapa.
2. **Remover TODO `LuaSourceContainer`** — inclusive os escondidos dentro de `KeyframeSequence`.
3. Conferir nomes que imitam propriedade: já foram achadas **7 backdoors** neste projeto, com nomes `PoseTexture`, `CoreTextureHandler`, `LightConfig`, `EasyConfiguration`.
4. **Nunca executar.** Sempre purgar. Sempre reportar o que achou nesta seção.

| Prop | Origem | Quarentena | Resultado |
|---|---|---|---|
| *(nenhum ainda)* | — | — | — |

---

## 7 · Armadilhas medidas (não repetir)

1. **`Model:PivotTo` não põe o HumanoidRootPart no lugar.** O pivô de um dummy pode ficar **1,5 stud abaixo** dele. Sempre corrigir com um segundo `PivotTo` pela posição real do `HumanoidRootPart` — senão os bonecos afundam no chão e você só descobre na foto.
2. **Permissão de asset.** Place de dev = conta `masternerdtop` (2362538543, gameId 10767332482). Santa Fé real = conta `OQgnqyQXNGW` (6132612931, gameId 10767108673). **Contas diferentes** → asset privado não carrega fora da experiência dona. Como o trailer é renderizado no Blender a partir da place real (só leitura), **isso deixa de ser problema** — mas se algum dia precisar montar cena em Studio, o problema volta.
3. **Animação "não toca"?** Antes de olhar código: rodar `InsertService:LoadAsset(id)` e comparar `game.CreatorId`. Uma chamada separa "bug meu" de "permissão".
4. **Som:** `Assets.Sons` tem 39 sons, quase todos de recarga de arma. **Não existe biblioteca de ambiência no jogo** — chuva, sirene e rádio vêm de fora. Ver `TRILHA.md`.

---

## 8 · Ordem de execução sugerida

1. ~~Fechar as lacunas de uniforme, chuva, ônibus e porta-malas~~ — **fechadas em 21/09**. Resta escolher os ids de camisa/calça de C3, C4 e C5.
1b. **Fotografar as 9 locações que ainda não foram conferidas** (R2, R3, R4, R6, R7, R8, R9, R11, R12). Conferidas até agora: R1 ✅ e R5 ✅. Método barato que funcionou: achar por raycast a posição de câmera com linha de visão livre ANTES de fotografar, em vez de chutar enquadramento (chutar custou 2 fotos jogadas fora).
2. Recortar **R1 (Rua N. Sra. Aparecida)** primeiro — é P01, P30, P31 e P14, ou seja, **o primeiro e o último frame**. Locação já conferida por foto em 21/09: avenida larga vazia, árvore dos dois lados, morro fechando o fundo. Se esse recorte não ficar bonito no Blender, o trailer inteiro muda.
3. Recortar **R5 (Favela)** — é 8 dos 32 planos.
4. Depois o resto, na ordem do roteiro.
5. Contact sheet: **uma captura orbitada por plano**, olhada, anexada ao `ROTEIRO_TRAILER.md`. Sem foto, o veredito é `PENDENTE`.
