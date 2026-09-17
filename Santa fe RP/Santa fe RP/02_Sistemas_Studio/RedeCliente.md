# RedeCliente (ponta cliente do Rede v2)
- Path: `ReplicatedStorage.Shared.RedeCliente`. NOVO.
- `Rede.chamar(area, acao, ...)` (RF, bloqueia) e `Rede.ouvir(area, fn)` (RE <area>Evt).
- Fala com a pasta replicada `ReplicatedStorage.Rede`. Sem limitador (mora no servidor).
