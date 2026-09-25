---
name: PESQUISA_PUBLICO
description: Pesquisa medida do público-alvo do trailer do Santa Fé — 71 trailers de servidores BR, 22 descrições, 718 comentários da comunidade BR de GTA RP. O que eles compram, o que eles odeiam, e o que NÃO pode aparecer no trailer. Ler antes de escrever qualquer linha de roteiro.
sources: [cowork]
aliases: [pesquisa trailer, publico trailer, genericao roblox]
---
# Pesquisa de público — trailer do Santa Fé Roleplay
**Data:** 21/09/2026 · **Foco:** comunidade de hard RP **do Brasil** (FiveM/GTA RP, MTA)

---

## 0 · Método (pra você saber o que é medido e o que é chute)

| O quê | Como | n |
|---|---|---|
| Duração dos trailers BR | 12 buscas no YouTube, dedupe por videoId, filtro "é trailer/teaser" + "é BR" + 15s–7min | **71 vídeos** |
| O que os trailers vendem | `ytInitialPlayerResponse` → descrição + keywords dos 22 mais vistos | **22 descrições** |
| O que a comunidade fala | API de comentários do YouTube, 4–6 páginas por vídeo, agregação por regex | **718 comentários** |
| Ritmo de corte | Detector de cena próprio (diff RGB 64×36 por seek de 0,25s), **calibrado no olho** contra uma tira de 48 frames | **1 trailer** |

Tudo abaixo marcado `[FATO]` tem número atrás. `[OPINIÃO]` é minha leitura. `[LACUNA]` é o que eu **não** consegui medir — e digo por quê.

---

## 1 · A descoberta que muda a estratégia

`[FATO]` Varri **431 comentários** em 6 vídeos que são exatamente a conversa da comunidade BR de GTA RP sobre si mesma — *"GTA RP em 2026 é DECEPCIONANTE"* (270 mil views), *"QUAL PIOR SERVIDOR PARA JOGAR NO GTA RP?"* (258 mil), *"5 MELHORES CIDADES DE WL FECHADA"*, *"MTA ou FiveM: a verdade nua e crua"*, *"O QUE É e COMO FUNCIONA O GTA RP"*.

**Menções à palavra "roblox": ZERO.**

`[OPINIÃO]` Isso reposiciona a missão inteira. O briefing parte de *"eles aprenderam a desprezar a plataforma"*. Os dados não mostram desprezo — mostram **ausência**. Roblox não está no vocabulário deles. Não é inimigo, é **ponto cego**.

A diferença é prática:

- Contra **desprezo**, você precisa de 8 segundos de defesa ("olha, não é o que você pensa").
- Contra **ponto cego**, defesa é suicídio: se o trailer começar se explicando, você mesmo levanta o assunto que ninguém levantou. Você precisa de 8 segundos de **reconhecimento** — "isso aí é uma cidade brasileira de RP sério", e a pergunta "em que engine?" chega tarde, depois do interesse.

`[LACUNA]` Não medi o inverso: quantas vezes a palavra "FiveM/GTA" aparece em comentários de vídeos de Roblox RP BR. Dá pra fechar isso em ~5 min se quiser.

---

## 2 · Duração — o número mais firme que eu tenho

`[FATO]` n = **71 trailers de servidores BR** (FiveM, MTA, GTA V).

| | segundos |
|---|---|
| mínimo | 21 |
| p25 | **76** (1:16) |
| **mediana** | **115 (1:55)** |
| média | 122 (2:02) |
| p75 | 151 (2:31) |
| p90 | 213 (3:33) |
| máximo | 290 (4:50) |

| Faixa | Quantos | % |
|---|---|---|
| < 60s | 10 | 14% |
| 60–120s | 26 | **37%** |
| 120–180s | 25 | **35%** |
| ≥ 180s | 10 | 14% |

**Leitura:** `[FATO]` 72% ficam entre 1 e 3 minutos. `[OPINIÃO]` O alvo do Santa Fé é **90–110s** — dentro da norma (ninguém estranha), no lado curto dela (respeita quem já não aguenta mais trailer de servidor). Passar de 2 min só se cada plano estiver pago.

---

## 3 · O que os trailers BR realmente vendem (n=22 descrições)

`[FATO]`

| Sinal | Quantos dos 22 |
|---|---|
| Link de **Discord** | **17** |
| Menciona **whitelist** | 3 |
| Menciona **imersão / regras / RP sério** | **1** |
| Descrição quase vazia (< 120 caracteres) | 5 |

Termos mais frequentes nas descrições/keywords: `nosso` (9), `brasil` (9), `paulo` (8), `cinematic` (7), `instagram` (7), `jogar` (6), `venha` (5), `tema` (5), `melhor` (4).

`[OPINIÃO]` O padrão é **"venha jogar + entra no Discord"**. Quase ninguém vende *regra*, *seriedade* ou *sistema*. Isso é uma **vaga aberta**: o Santa Fé pode ser o trailer que mostra o sistema funcionando em vez de gritar "a melhor cidade". Ver seção 4 — é exatamente o que eles estão cansados de ouvir.

---

## 4 · O que essa comunidade odeia (contagem em 431 comentários)

`[FATO]` Frequência dos temas:

| Tema | Ocorrências |
|---|---|
| **staff / adm / moderação** | **22** |
| whitelist / entrevista | 15 |
| **novato: começar é difícil** | **10** |
| pay-to-win / VIP / loja | 4 |
| powergaming / metagaming | 4 |
| facção / tropa / crime organizado | 4 |
| panela / favorecimento | 3 |
| imersão / realismo | 3 |
| otimização / PC fraco | 2 |
| "só tiro, sem RP" | 1 |

`[FATO]` Comentários mais curtidos, verbatim:

> *"Literalmente vendedores. é sempre 'Somos a melhor que tem'"* — **659 curtidas** ([GTA RP em 2026 é DECEPCIONANTE](https://www.youtube.com/watch?v=la1_sl1ejQ0))

> *"pescoço fino é tão brabo que ele conseguiu criar um roleplay e aonde não tem roleplay"* — **312 curtidas** (mesmo vídeo)

> *"Tentei jogar gta RP prox do fim de 2025. Com menos de 10 minutos de jogo, fui recrutado pra uma fac, e em mais 15 minutos, chegou um polícial perguntando se eu queria trocar tiro"* — **251 curtidas** (mesmo vídeo)

> *"Pra mim são tudo lixo, todos são perfeitos para usar mod menu até o talo"* — **1.000 curtidas** ([QUAL PIOR SERVIDOR](https://www.youtube.com/watch?v=O1oKr_s5Npg))

`[OPINIÃO]` Três regras saem daí, e são mais importantes que qualquer escolha de câmera:

1. **Nunca dizer que é o melhor.** A frase "somos a melhor cidade" tem 659 curtidas de deboche. Zero superlativo no trailer. Zero.
2. **O inimigo declarado não é gráfico — é staff e panela.** O que compra essa gente é prova de *estrutura*: regra que existe, processo que roda, consequência que acontece.
3. **"Começar é difícil" aparece 10×.** Mostrar a porta de entrada (a tela de lobby, o emprego simples, a primeira hora) vale mais que mostrar tiroteio. Tiroteio eles já têm demais — a reclamação de 251 curtidas é literalmente *"só me ofereceram facção e tiro"*.

---

## 5 · Ritmo de corte — o que eu consegui medir

`[FATO]` Medi **1 trailer** frame a frame: *Purge — Cidade Alta RP* (109,3s, 90.914 views).
Método: diff RGB em grade 64×36 amostrada por seek a cada 0,25s; limiar **calibrado no olho** — montei uma tira de 48 frames (18s–30s) e contei os cortes à mão; o limiar 0,08 reproduz a contagem visual, 0,06 dá falso positivo e 0,10 perde corte.

| | valor |
|---|---|
| duração | 109,3s |
| cortes | 46 |
| planos | 47 |
| **duração média de plano (ASL)** | **2,33s** |
| mediana do plano | 1,5s |
| luminância média do trailer | **0,095** (muito escuro) |

`[FATO]` Observação da tira de frames: boa parte da duração são **cartelas de texto branco sobre preto** ("PORQUE UMA VIDA SÓ...", "EM ELDORADO", "SEUS CRIMES"). O trailer alterna imagem ↔ cartela.

`[LACUNA]` **Só medi 1 dos 71.** Medir os outros exigia baixar/reproduzir vídeo um a um, que é caro demais em token pro retorno — foi decisão consciente, não esquecimento. Então: **ASL ≈ 2,3s é um ponto, não uma média da categoria.** Se quiser a média de verdade, o caminho barato é você baixar 5 mp4 e largar numa pasta do `D:\T2` — aí eu rodo `ffmpeg` neles em segundos e fecho o número.

`[LACUNA]` Narração vs. só música: 13 dos 22 vídeos têm legenda automática (indício de voz/letra), mas o endpoint de transcrição do YouTube passou a exigir token e não abriu. **Não sei** dizer quantos usam narração.

---

## 6 · A lista do "GENERICÃO" — o que o trailer NÃO pode ter

Herdado do briefing (decidido antes da pesquisa):

1. Avatar padrão de ombro quadrado, cabeça sorridente, cores saturadas
2. HUD, ícone, botão de loja, qualquer GUI na tela
3. Corte a cada 0,4s no beat de música eletrônica
4. Texto estourando na tela ("NOVO!", "ENTRE JÁ", contagem de likes)
5. Aéreo genérico girando em volta do mapa vazio
6. Emote dançando, qualquer coisa que leia como jogo de criança
7. Iluminação neon chapada (ver `01_Especificacoes/Iluminacao.md`)

**Acrescentado pela pesquisa — cada item com a evidência:**

8. **Qualquer superlativo.** "A melhor cidade", "o servidor mais realista", "a experiência definitiva". — *evidência: 659 curtidas em "Literalmente vendedores"*
9. **Se explicar / se defender.** Nada de "não é o Roblox que você pensa", nada de comparação com FiveM, nada de mostrar o logo do Roblox. — *evidência: 0/431 menções a Roblox; levantar o assunto é criar o problema*
10. **Trailer que é só tiroteio.** Se o corte de ação ocupar mais que ~1/3, você vira exatamente a reclamação de 251 curtidas. — *evidência: "em 15 minutos um policial perguntando se eu queria trocar tiro"*
11. **Cartela de texto explicando a mecânica.** A imagem prova ou não prova; legenda é confissão de que não provou. (O *Purge* usa cartela pesado — funciona pra clima, não pra sistema.)
12. **"Venha jogar" no final.** 17/22 já fazem isso. É ruído. O final tem que ser uma imagem, não um convite.
13. **Mostrar avatar de corpo inteiro parado, de frente, em plano aberto.** É o único enquadramento em que a silhueta R6 entrega a plataforma de graça.

---

## 7 · O que a pesquisa diz que o trailer PRECISA ter

`[OPINIÃO]`, mas amarrado nos números acima:

| Precisa | Por quê (evidência) |
|---|---|
| **90–110s** | mediana BR = 115s; ficar no lado curto da norma |
| **Primeiro frame que lê como "cidade brasileira", não como "jogo"** | ponto cego, não desprezo: ganhar reconhecimento antes da pergunta "qual engine" |
| **Prova de estrutura** (corporação com cargo, processo de prisão, salário, chamado atendido) | staff/adm = 22 menções, a dor nº1 |
| **Porta de entrada visível** (lobby, primeiro emprego) | "começar é difícil" = 10 menções |
| **Ação como tempero, não como prato** | a reclamação de 251 curtidas |
| **Zero UI na tela** | herdado, e é o que mais denuncia plataforma |
| **Silêncio no lugar certo** | o *Purge* é escuro (luma 0,095) e usa pausa; o que cansa é o beat contínuo |
| **Fecho sem convite** | 17/22 terminam vendendo; terminar em imagem é o diferencial barato |

---

## 8 · Fontes

- [GTA RP em 2026 é DECEPCIONANTE](https://www.youtube.com/watch?v=la1_sl1ejQ0) — 270.003 views
- [QUAL PIOR SERVIDOR PARA JOGAR NO GTA RP ??](https://www.youtube.com/watch?v=O1oKr_s5Npg) — 258.404 views
- [O QUE É e COMO FUNCIONA O GTA RP?](https://www.youtube.com/watch?v=FS6aKzA-YYI) — 128.030 views
- [5 MELHORES CIDADES DE WL FECHADA DO GTA RP!!](https://www.youtube.com/watch?v=S7qkKxBCjds) — 28.271 views
- [Qual GTA RP? MTA ou FiveM: A Verdade Nua e Crua](https://www.youtube.com/watch?v=3V91JQFsT0w) — 6.277 views
- [10 MELHORES CIDADES DO GTA RP JULHO DE 2026](https://www.youtube.com/watch?v=dtndCac25Is) — 1.283 views
- [Purge — Cidade Alta RP](https://www.youtube.com/watch?v=MgK7g9W-rK0) — 90.914 views (o trailer medido corte a corte)
- [GTA 5 FIVEM — BRASIL ROLEPLAY (2025) TRAILER OFICIAL](https://www.youtube.com/watch?v=YSu3Xy6-myw) — LOTUS GROUP
- [GTA 5 FIVEM — ALTA RJ (2023) TRAILER OFICIAL](https://www.youtube.com/watch?v=FLy4xcPM80M) — LOTUS GROUP
- [gta rp no roblox é meio estranho](https://www.youtube.com/watch?v=qwE7l9jdBXA) — 3.480.160 views (o lado Roblox; audiência enorme e completamente separada)
