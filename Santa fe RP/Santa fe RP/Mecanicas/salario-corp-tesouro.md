# Salário de corp sai do tesouro do Governo

## Decisões do Julio
- 25/10: Salário que cai do caixa da corp deve descontar do dinheiro do GOVERNO, não da corp ("fizeram errado"). Resposta dele: "Salário sai do tesouro".

## Feito (D:\T2, falta `git push`)
- 25/10: `/corp/salario` (`routes/game-api.js`): corps que NÃO são `empresa` nem `faccao` pagam do tesouro (`governo_config.corporation_id`), motivo `salario_corp`, detalhe {corp_id, corp, cargo, roblox_id, minutos, salario}; `ja_pago` olha os dois lugares; resposta traz `pelo_governo`.
- 25/10: `corp-caixa.js`: tipo `salario_corp` (sinal -1, "Salário de corporação").
- 25/10: `corp-caixa-db.js` `folhaSemana`: corps públicas somam `salario_corp` do tesouro filtrando `detalhe->>'corp_id'`.
- 25/10: Views `corp-manage.ejs` e `governo.ejs` mostram o tipo novo.
- 25/10: `teste_salario_caixa.js` 16/16. Backup `D:\T2\_backup_salgov_2510`.

## Falta
- Repasse semanal ainda "nasce do nada" (não mexido).
- Ler junto: memória `santa-fe-caixa-corp-2`, `santa-fe-governo-tesouro`.
