# Regras de Engenharia
- Servidor manda: dinheiro/item/XP/minigame/mensagem só valem depois que o servidor confere.
- Estado em atributo: HUD lê atributos, nunca pergunta ao servidor a cada frame.
- Regras em módulo puro (sem Instance), testável no luau CLI: tarifa, taxa, nível, janelas.
- Nada novo no RemotesHandler (5.2k linhas): sistemas novos em serviços próprios + Rede v2.
- Limites: HTTP 500/min por servidor (lote+cache), MessagingService só avisa, texto passa por TextService, remote com balde de fichas.
