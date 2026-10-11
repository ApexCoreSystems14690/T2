# PROMPT 2 — Anti-void de verdade no Santa Fé Roleplay

Você vai trabalhar sozinho a noite inteira no **Santa Fé Roleplay** (Roblox), place **DEVTS `78083733455249`**, pelo MCP do Roblox Studio. Fale comigo em **português do Brasil**, curto e direto.

## REGRA ZERO: AUTONOMIA TOTAL

O dev foi dormir. **Não pergunte nada. Não pare pra pedir permissão. Não espere resposta.** Faltou informação, você MEDE no código. Não deu pra medir, você escolhe o caminho mais reversível, **anota a escolha e o porquê**, e segue. Decisão trancada é só isto: publicar (nunca publique) e apagar coisa do mapa (nunca apague).

Terminou uma frente, começa a próxima sozinho. A noite é longa.

---

## O PROBLEMA

[stated] Julio: *"um ant void realmente adequado, tendo em mente que o atual não presta para absolutamente nada."*

Ele chama de **anti-void**: o sistema que cuida do jogador que cai pra fora do mundo — buraco no mapa, atravessou o chão, caiu embaixo do mapa, foi parar no vazio. Hoje existe alguma coisa com esse papel e ela **não funciona**.

**Primeira tarefa é descobrir o que existe e por que não presta.** Não construa nada antes disso. Se no código o nome "void" cobrir outra coisa além de queda (por exemplo algum abuso que ele chama assim), **siga o código, não a minha interpretação**, e diga no relatório que o escopo era outro.

---

## FASE A — AUTÓPSIA DO ATUAL

Varra a place inteira atrás de tudo que toca nisso:
- `workspace.FallenPartsDestroyHeight` (valor atual) e qualquer script que leia ou mude isso
- qualquer `Position.Y <`, `.Y < -`, `AltitudeMinima`, `abaixo`, `caiu`, `void`, `Void`, `vazio`, `limbo`
- qualquer teleporte/`CFrame =`/`MoveTo`/`PivotTo` de personagem que pareça "devolver" alguém
- `PlayerHandler`, `CharacterHandler`, `Server.boot`, e o sistema **`VoltaOndeParou`** (que salva onde o cara saiu — vai interagir com isto)
- `Humanoid.StateChanged` / `FallingDown` / `Seated` / `PlatformStand`

Para cada achado: **arquivo:linha, o que faz, e POR QUE não resolve.** Use **agentes Explore em paralelo** pra essa varredura (read-only, é o caso de uso certo). **Só a thread principal escreve no Studio.**

Entregue a autópsia como arquivo antes de projetar qualquer coisa.

---

## FASE B — ONDE O JOGADOR CAI DE VERDADE

Não adianta consertar o resgate se o buraco continua. **Meça o mapa:**
- amostre o `workspace` num grid e procure onde NÃO existe chão abaixo (raycast pra baixo sem acertar nada até uma altura absurda)
- liste as regiões com buraco, com coordenada, tamanho aproximado e o que tem em volta (favela? Nova Esperança? embaixo de prédio?)
- veja se tem junta de terreno/parte com `CanCollide = false` que deveria ser sólida

Entregue um mapa dos buracos (tabela + se der, um desenho simples por `SurfaceGui` fotografada). **Buraco de mapa é conserto do Julio**, não seu — você entrega a lista, não sai tapando geometria.

---

## FASE C — O SISTEMA NOVO

Projete e **construa**. O que um anti-void adequado pra RP tem que resolver:

**1. Detectar cedo.** Não esperar o personagem morrer caindo. Detectar que ele está em queda livre fora do mundo (ou já abaixo do chão) e agir antes da morte.

**2. Devolver pra um lugar que faça sentido.** O chão sólido mais próximo de onde ele estava, não o spawn da cidade. Teleportar pro spawn é o que faz o jogador perder meia hora de RP e é provavelmente metade do "não presta".

**3. NÃO virar rota de fuga.** Isto é o mais importante e é onde um anti-void ingênuo estraga o jogo: se cair no void devolve você são e salvo, cair no void vira a saída mais barata de um assalto, de uma algema ou de um tiroteio. O sistema tem que respeitar o estado:
   - **algemado / amarrado / rendido** (`Algemado`, `Rendido`) — volta algemado, e perto de quem o algemou se possível
   - **em combat log** (`CombatLog == true`) — volta no mesmo lugar, sem alívio nenhum
   - **caído** (o estado de caído/`Morte`) — volta caído, não de pé e curado
   - **sendo carregado** / **dentro do porta-malas** — tem que voltar junto de quem carrega, ou o sequestro some no ar
   - **dentro de veículo** — o carro cai junto; decida se devolve os dois e prove o que escolheu
   - **em cutscene** (o Ferro Velho do PD tem uma) ou **no leito da SAMU** — não pode arrancar o cara do meio de um sistema

**4. Não vazar pra outros sistemas.** Regra permanente do dono: *"defina visualmente e mecanicamente, simples"* e **o efeito fica DENTRO da área da mecânica**. Anti-void não mexe em dinheiro, loja, NPC nem economia. Não invente punição nova.

**5. Dizer na tela o que aconteceu.** O jogador tem que entender que caiu num buraco e foi devolvido — não achar que o jogo bugou ou que foi teleportado por admin.

**6. Logar.** Cada resgate com nome, coordenada de onde caiu e o que ele estava fazendo. É isso que vira a lista de buracos pra consertar, e é isso que separa "buraco de mapa" de "exploiter procurando o void de propósito". Se o mesmo jogador cair N vezes em pouco tempo, isso tem que aparecer no log.

---

## FASE D — PROVA

- **NÃO DÊ PLAY.** O dono proibiu. Teste o núcleo puro por `loadstring(modulo.Source)()` no Edit, com o estado entrando como argumento (algemado, caído, em veículo, em combat log, carregado, em cutscene) — igual o `Regras.SSU` é testado lá. **Escreva o módulo de regra como núcleo PURO justamente pra poder testar assim**: sem `Instance`, sem serviço, sem `os.time()` por dentro.
- Tabela de casos: para cada estado × cada tipo de queda, o que o sistema decide. Rode e me mostre o placar (`PASSOU x | FALHOU y`).
- Prova visual do aviso na tela por `SurfaceGui` numa Part + `screen_capture`. **Apague a Part no fim.**
- **ARMADILHA DA FOTO:** a face `Front` de uma Part aponta pro **−Z**. Câmera em z NEGATIVO, senão sai um retângulo preto (o verso) e parece que a GUI não renderizou.

---

## COMO TRABALHAR NESTE PLACE (isto economiza sua noite)

**O Studio cai e volta num save PARCIAL.** Aconteceu hoje: voltou com ID novo e com parte das edições do dia faltando. Depois de QUALQUER desconexão:
1. `list_roblox_studios` (o ID muda);
2. **marker-check**: uma chamada só procurando um marcador único por edição sua (`src:find("MEU_MARCADOR", 1, true)`), arquivo por arquivo;
3. refaça o que sumiu, com backup de novo.
Não confie que o que você editou continua lá.

**Limite de 60 s por chamada ao computador.** `loadstring` em todos os scripts da place de uma vez estoura. Quebre em 2 pedaços.

**`script_read` em arquivo grande** devolve o conteúdo num arquivo local. Leia com `sed -n` pelo Bash.

**Bug clássico de contar linha:** `src:gmatch("[^\n]*")` devolve string vazia entre cada linha e **dobra os índices**. Use `[^\r\n]+`.

**`multi_edit` é atômico**: se uma edição não casar, NENHUMA é aplicada. Extraia o trecho exato com `string.find` antes de montar a edição.

**O `RemotesHandler` tem ~326 mil caracteres** — `execute_luau` não consegue setar `Source` acima de ~200k. Mexa nele só por `multi_edit`.

**Antes de considerar qualquer coisa pronta:** confira que **não existe `BindableFunction` chamada `QA` dentro de um `ModuleScript`**. Isso já quebrou o dano de tiro duas vezes (19/09 e 03/10). Hoje são 0.

**Backup antes de toda edição**, em `ServerStorage.Backups_AntiVoid_<data>`.

**`device_bash`** (shell na máquina do dev) **pode não subir** — hoje deu "Workspace unavailable". Se precisar de arquivo do PC, use `device_stage_files` / `device_commit_files`.

**Nunca use o MCP do Windsor.ai.** O dono proibiu.

**NUNCA mexa em temporada / wipe** sem contar as chaves nas DUAS lojas com `ListKeysAsync` passando `excludeDeleted = true`. Você não tem motivo nenhum pra chegar perto disso hoje — é só pra você saber que é terreno minado.

**NÃO ABRA UMA QUARTA PLACE.**

**NÃO PUBLIQUE.** Deixe salvo no Studio e liste no fim o que precisa de Ctrl+S → Publish.

---

## DIVISÃO COM O OUTRO CHAT (importante)

Hoje à noite roda **outro chat em paralelo, no MESMO place**, trabalhando no **motor de entrada mobile**. Pra vocês não salvarem por cima um do outro:

**Você é dono destes caminhos — só você edita:**
- `ServerScriptService.Server.Services.*` (incluindo o serviço novo que você criar)
- `ServerScriptService.*` solto
- `workspace` (só pra MEDIR; não altere geometria)

**Não encoste em:** `StarterPlayer.StarterPlayerScripts.Client.*`, `StarterGui.*`. Se o aviso na tela precisar de um `ScreenGui` novo, **crie um só seu, com nome próprio** (`AvisoVoid`, por exemplo) e não toque em nenhuma tela existente. Se precisar de mudança em handler de cliente que já existe, **escreva o pedido no relatório final** em vez de fazer.

**Zona cinzenta:** `Client.CharacterHandler` e `Client.CameraHandler` são do outro chat. Leia à vontade, não salve.

Deixe um `StringValue` em `ServerStorage` chamado `TRABALHANDO_AntiVoid` com o nome do arquivo que você está editando no momento, e limpe no fim.

---

## O QUE QUERO LER DE MANHÃ

1. A autópsia (Fase A): o que existia e **por que não prestava**, com arquivo:linha.
2. A lista de buracos do mapa (Fase B), com coordenadas.
3. O sistema novo **funcionando**, com o placar dos testes e a foto do aviso.
4. A tabela de decisão estado × queda, explícita — principalmente o que acontece com algemado, em combat log e dentro de veículo.
5. Uma lista do que precisa de publish.
6. Uma lista honesta do que você NÃO conseguiu medir e por quê.
7. Memória salva (`/projects/01a126ed-465f-74cf-b5d0-dabdc6e1b639/areas/santa-fe-antivoid.md`), detalhada, no padrão dos outros arquivos de lá.

**Leia a memória do projeto ANTES de começar.** `memory_list` em `/projects/01a126ed-465f-74cf-b5d0-dabdc6e1b639/` e leia tudo que parecer relevante — principalmente `santa-fe-kick-antispam`, `santa-fe-pd`, `santa-fe-volta-onde-parou`, `santa-fe-corpo-caido`, `santa-fe-safezone` e `santa-fe-mecanicas`. Lá estão as decisões do dono e as armadilhas de cada sistema. Não redescubra o que já está escrito.
