---
name: ELENCO_EXPORT
description: O que está montado e pronto pra exportar pro Blender — personagens, veículos, itens — e o que medi sobre cada um. Ler antes de exportar ou de escolher veículo pra um plano.
sources: [cowork]
aliases: [elenco do trailer, o que exportar, veiculos do trailer, itens do trailer]
---

# ELENCO DO TRAILER — pronto pra exportar

Tudo vive em `Workspace.TRAILER_ILHAS`, em 3 pastas.
**1.039 partes no total** — bem abaixo das ~4.300 que travaram o Studio antes,
então dá pra exportar tudo numa seleção só.

| Pasta | Objetos | Partes |
|---|---|---|
| `PERSONAGENS` | 10 | 136 |
| `VEICULOS` | 14 | 794 |
| `ITENS` | 17 | 109 |

Os 41 objetos já ficam **selecionados** no Studio.
→ `Arquivo → Exportar seleção como glTF` → `elenco.gltf`

---

## 1 · VEÍCULOS (14)

Fileira em Z=2660, do X=−110 ao X=252, cada um espaçado pela largura real.

**Frota civil** (regra do vault: sem Lamborghini, AMG, BMW, M4 — supercarro importado
é o que faz servidor BR parecer todos os outros):

`Trator` · `Fusca` · `Kombi` · `Uno` · `Saveiro` · `Palio` · `Prisma` · `Corolla` · `Hilux`

**Governo** (1 de cada, de `workspace.VeiculosGovernamentais`):

`Duster PM` · `S10 Brigada` · `HiluxBope` · `Ambulancia`

**Helicóptero:** clonado do `workspace.Heli` mais completo (63 partes).
Existem 3 no workspace + 1 em `ServerStorage.Heli` (74 partes, maior, mas é o de reserva).
`[FATO]` 43 × 15 × 50 studs — é o maior objeto do elenco de longe.

> **Achado que serve ao trailer:** a `S10 Brigada` vem com a pintura real da
> **Polícia Militar do Paraná** — amarelo e branco, brasão do estado, "POLÍCIA MILITAR"
> na porta, número de prefixo. Isso sozinho já planta "interior do Paraná" num plano.
> Giroflex presente e renderizando.

### Trato dado em cada clone
- Todas as partes `Anchored = true` (senão a solda puxa a peça de volta quando se move o CFrame — foi exatamente o bug que fez os itens esticarem 8.000 studs).
- Todo `Script`/`LocalScript` `Disabled = true`.
- Posicionado por delta do bounding box, não por `PivotTo` acumulado.

---

## 2 · ITENS (17)

Fileira em Z=2620, X=−80 a 64.

**Armas** (`Resources.Armas`): MT40 · IA2 · Glock · FAL · AK47 · T4 · PT 92 · CAR15 ·
Boito 84 · Revolver · Escudo · Faca

**Uso** (`Vestuarios.Samu.Usaveis` + PM): Maleta médica · Barricada · Cone · Maca · Algema

### Duas armadilhas que peguei montando isso
1. **Mover peça não-ancorada com solda = ela volta.** Ancorar TUDO primeiro, mover depois.
   Sintoma: o item "mede" 8.000 studs de span depois de posicionado.
2. **Tool guarda peça-fantasma longe do Handle.** O `Boito 84` tinha uma peça a 180 studs
   (muzzle/ghost guardado noutra coordenada). Regra: descartar `BasePart` a mais de
   12 studs do `Handle`.

Orientação normalizada: `Handle` com rotação zerada, resto mantendo o offset relativo.

---

## 3 · MALHAS QUE FALHAM NO PRELOAD MAS EXPORTAM ASSIM MESMO

`ContentProvider:PreloadAsync` acusou **26 MeshId e 8 TextureId** em falha no elenco.
**Não é mesh quebrada — é a armadilha de permissão de asset.** Os assets são de outra
conta; o Studio tem eles em cache local e renderiza e exporta normal.
Conferido por foto: o giroflex da `S10 Brigada` reprovou no preload e **está lá, visível.**

> Diferença que importa: **roupa** que falha no preload some de verdade (deixa o
> personagem pelado). **Malha** que falha no preload continua desenhando do cache.
> Não tratar os dois casos igual.

Os IDs que acusam: giroflex (`10525581744`, `10525586991`, `10525598223`),
suportes (`10525708751`, `10525712840`), vidro do Trator (`1787935505/6029`),
carroceria da Ambulância (`9473811614`, `9473826655`), `T4.Part11` (`12707836670`).

---

## 4 · NO BLENDER

Importar `elenco.gltf` e **rodar o fix de material MULTIPLY** — o mesmo dos personagens.
Sem ele as viaturas chegam cinzas e a pintura da PM do Paraná se perde, que é
justamente o que faz o plano funcionar.

Ver `PERSONAGENS.md` §6 pro código.
