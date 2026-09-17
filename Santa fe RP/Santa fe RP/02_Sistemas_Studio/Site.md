---
name: Site
description: A única porta de saída HTTP pro T2 — orçamento de 400 req/min, prioridade e retry. Ler antes de criar qualquer chamada nova pro site.
sources: [cowork]
aliases: [orcamento http, wrapper do site, fila de lote]
---
# Site — `ServerScriptService.Server.Services.Site`

O Roblox corta em **500 requisições HTTP por minuto por servidor**. Antes disso o
[[SiteCelular]] mandava fire-and-forget sem contar nada: 40 jogadores trocando mensagem
estouram o teto, e quando estoura **o que cai é aleatório** — podia ser a transferência
de dinheiro. Núcleo `Site.N` é puro (relógio injetado), testável sem rede.

## Orçamento
- Teto próprio: **400/min** (o do Roblox é 500; a folga é de propósito).
- `alta` usa até 100% · `normal` para em 85% (340) · `baixa` para em 60% (240).
- Passou do limite: `normal` vai pra **fila** (escoa quando a janela vira), `baixa` é **largada** com warn.
- Medido: 500 mensagens num minuto → 340 passam, 160 esperam, e a transferência **ainda passa**.

## Retry
- Repete em: conexão caída, `429`, `5xx`. Não repete em `4xx` (o pedido é que está errado).
- Espera 0,5s → 2s → 5s. Máximo 3 tentativas.

## API
`Site.post(rota, corpo, prioridade)` · `Site.get(rota, prioridade)` (bloqueia) ·
`Site.orcamento()` → sobra, usadas, fila · `Site.estado()` · `Site.iniciar()` (escoador).

## Prioridade de cada chamada hoje
- **alta**: `/celular/registrar`, `/celular/wipe`, `/celular/dono` com histórico.
- **normal**: mensagens, conversas, contatos (GET), aparelhos.
- **baixa**: `/celular/deepweb/postar`, `/celular/contato`.

## Ainda não feito
O plano pede `/celular/lote` (junta escritas e manda a cada 2s ou 25 ops). O endpoint não
existe no T2 ainda — quando existir, é só trocar dentro deste módulo; ninguém mais muda.

## Armadilha já paga
`require(script.Parent...)` quebra nos testes (`loadstring` deixa `script` = nil).
Aqui o `SiteConfig` vem por **caminho inteiro**.
