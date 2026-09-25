---
name: GUIA_ANIMACAO_BLENDER
description: Como animar um plano no Blender na mão — câmera, keyframe, roda girando, freada, prévia e render final. Guia de botão e tecla, pra seguir com o Blender aberto.
sources: [cowork]
aliases: [como animar no blender, keyframe, animar carro, roda girando, render de video]
---

# ANIMAR UM PLANO NO BLENDER — na mão

![[guia_animacao.svg]]

---

## A ideia toda em uma frase

Você **não desenha o movimento**. Você marca **onde a coisa está no quadro 1** e
**onde ela está no quadro 192**, e o Blender preenche o meio sozinho.
Cada marca dessas é um **keyframe**.

---

## 1 · Travar a câmera no seu ângulo

Esse é o que você já queria e não sabia:

1. Deixe o viewport no ângulo que você quer (voando com o mouse mesmo).
2. Selecione a câmera no Outliner.
3. **`Ctrl` + `Alt` + `Numpad 0`**

A câmera pula pro ângulo exato em que você está olhando. Pronto.

- `Numpad 0` entra e sai da visão da câmera.
- Dentro da visão da câmera, aperte `N` → aba **View** → ligue **Camera to View**
  pra continuar voando *com* a câmera. **Desligue depois**, senão você move a câmera sem querer.

> **A pegadinha do quadro fechado:** o viewport usa sensor de **72 mm** e a câmera usa **36 mm**.
> A mesma "50 mm" fecha o dobro na câmera. Para bater igual: selecione a câmera →
> aba de dados dela (ícone de câmera verde) → **Sensor Width = 72**.
> Ou deixe 36 e use metade da distância focal (50 vira 25).

---

## 2 · Definir o tamanho do plano

Aba **Output** (ícone de impressora, na coluna da direita):

| Campo | O que pôr |
|---|---|
| Frame Start | 1 |
| Frame End | 192 *(192 ÷ 24 = 8 segundos)* |
| Frame Rate | 24 |
| Resolution | 1920 × 1080 |

**Conta que resolve tudo:** `quadros = segundos × 24`.

---

## 3 · Fazer o carro andar

O `I` é o botão. É só isso.

1. Selecione o carro.
2. Arraste o cabeçote da linha do tempo pro **quadro 1**.
3. Ponha o carro onde ele começa (`G` pra mover, `R`+`Z` pra girar).
4. Mouse **em cima do viewport** e aperte **`I`** → escolha **Location & Rotation**.
   Aparece um losango laranja na linha do tempo.
5. Vá pro **quadro 192**. Mova o carro pro lugar onde ele para. Aperte **`I`** de novo.
6. Barra de espaço. Ele anda.

**Atalho de preguiça:** o botão do **bonequinho** ao lado do cabeçote é o **Auto Key**.
Ligado, todo movimento que você fizer vira keyframe sozinho — não precisa apertar `I`.
Ótimo pra trabalhar rápido, perigoso pra esquecer ligado.

---

## 4 · Fazer ele FREAR (e não chegar deslizando)

Por padrão o Blender suaviza a entrada e a saída — o carro sai devagar, acelera, e chega devagar.
Pra ele vir em velocidade e **só** frear no fim:

1. Troque uma área pro **Graph Editor** (menu do cantinho de qualquer painel).
2. Selecione os keyframes do **começo** do trajeto.
3. `T` → **Linear**.
4. Deixe os últimos em **Bezier**.

Linear = velocidade constante. Bezier = amortece. A freada é a mudança entre os dois.

---

## 5 · RODA GIRANDO

Aqui tem uma etapa a mais, porque a roda veio **grudada** no resto do carro.

### 5.1 Soltar a roda

1. Selecione o carro → `Tab` (entra em **Edit Mode**).
2. Passe o mouse em cima de uma roda e aperte **`L`** — ele seleciona a peça inteira conectada.
3. **`P`** → **Selection**. A roda virou objeto separado.
4. `Tab` pra sair. Repita nas outras três.

### 5.2 Pôr o eixo no centro da roda

Com a roda selecionada:
**`Object` › `Set Origin` › `Origin to Geometry`**

Sem isso ela gira em volta do carro inteiro, não em volta de si mesma.

### 5.3 Girar

**Jeito simples** (serve pra 90% dos casos):

1. Quadro 1 → `I` → **Rotation**.
2. Quadro 192 → `R` + `X` + digite `3600` + Enter → `I` → **Rotation**.
3. No **Graph Editor**: selecione a curva → `Channel` › `Extrapolation Mode` › **Linear**.
   Assim ela continua girando mesmo depois do último keyframe.

Qual eixo (`X`, `Y` ou `Z`) depende de como a roda está virada — teste, se girar errado troque a letra.

**Jeito certo** (roda não patina, acompanha a velocidade real do carro):

Clique com o botão direito no campo **Rotation X** da roda → **Add Driver**.
Depois, no Graph Editor em modo **Drivers**, configure:

```
Tipo            : Scripted Expression
Expressão       : -dist / raio
Variável "dist" : Transform Channel > objeto = o carro > canal = X Location
raio            : metade da altura da roda (vê em N > Dimensions > Z, divide por 2)
```

Isso amarra o giro ao deslocamento. Carro parou, roda parou. Carro freou, roda desacelera junto.
Se girar ao contrário, tire o sinal de menos.

---

## 6 · Boneco andando

Personagem do Roblox **não tem osso** — é uma casquinha só. Pra ele não deslizar:

1. Edit Mode → `L` em cada parte (perna, braço, cabeça) → `P` › Selection.
2. Em cada perna: **`Object` › `Set Origin` › `Origin to 3D Cursor`**, com o cursor
   posicionado no **quadril** (clique lá com `Shift` + botão direito antes).
   Braço: no ombro.
3. Selecione perna → `Shift` + clique no torso → **`Ctrl` + `P`** › **Object (Keep Transform)**.
   Agora perna segue torso.
4. Anime só a rotação: quadro 1 perna esquerda a −22°, quadro 12 a +22°, quadro 24 volta a −22°.
   Perna direita ao contrário. Braço acompanha a perna **do lado oposto**.

**O número que evita o deslize:**
`velocidade = passos por segundo × tamanho da passada`
2 passos/s × 0,85 m = **1,7 m/s**. É nessa velocidade que o boneco tem que andar pra frente.
Mais rápido que isso, o pé patina e a vista percebe.

Pra repetir o ciclo sem copiar keyframe: Graph Editor → `Channel` › `Extrapolation Mode` › **Make Cyclic**.

---

## 7 · Ver como ficou (rápido)

**`View` › `Viewport Render Animation`**

Renderiza o que está na tela, sem luz boa, em segundos por quadro em vez de minutos.
É pra conferir **movimento e tempo**, não beleza. Use esse o tempo todo enquanto ajusta.

---

## 8 · Render final em vídeo

Aba **Output**:

| Campo | Valor |
|---|---|
| Output | a pasta onde salva |
| File Format | **FFmpeg Video** |
| Container | MPEG-4 |
| Video Codec | H.264 |
| Output Quality | High Quality |

Depois: **`Render` › `Render Animation`** (ou **`Ctrl` + `F12`**).

> **Aviso:** se cair a luz ou travar no meio, o MP4 vai pro lixo inteiro.
> Em plano longo, salve em **PNG sequence** e junte depois no Video Sequencer.
> Aí um quadro perdido não custa o render todo.

---

## 9 · Duas armadilhas que já me pegaram nessa cena

**Marcador de câmera manda mais que a câmera ativa.**
Se você apertou `Ctrl` + `B` com uma câmera selecionada, criou um marcador amarrado a ela.
A partir daí o render usa a câmera do marcador do quadro atual, **não** a que está selecionada.
Pra tirar: clique no marcador na linha do tempo e aperte `X`.

**Personagem em cima da marquise.**
Ao posicionar alguém na calçada, o chão da rua está em **z = 12,2** e a marquise em **z ≈ 14**.
Se colar pelo olho, ele fica no toldo. Confira o Z no painel `N`.

---

## 10 · Colinha de teclas

| Tecla | Faz |
|---|---|
| `I` | crava keyframe |
| `Alt` + `I` | apaga keyframe |
| `G` / `R` / `S` | move / gira / escala |
| `Tab` | entra e sai do Edit Mode |
| `L` | seleciona a peça conectada (Edit Mode) |
| `P` | separa a seleção em objeto novo |
| `Ctrl` + `P` | faz o selecionado virar filho do último clicado |
| `Numpad 0` | visão da câmera |
| `Ctrl`+`Alt`+`Numpad 0` | câmera pula pro seu ângulo |
| `T` (Graph Editor) | tipo de interpolação |
| Espaço | play |
| `Ctrl` + `F12` | render da animação |
| Setas ← → | anda 1 quadro |
| `Shift` + ← | volta pro quadro inicial |
