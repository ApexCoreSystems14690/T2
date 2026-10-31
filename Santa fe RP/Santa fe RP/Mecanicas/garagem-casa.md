# Garagem da casa (vagas + [F] Garagem na tela + rua da favela)

Onde mora:
- Vagas: `workspace.VagasCasa` (58 Parts "Vaga", cada uma com filhos `Spawn` e `PontoGaragem`; atributos `PlotId`, `Indice`, `Casa`)
- Servidor: `ServerScriptService.Server.Services.RemotesHandler`, ramo `SpawnarCarro` (~linha 5813; `vagaDeRua`, `podeUsarGaragem`). Script >200k: só `multi_edit`.
- Cliente: `StarterPlayer.StarterPlayerScripts.Client.GaragemCasa` (LocalScript, ~390 linhas)
- Gancho antigo: `Client.GuiHandler` lê `VagaId` do Adornee de `MainGui.Surfaces.GaragemCarros` (só vale pra concessionária, inofensivo)
Estado: feito no código. NADA provado em Play (só Edit). Falta Ctrl+S + Publish do Julio.

## Decisões do Julio
- 05/10: Perguntou se dá pra spawnar carro na vaga do apê, se a vaga dentro das casas não está bugada e onde o carro spawna.
- 05/10: Ele define 1 exemplo por tipo de casa (menos favela) e eu propago. O exemplo marca ONDE o carro spawna e ONDE se pega o carro (a vaga e o painel), pra ele reposicionar livre.
- 05/10: Favela: o carro spawna SEMPRE na rua mais próxima da casa, sem vaga especificada.
- 05/10: Apartamento: o painel fica DENTRO da casa e o carro spawna lá embaixo (rua). Reprovou o 1º painel ("voce criou um painel feiao, usa igual oque to selecionando") e painel na rua.
- 05/10: Casa e apê ficaram "ótimos"; ele só mexeu na mansão (3 vagas dentro da mansão). Nome "Vaga" repetido não buga com outras.
- 05/10: Tirar os objetos visíveis de exemplo e deixar o mapa limpo pra subir em public.
- 06/10: Painel NÃO é igual ao da concessionária 3D: dentro da casa aparece "[F] Garagem"; a HUD da concessionária abre NA TELA, sem mesh nem nada 3D; escolhe o veículo e ele spawna.
- 06/10: Só o DONO da casa pode usar. Deixar brecha pra um futuro sistema de dividir propriedade.
- 06/10: Ativo com F, sem "safe".

## O que está feito
- 05/10: 58 vagas (13×10×26, Transparency 1, CanCollide false): Apartamento1 6, Casa1 16, CasaCondominio 36 (12×3), CasaFavela 0. 34 plots, 0 índices duplicados, 0 peças visíveis. 58/58 limpas (chão ≤7 studs, nada cruza o volume do carro).
- 05/10: Spawn relativo ao pivô da casa-modelo: CasaCondominio v1 (17.95, 3.68, 114.99) yaw 180; v2 (34.34, 3.68, 114.99); v3 (48.73, 3.78, 114.99); Casa1 v1 (-33.20, 3.89, 0) yaw 90.
- 05/10: Apartamento1 = fila na calçada, Z 1140, X de −252 a −152 (passo 20), y ≈ 40.1, ordenada por (X, Y) do pivô. Offset único não serve: as 6 unidades têm 2 alturas de pivô (64 e 82).
- 05/10: Vaga é identificada por atributos `PlotId`+`Indice`, NÃO por nome. Só filhos DIRETOS de `VagasCasa` contam. Id enviado ao servidor: `"<PlotId>|<Indice>"`; favela: `"<PlotId>|rua"`.
- 05/10: Backups: `ServerStorage.Backups.VagasCasa_antes_propagar0510` (as 65 antigas) e `VagasRemovidas_0510`.
- 06/10: `SpawnarCarro` aceita `|rua`. `vagaDeRua(pid)`: raycast de cima (pivô.Y+35, 85 pra baixo), exige céu aberto (25 acima), eixo da rua por amostras ±7/±14 em 12 ângulos, caixa 8.1×6×12.8 testada com `GetPartsInPart` ignorando peças >60 studs, raios de 10 a 90 studs. Passe 1 só `RuasFavela`; passe 2 qualquer chão firme exceto Telhado/Roof. Medido: 24/24 favelas acham ponto, 40 ms (21 no passe 1, 3 no passe 2).
- 06/10: Servidor confere dono: `podeUsarGaragem(plr, plotId)` = `ImoveisService:donoDe(plotId) == UserId`. Recusa com "Essa garagem não é sua". Backup `RemotesHandler_antes_ruaFavela0610`.
- 06/10: `GaragemCasa`: zero objeto no mundo (sem Part, MeshPart, Interact2). Crachá `[F] Garagem` 180 px acima do fundo (logo acima do `[B] Mobiliar casa`). F por `ContextActionService:BindActionAtPriority(..., 3000)`. Tela = ScreenGui com CLONE de `MainGui.Surfaces.GaragemCarros.Frame` (560×520), "Saldo" vira "Garagem da casa", botão X, clicar fora fecha, lista com selo "NA RUA".
- 06/10: Spawnar → `BCA:InvokeServer("SpawnarCarro", carro, vagaId)`. Vaga = menor `Indice` livre (lê `NaVaga` dos carros em `Mapa(Spot).CarrosSpawnados`). Tudo ocupado → "Todas as vagas da sua casa estão ocupadas".
- 06/10: "Dentro da SUA casa" = mesma regra do Mobiliar: raio 14 pra baixo, casa filha de `workspace.Casas`, `Owner == LocalPlayer.Name`, chão com `Tipo=="Chao"` OU teto da mesma casa a 25 studs.
- 06/10: Julio: "n da para abrir armario por causa do f da garagem". Corrigido: `aoF` devolve `Pass` quando `MainGui.circulo.Visible` e o texto da bolinha tem `[F]`; o crachá some nessa hora. Provado só por compilação + 6 textos de teste.
- 06/10: Brecha de co-proprietário: UMA função por ponta, `podeUsarGaragem` no cliente (`GaragemCasa`) e no `RemotesHandler`. Crescem juntas. O cliente só esconde o botão; quem barra é o servidor.

## O que falta
- Provar em Play: crachá aparece, painel 2D desenha, spawn de ponta a ponta, rua da favela em servidor real, armário abre com F no mesmo quarto.
- O cliente compara `Owner` (NOME) com o jogador; o servidor compara UserId. Quem trocou de nome pode não ver o crachá mesmo sendo dono. Não conferi se o crachá deve usar `OwnerId` (ver memória `santa-fe-imoveis-2`).
- Tela 2D não tem foto possível sem Play (ScreenGui não renderiza no Edit). Ficou sem prova visual.

## Armadilhas
- 05/10: Apê com 3 vagas "SEM CHAO" → 2 alturas de pivô → fila explícita (ver `Armadilhas.md`).
- 06/10: F da garagem matava o F do mundo → Sink em prioridade alta (ver `Armadilhas.md`).
