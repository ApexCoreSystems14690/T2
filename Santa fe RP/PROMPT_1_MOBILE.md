# PROMPT 1 — Motor de entrada MOBILE do Santa Fé Roleplay

Você vai trabalhar sozinho a noite inteira no **Santa Fé Roleplay** (Roblox), place **DEVTS `78083733455249`**, pelo MCP do Roblox Studio. Fale comigo em **português do Brasil**, curto e direto.

## REGRA ZERO: AUTONOMIA TOTAL

O dev foi dormir. **Não pergunte nada. Não pare pra pedir permissão. Não espere resposta.** Se faltar informação, você MEDE no código; se não der pra medir, você escolhe o caminho mais reversível, **anota a escolha e o porquê**, e segue. Decisão trancada é só isto: publicar (nunca publique) e apagar coisa do mapa (nunca apague).

Quando terminar uma frente, **comece a próxima sozinha**. A noite é longa: encha ela.

---

## O OBJETIVO

Hoje o jogo é 100% desenhado pra **teclado e mouse**. Interação é tecla F com barra de tempo, combate é mouse, inventário/vestiário/celular/oficina são telas feitas pra ponteiro. No celular isso vai de desconfortável a impossível.

A meta da noite: **mapear a experiência inteira do jogador por dispositivo** e **projetar o motor de entrada que falta**, com uma fatia construída e provada — não um plano teórico.

Controle (gamepad) **fica pra muito depois**. Cite onde o desenho precisa deixar a porta aberta pra ele e siga.

---

## FASE A — INVENTÁRIO MEDIDO (sem opinião)

Varra TODO o cliente (`StarterPlayer`, `StarterGui`, `ReplicatedStorage`, `ReplicatedFirst`) e liste **cada entrada que o jogo lê**:

- `UserInputService` (`InputBegan`, `InputEnded`, `InputChanged`, `IsKeyDown`, `GetMouseLocation`, `MouseBehavior`)
- `ContextActionService` (toda ação presa e qual tecla)
- `Mouse` (`Button1Down`, `Hit`, `Target`, `Move`)
- `Enum.KeyCode.*` e `Enum.UserInputType.*` literais no código
- qualquer `TouchEnabled` / `GamepadEnabled` já existente (pode já ter gambiarra meio-feita; ache)

Para cada uma, uma linha de tabela: **arquivo:linha · tecla/gesto · o que faz · tem equivalente no toque hoje? · o que um dedo NÃO consegue fazer aqui**.

Faça isso com **agentes Explore em paralelo** — é exatamente o caso de uso deles (varredura ampla, read-only). Divida por raiz (um por `StarterPlayer.StarterPlayerScripts.Client`, um por `GuiHandler` e filhos, um por `ToolHandler`, um por `StarterGui`, um por resto). **Só a thread principal escreve no Studio**; agentes só leem e reportam.

Coisas que eu já sei e você confirma em vez de descobrir do zero:
- Interação é por **tag `Interact` + `Region3`** no `Client.InteractionHandler` (~linha 3094 do `RemotesHandler` no lado servidor). Atributos na peça: `Request`, `Description`, `Key` (quase sempre "F"), `Time`. **`Region3` ignora peça com `CanQuery = false`** — já derrubou o ponto de reparo do ônibus.
- Armas: `Client.ToolHandler.ArmaMotor` (mira, cadência, recarga) e `[Armas] Services.ArmaMotor` no servidor. Mira usa raycast da câmera.
- Câmera: `Client.CameraHandler`. `StarterPlayer.DevComputerCameraMovementMode = Classic`; o **`DevTouchCameraMovementMode` segue `UserChoice` e ninguém olhou pra ele ainda**.
- Teclas que eu lembro em uso: F (interagir), C (agachar), B (descansar / mobiliar casa), N (saudação), V (render), H (carregar corpo), K (rodinha de danças), G (inventário), hotbar numérica. **A lista completa é a Fase A — não confie na minha memória.**

**Entregue a Fase A como arquivo** (tabela markdown) antes de passar pra B.

---

## FASE B — CENSO DE TELA

Para cada `ScreenGui` do jogo, meça (não estime):

- usa `Scale` ou `Offset`? (Offset puro = quebra em tela de celular)
- menor alvo clicável em pixels — **qualquer coisa abaixo de ~44px de lado é inalcançável com o dedo**
- o que cai na **zona do polegar** e o que colide com os controles de toque nativos do Roblox (joystick virtual embaixo à esquerda, botão de pulo à direita)
- texto menor que ~14px
- tem `SafeAreaCompatibility` / respeita notch?
- quantos elementos simultâneos a tela tem (densidade)

Entregue tabela por tela, ordenada do pior pro melhor.

---

## FASE C — O MOTOR

Projete a camada que falta. O princípio: **os handlers de hoje leem tecla diretamente; eles deveriam ler INTENÇÃO.** Ou seja, em vez de `if input.KeyCode == Enum.KeyCode.F`, algo como `Entrada.ligar("Interagir", fn)` — e a camada decide se "Interagir" nasce de uma tecla, de um botão na tela ou (um dia) de um gamepad.

O que o documento tem que ter:
- nome e lugar do módulo (proponha; `ReplicatedStorage.Shared.Entrada` é um chute razoável)
- o **contrato** completo: como se registra uma ação, como se cancela, como funciona ação com tempo (a barra do F), ação contínua (segurar), ação com alvo (mirar/atirar)
- como o botão de toque **aparece e some sozinho** conforme o contexto (o F só vira botão na tela quando tem algo pra interagir perto; senão a tela vira um painel de controle remoto)
- como isso convive com os handlers atuais **sem reescrever os 326 mil caracteres do `RemotesHandler`** — a camada é aditiva, os handlers migram um por vez
- o que é **impossível** adaptar e precisa de mecânica diferente no celular (seja honesto: alguma coisa vai cair nessa lista; dirigir + atirar ao mesmo tempo é a candidata óbvia)

---

## FASE D — FATIA VERTICAL PROVADA

Não me entregue plano puro. **Construa UM subsistema inteiro em cima da camada nova, ativo.** Recomendo **a interação (F)**, porque é o que mais aparece no jogo e é o que mais trava no celular.

- A camada é **gated por `UserInputService.TouchEnabled`**: no desktop nada muda, por construção. Isso não é "flag de segurança desligada" — é a própria natureza da feature, que é por dispositivo.
- Nada nasce desativado esperando aprovação. Faça e deixe funcionando.
- **Prove**: núcleo puro rodado por `loadstring(modulo.Source)()` no Edit + a tela montada numa `SurfaceGui` numa Part do workspace e fotografada com `screen_capture`. **Apague a Part no fim.**
- **ARMADILHA DA FOTO:** a face `Front` de uma Part aponta pro **−Z**. Ponha a câmera em z NEGATIVO, senão você fotografa o verso preto e acha que a GUI não renderizou.

---

## FASE E — ROADMAP

Subsistema por subsistema (interação, combate, câmera, inventário, vestiário, celular/cll, navegador, oficina, garagem, revista, porta-malas, SAMU, PC da Polícia Civil, PD), com: esforço, risco de quebrar o desktop, e dependência entre eles. Ordene por **dor do jogador ÷ esforço**.

No fim do roadmap, uma seção curta de **gamepad**: só o que o desenho da Fase C precisa prever hoje pra não fechar a porta. Nada além disso.

---

## COMO TRABALHAR NESTE PLACE (isto economiza sua noite)

**NÃO DÊ PLAY.** O dono proibiu. Teste por `loadstring` no Edit e por `SurfaceGui` + `screen_capture`. `ScreenGui` não renderiza no Edit; `SurfaceGui` sim.

**O Studio cai e volta num save PARCIAL.** Aconteceu hoje: voltou com ID novo e com parte das edições do dia faltando. Depois de QUALQUER desconexão:
1. `list_roblox_studios` (o ID muda);
2. **marker-check**: uma chamada só procurando um marcador único por edição que você fez (`src:find("MEU_MARCADOR", 1, true)`), arquivo por arquivo;
3. refaça o que sumiu, com backup de novo.
Não confie que o que você editou continua lá. Sem esse check hoje eu teria publicado um arquivo sem nenhuma das correções.

**Limite de 60 s por chamada ao computador.** `loadstring` em todos os scripts da place de uma vez estoura. Quebre em 2 pedaços (um: `ServerScriptService` + `ReplicatedStorage` + `ReplicatedFirst` ≈ 336 scripts; outro: `StarterPlayer` + `StarterGui` + `ServerStorage` + `Workspace` + `Lighting` + `SoundService` + `StarterPack` ≈ 1.146).

**`script_read` em arquivo grande** devolve o conteúdo num arquivo local em vez de na resposta. Leia com `sed -n` pelo Bash em vez de brigar com o tool.

**Bug clássico de contar linha:** `src:gmatch("[^\n]*")` devolve uma string vazia entre cada linha e **dobra os índices**. Use `[^\r\n]+`.

**`multi_edit` é atômico**: se uma edição não casar, NENHUMA é aplicada. Extraia o trecho exato com `string.find` antes de montar a edição, em vez de adivinhar espaçamento.

**Backup antes de toda edição**, em `ServerStorage.Backups_Mobile_<data>`.

**`device_bash`** (shell na máquina do dev) **pode não subir** — hoje deu "Workspace unavailable". Se precisar de arquivo do PC, use `device_stage_files` / `device_commit_files`.

**Nunca use o MCP do Windsor.ai.** O dono proibiu.

**NÃO ABRA UMA QUARTA PLACE.**

**NÃO PUBLIQUE.** Deixe salvo no Studio e liste no fim o que precisa de Ctrl+S → Publish. O jogo está no ar com gente dentro; publicar é decisão dele, de manhã, acordado.

---

## DIVISÃO COM O OUTRO CHAT (importante)

Hoje à noite roda **outro chat em paralelo, no MESMO place**, trabalhando no **anti-void**. Pra vocês não salvarem por cima um do outro:

**Você é dono destes caminhos — só você edita:**
- `StarterPlayer.StarterPlayerScripts.Client.*` (todos os handlers de cliente)
- `StarterGui.*`
- `ReplicatedStorage.Shared.Entrada` (ou o nome que você der à camada nova)

**Não encoste em:** `ServerScriptService.Server.Services.*`, `ServerScriptService.*` solto, `workspace`. Se precisar de uma mudança lá, **escreva o pedido no seu relatório final** em vez de fazer.

**Zona cinzenta:** `Client.CharacterHandler` e `Client.CameraHandler` são seus, mas o outro chat pode querer ler. Antes de salvar neles, releia o `Source` e confirme que ninguém mexeu.

Deixe um `StringValue` em `ServerStorage` chamado `TRABALHANDO_Mobile` com o nome do arquivo que você está editando no momento, e limpe no fim.

---

## O QUE QUERO LER DE MANHÃ

1. Os arquivos das Fases A, B, C e E.
2. A fatia da Fase D **funcionando**, com a foto.
3. Uma lista do que precisa de publish.
4. Uma lista honesta do que você NÃO conseguiu medir e por quê.
5. Memória salva por mecânica (`/projects/01a126ed-465f-74cf-b5d0-dabdc6e1b639/areas/santa-fe-mobile-*.md`), detalhada, no padrão dos outros arquivos de lá — leia alguns antes pra pegar o tom.

**Leia a memória do projeto ANTES de começar.** `memory_list` em `/projects/01a126ed-465f-74cf-b5d0-dabdc6e1b639/` e leia tudo que parecer relevante. Lá estão as decisões do dono, as armadilhas de cada sistema e as coisas que ele já reprovou. Não redescubra o que já está escrito.
