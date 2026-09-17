# DataHandler (ProfileService)
- Path: `ServerScriptService.Server.Services.DataHandler`. Store CBRP_V1.2.
- updateData (BindableEvent, ordens): Deposito, Saque, Transferencia, TransferenciaCelular(sem taxa), SaqueTaxa/DepositoTaxa(2%), ComprarChip(handle), SalvarNotas, Aparelho{Solta,Pega,Wipe}, IncrementDinheiro...
- requestData (BindableFunction): :Invoke(nome) devolve a Data. SendData:FireClient sincroniza o cliente (_G.Data).
