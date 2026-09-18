---
name: Mapa_Celular
description: Mapa do celular alvo (Santa Fé Funcional) × construído (Studio) × gap. Auditoria de 18/09 medida no Studio. Ler pra saber o que falta pro celular ficar "Funcional".
sources: [cowork]
aliases: [mapa celular, gap celular, auditoria celular]
---
# Mapa do Celular — Funcional × Construído (auditoria 18/09)

Medido no Studio: `Client.GuiHandler.Celular` (módulos), `StarterGui.Main.Celular.Buttons`
(ícones), `.Telas` (telas) e o bloco CELULAR inline do `GuiHandler` (linhas ~1982–2061).

## Resposta curta: **não, o celular não está pronto.**
9 apps de pé, 4 do plano nem começaram, e o sistema de chat antigo continua **ligado e público**.

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
| OLX | ✅ | ✅ | **inline no GuiHandler** | 🟡 só mural |
| Ajustes | — (abre pelo `Config`) | ✅ | inline no GuiHandler | ✅ funciona |
| **Notícias** | ❌ | ❌ | ❌ | **não existe** (0 menções) |
| **Navegador** | ❌ | ❌ | ❌ | **não existe** (0 menções) |
| **Mapa** | ❌ | ❌ | ❌ | **não existe** |
| **Câmera / Galeria** | ❌ | ❌ | ❌ | **não existe** (0 menções a Galeria) |

## Os 9 módulos compilam
Nenhum está quebrado a ponto de não carregar. Isso **não** quer dizer que cada um faz o
que deveria — compilar e funcionar são coisas diferentes.

## DropaCash NÃO é banco (dúvida levantada em 18/09)
Lido o módulo inteiro: ele liga o botão **`Main.Infos.Carteira.DropCash`** da HUD, que
abre uma caixinha pra **dropar dinheiro no chão** (`BCA "DropaDinheiro"`). Só está guardado
dentro da pasta `Celular/` por organização. O app **Banco** (saldo, sacar, depositar,
transferir) é outra coisa. **Não são duplicados.**

## Por que `/olx` ainda aparece pra todo mundo
Dois pedaços, os dois vivos:
1. **`ServerScriptService.ChatBridge`** registra `/olx`, `/x`, `/aviso` e `/deepweb` como
   `TextChatCommand`.
2. **`RemotesHandler`** (linha ~4963) trata o comando e faz:
   ```lua
   ServerAction:FireAllClients("OLXAnuncio", plr.Name, filteredString)
   ```
   **`FireAllClients`** = todo mundo na tela, que é exatamente a queixa.

E o `GuiHandler` linha 2435 ainda **espelha no chat**:
`AddChatLine("[OLX] nome: texto")`.

### A pegadinha: não dá pra simplesmente desligar
O app OLX **não tem anúncio próprio** — ele é um **mural que só mostra o que vem do `/olx`**
(`GuiHandler.AddAnuncioOLX` é alimentado pelo `ServerAction 'OLXAnuncio'`). Tirar o comando
hoje deixaria o jogo **sem OLX nenhum**. Por isso o plano manda tirar `/olx /x /aviso /deepweb`
**só quando o `CelularV2` ligar pra todos** — e pra isso o OLX precisa virar marketplace de verdade.

## Nomes fora de padrão (funcionam, mas confundem)
- botão `Rozap` ↔ tela e módulo `RoZap` (casing)
- botão `Brigada` ↔ tela e módulo `BM`

## Ordem sugerida pra fechar o Funcional
1. **OLX de verdade** (anunciar item, guardar no anúncio, compra direta) — é o que **destrava
   tirar o `/olx` do chat**. Precisa da tabela `olx_anuncios`/`olx_vendas` no T2.
2. Mensagens salvas: validar histórico com 2 players — quase pronto.
3. Emergência + [[Central_Corp]]: unificar SAMU/Brigada num app de chamado.
4. Notícias (jornal): app + tabela `jornal_materias`.
5. Câmera/[[Foto_Cena]]: rodar o spike de 1 dia antes de construir.
6. Chip real + Deepweb DMs.
7. Navegador e Mapa: definir escopo com o Julio (o Mapa depende do [[Minimapa]]).
Depois: [[Pericia]] (F5), que consome tudo isso.
