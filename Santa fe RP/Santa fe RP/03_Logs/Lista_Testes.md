
## ✅ RODADO EM 17/09 (Play, painel na tela) — 8/8
Dropar+pegar · outro pega · revista · confisco · **morrer (FICA)** · morrer 3x · wipe · combat log.
Falta só a parte que precisa de 2 players de verdade (testes 2 e 3 rodaram a ordem que o 2º jogador recebe).

## Site T2 — quebrado em 17/09
- [ ] `/celular/registrar`, `/celular/aparelhos`, `/celular/contatos`, `/celular/msg/conversas` estão devolvendo **HTTP 500**. Sem isso o celular não carrega histórico nem lista de contatos. Conferir o deploy/Railway.

## ✅ RODADO EM 17/09 (2ª rodada) — as regras novas, 7/8 em Play
Morte: banco intacto (R$20000 → R$20000) · A10 e CNH ficam · Glock vai embora.
Combat log: celular e linha ficam (19 37536-5269) · banco intacto.
Revista: polícia ainda leva o celular · banco intacto.
O 8º ("só o celular sobra no combat log") ficou vermelho por **falha do teste**, não do código:
`requestData` devolve cópia. Provado por outro caminho: `sobrevive(inventário real, 'combatlog')` = `A10`.

## Pra ti conferir jogando
- [ ] Deslogar em combate de propósito → voltar e ver: celular no bolso, número igual, resto perdido.
- [ ] Morrer → celular, CNH e documentos no bolso; armas não; saldo do banco igual.
- [ ] Apertar 1..6 com o inventário aberto → sem erro vermelho no output.
- [ ] Abrir o craft sem selecionar item → sem erro no output.
