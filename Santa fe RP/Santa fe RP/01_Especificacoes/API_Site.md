# API do Site (/api/game, x-api-key)
- Jogo é o único cliente (jogador nunca fala direto).
- Celular feitos: /celular/registrar|dono|wipe|pericia, **/celular/:uid/donos** (histórico de posse), /celular/aparelhos, /celular/msg/{enviar,conversa,conversas}, /celular/contato(s), /celular/deepweb/{postar,feed,pericia}.
- Planejadas (doc): /celular/:uid/abrir (lote), /celular/lote, /celular/novidades, /olx/*, /jornal/*, /central/*, /pericia/:uid/relatorio.

- 17/09: `POST /celular/dono` aceita campos OPCIONAIS `motivo`, `de_roblox_id`, `de_nome`, `pos`
  e grava em `aparelho_donos`. Chamada antiga (sem motivo) continua valendo e não polui a tabela.
