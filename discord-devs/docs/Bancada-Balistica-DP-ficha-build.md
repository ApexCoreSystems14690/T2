# Bancada de Balística da DP — ficha de build (22/10)

Para o Build. Tudo aqui é **decoração e marcação**: nenhuma peça desta ficha tem script.
A parte interativa (os pontos de F) é minha e entra depois, em cima do que vocês montarem.

Todas as coordenadas e medidas foram tiradas da place 75467790232298 hoje. Se alguma peça não
encaixar, me fala antes de improvisar — o número é medido, não é chute.

---

## 1. Onde é

A bancada da delegacia é **uma peça só de 38 studs**: `Workspace.MapaOrganizado.NE.Parts.Part`.

| medida | valor |
|---|---|
| topo da bancada | **Y = 47,11** |
| profundidade útil | **Z de −934,04 (fundo) a −931,68 (frente)** = 2,36 studs |
| material / cor da bancada | Metal, RGB 91, 93, 105 |
| altura livre até o teto | 9,60 studs |

**NÃO MEXER nessa peça.** Ela é a mesma bancada das outras quatro estações (Deepweb, Porte,
PC da Ficha, Salário). Redimensionar ou mover quebra todas.

### O vão que é nosso
A bancada é dividida por divisórias penduradas. A nossa baia vai de **x 542,2 até x 554,6**
(12,4 studs), e dentro dela hoje está:

| x | o que é | o que fazer |
|---|---|---|
| 547,1 – 550,1 | `Tela 3 pc` + `Teclado 3` (o PC velho da perícia) | **TIRAR** — é o que a mecânica pede |
| 548,6 | `PainelDeep` (painel com SurfaceGui) | **NÃO TIRAR ainda** — ver aviso 1 |
| 548,6 / 45,8 / −930,5 | `Seat` (a cadeira) | **FICA onde está.** É ela que abre o microscópio |
| 550,1 – 554,6 | livre | é onde entra metade das peças novas |

> **Aviso 1 — o `PainelDeep`.** Existem dois no mapa, em x 548,6 e x 562,6. Não sei o que o de
> 548,6 alimenta e não vou chutar. **Julio decide:** some junto com o PC velho, ou muda de lugar?
> Até ele responder, deixem no lugar e montem em volta.

---

## 2. Regras técnicas (valem para TODAS as peças desta ficha)

1. `Anchored = true`, `CanCollide = false`, `CanQuery = false`, `CanTouch = false`.
   - `CanCollide false` porque o corredor passa colado na bancada.
   - `CanQuery false` porque é isso que impede a peça de parar bala e de brigar com o sistema de
     interação.
2. **Nada pode passar da frente da bancada**, ou seja, nada com z maior que **−931,68**.
3. **Nada mais alto que 2,5 studs** acima do tampo (Y 49,6). Acima disso tapa as telas vizinhas.
4. **Nenhum ProximityPrompt.** Nenhum. A interação é o F do jogo e quem cria é o script.
5. Não encostem nas divisórias penduradas (x 540,6–542,2 e x 554,6–556,1).
6. Cada conjunto vira um **Model** com o nome exato da tabela abaixo. O script procura por esses
   nomes — nome errado, mecânica não acha a peça.
7. Peça pequena (menor lado abaixo de 1 stud) com `CastShadow = false`. As grandes podem ter sombra.

---

## 3. O que montar, peça por peça

Todas as peças ficam **em cima do tampo (base em Y 47,11)**, menos a gaveta.

### 3.1 `BAL_Microscopio` — o objeto principal
Centro em **x 547,9 · z −932,6**. É ele que a câmera visita quando o perito senta.

| peça | nome exato | tamanho (studs) | posição | cor / material |
|---|---|---|---|---|
| pé | `Pe` | 1,90 × 0,18 × 1,30 | x 547,9 · y 47,20 · z −932,6 | RGB 38,40,45 · Metal |
| coluna | `Coluna` | 0,34 × 1,50 × 0,34 | x 547,35 · y 48,04 · z −932,85 | RGB 52,55,60 · Metal |
| braço | `Braco` | 1,05 × 0,26 × 0,30 | x 547,9 · y 48,73 · z −932,78 | RGB 52,55,60 · Metal |
| platina esquerda | `PlatinaEvidencia` | 0,62 × 0,07 × 0,62 | x 547,58 · y 47,32 · z −932,48 | RGB 28,30,34 · Metal |
| platina direita | `PlatinaTeste` | 0,62 × 0,07 × 0,62 | x 548,30 · y 47,32 · z −932,48 | RGB 28,30,34 · Metal |
| objetiva esquerda | `Objetiva1` | 0,20 × 0,42 × 0,20 | x 547,58 · y 48,37 · z −932,48 | RGB 30,32,36 · Metal |
| objetiva direita | `Objetiva2` | 0,20 × 0,42 × 0,20 | x 548,30 · y 48,37 · z −932,48 | RGB 30,32,36 · Metal |
| tubo da ocular | `Tubo` | 0,46 × 0,46 × 1,25 | x 547,94 · y 49,16 · z −932,30, **girado −34° no X** | RGB 36,38,42 · Metal |
| lente | `Lente` | 0,42 × 0,42 × 0,04 | na ponta do tubo, lado da cadeira | RGB 10,10,12 · SmoothPlastic |

**O que tem que ficar certo, senão a mecânica não funciona:**
- A **ocular aponta para a cadeira** (que está em z −930,5, ou seja, para +Z). O `Tubo` inclinado
  −34° no X é o que faz isso. Se apontar para outro lado, a câmera do perito entra pelo lado errado.
- **Attachment `PontoCamera`** na face de fora da `Lente`, 0,05 stud à frente dela, com o eixo
  apontando para dentro do tubo. É nesse attachment que a câmera para. Sem ele eu tenho que
  adivinhar, e vai ficar torto.
- As **duas platinas ficam vazias** no build. As cápsulas são criadas pelo script quando o perito
  põe cada uma — elas não são decoração.
- Distância entre as platinas: **0,72 stud de centro a centro.** Mais perto que isso as duas cápsulas
  se encostam; mais longe o perito não enxerga as duas de uma vez.

### 3.2 Resto da baia

| Model | o que é | tamanho | centro (x · z) | cor / material | observação |
|---|---|---|---|---|---|
| `BAL_Gaveta` | frente de gaveta, **na saia da bancada**, não em cima | 1,80 × 0,90 × 0,08 | x 544,0 · z −931,70 · **y 46,30** | RGB 70,72,80 · Metal | puxador discreto; é o acervo de evidências |
| `BAL_CaixaDisparo` | caixa fechada de tiro de teste | 1,60 × 1,00 × 1,10 | x 545,8 · z −932,9 | RGB 44,46,52 · Metal | tampa com dobradiça aparente; dentro, uma `Bandeja` 0,5 × 0,04 × 0,4 que é onde a cápsula de teste nasce |
| `BAL_Tapete` | tapete de trabalho (revelar número) | 2,20 × 0,03 × 1,40 | x 549,9 · z −932,5 | RGB 26,42,38 · Fabric | **Attachment `PontoArma`** no centro, em **Y 47,20**. Ver aviso 2 |
| `BAL_Reagente` | frasco âmbar + pincel ao lado | frasco 0,34 × 0,55 × 0,34 | x 551,0 · z −933,3 | vidro âmbar RGB 150,95,30, Transparency 0,35 | pincel 0,06 × 0,05 × 0,55, cabo madeira |
| `BAL_Luminaria` | luminária articulada | base 0,55 × 0,06 × 0,55, 2 braços de 0,9 | x 551,2 · z −933,7, braço chegando sobre o tapete | RGB 220,218,210 · SmoothPlastic | SpotLight Brightness 1,2 · Range 12 · Angle 50 · Shadows OFF. Ver aviso 3 |
| `BAL_Entrega` | bandeja de entrada (a SAMU entrega o projétil aqui) | 1,40 × 0,12 × 1,00 | x 552,6 · z −932,6 | RGB 60,62,70 · Metal | bandeja rasa, borda de 0,1 |
| `BAL_Placa` | plaquinha de pé escrito BALÍSTICA | 1,00 × 0,30 × 0,05 | x 553,6 · z −933,6 | branco RGB 230,228,220 | texto em SurfaceGui, GothamBold preto |

### 3.3 Decoração livre (sem nome fixo, agrupem em `BAL_Deco`)
Nas sobras: **x 542,4 a 545,0** e **x 553,8 a 554,4**.
- saquinhos de evidência vazios empilhados (uns 4, 0,5 × 0,02 × 0,7)
- bandeja com cápsulas já catalogadas (6 a 8 cápsulas de **0,30 × 0,156**, latão RGB 196,158,66,
  Material Metal, Reflectance 0,15 — o mesmo tamanho aprovado para a cápsula do chão)
- plaquinhas amarelas numeradas empilhadas (amarelo RGB 242,200,40)
- lupa, pinça, par de luvas de látex
- caneca e pasta de papel, se sobrar espaço

> **Aviso 2 — `PontoArma` não é detalhe, é o que faz a animação encaixar.** A animação do Rip é
> **só tronco e braços**, então a mão vai sempre parar no mesmo lugar. Quem se encaixa na mão é a
> arma, não a mão na arma. Se cada arma ficar num ponto diferente do tapete, a mão não encosta em
> nenhuma. Por isso o attachment é fixo, e o Rip anima contra um prop de referência nesse ponto.
> Altura **Y 47,20** = 0,09 acima do tampo, que é onde a mão de quem está sentado na cadeira chega
> (assento em Y 45,8).

> **Aviso 3 — sombra da luminária desligada.** `Shadows = true` numa luz dentro de sala fechada
> com as peças pequenas da bancada custa caro e não aparece. Brilho sim, sombra não.

---

## 4. O que NÃO fazer

- Não criar ponto de interação, pad, ProximityPrompt nem BillboardGui. Nada disso. É meu.
- Não pôr cápsula nas platinas do microscópio (as duas de verdade nascem do script).
  As cápsulas da **bandeja de decoração** podem, essas são enfeite.
- Não mexer no `Seat` em 548,6 / 45,8 / −930,5 nem girar a cadeira.
- Não mexer na peça da bancada nem nas divisórias.
- Não passar de z −931,68 para a frente.

---

## 5. Por que as medidas são essas (para quem quiser conferir)

- **Alcance do F, medido:** a caixa de busca é `HRP − (1,5 ; 4,5 ; 1,5)` até
  `HRP + (2,8 ; 8,5 ; 2,8)` — e ela é **alinhada ao mundo, não ao personagem**. Ou seja o alcance é
  2,8 studs para +X e +Z e só **1,5 para −X e −Z**. Com a bancada em z −934 a −931,7 e o jogador em
  pé no corredor (z ≈ −930,9), **o fundo da bancada fica fora do alcance**. Por isso as peças
  interativas são props aqui, e os pontos de F invisíveis entram depois, na faixa da frente.
- **Um ponto ativo por vez:** o sistema escolhe o ponto mais próximo do **centro da tela**. Por isso
  as cinco estações estão espalhadas com cerca de 2 studs entre elas — perto demais e uma rouba a
  outra. Já aconteceu duas vezes neste jogo.
- **No celular** só cabem **4 balõezinhos na tela ao mesmo tempo** (medido: `Main.InteractionPoints`
  tem 4 filhos). O espaçamento de 2 studs também resolve isso.
- **Tamanho da cápsula (0,30):** escolhido por foto, na distância real de câmera de 3ª pessoa
  (12 studs). Uma 9 mm de verdade seria 0,054 stud e some da tela. 0,20 vira pontinho, 0,36 vira
  lata.

---

## 6. Critério de pronto

A entrega está pronta quando:
1. Todos os Models existem com os **nomes exatos** da tabela.
2. Nada tem colisão, nada responde a raycast, nada passa de z −931,68, nada passa de Y 49,6.
3. O `PontoCamera` existe na lente e aponta para dentro do tubo.
4. O `PontoArma` existe no centro do tapete, em Y 47,20.
5. Foto de três ângulos: **em pé na frente da bancada**, **de lado** (para conferir que nada invade o
   corredor) e **da cadeira sentado** (para conferir que a ocular está virada para quem senta).
6. O PC velho (`Tela 3 pc` + `Teclado 3`) saiu, e o `Seat` continua onde estava.

Quem faz: **Build (Davi)** monta a baia; **Modelagem (Ygz)** faz microscópio, lima, frasco, pincel,
luminária, caixa de disparo, cápsula, placa numerada e saco de evidência, se for virar malha em vez
de peças. Enquanto a malha não vem, o que está nesta ficha já fecha em peça simples e a mecânica
roda igual.