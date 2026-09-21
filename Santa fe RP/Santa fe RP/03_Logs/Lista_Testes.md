
## ✅ RODADO EM 17/09 (Play, painel na tela) — 8/8
Dropar+pegar · outro pega · revista · confisco · **morrer (FICA)** · morrer 3x · wipe · combat log.
Falta só a parte que precisa de 2 players de verdade (testes 2 e 3 rodaram a ordem que o 2º jogador recebe).

## Site T2 — quebrado em 17/09
- [ ] `/celular/registrar`, `/celular/aparelhos`, `/celular/contatos`, `/celular/msg/conversas` estão devolvendo **HTTP 500**. Sem isso o celular não carrega histórico nem lista de contatos. Conferir o deploy/Railway.

## ✅ RODADO EM 17/09 (2ª rodada) — as regras novas, 7/8 em Play
Morte: banco intacto (R$20000 → R$20000) · A10 e CNH ficam · Glock vai embora.
Combat log: celular e linha ficam (19 37536-5269) · banco intacto.
Revista: polícia ainda leva o celular · banco intacto.
O 8º ("só o celular sobra no combat log") ficou vermelho por **falha do teste**, não do código:
`requestData` devolve cópia. Provado por outro caminho: `sobrevive(inventário real, 'combatlog')` = `A10`.

## Pra ti conferir jogando
- [ ] Deslogar em combate de propósito → voltar e ver: celular no bolso, número igual, resto perdido.
- [ ] Morrer → celular, CNH e documentos no bolso; armas não; saldo do banco igual.
- [ ] Apertar 1..6 com o inventário aberto → sem erro vermelho no output.
- [ ] Abrir o craft sem selecionar item → sem erro no output.

## 🔴 Achados velhos que sobraram no output (não são do trabalho novo)
- [ ] **`Sertex`**: resolvido o "o quê" — é o esqueleto do lobby de servidores, ver [[Lobby_Servidores]]. **Não apagar o MainService.** Enquanto não for reescrito, ele continua não carregando e sujando o output (só isso; não quebra nada, ninguém chama os remotes dele).
- [ ] `Infinite yield` em `workspace:WaitForChild("SafeZones")` — o `SafeZoneHandler` espera pra sempre uma pasta que não existe no workspace.
- [ ] `Infinite yield` em `rotorKitModule:WaitForChild("Main")` — mesmo caso (o módulo existe, o filho `Main` não).

## F3 — HUD base (volta 1, 17/09): 66 testes automáticos, 0 falhas
Núcleo `Client.Hud.N` rodado por `loadstring` no Edit. Cobre: fila de 3, prioridade (aviso não derruba perigo), expiração por tempo, ids únicos, distância (m/km, negativo, não-número), relógio mm:ss (0, 59, 60, 600, negativo, gigante), milhar/dinheiro/peso, crítico em 25%, tabela de contexto (colete zerado some, preso 0 não aparece) e diferença entra/sai.

### Pra ti conferir depois (quando a volta 2 montar as peças)
- [ ] Ligar a chave `HUDv2` no `ChavesValores` e ver a HUD nova só pra ti (testador `masternerdtop`).
- [ ] Chegar 4 avisos seguidos: só 3 na tela, e o que sai é o menos importante.
- [ ] Entrar no carro → velocímetro aparece; sair → some. Guardar a arma → peça da arma some.

## F3 — volta 2 (feed): 34 testes de bancada, 0 falhas
Hud compila e carrega fora de Play · com `HUDv2` desligada nada acontece (`iniciar()` e `avisar()` = false) · lixo em `avisar()` não quebra · o texto REAL do bloco `especial` do `NotificaHandler` rodado numa bancada: 7 títulos especiais ficam no caminho antigo, 8 genéricos vão pro feed · backup `NotificaHandler_antes_feed` existe.

### Pra ti conferir em Play (é o que falta pra fechar a volta 2)
- [ ] Dar Play como `masternerdtop` (testador vê mesmo com a chave desligada) e olhar o canto inferior esquerdo.
- [ ] Fazer chegar 4 avisos seguidos: só **3** ficam na tela, e o que sai é o menos importante.
- [ ] Ser revistado e deslogar em combate: esses dois avisos têm que continuar **iguais aos de hoje** (não passam pelo feed).
- [ ] Olhar se o aviso entra e sai animado, sem piscar nem pular.

## 🔴 INCIDENTE 17/09 — todos os interacts sumiram (RESOLVIDO)
Um único Action quebrado (`UsarSaco`) derrubava o `Interaction:Start()` inteiro. Agora o loop tem `pcall`, então isso não volta a acontecer.

### Pra ti conferir jogando
- [ ] Chegar perto de uma porta → bolinha do F aparece.
- [ ] Pegar emprego, SAMU, comprar carro, caixa eletrônico → todos respondendo.
- [ ] Olhar o output: **não pode** ter `[Interacao] Action '...' nao carregou`. Se tiver, aquele Action está quebrado — mas o resto do jogo continua de pé (era esse o objetivo da guarda).

### Regra que fica
Qualquer lista de módulos carregada em loop (`Actions`, `Services`, apps do celular) tem que ter `pcall` por item. Um item podre não pode derrubar a lista.

## ✅ F3 volta 2 — FEED APROVADO EM PLAY (17/09)
5 avisos disparados, 3 na tela, prioridade correta, títulos e cores certos, tudo legível. Aprovado pelo Julio.
Testes de bancada refeitos depois do conserto: título e cor chegam na fila, teto 3, perigo entra com fila cheia, aviso não derruba perigo, distância e relógio — 9/9.

### Lição pra próxima
Os 66 testes de bancada passavam e **o card estava invisível e sem título**. Teste de bancada prova a conta, não o desenho. Card novo = conferir no Play: título, texto, cor, transparência e posição.

## ✅ F3 volta 3 — OBJETIVO (18/09): 28 testes + Play
Compila e carrega fora de Play · com a chave desligada não faz nada · só Scale + constraints · clona o molde (não cria do zero) · limpa a herança do clone · um relógio só de 0,25s · tick protegido por pcall · limpa card velho no iniciar · ZIndex explícito. Distância: 0/180/800/1000/2450 e nunca sem unidade.

### Pra ti conferir jogando
- [ ] Acender o objetivo e **andar**: o número de metros tem que mudar sozinho.
- [ ] Passar de 1000 studs: vira "1,2 km" em vez de "1200 m".
- [ ] Limpar o atributo `Objetivo`: o card some.
- [ ] Trocar a cor do tema nas Configs: a barrinha do card acompanha.

## ✅ Ruas e endereços (18/09): 363 testes + Play
Tabela sã (18 vias com eixo/trecho/largura, nomes únicos) · 10 bairros que **não se sobrepõem** · toda peça de rua cai numa via E num bairro · o **nome da peça bate com o que a tabela responde** nas 68 · atributo `Bairro` correto nas 68 · `QA_nome_orig` guardado nas 68 · longe de tudo devolve "Zona Rural" sem quebrar · `endereco(nil,nil)` não estoura · `curto()` abrevia Avenida→Av.

### Pra ti conferir jogando
- [ ] Andar pela cidade e mandar o endereço aparecer: tem que trocar de rua quando você **cruza** a esquina, não 50 metros depois.
- [ ] **Sair do asfalto** (subir na calçada, entrar numa casa): o endereço tem que continuar respondendo, não virar "Local não mapeado".
- [ ] Ir pra favela → tem que dizer **Vila Pantanal**. Ir pro quartel da ROTAM → **Conjunto Sol Nascente**.
- [ ] Ir pro meio do mato, longe de tudo → **Zona Rural** é a resposta certa.
- [ ] Os nomes soam de cidade do Paraná pra ti? Se algum não soar, é só trocar a linha na tabela `R.VIAS` — nada mais depende do texto.

## ✅ GuiHandler voltou a compilar (18/09)
Estava quebrado na versão viva (`]` solto na 1171) — a GUI inteira do cliente morria no boot.

### Pra ti conferir jogando
- [ ] Entrar no jogo: HUD, TopBar, celular, menus — tudo tem que aparecer.
- [ ] Pegar o **saco de lixo**: a tela preta (`TelaPretaSaco`) tem que cobrir a tela e esconder HUD/TopBar. Isso nunca funcionou antes de hoje.
- [ ] Output limpo, sem `Expected identifier` e sem `Infinite yield ... Main', 10`.

## ✅ F3 volta 4 — PEÇAS CONTEXTUAIS (18/09): 70 testes + foto
Tabela sã (7 peças, rótulo ≤3 palavras, ordem única) · `Preso` como boolean · `Morte` como timestamp ·
teto de 4 · prioridade preso>algemado>colete>capacete · barra só onde tem número ·
crítico em 25% · objetivo e caído nunca viram chip · estado nil não quebra ·
`DataHandler` publicando `PresoSegundos` em 3 lugares.

### Pra ti conferir jogando
- [ ] Vestir colete → chip **Colete** aparece no canto superior direito, com a barra do tamanho da durabilidade.
- [ ] Deixar o colete abaixo de 25 → o número e a barra ficam **vermelhos** (crítico).
- [ ] Mirar com arma → chip **Mirando**, sem barra.
- [ ] Ser preso → chip **Preso** em vermelho com o relógio **andando pra trás** (isso é novo: antes o preso não via o tempo).
- [ ] Ser algemado → chip **Algemado**, vermelho, sem barra.
- [ ] Cair → **não** pode aparecer chip de caído; quem conta é a tela de morte.
- [ ] Acender tudo de uma vez → no máximo **4** chips, e nenhum encosta no painel da revista.

## ✅ F3 volta 5 — MINIMAPA REFEITO (18/09): ViewportFrame + foto em Play
O método mudou 4 vezes até parar de ser desenho e passar a ser a cidade de verdade.
**A chave `Allow Mesh & Image APIs` NÃO é mais necessária** — este método não usa
`EditableImage` em lugar nenhum. Já dá pra testar jogando.

Provado sem Play: `altura = raio/tan(FOV/2)` bate com o recorte pedido em todos os
zooms · o giro pelo vetor `up` do `lookAt` acerta 0°/90°/180°/270° · tile entra e
sai do ViewportFrame pelo alcance (raio×1.45) · ponto fora do recorte SOME (não
sangra) · os 32 pontos saíram das Descriptions dos `Interact`, nenhum digitado na
mão · assado v6 em 1.6s, 23.322 peças, 16×16 tiles.

Provado EM PLAY, com foto: o minimapa mostra a cidade real embaixo da seta ·
6 tiles / 1.667 peças desenhadas de 23.322 · custo ~11% de FPS · coluna esquerda
sem sobreposição (objetivo 49–117 · feed 119–474 · minimapa 483–684 · Infos 698–752).

### Pra ti conferir jogando
- [ ] O minimapa mostra **prédio, rua e praça de verdade**, não mancha de cor.
- [ ] Girar a câmera → o mapa gira junto; a seta fica parada no centro.
- [ ] Andar → a cidade escorre embaixo sem piscar quando troca de tile.
- [ ] Entrar num carro → o recorte **abre** (raio 150 → 300).
- [ ] **Nenhum outro jogador aparece no mapa.** Nem carro de jogador.
- [ ] Objetivo longe → a bolinha laranja **gruda na borda**, não some.
- [ ] Ser algemado ou cair → o minimapa some.
- [ ] Os pontos (posto, banco, hospital) caem onde eles realmente estão.

### 🟠 Decisão que é tua, e precisa de F7 pra medir
O `MapaModelo` (23.322 peças) mora em `ReplicatedStorage` e replica pra todo
cliente, e o jogo está com StreamingEnabled. Em Play Solo a medição deu
**inconclusiva**. Roda **Start Server + 2 Players (F7)** ou testa no place
publicado e olha a memória do cliente. Se pesar, a alavanca é uma só:
`ServerStorage.AssarMapa.AREA_MIN` — 400→5.863 · 150→12.533 · 60→17.147 ·
25→23.322 peças. Depois de mudar: `require(game.ServerStorage.AssarMapa).assar()`.
## ✅ Objetivo ligado no carteiro (18/09): 232 testes + Play
Todo logradouro e todo bairro tem apelido · nenhum apelido repetido · todo
apelido + " - 180 m" cabe em 26 chars · as 68 peças de rua batem com o nome
delas · nenhuma entrega em "Zona Rural" · as 18 entregas cabem no card.

### Pra ti conferir jogando
- [ ] Pegar uma carta → o card do objetivo acende **sozinho** no topo esquerdo,
      com o nome da rua do destino.
- [ ] Andar até lá → os metros caem sozinhos; passando de 1000 vira "1,2 km".
- [ ] Entregar → o card **some** e o pagamento sai igual a antes.
- [ ] Pegar carta pra favela → vai dizer **"V. Pantanal"** em vez de nome de rua.
      É de propósito (beco não tem nome); me diga se preferir nomear.
- [ ] Morrer/ser preso com a carta na mão: hoje o card **continua aceso**.
      Se te incomodar, eu limpo — são 2 linhas.



## ✅ MAPA v11 — REGIÃO DA RUA VIVA + MAPAS PERTO (18/09): 32 testes + fotos
A rua agora aparece com a **cor real do que está por cima dela** — asfalto, faixa
de pedestre, pintura, vaga demarcada, bueiro — e só o entorno é cinza. E os dois
mapas vieram pra perto, com ponteiro pequeno.

Provado de bancada (32/32): 5 degraus de zoom crescendo e presos nas pontas ·
raio a pé 75 e dirigindo 150 (metade do que era) · setas 12×7 e 14×8 ·
o celular abre em 400 · **decalque acha o asfalto em 73% dos casos (era 0%)** ·
`via` é a camada mais alta · a rua tem **62 cores distintas** (não é chapada) ·
nenhuma laje mais grossa que 1 stud · zero MeshPart e zero Union ·
**os 16 blocos preenchidos** (teste novo, ver abaixo).

Provado por FOTO: um cruzamento com faixa de pedestre em recorte fechado (dá pra
ver as vagas demarcadas e as faixas), o centro, o mapa inteiro, o minimapa em Play
e o app do celular.

### Pra ti conferir jogando
- [ ] Parar em cima de uma faixa de pedestre → ela **aparece no minimapa**, como
      faixa, não como mancha.
- [ ] A região da rua tem textura/variação; o entorno é cinza liso.
- [ ] O minimapa está **perto** — dá pra ver detalhe da pista.
- [ ] A setinha é pequena.
- [ ] No celular, o **+** chega em 100 m (nível de rua) e o **−** em 1950 (cidade toda).
- [ ] Passar embaixo de toldo/marquise → a rua continua inteira.
- [ ] **Se ainda achar alguma mancha escura no meio da pista, me diz onde.**

### Nota honesta sobre a cor
O asfalto deste jogo é `Concrete` **248,248,248** — quase branco. O que o deixa
escuro no jogo é a **textura do material**, não a cor. Como o mapa é desenhado com
luz chapada, a rua sai clara. É a cor real do dado, mas **não** é o tom que teu
olho vê dirigindo. Se você preferir o tom do jogo (asfalto escuro com faixa
branca), é uma linha — me fala.

### 🟠 Ainda é decisão tua: o peso
`MapaModelo` com **42.427 lajes** (era 25.223 a passo 3). Todas caixas lisas, zero
MeshPart. O botão é `PASSO` — e ele existe **nos dois** módulos (`MapaGrade` e
`AssarMapa`), tem que mudar os dois. Medir com **F7** ou no place publicado.

### Reassar (1 a 2 blocos por chamada, senão fica buraco)
```lua
local A = loadstring(game.ServerStorage.AssarMapa.Source)()
A.inicio()
A.bloco(0,0) A.bloco(0,1) -- ... os 16
A.fim()
```

---

## Mapa v12 — desenho por traçado (`ServerStorage.MapaDesenho`)

### Nenhuma rua ficou pra trás (numérico)
Roda a partir do cache da grade, sem re-raycast. Portão: **≥ 90%**.
Última medição: **92,6%** (40.614 de 43.861 células), com `RAMO_MIN` 7 pro asfalto e 4 pra terra.
Se cair abaixo de 90%, olhar onde: a medição imprime os blocos de 300 studs com mais buracos.

### Nenhuma rua ficou pra trás (visual — o que o Julio pediu)
```lua
local D = loadstring(game.ServerStorage.MapaDesenho.Source)()
D.conferir(-150, 75, 3900, 6)   -- traços flutuando sobre a cidade de verdade
D.tirarConfere()
```
Foto de cima, **uma só**. Rua do mundo sem barra rosa em cima dela = rua que ficou pra trás.
Não comparar duas fotos (mundo × desenho): o enquadramento nunca bate.

### Pátio não virou rua
Mancha de rua com largura > 45 studs tem que sair da malha e virar pátio.
Se a Praça Santa Fé (225×436) aparecer como traço branco, o `LARG_PATIO` regrediu.

### A entrega pra IA de imagem
`04_Mapa/santafe_malha.png` — conferir a olho: as 18 ruas nomeadas aparecem, os 32 pontinhos âmbar
não empilham nome em cima de nome, e o mato não tem mancha cinza solta longe de rua.

---

## Minimapa holográfico

### Ele desenha?
Em Play, com a chave `HUDv2` ligada:
```lua
-- no cliente
local f = game.Players.LocalPlayer.PlayerGui.Main.HudMinimapa
local w = f:FindFirstChildOfClass("ViewportFrame"):FindFirstChildOfClass("WorldModel")
print(#w:GetChildren())   -- esperado: 280 a 500 caixas
```
Zero caixas = o filtro de volume subiu demais ou a varredura parou.

### Passa no teste do Julio?
Olhar o minimapa e responder as três, em voz alta:
1. **Eu conseguiria me guiar por isso?** (o caminho claro tem que se destacar do verde escuro)
2. **Sei o que é aquele prédio?** (serviço perto = rótulo na tela + blocos na cor do serviço)
3. **Sei o que é aquele azul mais forte?** (sólido = na sua altura · vidro = acima da sua cabeça)

Qualquer "não" reprova a volta.

### Entrei no prédio, vejo lá dentro?
Entrar numa loja e olhar: o telhado tem que estar quase invisível e as paredes internas visíveis.
Se o quadro ficar chapado, `ALTO_DESDE` ou a rampa de transparência regrediu.

### Rótulos aparecem?
Parar a ≤110 studs de um Posto/Banco/Oficina. Tem que acender o nome na cor do serviço em até 6 s
(é o relógio do reindex). Nunca acender = as tags `Interact` não chegaram no cliente.

### Celular
Abrir o app Mapa: tem que dizer **GPS FORA DO AR**, sem botão de zoom, e fechar normal no X.

## ✅ 19/09 — "a arma não dá dano" (QA BindableFunction salvo no place)
`CaidoService.QA` e `FerimentoService.QA` tinham sido salvos no place → o serviço subia como PROXY sem handler e
`ContextoTiro` pendurava pra sempre ANTES do `TakeDamage`. Apagados no Edit. Provado: boneco 100 → 52.8 → 5.4 com AK47.

### Pra ti conferir jogando
- [ ] Atirar em alguém/boneco com qualquer arma → tira vida.
- [ ] No Explorer, `Server.[Armas] Services.CaidoService` e `FerimentoService` **sem** filho `QA` antes de dar Ctrl+S. Se aparecer, apaga.

## 🧹 19/09 — MapaModelo arquivado (depende de ti, ver [[Entrega_Julio]] item 1)
- [ ] `ReplicatedStorage.MapaModelo` não existe mais; está em `ServerStorage.Backups.MapaModelo_v11_arquivado`.
- [ ] Minimapa holográfico continua desenhando (280–500 caixas) — ele não depende do MapaModelo.

## 🚗 Fusca nativo (16/09) — falta o teu olho
- [ ] Spawnar `ServerStorage.PortaMalasFrota.Modelos.FuscaNativo` → porta-malas DIANTEIRO abre com a bolinha F, 4 slots funcionam, capô sólido (sem ver através).
- [ ] Tampa do motor **não** abre (desligada de propósito).
- [ ] Rodar por 30 s: nada solta, nada vibra (o chassis é montado em runtime pelo `Criar`).

## ✅ Holograma de toda altura (19/09): medido + foto
255 caixas, Y 5→137, zero "vidro" quando não há nada em cima da cabeça.
### Pra ti conferir jogando
- [ ] No Centro: os prédios aparecem inteiros no minimapa (não só a base).
- [ ] Entrar numa loja: o telhado vira vidro e dá pra ver as paredes de dentro; sair: volta sólido.
- [ ] Perto de prédio alto: a rua atrás dele ainda aparece (vidro leve, nunca some).

## 🔴 Antes das 23h — permissões de asset
- [ ] No Output do Studio, os avisos "A experiência não tem permissão de acesso para usar a ID do ativo …": clicar em "compartilhar o acesso" nos que forem de animação/som do jogo, OU confirmar no place público que armas/animações tocam.
- [ ] Rodapés: nenhuma tela mostra "CAMPO BELO RP" (7 trocados pra SANTA FÉ).

## Pra ti conferir jogando (20/09)
- [ ] **Sirene SAMU**: entrar na ambulancia, apertar **H** -> agora TOCA (o asset velho 13251270466 vinha mudo, duracao 0; troquei as 12 ambulancias pra 228905506, a mesma da PM).
- [ ] **Inventario sem caixa preta**: abrir o inventario (G) -> o painel fica translucido (da pra ver o jogo atras), nao mais bloco preto opaco. Era ImageTransparency = 0 no MainGui.Inventory ao abrir; virou 0.35 (Design System: janela preta 0.1-0.4).
- [ ] **Nivel aparece ao ganhar XP**: o frame Level tava fora da tela (Y negativo), trouxe pro topo; blindei o load. Ja confirmado em Play que vira "Lvl X".
- [ ] **Loja de armas da favela**: clicar num item (Revolver/Glock/AK...) -> aparece o botao Comprar; comprar debita e entrega. Vale pras 4 lojas (AVendaArma + AVendaIlegal 1/2/3).

## 📱 20/09 — RoZap, Deepweb e OLX (medido no Edit, sem Play)

### RoZap — mensagens sumiam e o balão verde cobria o chat
Dois defeitos de propriedade, zero de lógica. `ScrollingFrame.CanvasSize` era `{0,0},{99,0}`
com `AutomaticCanvasSize None`: a vista rolava pro vazio depois da 1ª mensagem. E os moldes
tinham Size em **escala** com `AutomaticSize` — medido: balão de **9166px** num quadro de
401px, canvas 58924px. Agora cada mensagem é uma linha e o balão abraça o texto (teto 76%).
Backups: `RoZap_antes_layout`, `RoZapTemplate_antes_layout`.
- [ ] Abrir uma conversa com 10+ mensagens: todas aparecem, a última fica à vista.
- [ ] Mandar 3 mensagens seguidas: as 3 aparecem, cada balão do tamanho do texto.
- [ ] Mensagem longa (2+ linhas): quebra e para em ~3/4 da largura, não estoura pro lado.
- [ ] Texto do outro (balão branco) está legível — era cinza claro no branco.

### Deepweb — mural fora de ordem, sem hora, post duplicado
`LayoutOrder = -(os.clock()*1000)` dentro de um laço empatava (medido: dois pares em
-5775370 e -5775369) e o mural saía embaralhado, com o post mais novo no meio. Agora a
ordem é explícita (feed 1..n, ao vivo 0,-1,-2...) e a hora vem do site (`idade_seg`).
Também: o servidor mandava o post de volta pro próprio autor, que já tinha desenhado o
dele — aparecia duas vezes. E o freio de 2 min só existia no cliente e no site (que
recusa com 429 sem ninguém ler) — agora existe no servidor, antes de espalhar. Post passa
por filtro de texto, que antes não existia.
Backups: `Deepweb_antes_feed`, `CelularService_antes_deepweb`.
- [ ] Abrir a deepweb: o post mais novo é o de cima, e cada um mostra "agora / 7 min / 3 h / 2 d".
- [ ] Postar: aparece **uma** vez só, no topo.
- [ ] Postar de novo em menos de 2 min: recusa com "espere 2 min entre posts" e **não** aparece no mural.
- [ ] Com dois jogadores: o post de um aparece na tela do outro na hora.
- [ ] Sem chip: a tela de instalar aparece certa e o segurar-F enche a barra.

### OLX — voltou a ter como postar
O `/olx` do chat foi fechado no dia 19 e a OLX é um mural que **só** vivia dele — ficaria
viva e sem ninguém pra alimentar (a "pegadinha" do [[Mapa_Celular]]). O painel
`MandarItem` já existia na tela, escondido e ligado em nada; agora é a porta de entrada
(`BCA "OLXPostar"` → mesmo filtro e mesmo broadcast de antes, + freio de 60 s por jogador).
- [ ] Abrir a OLX → botão Volta abre/fecha o "Criar Postagem".
- [ ] Preencher Item + Valor → Confirmar: o anúncio aparece no mural de **todo mundo**.
- [ ] Confirmar de novo em menos de 1 min: diz "Espere 1 min" e não posta.
- [ ] Item com menos de 2 letras: diz "Escreva o item".
- [ ] Não existe mais o card fantasma "Label / Label" no mural.

## 🛒 20/09 — OLX virou mercado de verdade (item 1 do [[Mapa_Celular]])

Tabelas `olx_anuncios`/`olx_vendas` no T2, rotas `/olx/*`, e o bloco inline do `GuiHandler`
virou o módulo `Celular.OLX`. **25 testes das rotas passaram contra um Postgres de verdade**,
incluindo 8 compradores simultâneos no mesmo anúncio (1 leva, 7 tomam "já foi vendido").
Backups: `GuiHandler_antes_olx`, `Site_antes_olx`, `SiteCelular_antes_olx`, `TelaOLX_antes_olx`.

### Pra ti conferir jogando (precisa de 2 jogadores pra metade)
- [ ] Abrir a OLX: o mural mostra os anúncios **mesmo entrando num servidor novo** (antes sumia).
- [ ] Botão Volta abre o "Criar Postagem". Anunciar um item que você TEM: o item **sai do teu inventário** e o anúncio aparece no mural com o teu nome e a bolinha verde.
- [ ] Anunciar um item que você NÃO tem → "Voce nao tem esse item".
- [ ] Anunciar 6 vezes → o sexto diz "Ja tem 5 anuncios".
- [ ] Clicar num anúncio de outro: o card pede **clique de novo** antes de comprar (não compra no primeiro toque).
- [ ] Comprar: sai o dinheiro, **entra o item**, o anúncio some do mural dos dois.
- [ ] Comprar sem ter o dinheiro → "sem dinheiro", e o item NÃO some do mundo (volta pro vendedor).
- [ ] Clicar no teu próprio anúncio (bolinha verde X) → cancela e **o item volta pro teu inventário**.
- [ ] Com 2 jogadores: A anuncia, B compra → A recebe o dinheiro na hora, com aviso.
- [ ] **O caso do offline:** A anuncia e SAI do jogo. B compra. A volta → recebe o dinheiro no login, com aviso.
- [ ] Não existe mais card fantasma "Label / Label" no mural.
- [ ] `/olx` no chat continua fechado, e agora isso não deixa a OLX morta.

## 🎒 20/09 — dropar item repetido sumia com DOIS

Relato do Julio: "tenho 2 A10, dropo um, um vai pro chão e o outro some". Não é do A10 —
é de **qualquer item repetido**. Um drop apagava dois botões do inventário: o servidor
mandava o `Remove` sem ID, o cliente apagava o **primeiro** botão com aquele nome, e logo
depois apagava o selecionado também. Com 1 unidade os dois passos batiam no mesmo botão e
ninguém via; com 2, sumiam os dois. Reproduzido: dropando o 1º sobrava 1 (parecia certo),
dropando o **2º sobravam 0**. Por isso aparecia com o celular pego de outro jogador — esse
é o 2º botão. **O save nunca esteve errado** (tirava 1 só): relogando o item voltava.
Backups: `InventarioHandler_antes_dropduplo`, `RemotesHandler_antes_dropduplo`.

### Pra ti conferir jogando
- [ ] Com **2 A10** (um pego do chão de outro): dropar um → **sobra um no inventário**, e o do chão é o certo.
- [ ] Dropar o **segundo** da lista (não o primeiro) → continua sobrando um. Era esse o caso quebrado.
- [ ] Mesma coisa com 2 bandagens / 2 de qualquer item: some **uma** por drop.
- [ ] Dropar item **equipado** (na mão) com 2 no inventário → some um só.
- [ ] Botão **Excluir** com 2 do mesmo item → some um só.
- [ ] Com **1** unidade: dropar continua funcionando igual a antes.
- [ ] O celular que ficou continua funcionando (número, conversas) — o outro uid não foi tocado.

## Pra ti conferir jogando (20/09 - parte 2)
- [ ] **Craft**: segurar Craftar ate o fim NAO cancela mais se o cursor sair de cima (so ao soltar o mouse). Falta ingrediente = avisa qual. Tooltip no cursor (nao mais la embaixo).
- [ ] **Carteiro entrega**: bolinha aparece se voce esta com a carta cujo destino e aquele ponto (nao depende do _G.Data.Emprego). Entrega consome + paga.
- [ ] **Carteiro multiplas**: pega varias; equipa a que vai entregar.
- [ ] **Lixeiras**: cooldown 20 -> 8 min.
- [ ] **CHAT PROPRIO (geral)**: ; digita e manda -> aparece na JANELA (Chate.ScrollingFrame) pra TODOS. Testar com 2 contas. Se ok, proximo passo = DESLIGAR chat do Roblox (reversivel). Filtra com FilterStringForBroadcast.
- Backups: RemotesHandler_antes_chatgeral, GuiHandler_antes_chatgeral, e os _antes_ das outras.

## 🔓 20/09 — lockpick abre carros, casas e porta-malas

Pedido do Julio: "faça com que o lockpick consiga abrir carros e casas (além de porta malas etc)".
O lockpick vira uma ferramenta geral de arrombamento. **Gasta 1 Lockpick por uso** (mesma regra
que já existia no carro), e some da mão após abrir.

- **Carro** (porta do carro / MassanetaCarro Request `Destrancado`): já existia — carro trancado +
  Lockpick na mão libera e senta. Mantido, sem mexer.
- **Casa** (porta com Request `SerDono`): NOVO. Quem não é dono nem tem permissão, mas está com o
  Lockpick na mão, abre a porta gastando 1 Lockpick. Servidor: `RemotesHandler` bloco `Porta`.
  Cliente: `InteractionHandler` bloco `SerDono` passou a mostrar a bolinha F em porta de casa quando
  se está com Lockpick (escopo só `v.Name == 'Porta'`, não pega cama/interruptor).
- **Porta-malas** (trancado de terceiros): NOVO. `PortaMalasService.Solicitar` — se não é dono nem
  policial em serviço, mas tem Lockpick, arromba e gasta 1. A bolinha já aparecia (Request vazio),
  só o servidor decidia.

Backups: `RemotesHandler_antes_lockpick`, `PortaMalasService_antes_lockpick`, `InteractionHandler_antes_lockpick`.
Ficou de fora (decidir depois): alertar polícia ao arrombar casa (hoje nenhum arrombamento alerta,
igual ao carro). Balanceamento = o custo de 1 Lockpick por porta.

### Pra ti conferir jogando
- [ ] **Casa de outro**: sem Lockpick, sem bolinha na porta (igual antes). Com Lockpick na mão, a
      bolinha F aparece → abre a porta e **some 1 Lockpick** do inventário.
- [ ] **Casa própria / com permissão**: abre normal, **sem gastar** Lockpick.
- [ ] **Cama e interruptor** de casa de outro: continuam sem bolinha (o lockpick não abre esses).
- [ ] **Carro trancado de outro**: com Lockpick, destranca e entra, gasta 1 (como já era).
- [ ] **Porta-malas trancado de outro**: com Lockpick, "Você arrombou o porta-malas", abre e gasta 1.
      Sem Lockpick, continua "Só o dono (ou policial em serviço)".
- [ ] Policial em serviço abre porta-malas trancado **sem** gastar Lockpick (regra antiga mantida).

## 🪢 20/09 — algemar/amarrar só exige "sem arma na mão"

Pra algemar OU amarrar, basta o alvo **não estar com arma na mão** (equipada). Não precisa mais "render-se".
- Módulo novo `ReplicatedStorage.Resources.ArmasNaMao` (lista central de armas + `EstaArmado(char)`).
- Servidor (`RemotesHandler`, ToolAction Algema `A/D`): usa `ArmasNaMao.EstaArmado` — **todas** as armas
  contam (antes faltavam PT 92, Boito Borracha, R700, MT40, T4, M4A1, facas). Desamarrar/desalgemar nunca bloqueia.
- Corda (`ToolHandler.Corda`): mostra **Amarrar** e deixa apertar **X** quando o alvo está sem arma na mão.
Backups: `RemotesHandler_antes_rendicao`, `Corda_antes_rendicao`.

### Pra ti conferir
- [ ] Corda: chegar perto de alguém sem arma na mão → **Amarrar**, X amarra (sem V).
- [ ] Corda: alvo com arma na mão → "Renda-se", X não amarra.
- [ ] Algema: só algema quem está sem arma na mão (qualquer arma, inclusive faca/T4/MT40).
- [ ] Desamarrar/desalgemar sempre funciona.

## 🦾 20/09 — braços tortos / bonequinho de braços abertos (animação)

**Duas causas, as duas consertadas:**

1) **Mira (arma)** — o `ArmaMotor` escrevia o C0 dos ombros todo frame e só desfazia no CleanUp; a base
   de repouso podia ser gravada torta e o CleanUp não rodava se a arma fosse pro chão. Conserto: base
   guardada na própria junta (atributo `ArmaBaseC0`, capturada limpa), restauração re-acha o ombro e
   sempre volta, e o CleanUp roda em **qualquer** saída da arma da mão. Backup: `ArmaMotor_antes_bracos`.

2) **Respawn (o do jornal na foto)** — depois de morrer/renascer as animações ficavam **mortas**:
   - `AnimationHandler:Start` tinha um loop `v=nil;i=nil` que **não fazia nada** → `_G.LoadedAnimations`
     seguia apontando pro Animator morto. Nenhuma animação de ferramenta nem "Correr" tocava → o boneco
     caía na pose crua do R6 (braços abertos). Agora recarrega de verdade (`table.clear` + reload no
     Animator novo). Backup: `AnimationHandler_antes_respawn`.
   - `ToolHandler` ficava preso no corpo **antigo** (variável `character` capturada 1x) e **vazava** uma
     conexão de CharacterAdded por respawn. Agora re-liga no corpo atual a cada spawn, sem vazar, e
     recria os handlers pra pegarem as animações recarregadas. Backup: `ToolHandler_antes_respawn`.

### Pra ti conferir (precisa MORRER e renascer)
- [ ] Morrer, renascer, pegar um item (jornal/microfone/arma) → segura **normal**, sem braços abertos.
- [ ] Depois de renascer, **correr** volta a ter animação de corrida.
- [ ] Pegar arma, mirar pra cima/baixo, largar (guardar E jogar no chão), sentar / apertar V → braços normais.
- [ ] Repetir morrendo/renascendo várias vezes → continua normal (sem acumular bug a cada morte).

## 🗺️ 20/09 — minimapa mostrava Posto/Oficina onde não tem

**Causa:** os rótulos vêm de peças Interact cujo Description está na tabela DESC. "Encher tanque"→Posto
e "Reparar carro"→Oficina, MAS essas duas descrições ficam no **próprio carro** (TanqueCarro e Fumaca
no corpo do veículo — 211 e 253 delas), não em posto/oficina fixo. Resultado: o minimapa carimbava
Posto/Oficina em cima de todo carro. O jogo não tem landmark fixo de posto/oficina (abastece/repara no
carro com item), então esses dois POI não existem de verdade.
Extra: o índice ainda pegava cópias tagueadas em `ServerStorage.Backups` e `Assets` (nem estão no mundo),
criando rótulo fantasma em posição errada.

**Conserto (`Minimapa`):** tirei "Encher tanque" e "Reparar carro" da DESC; e o índice agora só pega peça
que é `IsDescendantOf(workspace)`. POIs que sobraram (todos fixos): Banco, Hospital, Correios, Base,
Roupas, Barbearia, Mercado, Empregos. Backup: `Minimapa_antes_poicarro`.
Obs: o `ServerStorage.AssarMapa` (mapa do celular, hoje desligado) tem a mesma tabela — se voltar o mapa
do celular, aplicar o mesmo lá.

### Pra ti conferir
- [ ] Andar perto de carros → NÃO aparece mais "Posto"/"Oficina" no minimapa.
- [ ] Banco, hospital, correios, loja de roupa, barbearia, mercado ainda aparecem com o nome certo.

## 📮 carteiro — em diagnóstico (logs [CartaDBG] ativos)
Coloquei logs temporários no servidor (`RemotesHandler`, ramo EntregaCarta): imprime se entrou, se o
emprego passou, se a carta está na mão e se o endereço bateu. Falta o Julio dar Play, tentar entregar
(segurando F os 7s) pra eu ler o console e achar onde trava. REMOVER os `[CartaDBG]` depois.

## 💰 20/09 — CORTE DO GAMEPASS + reescala de preços (economia)

**Gamepass cortado por completo** (a decisão de mecânica está em /areas/santa-fe-economia.md na memória).

Preços de carro novos (ancorados na vida real + renda de corp):
Fusca 9k (iniciante) · Uno 22k · Palio 26k · Kombi 48k · Prisma 52k · Gol G6 56k · Saveiro 120k ·
Corolla 155k · Civic 210k · S10 240k · Hilux 320k · S10 Turbo 340k · Trailblazer 370k ·
**BMW M4 850k · AMG GT R 1.800.000** (mais caro do jogo). SaveiroP fica 'Teste' (não vende).

O que mudou no código:
- `Carros`: todos os preços; AMG 'Gamepass'→1.8M; BMW 'Admin'→850k.
- `RemotesHandler` ComprarCarro: só vende Preco numérico (guarda 'Teste'); prompt de gamepass do AMG removido.
- **XP em dobro removido de geral** (carteiro, pizza, mecânico bateria/pneu, lixeiro, caixa) — matou os web-calls dos passes 1786436613 e 60768291.
- **CasaCondominio** comprável por **R$150.000** (era gamepass 1785890139); placa resetada + Description nova.
- **Cores customizadas liberadas pra todos** (server 1786224049 + client ControllerHandler color wheel 60768038).
- `DataHandler`: migração 1x (`Migrou.CorteGamepass`) que **tira AMG e CasaCondominio de quem herdou** de sessão antiga.
- `MarketplaceHandler`: grants de gamepass (casa/AMG) desligados (compra externa do pass não dá mais nada).
- `GuiHandler`: aba "Gamepasses" da loja escondida (aba Dinheiro/Robux fica — é monetização separada).
Backups: `*_antes_economia` (Carros, RemotesHandler, DataHandler, MarketplaceHandler, GuiHandler, ControllerHandler).

### Pra ti conferir jogando (precisa Publish + reiniciar Play)
- [ ] Concessionária: todos os carros com preço novo; **AMG e BMW compráveis por dinheiro** (sem "Comprar Gamepass").
- [ ] Comprar um carro com grana suficiente → debita e entra na garagem; sem grana → "Dinheiro Insuficiente".
- [ ] **Tua conta**: ao entrar, **AMG e CasaCondominio sumiram** da garagem/casas (herança de gamepass cortada).
- [ ] CasaCondominio: placa mostra "Comprar casa (condomínio) - R$150.000"; compra debitando 150k.
- [ ] Loja (shop): **sem aba "Gamepasses"**; aba Dinheiro (Robux) continua.
- [ ] Tunagem: **roda de cores livre** pra todos (sem prompt de compra).
- [ ] XP não dobra mais em nenhum emprego.

Faltou (visual, se quiser depois): a arte do Decal da placa da CasaCondominio ainda é o anúncio antigo do gamepass — trocar por uma que mostre "R$150.000". E o endgame de verdade (empresas/negócios) é sistema novo.
