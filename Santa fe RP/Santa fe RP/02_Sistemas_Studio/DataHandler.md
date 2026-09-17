# DataHandler (ProfileService)
- Path: `ServerScriptService.Server.Services.DataHandler`. Store CBRP_V1.2.
- updateData (BindableEvent, ordens): Deposito, Saque, Transferencia, TransferenciaCelular(sem taxa), SaqueTaxa/DepositoTaxa(2%), ComprarChip(handle), SalvarNotas, Aparelho{Solta,Pega,Wipe}, IncrementDinheiro...
- requestData (BindableFunction): `:Invoke(nome)` devolve uma **CÓPIA** da Data, não a tabela real.
  MEDIDO 17/09: duas chamadas devolvem tabelas diferentes e escrever na devolvida **não salva nada**.
  Quem precisa mudar o perfil usa `updateData:Fire`. (Varri o jogo: 125 lugares usam requestData, 0 escrevem na cópia — ninguém está com esse bug.)
- SendData:FireClient sincroniza o cliente (_G.Data).
