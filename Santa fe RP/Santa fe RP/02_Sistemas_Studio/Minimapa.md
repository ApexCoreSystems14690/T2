# Minimapa (client) — F3 volta 5, núcleo puro

- Path: `StarterPlayer.StarterPlayerScripts.Client.Minimapa` (casca) + filho `N`.
- Dados: `ReplicatedStorage.MapaModelo` (geometria) + `ReplicatedStorage.Shared.MapaDados` (pontos),
  ambos gerados por `ServerStorage.AssarMapa`.
- Sobe dentro de `Hud.iniciar()`, em `task.spawn` + `pcall` — se o minimapa
  falhar, **o resto da HUD não cai**.
- Relógio próprio: `RenderStepped` (acompanha a **câmera**, não o servidor).

## O que o N decide (puro, roda por loadstring)
- `raioDe(dirigindo)` → 150 / 300 · `altura(raio, fov)` → altura da câmera
- `ZOOM_MAPA` + `zoomSeguinte(atual, passo)` — os degraus do mapa grande do celular
- `ponto(dx,dz,raio,janela)` → x, y em px do centro **e se saiu do recorte**
- `girar` · `anguloDaCamera` · `dentroDoMapa`
- `CORPOI` / `corDoPonto(tipo)` / `noMinimapa(tipo)` — tipo novo = uma linha
- `deveSumir(estado)` → some com algemado / caído / tela cheia

## Como a casca desenha (v7 — cartografia)
`ViewportFrame` + `WorldModel` com as quadras perto do jogador. A luz é **chapada
de propósito**: `Ambient` branco + `LightColor` preto, então a laje aparece na cor
dela, sem sombra e sem hora do dia — a cor já carrega o significado.
A câmera mira o **plano do mapa** (`MapaModelo:GetAttribute("Y0")`), não a altura
do jogador: subir um prédio ou um morro não pode mudar o recorte.
Por quadro:
1. um `CFrame` na câmera do viewport (posição = você, altura = zoom, `up` = sua direção);
2. troca de quadras **só quando muda o conjunto**;
3. os pontos convertem mundo→tela por `cam.CFrame:PointToObjectSpace` — nada de
   adivinhar ângulo, usa o CFrame que acabou de ser setado.

Ponto fora do recorte **some** (grudar na borda é pro objetivo; com 22 pontos a
borda virava colar de bolinha — medido).

## Contrato
Lê atributo, como o resto da HUD: `Algemado`, `Morte`, `TelaCheia` no Player,
`ColeteDurabilidade` no Character. `Humanoid.SeatPart` diz se está dirigindo —
o cliente descobre sozinho, nenhum atributo novo pro servidor manter.

## Custo medido
- 23.322 peças no modelo, **1.667 a 2.117 desenhadas** por vez (quadras de 244 studs).
- FPS: **~11%** alternando o ViewportFrame ligado/desligado em Play.
- **Em aberto:** o `MapaModelo` fica em `ReplicatedStorage`, então replica pra todo
  cliente, e `StreamingEnabled` está ligado. A medição de memória em Play Solo deu
  inconclusiva (o cliente já tem 120.689 peças ali). Ver [[Entrega_Julio]].

---

## `Client.GuiHandler.Celular.Mapa` — o app do mapa grande (18/09)

- Path: `StarterPlayer...Client.GuiHandler.Celular.Mapa` (o `Celular:Init()` requer
  todo filho automaticamente — app novo = um ModuleScript ali, mais nada).
- UI: `StarterGui.Main.Celular.Telas.Mapa` (Topo/Fecha · Janela · Endereco ·
  Menos · Zoom · Mais · Centrar) + botão `Celular.Buttons.Mapa` (LayoutOrder 11).
- **Não clona nada.** Usa `Minimapa.emprestar()` / `Minimapa.devolver()`.
- Relógio: `Heartbeat` a cada 0,25 s **só enquanto aberto** (segue o jogador, não a
  câmera) + redesenho quando `Janela.AbsoluteSize` muda (a tela abre por tween:
  no instante do `abrir()` a janela ainda mede 0 px).

### API pra quem for mexer
`Mapa.abrir()` · `Mapa.fechar()` · `Mapa.redesenhar()` · `Mapa.aberto()` ·
`Mapa.estado()` → `{zoom, cx, cz, emprestada}` · `Mapa.desenhando()` → quadras, peças.

### Armadilha nova, anotada
**Tween não anda com o Studio sem foco.** `TweenSize` devolve `true` e o tamanho
nunca sai de 0 — vale pro app novo e pro `Notas` que já existia, ou seja, não é
bug do código. Medição de UI em Play com a janela do Studio atrás: **setar `Size`
na mão** e chamar o redesenho, nunca esperar o tween.


---

## v7 — o que mudou no módulo (18/09)

- `Minimapa.montarSeta(pai, larg, alt)` — a setinha clássica, compartilhada com o
  app do celular. Escada de barrinhas, **sem rotação nos filhos**
  (`ClipsDescendants` não corta filho rotacionado — a 1ª versão virou losango).
- `Minimapa.emprestar()` / `.devolver()` / `.emprestada()` — o mapa grande do
  celular usa **as mesmas quadras**; não existe segunda cópia da cidade.
- Câmera e projeção dos pontos passam a usar `Y0` (o plano do mapa), não `pos.Y`.
- `ViewportFrame` com fundo `17,19,23` (o mesmo `fundo` da paleta) e luz chapada.

### Custo medido (v7)
- Modelo: **18.642 lajes**, **0 MeshPart, 0 Union** (a v6 tinha 23.322 e meshes).
- Minimapa em Play: **9 quadras / 2.250 lajes** desenhadas.
- App do celular no zoom 900: **190 lajes**; no 1950, a cidade inteira.


---

## v9 — o assador virou uma GRADE lida do mundo (18/09)

Dois módulos em `ServerStorage`:

- **`MapaGrade`** — o motor. `params()` · `grade(cx,cz,lado,passo)` → matriz de
  categorias · `costurar(cat,N)` → retângulos · `bloco(...)` → assa um pedaço
  direto nas quadras · `recorte(cx,cz,lado,passo)` → põe um pedaço no workspace
  pra fotografar · `tirarRecorte()`.
- **`AssarMapa`** — orquestra. `inicio()` · `bloco(bi,bj)` (4×4 blocos) · `fim()`
  (pontos + `MapaDados`) · `previa()` / `tirarPrevia()`.

### Os números que governam o desenho (todos em `MapaGrade`)
| Campo | Hoje | O que faz |
|---|---|---|
| `PASSO` | 3 | studs por célula — o botão de detalhe/peso |
| `JANELAS` | 2,4,8,16 | janelas do filtro progressivo, em células |
| `LIMIAR_BASE` / `LIMIAR_RAMPA` | 1,5 / 0,20 | o limiar cresce com a janela: ladeira passa, parede não |
| `MANCHA_MIN` | 26 | abaixo disso a mancha alta é tralha e some |
| `FURO` | 5 | quantas superfícies perfurar numa célula alta |
| `BANDA_CHAO` | 7 | quanto acima do chão local ainda conta como chão |
| `MARGEM` | 60 | sobra varrida em volta de cada bloco, pra emenda não aparecer |

### Ordem de decisão de uma célula (é esta ordem que faz a rua ganhar)
1. superfície de cima, atravessando vegetação;
2. **se já é `via`/`terra`, acabou** — rua elevada continua rua;
3. filtro progressivo diz se está "alto";
4. mancha pequena → perfura e usa o chão;
5. mancha grande → perfura; **achou rua no nível do chão, a rua ganha**; senão, construção;
6. sal-e-pimenta (célula solta vira o vizinho) — **`via` e `terra` nunca são apagadas por ele**.

### Custo medido
- Varredura: ~50 mil raycasts/s. Bloco de 975 studs a passo 3: ~3s.
- Mapa inteiro: **28.606 lajes**, todas `Part` de caixa.


---

## v10 — a rua ganha de tudo, e a rua tem cor (18/09)

Os números que governam o desenho, todos em `ServerStorage.MapaGrade`:

| Campo | Hoje | O que faz |
|---|---|---|
| `PASSO` | 3 | studs por célula — o botão de detalhe/peso |
| `JANELAS` | 2,4,8,16 | janelas do filtro progressivo, em células |
| `LIMIAR_BASE` / `LIMIAR_RAMPA` | 1,5 / 0,20 | limiar cresce com a janela: ladeira passa, parede não |
| `ESPIADA` | 6 | studs que toda célula de chão duro olha pra baixo caçando asfalto (mata decalque) |
| `MANCHA_MIN` | 26 | abaixo disso a mancha alta é tralha e some |
| `BURACO_MAX` | 260 | ilha cercada de rua até este tamanho vira rua |
| `VIA_MIN` | 130 | mancha de rua menor que isso é pátio, não rua |
| `FURO` | 5 | superfícies perfuradas numa célula alta |
| `BANDA_CHAO` | 7 | quanto acima do chão local ainda conta como chão |
| `QUANTIZA` | 16 | passo da cor real da rua (menos cor = costura melhor) |
| `RAMPA` | âmbar | a cor real da rua passa por aqui guardando o brilho |
| `MARGEM` | 60 | sobra varrida em volta de cada bloco |

### Ordem de decisão de uma célula
1. superfície de cima, atravessando vegetação;
2. **espiada rasa** — achou asfalto até 6 studs abaixo? era decalque, vale a rua;
3. **se já é `via`/`terra`, acabou** — rua elevada continua rua;
4. filtro progressivo diz se está "alto";
5. mancha pequena → perfura e usa o chão;
6. mancha grande → perfura; **achou rua no nível do chão, a rua ganha**; senão, construção;
7. **buraco cercado de rua vira rua**;
8. **mancha de rua pequena demais vira pátio**;
9. sal-e-pimenta — **`via` e `terra` nunca são apagadas por ele**.

### Como rodar
```lua
local A = loadstring(game.ServerStorage.AssarMapa.Source)()   -- loadstring, NÃO require
A.inicio()
for i = 0, 3 do for j = 0, 3 do A.bloco(i, j) end end
A.fim()
```
`A.previa()` / `A.tirarPrevia()` põem o mapa no workspace pra fotografar;
`MapaGrade.recorte(cx, cz, lado, passo)` faz só um pedaço — foi assim que cada
volta da v8/v9/v10 foi ajustada.


---

## v11 — região da rua viva, e mapas mais perto (18/09)

| Campo | Onde | Hoje | O que faz |
|---|---|---|---|
| `PASSO` | `MapaGrade` **e** `AssarMapa` | 2 | studs por célula. **Os dois têm o campo** — mudar só um não faz efeito |
| `ESPIADA` | `MapaGrade` | 6 | studs perfurados caçando asfalto sob decalque |
| `FURO_FUNDO` | `MapaGrade` | 60 | studs perfurados caçando rua sob teto/passarela |
| `QUANTIZA` | `MapaGrade` | 12 | passo da cor real da rua |
| `RAIO` | `Minimapa.N` | 75 / 150 | a pé / dirigindo |
| `ZOOM_MAPA` | `Minimapa.N` | 100·200·400·900·1950 | degraus do celular |

### A perfuração é por EXCLUSÃO, não por passo
```lua
fora[#fora+1] = r.Instance          -- tira a peça atingida
par.FilterDescendantsInstances = fora
r = workspace:Raycast(mesmo_ponto_de_400, baixo, par)
```
Descer 0,35 stud a partir do topo começava **abaixo** de um decalque de 0,05 e o
asfalto era pulado. Excluindo a peça não existe erro de espessura.

### Cor
`cor[i][j]` é gravado **só pra célula de rua**, e é sempre a cor do **topo**.
A chave da costura junta categoria **e** cor, então a faixa de pedestre não se
funde com o asfalto — ela sobrevive como retângulo próprio.

### Assar em blocos: cuidado
Uma chamada que estoura o tempo **deixa blocos pra trás em silêncio**. Rode 1 a 2
blocos por chamada e confira no fim que os 16 têm laje.
