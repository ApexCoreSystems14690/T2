# Hud (client) — F3, núcleo puro

- Path: `StarterPlayer.StarterPlayerScripts.Client.Hud` (casca) + filho `Hud.N` (**núcleo puro**, sem Instance, roda no luau CLI).
- Criado em 17/09, volta 1 do F3. **66 testes, 0 falhas.**

## O que o N decide
- **Feed:** `novaFila()` · `empurrar(fila, aviso, agora)` → entrou, saiu · `expirar(fila, agora)` · `quantos(fila)`.
  Máx **3** na tela. Prioridade `perigo(3) > ganho(2) > aviso(1)`: aviso banal **não** derruba perigo; empate sai o mais velho.
- **Texto (regra dos 2s):** `distancia(studs)` → "180 m" / "1,2 km" · `relogio(seg)` → mm:ss travado em 00:00 e 99:59 · `milhar` · `dinheiro` → "R$ 1.234" · `peso(6,20)` → "6 / 20 kg". Nunca devolve número sem unidade.
- **Crítico:** `ehCritico(valor, max)` — ≤ **25%**.
- **Contexto:** UMA tabela `N.PECAS` (mesmo padrão do [[Aparelhos]]`.N.MOTIVOS`) liga cada peça a um **atributo** e a um teste (`verdade` / `maiorQueZero` / `textoCheio`). `visiveis(estado)` devolve quem aparece; `diferenca(antes, depois)` devolve quem entra e quem sai (pra alimentar o [[Motion]]).
  Peça nova = **uma linha** na tabela, nunca um `if` espalhado.
- `ok3palavras(texto)` existe pros testes: garante a regra de [[UI_Clareza]].

## Por que atributo e não pergunta ao servidor
Princípio do plano: a HUD **lê atributo** e nunca chama o servidor por frame.

### O CONTRATO REAL (medido no jogo em 18/09) — corrigido
A versão anterior desta nota listava `Dirigindo`, `ArmaNaMao` e `SalarioPendente`.
**Esses três não existem** — eu tinha inventado nomes e escrito como se fossem contrato.
Fui medir quem publica o quê e reescrevi a tabela. O que existe de verdade:

| Peça | Atributo | Mora em | Acende quando | Quem publica |
|---|---|---|---|---|
| colete | `ColeteDurabilidade` | **Character** | > 0 | `EquipamentoService:121-123` |
| capacete | `CapaceteDurabilidade` | **Character** | > 0 | idem |
| mirando | `Mirando` | **Character** | true | `ArmaMotor` |
| prisao | `Preso` | **Player** | > 0 (segundos que faltam) | `MotivosHandler` |
| algemado | `Algemado` | **Player** | true | `PlayerHandler` / `RemotesHandler` |
| caido | `Morte` | **Player** | > 0 | `CaidoService` |
| objetivo | `Objetivo` | **Player** | texto não vazio | quem der o objetivo |

`N.ondeLer(peca)` devolve `"player"` ou `"personagem"` — quem desenha usa isso pra
escolher onde ler. **Peça nova = uma linha na tabela**, nunca um `if` espalhado.

**SEM ATRIBUTO DE PROPÓSITO:** "arma na mão" e "dirigindo" o CLIENTE descobre sozinho
(Tool equipada / `Humanoid.SeatPart`). Criar atributo pra isso seria fazer o servidor
trabalhar de graça. **AINDA NÃO EXISTE:** salário pendente — só quando a Central do F4 existir.

### A armadilha que quase fez eu errar de novo
Procurei `ColeteDurabilidade` por grep e **não achei** — concluí que não existia.
Existe: o `EquipamentoService` monta o nome numa **variável**
(`local nome = (slot == "colete") and "ColeteDurabilidade" or "CapaceteDurabilidade"`)
e seta no **Character**. É a tendência nº 9 da [[Skill_UI_Roblox]] — *medir a coisa
errada com confiança*. Grep de nome de atributo só prova ausência se o nome nunca
for montado em runtime.

## O que JÁ existe no jogo (medido antes de criar, pra não duplicar)
- `Main.HUD` = vida (`Vital`) + mochila (`Backpack`), canto inferior direito.
- `Main.Infos` = Sono, Sede, Fome, Carteira, canto inferior esquerdo (hoje mostram `NaN` quando o dado não chegou).
- `Main.Level` = barra de XP no topo.
- `Client.NotificaHandler:SendNotification(titulo, texto, cor, t)` = toast na TopBar. **Já é uma notificação** — o Feed novo tem que absorver isso, não virar um segundo sistema.
- **NÃO existem:** Feed em fila, Objetivo com distância, peças contextuais, minimapa.

## Volta 2 (17/09) — o FEED, 34 testes, 0 falhas

**Não criei feed novo: adotei o `Main.ServerInfos`**, que já É o feed do jogo
(canto inferior esquerdo, `UIListLayout` vertical alinhado ao Bottom, `Template`
com `titulo`/`texto`/`cor`). Faltava só o que o `NotificaHandler` nunca teve:
teto, prioridade, expiração e animação.

- `Hud.avisar{titulo, texto, cor, tipo, dur}` → empurra na fila do `N`, clona o
  `Template`, entra pelo [[Motion]]. Quem é empurrado pra fora sai animado.
- Um relógio só, `Heartbeat` com acumulador de **0,25 s**. A HUD nunca conta por frame.
- `NotificaHandler` ganhou um desvio de 2 blocos marcados `[F3]`: **avisos
  genéricos vão pro feed**; os especiais (`Revistar`, `Combat Log`, `Mascara`,
  `Dono/Desenvolvedor Conectado/Desconectado`) continuam no caminho antigo,
  intactos. O `require` do Hud é protegido por `pcall` — **sem a chave `HUDv2`,
  este arquivo se comporta exatamente como antes**.
- `t >= 999` (aviso fixo) vira `dur = nil`: não expira sozinho.
- Backup: `ServerStorage.Backups.NotificaHandler_antes_feed`.

### Testes (bancada, sem Play)
Hud compila e carrega no Edit sem PlayerGui · com `HUDv2` desligada `iniciar()`
e `avisar()` devolvem **false** (o jogo fica como estava) · `avisar(nil)` e
`avisar(42)` não quebram · e o **texto real** do bloco `especial` do
`NotificaHandler` rodado numa bancada: os **7 títulos especiais** ficam no
caminho antigo e os **8 genéricos** vão pro feed.

### ARMADILHA NOVA (corrigida na hora)
`local N = require(script:WaitForChild("N"))` quebra no teste por `loadstring`
(`script` = nil) **e** caminho absoluto não resolve, porque em Play o módulo vive
em `PlayerScripts`, não em `StarterPlayerScripts`. A saída é o fallback:
`local aqui = script or game:GetService("StarterPlayer").StarterPlayerScripts.Client.Hud`.
Vale pra qualquer módulo de cliente que precise ser testável fora do Play —
merece entrar na skill [[Skill_UI_Roblox]] numa próxima revisão.

### Veredito visual: ✅ APROVADO pelo Julio (17/09)
3 cards na tela, legíveis, no lugar certo. "Bom, pode seguir."

### 3 defeitos que só o Play pegou (e os testes de bancada não pegavam)
1. **O título vinha vazio.** `N.empurrar` montava o item da fila com `texto`, `icone`
   e `tipo` — e **esquecia `titulo` e `cor`**. A fila tem que carregar tudo que o
   desenho vai precisar depois. (Os 66 testes não pegaram porque nenhum deles
   olhava o título.)
2. **Tudo invisível.** O `Template` do jogo nasce com transparência **1** em tudo —
   o `NotificaHandler` fazia o fade na mão depois de clonar. Eu clonei e não limpei
   a herança: o card entrava perfeito **e invisível**. É a tendência nº 4 da skill
   [[Skill_UI_Roblox]], e ela me pegou. Agora `montar` seta os valores finais do
   original: `ImageTransparency 0.6`, textos e barra em 0.
3. **`Motion.entrar` não serve pro card.** Ele só anima transparência de **TextLabel**
   e a posição — que num `UIListLayout` quem manda é o layout. Então quem ganha a
   animação são os dois textos, e o card aparece junto.

### Card órfão
`iniciar()` agora varre e destrói qualquer `Aviso_*` que sobrou no `ServerInfos`.
Acontece quando o módulo é recarregado, ou quando alguém o requer de outra VM —
foi o que me confundiu na medição: o `execute_luau` roda numa **VM separada**, com
fila própria, e não conhece os cards que a VM do jogo criou.

### Furo tapado de brinde
`NotificaHandler` linha 43 fazia `if _G.Data.Configs.Notificacoes == false`. Antes do
perfil carregar, `_G.Data` é nil e **isso estourava**, engolindo o aviso em silêncio.
Agora tem guarda. Era isso que escondia o feed no primeiro teste.

### Prova medida da prioridade (em Play)
Chegaram 5: Carteiro(aviso) · +R$159(**ganho**) · Poste(aviso) · Salário(aviso) · Ferido(**perigo**).
Sobraram os 3 certos: **+R$159, Salário, Ferido**. O Carteiro saiu por ser o aviso
comum mais velho, o Poste saiu depois pelo mesmo motivo, e o **ganho sobreviveu**
porque vale mais que um aviso comum. O perigo entrou com a fila cheia.

## Volta 3 (18/09) — o OBJETIVO, 28 testes + aprovado em Play

Card no **topo esquerdo**, abaixo da TopBar. Mesmo molde do feed (`ServerInfos.Template`
clonado), com a barra lateral na cor do tema do jogador.

### Contrato — a HUD lê ATRIBUTO, nunca pergunta ao servidor
```lua
plr:SetAttribute("Objetivo", "Entregar carta")            -- título. "" faz sumir
plr:SetAttribute("ObjetivoOnde", "Rua 7")                 -- opcional
plr:SetAttribute("ObjetivoAlvo", Vector3.new(x, y, z))    -- opcional, gera a distância
```
Quem publicar esses três atributos acende o objetivo. Subtítulo monta sozinho:
`"Rua 7 - 180 m"`, ou só a distância, ou só o lugar.

### Um relógio só
O mesmo `Heartbeat` com acumulador de **0,25 s** que expira aviso também atualiza a
distância. A HUD nunca faz conta por frame. O tick do objetivo roda dentro de `pcall`.

### DEFEITO DE LAYOUT QUE SÓ A MEDIDA PEGOU
Com `Position.Y = 0.062` o card nascia em **y = −7 px** — sangrando pra fora do topo.
Causa: a `UIAspectRatioConstraint` **centraliza** o card dentro do slot, então a posição
real fica acima do que a escala sugere. Medido em Play, varrendo valores:

| Y (escala) | topo real |
|---|---|
| 0.062 | **−7 px** (cortado) |
| 0.090 | 14 px |
| 0.110 | 31 px |
| **0.132** | **49 px** ✅ (a TopBar acaba em 36) |

Regra que fica: **com `UIAspectRatioConstraint`, a posição em escala não é a posição
real.** Medir `AbsolutePosition` em Play, sempre.

### Provado em Play
Card aceso, título e subtítulo certos, barra na cor do tema, e a distância **caiu de
180 m para 80 m** depois de andar 100 studs até o alvo. Limpar o atributo apaga o card.
Aprovado pelo Julio: "Sim, tá lá" / "Tá bom — fixa".

Backup: `ServerStorage.Backups.Hud_antes_objetivo`.

## Regressão do N (18/09) — 82 checagens, 0 falhas
Refeita depois da troca do `N.PECAS` (os 66 testes velhos batiam em peças que não
existem mais: `velocimetro`, `salario`, `arma`). Cobre fila, texto, crítico, as 7
peças, `visiveis`, `diferenca` e `ondeLer`.

**Erro meu que a regressão pegou:** eu escrevi os testes contra `fila[1]` e `.prio`.
A estrutura real é `fila.itens` e o campo é **`.tipo`**. O módulo estava certo; o teste
é que media errado. Regra confirmada de quebra: **empate de prioridade = o novo entra e
o mais velho da mesma faixa sai** (feed de notícia, o recente manda) — mas com a fila
cheia de `perigo`, um `aviso` **não** entra.

## Volta 4 (18/09) — PEÇAS CONTEXTUAIS: 70 testes + foto aprovada

Coluna de chips no **canto superior direito**, alinhada com o card do objetivo do
outro lado da tela. Medido antes de escolher o canto: inferior-direito é o
`Main.HUD`, inferior-esquerdo é `Infos` + o feed, superior-esquerdo é o objetivo.

O chip **não foi criado do zero**: é clone do `Main.Infos.Sede`, que já É o chip do
jogo (pílula + ícone + número Oswald + barrinha embaixo).

### DOIS ERROS MEUS QUE SÓ APARECERAM AO DESENHAR
A tabela anterior estava errada em duas peças, e as duas passariam batido:

1. **`Preso` não é "segundos que faltam" — é BOOLEAN.** `PlayerHandler:133`,
   `DataHandler:541` e `RemotesHandler:4682` setam `true`/`false`/`nil`. Com
   `maiorQueZero` a peça **nunca acenderia**. Os segundos moram em `plrData.Preso`
   (perfil), que o loop do `PlayerHandler:335` diminui 1/s — o servidor não
   publicava isso pra ninguém.
   **Conserto:** `quando = "verdade"`, e o `DataHandler` passou a publicar
   `PresoSegundos` nas 3 linhas em que o número já muda — sem loop novo, sem
   remote novo. Backup: `DataHandler_antes_presosegundos`.
2. **`Morte` não é contagem regressiva — é o `os.time()` de QUANDO caiu**
   (`CharacterHandler:227`, `CaidoService:138` `e.desde`). O quanto falta sai de
   `CaidoLimite`, atributo que o servidor **já publicava** (o `GuiHandler:2537` usa).

### O que a tabela ganhou
`rotulo` · `ordem` (de cima pra baixo) · `cor` (perigo/tema) · `formato`
(`numero` / `relogio` / `restante` / `nenhum`) · `valor` · `max` · `naColuna`.
E duas funções puras: `N.valorDe(peca, estado, agora)` e **`N.chips(estado, agora)`**,
que devolve a lista **já filtrada, já ordenada, já com texto e com crítico**.
Quem desenha não decide nada — só clona e escreve.

### 3 DEFEITOS QUE SÓ A MEDIDA E A FOTO PEGARAM
1. **Sobreposição (medida).** Com as 6 peças acesas a coluna ia até y=254 e o
   `RightRequest` (painel da revista) começa em **y=204**. Teto de 4 chips,
   mesma regra do feed — a ordem já garante que quem cai fora é o menos importante.
2. **Duplicação (foto).** O chip `Caído 08:50` repetia a **tela de morte**, que já
   conta o mesmo tempo em tela cheia e com barra. Saiu da coluna (`naColuna = false`).
3. **A barra queria dizer duas coisas (foto).** Ela aparecia cheia também em peça
   sem número (`Mirando`, `Algemado`) e lia como "100% de alguma coisa".
   **Regra que fica, e que o jogo já usava: BARRA = quantidade, COR = severidade.**
   Agora só colete e capacete têm barra; perigo virou cor do texto.

### Provado em Play + foto
`Preso 04:12` em vermelho sem barra · `Colete 62` branco com barra laranja a 62% ·
`Capacete 18` vermelho com barra a 18% (crítico) · `Mirando` branco sem barra.
Coluna de y=49 a y=187, com 16px de folga pro `RightRequest` e 13px da TopBar.
Alinhada com o card do objetivo, que também começa em y=49.

### Falta (não bloqueia)
Os **6 ícones** — ver [[Entrega_Julio]] item 2. Sem eles o chip mostra palavra +
número, que já passa na regra dos 2 s; com eles o texto encolhe sozinho.

Backups: `HudN_antes_chips`, `Hud_antes_contexto`, `DataHandler_antes_presosegundos`.

## Volta 5 (18/09) — MINIMAPA: funcionando em Play
Refeito **quatro vezes** até ficar bom (raster → vetor → ViewportFrame). O que está
no jogo é um `ViewportFrame` com a geometria real da cidade: parece o jogo porque É
o jogo, é nítido em qualquer zoom porque é geometria, e nenhum jogador aparece
porque só entra o que eu ponho dentro. **Não precisa mais de `EditableImage`, nem
da chave de Game Settings.** Sobe dentro de `Hud.iniciar()` em `task.spawn` +
`pcall`: se falhar, a HUD segue. Ver [[Minimapa]].

## A coluna esquerda inteira (medida em Play, 18/09)
| peça | y |
|---|---|
| objetivo | 49–117 |
| feed | 119–474 |
| minimapa | 483–684 |
| Infos (sono/sede/fome/carteira) | 698–752 |

Sem sobreposição. O feed desceu e encolheu um pouco pra caber — **mesma armadilha
do `UIAspectRatioConstraint`**: com ratio 0,4618 e largura 238px a altura real vira
515 e a constraint CENTRALIZA isso no slot de 624, ou seja o elemento fica 54px
acima do que a escala diz. Foi isso que fez o feed subir por cima do objetivo.

## Volta 6 (18/09) — O OBJETIVO LIGADO NO CARTEIRO
O card do objetivo deixou de ser demonstração. `RemotesHandler` publica os três
atributos quando a carta entra na mochila e limpa quando ela é entregue; o
`ObjetivoOnde` vem do núcleo [[Ruas_Enderecos]], então é endereço de verdade.

**Provado em Play, servidor → cliente:** "Entregar carta / **Av. Astorga - 668 m**",
e a distância caiu pra 548 m depois de andar 120 studs.
Backup: `RemotesHandler_antes_objetivo`.

## Falta
1. Ligar o objetivo no **Uber** e no **poste do eletricista** (o carteiro já está).
2. **Tab** (painel de jogadores próprio).
3. Rótulo de rua e bússola no minimapa: [[Ruas_Enderecos]] já entrega
   (`R.NORTE`, `R.curto`, `R.listar`).

## O que [[Ruas_Enderecos]] destravou no plano (18/09)
Duas coisas que a FONTE já pedia e não tinham de onde sair:
- **§7 Central das corporações:** "local auto (`workspace.Ruas`)" — o chamado do app
  Emergência agora nasce com endereço de verdade.
- **§8 Uber com bots:** "Julio entrega ~30 pontos (proponho lendo Ruas)" — `R.listar()`
  devolve 25 vias/pontos com nome, tipo, centro e comprimento.
