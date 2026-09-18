---
name: Lobby_Servidores
description: O menu de servidores que abre ao entrar no jogo (estilo FiveM) e a aposta de virar HOST de cidades. Ler antes de mexer no MainService, em teleporte ou na tela de entrada.
sources: [cowork]
aliases: [lista de servidores, lobby, menu de entrada, Sertex, host, fivem do roblox]
---
# Lobby de servidores — a tela de entrada

> Decisão do Julio (17/09). O `Sertex` que aparece quebrado no `MainService` é o
> esqueleto de um dev antigo tentando isto — **a ideia é dele, não é lixo**.

## O que é, hoje

O jogador entra no jogo e cai num **servidor temporário só dele**. Aparece um menu
decorado — foto de fundo do jogo, design caprichado, botões laterais de filtro
(Oficial / Não-oficial / etc). Na lista, **um servidor só: o oficial, 100 vagas**.

Clicar nele é **a única coisa funcional do menu**. O resto é decoração de propósito.

## Por que fazer a decoração agora

Pra **acostumar o público com a tela**. Quando a lista encher de verdade, o jogador
já sabe o que ela é e como usa — não é mudança, é a mesma tela que ele sempre viu.

## Aonde isso vai dar (a aposta)

Deixar as pessoas criarem **as próprias cidades** dentro do Santa Fé: cada uma com seu
Discord, suas corporações, suas regras. Ou seja: virar **host**, o que o FiveM é pro GTA.

É essa a jogada pra dominar o hard RP no Roblox — o gargalo lá não é mapa nem script,
é não existir um lugar onde a comunidade monte a própria cidade sem programar.

## O que já existe a favor
- O site T2 já tem **corporações, cargos, membros e usuários ligados por Discord**.
  A lista de cidades é uma tabela a mais nesse banco, não um sistema novo.
- O [[AdminBridge]] já é a ponte jogo ↔ site com `x-api-key`.

## Perguntas em aberto (decidir ANTES de construir)
1. **Uma place ou duas?** O caminho normal é duas no mesmo universo: a place inicial vira
   o lobby (leve, `maxPlayers` baixo, por isso o jogador fica sozinho) e a cidade vira a
   segunda place, com as 100 vagas, alcançada por `TeleportService:TeleportAsync`.
   Isso mexe em publicação, DEVTS e no fluxo de teste — não é mudança pequena.
2. **O perfil atravessa?** ProfileService é por universo, então o save segue o jogador
   entre as places. Confirmar com 2 players antes de confiar.
3. **Cidade futura = reserved server ou place própria?** Reserved server é mais barato e
   escala melhor; place própria dá mais liberdade pro dono. Decide o preço da host.
4. **Filtros do menu**: são só visuais agora, mas os nomes que aparecerem viram promessa.

## Regras que valem quando for construir
- A tela obedece [[UI_Design_System]]: só `Scale`, `UIAspectRatioConstraint` +
  `UISizeConstraint`, `TextScaled`, `UICorner` pequeno, acento do tema do jogador.
- Entra pela pilha [[Telas]] como qualquer outra tela.
- Nada de biblioteca de terceiro: `TeleportService:ReserveServer` + `TeleportAsync` puro.
  Foi depender de um pacote sumido (`Sertex`) que deixou o `MainService` sem carregar.

## Estado do código hoje
`ServerScriptService.Server.Services.MainService` tem a casca (tabela de servidores
`Testing` 10 vagas / `Roleplay` 50, remotes `ServerList` e `Servers`) mas **não carrega**:
faz `require(script["Sertex"])` e o módulo não existe mais. Ninguém chama os remotes,
nenhuma GUI pede a lista, `_G.GameServers` é escrito e nunca lido.
**Não apagar** — é o ponto de partida desta spec. Reescrever quando for a hora.
