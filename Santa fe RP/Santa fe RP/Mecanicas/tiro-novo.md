# Sistema de tiro NOVO (refeito do zero, a partir de 29/10)

Onde mora: place dev 75467790232298 (decisão do Julio 29/10)
Histórico do sistema VELHO: memória do Project `santa-fe-armas` e `santa-fe-armas-2` (motor ArmaMotor, FastCast)

## Decisões do Julio
- 29/10: Refazer o sistema de tiro do 0, com mais armas, modelos e animações da Toolbox (ACS etc.) num híbrido de qualidade.
- 29/10: Motivos: tiro que some, não dá pra saber se saiu tiro, efeito que às vezes vai e às vezes não, lag.
- 29/10: Construir na dev 75467790232298.
- 29/10: Apagar o velho JÁ (jogo fica sem tiro até o novo ficar pronto).
- 29/10: Câmera: o jogador escolhe entre 3ª pessoa (ombro) e 1ª pessoa com braços ao mirar.
- 29/10: Armas no lançamento: as 14 atuais + novas da Toolbox.

## Levantamento do velho (medido 29/10, dev)
- 29/10: Servidor: `Server.[Armas] Services.ArmaMotor` (47k) + 14 módulos por arma (AK47, AK47S, Boito, BoitoB, CAR15, CTT40, FAL, Glock, IA2, MP5, MT40, PT92, Revolver, T4) + MiraService + DriveByService (+ _antes_hbblock) + pasta Utils.
- 29/10: Cliente: `Client.ToolHandler.ArmaMotor` (33k) + 14 shims por nome de arma; `TiroFXClient` + `Desenho` (78k); ArmaOmbroSafe, DiagArmaCarro, DriveByAnim, DriveByCamera_antes_mira; `OmbroRepousoServer` no servidor.
- 29/10: Replicated: `Resources.EventoTiro`, `Resources.SonsTiro`, `MotorArmas.BalaVeiculo`, `Resources.ArmasConfig` (dados), libs FastCastRedux e PartCache; remotes `TiroFX` e `Sangue`; entrada do tiro pelo remote genérico `Tool Action` -> `RemotesHandler` linha ~3986 `ArmaMotor.Trata(plr, tool, ...)`.
- 29/10: Tools de arma são só modelo (0 script dentro): Handle, Body, Reciever, Slide, Mag (MeshParts), `Tiro` com Sound + Attachment `Fire` + ParticleEmitter `FX`. Moram em `ServerStorage.Tools` (14), `Resources.Armas` (10) e `Vestuarios.<corp>.Usaveis` (PM, PF, PC, BOPE, CHOQUE, ROTAM).
- 29/10: 76 Animations de arma em `Resources.Assets.Animations` ("Segurando X", "Mirando X", "Atira X", "Carrega X"); 30 sons de recarga/sem munição.
- 29/10: ToolHandler só dá require no módulo se `script:FindFirstChild(nomeDaTool)` existir; sem módulo, a Tool fica sem ação e sem erro.
- 29/10: `Client.ToolHandler.Camera` é a câmera do JORNAL, não é de arma (fica).

## O que o sistema novo TEM que religar (ganchos que o velho chamava no acerto)
- 29/10: SafeZone (`Shared.SafeZone.personagem/protegido`: não atira nem toma tiro na zona).
- 29/10: EscudoBOPE (`interceptar`, `pontoNoEscudo`, `tomarTiro`).
- 29/10: CaidoService (`Acertado`, `ContextoTiro`, `HeadshotLetal`).
- 29/10: EquipamentoService (`Protecao`, `Absorver` — colete/capacete).
- 29/10: FerimentoService (`Registrar`, `Reagir`) + remote `Sangue`.
- 29/10: ArmaRegistro (projétil `BAL_Projetil`) e BalisticaService (tiro saiu -> estojo).
- 29/10: Veículo: vidro quebra, janela blindada (atributos Blindado/LinhaJanela/Furada_<lado>), pneu (`PneuFurado`), HP do carro.
- 29/10: CombatLog (`DataHandler.updateData "SetCombatLog"`), `Seguranca`, atributo `EfeitoRecuo` (Boca/Mira Fina), mobile (`Shared.Entrada`, `Shared.MiraAssistida`), drive-by.
- 29/10: Quem lê `ArmasConfig` por nome (manter caminho e campos `classe`/`Pega`): ArmasNasCostas, SafeZone, BalisticaService, CaixaCorp, MercadoFechado.Produtos, GuiHandler, BackpackHandler, RemotesHandler.
- 29/10: NÃO são do tiro e ficam: CaidoService, FerimentoService, EquipamentoService, SaqueService, PerdaNaMorte, EscudoBOPE, `MotorArmas.Regiao/Ferimento/Reacao/Padroes/Cambaleada/DriveBy`.

## Feito (29/10)
- 29/10: 43 peças do motor velho movidas pra `ServerStorage.Backups_TiroVelho_2910` (cada uma com atributo `CaminhoOriginal`).
- 29/10: `Server.[Armas] Services.ArmaMotor` recriado como PORTA mínima (`Trata` devolve false). Motivo: o RemotesHandler (~linha 3986) faz `pcall(require, ...["[Armas] Services"].ArmaMotor)` em TODO item do Tool Action; o acesso ao `.ArmaMotor` vem ANTES do pcall, então sem ele comida/algema/corda travariam. NÃO APAGAR.
- 29/10: Garimpo em `ServerStorage.Garimpo_Tiro_2910`: kit ACS 2.0.1 de treino (33 armas com Gunmodel + `ACS_Settings` + `ACS_Animations`), DDM4 V7 (ACS), pacote de animação AK (7 KeyframeSequence R6: equip, idle, shoot, reload, Tactical reload, Aim idle, Aim shoot).
- 29/10: Animação do ACS é CÓDIGO (tween de C1 nos braços do viewmodel), não asset — roda no jogo sem ser dono. KeyframeSequence (corpo) precisa o Julio publicar; as 76 animações que o jogo já tem continuam valendo.

## Arquitetura do novo (plano 29/10)
- 29/10: `ArmasConfig` continua sendo a tabela de dados (o resto do jogo lê por nome); armas novas entram nela com campos novos. O MOTOR é que nasce do zero.
- 29/10: Acerto por raio instantâneo no cliente + conferência no servidor com recuo no tempo (histórico das peças de cada personagem ~1 s). Sem bala simulada no servidor (era o que fazia tiro sumir).
- 29/10: Efeito e som do PRÓPRIO tiro saem na hora no cliente de quem atira; os outros recebem por evento não-confiável em lote. Nada de Sound clonado no servidor por tiro.
- 29/10: Quem atira recebe confirmação de acerto (marcador + som) — responde "não dá pra saber se foi tiro".
- 29/10: Remotes próprios em `ReplicatedStorage.TiroRede`, fora do renomeador do NetworkHandler.
- 29/10: Dano reaproveita a cadeia que já existe: `Padroes.Perfil` -> `Regiao.Resolver` -> EquipamentoService -> CaidoService -> FerimentoService, + EscudoBOPE, SafeZone, ArmaRegistro, BalisticaService.

## Construído (29-30/10, dev)
- 29/10: `ReplicatedStorage.Tiro.Nucleo` (matemática pura: perfuração, dispersão, mira retinha 15%, bloom, cone, cadência, recarga por classe, conferência de acerto com recuo no tempo, raspão). Testado 30/30.
- 29/10: `ReplicatedStorage.Tiro.Raio` (raio único cliente/servidor: invisível passa, janela atravessa, vidro blindado segura até furar, palete/chapa fura até 2, carro próprio ignorado). Testado 8/8.
- 29/10: `ReplicatedStorage.Tiro.Sons` = SonsTiro velho inteiro (ids + ganho por arquivo calibrados pelo Julio).
- 29/10: `Server.[Armas] Services.TiroServer` + `ServerScriptService.TiroBoot`. Remotes em `ReplicatedStorage.TiroRede`: Disparo, Recarga, Confirma, FX (não-confiável), Pose (não-confiável). Testado no Edit com jogador falso 11/11 (tiro limpo 100->53, cadência, parede, acerto forjado, palete 60%, cabeça, munição, céu, sem arma).
- 29/10: `StarterPlayerScripts.TiroCliente` (FX, Arma, Viewmodel) + `TiroClienteBoot` + 14 shims em `Client.ToolHandler` apontando pra `TiroCliente.Arma`.
- 29/10: Tecla Z (com arma na mão) troca a câmera da mira: ombro <-> 1ª pessoa com braços. Atributo do jogador `TiroCamera`.
- 30/10: 1ª pessoa conferida por foto (AK, Glock, MP5): massa de mira no centro, braços até empunhadura e guarda-mão; pistola/revólver com a mão de apoio na empunhadura.
- 29/10: Atributo `Mirando` do personagem continua existindo (lido por Animations, DriveByCamera, SensacaoCamera, VaultScript, Hud.N, GuiHandler); servidor replica `Mirando` e `TiroPitch` pros outros.

- 30/10: Bodycam (`TiroCliente.Bodycam`) refeita pelo pedido do Julio: "balanço forte demais, em 3 pessoa é pra ficar tranquilo, meio cinematográfico (...) quase nenhum, o foco deve ser o balanço lento ao atirar, estilo bodycam / Hell Let Loose".
- 30/10: Bodycam agora: tiro empurra um alvo (sobe + escorrega pro lado + inclina) e a câmera vai até ele por mola lenta; segura em rajada, volta devagar ao parar. Passo/peso/respiração quase zero na 3ª pessoa, pouco na 1ª (perfis `B.PERFIL.ombro` / `.primeira`).
- 30/10: Mira: regra por quadro (mira = Q travado ou botão direito apertado ou toque, e não recarregando nem caído). Conserta a mira que ligava sozinha e não soltava.
- 30/10: Play medido (AK, fora da Safe Zone): rajada sobe a câmera ~7,6° e volta ao ponto de partida; 4 acertos confirmados no boneco (100 -> caído 0,1); recarga com R 30/30; Z + Q = 1ª pessoa com braços, arma real escondida, massa de mira no centro da tela.

## Decisões 30/10 (noite) — plano ACS
- 30/10: Julio testou a Bodycam nova e GOSTOU do balanço (fica como está).
- 30/10: "Bodycam de verdade" pro Julio = a arma seguir a câmera com atraso, como se fosse arrastada. Vai só na 1ª pessoa. Bala sempre no centro da tela (opção A; atraso só visual).
- 30/10: Bugs vistos pelo Julio na 1ª pessoa: braços tortos/desencaixados, 2 braços direitos (viewmodel + braço do corpo), mira da arma desencaixada (ponto acima da holográfica). Na 3ª pessoa o personagem fica "durão".
- 30/10: Julio: o ACS de 1ª pessoa tem que ter a mesma qualidade na 3ª pessoa (bonito pra quem vê e pra quem atira).
- 30/10: Julio mandou trocar os modelos nossos por modelos ACS que já funcionam com animação e sintetizar no nosso sistema.
- 30/10: Efeitos que o Julio quer mantidos: esguicho leve de sangue, furar parede fina de material leve, ricochete com chance baixíssima mas real, efeitos de impacto, os sons bons de antes, o "fiuuu" da bala, fumaça/poeira saindo do chão.
- 30/10: Julio mandou parar de ser agêntico demais: fazer só o que ele pede.
- 30/10: Plano aprovado ("crie o plano e execute"): pegar do ACS modelo (AimPart), ficha e animações (código); manter nosso motor (servidor, sons, FX); mesma pose 1P/3P; jogar fora o braço feito na mão; cada arma no ArmasConfig. Piloto com 1 fuzil -> foto -> Julio aprova -> trocar as 14 + novas.

- 30/10: Julio: animações da 3ª pessoa (pose por código) "tão ruins"; usar animação da Toolbox pros 2 casos ou todos, enfileiradas em dummys numa plataforma pra ele publicar.
- 30/10: Plataforma pronta: Workspace.Plataforma_Anims_Tiro (y=600 sobre a origem), 39 dummys R6, 1 animação por dummy (AnimSaves com 1 KeyframeSequence), nome "Arma | anim". Packs: M4 e AK e Glock (Dekkco 109314796158829), AK74 (garimpo), Pistola e Arma (127681676560703). Fontes em ServerStorage.Garimpo_Tiro_2910.

- 30/10: Julio: na 1ª pessoa "tem que ser os braços do nosso boneco" (sem luva/manga do kit ACS) e o braço do boneco aparecia no fundo. Feito: braços do viewmodel = cor da pele + camisa do jogador (0.62x2x0.62); braços e arma reais somem também por Transparency local (o ECS devolvia o LocalTransparencyModifier). Conferido por foto.

## Piloto ACS feito (30/10, dev)
- 30/10: T4 virou o M4A1 do kit ACS 2.0.1 (ServerStorage.Tools, Resources.Armas e Usaveis de PC/PF/CHOQUE/BOPE/ROTAM). Backup em ServerStorage.Backups_ACS_3010.
- 30/10: Dados ACS por arma em ReplicatedStorage.Tiro.ACS.<nome da Tool> (Animacoes + Modelo).
- 30/10: Viewmodel refeito estilo ACS (tudo ancorado, AimPart no olho, arma arrastada por classe). Pose3P = pose da 3ª pessoa por código (provisória até as animações publicadas).
- 30/10: Ricochete raro no FX (1,5%; 8% de raspão em metal/concreto), só efeito, sem dano.

- 30/10: Julio: brilho do impacto forte demais e visível de longe (1 km), e "aparece e some travado". Feito: luz do impacto só até 70 studs da câmera, faísca até 140, clarão do cano até 220; luz apaga em degradê (≥0,12 s); faísca menos brilhante. Backup FX_antes_brilho.

- 30/10: Julio: descanso não pode ficar com a arma apontada (só apontar mirando); mira em 3ª pessoa com o "ads" ficava troncha. Feito: descanso = "M4 | Gun Down", mirando = "M4 | idle", tiro = "M4 | shoot". Foto: descanso com arma baixa.
- 30/10: Julio (substitui "1ª pessoa só ao mirar"): pegou a arma, já fica em 1ª pessoa como no ACS; Z ativa a 3ª pessoa. Feito: TiroCamera padrão = primeira; viewmodel liga no quadril ao equipar (arma com pasta ACS) e mirar só leva a arma ao olho; bolinha da mira some só mirando. Backups Arma/Viewmodel_antes_1Ppadrao.

- 30/10: Julio: idle dos packs da plataforma "HORRÍVEIS" (arma apontada parada); descanso tem que ser arma no peito, braços baixos; sem sistema de subir/baixar arma na rodinha. Feito: pack novo AKMS (Creator Store 74610268482954): descanso = Holister, mirando = Idle, tiro = Fire, recarga = EmptyReload; pose "RootPart" renomeada pra "Handle" nas cópias; motor alinhado com o C0 do pack. Linha AKMS na plataforma. Foto: arma baixa no peito.
- 30/10: Julio: arma na mão = câmera centralizada, mouse travado (Ctrl solta); se estava solto pelo Ctrl antes, entra travado. Feito: Arma.Load força _G.MouseSolto=false e devolve o anterior ao guardar. Medido: LockCenter na 3ª pessoa em descanso.
- 30/10: Julio: mirar na 3ª pessoa = câmera colada atrás do ombro olhando reto (print dele). Feito: zoom 4,5 + offset do ECS Aim enquanto mira; volta a distância de antes ao soltar.

- 30/10: Teste sem publicar: TiroCliente.AnimTeste (RegisterKeyframeSequence, só no Studio), fontes em ReplicatedStorage.Tiro.AnimTeste.<pack>; braços giram pelo pitch da mira (TiroClienteBoot, Stepped).

- 30/10: Julio: na 3ª pessoa "a arma num ângulo, a mira em outro". Feito: TiroClienteBoot aponta os ombros pro ponto que a bolinha mira (raio do centro da câmera) com correção fina pelo cano. Medido: erro cano→alvo 0,0-0,1° olhando reto, pra cima e pra baixo (antes 2,9°).

- 30/10: Julio (substitui "não atira sem mirar" só na 1ª pessoa): em 1ª pessoa dá pra atirar sem mirar (tiro do quadril, dispersão maior do quadril). Na 3ª pessoa continua precisando mirar. Servidor não exige mira.
- 30/10: Pendente: encaixe da T4 na mão só está certo no cliente do dono (C0 do pack AKMS aplicado local); falta pôr o C0 do AKMS no motor T4 do CharacterHandler pra todos verem igual.

- 30/10: Julio: "mirar em 3ª pessoa tá super travado". Medido: o ECS (modo Aim) corta a sensibilidade do mouse pela metade (0,50). Feito: na mira de 3ª pessoa fica 0,80; braços que seguem a mira suavizados e correção do cano mais lenta (0,08). Aguardando o Julio testar.

- 30/10: Julio: ao pegar a arma (1ª pessoa) a cabeça ia mirada pra baixo. Feito: Viewmodel.ligar põe a câmera no olho olhando pro ponto da mira da 3ª pessoa; perto/no chão fica no horizonte. Medido: -15° -> 0°.
- 30/10: Julio: na 3ª pessoa mirando pra baixo os braços ficavam retos. Causas medidas: RightGrip voltava a ligar com a arma na mão (arma presa na solda) e o ajuste no RenderStep era sobrescrito pela animação. Feito: AnimTeste segura RightGrip desligado enquanto a arma está na mão; ajuste dos braços voltou pro Stepped com a conta pura das juntas. Medido: câmera -30/0/+30 -> cano -27/0/+30; tremor girando 0,34°/quadro.

## Falta
- Julio publicar as animações da Plataforma_Anims_Tiro e mandar os IDs; aí trocar a pose por código da 3ª pessoa pelas animações.
- Armas novas da Toolbox (ACS) no ArmasConfig + Tools.
- Teste do caminho do jogador do spawn (pegar arma no armário, sem admin/set) e com 2 jogadores (efeito/som do tiro dos outros).
- Julio sentir a Bodycam nova e dizer se ficou no ponto.
- Pose de drive-by (o DriveByAnim velho saiu junto com o motor).
