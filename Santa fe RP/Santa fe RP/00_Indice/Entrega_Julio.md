# 📥 O que está esperando por você

> Lista viva do que **só você pode destravar**, com a decisão já tomada do meu lado.
> Regra: cada item diz **o que falta**, **onde exatamente**, e **o que acontece no minuto seguinte**.
> Item resolvido sai daqui e vira linha no [[Log]].

---

## 👀 0 · OLHA O HOLOGRAMA (minimapa) — 3 perguntas, em voz alta

A cartografia (v1–v12) morreu; o minimapa agora **mostra** o mundo em volta de você em 3D
(ver [[Minimapa_Holografico]]). Dá Play como testador e responde:
1. Eu conseguiria me guiar por isso?
2. Sei o que é aquele prédio? (serviço perto = rótulo + cor do serviço)
3. Sei o que é aquele azul mais forte? (sólido = na tua altura · vidro = acima da cabeça)

Qualquer "não" reprova a volta. Depois entra numa loja e vê se o telhado some e as paredes de dentro aparecem.

---

## 🧹 1 · Uma linha tua no Studio: arquivar o `MapaModelo`

`ReplicatedStorage.MapaModelo` ainda tem **42.427 peças** replicando pra todo cliente e ninguém usa
(o holograma não lê ele; só o `Shared.MapaDados` velho cita o nome). Eu não tenho permissão pra mover.
No Edit, barra de comando:
```lua
local m = game.ReplicatedStorage.MapaModelo
m.Name = "MapaModelo_v11_arquivado"; m.Parent = game.ServerStorage.Backups
```
Depois Ctrl+S + Publish. Reverter é o inverso. `AssarMapa`/`MapaGrade`/`MapaDesenho` podem ficar em ServerStorage (não replicam).

---

## ✅ 1b · Os checklists que só você fecha (Play)

Tudo em [[Lista_Testes]], seção "Pra ti conferir jogando": **F1** (carteiro, prisão + relog, mochila 3 logins,
cúpula, multa M) · **F3** (feed, objetivo andando, chips, holograma) · **celular com 2 players** (mensagens salvas).
É o que fecha F1 e F3 de verdade.

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

### 5.4 · Cores do holograma: COR = o que é, BRILHO = altura
Serviço na cor do serviço, carro âmbar, resto azul; acima da tua cabeça vira vidro, abaixo escurece.
Chão pintado pelo material (grama escura, piso mais claro). Trocar: tabelas de cor em `Client.Minimapa`.
(A regra antiga "rua é a cor mais clara" era da cartografia, que morreu.)

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

### 5.9 · O feed de avisos mudou de lugar (era a decisão 5.5)
Você tinha isso em aberto. Escolhi a opção (a): o feed **continua no mesmo canto**,
só passou a terminar acima do minimapa. Coluna esquerda agora, medida em Play:
objetivo 49–117 · feed 119–474 · minimapa 483–684 · Infos 698–752. Sem sobreposição.
Reversível pelos atributos `QA_pos_orig` / `QA_size_orig` no `Main.ServerInfos`.

## 🚗 6 · Fusca nativo — olhar e decidir (16/09)
`ServerStorage.PortaMalasFrota.Modelos.FuscaNativo` é o Fusca refeito com porta-malas dianteiro de verdade
(cuba, calha, capô sólido, 4 slots) e tampa do motor modelada mas **desligada** (só porta-malas, como você mandou).
Bancada em `workspace.FuscaOriginal_REF` / `AMG_REF` (Y=900).
- Dá Play, spawna ele e abre o porta-malas. Se aprovar: trocar `Assets.Carros.Fusca` pelo `Modelos.FuscaNativo` + Ctrl+S + Publish.
- **Decisão AMG:** o carro do Blender é um S-Class W223 sedan; a AMG do jogo é um GLE Coupé (56 MeshParts). Não são o mesmo carro.
  Você disse pra seguir com o S-Class (interior leve, menos polígonos, só o interior do porta-malas fiel). Confirma e eu começo.
- Método inteiro na skill `porta-malas-nativo` (Kombi, Uno e o resto da fila usam ela).

## 🔓 Chaves: TODAS LIGADAS desde 19/09 (lançamento)
Decisão tua: `HUDv2`, `CelularV2` e as outras 6 estão `true` em `ReplicatedStorage.ChavesValores`,
pra todo mundo. Se algo quebrar ao vivo, o kill switch é virar o BoolValue pra `false`
(vale pra quem entrar depois). O valor antigo está no atributo `QA_valor_antes_lancamento`.
