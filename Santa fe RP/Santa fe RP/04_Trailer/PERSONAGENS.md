# PERSONAGENS DO TRAILER — regras medidas, não inventadas

> Local no Studio: `Workspace.TRAILER_ILHAS.PERSONAGENS` (10 models, 752 instâncias)
> Última verificação: 22/09/2026

---

## 1. A REGRA DO KIT COMPLETO

Cargo nenhum sai só de farda. O kit de cada corporação vem de
`ReplicatedStorage.Resources.Vestuarios[CORP]` e tem estas subpastas
(**nem toda corp tem todas** — Samu não tem Chapeu nem Colete):

```
Vestuarios[CORP]
 ├── Uniformes    -> Shirt + Pants
 ├── Chapeu       -> Accessory (HatAttachment)
 ├── Colete       -> Accessory legacy (AttachmentPoint, sem Attachment no Handle)
 ├── Acessorios   -> Accessory (cinto, braçal, máscara, óculos, rádio, luva, mochila)
 └── Usaveis      -> Tool  (ARMAS SAIEM DAQUI, não de Resources.Armas)
```

**Erro já cometido:** inventei nomes de acessório (`BoinaPM`, `ColetePM`, `CintoPM`)
e apliquei em todas as corps. Só existem em PM. PC ficou pelado.
→ **Sempre ler a pasta da corp antes de montar.**

### Inventário real por corp

| Corp | Acessorios | Chapeu | Colete | Uniformes | Usaveis |
|---|---|---|---|---|---|
| PM | 6 | 1 | 1 | 23 | 6 |
| BOPE | 18 | 12 | 2 | 8 | 6 |
| PC | 9 | 3 | 6 | 17 | 7 |
| Samu | 4 | — | — | 7 | 4 |

### Kits montados e conferidos

```
P_PM   = PM/Padrão            + BoinaPM      + ColetePM           + {CintoPM, BracalPM}                            + PT 92
P_BOPE = BOPE/Operacional     + Boina BOPE   + Colete BOPE Preto  + {Balaclava BOPE Camuflada, Mochila BOPE}       + MT40
P_PC   = PC/DHPP              + —            + ColeteDHPP         + {CintoPC, Rádio}                               + Glock
P_SAMU = Samu/Medico Socorrista + Bone       + —                  + {LuvaD, LuvaE}                                 + Maleta médica
```

---

## 2. MATEMÁTICA DE ENCAIXE (duas vias, e as duas são usadas)

O jogo usa dois tipos de acessório. Em modo Edit `Humanoid:AddAccessory`
**não posiciona nada** (não roda física) — o Handle fica na origem, a ~3300 studs.
Posicionar na mão:

**A) Acessório moderno — Handle tem Attachment:**
```lua
handle.CFrame = parteDoCorpo.CFrame * attDoCorpo.CFrame * attDoHandle.CFrame:Inverse()
```
Casar pelo **nome** do Attachment. Nomes que existem no corpo R6:
`Head`: HairAttachment, HatAttachment, FaceFront/Center ·
`Torso`: Neck, BodyFront/Back, Left/RightCollar, WaistFront/Center/Back ·
`Right Arm`: RightShoulder, RightGripAttachment · idem esquerdo.

**B) Acessório legacy — Handle SEM Attachment (todos os Coletes):**
```lua
handle.CFrame = head.CFrame * acc.AttachmentPoint:Inverse()
```
Os Coletes usam `AttachmentPoint.Position = (0, 1.8, 0)` relativo à **Head**.

Depois: `handle.Anchored = true; handle.CanCollide = false`.

**Ordem importa:** girar o personagem (`PivotTo`) DEPOIS de encaixar
desalinha tudo. Gira primeiro, encaixa depois.

**Posicionar model sem acumular erro:**
```lua
m:PivotTo(CFrame.new(pos))
local hrp = m:FindFirstChild("HumanoidRootPart")
if hrp then m:PivotTo(m:GetPivot() + (pos - hrp.Position)) end
```

---

## 3. ROUPA QUE NÃO CARREGA — a causa do "civil pelado"

`Shirt.ShirtTemplate` preenchido **não garante** que a textura exista.
Assets de marca foram moderados e somem em silêncio: o console não reclama,
o personagem só aparece com a pele nua.

**Teste que resolve (único jeito de medir):**
```lua
local st = {}
game:GetService("ContentProvider"):PreloadAsync(objs, function(id, s) st[id] = tostring(s) end)
-- st[template] == "Enum.AssetFetchStatus.Success" / "...Failure"
```

### Varredura completa do catálogo (22/09/2026)

| Pasta | Total | OK | Falha |
|---|---|---|---|
| `Resources.Assets.Camisas` | 204 | **181** | 23 |
| `Resources.Assets.Calcas` | 71 | **59** | 12 |

**Camisas mortas (23):** Moletom BMW Preta · Pijama Batman · Manga Longa Brasil/Supreme ·
Camisa Corinthians S4 · Camisa Manchester · Camisa PSG Preta · Corta-Vento Lacoste Branco/Preto ·
Camisa PSG Home · Camisa Barcelona · Camisa PSG · Camisa PSG Preta v3 · Camiseta Corinthians ·
Manga Longa Preta/Branca · Camisa Brasil · Camisa Manchester Home · Camisa Corinthians L4 ·
Moletom Tommy Hilfiger · Camisa Barcelona v2 · Camisa PSG LS · Cropped gotica · Terno Elon ·
Upi Camisa · Camisa Grota

**Calças mortas (12):** Calça jeans vintage · Bermuda BMW · Calça Preta Barred · Calça aesthetic ·
Shorts azuis · Calça Adidas · Calça jeans butterflys · Calça xadrez · Calça jeans branca ·
Bermuda Nike · Pijama Batman · Upi Calça

> Padrão claro: **roupa de marca / clube é o que morre.** Peça genérica sobrevive.

**Correções aplicadas:**
- `P_Civil1`: Moletom BMW Preta + Bermuda BMW → **Camisa xadrez bege + Calça jeans bege**
- `P_Lixeiro`: Calça jeans vintage → **Calça Jeans AF**
- Varredura final nos 10 personagens: **105 assets checados, 0 falhas.**

---

## 4. CABELO

Todo Accessory do jogo fica em `Color = 163,162,165` (cinza pedra médio) —
inclusive o do `StarterCharacter`. **A cor do cabelo vem da textura**, não da Part.
Então não dá pra escolher cabelo escuro pelo nome nem pela propriedade:
tem que **olhar**.

**Método:** contact sheet — 40 cabeças com pele parda numa grade 10×4,
uma screenshot, lê-se claro vs escuro de uma vez.

**Claros confirmados (evitar num RP do interior):**
Cabelo10 · Cabelo13 · Cabelo18 · Cabelo31 · Cabelo32 · Cabelo33 · Cabelo34 ·
**Cabelo38 (branco)** · Cabelo47 · Cabelo49

**Escuros confirmados (pool seguro):**
Cabelo1 · 2 · 3 · 4 · 11 · 12 · 14 · 15 · 16 · 17 · 19 · 20 · 21 · 22 · 23 ·
24 · 26 · 30 · 35 · 36 · 37 · 39 · 40 · 41 · 42 · 43 · 44 · 45

Distribuídos: Lixeiro=22 · Carteiro=16 · Mecanico=41 · Civil1=24 ·
Civil2=3 · Suspeito=15 · PC=19 · SAMU=40.
PM e BOPE não levam cabelo (boina / balaclava).

---

## 5. PELE — interior do Paraná

Paleta de 10 tons, peso em pardo/marrom, poucos claros:

```
(120,84,62) (150,108,76) (96,66,50) (168,124,92) (139,98,70)
(198,160,130) (110,78,58) (158,116,84) (128,90,66) (182,142,110)
```

---

## 6. EXPORTAÇÃO PRO BLENDER

1. Os 10 models já ficam selecionados no Studio (`Selection:Set`).
2. Julio: `Arquivo → Exportar seleção como glTF` → `personagens.gltf`.
3. **No Blender, rodar o fix de material MULTIPLY** — senão as fardas chegam cinzas:
   o importador liga a textura direto no Base Color e mata a cor da Part.
   Textura Roblox é quase-cinza de propósito, ela foi feita pra multiplicar.

```python
mix = nt.nodes.new("ShaderNodeMix"); mix.data_type='RGBA'; mix.blend_type='MULTIPLY'
mix.inputs['Factor'].default_value = 1.0
nt.links.new(tex.outputs['Color'], socket_A)      # socket nome 'A', tipo RGBA
socket_B.default_value = cor_original_do_base_color
nt.links.new(mix_out, bsdf.inputs['Base Color'])
```
