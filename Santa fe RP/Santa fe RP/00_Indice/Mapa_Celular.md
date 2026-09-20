---
name: Mapa_Celular
description: Mapa do celular alvo (Santa Fé Funcional) × construído (Studio) × gap. Auditoria de 18/09, revisada 19/09 no DEVTS. Ler pra saber o que falta pro celular ficar "Funcional".
sources: [cowork]
aliases: [mapa celular, gap celular, auditoria celular]
---
# Mapa do Celular — Funcional × Construído (auditoria 18/09, revisada 19/09)

Medido no Studio: `Client.GuiHandler.Celular` (módulos), `StarterGui.Main.Celular.Buttons`
(ícones), `.Telas` (telas) e o bloco CELULAR inline do `GuiHandler` (linhas ~1982–2061).

## Resposta curta: **não, o celular não está pronto.**
10 apps de pé (medido 19/09: DropaCash, RoZap, SAMU, BM, Uber, Banco, Deepweb, Notas, Contatos, Mapa), 3 do plano nem começaram, o Mapa é só "GPS fora do ar", e o sistema de chat antigo continua **ligado e público**.

## Apps — botão × tela × código
| App | Botão | Tela | Código | Estado |
|---|---|---|---|---|
| RoZap (mensagens) | `Rozap` | `RoZap` | módulo 20k | ✅ funciona |
| Banco | ✅ | ✅ | módulo 11k | ✅ funciona |
| Deepweb | ✅ | ✅ | módulo 5.3k | ✅ stand-in |
| Notas | ✅ | ✅ | módulo 5.2k | ✅ funciona |
| Contatos | ✅ | ✅ | módulo 5.3k | ✅ funciona |
| Uber | ✅ | ✅ | módulo 2k | 🟡 legado |
| SAMU | ✅ | ✅ | módulo 1.8k | 🟡 chamado antigo |
| Brigada | `Brigada` | `BM` | módulo `BM` | 🟡 chamado antigo |
| DropaCash | ✅ | ✅ | módulo 2.1k | ⚠️ **não é app** — ver abaixo |
| OLX | ✅ | ✅ | **módulo `Celular.OLX`** (20/09) | ✅ mercado de itens |
| Ajustes | — (abre pelo `Config`) | ✅ | inline no GuiHandler | ✅ funciona |
| **Notícias** | ❌ | ❌ | ❌ | **não existe** (0 menções) |
| **Navegador** | ❌ | ❌ | ❌ | **não existe** (0 menções) |
| Mapa | ✅ | ✅ | módulo 3.5k | 🟡 **"GPS FORA DO AR"** (decisão 18/09) — botão, tela e encaixe prontos; a navegação entra ali quando voltar |
| **Câmera / Galeria** | ❌ | ❌ | ❌ | **não existe** (0 menções a Galeria) |

## Os 10 módulos compilam
Nenhum está quebrado a ponto de não carregar. Isso **não** quer dizer que cada um faz o
que deveria — compilar e funcionar são coisas diferentes.

## DropaCash NÃO é banco (dúvida levantada em 18/09)
Lido o módulo inteiro: ele liga o botão **`Main.Infos.Carteira.DropCash`** da HUD, que
abre uma caixinha pra **dropar dinheiro no chão** (`BCA "DropaDinheiro"`). Só está guardado
dentro da pasta `Celular/` por organização. O app **Banco** (saldo, sacar, depositar,
transferir) é outra coisa. **Não são duplicados.**

## ✅ RESOLVIDO em 20/09 — o `/olx` do chat e a pegadinha da OLX

Era assim: `ChatBridge` registrava `/olx /x /aviso /deepweb` como `TextChatCommand`, o
`RemotesHandler` fazia `ServerAction:FireAllClients("OLXAnuncio", ...)` e o `GuiHandler`
ainda espelhava no chat. A pegadinha anotada aqui era real: o app OLX **só** vivia desse
broadcast, então fechar o comando (feito em 19/09) deixaria o jogo sem OLX nenhuma — foi
exatamente o que aconteceu por um dia.

O que destravou: a OLX virou **mercado de verdade**, como manda o item 1 abaixo.
- Tabelas `olx_anuncios` / `olx_vendas` no T2 (nos DOIS caminhos de migração — `src/index.js`
  e `src/db/migrate.js`, senão não existe em produção).
- Rotas `/olx/{feed,meus,anunciar,comprar,cancelar,devolver,creditos}`.
- O bloco inline do `GuiHandler` saiu e virou o módulo `Celular.OLX` (backup
  `ServerStorage.Backups.GuiHandler_antes_olx`). O `elseif acao == 'OLXAnuncio'` e o
  espelho `AddChatLine("[OLX] ...")` viraram código morto de propósito.
- Anunciar tira o item do inventário; cancelar/vencer devolve; comprar cobra o comprador,
  entrega o item e credita o vendedor (na hora se online, no login dele se offline).

Regra que ficou: **o item só sai de um lugar depois que o outro lado está garantido.**
Perder item some com o trabalho do jogador; duplicar item quebra a economia. Errar pra menos.

## Nomes fora de padrão (funcionam, mas confundem)
- botão `Rozap` ↔ tela e módulo `RoZap` (casing)
- botão `Brigada` ↔ tela e módulo `BM`

## Ordem sugerida pra fechar o Funcional
1. ~~**OLX de verdade** (anunciar item, guardar no anúncio, compra direta)~~ — **FEITO em 20/09.**
   Falta só a parte de item ÚNICO: hoje o anúncio guarda `nome + quantidade`, então uma arma
   com histórico próprio (`ItensUnicos`, que ainda não existe no perfil) perderia a identidade
   ao passar de mão. Enquanto `ItensUnicos` não existir, isso não é regressão — nada no jogo
   tem identidade por item.
2. Mensagens salvas: validar histórico com 2 players — quase pronto.
3. Emergência + [[Central_Corp]]: unificar SAMU/Brigada num app de chamado.
4. Notícias (jornal): app + tabela `jornal_materias`.
5. Câmera/[[Foto_Cena]]: rodar o spike de 1 dia antes de construir (era o dia 1 do F4 no plano e nunca rodou).
6. Chip real + Deepweb DMs.
7. Navegador e Mapa: definir escopo com o Julio (o Mapa hoje é "GPS fora do ar"; o minimapa virou holograma — ver [[Minimapa_Holografico]]).
Depois: [[Pericia]] (F5), que consome tudo isso.
