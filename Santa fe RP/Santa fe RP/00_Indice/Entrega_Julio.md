# 📥 O que está esperando por você

> Lista viva do que **só você pode destravar**, com a decisão já tomada do meu lado.
> Regra: cada item diz **o que falta**, **onde exatamente**, e **o que acontece no minuto seguinte**.
> Item resolvido sai daqui e vira linha no [[Log]].

---

## 👀 0 · OLHA O MAPA — rua viva e mapas mais perto

**O que mudou:** a faixa de pedestre virava mancha porque eu perfurava a coluna
descendo 0,35 stud e o decalque tem 0,05 — eu começava abaixo do asfalto e nunca
o achava (0 de 40). Agora perfuro excluindo a peça: 73%. E a região da rua passou
a mostrar a **cor real do que está em cima dela**, então faixa aparece como faixa.
Os dois mapas vieram pra perto (raio 75/150) e o ponteiro encolheu.

**O que olhar:**
- Parar em cima de uma faixa de pedestre e ver se ela aparece no minimapa.
- Se sobrou alguma mancha escura no meio da pista — me diga onde.
- O zoom: está no ponto ou ainda quer mais perto?

**Uma escolha tua:** o asfalto do jogo é `Concrete` quase branco (248) — o que o
escurece no jogo é a textura, não a cor. Por isso a rua sai clara no mapa. É a cor
real do dado, mas não é o tom que teu olho vê dirigindo. Se preferir asfalto
escuro com faixa branca, é uma linha.

Checklist completo em [[Lista_Testes]].

---|---|
| 400 | 5.863 | você disse que ignorava muita coisa |
| 150 | 12.533 | meio-termo |
| 60 | 17.147 | quase tudo |
| **25** (agora) | **23.322** | nada que se veja de cima |

Trocar o número e rodar `require(game.ServerStorage.AssarMapa).assar()`.

---

## 🟡 2 · Ícones das peças contextuais (6 ícones)

**O que fazer:** me passar 6 ícones (asset id ou imagem). Se preferir, eu escolho
da Creator Store e você só aprova.

| Peça | O que o ícone representa |
|---|---|
| `colete` | colete balístico |
| `capacete` | capacete |
| `mirando` | mira / retículo |
| `prisao` | grade de cadeia |
| `algemado` | algema |
| `caido` | (opcional — hoje não tem chip próprio, ver item 5) |

Mais um, de brinde: o **ícone do app Mapa** no celular. Hoje ele é um quadrado
verde escrito "Mapa", igual ao Banco/Notas/Contatos, que também estão sem ícone.

**Onde entra:** `StarterPlayer...Client.Hud`, tabela `ICONES` no começo da seção
CONTEXTO — uma linha por peça. O do app entra em
`StarterGui.Main.Celular.Buttons.Mapa.Icone.Image`.
**Uma linha por peça**, nada mais muda:

```lua
local ICONES = {
	colete   = "rbxassetid://0000000",
	capacete = "",
	...
}
```

**Enquanto não vier:** o chip mostra só a palavra + o número (`Colete 62`), que já
passa na regra dos 2 segundos. Com ícone, o texto encolhe e o ícone aparece —
o código já trata os dois casos.

---

## 🟡 3 · Escada do poste + anims subir/descer (Eletricista)

Continua pendente, igual estava. Sem isso o Eletricista (F5) não começa.
Ver [[Assets_Julio]].

---

## 🟡 4 · Modelo do chip, anim do celular na mesa, computador da central, anim de carregar no ombro

Também seguem pendentes e sem mudança. Ver [[Assets_Julio]].

---

## ⚪ 5 · Decisões que eu já tomei — só diga se concorda

Tomei essas sozinho pra não travar a noite. Todas são **reversíveis em 1 linha**.

### 5.1 · O chip "Caído" saiu da coluna
A tela de morte já conta o mesmo tempo em tela cheia, com barra. Duas coisas
dizendo a mesma coisa é pior que uma (seção 10 do plano). A peça continua na
tabela — só não ganha chip.
**Reverter:** tirar `naColuna = false` da linha `caido` em `Hud.N`.

### 5.2 · Teto de 4 chips na coluna
Com as 6 peças acesas a coluna ia até y=254 e batia no painel da revista
(`RightRequest`, que começa em y=204). Teto de 4, mesma regra do feed — e a ordem
já garante que quem cai fora é o menos importante (mirando).
**Reverter:** `N.MAX_CHIPS` em `Hud.N`.

### 5.3 · Barra = quantidade. Vermelho = perigo.
Na primeira foto a barrinha aparecia cheia também em peça sem número (`Mirando`,
`Algemado`) e lia como "100% de alguma coisa". Agora barra só em colete/capacete;
severidade virou **cor do texto**.

### 5.4 · Cor do minimapa: a RUA é a coisa mais clara
Na primeira versão a rua sumia no meio dos prédios. Inverti: chão e prédio
escuros, **rua clara**, vegetação verde escuro. É o que faz o mapa servir pra
navegar. Se quiser outro clima (sépia, azulado), é a tabela `N.PALETA` em
`Client.Minimapa.N` — 11 linhas.

### 5.5 · Onde o minimapa fica
Canto **inferior esquerdo**, como o plano manda. **Ainda não movi nada** —
o feed de avisos hoje ocupa esse canto e vai encostar nele quando tiver 3 cards.
**A decisão que falta é sua**, e são duas linhas de conserto:

- **(a)** o feed sobe e passa a terminar logo acima do minimapa (mesma coluna, mesmo comportamento) — **minha recomendação**; ou
- **(b)** o feed vai pro topo esquerdo, embaixo do card do objetivo.

### 5.6 · A vida vai aparecer duas vezes
O plano põe vida + colete como 2 barras finas embaixo do minimapa (já estão lá).
Só que `Main.HUD` continua mostrando "100 ♥" embaixo à direita. **Não apaguei
nada** — quando o minimapa acender você vê as duas e decide qual fica.

---

### 5.7 · A favela não tem nome de rua
Dos 18 endereços de entrega do carteiro, **8 não têm rua num raio de 220 studs** —
7 deles na Vila Pantanal (a favela), até 986 studs da avenida mais perto.
Hoje o objetivo mostra **"V. Pantanal - 340 m"**, que é honesto: beco de favela
não tem nome de rua mesmo.
**Se quiser nomear**, me diga e eu ponho — o registro certo seria *Estrada da
Vila Pantanal* pro acesso principal e *Beco do…* pros ramais. É uma linha por via.

### 5.8 · O mapa precisa ser assado uma vez (e salvo)
`ReplicatedStorage.MapaModelo` some entre sessões de Play até o place ser salvo.
Se abrir o jogo e o minimapa não aparecer, é só rodar no Studio:
```lua
require(game.ServerStorage.AssarMapa).assar()
```
Depois de um **Ctrl+S + Publish** ele fica gravado e isso não acontece mais.
Rode de novo sempre que mexer no mapa — é o que atualiza o minimapa.

### 5.9 · O feed de avisos mudou de lugar (era a decisão 5.5)
Você tinha isso em aberto. Escolhi a opção (a): o feed **continua no mesmo canto**,
só passou a terminar acima do minimapa. Coluna esquerda agora, medida em Play:
objetivo 49–117 · feed 119–474 · minimapa 483–684 · Infos 698–752. Sem sobreposição.
Reversível pelos atributos `QA_pos_orig` / `QA_size_orig` no `Main.ServerInfos`.

## ✅ Nada disso trava o resto
Tudo o que foi feito nesta noite está atrás da chave `HUDv2` e só aparece pra quem
está em `Chaves.TESTADORES`. Com a chave desligada o jogo se comporta exatamente
como antes.
