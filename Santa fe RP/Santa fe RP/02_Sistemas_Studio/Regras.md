---
name: Regras
description: Módulo puro de regras do jogo (ReplicatedStorage.Shared.Regras). Ler ANTES de mexer em taxa, mochila, multa, colete, nível, Uber, limites ou minigame.
sources: [cowork]
aliases: [Regras.Taxa, taxa banco, Regras.Multa, Regras.Mochila]
---
# Regras (ModuleScript puro) — `ReplicatedStorage.Shared.Regras`

Sem estado, sem yield, sem Instance — só cálculo. Cliente e servidor batem o mesmo número.
Dá pra rodar fora do Roblox (`loadstring(Source)()`), que é como os testes rodam.

> ⚠️ **NÃO ENCOLHER ESTE MÓDULO.** Em 17/09 ele foi substituído por uma versão só com
> `Taxa` e isso QUEBROU 12 usos de `Regras.Mochila` no [[DataHandler]] e o talão de multa
> no RemotesHandler. Restaurado no mesmo dia (backup da versão curta em
> `ServerStorage.Backups.Regras_do_julio_17_09`). Antes de trocar, rodar o check do fim.

## O que tem dentro
| Campo | Pra quê | Quem usa |
|---|---|---|
| `Taxa` | **filho** `Regras.Taxa` (`--!strict`) — 2%, mín R$1, máx R$50 | Banco (cliente) e [[CelularService]] |
| `Mochila` | `capacidade(base, vestida)` = base+8; `baseMigrada(cap, tinha)`; BASE_MIN 12 / BASE_MAX 22 | [[DataHandler]] (12 usos) |
| `Multa` | `TABELA` de 5 infrações, `valorDe(chave)`, `cobranca(carteira, banco, valor)`, `TETO` 50000, `DISTANCIA` 12, `ESPERA_SEG` 60 | branch `Multar` do RemotesHandler |
| `Nivel` | `nivel(xp)` / `falta(xp)` — 0/120/320/700/1400; `bonusVerde`, `bonusPago` | níveis de profissão |
| `Colete` | `dano(arma, tipo, durab)`, `tirosQueSegura` — policial 100 / crime 60 ×1,5 | F8 |
| `Uber` | `preco(dist)` 20 + 0,12/stud, `bonus`, `nota`, `gorjeta` | F6 |
| `Limites` | todos os números do celular (msgs, notas, fotos, OLX, deepweb…) | celular, site |
| `Minigame` | LCG próprio (`lcg`), `Ponteiro`, `Onda`, `Cartas` — determinístico | F5, F6 |

## Taxa — detalhe em aberto
A versão do filho não tem a guarda de valor pequeno: **sacar R$1 cobra R$1 e você recebe R$0**.
A versão antiga devolvia R$1 (taxa virava 0). Decidir: é assim mesmo ou põe piso?
Sumidouro: a taxa some da economia (não vai pra conta nenhuma) — decisão em aberto.

## Multa — a regra que não se quebra
O cliente manda a **CHAVE** da infração, NUNCA o valor. Quem sabe o preço é a `TABELA`,
lida só no servidor. Mesma lógica dos botões de tempo da prisão.
Infrações: estacionamento 150 · velocidade 400 · semcnh 800 · perturbacao 250 · armailegal 2500.

## Check antes de mexer (cole no Studio)
```lua
local R = require(game.ReplicatedStorage.Shared.Regras)
for _, k in ipairs({"Taxa","Nivel","Colete","Uber","Mochila","Limites","Minigame","Multa"}) do
    assert(R[k], "Regras." .. k .. " SUMIU")
end
```
