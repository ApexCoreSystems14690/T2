---
name: PIPELINE_BLENDER
description: A ponte Studio -> Blender do trailer do Santa Fé — como mandar região do mapa direto pro Blender sem passar pelo chat, a regra de eixo, o filtro obrigatório das lajes de terreno e o que já foi provado em 21/09. Ler antes de recortar qualquer região nova.
sources: [cowork]
aliases: [ponte blender, pipeline trailer, recortar regiao]
---
# PIPELINE Studio → Blender (trailer)

Provado funcionando em **21/09/2026**. Blender **5.2.2 LTS**, EEVEE.

## Arquivos

| Arquivo | O que é |
|---|---|
| `D:\T2\Claude outputs\trailer\ponte_studio.py` | **o receptor.** Rodar no Blender (Scripting → Run) **toda vez que reabrir** — sobe um servidor HTTP na 8767 |
| `D:\T2\Claude outputs\trailer\trailer_santafe.blend` | a cena salva (R1 + câmera do P01 + sol + névoa) |
| `D:\T2\Claude outputs\trailer\blender_R1.py` | importador do OBJ, pra quando houver malha de verdade |

## Como funciona

O Studio **empurra** a geometria pro Blender. Nada passa pelo chat — 605 peças foram em 3 POSTs.

```lua
game:GetService("HttpService"):PostAsync(
  "http://127.0.0.1:8767/R1",
  HttpService:JSONEncode({ limpa = true, p = { {x,y,z,sx,sy,sz,rx,ry,rz,r,g,b,transp}, ... } }),
  Enum.HttpContentType.ApplicationJson)
```

- `limpa = true` no **primeiro** lote de uma região (apaga e recria a coleção); `false` nos seguintes.
- Lotes de **250 peças**. `HttpService.HttpEnabled = true` (já está).
- O caminho vira o nome da coleção no Blender: `/R1`, `/R5`, `/R7`…

## Regra de eixo (skill `o-olho`)

`Roblox (X, Y, Z) → Blender (X, −Z, Y) × 0.28`

1 stud = **0,28 m**. Converter em metros importa: é o que faz lente, DOF e névoa se comportarem.
**Conferido:** a câmera do P01 em Roblox `(-1030, 66, -1199)` caiu em Blender `(-288.40, 335.72, 18.48)` — exato, e 1,4 m acima do chão.

## ⚠ O FILTRO OBRIGATÓRIO — a armadilha que custou 3 voltas

`GetPartBoundsInBox` devolve a peça **inteira** se o bounding dela encosta na caixa. O mapa tem lajes de terreno de **1.524 studs**. Sem filtro elas vão junto, empilham por cima de tudo e **a câmera fica enterrada** — medido: só **7,5% dos vértices** no quadro e o render sai leite.

**Sempre pular peça com lado > 150 studs**, e mandar no lugar **uma laje fina do tamanho da região**, na altura de chão medida por raycast.

Resultado com o filtro: 37 gigantes pulados, bbox saiu exatamente no envelope esperado (`x −324..−97 · y 285..378 · z 15,9..33,3` em metros).

## Blockout serve pra quê (e pra quê não)

**Serve** pra travar enquadramento, trajetória de câmera, altura, lente e atmosfera — tudo isso é caixa cinza e funciona.
**Não serve** pra julgar se o plano é bonito. Pra isso precisa da malha de verdade: árvore, poste, fiação, tijolo.

## Malha de verdade — o caminho

O blockout monta **caixa** a partir de posição+tamanho+rotação. MeshPart e Union viram a caixa delimitadora, não a forma. Pra ter a forma:

**No Studio:** selecionar a região (eu seleciono por script) → `File → Export Selection...` → salvar em `D:\T2\Claude outputs\trailer\<REGIAO>.obj`
**No Blender:** rodar `blender_R1.py` (ou o equivalente da região).

Foi assim que o Fusca nativo foi feito (`Documents\fusca.obj`), então é caminho já provado no projeto.

## Chave de luz — reproduzir o jogo, não o padrão do Cycles

Valores que ficaram bons no blockout da manhã de névoa:

| | |
|---|---|
| Engine | EEVEE, volumetria ligada (`volumetric_end 2000`, 96 samples) |
| View transform | **AgX**, exposição **−0,35** |
| Sol | energia 3,4 · cor `(1.0, 0.80, 0.58)` · elevação ~6° · rotação 250° |
| Céu | Sky Texture `MULTIPLE_SCATTERING` (**`NISHITA` não existe no Blender 5.x** — dá erro de enum), força do Background **0,30** |
| Névoa | cubo com Volume Scatter, densidade **0,0028**, anisotropia **0,6** |

Densidade 0,010 num cubo de 370 m satura tudo em branco — medido e reprovado.

## Estado em 21/09

| | |
|---|---|
| ✅ Ponte Studio→Blender | funcionando, 605 peças / 3 POSTs |
| ✅ Conversão de eixo e escala | conferida pela posição da câmera |
| ✅ Filtro das lajes | achado e resolvido |
| ✅ Chave de luz da manhã | blockout do P01 com composição legível |
| ⬜ Malha de verdade | falta o `R1.obj` (Export Selection no Studio) |
| ⬜ Outras 11 regiões | dependem de fotografar a locação primeiro |

---

# EXPORT glTF DO STUDIO — o caminho real (22/09)

O blockout por caixa foi **descartado**: ele reconstrói uma aproximação em vez de transferir o que existe. O certo é o export do Studio, que leva **malha, material, textura e Union** de verdade.

## Por que glTF e não OBJ
glTF carrega material PBR e textura junto. OBJ depende do .mtl e costuma perder mapa.

## O passo a passo (interface do Studio, em português)

1. Selecionar as peças (por script: `game:GetService("Selection"):Set(lista)`).
2. Menu **Arquivo** → **Exportar como glTF**.
3. Diálogo *"Personalize sua exportação"*: `Skinning` ✔ · **`Texturas` ✔ (já vem marcado)** · `Anexos` ✔ · `Gaiolas` ✘.
   O botão fica **"Processando…"** por ~20s antes de virar **"Exportar"** — esperar, não clicar duas vezes.
4. Aparece *"Revisar problemas"*: alguns assets não exportam por permissão. No centro deram 3 malhas
   (`6404054977` em 16 instâncias, `6705476487` em 2, `472766660` em 2). Clicar **"Exportar restantes"** —
   o resto sai normal.
5. Diálogo **Salvar como**: o campo **Nome** aceita caminho completo. **Clicar no campo e dar `Ctrl+A` antes de digitar** —
   `triple_click` NÃO seleciona o texto existente e o caminho sai grudado em "Export".

## ⚠ O TETO: 4.301 peças DERRUBA o Studio

Medido em 22/09: selecionei o centro (caixa 400×300×400 em `(-12, 80, -20)`, **4.301 peças** depois de tirar as lajes)
e mandei exportar como glTF com textura. O Studio **travou e fechou** — sumiu da barra de tarefas e o MCP parou de
listar instância. Nenhum arquivo foi gerado.

**Conclusão: fatiar bem menor.** Ordem de trabalho: começar em ~500 peças, conferir que o arquivo saiu, e só então
subir (1.000 → 2.000) até achar o teto real desta máquina. Anotar o teto aqui quando achar.

Contagens já medidas, pra planejar a fatia:

| Região | Peças |
|---|---|
| R1 Rua N. Sra. Aparecida (corredor 770×120×260) | 605 |
| Periferia (600³ em `1275, 90, 1750`) | 3.472 |
| Centro 400³ | 4.315 ← **derrubou** |
| Centro 700³ | 10.117 |
| Centro 1200³ | 25.327 |
| Mapa inteiro | 149.401 |

`[OPINIÃO]` A cidade inteira de uma vez está fora de cogitação por um fator de ~30. O caminho é bairro por bairro,
juntando tudo no mesmo `.blend`.

## Observação: o Studio está pedindo atualização
Ao tentar abrir uma segunda instância, apareceu *"The version of Roblox Studio is out of date. Please close all
instances and reinstall from create.roblox.com/dashboard/creations"*, e a janela tem um botão vermelho
**"Falha na atualização"**. Pode estar contribuindo pra instabilidade — vale atualizar antes de insistir em export grande.

---

# FATIAS — o cubo de bolo (22/09)

Pedido do Julio: fatia como **quadrado cortado no meio de um bolo** — **100% do que está dentro vai**, pequena,
**mas com os arredores**. (A tentativa por frustum foi descartada: escolhia peças a dedo, não é fatiar.)

## Como é feito
**Nada do original é movido.** A região é clonada, agrupada num Model e o clone sobe **+2.000 studs em Y**.
X e Z ficam idênticos — a conta de câmera continua valendo, é só somar 2.000 em Y.
Vive em `workspace.TRAILER_ILHAS.FATIA_<nome>`, ancorado, com script/ProximityPrompt/Sound removidos do clone.
Clonar em vez de mover evita o risco de uma republicação levar a cidade furada pro servidor ao vivo.

## A REGRA (chegou na 3ª tentativa)

| Caso | O que acontece |
|---|---|
| Peça com **lado ≤ 300 studs** que encosta no cubo | **vai INTEIRA** |
| **Terreno gigante** (> 300, caixa alinhada ao eixo) | **cortado na parede do cubo** |
| **Gigante não-cortável** (morro, Union, malha) | inteiro **se o centro estiver dentro** |

### Os três erros que essa regra conserta

**1. Tamanho local ≠ tamanho no mundo.** Peça rotacionada tem extensão no mundo diferente do `Size`. Usar `Size.X`
como meia-largura faz rua e chão saírem **compridos pra fora do cubo** em vez de cortados. A meia-extensão real é
`|r00|·sx/2 + |r01|·sy/2 + |r02|·sz/2` por eixo, com os componentes de rotação do CFrame.

**2. Cortar tudo que atravessa deixa a fatia oca.** Julio, vendo a foto: *"cadê o asfalto e a parte de trás das
lojas?"* — o asfalto tinha sido descartado (rotacionado, não era caixa, o corte falhou) e as lojas ficaram serradas
ao meio mostrando o vazio, porque prédio não tem fundo modelado. **Prédio não se corta. Só o terreno.**

**3. Pequeno demais é inútil.** A 1ª `nsaaparecida` saiu com 300 studs / 286 peças: um posto solto num tapete verde.
Julio: *"assim é inutilizável, precisa ter seus arredores."*

## Tamanho: medir antes de escolher

A densidade varia MUITO por bairro. Contagem por lado (medida 22/09):

| local | 300 | 450 | 600 | 800 | 1000 |
|---|---|---|---|---|---|
| nsaaparecida | 295 | 1.474 | 3.729 | 4.755 | 7.419 |
| parana | 474 | 1.078 | 1.925 | 3.396 | 7.907 |
| oficina | 995 | 2.611 | 4.959 | 8.237 | 12.319 |
| astorga | 1.640 | 3.253 | 4.943 | 8.667 | 16.567 |
| praca | 2.833 | 5.000 | 7.817 | 11.793 | 17.954 |
| periferia | 4.840 | 9.759 | 14.184 | 18.862 | 24.025 |

**Alvo: 2.000–3.000 peças por fatia.** É contexto de sobra e fica longe das 4.301 que derrubaram o Studio.
Um lado fixo não serve: a periferia precisa de 200 studs pro mesmo peso que a nsaaparecida precisa de 550.

## As 6 fatias

| Fatia | Centro (x, z) | Lado | Y | Peças |
|---|---|---|---|---|
| `FATIA_parana` | −280, −630 | 600 | 25..150 | **2.008** |
| `FATIA_oficina` | 770, −120 | 450 | 25..150 | **2.599** |
| `FATIA_astorga` | −400, 92 | 400 | 25..150 | **2.837** |
| `FATIA_praca` | −12, −20 | 300 | 25..170 | **2.848** |
| `FATIA_nsaaparecida` | −900, −1199 | 550 | 40..170 | **2.995** |
| `FATIA_periferia` | 1275, 1700 | 200 | 45..185 | **3.004** |

**Conferido por foto:** a astorga tem asfalto, calçada de ladrilho, faixa, canteiro com banco e lixeira, e as lojas
sólidas (Barbearia New Era legível). A nsaaparecida a 550 studs tem a base com a frota estacionada, prédio com
ar-condicionado no telhado, praça arborizada, cruzamento e o centro no fundo.

## Como exportar
Selecionar o Model → `Arquivo → Exportar como glTF` → esperar virar "Exportar" → "Exportar restantes" →
salvar em `D:\T2\Claude outputs\trailer\<nome>.gltf`.
No Blender, descer tudo **−2.000 em Y** (ou lembrar do offset ao posicionar a câmera).

## Limpeza
`workspace.TRAILER_ILHAS:Destroy()`. **Apagar antes de publicar o place.**

---

## O MORRO — improvisado, porque Union não se corta (22/09)

Julio: *"a favela ainda tá pouca dms, precisa ter pelo menos um pedaço pequeno em cima do morro, o morro precisa ir, pode improvisar"*.

O morro é `UnionOperation` gigante. Não cabe no cubo e não dá pra cortar. Então **eu reconstruo o morro**:
varredura do chão por raycast numa grade, e a grade vira **uma única MeshPart** via `EditableMesh`.

```lua
local em = AssetService:CreateEditableMesh()
-- ids[i][j] = em:AddVertex(Vector3.new(x, alturaDoChao, z))
-- em:AddTriangle(a, c, b)  e  em:AddTriangle(a, d, c)
local morro = AssetService:CreateMeshPartAsync(Content.fromObject(em),
                 {CollisionFidelity = Enum.CollisionFidelity.Box})
```

Resultado: **1.000 × 1.000 studs, 144 studs de desnível, 5.000 triângulos, UMA peça.**
Como é 1 peça só, o morro pode ser muito maior que o cubo construído — a favela vai densa no meio e a paisagem vai larga em volta.

### As três armadilhas, todas medidas

**1. O raycast bate em telhado e copa de árvore.** A malha sobe de repente e a paisagem fica cheia de espinhos pretos.
Conserto: o raio só aceita peça **grande (> 60 studs)** e de material de chão (Grass, Ground, Asphalt, Concrete, Rock…).
Se bater em outra coisa, essa peça entra no filtro de exclusão e o raio continua descendo — até 14 vezes.

**2. Sobra pico e buraco mesmo assim.** Dois passes de mediana 3×3 (troca a célula que difere > 22 studs da mediana
das vizinhas) e depois 6 passes tapando célula vazia pela média das vizinhas. Ficou **0 vértice vazio**.

**3. Winding invertido deixa o morro PRETO.** Numa grade onde `i` é X e `j` é Z, o triângulo `(i,j) → (i+1,j) → (i+1,j+1)`
tem normal apontando pra **baixo** — só se vê o avesso. O certo é `AddTriangle(a, c, b)` e `AddTriangle(a, d, c)`.
(`DoubleSided = true` de garantia.)

### A fatia da periferia ficou

| Parte | Peças |
|---|---|
| `MORRO` (MeshPart reconstruída, 1000 studs) | 1 |
| núcleo da favela — cubo 200 em (1250, 1690) | 2.932 |
| pedaço no alto do morro — cubo 120 em (1370, 1840) | 532 |
| **TOTAL** | **3.465** |

`[OPINIÃO]` Essa receita do morro serve pra qualquer fatia que precise de paisagem: custa 1 peça e resolve o fundo.
