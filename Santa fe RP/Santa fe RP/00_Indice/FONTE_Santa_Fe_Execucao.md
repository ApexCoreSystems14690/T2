---
name: FONTE_Santa_Fe_Execucao
description: FONTE canônica — plano "Santa Fé Execução" (o COMO) na íntegra, 15/09/2026. Arquitetura, dados, rede, módulos, fases. Par de [[FONTE_Santa_Fe_Funcional]].
sources: [cowork]
aliases: [Santa Fe Execucao, execução, o como]
---
# Santa Fé Execução (FONTE · 15/09/2026)

> Cópia íntegra. O COMO transformar o [[FONTE_Santa_Fe_Funcional]] em código. Notas de `01_Especificacoes/` e `02_Sistemas_Studio/` derivam deste; em conflito, ESTE manda (métodos/nomes ajustáveis ao código real; mudança de decisão volta pro Julio).

## 1 · Regras de trabalho
Backup (clone em ServerStorage.Backups `_antes_<coisa>`) · Chave desligada (todo sistema novo atrás de chave em Resources.Chaves) · Implementar (comentário `[F<fase>]` em todo trecho novo) · Provar (compila + teste de servidor + foto da tela) · Seu teste (chave ligada no DEVTS, Julio joga) · Publicar (Ctrl+S+Publish; site git push) · Memória (decisão+medida por mecânica).
**Princípios:** Servidor manda (dinheiro/item/XP/minigame/msg só depois que confere). Estado em atributo (HUD lê atributo, nunca pergunta a cada frame). Regras em módulo puro (sem Instance, testável no luau CLI). Chaves liga/desliga: HUDv2, CelularV2, Minigames, Pericia, Central, UberBots, EletricistaV2, ColeteCrime. Nada novo no RemotesHandler (5.200 linhas só perde responsabilidade).
**Limites plataforma:** HTTP 500/min/servidor (lote+memória). MessagingService ~150+60×jogadores/min (só avisa, conteúdo do site). Texto: TextService:FilterStringAsync + CanUsersDirectChatAsync. Remotes: balde de fichas 10/2s por remote. Captura: local, público só via UploadCaptureAsync (teste 1 dia).

## 2 · Arquitetura
- CLIENTE: Resources.Tema·Motion, Client.HUD, Client.Telas (pilha,Esc), Client.Celular (shell+apps), Client.Minigames, Client.Pericia·Central, Client.Minimapa.
- SERVIDOR: Rede v2, Aparelhos, Social, Banco·Salario·Central, Minigame, Empregos·Postes·Uber, Pericia·Multa·Equipamento, DataHandler, MessagingService.
- SITE (Railway): /api/game/celular|central|pericia + painel + Postgres (migrações no boot).
- Roblox: TextService (filtro), CaptureService (fotos), DataStore (ProfileService).

## 3 · Dados
Regra: personagem (dinheiro/inventário/níveis) no perfil ProfileService; aparelho/social (mensagens/OLX/jornal/chamados/perícia) no Postgres. Jogo nunca espera o site pra mexer em dinheiro.
### 3.1 Perfil (CBRP_V1.2) — campos novos
- `ItensUnicos` {[uid]={Tipo="A10",Criado}} — celular vira item com ID; migração dá n uids a quem tem A10×n.
- `Profissoes` {Eletricista={XP=0},...} — XP por emprego, nível por Regras.Nivel (nunca salvo).
- `CapacidadeBase` 12..22 — mochila = base +8 se vestida; migração base = salvo −4 se tinha mochila.
- `PrisaoAte` unix — prisão em minutos que sobrevive relog (substitui TempoPrisao).
- `Configs.ReduzirAnim` bool. `Migrou` {Mochila,Celular} — cada migração 1×.
- Offline (venda OLX, transferência): GlobalUpdates {tipo=credito,valor,origem,ref}; ref evita crédito duplo.
### 3.2 Postgres (tabelas novas)
aparelhos (uid pk, numero 9XXXX-XXXX unique, dono, pin_hash=sha256(uid+pin+segredo), chip_nome, apreendido_por/em) · aparelho_donos (histórico de mover: dar/chão/revista/confisco/olx/morte/porta-malas + pos) · contatos (200/aparelho) · conversas·conversa_membros (grupo ≤32, ≤10 grupos) · mensagens (corpo 300, pos_x/z, rua; DM 200/grupo 300/anon 100; apaga acima do limite na mesma transação) · notas (30, corpo 1000, upsert) · fotos (cena jsonb: câmera/hora/pessoas/poses/carros ou print; asset_id opcional; 5 fotos+10 prints; ~10KB) · olx_anuncios·olx_vendas (item jsonb, 5 ativos, 7 dias, vencido devolve por GlobalUpdate) · deepweb_posts (chip_nome, corpo 200, 150 últimos/72h, 1/2min) · jornal_materias (tít80/texto2000, app 30, 1/10min, publicar_materias) · chamados·central_turnos (métricas painel) · pericia_acessos·inqueritos (todo acesso registrado, não apaga). Migrações CREATE IF NOT EXISTS + DO $$ idempotentes no src/index.js.

## 4 · API do site (/api/game, x-api-key, jogo é único cliente)
- POST celular/aparelhos {uid,dono}→{numero} · POST celular/aparelhos/:uid/dono {para,motivo,pos}
- GET celular/:uid/abrir → {numero,chip,conversas[20],naoLidas,contatos,notas,fotos,anuncios} (1× por sessão, resto em cache no servidor)
- GET celular/conversas/:id/mensagens ?antes=&n=50 (paginação)
- **POST celular/lote** {ops:[{t:msg|nota|contato|lido|foto|print}]} — coração da escala; servidor junta e manda a cada 2s ou 25 ops (40 jogadores ≈30 req/min)
- GET celular/novidades ?numeros=&desde=id (offline/outro servidor)
- GET/POST olx/anuncios · POST olx/anuncios/:id/comprar (SELECT…FOR UPDATE, 2 compradores=1 leva, 409) · POST olx/vendas/:id/creditado
- GET/POST deepweb/posts (limpeza 72h no insert) · GET jornal/materias · POST (confere publicar_materias)
- POST central/chamados · PATCH :id {assumir|repassar|encerrar} · POST central/turnos {entrar|sair}
- GET pericia/:uid/relatorio ?aba=&policial= (grava pericia_acessos antes, confere cargo PC)

## 5 · Rede v2
Pasta `ReplicatedStorage.Rede`: 1 par por área (RF + RE `<area>Evt`), criado pelo módulo Rede que valida tipo e limite (balde de fichas) antes do serviço.
```
Rede.funcao("Celular", { limite={20,10}, acoes={ enviar={"string","string"}, sacar={"number"}, nota={"number?","string","string"} } }, CelularService.tratar)
Rede.enviar(plr,"Hud","objetivo",dados)  Rede.todos("Hud","aviso",dados)
```
Remotes: Celular(RF)+CelularEvt(RE) · Minigame(RF) · Central(RF) · Pericia(RF) · Hud(RE só servidor→cliente). Estouro = {erro="devagar"}; 3º estouro→log de suspeitos. Entre servidores: MessagingService tópico `cel` só {numero,tipo,id}.

## 6 · Módulos e métodos
### 6.1 Shared (ReplicatedStorage.Shared)
Chaves.ligada(nome,plr?) · Tema.cor/aplicar/Mudou (28 cores, padrão 255-170-0) · Motion.entrar/sair/numero/barra/critico/painel · **Regras.Taxa.calcular(v)→taxa,liquido (clamp(floor(v*0.02),1,50))** · Regras.Nivel.nivel/falta · Regras.Colete.dano · Regras.Uber.preco/bonus/nota · Regras.Mochila.capacidade(base,vestida)=base+8 · Regras.Minigame.* (determinístico: cliente desenha, servidor confere) · Regras.Limites (200/300/100, 5 fotos, 10 prints, 30 notas; espelhado no site).
### 6.2 Cliente (StarterPlayerScripts.Client)
Telas.abrir/fechar/topo/aberta (pilha, Esc fecha a do topo) · Hud (Feed fila máx3, Objetivo dist 0,25s, Contexto) · Minimapa.iniciar/marcar/remover · Celular.abrir/fechar/App.registrar/notificar/print · **Apps: Mensagens·Contatos·Banco·OLX·Deepweb·Camera·Galeria·Notas·Noticias·Navegador·Uber·Mapa·Emergencia·Ajustes** (1 ModuleScript cada, sem estado fora do cache) · Minigames.jogar · Camera/Cena (cliente manda só a câmera, servidor monta a cena, quem vê desenha no ViewportFrame; real por cima só se ≤2min) · Pericia/Central · Escada.subir/descer.
### 6.3 Servidor (ServerScriptService.Server.Services)
Aparelhos.criar/dono/deJogador/mover/apreender/definirPin/conferirPin/instalarChip (mover em TODO caminho; mapear no RemotesHandler é 1ª tarefa do F2) · Site.get/post/fila/orcamento (retry, lote 2s, para em 400/min prioriza dinheiro/OLX) · Social.abrir/enviar/criarGrupo/marcarLido/salvarNota (filtra texto antes, cache 50/conversa) · Banco.sacar/depositar/transferir/creditarOffline (Regras.Taxa) · OLX.anunciar/comprar/cancelar (debita→trava→entrega→credita; falhou=estorna) · Deepweb.postar/mural/abrirAnon (exige chip) · Salario.liberar/coletar/expirar (120s aviso; central=mão, senão banco) · Central.sentar/levantar/abrirChamado/assumir/repassar/encerrar (AFK 5min) · Minigame.emitir/conferir · Postes.iniciar/quebrar/consertar (564 postes, noite 1/3min máx8) · Uber.disponivel/sortear/aceitar/amostrar/finalizar · Empregos.darXP/nivel/pagar · Pericia.colocar/quebrarPin/relatorio/devolver (PC, Seat, apreendido, 2 estações PainelDeep) · Multa/Prisao · Equipamento/ArmaMotor (toda arma passa pelo ArmaMotor→Regras.Colete; hoje só Glock/AK47).

## 7 · Minigames (anti-trapaça)
Cliente só desenha. Servidor gera com seed, guarda t0, confere com a mesma função pura. Fluxo: pedir→{id,tipo,seed,params}→jogar+mandar tempos→conferir (t ≤ decorrido+0,25; tolerância ±80ms). Validade: expira em duração+5s, 1 por jogador, id não reusa. Falha=consequência (choque/faísca). Nível só em params. Tipos: Ponteiro (eletricista), Onda (perícia 4 díg 60s, confere frequência final ≥0,6s alinhada), Cartas (carteiro), Cabos/Pneu (mecânico), Pizza, Lixo, Ritmo (SAMU).

## 8 · Fluxos
- **Mensagem (offline):** enviar→Rede confere limite/tipo→Social confere membro→TextService filtra (vazio=recusa)→fila de lote + aparece na hora (otimista ✓ ao salvar)→online mesmo servidor=evento, outro=MessagingService, offline=nada (abre traz não-lidas).
- **Compra OLX (vendedor offline):** Banco debita comprador→POST comprar (409=estorna)→entrega item (Aparelhos.mover motivo olx)→vendedor online credita banco, offline GlobalUpdate {credito,ref=venda_id}→marca creditado; job 10min reenvia não creditadas.
- **Foto de cena:** some HUD+celular, clarão, manda só a câmera→servidor confere câmera na cabeça (≤3 studs) e monta cena (jogadores+pose+tempo, carros, hora)→msg com cena ~10KB→quem recebe: RequestStreamAroundAsync, copia mapa num ViewportFrame, poses; miniatura = mesmo desenho menor em cache; real ≤2min troca com fade.
- **Perícia:** PC senta no Seat com A10 apreendido→[F] Colocar (anim, A10 na mesa, PainelDeep acende)→PIN? Onda 60s→sessão 10min→abas chamam pericia/:uid/relatorio (cada registrada)→levantar/10min fecha.
- **Poste:** Postes sorteia à noite, desliga luz, raio, clona escada, marca Quebrado→Feed+marcador p/ eletricista→segurar F na escada (Escada.subir, pulo travado)→topo Minigame Ponteiro→passou luz volta+paga+XP, falhou choque+recomeça→desce, escada some 5s.

## 9 · Minimapa
Studio sem Play, câmera alta FOV=1 (ortográfica), dia, esconde telhados/árvores→grade de screen_capture→Python/PIL costura+tom do Tema+blur 1,5+ruas→4 imagens 1024px→assets. Escala em Resources.Mapa {origem, studsPorPixel}. Posição = (pos.XZ − origem)/studsPorPixel. Raio ~250 studs; fora = seta na borda. App Mapa usa as mesmas 4 imagens.

## 10 · Fases (ordem, ~54 dias)
- **F0 prep (1d):** commit+push T2; testar fixes 15/09 em Play; criar Resources.Chaves; pedir assets.
- **F1 consertos (2d):** Carteiro; níveis 2/3/5; prisão em minutos; mochila calculada; talão de multa; pontas soltas.
- **F2 fundação (4d):** Regras.* + testes CLI; Tema+Motion; Telas (pilha+Esc); Rede v2 + limitador; Site wrapper; **Aparelhos + migração de UID** (1º: listar caminhos que movem A10 no RemotesHandler); tabelas do site. PRONTO: dar/dropar/pegar/revistar/morrer mantêm o mesmo uid.
- **F3 HUD base (5d):** canto Você; Feed+objetivo; contextual; Minimapa; fontes/Tema; círculo do F. Prova: screen_capture de cada estado.
- **F4 Celular (~14d):** **Spike da foto (dia 1)** decide o resto; casca+navegação; Mensagens/contatos/grupos; Banco; Câmera/galeria/print; Notas; OLX; Notícias/Navegador/Jornal; Emergência+Central; Chip+Deepweb; tirar /olx /deepweb /x /aviso do chat. PRONTO: 2 jogadores em servidores diferentes conversam; offline recebe ao entrar; venda OLX offline credita 1×.
- **F5 Perícia (3d):** estações; minigame Onda; relatório 8 abas + rastreio.
- **F6 empregos/minigames (~8d):** Eletricista; Uber bots; minigames civis; XP por profissão.
- **F7 armas no ArmaMotor (6d):** migrar 12 armas; colete em todas.
- **F8 polícia/crime/socorro (7d):** colete crime; telas prender/revistar; confisco; caído (sangrando 300s, grave 40s, morte tira armas+item); bolinha F; minigame SAMU; carregar+sequestro.
- **F9 inventário/craft (4d):** inventário novo; craft + loot recalculada.
Dependências: F2→F3·F7 · F2+F3→F4→F5·Uber(F6) · Eletricista(F6) pode antes · F7→F8 · F3→F9.

## 11 · Provas (testes)
Regras puras no luau CLI (bordas: taxa R$1/49/10000, minigame nos 80ms, limite de fotos). Servidor: compilação byte-a-byte antes de aplicar; harness com jogadores falsos; Play só com ok do Julio. Visual: screen_capture de cada tela/estado, checklist (abre animado, fecha Esc, nada sobreposto 16:9 e 4:3). Site: migrações Postgres 16 local (vazio/repetição/dados antigos); curl incl. compra dupla OLX (1 venda+1 409). Carga: 40 jogadores <400 req/min. Segurança: cada remote com tipo errado/negativo/spam/alvo longe = recusado sem erro.

## 12 · Riscos
ViewportFrame não é o jogo (sem terreno/luzes/bloom; noite chapada→céu+cor por hora, neon=cor forte, compara no spike). Streaming (RequestStreamAroundAsync antes; miniatura c/ blur enquanto carrega; recorte ≤200 studs). Muitas miniaturas (só visíveis, menos detalhe). Foto real >2min (só perde a troca). Filtro c/ destinatário offline (filtra no envio regra rígida + CanUsersDirectChatAsync). HTTP 500/min (lote+cache+orçamento 400, dinheiro/OLX prioridade). MessagingService (payload mínimo + fallback novidades). Migração UID (mapear caminhos, Migrou.Celular, log, chave só testadores). GlobalUpdates (ref + job reenvio). Site fora (celular "Sem sinal", resto funciona). Studio compartilhado (scripts diferentes, backups, nada de Play sem aviso).

## 13 · Lado do Julio
Commit+push T2 (F0, trava tudo do site) · testar fixes+publicar (F0→F1) · modelo escada+anims (F6 eletricista) · modelo chip+anim (F4 deepweb) · anim celular na mesa (F5, funciona sem) · computador da central (F4) · testes de cada fase+ok Play (fase seguinte) · opcional bot acenar (F6).
