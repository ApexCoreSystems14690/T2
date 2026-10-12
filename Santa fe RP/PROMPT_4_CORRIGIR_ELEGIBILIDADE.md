# PROMPT 4 — Corrigir o que trava o Santa Fé em Restricted (marcas, sangue, Rondon)

Você vai trabalhar sozinho no **Santa Fé Roleplay** (Roblox), place **DEVTS `78083733455249`**, pelo MCP do Roblox Studio. Fale comigo em **português do Brasil**, curto e direto.

## REGRA ZERO: AUTONOMIA, GAUNTLET LOOP

**Não pergunte nada. Não pare pra pedir permissão.** Ação reversível (backup, medir, renomear, trocar textura) você faz, mede e conta depois. Terminou uma frente, começa a próxima sozinho.

Duas coisas ficam trancadas: **não publique** (o Julio publica) e **não apague asset do mapa** — esconder/trocar sim, deletar não.

---

## DE ONDE ISSO VEM

Uma auditoria de 12/10 concluiu que o jogo hoje tira **Restricted (18+)** e por isso não alcança o Roblox Select (9–15). Duas coisas empurram pra cima, e tem uma lista de risco de moderação separada. Este trabalho é **executar a correção**.

**IMPORTANTE:** o relatório é de outro agente, e a place já foi restaurada uma vez — **linha e caminho podem ter mudado**. Antes de mexer em cada item, **confirme no código que ele ainda está lá e ainda é assim**. Se divergir, siga o que você mediu e anote a divergência.

Decisão do Julio sobre o sangue, com as palavras dele: *"o ngc do sangue, desde que fique o furo no corpo e o respingo no chão tá ok"*. Ou seja: **pode mexer, contanto que o furo no corpo e o respingo no chão continuem existindo.**

---

## FRENTE 1 — SANGUE: TIRAR A POÇA, MANTER FURO E RESPINGO

Arquivo: `StarterPlayer.StarterPlayerScripts.TiroFXClient.Desenho`, função `pocaNoChao` (o relatório aponta ~371–575).

A régua da Roblox é literal:
- **sangue realista LEVE** (respingo distante, pontinhos espalhados) → **Moderate** ✅ é onde queremos ficar
- **sangue realista PESADO** (poça, jorro, respingo em close) → **Restricted** ❌

Então:

**FICA (o Julio pediu):**
- o **furo no corpo** — pequeno, colado na peça atingida
- o **respingo no chão** — mas como **gotas espalhadas**, não como disco contíguo

**SAI:**
- a **poça** embaixo do corpo (qualquer superfície contínua grande)
- a **marca na parede**
- o **acúmulo**: 10 tiros no mesmo lugar não podem somar e virar poça. Ponha teto de marcas vivas por área e recicle as mais antigas.

**Como fazer direito, e não no olho:**
1. **MEÇA o atual primeiro** e escreva no relatório: diâmetro da poça, tamanho do furo, tamanho da marca de parede, quantas peças por tiro, tempo de vida (o relatório diz 25 s).
2. Defina o alvo em número, não em adjetivo. Sugestão de partida, ajuste se a medição pedir: respingo = 3 a 5 gotas de **≤ 0,35 stud** cada, espalhadas num raio de ~2 studs, **sem se tocarem**; furo no corpo **≤ 0,25 stud**; vida **≤ 8 s** com fade; **teto de 12 marcas vivas** num raio de 10 studs.
3. **Constantes nomeadas no topo da função**, igual foi feito no traçante, pra regular sem caçar: `GOTA_MAX`, `GOTAS_POR_TIRO`, `RAIO_ESPALHA`, `FURO_MAX`, `VIDA`, `TETO_MARCAS`.
4. **PROVE COM FOTO.** Monte a cena no Edit, dispare o desenho por `loadstring`, e fotografe **antes e depois** com `screen_capture`. Sem a foto do depois isso não está pronto — é justamente o critério visual que decide o rótulo.
5. **Conserte o comentário mentiroso.** O relatório achou um comentário na linha ~372 dizendo *"Moderate, sem poça"* enquanto a poça existia (alguém acrescentou depois e não atualizou). Deixe o comentário dizendo o que o código faz AGORA, com a data e o porquê.

Não desligue `SangueLigado` nem zere `SangueIntensidade` no servidor — o Julio quer sangue, só não quer poça.

---

## FRENTE 2 — MARCAS REAIS (o maior risco de derrubar a place)

O relatório achou: ~20 roupas **Lacoste**, mais **Adidas, Nike, Red Bull, Ferrari, Oakley, iFood, Uber**; decal da **Coca-Cola**; logos **VW** e **BMW**; carros e motos chamados **Honda, Lamborghini, Chevrolet**. Uma roupa da Adidas **já caiu por marca** antes.

O Julio quer no estilo paródia: *"trocar nomes como adidas para tipo abibas"*. Faça assim, mas entenda a parte que importa:

> **Renomear não resolve sozinho.** Uma camisa chamada "Abibas" com a textura das três listras da Adidas continua sendo a Adidas. O que a moderação vê é **a imagem e o texto que o jogador lê**. Então todo item tem DOIS lados: o **nome** e o **visual**.

**Procedimento por item:**
1. **Nome** → vira paródia reconhecível mas não idêntica. Exemplos de direção: Adidas→Abibas, Nike→Nice, Lacoste→Lacrosse, Oakley→Oklay, Red Bull→Red Cow, Ferrari→Ferrani, iFood→iFome, Uber→Uger, Coca-Cola→Coma-Cola. Mantenha o espírito, troque a grafia. Não invente nome que continue sendo a marca escrita igual.
2. **Visual** → se a textura/decal mostra o logo real, **troque ou tire**. Prioridade: logo real visível = risco alto, mesmo com nome trocado. Se não der pra redesenhar agora, **tire o decal** e deixe liso; o Julio refaz a arte depois. Anote cada um numa lista "arte pendente".
3. **Fotografe** cada peça alterada. Lista sem foto não prova nada.

### ⚠️ ARMADILHA DOS CARROS — LEIA ANTES DE RENOMEAR QUALQUER VEÍCULO

O nome do carro é **chave de dado salvo**. O inventário/garagem do jogador guarda por nome (`plrData.Carros[nome]`), e o nome é indexado em vários lugares: `ServerStorage.Assets.Carros`, `ReplicatedStorage.Resources.Assets.Carros`, `Resources.Chassis`, `DefaultConfigs`, `SonsCarros.Perfis`, botão da garagem na `StarterGui`.

**Renomear a chave sem migração APAGA o carro de todo mundo que tem um.** Não faça isso.

Regra: **separe nome EXIBIDO de chave de dado.** Troque só o que o jogador lê na tela (botão da garagem, etiqueta, placa, descrição) e **deixe a chave como está**. Se não existir campo de nome exibido, **crie um** (atributo `NomeExibido` no modelo, lido pela UI) em vez de renomear o modelo.

E o mais importante nos carros: o que denuncia a marca normalmente é **o emblema no capô e a textura**, não o nome do arquivo. Ataque o visual primeiro.

Se, depois de medir, você concluir que algum caso exige renomear a chave de verdade, **NÃO FAÇA** — escreva o plano de migração no relatório e deixe pro Julio decidir acordado.

---

## FRENTE 3 — O RONDON (álcool)

`ToolData:123-125` descreve o item como *"Uma bebida alcoólica que pode te deixar tonto"*. Tem animação "Bebendo Rondon" e 6 pontos de venda (`Mapa(Spot).Compra_Items.ComprarRondon` a R$94 e mais 5 em `Workspace.Model`), além da AVendaCupula e da categoria Bebidas do Mercado Fechado.

Pela tabela da Roblox, **álcool presente = Restricted, sozinho.** O Julio não falou disso na mensagem, então vou de padrão **reversível e barato**:

- **Mantém** o item, o preço, a animação de beber, os 6 pontos de venda e o efeito de jogo.
- **Troca o que é álcool**: a descrição deixa de dizer "bebida alcoólica"; vira **energético** (combina com "te deixar tonto" virando "te deixa ligado/zonzo de tanta cafeína" ou efeito equivalente). Se o nome "Rondon" remeter a alguma bebida alcoólica real, troque o nome também.
- **Varra o resto**: procure QUALQUER outro item, loja, placa, texto ou cenário com cerveja, pinga, vinho, bar, boteco, adega, destilaria. **Um só já é Restricted.** Liste todos e trate igual.

Se você achar que isso descaracteriza algo importante do RP, **faça mesmo assim** e registre a objeção no relatório — é reversível em minutos e o Julio decide depois.

---

## FRENTE 4 — MEDIR E PROPOR, NÃO APLICAR

Estas duas estão na lista de risco mas **mexem em jogo que o Julio acabou de construir**. Meça, proponha, **não aplique**:

1. **Música escolhida pelo jogador** (DJ Kizz, JBL, rádio do carro). Risco de direito autoral e letra explícita. A mitigação óbvia é trocar "digite o ID" por **lista branca de faixas aprovadas** — mas isso mata a graça do sistema, e o Julio acabou de religar ele. Meça: quantos pontos de entrada aceitam ID livre, o que já existe de validação, e escreva as duas opções (lista branca × continuar livre) com o risco de cada uma.
2. **`FiltroTexto.paraJogador` / `paraVarios`** continuam pendentes desde a restauração. Isso é qualidade/segurança de texto, já acordado antes. **Esse pode aplicar** — é refazer o que a restauração levou. Confira na memória `santa-fe-moderacao-texto` o que existia e reponha.

---

## FRENTE 5 — REAUDITORIA

Depois das frentes 1–3, **rode o red team de novo** nas categorias que você mexeu (álcool, sangue, marcas) com agentes em paralelo, procurando o **pior caso que um jogador ainda alcança**. Objetivo: provar que o jogo agora responde **Moderate** com honestidade.

Se sobrar qualquer coisa que ainda seja Restricted, **diga na cara** em vez de arredondar. O Julio só vai pagar os 50.000 Robux depois disso, e taxa paga com o jogo ainda em Restricted fica 90 dias presa à toa.

---

## COMO TRABALHAR NESTE PLACE

**NÃO DÊ PLAY.** O dono proibiu. Núcleo puro por `loadstring(modulo.Source)()` no Edit; visual por `SurfaceGui`/cena montada numa Part + `screen_capture`, e **apague a Part de teste no fim**.
**ARMADILHA DA FOTO:** a face `Front` de uma Part aponta pro **−Z** — câmera em z NEGATIVO, senão você fotografa o verso preto e acha que não renderizou.

**Backup antes de toda edição**, em `ServerStorage.Backups_Elegibilidade_1210`.

**O Studio cai e volta num save PARCIAL.** Depois de QUALQUER desconexão: `list_roblox_studios` (o ID muda), depois **marker-check** — uma chamada só procurando um marcador único por edição sua (`src:find("MEU_MARCADOR", 1, true)`), arquivo por arquivo. Refaça o que sumiu. Não confie que o que você editou continua lá.

**Limite de 60 s por chamada ao computador.** Varredura em tudo de uma vez estoura; quebre em 2 pedaços.

**`script_read` em arquivo grande** devolve o conteúdo num arquivo local — leia com `sed -n` pelo Bash.

**Bug de contar linha:** `src:gmatch("[^\n]*")` devolve string vazia entre cada linha e **dobra os índices**. Use `[^\r\n]+`.

**`multi_edit` é atômico**: se uma edição não casar, NENHUMA é aplicada. Extraia o trecho exato com `string.find` antes de montar a edição.

**Antes de dar qualquer coisa por pronta:** confira que não existe `BindableFunction` chamada `QA` dentro de um `ModuleScript` (já quebrou o dano de tiro duas vezes).

**Nunca use o MCP do Windsor.ai.** **NÃO ABRA UMA QUARTA PLACE.** **NÃO PUBLIQUE.**

**Outros chats:** se os chats do **mobile** ou do **anti-void** ainda estiverem rodando, o `TiroFXClient` e a `StarterGui` são território disputado — releia o `Source` antes de salvar e deixe um `StringValue` em `ServerStorage` chamado `TRABALHANDO_Elegibilidade` com o arquivo do momento.

**Leia a memória do projeto ANTES de começar:** `memory_list` em `/projects/01a126ed-465f-74cf-b5d0-dabdc6e1b639/` — principalmente `santa-fe-elegibilidade-kids`, `santa-fe-armas`, `santa-fe-moderacao-texto`, `santa-fe-radio-musica`, `santa-fe-garagem-frota`.

---

## O QUE QUERO LER NO FIM

1. **Sangue:** números antes × depois, as constantes novas, e as **fotos antes/depois**.
2. **Marcas:** tabela item por item — nome antigo, nome novo, visual trocado ou pendente, foto.
3. **Rondon e qualquer outro álcool:** o que virou o quê, e a lista completa do que foi varrido.
4. **Carros:** o que foi trocado de nome EXIBIDO, e a confirmação explícita de que **nenhuma chave de dado salvo foi renomeada**.
5. **Frente 4:** as duas opções da música, com risco, e o estado do `FiltroTexto`.
6. **Reauditoria:** o rótulo que o jogo tira AGORA, e o que ainda sobrou (se sobrou).
7. Lista do que precisa de publish.
8. Memória atualizada em `/projects/01a126ed-465f-74cf-b5d0-dabdc6e1b639/areas/santa-fe-elegibilidade-kids.md`, no padrão dos outros arquivos de lá.
