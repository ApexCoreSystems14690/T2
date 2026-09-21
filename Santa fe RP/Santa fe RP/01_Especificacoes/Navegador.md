---
name: Navegador
description: O NAVEGADOR (internet in-game / "Santa Fe Net") do Santa Fe Roleplay — conceito, decisoes travadas, arquitetura e onde esta sendo construido (place de teste). Ler antes de mexer em navegador, sites in-game, editais de governo, ou no notebook.
---

# Navegador — "Santa Fe Net" (internet in-game)

Ligado a [[santa-fe-celular]], [[santa-fe-painel-cargos]] (corp/cargos no T2), [[santa-fe-economia]].

> STATUS (20/09): protótipo COMPLETO e testado na **place de teste** (não no jogo ainda).
> Place de teste = "Lugar de masternerdtop: 09202026_2" (a Place1 vazia que o Julio marcou com o spawn).
> Falta: integrar no jogo real (trocar stubs pelos serviços reais) e ligar o backend no T2.

## A ideia (decisão do Julio, 20/09)
Um app **Navegador** no cll (e num **notebook** físico) que abre SITES DE VERDADE servidos pelo backend T2.
Serve pra: governo publicar **editais** de corp (adeus formulário — a pessoa clica *Candidatar*), jornal,
páginas pessoais. Publicar e subir foto é **no site T2** (navegador real); o jogo só CONSOME.

### Decisões travadas
- **Imagem = SÓ biblioteca de figurinhas/decais aprovadas** que o jogo traz (Julio: "deixa só a biblioteca
  de fotos mesmo, sem foto de cena"). Ninguém sobe imagem no jogo — escolhe uma chave da lista. Foto real
  fica pra fase futura (exige subir asset pro Roblox + moderação da Roblox; ImageLabel não abre URL qualquer).
- **Quem publica:** governo/edital = só **dono/gerente da corp** (amarra no cargo do T2). Jornal e página
  pessoal = qualquer um, **pago** (taxa de domínio) e **filtrado** (FilterStringAsync).
- **Paywall:** visitante paga X 1x, vai pro dono (Roblox id) pela economia **com a taxa da casa**.
- **Notebook:** só usa **sentado**. Modelo grátis da Toolbox (assetId 749209491) + Seat + ProximityPrompt.

## Arquitetura (3 camadas, igual deepweb/OLX)
1. **T2 (escreve/guarda):** tabelas `sites`/`editais` + páginas no painel + rotas `/net/*` (x-api-key).
   HOJE é um **BackendFalso em memória** na place de teste. Trocar por HTTP depois (só a fonte muda).
2. **Servidor do jogo:** `NetService` (diretorio/abrir/acessar/publicar/candidatar/saldo) + `NavegadorMain`
   (liga o RemoteFunction, debounce). Usa `Modelo` (puro) + Stubs (Economia/Inventario/Corp/PlayerData)
   que COPIAM os contratos reais. **Costura pra produção:** trocar os 6 requires do topo do NetService.
3. **Cliente:** `Estilo` (tokens) + `Renderizador` (blocos→GUI) + `App` (chrome, diretório, paywall, voltar).

### Onde mora (na PLACE DE TESTE)
- `ReplicatedStorage.Navegador`: `Modelo`, `Figurinhas`, `Remotes` (RemoteFunction `Net` + RemoteEvent `NetPush`).
- `ServerScriptService.NavegadorServer`: `NetService`, `BackendFalso`, `NavegadorMain`, `EstacaoServer`, `Stubs.*`.
- `StarterPlayer.StarterPlayerScripts.NavegadorClient`: `Estilo`, `Renderizador`, `App`, `Boot`, `CelularApp`.
- `workspace.EstacaoNotebook`: Mesa + Laptop (749209491) + Cadeira (Seat, tag `NotebookSeat`) + prompt (tag `NotebookPrompt`).
- `ServerStorage.NAVEGADOR_LOG.Progresso`: o log detalhado da construção.

### Modelo de dados
site = `{ dominio, titulo, template, dono_userid, paywall, status, conteudo={blocos} }`.
Blocos: `cabecalho, texto, noticia, imagem, edital, botao, divisor`. Templates: `governo, jornal, pessoal, quest`.
Figurinhas = chave → decal aprovado (ids AINDA vazios = placeholder com o nome; preencher com decais reais).

## Bugs mortos na construção
- Barra de acento do edital com **Scale-Y dentro de pai AutomaticSize** → cartão explodiu (984px). Tag fixa resolveu.
- Texto sumindo: SurfaceGui em **ZIndexBehavior.Global**, texto ZIndex 1 < cartão 2. `novoTexto` agora ZIndex 5.
- Edit **atrasa a rasterização de texto** na bancada: capturar só depois de alguns segundos.

## Portão adversarial (agente) — corrigido, 7 testes verdes
- #2 trava por corp **específica** (gerente de corp de fachada publicava edital de corp alheia).
- #3 governo/quest com **paywall forçado a 0** (era impressora de dinheiro "oficial").
- #8 `lower` do domínio em abrir/acessar/candidatar. #9 cooldown de publicar 10s/jogador. #12 floor do preço.
- Falsos positivos (já tratados): paywall default de taxa, acessar revalida status, userId definido, bloco.titulo.

## Notas de PRODUÇÃO (ao plugar no jogo real)
- Repasse com dono **offline** → precisa fila/mailbox (banco), o stub só acha online. A casa fica com `pw.casa` (sumidouro de propósito).
- Unicidade do domínio tem que ser **atômica** no Postgres do T2 (constraint UNIQUE), igual padrão da OLX.
- Publicar de verdade é **web-side** (T2), foto também. `NetService.publicar` existe pro futuro.
- Texto: trocar o filtro stub por `TextService:FilterStringAsync` por campo.

## Em aberto (decisão do Julio)
- `dono_userid` hoje = publicador. A visão pede **escolher quem recebe** (Roblox id / selecionar usuário).
  Como publicar é web-side, isso vira campo no painel do T2 — habilitar quando for.

## Testes (rodam SEM Play, por loadstring)
- `Modelo._teste()` → 20/20. `Figurinhas._teste()` → 4/4.
- Cenário servidor (NetService com Player falso): 13/13 (diretório, paywall cobrando+repassando, candidatura,
  publicar com trava de corp, taxa de domínio, anti-duplicata).
- Correções adversariais: 7/7.
- UI provada por FOTO na bancada `workspace.QA_NAV` (Home + Governo). **Apagar QA_NAV antes de publicar.**
