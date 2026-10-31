# Evento Apocalipse — o jogo dentro da place

Onde mora: place 79350872057761 (Studio "Evento de Apocalipse em Santa Fé"); relatório completo no doc do Project `claude/evento-apocalipse-pendente-2510.md`; backups em `ServerStorage.Backups_Evento_2510`.
Estado: feito no Studio, compila; quase nada testado em Play. O Julio publica.
Chave: tudo só liga com `ReplicatedStorage:GetAttribute("ClimaEvento") == "apocalipse"`.

## Decisões do Julio
- 25/10: Morreu → cena de 15 s → volta pro menu da fogueira; itens caem no chão onde caiu; sem hospital e sem curar no hospital.
- 25/10: Menu = cena individual (cada um vê só a si na fogueira); cursor do RP aparece no menu (não é soltar o mouse).
- 25/10: Frases de morte no espírito da dele ("E no fim..... nada daquilo importava, eu só queria ter lhes dado mais um abraço — Ass. Benjamin..."): universais, sobre pessoas/abraço/o que não foi dito; nada de detalhe de objeto ou piada ("parece meme").
- 25/10: Chapéu esconde o cabelo; só chapéu civil na personalização (sem corp).
- 25/10: Sem inclinação do tronco; sem ícone de polícia/salário/emprego; sem minimapa, celular, safezone.
- 25/10: Portas que já eram "forçar" pedem lockpick ou pé de cabra; as normais continuam normais.
- 25/10: Tiro atrai horda que vem CORRENDO, mais forte; arma é conquista lendária; faca e pé de cabra espalhados.
- 25/10: Itens escassos (lockpick, arma, comida, água); lockpick estava "infinito".
- 25/10: Saquear tudo que tem item físico (mercado, prateleira, geladeira...); casas por dentro têm que ter armário, roupa, geladeira.
- 25/10: Craft em qualquer lugar (sem mesa); sistema de fôlego/stamina.
- 25/10: SAMU só dá item médico (bandagem); nada que a SAMU usa.
- 25/10: Vidro quebra com TIRO e explode, igual o jogo normal — reprovou quebrar com F.
- 25/10: Som de zumbi "leve, pesado, rangido, terror imersivo" — o antigo estava estourado e se ouvia de longe.
- 25/10: Cadeiras viradas "cagaram" — desvirar.

## O que está feito
- 25/10: Menu/morte/drop: `ServerScriptService.Server.Services.EventoMenuServer` + `StarterPlayerScripts.EventoMenuClient`; vigia de 1 s manda pra fogueira quem não apertou JOGAR; ao morrer larga tudo e tira a mochila das costas.
- 25/10: Pegar do chão pega o que cabe e deixa o resto com a quantidade certa ("Mochila cheia").
- 25/10: Peso no evento: 6 kg sem mochila, 16 kg com (`Shared.Regras.Mochila.capacidade`); saque que não cabe cai no chão.
- 25/10: Mochila: guarda-roupa/armário 4,8% e casa 9,2% por saque (~13 numa varrida do mapa); achar já veste.
- 25/10: Saque (`Services.VasculharServer` + `Shared.VasculharN`): tipos casa, armario, gaveta, galpao, loja, lixo, mercado, estoque, maquina, hospital, oficina, escritorio; escassez ×0,6 (lockpick ×0,22, arma ×0,5, comida/água ×0,45) e "garantido" só 30% (pode vir vazio).
- 25/10: 853 pontos novos em prateleira/geladeira/balcão/estoque/escritório (atributo `Evento_Saque`) + 153 móveis da toolbox em 47 casas (`workspace.Evento_MoveisCasas`, `Evento_MovelCasa`).
- 25/10: Lockpick no chão: 6 no máx., 1 a cada 4 min, perto de lixeira.
- 25/10: Craft sem mesa (`Resources.Receitas` devolve lista do evento): Bandagem, Faca, Pé de cabra, Lockpick, Lamparina, Máscara, Revolver (90 s).
- 25/10: Zumbis (`Services.ZumbiService`, pose em `StarterPlayerScripts.EventoZumbiPose`): ragdoll + sangue; mordida só com linha livre e mesmo andar.
- 25/10: Horda do tiro: 4 + 2/jogador (máx 10), 75% corredores a 12,5, 180 de vida, mordida 1,5×, nasce a 55–100.
- 25/10: Som do zumbi: gemidos/rosnados graves da Pro Sound Effects normalizados, equalizador, alcance 50/70/32.
- 25/10: Fôlego: `StarterPlayerScripts.EventoStamina` (correr gasta, pulo, golpe; zerou = `SemFolego`, sem correr/pular, respiração pesada).
- 25/10: Vidro: 1.905 painéis `Evento_Janela`; tiro (ArmaMotor `CanPierceFunction`) e golpe sem alvo estouram (`_G.EventoQuebrarJanela`), cacos, barulho 45.
- 25/10: Pé de cabra (toolbox 16941450289) arromba sem gastar e faz barulho; Lamparina (toolbox 3060834159) com luz.
- 25/10: Interior: `Lighting.Ambient` por hora no `EventoCamera` + interior detectado por céu coberto; barra de Lvl escondida.
- 25/10: Celular (A10) sai de todo mundo; safezones guardadas em `ServerStorage.Desligado_Evento_Decor`; minimapa não inicia.
- 25/10: Cápsula de tiro não cai no chão (`BalisticaService.ejetar`).
- 25/10: 556 cadeiras desviradas pro `QA_cfOrig`; 771 cacos de vidro de porta soldados na folha (giram junto).

## O que falta
- Julio: publicar a place do evento (e o Lobby), testar em Play com amigo.
- Ver em Play: menu do amigo, pegar drop com mochila cheia, horda, fôlego, vidro por tiro e por golpe, som do zumbi, móveis das casas.
- 11 casas da favela ficaram sem móvel (sem parede inteira).
- Quebrar vidro com golpe depende do cliente mandar o golpe sem alvo — não confirmado.
