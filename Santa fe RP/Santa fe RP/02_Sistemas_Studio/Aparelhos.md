---
name: Aparelhos
description: Serviço dono da identidade do celular (uid + número) e da regra "o celular fica ou sai?". Ler ANTES de mexer em dropar, confisco, revista, morte ou wipe do aparelho.
sources: [cowork]
aliases: [identidade do celular, uid do aparelho, aparelho_donos]
---
# Aparelhos — `ServerScriptService.Server.Services.Aparelhos`

Existe porque a regra estava espalhada: uma linha no `Dropa`, outra no confisco, outra no
`ResetaInventario`. Dois caminhos podiam discordar sem ninguém ver — **e discordavam: morrer
apagava o celular**, contra a spec [[Caido_Morte]] ("nunca celular/documentos").

Agora a regra é TABELA e todo caminho pergunta pra ela. Núcleo `Aparelhos.N` é **puro**
(só mexe na tabela `plrData`), testável sem Play.

## A tabela que manda — `Aparelhos.N.MOTIVOS`
| motivo | perde? | retém? | quando |
|---|---|---|---|
| `dropar` | sim | não | largou no chão |
| `pegar` | não | — | pegou do chão |
| `dar` | sim | não | deu pra outro |
| `confisco` | sim | não | polícia tirou na revista (`RemoveInventario`) |
| `revista` | sim | não | roubo/revista que transfere (`RoubarInventario`) |
| `olx` | sim | não | vendeu |
| `portamalas` | sim | não | guardou no porta-malas |
| **`morte`** | **não** | — | **morreu: o celular FICA.** Quem quiser, revista |
| `combatlog` | sim | não | deslogou em combate |
| `reset` | sim | não | perfil resetado |
| `wipe` | sim | **sim** | apagou nas Configs → uid antigo vai pro DataStore de retenção |

## API
- `N.aplicar(plrData, motivo)` → `tirou, uid, reg` — a pergunta central.
- `N.tirar(plrData, uid)` → registro. Se sobrou outro celular no bolso, ele **vira o ativo**.
- `N.por(plrData, uid, numero, criadoEm)` → bool.
- `N.ativo(plrData)` / `N.numero(plrData)` / `N.quantos(plrData)`.
- `N.perde(motivo)` / `N.retem(motivo)` / `N.motivo(nome)`.
- `Aparelhos.novo()` → uid, numero · `Aparelhos.garantir(plrData)` → uid, numero, nasceu
- `Aparelhos.publicar(plr, uid, numero)` → atributos `AparelhoUid` / `AparelhoNumero`.

## Quem chama
- [[DataHandler]]: `AplicarMotivo(plrData, motivo, plr)` no combat log, no reset e no
  `ResetaInventario` (morte); e as ordens `AparelhoSolta` / `AparelhoPega` / `AparelhoWipe`.
- RemotesHandler: já dispara as ordens, agora **com o motivo** (`'confisco'`, `'revista'`).

## Histórico de posse (a aba Rastreio da [[Pericia]])
`SiteCelular.moveu(uid, dePlr, paraPlr, motivo, pos)` → `POST /celular/dono` com campos
extras (`motivo`, `de_roblox_id`, `de_nome`, `pos`, `em`). **É aditivo**: o site de hoje
ignora o que não conhece, então o dado já está chegando desde agora.

> 🔧 **Falta no T2 (Julio):** criar a tabela `aparelho_donos` e fazer `/celular/dono`
> gravar `motivo/de/pos/em` nela. Sem isso o histórico chega e é descartado.
