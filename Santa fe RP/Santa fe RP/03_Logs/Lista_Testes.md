# Lista de Testes (rodar no FIM, com testers)
> Tudo do celular atrás da Chave CelularV2 (tester masternerdtop vê; ou ligar ReplicatedStorage.ChavesValores.CelularV2). Ctrl+S + Publish antes.

## Home / Telas
- [ ] Celular abre INTEIRO na tela (não corta). Grid centralizado ícone+nome, Ajustes no rodapé.
- [ ] Abrir um app esconde o grid+relógio+engrenagem; fechar traz de volta.
- [ ] Cada app abre limpo, nada sobreposto/desalinhado.

## RoZap (mensagens)
- [ ] Lista por foto+nome + bolinha de não-lidas (sem número visível).
- [ ] "+" = Adicionar contato: lista de quem tem celular (mesmo offline), foto+nome.
- [ ] Mandar msg pra outro player online → chega na hora; recebido fechado → bolinha.
- [ ] (2 players + site) histórico carrega ao abrir conversa.

## Banco
- [ ] Aba Transferir: escolher contato, valor, "sem taxa", segurar F → destino recebe valor cheio.
- [ ] Aba Sacar: taxa 2% (mín R$1/máx R$50), "recebe R$Y", segurar F → Banco↓ Dinheiro↑ (v-taxa).
- [ ] Aba Depositar: mesma taxa, Dinheiro↓ Banco↑ (v-taxa).
- [ ] Erros: saldo insuficiente / valor inválido / contato offline. Servidor não deixa negativar.

## Chip + Deepweb
- [ ] Deepweb sem chip → "instalar chip R$3.500" (segurar F, stand-in) → ganha @handle e abre o mural.
- [ ] Mural: posta anônimo, aparece ao vivo; limite 1/2min, 200 chars; feed persiste (site).
- [ ] (Real, depois) chip vira item no vendedor AVendaIlegal3 + instalar no inventário (asset).

## Notas (bloco de notas)
- [ ] Home tem 9 apps; ícone Notas (âmbar) abre a Tela inteira, título "Notas".
- [ ] Sem notas → estado vazio ("Sem notas ainda"). "+" nova nota abre o editor limpo.
- [ ] Escrever título+corpo → após ~2s aparece "Salvo ✓" (auto-save). Voltar (‹) salva e volta pra lista.
- [ ] Nota aparece na lista (título + prévia da 1ª linha); reabrir carrega o texto certo.
- [ ] Relogar → as notas continuam (persistem em Data.Notas). Limite 30 notas / 60 tít / 1000 corpo.
- [ ] Editar nota até ficar vazia (título+corpo) → some da lista ao voltar.

## Identidade do aparelho (uid/número)
- [ ] Dropar/pegar, confisco, morte(fica), wipe(Ajustes) mantêm/movem o número certo.

## Regras (módulo puro) — depois da restauração de 17/09
- [ ] Mochila: relogar 3x seguidas → capacidade fica IGUAL (não sobe de 4 em 4).
- [ ] Vestir/tirar mochila → capacidade +8 / −8, sem acumular.
- [ ] Multar alguém com a tecla M → cobra o valor da infração (não dá erro no output).
- [ ] Multa 2x seguidas no mesmo alvo em menos de 1 min → recusa com "Espere Xs".
- [ ] Multar de longe (>12 studs) → recusa.
- [ ] Sacar R$1 no Banco → conferir se é isso mesmo que a gente quer (hoje cobra R$1 e recebe R$0).

## Identidade do aparelho — o DoD do F2 (2 players)
- [ ] Dropar o A10 e pegar de volta → mesmo número no celular.
- [ ] Outro jogador pega do chão → o número vai junto pra ele; tu fica sem.
- [ ] Polícia revista e leva o A10 → o policial fica com o MESMO número.
- [ ] Polícia confisca (remover do inventário) → some de ti e não vai pra ninguém.
- [ ] **MORRER → o celular FICA.** (Era isto que estava errado.)
- [ ] Morrer, esperar reviver, abrir o celular → mesmo número, mensagens no lugar.
- [ ] Apagar nas Configs (wipe) → número NOVO; o antigo fica retido pra Perícia.
- [ ] Deslogar em combate → perde o celular junto com o inventário.

## Orçamento de HTTP (só dá pra ver com gente)
- [ ] Com o servidor cheio trocando mensagem, transferência de dinheiro continua chegando.
- [ ] Output sem spam de "[Site] orcamento no talo" em uso normal.
