# SF Seguros (carro)
- 24/10: Julio escolheu: quita financiamento + dinheiro; cobrança a cada 72 h no Banco; segue pagando.
- Feito: `Shared.SeguroCore` 3% por 72 h, carência 30 min, indeniza 70% do que foi pago (teste 14/14). `Services.SeguroService`; DataHandler `SeguroSet`; `DesmancheServer` chama `acionar` antes de `CarroRemove`.
- Backup: `Backups_Seguro_2410` (o `_antes` foi reconstruído, backup nasceu atrasado).
- Falta: teste em Play, Ctrl+S + Publish.
