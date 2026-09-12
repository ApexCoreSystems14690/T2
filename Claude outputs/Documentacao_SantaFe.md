# Santa Fe Roleplay — Documentacao Tecnica do Jogo

Manual de referencia para desenvolvedores. O objetivo deste documento e que qualquer dev consiga entender e mexer no jogo sem depender de ninguem: como o jogo liga, como cliente e servidor conversam, onde ficam as chaves que ligam e desligam sistemas, o que cada script faz, e como fazer as tarefas mais comuns com seguranca. Foi escrito em prosa corrida, de proposito, para ser lido como um livro e consultado como um dicionario.

O jogo e um RP brasileiro no Roblox (place DEVTS, placeId 78083733455249). E um projeto grande: cerca de 355 scripts, contando modulos padrao da Roblox, bibliotecas de terceiros e familias de scripts quase identicos. Este manual documenta em profundidade os sistemas proprios do jogo e trata as familias repetidas e o codigo de terceiros de forma agrupada, porque documentar 90 handlers de comida praticamente iguais um a um nao ajuda ninguem. Onde um script e apenas uma copia de um padrao, o padrao e explicado uma vez e as variacoes sao apontadas.

Uma convencao de leitura: sempre que este manual disser "atributo", trata-se de um Attribute da Roblox (SetAttribute/GetAttribute), que replica do servidor para os clientes automaticamente e por isso e o meio preferido do jogo para publicar estado. Quando disser "chave" ou "flag", e um atributo (ou valor) que liga ou desliga um comportamento inteiro. "Remote" e um RemoteEvent ou RemoteFunction. "_G" e a tabela global do Luau, usada em alguns pontos como ponte entre scripts do mesmo lado (servidor com servidor, cliente com cliente); ela nao cruza a fronteira cliente-servidor.

---

## PARTE 1 — VISAO GERAL E ARQUITETURA

### 1.1 Cliente e servidor, quem manda em que

O jogo segue a divisao normal da Roblox: o servidor e a autoridade sobre dados que importam (dinheiro, inventario, dano, save) e o cliente cuida do que o jogador ve e sente (camera, animacao, HUD, efeitos visuais). Duas regras de ouro atravessam o codigo inteiro e explicam muita decisao de arquitetura:

Primeira: o personagem pertence ao CLIENTE. Na Roblox, o dono de rede (network owner) do personagem e o proprio jogador. Por isso, mexer em solda, pose ou C0 de junta no SERVIDOR quase nao move o corpo daquele jogador na tela dele — quem faz o stream das posicoes e o cliente. Toda correcao de pose, camera e lean (inclusive o drive-by) e feita no cliente. O servidor so entra quando precisa ser autoridade (dano, validacao, replicacao de um estado que os OUTROS clientes precisam ver).

Segunda: efeito visual so nasce de evento confirmado pelo servidor. Sangue, furo de bala, impacto e desenho de tiro sao emitidos DEPOIS que o servidor aplicou o dano, nunca antes. Isso e uma decisao explicita do dono e esta escrita no proprio motor de armas.

### 1.2 Como os scripts conversam

Ha quatro canais de comunicacao no jogo, e vale conhecer os quatro porque cada sistema usa um deles:

RemoteEvents e RemoteFunctions, criados sob demanda por uma fabrica central (NetworkHandler no servidor, NetworkHandler no cliente). Os remotes vivem em ReplicatedStorage.Resources.Network. Um script pede "me da o RemoteEvent chamado X" e a fabrica cria se nao existir e devolve sempre o mesmo. Os principais remotes do jogo aparecem ja no boot: PingSync, ServerAction, Interact, ToolAction, Tilt, e as functions BCA, RequestData, CheckBadge. O ToolAction e o mais importante do combate: quase toda acao de arma passa por ele.

Atributos (SetAttribute) em instancias que replicam. E o jeito preferido de publicar estado que precisa ser lido por muitos scripts ou por muitos clientes. Exemplos: o personagem ganha atributos como Mirando, DBActive, DBAim, Preso, Algemado; o ReplicatedStorage ganha Chuva, ClimaModo, Molhado; os bancos de carro ganham SemDriveBy, DBFrente, DBCacamba. Toda a Parte 2 deste manual e um dicionario desses atributos.

_G, a tabela global. O jogo usa _G para pontes rapidas entre scripts do mesmo lado. No servidor: _G.Characters (mapa nome do jogador para o objeto de personagem do jogo), _G.LogDano (funcao que registra dano para o painel), _G.SetClima, _G.SetHora, _G.AdminBridge. No cliente ha usos proprios (por exemplo _G.Data com os dados do jogador, _G.MouseSolto, _G.PortaMalasAberto). Ponto critico que ja custou horas de debug: o _G do executor de codigo do assistente NAO e o mesmo _G dos scripts do jogo; e o _G de um LocalScript do jogo E o _G compartilhado do cliente. Ou seja, _G nunca cruza a fronteira cliente-servidor.

BindableFunctions internas, usadas por alguns servicos como porta de QA e de acesso cruzado. O padrao aparece em varios servicos de arma (DriveByService, MiraService): o servico cria um Instance BindableFunction chamado "QA" filho do proprio script; a primeira vez que roda vira a "instancia de producao" e conecta os eventos de verdade; se for exigido de novo em outro lugar, ele apenas delega para a instancia de producao pela BindableFunction. Isso garante instancia unica mesmo quando o modulo e requerido de varios pontos.

### 1.3 Ordem de boot do servidor

O script central de inicializacao e ServerScriptService.Server.boot. Ele publica um atributo "Etapa" em si mesmo a cada passo (0 inicio, 1 services carregados, ..., 7 FIM) e um "BootCompleto" no final — usar esses atributos e o jeito mais rapido de saber ate onde o boot chegou quando algo nao sobe. A sequencia e: sobe o NetworkHandler e ja cria os remotes base; carrega o PlayerHandler primeiro e depois requer TODOS os ModuleScripts em Server.Services em laco (cada require protegido por pcall, entao um servico que falha nao derruba os outros); registra o salvamento de casa no PlayerRemoving e no BindToClose; registra a limpeza de Accessory solto; define dados padrao de placement; inicia o ciclo dia/noite dos postes e a musica; e por fim varre o workspace tirando network owner de tudo que nao e personagem.

Duas licoes ficaram gravadas em comentarios no proprio boot e valem para o jogo todo. Uma: nunca use "return" no corpo principal de um Script para tentar pular uma iteracao — um return ali ENCERRA o script inteiro, e ja aconteceu de o boot morrer antes de registrar o salvamento das casas. Duas: prefira task.spawn a coroutine.wrap(f)() para trabalho paralelo no boot, porque coroutine.wrap PROPAGA o erro para quem chamou e um erro bobo (por exemplo um poste sem a peca ParteNeon) matava o boot inteiro naquele ponto. Por isso o registro de salvamento foi movido para o topo, antes de qualquer coisa que possa estourar.

### 1.4 Ordem de boot do cliente

Do lado do cliente, o ponto de entrada e ReplicatedFirst.client.Main (com um modulo Loading que faz a tela de carregamento). Os sistemas do jogador vivem em StarterPlayer.StarterPlayerScripts, com quase tudo dentro da pasta Client. O modulo GuiHandler e o coordenador da interface e, no Init dele, dispara os sub-handlers (inventario, lojas de roupa e cabelo, clima, celular, etc.). O ControllerHandler e o InteractionHandler sao os dois maiores modulos de cliente e cuidam, respectivamente, de controles/entrada e de interacao com o mundo (as acoes ficam em InteractionHandler.Actions, um modulo por acao). O PlayerModule, o CameraModule e o ControlModule sao os modulos PADRAO da Roblox (camera e controle) — estao ali para poderem ser customizados, mas em geral nao se mexe neles.

### 1.5 Convencoes que se repetem no codigo

Achar o carro certo a partir de um banco. Esta e a convencao mais importante do sistema de veiculos e aparece identica em varios scripts (DriveByAnim, DriveByCamera, DriveByService, ArmaMotor). A estrutura de um carro e um Model cujo PrimaryPart e o DriveSeat (classe VehicleSeat), com um sub-Model chamado Body que contem os assentos de passageiro (classe Seat, mas nomeados "VehicleSeat"). O detalhe traicoeiro: seat:FindFirstAncestorOfClass("Model") devolve o Body, que NAO contem o DriveSeat. Por isso todo script tem uma funcao acharCarro(seat) que sobe na hierarquia ate encontrar o Model que tem um VehicleSeat ou um filho chamado DriveSeat. Sempre use esse helper; nunca confie no primeiro Model acima do banco.

Orientacao do carro em runtime. carro:GetPivot() NAO e confiavel em tempo de execucao — devolve um frame alinhado ao mundo, nao a orientacao real do carro (a montagem fisica fica torta). A referencia verdadeira e o DriveSeat.CFrame, que e uma peca real. Quando um script precisa saber a frente, o lado ou a direcao do carro, ele usa ds.CFrame (o CFrame do DriveSeat), nao o pivot.

Lado do banco (esquerda/direita). Mede-se contra o CENTRO dos bancos, nao contra o motorista. O motorista senta na esquerda, entao usar o motorista como referencia inverteria a conta. O helper padrao soma a posicao de todos os assentos, tira a media (o centro), e projeta (posicao do banco menos centro) no RightVector do DriveSeat: resultado positivo e um lado, negativo e o outro.

Datamodel de edicao versus play. Em modo de edicao (Edit) nao ha passo de fisica: escrever Motor6D.Transform nao move as partes (quem move e o C0, que soma direto no CFrame). Em Play a fisica roda e o Transform passa a valer. Isso importa para qualquer ferramenta que pose personagens fora do jogo.

---

## PARTE 2 — DICIONARIO DE CHAVES E FLAGS

Esta parte lista as chaves que ligam, desligam e configuram sistemas. Para cada uma: onde fica, o que faz e o valor de referencia. Alterar uma dessas chaves e a forma mais rapida e segura de mudar o comportamento do jogo sem tocar em codigo.

### 2.1 Chaves de sistema (ligam/desligam mecanicas inteiras)

DriveByV1 — atributo em ReplicatedStorage.Resources. E a chave mestra de todo o drive-by (janela e caçamba). Se estiver diferente de true, os scripts de drive-by (DriveByAnim, DriveByCamera, DriveByService) simplesmente nao agem: cada um comeca com uma funcao "ligado()" que checa exatamente esse atributo. Para desligar todo o drive-by de uma vez, basta por essa chave em false.

POCAS_PROCEDURAIS — constante (nao atributo) no topo de ServerScriptService.ClimaService, hoje false. Quando era true, o servidor criava pocas de agua fisicas (blobs) espalhadas pelas ruas durante a chuva. Foi desligada porque as pocas passaram a vir na textura (MaterialVariant molhada). O codigo das pocas continua no arquivo, so nao roda. Para reativar, ponha true.

CaidoV2 — chave da Fase 4 (morte real em duas etapas, o sistema de "cair" antes de morrer). O CaidoService so age quando essa chave esta ligada; sem ela, o servico devolve false e nada muda, mantendo a rota antiga. Procure por CaidoV2 no CaidoService para ver o ponto exato.

FrenteAtivo — atributo em ReplicatedStorage.DriveByTune. Chave global do drive-by no banco da FRENTE (passageiro ao lado do motorista). Por padrao false: o banco da frente nao faz drive-by. Pode ser ligado globalmente, ou liberado carro a carro pelo atributo DBFrente (ver 2.3).

### 2.2 DriveByTune — os knobs do drive-by de janela

DriveByTune e um objeto em ReplicatedStorage cujos atributos ajustam, ao vivo, o drive-by de janela. Todos sao lidos em tempo real, entao dan para tunar com o jogo rodando. Os principais: LimiteFrente e LimiteTras (angulos, em relacao a lateral do carro, ate onde o braco e a camera podem girar — a frente e a tras do carro); GiroInverter (booleano, o UNICO ponto onde a inversao do giro e resolvida — se o giro sair invertido, e essa chave que se mexe, nao o codigo); Lateral, PoseX, PoseY, PoseZ (deslocam a pose da debruca); CamLado, CamCima, CamFolga (enquadramento da camera colada no braco: o quanto ela sai pra fora da janela, sobe, e a folga extra de giro para a mira alcancar tudo que o cano alcanca); CamPitchCima e CamPitchBaixo (limites verticais da camera); EspelharEsq e EspelharBraco (booleanos que ligam o espelhamento da pose e dos ombros no banco esquerdo). A camera e o braco usam SEMPRE o mesmo angulo e os mesmos limites, de proposito, para nunca divergirem.

### 2.3 Atributos por banco de carro (marcam o que cada assento faz)

Estes atributos ficam nos ASSENTOS (Seat/VehicleSeat) dentro dos carros e definem, por banco, o comportamento de drive-by. Ficam nos templates (ServerStorage.Assets.Carros para os civis) e nas instancias (workspace.VeiculosGovernamentais para as viaturas).

SemDriveBy — true marca um banco onde o drive-by de janela NAO acontece e, no servidor, onde a arma e CONFISCADA (o jogador nao pode segurar arma sentado ali). Usado nos bancos de caçamba, gaiola, terceira fileira e afins que ainda nao tem animacao propria.

DBFrente — true libera o drive-by no banco da FRENTE daquele carro especifico, mesmo com FrenteAtivo global desligado. Usado em carros onde o passageiro da frente deve poder atirar (Uno, Saveiro, Fusca, Kombi). O lado e automatico: a frente e do lado do passageiro (direita), entao a pessoa se debruca pela janela direita, sem espelho.

DBCacamba e DBCacPapel — sistema da caçamba (mais novo). DBCacamba=true marca um banco de caçamba que TEM drive-by proprio; DBCacPapel guarda "F" (fileira da frente da caçamba, perto da cabine) ou "T" (fileira de tras, perto do rabo). No banco de tras (T) o jogador pode segurar QUALQUER arma; a liberacao acontece em dois lugares que checam esse atributo: o guard de confisco do servidor (DriveByService) e a regra de equipar sentado do cliente (BackpackHandler). Quando se fala "frente/tras" no contexto de caçamba, e sempre a caçamba, nunca a cabine.

DBOffX, DBOffY, DBOffZ — atributos no MODEL do carro. Sao o offset de drive-by por carro: o deslocamento fino da pose de debruca (NAO mexem no sentado). O DriveByAnim le esses tres numeros e soma na pose; no banco esquerdo o X e espelhado automaticamente. Foram calibrados carro a carro numa plataforma de tuning.

### 2.4 Atributos de personagem (estado do jogador em runtime)

Mirando — true enquanto o jogador esta mirando uma arma. E a condicao central do drive-by: a debruca, o push-out da camera e o limitador so agem quando Mirando e true. Sentado parado, com ou sem arma, a camera fica centralizada e livre.

DBActive e DBAim — publicados pelo servidor no personagem para os OUTROS clientes verem o drive-by daquele jogador. DBActive (booleano) diz que ele esta em drive-by ativo; DBAim (0 a 1) e a posicao normalizada da mira no arco. O dono manda a mira pelo remote DriveByAnimRE; o servidor valida e escreve esses dois atributos, que replicam.

Preso — quantidade de tempo de prisao restante (numero). Enquanto maior que zero, o jogador esta preso; um laco no PlayerHandler decrementa. Ao zerar, o jogador e solto (teleportado, roupas restauradas). Ha tambem um atributo Preso booleano usado como marca de estado.

Algemado, Animation, Ragdolling, Morte, TemCelular, TemMochila — marcas de estado do jogador, setadas no PlayerAdded/CharacterAdded. TemCelular liga quando o jogador tem o item A10 (celular); TemMochila controla a mochila (e a capacidade extra); Ragdolling evita reentrancia no ragdoll; Morte conta mortes.

Forcefield — se true no personagem, o motor de armas ignora os tiros daquele atirador (nao dispara). Usado como protecao temporaria.

AdminNoclip e AdminNoclipVel — concedidos pelo painel do site: AdminNoclip liga o voo/atravessar-paredes no cliente (script NoclipFly), AdminNoclipVel e a velocidade base. O servidor (AdminBridge) seta esses atributos no jogador alvo; o cliente reage.

Agachado — quando true, o motor de armas aplica os fatores de agachado (menos dispersao e recuo) definidos no perfil da arma.

---

## PARTE 3 — REFERENCIA POR AREA

### 3.1 Dados e save (o mais critico)

O save do jogador e o coracao do jogo e vive em ServerScriptService.Server.Services.DataHandler. Ele usa ProfileService (biblioteca consagrada da comunidade, o MadStudio ProfileService, que fica no filho DataHandler.ProfileService — nao se mexe nela) para carregar e travar o perfil de cada jogador com seguranca contra perda e contra duas sessoes editando o mesmo dado. O ProfileStore e "CBRP_V1.2" e o template de dados fica em DataHandler.DataTemplate.

Ciclo de vida: no PlayerAdded, o DataHandler checa idade minima da conta (30 dias, exceto Studio), consulta banimento num DataStore separado (BanidosDB-CampoBeloRP.2), carrega o perfil, faz o merge com o template (para perfis antigos ganharem chaves novas), entrega o kit inicial uma vez (2 Pizza e 2 Garrafa de agua), aplica pendencia de caido se o jogador saiu do jogo caido, e concede o carro AMG se o jogador tem o gamepass/badge/asset correspondente. Ao sair (PlayerRemoving) ou ao fechar o servidor (BindToClose), o perfil e liberado (Release), o que persiste. Ha uma regra de combat log: se o jogador esta marcado como CombatLog e sai no meio de um combate, perde inventario e a maior parte do dinheiro.

A porta de entrada para MUDAR qualquer dado e o BindableEvent script.updateData:Fire(nomeDoJogador, ordem, ...). Isso e um dicionario de ordens gigante e e o jeito canonico de todo o resto do jogo (e o painel admin, via AdminBridge) mexer no save. As ordens mais usadas, agrupadas por assunto:

Dinheiro e banco: SetarDinheiro (define a carteira), IncrementDinheiro e UnincrementDinheiro (soma/subtrai carteira), Deposito e Saque (move entre carteira e banco), Transferencia (manda do banco de um para o banco de outro). Toda ordem que muda o que o jogador ve dispara SendData:FireClient para atualizar a tela.

Inventario e itens: AddInventario (adiciona item e tenta auto-equipar na barra se houver vaga), RemoveInventario (tira quantidade, destroi o Tool na barra se zerar), ResetaInventario (zera inventario e vitais, tira 25 por cento do dinheiro). Itens especiais: A10 liga o celular (TemCelular) e avisa novo contato; Mochila liga a mochila (TemMochila).

Carros: CarroAdd e CarroRemove (dá/tira um carro, copiando a config padrao de DefaultConfigs), SetaPotencia e AumentaPotenciaCarro, NovaCorCarro, NovoFarolCarro, UpdateHP e HPCarro e AddHp (vida do veiculo), CarroGasolina e RemoveGasolina e AbasteceCarros (combustivel), TransfereCarro (passa um carro para outro jogador), PortaMalasSet (salva o conteudo fisico do porta-malas). Os carros do jogador vivem em Data.Carros, uma tabela nome-do-carro para config; a config default de cada carro vem de [Carros] Services.Modules.DefaultConfigs.

Vitais e vida: Vital+ e Vital- (Fome, Sede, Sono, com clamp 0 a 100), Vida (Health), MorteReal (perde 25 por cento do dinheiro, vitais a 100, vida a 26 — a decisao D08 do dono: mantem inventario e mochila), CaidoPendente (marca que caiu e ainda nao foi atendido; se sair do jogo assim, o proximo login aplica a morte real).

Prisao: Preso (define tempo e limpa a barra de itens), PresoDiminui (decrementa; ao zerar, solta o jogador — teleporta, restaura roupas, tira algemas). Um laco no PlayerHandler chama PresoDiminui de segundo em segundo para quem esta em ServerStorage.Assets.PresosValores.

Aparencia: Genero, CamisaEquipada, CalçaEquipada, TrocaCabelo, CompraRoupa. As roupas e cabelos possiveis ficam catalogados em ReplicatedStorage.Resources.Roupas (Camisas, Calcas, Cabelos) e os assets em ReplicatedStorage.Resources.Assets.

Progressao e conta: IncrementXP (sobe de level ao atingir Level vezes 50 de XP), IncrementLevel, AddSlot/RemoveSlot/SetarSlots (slots da barra de armas, teto 6), MaisCapacidade/Capacidade (kg da mochila), Config (preferencias do jogador: sangue, JBL, sons de carro, notificacoes, tema), SetCombatLog, SetTemMochila, Banido (bane e expulsa), resetar (zera o perfil inteiro — usado pelo comando resetar_dados do painel).

Leitura: DataHandler:GetData(nome) devolve os dados sem yield; DataHandler:WaitForData(nome) espera carregar. O AdminBridge le por Functions:GetData. O cliente pede seus dados pela RemoteFunction RequestData.

### 3.2 Combate e armas

O combate foi reescrito num motor unico, o ArmaMotor (ServerScriptService.Server.[Armas] Services.ArmaMotor). O RemotesHandler, ao receber um ToolAction, primeiro pergunta ao ArmaMotor "isto e arma do motor novo?" com if ArmaMotor.Trata(plr, tool, acao, ...) then return end; se for, o motor cuida e o resto do RemotesHandler nem roda para aquela acao.

O perfil de cada arma esta em ReplicatedStorage.Resources.ArmasConfig, lido por cliente e servidor. Cada arma tem classe (pistola, fuzil, sub, espingarda, sniper), se e automatica, pente (balas por carregador), cadencia (segundos entre tiros), dano por regiao (corpo e cabeca), velocidade da bala, recuo, dispersao, tipo de mira (ombro ou ferro), modos de tiro (auto, rajada, semi) e fatores de agachado. Campos que faltam caem num PADRAO. Config.Pega(nome) devolve o perfil ja mesclado com o padrao. Para adicionar uma arma, o proprio cabecalho do arquivo ensina: um modelo em ServerStorage.Tools com Tiro.Fire/Tiro.Sound/Tiro.FX, as animacoes com os nomes certos, uma entrada no ArmasConfig e um shim de uma linha em Client.ToolHandler.NomeDaArma que faz return require(script.Parent.ArmaMotor).para("NomeDaArma").

A balistica usa FastCastRedux (biblioteca de terceiros em Resources.Services.FastCastRedux) com PartCache (reaproveita as pecas de bala para nao criar lixo). A bala tem queda (aceleracao 1.35 vezes a gravidade). O servidor valida cadencia (com 20 por cento de tolerancia para lag), pente, e distancia do cano ao personagem (maximo 10 studs, anti-exploit). No drive-by, a bala e configurada para ATRAVESSAR o proprio carro (o carro entra no filtro de exclusao do raycast) e, no banco espelhado, o cliente manda a posicao real do cano para a bala sair do lugar certo.

O dano acontece em fases, todas ja no ArmaMotor via modulos puros em ReplicatedStorage.Resources.MotorArmas: Regiao decide o dano por parte do corpo (cabeca e tronco batem o dano cheio, bracos e pernas batem menos); Padroes traduz o ArmasConfig num perfil por regiao; Ferimento e Reacao (com FerimentoService e a Cambaleada) cuidam do estado do ferido e do flinch; EquipamentoService cuida de colete e capacete (colete cobre o tronco, capacete a cabeca; a classe da arma decide se fura); CaidoService cuida da morte real em duas etapas (so age com a chave CaidoV2). O chao de vida do jogo e 0.1 (o jogador "cai" em vez de morrer na hora); headshot letal de fuzil/espingarda/sniper sem protecao e morte real imediata.

A MiraService replica o PITCH da mira para todos os clientes girando o Right Shoulder (e o Left) do atirador via C0, porque em R6 nao ha Waist e a arma esta soldada no braco direito. E puramente cosmetico: nao afeta dano nem balistica (essas usam o ponto que o cliente ja manda no Atira). O cliente manda o pitch pelo remote MiraPitch, o servidor trava em mais ou menos 80 graus.

### 3.3 Drive-by (janela)

O drive-by de janela e considerado fechado e estavel (o dono classificou como 10 de 10, nao mexer sem necessidade). Sao tres scripts de cliente, todos gated por DriveByV1 e por Mirando. DriveByAnim faz a debruca: carrega a animacao de drive-by, congela o tempo dela (AdjustSpeed 0) e a ESCRUBA pela mira (a posicao normalizada 0 a 1 no arco vira a posicao no tempo da animacao), e ajusta o tronco por C0 (a cintura fica no banco, o tronco e a cabeca saem pela janela) somando o offset DBOff do carro. No banco esquerdo, espelha a pose e os ombros por codigo (a flag EspelharEsq/EspelharBraco), sem trocar os bracos de lado, para a arma (soldada na mao direita) continuar saindo reta. DriveByCamera e o limitador suave da camera: quando a camera passa do arco de tiro, puxa de volta com mola, sem travar duro. DriveByService (servidor) quebra a janela do lado quando o jogador mira, repara quando para, e faz o relay do estado (DBActive/DBAim) para os outros clientes; tambem e onde ficam os guardas que confiscam arma de quem nao pode (motorista, passageiro da frente sem DBFrente, e bancos SemDriveBy sem DBCacamba).

A regra de qual arma pode em cada banco esta em ReplicatedStorage.Resources.MotorArmas.DriveBy: motorista so pistola e revolver; passageiro pistola, revolver e sub. O cliente aplica essa regra ao equipar sentado (no BackpackHandler), e o servidor a reforca.

O drive-by de caçamba e o sistema mais novo, ainda em construcao no momento desta documentacao. A ideia: banco de tras da caçamba usa qualquer arma, com os bracos vindo da animacao padrao da arma e o corpo da pose propria, girando num arco largo com a camera limitando as pontas; banco da frente da caçamba funciona como a janela. Os bancos de caçamba sao marcados com DBCacamba e DBCacPapel; as poses ficam em ReplicatedStorage._CACAMBA_FRENTE_TF e _CACAMBA_TRAS_TF. A liberacao de arma no banco de tras ja esta feita (servidor e cliente). A HiluxBope fica de fora por ser picape fechada.

### 3.4 Veiculos

Os carros civis sao gerados sob demanda a partir de templates. Os modelos-template ficam em ServerStorage.Assets.Carros (um Model por carro). A geracao e feita pelos modulos em [Carros] Services.Modules: Criar e o modulo principal, com variantes CriarAmbulancia, CriarGolAuto, CriarGolBM, CriarHiluxBope, CriarMoto para casos especiais, e CriarVeiculosGovernamentas para as viaturas. As configuracoes fisicas padrao de cada carro (potencia, vida, gasolina, etc.) ficam em DefaultConfigs, e os parametros de dirigibilidade em ReplicatedStorage.Resources.Chassis (um ModuleScript por carro, quase todos com cerca de 405 linhas e a mesma estrutura — sao perfis de suspensao, torque, direcao). O catalogo de carros que o jogo conhece esta em ReplicatedStorage.Resources.Carros.

As viaturas (veiculos governamentais) sao diferentes: nao sao geradas de template a cada uso, ficam SEMPRE spawnadas em workspace.VeiculosGovernamentais. Por isso, alterar uma viatura significa editar todas as instancias daquele tipo (ou uma e replicar). O porta-malas fisico e cuidado por PortaMalasService (servidor) e PortaMalasClient (cliente): o jogador abre, coloca e tira itens, e o conteudo e salvo em Data.Carros[nome].PortaMalas pela ordem PortaMalasSet.

### 3.5 Interface, HUD e lojas

O coordenador de interface e o cliente GuiHandler (um modulo grande, cerca de 2600 linhas). Ele monta a HUD e, no Init, dispara os sub-handlers que ficam como filhos dele: BackpackHandler (a barra de armas e a regra de equipar sentado), InventarioHandler (a mochila, tecla G), RoupasHandler e CabelosHandler (as lojas de roupa e cabelo — populam o catalogo cruzando Assets com o genero do jogador), ClimaHandler (a tela e o efeito de chuva no cliente, com o submodulo Chuva de mais de mil linhas), CraftHandler (crafting), MoveisHandler e seu PlacementHandler (colocar moveis na casa), Celular (o app do celular A10, com sub-apps BM, RoZap, SAMU, Uber, DropaCash), BubbleChat e NotificaHandler (balao de fala e notificacoes). A regra pratica: cada tela do jogo tem um handler proprio dentro do GuiHandler; para mexer numa tela, ache o handler com o nome dela.

A interacao com o mundo (portas, ATM, cortar cabelo, ver roupas, prender jogador, sentar, porta-malas) e o InteractionHandler, tambem grande, com uma pasta Actions onde cada acao e um modulo curto. Para adicionar uma acao de interacao, cria-se um modulo em InteractionHandler.Actions.

### 3.6 Camera e sensacao

A camera base do jogo e mira-fixa (um shift-lock proprio implementado no GuiHandler, no bind SantaFeMouse, que forca o mouse travado no centro todo frame; o shift-lock nativo da Roblox fica desligado). O EnhancedCameraSystem forca a primeira pessoa ao mirar fuzil. O SensacaoCamera adiciona a sensacao de velocidade (blur, mudanca de FOV, shake e roll conforme a velocidade) quando o jogador corre rapido — e desativado dentro de veiculos, para o carro nunca borrar a tela. O Ctrl solta o mouse (um toggle guardado em _G.MouseSolto lido pelo SensacaoCamera e pelo bind do GuiHandler). O PlayerModule/CameraModule/ControlModule sao os modulos padrao da Roblox e servem de base.

### 3.7 Corporacoes (integracao com o site)

As corporacoes (policia, governo, etc.) foram tiradas dos grupos da Roblox e passadas para um site externo. O CorpService (servidor) e um drop-in replacement das antigas chamadas de grupo: IsInGroup, GetRoleInGroup, GetRankInGroup, GetSalary agora consultam o site por HTTP (com cache de 120 segundos por jogador) em vez do grupo. O mapa de qual group id antigo virou qual slug no site esta no proprio CorpService (GroupToSlug); por exemplo 34017524 e policia-militar, 34016875 e bope, 15728795 e policia-civil. O ClienteCorp (ReplicatedStorage.CorpClient) recebe os dados por CorpDataSync. RefreshPlayer forca recarregar (usado apos promocao pelo painel).

### 3.8 Clima e hora

O clima e do servidor, em ServerScriptService.ClimaService, e publicado por atributos em ReplicatedStorage que replicam para todos: Chuva (0 a 3), ClimaModo (Auto ou Manual), Molhado, Trovao. No modo Auto ha um ciclo aleatorio que prioriza a noite; no Manual o painel admin fixa a chuva. A funcao global _G.SetClima(n) e a porta: n negativo volta pro automatico, 0 a 3 fixa. O cliente (ClimaHandler.Chuva) le os atributos e desenha a chuva, as pocas e os trovoes. A hora do dia (ciclo dia/noite dos postes) e cuidada no boot e ajustavel por _G.SetHora.

### 3.9 Administracao (in-game e site)

Ha dois caminhos de admin. O in-game e o ComandosHandler (servidor, cerca de 785 linhas) com comandos de chat/painel. O caminho principal hoje e o site (Santa Fe Corps, um app Node/Express/Postgres hospedado no Railway, codigo em D:\T2 na maquina do dono). A ponte entre o jogo e o site e o AdminBridge (ServerScriptService.Server.Services.AdminBridge): a cada 10 segundos manda um heartbeat com os jogadores online e o catalogo; a cada 3 segundos busca comandos pendentes para aquele servidor e executa; acumula logs (tiro, abate, morte, entrou, saiu, admin) e envia a cada 5 segundos. A seguranca e por API key (SiteConfig): o jogo so fala com o site com a chave; o site so aceita comandos de usuarios logados com is_admin — o jogo nunca decide quem e admin.

Os comandos que o site pode mandar (os Executores do AdminBridge) incluem: dinheiro_set/add, banco_set, item_add/remove, emprego, level_set, slots_set, tp_local/tp_jogador/tp_coord/trazer, curar, matar, kick, mensagem, carro_add/remove, resetar_dados, corp_refresh, ban/unban, hora, clima, anuncio, e o noclip (voo/atravessar paredes, que seta AdminNoclip no alvo). O painel do site tambem tem, na aba Registro, listar todos que entraram, apagar jogador, wipe geral do banco, e dar item/carro para todos. O SiteConfig guarda API_BASE e API_KEY.

O painel adm cinematografico antigo, aberto in-game com a tecla F (PainelAdmCine), foi removido e substituido pelo noclip concedido pelo site.

### 3.10 Empregos e outros

Os empregos (Lixeiro, Uber, Eletrisista, Carteiro) tem nivel minimo definido em ReplicatedStorage.Resources (Resources:GetEmpregoLevel). O emprego atual fica em Data.Emprego e e trocado pela ordem NovoEmprego. Ha ainda sistemas de trabalho (TrabalhoHandler), receitas de craft (Resources.Receitas), badges e marketplace (MarketplaceHandler), zonas seguras (SafeZoneHandler), ping (pingHandler) e desligamento suave do servidor (softShutdownHandler).

---

## PARTE 4 — DICIONARIO POR SCRIPT

Entrada por script (ou por familia, quando sao copias de um padrao). Para cada um: caminho, tipo, o que faz, e observacao de como mexer quando relevante. Os modulos padrao da Roblox e as bibliotecas de terceiros aparecem no fim, agrupados, com a orientacao de nao alterar.

### 4.1 Servidor — inicializacao e nucleo

ServerScriptService.Server.boot (Script). Inicializa o servidor: sobe NetworkHandler e remotes base, requer todos os Services em laco (pcall por servico), registra salvamento de casa, limpeza de accessory, ciclo dia/noite e musica, e varre network owner. Publica o progresso no atributo Etapa. Mexer aqui e delicado: leia os comentarios B16/B17/B18 antes (nao usar return no corpo, preferir task.spawn).

ServerScriptService.Server.Services.MainService (ModuleScript). Lista de servidores/lobby via um modulo Sertex (filho). Define MainServers (Testing e Roleplay, com MAX_PLAYERS e START_LOCKED). Responde ServerList e o evento Servers. Tem submodulo MusicaService.

ServerScriptService.Server.Services.NetworkHandler (ModuleScript) e NetworkHandler2. Fabricas de remotes do servidor. GetRemoteEvent(nome) e GetRemoteFunction(nome) criam sob demanda em Resources.Network e cacheiam. Os filhos Remotes e Functions definem o tipo. NetworkHandler2 e uma segunda fabrica para separar um conjunto de remotes.

ServerScriptService.Server.SiteConfig (ModuleScript). Guarda API_BASE e API_KEY do site. Ponto unico de configuracao da integracao com o Railway. Se a URL do site mudar, muda aqui.

ServerScriptService.Server.Services.pingHandler, softShutdownHandler, AmbientHandler. Ping do cliente, desligamento suave (avisa e migra jogadores) e ambiente sonoro/atmosfera.

### 4.2 Servidor — dados e jogador

ServerScriptService.Server.Services.DataHandler (ModuleScript, cerca de 800 linhas). O save. Ver secao 3.1. Filhos: ProfileService (biblioteca de terceiros, save engine, NAO mexer), DataTemplate (o formato inicial dos dados; adicionar uma chave nova ao save comeca por aqui). A porta para mudar dados e o BindableEvent updateData; a porta para ler e GetData/WaitForData/requestData.

ServerScriptService.Server.Services.PlayerHandler (ModuleScript). Carrega o personagem: aplica genero, roupa, cabelo e cor de pele; trata prisao no login; liga o laco de vitais (a cada 600s desconta Fome/Sede/Sono e aplica dano/ragdoll se zerar); dano de queda; equipar/desequipar mochila. Filhos: CharacterHandler (monta o objeto de personagem do jogo, guardado em _G.Characters, com Ragdoll e o Animate proprio) e AnimationHandler/Animations no cliente.

ServerScriptService.Server.Services.CorpService (ModuleScript). Corporacoes via site. Ver 3.7. O mapa GroupToSlug e o que se edita ao criar/renomear uma corp.

### 4.3 Servidor — armas e combate ([Armas] Services)

ArmaMotor (ModuleScript). Motor unico de arma de fogo. Ver 3.2. Entrada Motor.Trata(plr, tool, acao, ...). Balistica com FastCast+PartCache; dano por fase; drive-by faz a bala atravessar o carro. E o coracao do combate.

MiraService (ModuleScript). Replica o pitch da mira girando os ombros por C0. Cosmetico. Limite 80 graus. Remote MiraPitch.

DriveByService (ModuleScript). Drive-by de janela no servidor: quebra/repara janela, relay DBActive/DBAim, e os guardas que confiscam arma de quem nao pode. Os guardas checam SemDriveBy e DBCacamba. Ver 3.3.

FerimentoService, EquipamentoService, CaidoService (ModuleScripts). Fases 2 a 4 do combate: estado do ferido e reacao (Ferimento), colete e capacete (Equipamento), morte real em duas etapas (Caido, so com CaidoV2). CaidoService.Acertado/HeadshotLetal/ContextoTiro sao chamados pelo ArmaMotor.

Servicos por arma: AK47, AK47S, Boito, BoitoB, CAR15, CTT40, FAL, Glock, IA2, MP5, MT40, PT92, Revolver, T4 (ModuleScripts, cerca de 200 linhas cada). Sao a implementacao servidor de cada arma no esquema antigo; as armas migradas para o motor novo usam o ArmaMotor e o ArmasConfig. Ao adicionar arma nova, prefira o caminho do ArmaMotor (secao 3.2) em vez de criar um servico novo desses.

DriveByService_antes_hbblock (ModuleScript). Backup versionado de uma versao anterior do DriveByService. Nao roda; pode ser ignorado ou removido.

### 4.4 Servidor — carros ([Carros] Services)

Modules.Criar (ModuleScript, cerca de 900 linhas). Gerador principal de veiculos a partir de template. CarroDoJogador(nome) devolve o carro ativo do jogador. Variantes: CriarAmbulancia, CriarGolAuto, CriarGolBM, CriarHiluxBope, CriarMoto (casos com estrutura propria), CriarVeiculosGovernamentas (viaturas). DefaultConfigs guarda a config padrao de cada carro (usada pelo CarroAdd do save). Mexer em dirigibilidade e nos modulos Chassis (ver 4.7).

ServerScriptService.Server.Services.MecanicaHandler e VeiculosHandler; PortaMalasService; CarrosHandler_Concenssionaria. Mecanica (reparo/potencia), porta-malas fisico (salva em Data.Carros[nome].PortaMalas), e a concessionaria (compra de carro).

### 4.5 Servidor — mundo, admin e outros

AdminBridge (ModuleScript, cerca de 567 linhas). Ponte com o site. Ver 3.9. Os Executores sao o dicionario de comandos que o site pode mandar. Para adicionar um comando novo do painel, cria-se um Executor aqui e o par correspondente no site (D:\T2, whitelist COMANDOS em admin-api.js).

ComandosHandler (ModuleScript, cerca de 785 linhas). Comandos in-game (chat/painel antigo). Convive com o AdminBridge.

ClimaService (Script). Clima e chuva. Ver 3.8. _G.SetClima e a porta; POCAS_PROCEDURAIS liga/desliga as pocas fisicas.

RemotesHandler (ModuleScript, cerca de 5200 linhas). O maior arquivo do jogo. E o roteador central dos remotes do gameplay: recebe ToolAction, Interact, ServerAction e despacha para o comportamento certo (usar item, comer, atirar pela via antiga, algemar, etc.). No inicio do ToolAction ele delega para o ArmaMotor. Por ser gigante, mexa por busca: procure a string da acao (por exemplo o nome do item ou "Atira") para achar o trecho. Adicionar comportamento de item novo costuma ser adicionar um ramo aqui.

PlacementHandler e PlacementData; MarketplaceHandler; TrabalhoHandler; SafeZoneHandler; ChatBridge; ArmasNasCostas; BonecoDeTeste; CaidoClient (no cliente); Realism Mod (Day/Night Cycle e Fall Damage); rotorKitModule (helicoptero/rotor); TiroFXBoot. Sao sistemas de apoio: casas/moveis, compras, trabalho, zona segura, ponte de chat, arma nas costas (cosmetico), boneco de teste de tiro, realismo (ciclo e queda), kit de rotor de helicoptero, e boot dos efeitos de tiro. Alt, CL, head/head.client/head.rules, atributoanimacao sao scripts utilitarios e de HUD de cabecalho.

### 4.6 Cliente — nucleo e HUD (StarterPlayerScripts)

client.Main e Loading (ReplicatedFirst). Ponto de entrada e tela de carregamento.

Client.GuiHandler (ModuleScript, cerca de 2600 linhas). Coordenador da interface. Ver 3.5. Sub-handlers como filhos: BackpackHandler, InventarioHandler, RoupasHandler, CabelosHandler, ClimaHandler (com Chuva e Tela), CraftHandler, MoveisHandler (com PlacementHandler e Properties), Celular (BM, DropaCash, RoZap, SAMU, Uber), BubbleChat, NotificaHandler. O bind SantaFeMouse (shift-lock proprio) mora aqui.

Client.ControllerHandler (ModuleScript, cerca de 2550 linhas). Controles e entrada (teclado/mobile), o maior modulo do cliente depois do GuiHandler.

Client.InteractionHandler (ModuleScript, cerca de 1450 linhas) e a pasta Actions. Interacao com o mundo; cada acao e um modulo em Actions (CNH, CaixaEletronico, Cortar cabelo, Detran, Fianca, PortaMalas, PorteDeArma, PrenderJogador, Seat, VerEmpregos, VerMoveis, VerRoupas, VerVeiculos).

Client.CameraHandler, EnhancedCameraSystem, SensacaoCamera. Camera e sensacao. Ver 3.6. SensacaoCamera desativa o blur dentro de veiculos.

Client.CharacterHandler (e AnimationHandler, Animations, TiltHandler). Animacao e inclinacao do personagem no cliente.

Client.NetworkHandler e NetworkHandler2 (com Functions e Remotes). Fabricas de remotes do lado do cliente.

Client.PortaMalasClient; NotificaHandler; 3DInteractionHandler; ButtonsHandler. Porta-malas no cliente, notificacoes, interacao 3D e botoes.

Client.NoclipFly (LocalScript). Voo/atravessar paredes concedido pelo site. Observa o atributo AdminNoclip do jogador; quando ligado, remove colisao e voa pela camera (WASD, E/espaco sobe, Q/ctrl desce, Shift acelera), velocidade em AdminNoclipVel.

### 4.7 Cliente — armas e itens (familias)

Client.ToolHandler (ModuleScript) e seus filhos. Um modulo por item/arma. As armas migradas sao shims de uma linha (Glock e AK47 tem 3 linhas: return require(script.Parent.ArmaMotor).para("Nome")). O ToolHandler.ArmaMotor (cliente, cerca de 393 linhas) e o motor de arma do lado do cliente (mira, recuo visual, disparo, pedido ao servidor). As dezenas de itens de comida/bebida/uso (Pizza, Hamburguer, Cafe, Doritos, Bandagem, etc.) seguem todos o mesmo padrao de um modulo curto que toca animacao e pede a acao ao servidor; documentar um serve para todos. Para um item consumivel novo, copie o modulo de um item parecido e ajuste nome/animacao/efeito.

Chassis (ReplicatedStorage.Resources.Chassis). Um ModuleScript por carro (230i, AMG, Ambulancia, BMW, Civic, Corolla, Fusca, GolG6, Hilux, HiluxBope, Kombi, Lamborghini, Palio, Prisma, R1200, S10 e variantes, Saveiro, Trailblazer, Trator, Uno, e as viaturas). Quase todos com a mesma estrutura de cerca de 405 linhas: perfil de suspensao, torque, direcao e som daquele veiculo. Para mudar como um carro dirige, e aqui. Sao copias de um padrao com numeros diferentes.

ToolData (ReplicatedStorage.Resources.ToolData, cerca de 714 linhas). Catalogo de todos os itens: peso, icone, categoria e metadados. Quem decide se um item vai para a barra ou fica no inventario (pelo Peso) le daqui. Adicionar item novo ao jogo passa por adicionar uma entrada aqui.

MotorArmas (ReplicatedStorage.Resources.MotorArmas): DriveBy (regra de arma por banco), Regiao, Reacao, Padroes, Ferimento, Cambaleada. Modulos puros de regra de combate, sem tocar em Instance. Sao a base testada das fases de dano.

Roupas (ReplicatedStorage.Resources.Roupas): Camisas, Calcas, Cabelos. Catalogos grandes (Camisas passa de 1200 linhas) que mapeiam nome para asset e genero. As lojas cruzam esses catalogos com o genero do jogador.

### 4.8 Terceiros e padrao da Roblox (nao alterar)

FastCastRedux (Resources.Services.FastCastRedux e filhos): biblioteca de balistica por raycast. Icon (Resources.Services.Icon e a arvore inteira de Elements/Features/Packages): biblioteca de topbar/menu. FractureGlass, PartCache, Signal, Janitor/GoodSignal, t, safeWait, Thread, Number, Instance, RichText, ImageMask: utilitarios de terceiros ou de apoio. PlayerModule, CameraModule (todos os *Camera), ControlModule (todos os *Controller): modulos PADRAO da Roblox de camera e controle. RbxCharacterSounds, WaterAnimator, FreecamScript: padrao/utilitarios. A regra para todos estes: nao editar salvo necessidade tecnica muito clara; sao codigo de fora do jogo.

---

## PARTE 5 — COMO FAZER AS COISAS COMUNS

Dar dinheiro, item ou carro a um jogador. Pelo painel do site (aba do jogador) ou, no codigo, disparando a ordem certa no updateData do DataHandler: SetarDinheiro/IncrementDinheiro para dinheiro, AddInventario para item, CarroAdd para carro. O painel faz exatamente isso via AdminBridge.

Dar para todos. O site tem "dar item/carro para todos" (endpoint dar-todos no admin-api do D:\T2), que enfileira um comando por jogador; para itens, tambem enfileira para offline pegar no proximo login.

Banir e desbanir. Painel: comando ban/unban. No codigo: a ordem Banido do updateData grava no DataStore BanidosDB-CampoBeloRP.2 e expulsa. O DataHandler checa esse DataStore no login.

Resetar o save de um jogador. Comando resetar_dados do painel, que dispara a ordem resetar do updateData (zera dinheiro, inventario, carros, casas, aparencia e libera o perfil). Para wipe de temporada (banco inteiro), o site tem o "wipe geral" na aba Registro.

Ligar ou desligar um sistema. Drive-by inteiro: atributo DriveByV1 em Resources. Chuva: _G.SetClima ou os atributos de clima. Banco da frente: FrenteAtivo (global) ou DBFrente (por carro). Caçamba: DBCacamba nos bancos. Pocas fisicas: POCAS_PROCEDURAIS no ClimaService.

Adicionar uma arma. Ver o cabecalho do ArmasConfig (secao 3.2): modelo em ServerStorage.Tools com Tiro.Fire/Sound/FX, animacoes com os nomes padrao, uma entrada no ArmasConfig, e um shim de uma linha em Client.ToolHandler. O motor (ArmaMotor no servidor e no cliente) cuida do resto.

Adicionar um item consumivel. Entrada no ToolData (peso, icone), modelo em ServerStorage.Tools, um modulo em Client.ToolHandler copiado de um item parecido, e o comportamento no servidor (normalmente um ramo no RemotesHandler).

Adicionar um carro a frota (drive-by e escala). Aplicar escala e os atributos de banco (SemDriveBy/DBFrente/DBCacamba/DBOff) no template (civil, em ServerStorage.Assets.Carros) ou nas instancias (viatura, em workspace.VeiculosGovernamentais). O drive-by e generico (usa acharCarro), entao basta marcar os bancos certos.

Adicionar um comando ao painel. Um Executor novo no AdminBridge (jogo) e a entrada correspondente na whitelist COMANDOS do admin-api.js no site (D:\T2), mais o botao/campo no admin.ejs.

Regra de seguranca ao editar. Antes de mexer num script sensivel (drive-by, combate, save, boot), faca backup: o padrao do projeto e clonar o script para ServerStorage.Backups com sufixo _antes_<coisa>. Depois de qualquer edicao no Studio, Ctrl+S e PUBLISH. Nunca mova um banco de carro lateralmente (X): em cabine estreita os bancos colidem no meio e o drive-by quebra. Nunca confie em GetPivot em runtime nem no primeiro Model acima do banco.

---

Fim do manual. Este documento cobre a arquitetura, as chaves de configuracao, os sistemas por area e um dicionario por script. Os arquivos gigantes (RemotesHandler, GuiHandler, ControllerHandler, InteractionHandler) foram descritos por proposito e organizacao em vez de linha a linha, porque e assim que um dev novo realmente entra neles: pela busca da acao que quer mexer. Se precisar de um capitulo linha a linha de algum desses, da pra expandir sob demanda.
