# CelularService (server)
- Path: `ServerScriptService.Server.Services.CelularService`. Área Rede "Celular".
- Ações: apagar(wipe), enviar/conversa/conversas/contatos/add_contato/donos, transferir(sem taxa), sacar/depositar(2% via [[Regras]].Taxa), comprar_chip, deepweb_postar/deepweb_feed, notas_salvar(≤30 notas/60/1000).
- Usa [[SiteCelular]] + [[DataHandler]] (updateData/requestData). acharPorNumero p/ entrega ao vivo. gerarHandle() @animal_NN.
