# Fases (ordem)
- F0 prep → F1 consertos → F2 fundação (Regras/Tema/Motion/Telas/Rede/Aparelhos/tabelas).
- F3 HUD base + F7 armas (juntas) → F4 CELULAR → F5 Perícia + Uber(F6). Eletricista(F6) pode vir antes.
- F8 colete crime + caído/sequestro. F9 inventário/craft.
- F10 lobby de servidores (add. 17/09): tela de entrada + teleporte. Depende de F2+F3, mas pode vir a qualquer momento depois. Ver [[Lobby_Servidores]].
- **NORTE (18/09, Julio):** o Funcional manda no QUÊ e na ORDEM; o Execução é só o COMO. Ordem da seção 13 do Funcional: Segurança → Consertos → HUD base → Sprint celular → Empregos c/ minigame → Polícia/crime → Caído/socorro → Armas no motor → Inventário/craft → Lobby.

## Estado em 19/09 (revisão)
- F0/F1: fechados no Studio (16/09). **Falta o teste do Julio em Play** (carteiro, prisão sobrevivendo a relog, mochila em 3 logins, cúpula, multa com M) — checklist em [[Lista_Testes]].
- F2: fechado (Aparelhos, Site 400/min, Regras remontadas, site T2 em produção). 8/8 testes de identidade em Play.
- **F3 (ATUAL):** feito → feed, objetivo (ligado no carteiro), chips contextuais, minimapa HOLOGRÁFICO (decisão do Julio, substitui a imagem costurada do plano). **Falta:** canto "Você" (vida/fome/sede com contagem animada — `Main.Infos` ainda mostra NaN), tecla **Tab**, fontes/tema, 6 ícones dos chips, decisão da vida duplicada. Tudo atrás de `HUDv2` (só testador vê).
- F4: adiantado pelo Julio antes do F3 — RoZap, Banco, Chip+Deepweb (stand-in), Notas, Contatos, Ajustes, identidade uid. **Falta:** spike da foto de cena (1 dia, nunca rodou), câmera/galeria, OLX de verdade (destrava tirar o `/olx` do chat), Emergência+Central, Notícias/Navegador, chip real, Mapa (hoje "GPS fora do ar"). Ver [[Mapa_Celular]].
- F7: 14 armas no ArmaMotor (18/09). Falta medir o número do colete. Bug "arma não dá dano" (19/09) resolvido — ver [[Log]].
- F8: só planejado (caído continua na versão antiga; a versão nova está parada em `ServerStorage.Backups.Caido2_pronto_nao_aplicado`, NÃO aplicar sem o Julio mandar).
- F10: só spec. `MainService` (com o `Sertex`) mora em `ServerScriptService.Server.Services.MainService`.
- Fora do plano, a favor dele: iluminação (18/09), ruas com nome (18/09), Fusca nativo com porta-malas de verdade (16/09, skill `porta-malas-nativo`).

## Próximo passo (ordem)
1. Julio roda os checklists "Pra ti conferir jogando" da [[Lista_Testes]] e responde as decisões 5.x de [[Entrega_Julio]].
2. Fechar F3: canto "Você" + Tab + tema → ligar `HUDv2` pra todos.
3. F4 no resto: spike da foto → OLX → Emergência+Central → Notícias → chip real → tirar comandos do chat.
