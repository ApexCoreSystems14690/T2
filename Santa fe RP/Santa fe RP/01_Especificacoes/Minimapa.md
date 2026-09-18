# Minimapa e mapa do celular

- **Minimapa:** quadrado, canto inferior esquerdo, vida e colete em 2 barras finas
  embaixo. Raio **75 studs a pé, 150 dirigindo**. **Gira com a câmera**; você é uma
  seta **pequena** parada no centro. Some quando algemado, caído ou em tela cheia.
- **Mapa do celular:** app `Mapa`, **norte pra cima**, 5 degraus de zoom
  (**100 · 200 · 400 · 900 · 1950**, abre em 400), arrastar pra passear, ⌖ pra recentrar.

> **Por que perto assim.** O plano pedia 150/300, mas aquilo foi escrito antes de
> existir mapa. Com a cidade de verdade desenhada, o Julio olhou e disse: *"o mapa
> normal, o minimapa, estão LONGE DEMAIS, eles têm que ficar perto, com o ponteiro
> do player pequeno, fazendo parecer que o mapa é maior, dando uma sensação de
> detalhamento, não dando espaço para erro"*. Metade do raio e ponteiro de 12×7 px.
- Os dois desenham **o mesmo modelo**, com a mesma câmera. Muda só o enquadramento.

---

## O MÉTODO (v10): grade lida do mundo, e a RUA GANHA DE TUDO

Esta é a sexta técnica. A diferença que fez a coisa fechar não foi de desenho —
foi de **pergunta**.

Até a v7 eu perguntava **"essa peça se chama rua?"**. Num mapa montado à mão isso
nunca fecha: cobria 88% dos postes e deixava quadrantes inteiros de fora, e as
lajes se sobrepunham. O Julio: *"tem MUITA coisa aí que não foi mapeada… as ruas
se atropelam, confuso demais, impossível de usar"*.

A v8+ pergunta outra coisa: **"o que tem debaixo do pé de quem anda aqui?"**
Raycast de cima, célula a célula, de 3 em 3 studs, a 50 mil raycasts por segundo.
Isso conserta as duas reclamações **de raiz**: nada fica de fora (toda célula tem
resposta, com nome ou sem) e nada se atropela (uma resposta por célula).

### Chão ou construção: filtro progressivo
Emprestado do processamento de LIDAR, onde o problema é o mesmo: separar o
**terreno** do que foi **construído em cima dele**. O terreno é aberto com janelas
crescentes (2 · 4 · 8 · 16 células) e o limiar cresce junto:

```
limiar = 1,5 + 0,20 × (janela em studs)
```

Por isso **ladeira passa e parede não**. **MEDIDO:** com janela única de 42 studs a
favela dava **59% de "construção"** — era o morro inteiro virando telhado.

### A RUA GANHA DE TUDO — cinco regras, nesta ordem
Pedido do Julio, em duas mensagens: *"objetos na frente delas, cobrindo… algum
método que sempre destaque as ruas acima de tudo"* e *"qualquer decalque na rua de
textura tá sendo lido como teto… a rua deve estar COMPLETAMENTE DESTACADA, sem
barras pretas atrapalhando"*.

1. **Perfuração exata.** Bueiro, remendo, faixa pintada e "Sujeiras" ficam uns
   centímetros ACIMA do asfalto — medido: `Faixa de Pedestre` tem **0,100 stud**,
   `Ruas-Decais` e `Sujeiras` **0,050**. Eu descia 0,35 stud pra continuar a
   perfuração, ou seja, **começava abaixo do asfalto e nunca o encontrava**:
   **0 de 40 decalques** achavam a rua embaixo, e cada um virava mancha cinza no
   meio da pista. Agora a perfuração **exclui a peça já atingida e atira de novo
   da mesma altura** — sem passo, sem epsilon, sem erro de espessura. Medido
   depois: **55 de 75 (73%)**. A célula vira rua, e a cor continua sendo a do
   TOPO, então a faixa aparece **como faixa**, não como buraco.
2. **Rua no topo é rua, ponto.** Rua elevada (ponte, rampa, rua que sobe) continua
   rua, por mais alta que esteja. Sem isso ela sumia **exatamente onde muda de
   altitude**.
3. **Mancha pequena é tralha.** Mancha alta com menos de 26 células é toldo,
   placa, semáforo, caixa d'água: perfura a coluna e usa o chão.
4. **Cobertura com rua embaixo.** Passarela, viaduto, marquise: a rua ganha e a
   cobertura não entra no mapa.
5. **Buraco cercado de rua vira rua.** Nenhuma ilha escura no meio do asfalto.

Árvore o raycast atravessa **sempre**.

### O que é rua: MATERIAL, não só cor
**MEDIDO, e foi a cor real que denunciou:** com a regra solta ("claro = via",
"quente = terra"), telha vermelha, madeira e parede clara viravam RUA — e como
"rua no topo é rua", escapavam do filtro de prédio e o mapa virou um mosaico de
manchas vermelhas e marrons. Agora:

- **`via`** = `Concrete` com luminância ≥ 0,85. Medido em 300 pontos dentro das
  lajes de `workspace.Ruas`: **Concrete 248,248,248** — o que escurece o asfalto no
  jogo é a **textura do material**, não a cor.
- **`terra`** = material de terra (`Slate`, `Granite`, `Ground`, `Mud`,
  `LeafyGrass`, `Cobblestone`) **e** cor quente. A rua da favela é `Slate`
  128,112,96; a Rua de Terra Fazenda é `Granite`.

### Pátio não é rua — pela FORMA
Asfalto e piso de pátio são o **mesmo concreto quase branco**, então pela
superfície não dá pra separar. Pela forma dá: rua é mancha grande e conectada,
pátio é ilha solta dentro do quarteirão. Mancha de rua com menos de **130 células**
vira `piso`.

### A COR: a REGIÃO da rua fica viva, o entorno fica cinza
*"tudo que você mapear como rua, quero que TODO aquele pedaço seja realmente
visível, a cores, como ele é; os prédios do lado ficam cinza, mas a REGIÃO marcada
como rua deve ficar totalmente viva"*.

Então a célula de rua fica com a **cor real do topo** — asfalto, faixa de pedestre,
pintura, vaga demarcada, bueiro, remendo, tudo junto, como se vê de cima. Só o
**entorno** (prédio, calçada, mato, água) é que vira cinza chapado. Medido no mapa
assado: **62 cores distintas** dentro da malha viária — ela não é chapada.

| Entorno (chapado) | Cor |
|---|---|
| `verde` | `48,58,48` |
| `agua` | `44,56,72` |
| `areia` | `100,97,90` |
| `construcao` | `54,57,65` |
| `piso` (calçada, pátio, quintal) | `84,88,96` |
| **rua** | **a cor real da superfície** |

> **Nota honesta:** o asfalto deste jogo é `Concrete` **248,248,248** — quase
> branco. O que o deixa escuro no jogo é a **textura do material**, não a cor.
> Como o mapa é desenhado com luz chapada e `SmoothPlastic`, a rua sai clara.
> É a cor real do dado; não é o tom que o olho vê dirigindo. Se um dia a
> preferência for o tom do jogo, é multiplicar a cor por um fator por material —
> uma linha em `tipoDoChao`.

### Depois vira geometria de novo
A grade é costurada em retângulos (*greedy meshing*) e emitida como lajes — é isso
que mantém o mapa **nítido em qualquer zoom**. A chave da costura junta categoria
**e cor**, então duas células de asfalto com pinturas diferentes não se fundem.

---

## As 5 técnicas que morreram antes desta

| Versão | O que era | Por que morreu |
|---|---|---|
| v1–v3 | **Raster**: imagem 512×512 por `EditableImage` | Imagem esticada **borra**. *"o mapa deve ser NÍTIDO"*. |
| v4–v5 | **Vetor**: rua como Frame girado | Nítido, mas era desenho e não mapa: ignorava tudo que não fosse via. *"o seu tá BIZARRO"*. |
| v6 | **ViewportFrame com as cores reais** | Parecia o jogo — e é esse o problema. *"as cores no mapa tão esquisitas"*. |
| v7 | **ViewportFrame com cartografia por NOME de peça** | Nome não fecha num mapa feito à mão: 88% dos postes, quadrantes inteiros fora, lajes sobrepostas. |
| **v8–v10** | **Grade lida do mundo por raycast, rua ganha de tudo, rua colorida** | É o que está no jogo. |

> `[FATO]` GTA V Graphics Study (adriancourreges.com): *"All the roads are actually
> vectorized (…) rendered as **meshes** and can look great at pretty much any level
> of zoom."* Geometria, não textura — e as ruas como **camada própria**.

**Efeito colateral bom:** sem `EditableImage`, **não precisa ligar "Allow Mesh &
Image APIs" em Game Settings**.

---

## O assador — `ServerStorage.AssarMapa` + `ServerStorage.MapaGrade`

`MapaGrade` é o motor (varredura, filtro, costura). `AssarMapa` orquestra e gera os
pontos. Vai em **16 blocos** porque o mapa inteiro não cabe numa chamada só:

```lua
local A = loadstring(game.ServerStorage.AssarMapa.Source)()   -- loadstring, não require
A.inicio()
for i = 0, 3 do for j = 0, 3 do A.bloco(i, j) end end
A.fim()
```

Cada bloco é varrido com **60 studs de margem** e recortado depois, pros dois
filtros enxergarem o vizinho — assim a emenda não aparece.

Pra **olhar** sem entrar no jogo (foi assim que a v9 foi ajustada):
```lua
A.previa()        -- põe o mapa no workspace, 4000 studs acima
A.tirarPrevia()
loadstring(game.ServerStorage.MapaGrade.Source)().recorte(916, 1272, 1400, 3)  -- só um pedaço
```

### O botão de detalhe
`MapaGrade.PASSO` (hoje 3 studs por célula). Aumentar deixa o mapa mais leve e mais
quadriculado; diminuir deixa mais fino e mais pesado.

### Por que assar no Edit
`StreamingEnabled` está **ligado**: o cliente não tem o mapa todo carregado.

### Armadilha paga
**`require` guarda cache**, inclusive depois de editar o módulo. Uma volta inteira
saiu com números idênticos aos da versão anterior por causa disso. Em
desenvolvimento: `loadstring(m.Source)()`.

---

## Os pontos vêm dos INTERATIVOS do jogo
Ideia do Julio: *"para saber o que são os locais importantes basta ver seus
interativos, por exemplo posto de gasolina"*. Interativos do mesmo tipo a menos de
120 studs viram **um** ponto, com mínimo e teto por tipo. Resultado: **32 pontos**.

No minimapa só entram os que ajudam a se achar (posto, hospital, banco, base,
oficina); no celular entram todos. **Rótulo** só nos zooms 250 e 500, e rótulo que
cairia em cima de outro não aparece.

---

## A setinha
Triângulo maciço branco com contorno — o clássico. Parada no minimapa (lá quem gira
é o mapa) e girando no celular (lá o norte é fixo).

**ARMADILHA DO ROBLOX:** `ClipsDescendants` **não corta filho que tem `Rotation`**.
A primeira seta virou um losango inteiro. A que ficou é escada de barrinhas, sem
rotação nenhuma nos filhos.

---

## Memória: uma cópia da cidade, nunca duas
O mapa grande do celular **não clona nada**: pega as quadras **emprestadas** do
minimapa (`Minimapa.emprestar()` / `.devolver()`), e o minimapa fica apagado
enquanto ele está aberto.

---

## Provado (18/09)

- **32 testes de bancada**, 0 falhas — inclusive: os 5 degraus de zoom crescem e
  ficam presos nas pontas; raio a pé e dirigindo caíram pela metade; setas de
  12×7 e 14×8; **decalque acha o asfalto em 73% dos casos (era 0%)**; `via` é a
  camada mais alta; a rua tem **62 cores distintas** (não é chapada); nenhuma laje
  mais grossa que 1 stud; zero MeshPart e zero Union; **os 16 blocos preenchidos**.
- **Fotografado e olhado**: recorte de um cruzamento com faixa de pedestre (dá pra
  ver as vagas demarcadas e as faixas), recorte do centro, mapa inteiro em 2
  voltas, minimapa em Play e o app do celular.
- Modelo: **42.427 lajes** a passo 2, todas caixas lisas.

### Armadilhas de medição anotadas
- Saturação **relativa** mente com cor escura: `(16,19,24)`, quase preto, dava
  "0,33 de saturação". A métrica honesta é **croma absoluto** (`max−min` em 0..255).
- **`require` guarda cache** mesmo depois de editar o módulo — uma volta inteira
  saiu com números idênticos aos da anterior. Em desenvolvimento: `loadstring`.
- **`AssarMapa` tinha o próprio `PASSO`**: mudar só o do `MapaGrade` não fez efeito.
- Assar em blocos numa chamada que estoura o tempo **deixa blocos pra trás em
  silêncio** — o mapa saiu com um buraco de 975×1950 studs e só a foto pegou.
  Existe um teste agora que exige os 16 blocos preenchidos.
