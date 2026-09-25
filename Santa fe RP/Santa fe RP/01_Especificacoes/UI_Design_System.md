# UI — Design System (MEDIDO na UI do jogo, 24/09/2026)

> Fonte única em código: `ReplicatedStorage.Shared.Estilo` (módulo puro, 21 testes).
> Este arquivo é a leitura humana dele. Se os dois discordarem, **o módulo manda** —
> ele é o que o jogo executa.

## Por que este arquivo foi refeito

Medi a UI inteira e contei as cores que estavam em uso de verdade:

- **6 verdes**: `20,130,75` · `28,170,99` · `23,158,92` · `35,165,95` · `30,120,70` · `60,220,130`
- **5 cinzas de texto fraco**: `150,155,165` · `150,155,162` · `170,174,182` · `150,150,162` · `150,150,160`
- **2 vermelhos**: `205,50,50` · `233,74,60`

Nenhuma dessas diferenças foi decisão de ninguém. Foram nascendo tela a tela, cada uma
errando o tom por 3 ou 4 pontos. **É por isso que as telas novas "não parecem do jogo"
mesmo com o desenho certo** — não é o layout, é o tom.

Regra a partir de agora: **cor nova é proibida**. Se falta um tom, use transparência ou
brilho em cima de um token existente.

## As duas peles

O jogo fala duas línguas visuais, e isso está certo. Misturar é o erro mais comum.

### MUNDO — o que flutua sobre a cidade
HUD, inventário, prompt do F, telas 3D. Tem que deixar ver o mundo atrás.

| papel | valor |
|---|---|
| fundo | preto puro `0,0,0` — o que muda é a transparência |
| janela | transparência `0.55` |
| card / linha | `0.80` |
| pílula da HUD | `0.44` |
| canto | **offset**: `UDim.new(0,4)` padrão · `0,8` em card grande · `0,3` em pílula |
| fonte de título | **Oswald** |
| fonte de corpo | **SourceSansBold** |

### APARELHO — o que é uma tela DENTRO do jogo
Celular, navegador, PC da delegacia. Tem que parecer um aparelho de verdade, não um HUD.

| papel | valor |
|---|---|
| fundo (vidro desligado) | `12,12,14` |
| tela do app | `22,24,30` |
| pílula / campo / botão parado | `38,41,50` |
| variação clara (uso pontual) | `34,37,44` |
| divisor | `52,56,62` |
| canto | **escala**: pílula `0.25` · campo `0.30` · card `0.06` · botão `0.40` |
| fonte de aba/botão/rótulo | **GothamMedium** |
| ênfase | **GothamBold** |

Canto do aparelho é escala de propósito: a tela do celular muda de tamanho com a
resolução, e canto em offset fica quadrado no monitor grande.

## Texto — uma escada só, nas duas peles

| papel | valor | quando |
|---|---|---|
| forte | `255,255,255` | o que ele precisa ler |
| médio | `210,214,222` | rótulo, legenda |
| fraco | `150,155,165` | desligado, secundário, dica, **aba parada** |

## Semântica — uma cor por significado, no jogo inteiro

| papel | valor | onde |
|---|---|---|
| OK | `20,130,75` | ação positiva, aba ativa (é o verde do banco) |
| OK claro | `60,220,130` | número/texto positivo sobre fundo escuro |
| PERIGO | `205,50,50` | o vermelho que o jogo já usava |
| PERIGO claro | `255,120,90` | texto de erro sobre fundo escuro |
| AVISO | `255,180,70` | |
| INFO | `40,110,210` | azul de governo (editais, PF) |
| ROXO | `140,60,200` | deepweb, **e só ela** |

## O acento é do jogador

O laranja `255,170,0` é só o **padrão**. Cada jogador escolhe nas configurações do celular
(`Resources.Tema`, 30 cores). Quem desenha **pergunta**; quem grava é o perfil.
`Estilo.acento(valor)` devolve algo válido mesmo recebendo nil ou lixo.

## Regras de montagem (as mesmas de sempre, agora testáveis)

1. Cor nova é proibida — use transparência ou brilho em cima de um token.
2. Tela de APARELHO nunca usa fundo preto translúcido; tela de MUNDO nunca usa cinza opaco.
3. Canto do MUNDO é offset; canto do APARELHO é escala.
4. Número nunca sai sem unidade.
5. Aba ativa = `OK` com texto branco; aba parada = `painel` com `texto fraco`.
6. Só `Scale` em Size/Position de janela e frame principal.
7. Toda janela principal com `UIAspectRatioConstraint` + `UISizeConstraint`.
8. `Main` usa `ZIndexBehavior.Global` → filho novo precisa de ZIndex maior que o pai.
9. **Proibido criar UI complexa do zero por script** — clonar template.

## A armadilha que voltou a morder (24/09)

**Escala + `AutomaticSize` = dimensionamento circular.** Já tinha destruído o balão do
RoZap em setembro (9166px de altura); voltou na lista da ficha da PC.

Medido em `Surfaces.FichaPC`: `Template` com `Size.Y = 0.11` em escala **e**
`AutomaticSize.Y`, com o `Texto` em `0.07` também com AutomaticSize e `TextScaled` sem
teto. Resultado: cada linha saiu com **307px em vez de 34**, o texto com **300px**, e o
conteúdo da lista deu **1204,95px** num quadro de 316,8 — ou seja, **uma linha e meia de
letra gigante** na tela da delegacia.

Receita que resolve, e que vale pra toda lista:
- linha: `AutomaticSize = None`, `Size = UDim2.new(1, -8, 0, 34)` (o `-8` é folga da barra de rolagem)
- texto: `AutomaticSize = None`, `Size = UDim2.new(1, -16, 1, 0)`, `TextWrapped = false`,
  `TextTruncate = AtEnd`, `TextSize` fixo (15) — com teto fixo o `TextScaled` não acrescenta nada
- conferir: `UIListLayout.AbsoluteContentSize` ≈ nº de linhas × (altura + padding)

## A outra armadilha: âncora no centro com posição de canto

Na mesma tela, o `ScrollingFrame` tinha `AnchorPoint = (0.5, 0.5)` com
`Position = (0, 0.19)`. Âncora no centro + posição de canto = a lista desenhada **centrada
no ponto**, ou seja metade dela para FORA do painel, à esquerda
(`AbsolutePosition.X = -368` num quadro que começa em 16). `Título` e `Abas` estavam com
âncora `(0,0)`, que é o certo — só a lista estava torta.

E `Frame.Size.Y = 1.171875` deixava o painel **17% mais alto que o monitor**: a tela é uma
peça de 2,725 × 1,5 studs a 200 px/stud = **545 × 300 px**, e o Frame ocupava 512 × 352 —
sobravam 52px para fora por baixo. Agora é `0.94 × 0.96` = 512 × 288, com 12px de folga.

## Veredito visual (24/09)

- **Inventário, banco, prompt do F**: fotografados, são a REFERÊNCIA — não foram tocados.
- **Ficha da PC**: título, abas e cores **aprovados por foto**. A **lista fica PENDENTE** —
  `ScrollingFrame` não pinta texto em SurfaceGui no Edit. O layout está provado por número
  (6 linhas de 34px, conteúdo 234 num quadro de 230, texto com bounds 350×15 em 488 de largura).
- **Perícia, senha do celular, navegador**: repintados pelos tokens, **foto pendente**.
