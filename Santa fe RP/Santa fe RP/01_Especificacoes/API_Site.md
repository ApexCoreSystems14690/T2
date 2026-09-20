# API do Site (/api/game, x-api-key)
- Jogo é o único cliente (jogador nunca fala direto).
- Celular feitos: /celular/registrar|dono|wipe|pericia, **/celular/:uid/donos** (histórico de posse), /celular/aparelhos, /celular/msg/{enviar,conversa,conversas}, /celular/contato(s), /celular/deepweb/{postar,feed,pericia}.
- **OLX feitas (20/09): `/olx/feed`, `/olx/meus`, `/olx/anunciar`, `/olx/comprar`, `/olx/cancelar`, `/olx/devolver`, `/olx/creditos`.**
  `POST /olx/comprar` é o ponto crítico: o `UPDATE ... WHERE status='ativo'` numa transação é o que
  impede dois compradores levarem o mesmo item. Provado com 8 compradores simultâneos: 1 passa, 7 tomam 409.
  O jogo só cobra e entrega DEPOIS do ok — por isso essas chamadas usam `Site.postar` (bloqueante), não o
  `Site.post` fire-and-forget.
- `/celular/deepweb/feed` passou a devolver `idade_seg` (20/09), pra o celular escrever "agora / 7 min / 3 h".
- Planejadas (doc): /celular/:uid/abrir (lote), /celular/lote, /celular/novidades, /jornal/*, /central/*, /pericia/:uid/relatorio.

- 17/09: `POST /celular/dono` aceita campos OPCIONAIS `motivo`, `de_roblox_id`, `de_nome`, `pos`
  e grava em `aparelho_donos`. Chamada antiga (sem motivo) continua valendo e não polui a tabela.
