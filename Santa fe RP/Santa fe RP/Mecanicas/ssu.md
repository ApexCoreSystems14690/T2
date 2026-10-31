# SSU (servidor abre/fecha por horário)

Onde mora: `ServerScriptService.Server.Services.SSU` + `Regras.SSU` (núcleo puro); AdminBridge aplica `cfg.ssu` a cada batida; `Seguranca.expulsar` é a única porta de kick.
Estado: feito na place de desenvolvimento; falta publicar

## Decisões do Julio
- 25/10: Cada cidade tem que ter grade PRÓPRIA; o conserto não pode bugar as cidades.
- 25/10: Bug: SSU avisa "vai fechar em X" e nunca fecha.

## O que está feito
- 25/10: `aplicarAjustes` só roda se o JSON mudou e só na cidade oficial.
- 25/10: Aviso agora guardado em `avisados[k]` com chave `tostring(e.sessao.fim)..":"..marco` (não repete e não perde o fechamento).
- 25/10: Grade por cidade: `SSU.GRADES[slug]` (`santa-fe` = grade padrão), `SSU.usarCidade(slug)`; `SSU.ligado()` guarda `temGrade` em cache.
- 25/10: Backup `ServerStorage.Backups.SSU_2410`.

## O que falta
- Publicar a place.
- Fase 2: editar a grade de cada cidade pelo site.

## Armadilhas
- 25/10: Aviso em laço sem fechar → o JSON de ajustes era reaplicado a cada batida e zerava o estado dos avisos → só reaplicar quando mudou.
