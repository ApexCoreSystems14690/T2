---
name: Mapa_Celular
description: Mapa do celular alvo (Santa Fé Funcional) × construído (Studio) × gap. Ler pra saber o que falta pro celular ficar "Funcional".
sources: [cowork]
aliases: [mapa celular, gap celular, auditoria celular]
---
# Mapa do Celular — Funcional × Construído (auditoria 17/09)

Alvo = apps do [[Celular_Apps]] (Santa Fé Funcional). Verificado contra Studio (Buttons/Telas/módulos), site (migrate.js) e specs.

## Apps
| App (Funcional) | No jogo | Status | Falta |
|---|---|---|---|
| Mensagens | Rozap | ✅ feito | histórico persistido (teste 2 players), grupos |
| Contatos | dentro do Rozap ("+") | 🟡 parcial | app próprio (ou decidir manter no Rozap) |
| Banco | Banco | ✅ feito | transferir offline (GlobalUpdate), extrato, Nº conta |
| OLX | OLX | ✅ mural (decisão "fica assim") | marketplace de item (futuro) |
| Uber | Uber | 🟡 legado | fluxo real de chamar corrida |
| Emergência | SAMU+Brigada+DropaCash (separados) | 🟡 divergente | unificar em "Emergência" (chamado→corp+tipo) + [[Central_Corp]] |
| Notícias | — | ❌ falta | app + tabela jornal_materias |
| Navegador | — | ❌ falta | definir escopo (spec fina) |
| Mapa | — | ❌ falta | [[Minimapa]] (nem HUD nem app feitos) |
| Deepweb+Chip | Deepweb | ✅ stand-in | chip real (vendedor+inventário+asset), DMs anônimas 1-a-1 |
| Notas | Notas | ✅ feito | — |
| Câmera/Galeria | — | ❌ falta | [[Foto_Cena]] (pede spike de 1 dia) |
| Ajustes | Ajustes | ✅ feito | reestilizar ícone |

## Veracidade do vault (corrigida nesta auditoria)
- Código estava À FRENTE das notas: Banco saque/depósito e app Notas já no Studio, mas notas diziam "falta". Corrigido: [[Banco]], [[Banco_Client]], [[CelularService]], [[DataHandler]], [[DataTemplate]], [[Celular_GUI]], [[GuiHandler]], [[Fases]].
- Site (migrate.js): tabelas aparelhos/celular_contatos/celular_mensagens/deepweb_posts batem com [[Dados_Site]]. Planejadas (notas/olx/jornal/central/pericia) ainda não.
- Naming: botão "Brigada"↔"BM", "Rozap"↔"RoZap" (casing difere; funciona).

## Ordem sugerida pra fechar o Funcional (F4→F5)
1. Mensagens salvas: validar histórico persistido com 2 players — quase pronto.
2. Emergência + [[Central_Corp]]: consolidar SAMU/Brigada/DropaCash num app de chamado.
3. Notícias (jornal): app simples + tabela.
4. Câmera/[[Foto_Cena]]: rodar o spike de 1 dia (bloqueio técnico) antes de construir.
5. Chip real + Deepweb DMs.
6. Contatos/Navegador/Mapa: definir escopo com o Julio.
Depois: [[Pericia]] (F5), que consome tudo isso.
