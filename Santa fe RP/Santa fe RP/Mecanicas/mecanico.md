# Emprego de Mecânico (carro pra consertar)

Onde mora: ServerScriptService.Server.Services.MecanicaHandler (VeiculosHandler); OficinaUtils.Plataformas; ServerStorage.Backups_Mecanico_1310
Estado: feito (falta testar em jogo)

## Decisões do Julio
- 12/10: Oficina C é só do mecânico ("C só mecânico").

## O que está feito
- 12/10: Reporte da secretaria "Mecânica: não tem carros para trabalhar" (2 reportes, sem foto) medido e consertado sem Play.
- 12/10: Plataforma06-10 (7.11x0.2x15.85, invisíveis, TemCarro=false) na oficina C; Vaga06-10 de tunagem viraram mecânico (backup em Backups_Mecanico_1310.VagasTunagemC_viraramMecanico). O _P ficou com Vaga03-05 (oficina B).
- 12/10: `new` apoia o fundo do carro no topo da plataforma (GetBoundingBox + PivotTo).
- 12/10: Edição do VeiculosHandler foi perdida quando o Studio fechou; refeita e conferida.

## O que falta
- Testar em jogo: mecânico na oficina C pega carro e conserta.
- Julio: Ctrl+S + Publish.

## Armadilhas
- 12/10: Studio fechou e reabriu e perdeu edição não salva (ver Armadilhas.md).
