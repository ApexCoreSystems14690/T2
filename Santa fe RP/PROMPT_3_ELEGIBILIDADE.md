# PROMPT 3 — Auditoria de elegibilidade do Santa Fé pra Roblox Kids / Select (público abaixo de 16)

Você vai trabalhar sozinho no **Santa Fé Roleplay** (Roblox), place **DEVTS `78083733455249`**, pelo MCP do Roblox Studio. Fale comigo em **português do Brasil**, curto e direto.

## REGRA ZERO: AUTONOMIA, GAUNTLET LOOP

**Não pergunte nada. Não pare pra pedir permissão.** Faltou informação, você MEDE no jogo. Terminou uma frente, começa a próxima sozinho. Ação reversível (medir, fotografar, listar) você faz e conta depois.

**ESTA AUDITORIA NÃO EDITA CÓDIGO.** Você só mede, fotografa e relata. Dois outros chats podem estar mexendo no mesmo place; se você escrever, vocês se atropelam. Achou algo que precisa mudar? Vai pra lista de lacunas, não pro editor. **Exceção nenhuma.**

---

## O QUE ESTÁ EM JOGO (confira antes de confiar — política de plataforma muda)

Confirmado em 11/10/2026 na documentação oficial da Roblox. **Reconfirme com busca na web antes de começar**, porque isso muda sozinho:

- A Roblox usa 4 rótulos: **Minimal**, **Mild**, **Moderate**, **Restricted**.
- **Minimal / Mild** → elegível pra **Roblox Kids (5–8)** e **Roblox Select (9–15)**.
- **Moderate** → **Select (9–15)** e Roblox padrão (16+).
- **Restricted** → só 18+ verificado.
- Pra alcançar menor de 16, o jogo precisa passar numa avaliação: conta em bom estado, 2FA ligado, verificação de identidade (documento, pra maior de 18), taxa de publicação paga, e **250 jogadas únicas de jogadores "altamente engajados" com idade verificada em 60 dias**.
- A **avaliação acelerada custa 50.000 Robux reembolsáveis** e serve exatamente pra **pular o requisito dos 250**. O jogo continua tendo que passar nos mesmos padrões.
- A taxa volta sozinha 90 dias depois de o jogo virar elegível — ou 90 dias depois do pagamento, se nunca virar. **Ela NÃO volta se o jogo for removido permanentemente por violar as Community Standards.**

**A regra que decide tudo:** o questionário se responde pelo **conteúdo MAIS EXTREMO que um jogador consegue alcançar** dentro da experiência. Não pela média, não pela intenção.

Como cada categoria sobe (resumo da tabela oficial):

| Categoria | Moderate | Restricted |
|---|---|---|
| Violência | realista, não-gráfica | gráfica e realista (desmembramento, decapitação, enforcamento) |
| Sangue | realista leve (respingo distante) | realista pesado (poça, jorro, respingo em close) |
| Medo | órgãos visíveis, ferida aberta realista, sangrar pelos olhos | — |
| Humor | referência a xixi | — |
| Jogo de azar | só depiction, não-jogável | também listado |
| Linguagem forte | — | **Restricted** |
| Temas românticos | — | **Restricted** |
| Álcool (uso, referência, ou negócio que vende) | — | **Restricted** |

E três descritores que **gateiam em 16+ independente do rótulo**:
- **Social hangout** (16+ sem espaços privados, 18+ com)
- **Criação livre pelo usuário** (free-form user creation) → 16+
- **Temas sensíveis como tema principal** → 16+, e nem discoverable sem idade verificada

---

## A REGRA HONESTA DESTE TRABALHO

Seu objetivo **não** é fazer o analista achar que o jogo é mais leve do que é. É descobrir **o que o jogo realmente é** e dizer com todas as letras onde ele cai.

Isso não é escrúpulo: é a estratégia que funciona. A própria documentação diz que resposta que não bate com o conteúdo dá **remoção do rótulo, restrição de jogabilidade ou moderação** — e a taxa vira pó se o jogo for derrubado permanentemente. Essa place **já foi banida uma vez** (08–09/10). Passar na avaliação mentindo e cair depois é pior do que não passar agora.

Então: se o Santa Fé, como ele é hoje, não couber em Moderate, **diga isso na cara** e entregue a lista do que teria que mudar no JOGO. A decisão de mudar ou não é do Julio.

---

## FASE A — O RED TEAM (os "analistas")

Suba **agentes em paralelo, cada um com UMA categoria do questionário**, com a instrução de agir como um analista da Roblox procurando motivo pra subir o rótulo. Cada um tem que achar **o pior caso alcançável por um jogador**, não o caso típico.

Um agente por frente:

1. **Violência** — todas as 14 armas do `ArmasConfig`, dano, morte, o sistema de caído, atropelamento, katana/faca, o Ferro Velho do PD. Corpo some ou fica? Morte é realista?
2. **Sangue** — o FX de sangue do `TiroFXClient` / `Motor._acertou`. É realista ou estilizado? Poça? Respingo em close? Fica no chão? Mede: cor, tamanho, duração, se acumula.
3. **Medo / ferida** — ferimentos da SAMU (o sistema tem ferimento por parte do corpo), órgãos, cirurgia, necrotério se existir.
4. **Crime, armas realistas e temas sensíveis** — assalto à joalheria, sequestro (o item SACO), tráfico se existir, prisão, favela, lojas ilegais de arma, craft de arma. **Esta é a frente que mais pode gatear o 16+ por "tema sensível como tema principal".**
5. **Álcool, drogas, romance** — qualquer item consumível, bar, boate, o DJ Kizz, nome de item, descrição de loja. **Álcool sozinho joga pra Restricted — procure com carinho.**
6. **Linguagem e texto de jogador** — chat, rádio das corps, RoZap, OLX, Deepweb, placa de casa, nome de empresa, o `MusicaJBL` que aceita texto. Pergunta central: **o jogador consegue pôr texto livre que outro jogador lê?** Se sim, isso conversa com "criação livre" e com "linguagem forte". Meça o que o `FiltroTexto` realmente filtra hoje.
7. **Social hangout / criação livre / jogo de azar** — a cidade é um ponto de encontro social? Tem espaço privado (casa com porta)? Mobiliar casa conta como criação livre? Tem cassino, roleta, caixa aleatória?
8. **Página da experiência** — título, descrição, thumbnails, ícone, nome dos game passes. A documentação diz que título e descrição contam pro rótulo. Isso é auditoria de loja, não de código.

Cada agente entrega: **evidência com arquivo:linha ou foto, o pior caso, e em qual coluna da tabela isso cai.** Sem evidência não entra no relatório.

Use `screen_capture` pra provar o visual (sangue, ferida, arma na mão). **Não dê Play** — o dono proibiu; monte a cena no Edit e fotografe. **A face `Front` de uma Part aponta pro −Z: ponha a câmera em z NEGATIVO, senão fotografa o verso preto.**

---

## FASE B — O VEREDITO

Monte o questionário preenchido, categoria por categoria, com a resposta **honesta** e a evidência ao lado. No fim: **qual rótulo isso dá**, e se o jogo alcança Select (9–15) ou não.

Se cair em Restricted por uma única coisa, diga qual é. Se cair em 16+ por um descritor (hangout, criação livre, tema sensível), diga qual.

---

## FASE C — A LISTA DE LACUNAS

Pra cada item que empurra o jogo acima de Moderate:

- o que exatamente teria que mudar **no jogo**
- esforço
- **o que o RP perde com isso** — seja honesto; tirar sangue de um RP policial tem custo de imersão
- se dá pra fazer condicional por público (ex.: servidor Select com FX mais leve) ou se é mudança global

Ordene por: **quanto desbloqueia ÷ quanto dói**.

E uma conclusão de uma linha, sem rodeio: **vale a pena perseguir o público abaixo de 16, ou o Santa Fé é um jogo 16+ por natureza e o melhor é assumir isso?** Eu quero sua opinião medida, não um "depende".

---

## FASE D — RISCO DE MODERAÇÃO (separado do rótulo)

Isto é o que custa os 50.000 Robux e a place. A place **já caiu uma vez**. Varra atrás do que pode derrubar de novo:

- texto de jogador que escapa do filtro (compare com o que a memória `santa-fe-moderacao-texto` já documenta)
- áudio/imagem subida por jogador
- qualquer coisa que imite marca real, pessoa real ou dinheiro real
- sistema de aposta jogável
- o jingle/músicas da campanha (tem histórico de moderação por direito autoral)
- nome de item, decal, textura vinda de toolbox sem origem conhecida

Entregue como lista de risco, do mais provável de derrubar pro menos.

---

## FASE E — CHECKLIST DA CONTA (o que o Julio precisa fazer, não você)

Confira o que der pela web/Creator Hub e liste o estado de cada um:
- conta em bom estado
- **2FA ligado**
- verificação de identidade por documento (ele é maior de 18)
- taxa de publicação: pelo print de 11/10 está **Pago**
- avaliação acelerada de 50.000 Robux: pelo mesmo print ela ainda aparece como **oferta opcional não paga** — confirme antes de ele gastar
- jogadores altamente engajados: estava em **5 de 250**

---

## COMO TRABALHAR NESTE PLACE

**NÃO DÊ PLAY.** Núcleo puro por `loadstring(modulo.Source)()` no Edit; visual por `SurfaceGui` numa Part + `screen_capture`, e **apague a Part no fim**.

**O Studio cai e volta num save PARCIAL.** Se cair: `list_roblox_studios` (o ID muda) e siga. Como você não edita nada, você não tem o que refazer — mas confira que a place que voltou é a mesma.

**Limite de 60 s por chamada ao computador.** Varredura de todos os scripts de uma vez estoura; quebre em 2 pedaços.

**`script_read` em arquivo grande** devolve o conteúdo num arquivo local — leia com `sed -n` pelo Bash.

**Bug de contar linha:** `src:gmatch("[^\n]*")` devolve string vazia entre cada linha e **dobra os índices**. Use `[^\r\n]+`.

**Nunca use o MCP do Windsor.ai.** **NÃO ABRA UMA QUARTA PLACE.** **NÃO PUBLIQUE.**

**Leia a memória do projeto ANTES de começar:** `memory_list` em `/projects/01a126ed-465f-74cf-b5d0-dabdc6e1b639/` — principalmente `santa-fe-moderacao-texto`, `santa-fe-armas`, `santa-fe-pd`, `santa-fe-samu`, `santa-fe-joalheria`, `santa-fe-saco`, `santa-fe-favela`, `santa-fe-celular`, `santa-fe-regulamento`. Lá já tem metade do que você ia redescobrir.

---

## O QUE QUERO LER NO FIM

1. O questionário preenchido com evidência por categoria (Fase B).
2. **O rótulo que o jogo tira hoje**, e se alcança Select (9–15).
3. A lista de lacunas ordenada, com o custo em RP de cada uma (Fase C).
4. A lista de risco de moderação (Fase D).
5. O checklist da conta (Fase E).
6. Sua recomendação de uma linha: pagar os 50.000 agora, ou arrumar X e Y antes.
7. Memória salva em `/projects/01a126ed-465f-74cf-b5d0-dabdc6e1b639/areas/santa-fe-elegibilidade-kids.md`, detalhada, no padrão dos outros arquivos de lá.
