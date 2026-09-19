---
name: FONTE_Santa_Fe_Funcional
description: FONTE canônica — plano "Santa Fé Funcional" (o QUÊ) na íntegra, 15/09/2026. As notas de 01_Especificacoes são fatias disto. Norte de todo o projeto.
sources: [cowork]
aliases: [Santa Fe Funcional, funcional, o quê]
---
# Santa Fé Funcional (FONTE · 15/09/2026)

> Cópia íntegra do plano enviado pelo Julio. É o NORTE: "nosso resultado tem que ser o que está aqui". As notas atômicas de `01_Especificacoes/` derivam deste doc; em conflito, ESTE manda. Par: [[FONTE_Santa_Fe_Execucao]] (o COMO).

## 1 · Onde estamos (estado hoje)
- Corrigido: Revista/roubo (servidor valida algema/corda/distância/alvo rendido; tela de tempo resolvida). Prateleiras (só compra o que a prateleira vende, ≤12 studs; falta testar Play).
- Seguro sem uso: Multa (servidor ok, nenhuma tela chama).
- Funciona pesado: Craft (Glock ~138 lixeiras; lixo enche mochila).
- Quebrado: Carteiro (campo Local×Value: entrega nunca aparece/paga).
- Não existe→criar: Eletricista (postes falham à noite, escada, sobe e conserta).
- Sem ciclo: Uber (só notifica; corridas com bots depois do celular).
- Bugado: Celular (só lista online, nada salva; OLX/deepweb/X são comandos no chat).
- Ignoradas: Chamadas às corps (caem no rádio e se perdem).
- Pela metade: Colete (só Glock/AK47; crime sem acesso).
- Funciona c/ bug: Mochila (+4kg salvo; soma de novo a cada entrada?).
- Bug: Prisão (pede minutos, conta segundos; preso não vê tempo).

## 2 · A regra do plano — ciclo de 4 partes
Toda mecânica fecha: **Origem** (existe no mapa, alcançável) → **Ação** (gesto claro, segurar F) → **Recompensa** (validada no servidor) → **HUD** (peça que diz em 2s). Falta uma das 4 = não está pronta.

## 3 · Mecânica por mecânica
- Níveis de emprego: Lixeiro/Repositor 1 · Uber 1+carro · Pizzaiolo 2(50xp) · Eletricista 3(150) · Mecânico/Carteiro 5(500).
- **Carteiro:** prefeitura, 12 pontos "Pegar carta", endereço sorteado (18 casas), segurar F 7s. R$77–242 +25XP. Técnico: Carta.Value→Carta.Local; nível 20→5.
- **Uber (com bots, depois do celular):** precisa carro no perfil e estar dirigindo. Chance/min de corrida bot ou jogador. R$20+0,12/stud, bot=prefeitura paga. +10XP.
- **Eletricista (criar):** nível 3, 2º turno noturno. Poste falha com raio, escada aparece, sobe, minigame ponteiro, desce; erro=choque. R$70–150 +14XP/poste. Falha só 18h–6h, sorteio entre 564 postes ParteNeon, 1/3min máx 8. Raio 0,4s. Sobe F 0,5s+~2s; conserta ≤3 studs do topo, 3 acertos erro=−8; pulo travado na escada; escada some após descida/amanhecer. Julio entrega: modelo escada + anims subir/descer.
- **Craft (rebalancear):** tabela de drop nova (Glock ~56 lixeiras ≈30min). Lixeira dá menos "nada" (24%→12%), mais parafuso/cano. Sucata vendável (Papelão R$5, Sucata R$12). Arma só na mesa (2 mesas).
- **Colete polícia/crime (completar):** policial 100 durab (armário grátis); crime 60, desgaste ×1,5 (loja R$8.000 ou craft Tecido×6/Fita×2/Sucata×4/60s). Veste pelo inventário. Barra fina embaixo da vida. PRÉ-REQ: migrar as 12 armas pro ArmaMotor (senão colete só vale contra Glock/AK47).
- **Multa (ligar):** item "Talão de multas" no armário policial. Alvo ≤9 studs, menu flutuante, botões R$250/500/1.000/2.500. Desconta carteira→banco. Mesmo alvo 1/3min. Log no site.
- **Mochila (conserto):** compra R$15.000. +8kg (12→20). Capacidade CALCULADA: base(12+compras) + 8 se vestida. Migração: base = salvo −4 se tinha mochila, 12..22.
- **Prisão (conserto):** botões 2·5·10·20·30 min + motivo. Minutos de verdade. Preso vê "Prisão 04:12 · motivo".

## 4 · Empregos com minigame (civil também tem jogo)
Todo emprego ganha minigame 3–10s, premia bom, nunca pune pesado.
- Eletricista: ponteiro no verde 3× (45°→38°→30°, janela 0,23→0,19→0,15s). Erro −8 vida. Perfeito +25%.
- Lixeiro: arremesso na caçamba (força). 5 seguidos +20%. Repositor: silhueta 8s, sem erro +15%. Pizzaiolo: montar na ordem + ponto do forno, +25%. Mecânico bateria (cabos +/−) e pneu (5 parafusos em estrela), +20%. Carteiro: separar 5 cartas 10s, cada certa +15%. Uber: nota pela direção (5★ gorjeta +30%). Vasculhar lixeira: 3 anéis no ritmo.
- Regras: 3–10s, teclado (mouse solta e trava), erro custa tempo/pouca vida nunca item/dinheiro, cancela se dano/afastar 4 studs/abrir tela, com animação.
- Nível por profissão: +3° verde e +5% pagamento por nível até 5. Ranking semanal no app Notícias + site. Anti-macro: verde aleatório, servidor confere tempo.

## 5 · Sprint do celular (vem ANTES do Uber)
Hoje só lista online, nada salva, OLX/deepweb/X são comandos no chat. Troca por apps de verdade que salvam e funcionam com a pessoa offline.

**Apps (home: relógio topo, grid ícone+nome, Deepweb só com chip, Ajustes traz Configurações):**
| App | O que faz | Substitui |
|---|---|---|
| Mensagens | conversas 1-a-1 e grupos salvos, leitura, "offline" | RoZap (só online) |
| Contatos | quem conversou/adicionou; ver perfil, mandar msg offline | lista online do RoZap |
| Banco | saldo, sacar, depositar, transferir por contato/nº conta | ir no caixa |
| OLX | anunciar item c/ preço, buscar, conversar, compra direta c/ item guardado | /olx no chat |
| Uber | passageiro chama c/ destino+preço; motorista aceita (bot+jogador) | app só notifica |
| Emergência | chamar PM/SAMU/Bombeiros/PC c/ tipo e local auto; ver status | apps BM e SAMU (rádio) |
| Notícias | matérias do Jornal, recentes primeiro | /aviso no chat |
| Navegador | sites decorativos (imobiliária, concessionária, Detran) + site do Jornal | — |
| Mapa | por enquanto "GPS fora do ar" (18/09); tela pronta pra quando a navegação voltar | — |
| Deepweb | mural anônimo + conversas anônimas; só com chip | /deepweb no chat |
| Notas | bloco de notas que salva de verdade, no aparelho | — |
| Câmera·Galeria | 5 fotos reais + 10 prints; enviar pra contato/deepweb | — |
| Ajustes | tema, sons, notificações, reduzir animações | tela Configs sem entrada |

**O celular é um objeto:** cada A10 nasce com número próprio; tudo fica nele (conversas, grupos, contatos, galeria, chip, anúncios). Deu/confiscou = a pessoa/policial abre e está lá. Comprou outro = número novo, vazio. Item ÚNICO com ID que viaja em: dar, dropar/pegar, revista/confisco, porta-malas, OLX, morte. No site tudo liga ao NÚMERO, não à conta.

**Banco pelo celular:** Sacar/Depositar taxa 2% (mín R$1, máx R$50), mostrada ("Taxa R$12 · você recebe R$588"). Transferir aba Contatos (padrão, SEM taxa) ou Nº conta. Mostra nome do dono antes. Confirmar segurando F. Offline recebe no próximo login.

**Fotos:** não dá pra ler pixels. Real: TakeScreenshotCaptureAsync + UploadCaptureAsync (ID no site). 5 fotos/celular; na 6ª avisa e apaga a mais antiga. Outros veem "Enviando…" até liberar. Teste de 1 dia primeiro. Reserva se não liberar: "foto de cena" (salva câmera+pessoas+redesenha). Print do celular = conteúdo da tela redesenhado (leve, perfeito), 10 prints.

**Chip:** item "Chip" R$3.500 SÓ no mercador AVendaIlegal3. Instalar pelo INVENTÁRIO ("Instalar no celular", anim ~2,5s segurando F, precisa do A10). Dá nome anônimo fixo, libera Deepweb. Perde com o celular; revista vê "A10 (com chip)". Julio entrega: modelo do chip + anim.

**Jornal:** só os 3 cargos mais altos publicam (corp Jornal Nacional, permissão publicar_materias). Pelo Navegador→site do Jornal→"Nova matéria". Título 80/texto 2.000/capa da lista de imagens do jogo. Guardadas pra sempre, app mostra 30. Nova = aviso discreto no celular de todos.

**Limites:** DM 200msg/300ch (carrega 50/vez). Grupo 300msg/32 membros/10 grupos. OLX 7 dias/tít40/desc200/5 ativos. Deepweb mural 150/72h/200ch/1 por 2min. Deepweb DM 100msg. Jornal tít80/texto2000/1 por 10min. Chamados 15min na fila/hist 7 dias/120ch/1 aberto por corp. Galeria 5 fotos+10 prints. Notas 30/1000ch/salva 2s. Envio 1/1,5s, 10/15s.

**Onde salvar:** mensagens/grupos/OLX/deepweb/jornal/chamados no Postgres do site. Ao vivo entre servidores: MessagingService só avisa, conteúdo vem do site. Dinheiro/item offline: GlobalUpdates do ProfileService (nunca direto no perfil). Limite ~500 HTTP/min por servidor: celular carrega em lote, guarda em memória.

**OLX offline:** anúncio fica no celular (passa junto). Anunciar tira o item do inventário. Compra direta: comprador paga, recebe na hora; valor vai pro banco do vendedor no login (GlobalUpdate). Vencido (7 dias) devolve o item. Carro só por Detran (não entra em anúncio).

## 6 · Perícia digital (Polícia Civil)
PC em serviço, A10 apreendido, senta no Seat da estação. [F] Colocar celular no dock (anim, tela acende). [F] Sentar (câmera desliza 0,6s). Senha opcional 4 díg = minigame "Sincronizar sinal" (Onda, 60s, tolerância ±0,10→0,06, segurar Espaço 1,2s trava dígito; tempo acaba = bloqueia 1min). Sessão 10min por uid. Abas: Resumo, Mensagens, Deepweb, OLX, Banco, Galeria, Notas, **Rastreio** (mapa de onde saíram as últimas 20 msg — toda msg nasce com pos+rua). Todo acesso registrado (pericia_acessos). "Anexar ao inquérito". Só PC recusa outros cargos. Estações: 2 PainelDeep (~549/563, 48, −933), mesa+2 cadeiras Seat; o feed morto da deepweb sai, entra a perícia. Julio: anim de pôr celular na mesa (reusa a do chip).

## 7 · Central das corporações
Chamado só atendido se tiver alguém no computador. Cidadão: app Emergência→corp+tipo→local auto (workspace.Ruas). Status no celular: Aguardando→Assumido por X→Encerrado; sem atendente "Nenhum atendente agora". Central: computador na base, quem senta vira atendente; fila com tempo, som+desliza no topo. Assumir vira objetivo+ponto no minimapa; pode repassar. Salário: a cada 40min fica 2min na central (buscou=mão, passou=banco), aviso contando. AFK 5min sai. Painel do site: tempo até atender, perdidos, horas vazias. Julio: modelo do computador de cada base.

## 8 · Uber com bots
Chance 35%/min (espera ~2,9min). Recebe: Uber em serviço dirigindo o próprio carro, sem corrida, banco livre. ~30 pontos por tipo; destino 400–1500 studs de outro tipo. Aceitar ≤20s. Bot espera 90s. Embarque ≤12 studs carro parado. Entrega ≤30 studs parado, bot some após 10s. R$20+0,12/stud (1000=R$140), bot prefeitura paga, +20% no prazo. Cancela: fora do carro >30s, carro destruído, bot tomou tiro. Teto 20/h (~R$2.800/h). Bot R6 sorteado, controlado pelo servidor, só aparece perto do motorista, Pathfinding_curto, seat:Sit; dano=foge; não roubável. Julio: ~30 pontos (proponho lendo Ruas) + opcional anims.

## 9 · Minimapa (quadrado) — HOLOGRAMA (atualizado 19/09; decisão do Julio em 18/09)
Seis versões de mapa desenhado não ficaram boas (o mapa foi construído sem nada que diga "aqui é rua"). Saída: parar de interpretar e MOSTRAR o mundo — holograma 3D do entorno; a rua aparece sozinha como o vazio entre os blocos. Quadrado, canto inferior esquerdo, feed termina acima dele; vida/colete = 2 barras finas embaixo. Raio ~110 a pé / ~190 dirigindo, câmera inclinada 55° girando com a do jogador, você = setinha branca. COR = o que é (serviço na cor do serviço, carro âmbar, resto azul); BRILHO/TRANSPARÊNCIA = altura (acima da cabeça vira vidro → vê dentro do prédio). Chão pintado pelo material; meio-fio/poste/faixa desenhados por cima fundem em "rua". Até 3 rótulos de serviço (tags Interact). Objetivo fora do raio = bolinha na borda. Some com tela cheia/caído/algemado. Teste que vale (Julio): "eu me guiaria por isso? sei o que é aquele prédio? sei o que é aquele azul mais forte?" — um "não" reprova. Técnico: GetPartBoundsInBox a cada 0,2s → caixas lisas num WorldModel/ViewportFrame (MeshPart/Union viram caixa), dicionário original→clone incremental, teto 620 caixas (280–500 na prática), luz chapada. Sem asset, sem imagem, sem chave de Game Settings; o MapaModelo assado da cartografia antiga não é usado e sai do ReplicatedStorage. Mapa do celular: por enquanto "GPS fora do ar" (botão e tela prontos). Detalhe: `02_Sistemas_Studio/Minimapa_Holografico.md`.

## 10 · Clareza (regra dos 2s)
Ícone + número + máx 3 palavras, nunca frase. Sempre com unidade (R$, kg, km/h, m, min). Tempo conta pra baixo mm:ss. Cor com 1 significado: tema=você/ação, vermelho=perigo, verde=ganho, azul=aviso. Botão diz o que faz ("Segure F pra entregar"). Nome de gente, não de código. Uma coisa por canto (resto entra na fila).

## 11 · Movimento (Motion)
Nada surge seco. Aparecer 0,22s Quint Out (+8px+fade). Sair 0,16s Quint In (sempre mais rápido). Número conta 0,4s Quad Out (dinheiro passo R$1). Fio/barra 0,3s Quint Out (dano deixa rastro alcança em 0,5s). Crítico 0,3s + 2 pulsos 1,2s Sine (cor muda, pulsa 2×, para). Painel 0,2s (fade grupo + escala 0,98→1). Estado forte 0,5s Sine (vinheta + peças saem antes da nova). Módulo `Resources.Motion` (Aparecer/Sumir/Contar/Critico/Ganho/Trocar); nenhuma HUD usa Visible direto. Painéis em CanvasGroup. Reanima de onde está. "Reduzir animações" = fade 0,1s.

## 12 · Caído e morte
Estados: **Desacordado** 10:00 (queda/fome/tiro em braço-perna; atendimento auto no fim). **Sangrando** 5:00 (tiro no tronco; bandagem para e limite volta pra 10:00 desde a queda, não zera; chance por arma: pistola/sub 30%, revólver 40%, fuzil 55%, espingarda 65%, sniper 70% — hoje só Glock/AK47). **Ferimento grave** 0:40 (tiro na cabeça; só Maleta SAMU salva). **Morte real** (perde 25% carteira + todas armas + item da mão; nunca celular/documentos).
- Bolinha F (anel do tema, sem ProximityPrompt): Estabilizar (bandagem 3s, qualquer um), Reanimar (Maleta SAMU + minigame ritmo, levanta com vida 30), Desistir (após 15s). Caído não vê outra bolinha.
- SAMU paga R$100–400 (prefeitura) só se caído ≥20s, 1×/paciente/10min. Desligar MaletaCura (exploit). Tela de caído segue atributo Morte, não ragdoll.
- **Carregar (novo):** mãos vazias, [F] Carregar 2s (ombro, anda devagar sem correr/pular), [F] Soltar, perto de porta-malas aberto [F] Colocar. Julio: anim ombro + pose deitada.
- **Sequestro (novo):** corda na mão, alvo rendido/algemado/caído. Amarra→carrega→porta-malas; tampa fechada = preso sem arma/item; sai quando abrem/arrombam. Vítima vê tela escura c/ celular liberado (se não confiscado).

## 13 · Ordem
Segurança(feito) → Consertos rápidos → HUD base → **Sprint celular** → Empregos c/ minigame → Polícia/crime → Caído/socorro → Armas no motor → Inventário/craft → **Lobby de servidores**. (HUD antes dos sistemas novos; celular antes do Uber.)

## 14 · O que falta (assets + decisões)
Julio entrega: escada+anims; chip+anim; anim celular na mesa; computador da central; opcional bot acenar; anim carregar+deitado.
Já decidido: tudo no site; jornal só cargos altos; salário na mão na central ou banco após 2min; chip R$3.500 na AVendaIlegal3; taxa 2% avisada (teto R$50); transferir por contato; celular leva tudo e é confiscável; galeria 5 fotos+10 prints; senha opcional 4 díg (PC quebra); caído sangrando 5min / cabeça 40s / bolinha F / morte tira armas+item da mão nunca celular; mesa de perícia = a que já existe (PC que abria deepweb).

## 15 · Lobby / lista de servidores (a tela de entrada) — add. 17/09
O jogo abre num **servidor temporário só do jogador**. Menu decorado (foto de fundo do jogo, botões laterais de filtro Oficial/Não-oficial) listando **UM servidor: o oficial, 100 vagas**. Clicar nele é a única coisa funcional; o resto é decoração de propósito.
- **Por que agora:** acostumar o público com a tela antes de a lista encher. Filtro que aparece vira promessa — só escrever o que vai ser cumprido.
- **Ciclo de 4:** Origem = cai sozinho na antessala · Ação = clica no card · Recompensa = entra na cidade com dinheiro/celular junto · HUD = card com nome, selo Oficial e "47 / 100" (cheio vira "Cheio", não some).
- **Aposta:** deixar gente criar as **próprias cidades** dentro (Discord, corporações, regras) e virar **host**, o que o FiveM é pro GTA — a jogada pra dominar hard RP no Roblox.
- Spec completa, perguntas em aberto e estado do código: [[Lobby_Servidores]]. Execução: F10 em [[FONTE_Santa_Fe_Execucao]].
