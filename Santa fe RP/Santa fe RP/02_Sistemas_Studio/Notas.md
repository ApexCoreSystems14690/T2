---
name: Notas
description: App Notas do celular (bloco de notas). Ler antes de mexer no editor/lista de notas.
sources: [cowork]
aliases: [bloco de notas, app notas]
---
# Notas — app do celular (atrás de CelularV2)

Bloco de notas do aparelho. Auto-salva. Uma nota = `{ t = titulo, c = corpo }`.

## Dados
- `Data.Notas` (lista de `{t,c}`) no perfil ([[DataTemplate]]). Sincroniza pro cliente via SendData.
- Ordem `SalvarNotas` no [[DataHandler]]: `if type(args[1])=='table' then plrData.Notas = args[1]; SendData:FireClient`.
- Ação `notas_salvar = {"table"}` no [[CelularService]]: sanitiza ≤30 notas, título ≤60, corpo ≤1000; dispara SalvarNotas.

## Cliente — `StarterPlayer...Client.GuiHandler.Celular.Notas`
- Auto-init pelo container Celular (`for c in script:GetChildren() require(c):Init()`).
- `Tela = Cel.Telas.Notas` (clonada da base Deepweb). Abre `UDim2.new(1,0,1.05,0)`.
- Lê `_G.Data.Notas` → `renderLista()` (clona `CardTemplate` → cards `n_i` com Título+Preview da 1ª linha).
- Editor overlay: Título + Corpo (TextBox), "Salvo ✓". Auto-save ~2s (loop checa `dirty`) e no FocusLost/Voltar.
- Nota vazia (título+corpo) some ao salvar. Nova nota entra no topo. Limites espelhados no cliente e no servidor.
- Botões: `Cel.Buttons.Notas` (abre), `Tela.Topo.Fecha` (fecha), `Tela.Nova` (+), `Editor.EdTopo.Voltar` (‹).

## GUI — `StarterGui.Main.Celular`
- `Telas.Notas`: Topo (título+Fecha), Lista (ScrollingFrame + UIListLayout), Card (template), Nova, Vazio, Editor.
- `Buttons.Notas`: 9º ícone (âmbar), LayoutOrder 9.
