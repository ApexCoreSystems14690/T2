# Segurança / anticheat / anti-alt

## Decisões do Julio
- 24/10: Pediu anticheat, anti-alt reforçado e defesa contra Xeno/Infinite Yield/saveinstance (vazamento do "Acn": "vo entra na alt", "vo criar um novo sf").
- 25/10: Desban no site TEM que desbanir no Roblox também.
- 25/10: Falha de entrada (267) e lobby travado tratados como bug prioritário.
- 25/10: Executor sentinel no cliente foi OFERECIDO, ele não respondeu — NÃO construir sem o ok.

## Feito (código pronto, nada vale até publicar place + Lobby e `git push`)
- 25/10: Iscas (`ServerScriptService.Iscas`) criam remotes falsos (GiveMoney, AdminCommand, SetRank, SetMoney, GiveCash, DevPanel). Quem dispara cai em `Seg.isca`: log, depois ban permanente com alts após 120+rand(0..300) s. Em Studio só loga.
- 25/10: `Seguranca.lua` (ServerScriptService.Server.Services): `banRoblox`/`desbanRoblox`; `banir` usa BanAsync (alts incluídos, exceto ban automático de anticheat <=24 h); `desbanir` usa UnbanAsync; `acesso` manda `&idade=AccountAge`.
- 25/10: Laço de desban: a cada 60 s `GET /desbans-roblox` → RemoveAsync no DataStore + UnbanAsync → `POST /desbans-roblox/ok`. Só em servidor de cidade fora do Studio.
- 25/10: AntiCheat novos: noclip (raycast, 2 confirmações), fling (lin>250 ou ang>80), subida_no_ar (3 amostras). Regras em `Seguranca.N.REGRAS`.
- 25/10: `ContaEmpresaServer`: Depositar/Sacar rejeitam NaN, <=0 e >1e9.
- 25/10: Site anti-alt (`src/seguranca.js`): conta_nova_dias 30, discord_min_dias 14; tela em `/seguranca/config` do admin; tabela `game_bans` ganhou `roblox_sync_em`.
- 25/10: Erro 267: `RegistroCidade` reescrito (até 4 tentativas alternando lobby/Santa Fé, espera `ProntoProMenu`); `ReplicatedFirst.IrProMenu` cobre a tela e teleporta pro lobby 14099214532.
- 25/10: Lobby: `StarterPlayerScripts.LobbyUI` corrigido (senha errada travava).
- 25/10: Anúncio de desculpas postado no #avisos (msg 1563709495299940354).

- 31/10: `Seg.banRoblox` retorna sem banir quando `game.PlaceId == 107528339216841` (place de testadores): lá só vale o ban nosso. Editado no place de testadores; backup `ServerStorage.Backups_AntiCheat_2410.Seguranca_antes_testadores_3110`. Falta copiar pra produção e publicar.

## Falta
- Publicar place de produção 78083733455249 e o Lobby; `git push` do site.
- Testar em servidor real: falso positivo de noclip/subida (portas, elevador, trampolim), IrProMenu, RegistroCidade, laço de desban, senha do lobby.
- Conferir se o `/vincular` no jogo corta o código em 12 letras (place estava fechada).
- Varrer remotes do `RemotesHandler` (327 KB) que confiam em valor do cliente.
- Tirar assets/módulos só-de-servidor do ReplicatedStorage.
- Não construído: mais iscas, remotes assinados, sentinel de executor.
- Se o Julio demorar a publicar, reescrever o anúncio do Discord (diz que várias coisas já foram corrigidas).

## Onde mora
- Backups no jogo: `ServerStorage.Backups_AntiCheat_2410`, `Backups_Lobby_2410`, `Backups.RegistroCidade_antes_267_2510`.
- Backups no site: `D:\T2\_backup_anticheat_2410`, `_backup_desban_2510`, `_backup_codigo_2510`, `_backup_link429_2510`.
- Memória do Project: `santa-fe-seguranca`, `santa-fe-kick-antispam`.
