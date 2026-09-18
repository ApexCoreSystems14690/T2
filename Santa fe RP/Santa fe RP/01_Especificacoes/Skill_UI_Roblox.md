---
name: Skill_UI_Roblox
description: A skill `ui-roblox` — o protocolo de UI no Roblox Studio (medir, clonar, núcleo puro, foto). Ler antes de criar ou alterar qualquer tela, HUD, billboard ou app do celular.
sources: [cowork]
aliases: [skill ui, ui roblox, protocolo de ui, skill de interface]
---
# Skill `ui-roblox`

> Criada em 17/09. É o protocolo de UI do projeto virado skill: em vez de a regra
> ficar espalhada em [[UI_Design_System]], [[UI_Clareza]] e [[UI_Motion]], ela
> carrega sozinha toda vez que o assunto é tela.

## Onde fica
- **Não é arquivo do vault.** É uma skill da conta do Julio, ao lado de
  `o-olho`, `qa-veiculo` e `porta-malas-nativo`.
- Chamada: `/ui-roblox`, ou sozinha quando a tarefa envolve UI.
- Para alterar: pedir a mudança no chat — a skill é reproposta e salva pelo card
  de revisão. **Editar arquivo de skill no disco não muda nada.**

## Quando usa
Criar ou mexer em: HUD, tela cheia, billboard de interação, app do celular,
menu, painel de computador do jogo. Também quando aparecer defeito visual
("tá cortado", "o botão sumiu", "a tecla não bate").

## O que ela manda fazer (resumo)
1. **Consultar o [[_INDEX]] antes** — busca global é proibida e cara.
2. **Medir o que já existe** naquele container antes de criar (foi assim que o
   feed novo não virou um segundo `NotificaHandler`).
3. **Backup** `_antes_<coisa>` em `ServerStorage.Backups`.
4. **Núcleo puro separado do desenho** (`X` + `X.N`), testável por `loadstring`.
5. **Uma tabela, não ifs espalhados** (padrão do [[Aparelhos]]`.N.MOTIVOS` e do
   [[Hud]]`.N.PECAS`).
6. **Clonar template**, só `Scale`, constraints, ZIndex conferido.
7. **Foto obrigatória.** Número não vê cor errada, tecla trocada nem botão fora
   da tela. Sem foto, o veredito é PENDENTE.

## As 9 tendências de erro que ela lista
Constrói do zero em vez de clonar · declara pronto sem olhar · assume que cabe ·
clona e não limpa a herança · duplica o que já existe · escreve frase na HUD ·
encosta índice sem guarda · confia em número do cliente · mede a coisa errada
com confiança.

## Defeitos reais que viraram regra
- Botão do talão com a mesma cor do painel → lia como linha de texto.
- Botão clonado do "Prender" veio com a tecla **Y** desenhada e o código
  escutando **M**.
- 5º botão do billboard caindo fora: 1.000 de escala + 20px de padding dentro de
  156px de altura.
- `Frame.Prende` inexistente na corda matava o `InputBegan` inteiro (X/Q/Z
  paravam junto).
- `Esc` é tecla do Roblox e não chega ao jogo em Play.
- `execute_luau` às vezes cai num datamodel de servidor diferente do jogador →
  plantar script no Edit antes do Play.
