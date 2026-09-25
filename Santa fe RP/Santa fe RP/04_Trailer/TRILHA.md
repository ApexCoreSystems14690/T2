---
name: TRILHA
description: Plano de trilha e som do trailer do Santa Fé — curva de tensão por bloco, o que corta o som, som diegético mapeado nos assets reais do jogo, e as referências com licença. Ler junto com ROTEIRO_TRAILER.md.
sources: [cowork]
aliases: [trilha trailer, som do trailer, musica do trailer]
---
# TRILHA — Trailer Santa Fé Roleplay

Nada aqui foi escolhido por "combinar". Cada bloco tem uma **função**; o som vem depois da função.

---

## 1 · O que a concorrência faz (medido)

`[FATO]` Dos 8 trailers BR que inspecionei, **0 creditam a música** — nenhum tem linha de crédito na descrição e nenhum tem metadado de música do YouTube. Estão usando faixa não licenciada.

`[OPINIÃO]` Duas consequências práticas:
1. **Risco real**: Content ID derruba ou monetiza pra terceiro. Um trailer que some do ar duas semanas depois é dinheiro jogado fora.
2. **Oportunidade**: como ninguém licencia, ninguém tem uma **identidade sonora própria**. Todo mundo pega trap/drill ou orquestra épica genérica de banco. O Santa Fé pode ter um som que é dele.

`[LACUNA]` Não consegui as transcrições/áudio dos trailers pra classificar o gênero usado com número. A leitura acima vem das descrições e do que o formato da categoria costuma ser — trate como `[OPINIÃO]`.

---

## 2 · A decisão: quebrar o padrão, e de propósito

O padrão da categoria é **trap/drill BR** ou **orquestra épica de biblioteca**. O Santa Fé quebra.

**A trilha é viola caipira + percussão de chão.**

Por quê, e não é estética gratuita: o mapa **é uma cidade do interior do Paraná**. As ruas se chamam Avenida Paraná, Avenida Astorga, Rodovia do Café, Trevo do Café, Largo da Feira. Trap em cima disso é o mesmo erro de todo servidor que é Los Santos com legenda em português: o som contradiz o lugar. Viola em cima de morro, chuva e giroflex é **desconfortável do jeito certo** — e é o som que nenhum concorrente tem.

A viola não é folclore: é **uma nota longa, com harmônico, sem dedilhado de moda de viola**. Textura, não gênero.

---

## 3 · A curva de tensão

| Bloco | Tempo | Função em uma linha | Andamento |
|---|---|---|---|
| **Abertura** | 0:00–0:26 | Comprar crédito. Não é trailer ainda, é um lugar. | sem pulso |
| **Construção** | 0:26–0:56 | Dizer que tem vida, e que a vida tem rotina. | ~72 BPM |
| **Virada** | 0:56–0:58 | Zerar. | silêncio |
| **Pico** | 0:58–1:19 | Peso, não pressa. | ~96 BPM |
| **Respiro** | 1:19–1:40 | A cidade continua sem você. | volta a ~66 BPM, resolve |

---

## 4 · Bloco a bloco

### Abertura · 0:00–0:26 (P01–P06)
- **Instrumentação:** **nenhuma.** Zero música nos primeiros 26 segundos.
- **O que sustenta:** ambiência diegética pura — vento, gotejar, o caminhão passando, cachorro longe, lona batendo, ônibus, o trânsito do Trevo.
- **O que corta:** o trânsito do P06 sobe e **corta seco** no fim do plano.
- **Por quê:** o trailer genérico começa com o beat no frame 1. Começar em silêncio é o sinal mais barato e mais forte de "isto não é aquilo". E é o que segura os 8 segundos que a missão pede.

### Construção · 0:26–0:56 (P07–P18)
- **Instrumentação:** viola caipira em nota longa com harmônico + **um** bumbo surdo marcando 1 e 3 + baixo acústico entrando só em 0:39 (no plano do Fusca). Nada de hi-hat, nada de sintetizador.
- **Crescimento:** entra fininho no P07, ganha o baixo no P12, cheio no P15 (ambulância), começa a esvaziar no P17.
- **O que corta:** **o toque do celular (P09) corta a trilha por 0,5s.** O silêncio faz o toque virar evento.
- **Por quê:** este bloco existe pra responder "começar é difícil" (10 menções na pesquisa). Som de rotina, não de promessa.

### Virada · 0:56–0:58 (P19)
- **0,6 segundo de preto e silêncio quase total.** Só um resto da cidade sumindo.
- **Por quê:** silêncio antes do pico vale mais que mais uma camada em cima. Nenhum trailer de servidor BR faz isso — todos empilham.

### Pico · 0:58–1:19 (P20–P28)
- **Instrumentação:** a viola **sai**. Entram surdo + caixa seca + um drone grave (contrabaixo em arco, sub). Sem melodia. Sem drop.
- **Crescimento:** sobe camada a camada — P21 (gazua) entra a caixa, P23 (porta-malas) entra o sub, P25 (drive-by) e P26 (giroflex) no cheio, P27 (corrida) no máximo.
- **O que corta:** **a algema (P28) corta a trilha inteira, no clique.** Do clique em diante, só chuva.
- **Por quê:** o pico não é o tiroteio, é a **consequência**. Cortar a música no clique da algema diz "acabou" melhor que qualquer explosão.

### Respiro · 1:19–1:40 (P29–P32)
- **Instrumentação:** chuva sozinha em P29. Em P30, nos últimos 3s, **volta a viola** — o mesmo harmônico da abertura, uma oitava abaixo — e sustenta. Em P31 resolve numa nota só e apaga.
- **O que corta:** nada. Ela **apaga**, não corta.
- **Por quê:** a rima sonora fecha a rima visual (P01 e P30 têm a mesma câmera). É o "a cidade estava aqui antes de você".

---

## 5 · Som diegético — o que já existe no jogo (medido)

`[FATO]` Medido em 21/09 na place real. **Use estes: som do próprio jogo comunica mais autenticidade que biblioteca comprada.**

| Fonte | Asset | Usar em |
|---|---|---|
| `SoundService.CidadeSom` | `rbxassetid://8935604268` | **a ambiência base do trailer inteiro**, por baixo de tudo |
| `SoundService.Passaro` | `rbxassetid://9118752861` | P01, P03, P04 (manhã) |
| `workspace.Motor` | `rbxassetid://2057815938` | P01 (caminhão), P12, P22 |
| `workspace.Buzina` | `rbxassetid://587945238` | P04, P17 (trânsito) |
| `workspace.Tranca` | `rbxassetid://138111999` | P21 (gazua), P23 (porta-malas), P29 (porta da viatura) |
| `SoundService.Molhado` | `rbxassetid://212011266` | **passo em chão molhado** — P03, P20, P24, P27 |
| `SoundService.Concrete` / `Asphalt` | `rbxassetid://277067660` | passo em calçada/asfalto — P14, P27 |
| `SoundService.Metal` | `rbxassetid://177940974` | P12, P13 (oficina), P23 |
| `Assets.Sons.Crafta` | `rbxassetid://7458857878` | P10 (confirmação do OLX) |

`[FATO]` **O que o jogo NÃO tem e vai precisar de biblioteca:** chuva, trovão, sirene de viatura/ambulância isolada, rádio AM, toque de celular, zíper/tecido, parafusadeira, lona, freio a ar de ônibus.
Os 39 sons de `Assets.Sons` são quase todos **recarga de arma e "sem munição"** — não há biblioteca de ambiência no jogo.

`[OPINIÃO]` Isso é um recado além do trailer: o Santa Fé tem pouco design de som. Enquanto o trailer é feito, vale já subir os sons de ambiência pro jogo — assim o trailer soa como o jogo de verdade, em vez de o contrário.

---

## 6 · Referências com licença

**Regra de licenciamento (não negociável):** nada entra no trailer sem licença que permita uso comercial/monetizado em plataforma. Guardar o comprovante (link + data + termos) numa pasta `04_Trailer/licencas/`. Se não der pra guardar comprovante, não usa.

### Música — bibliotecas livres, por ordem de recomendação

| Fonte | Licença | Link | Bom pra |
|---|---|---|---|
| **Free Music Archive** | Creative Commons (varia por faixa — conferir cada uma) | https://freemusicarchive.org/ | viola/acústico brasileiro; filtrar por `CC BY` e gênero `Folk`/`Latin` |
| **Pixabay Music** | Pixabay Content License (uso comercial ok, sem atribuição) | https://pixabay.com/music/ | percussão e drone do bloco C; buscar `brazilian percussion`, `dark drone`, `acoustic guitar tension` |
| **Uppbeat** | grátis com crédito; plano pago sem crédito | https://uppbeat.io/ | limpo de Content ID, que é o ponto fraco dos concorrentes |
| **ccMixter** | CC | http://ccmixter.org/ | stems pra montar em cima |
| **Epidemic Sound / Artlist** | assinatura paga | https://www.epidemicsound.com/ · https://artlist.io/ | se tiver orçamento: resolve licença e qualidade de uma vez |

### Efeito sonoro
| Fonte | Licença | Link |
|---|---|---|
| **Freesound** | CC0 / CC BY (conferir por som) | https://freesound.org/ — buscar `rain on roof`, `brazilian street ambience`, `police siren distant`, `handcuff click`, `car trunk close` |
| **Pixabay SFX** | Pixabay Content License | https://pixabay.com/sound-effects/ |

### O caminho que eu recomendo
`[OPINIÃO]` **Encomendar a trilha.** São ~100 segundos, com uma ideia clara (uma viola, um surdo, um drone) e uma estrutura já escrita neste documento. Isso é um trabalho pequeno pra um músico, sai barato, e entrega a única coisa que biblioteca nenhuma dá: **ninguém mais tem essa faixa.** Num mercado onde 0 de 8 sequer licencia, ter trilha própria já é diferencial de seriedade — que é exatamente a moeda que a pesquisa diz que esse público compra.

---

## 7 · Mixagem — regras curtas

1. **A ambiência do jogo (`CidadeSom`) nunca sai.** Ela fica embaixo de tudo, inclusive embaixo do pico. É ela que costura render de Blender com som de jogo.
2. **Diegético manda no pico.** No bloco C, sirene e motor ficam **acima** da música, não abaixo.
3. **Nenhum efeito de transição de biblioteca** — nada de *whoosh*, *riser* ou *impact*. É a assinatura nº1 do trailer genérico.
4. **Voz: diegética, nunca locução** (decisão de 21/09 — ver seção 8).
5. **Loudness alvo −14 LUFS** (padrão YouTube), pico real −1 dBTP. Não empurrar pra −9: trailer estourado soa amador e o YouTube abaixa de volta.


---

## 8 · VOZ — decisão de 21/09

**Locução narrando o servidor: NÃO.** É o veículo exato do que o público mais odeia. `[FATO]` *"Literalmente vendedores. é sempre 'Somos a melhor que tem'"* — 659 curtidas.

**Voz em personagem, diegética: SIM.** Dois motivos:
1. `[OPINIÃO]` **Áudio não entrega plataforma.** A imagem denuncia Roblox; a voz não. Uma voz brasileira de verdade num plano fechado é o sinal mais barato de "isto é sério" que existe.
2. **Hard RP é falar.** Trailer de RP sem ninguém falando mostra o cenário do roleplay e não mostra o roleplay. Cortar a voz por medo de soar vendedor joga fora junto a coisa que o público compra.

### A regra que separa uma da outra
**Nada de fala limpa entregue pra câmera.** Só **fragmento, meio ouvido, filtrado** — rádio, telefone, distância, chuva por cima. Fala nítida e bem interpretada lê como teatro amador; fala pela metade lê como vida acontecendo.

### As 4 falas do trailer inteiro

| # | Plano | Fala | Tratamento |
|---|---|---|---|
| 1 | **P09** (celular) | um pedaço de voz, indistinguível | abafado dentro do bolso, antes de atender |
| 2 | **P16** (central) | *"...veículo abandonado na Nossa Senhora Aparecida, alguém livre?"* | rádio chiado, banda 300–3.400 Hz, com estática |
| 3 | **P26** (giroflex na viela) | voz de rádio, **sem dar pra entender a palavra** | eco na parede de tijolo, chuva por cima |
| 4 | **P28** (a algema) | ***"mão pra trás"*** | seco, perto, sem música — é a única fala nítida do trailer |

**O suspeito não fala nenhuma vez.** É o que dá peso.

### Casting
`[OPINIÃO]` Sotaque de verdade, não voz de locutor. Duas vozes bastam (o rádio e o PM). A fala 2 e a 3 podem ser a mesma pessoa. Gravar com celular num cômodo pequeno soa mais real que estúdio limpo — a fala 4 é a única que precisa de captação decente, porque é a única nítida.
