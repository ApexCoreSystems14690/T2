# 🧠 CÉREBRO DO JOGO — Santa Fé RP

> Índice mestre. Consulte SEMPRE este arquivo antes de qualquer ação.

## 📖 FONTE (norte do projeto)
- **O QUÊ: `00_Indice/FONTE_Santa_Fe_Funcional.md`** — plano Funcional íntegro.
- **O COMO: `00_Indice/FONTE_Santa_Fe_Execucao.md`** — plano Execução íntegro.
- As notas de `01_/02_` são fatias destes; em conflito, a FONTE manda.

## SEÇÃO A — Protocolo de Auto-Manutenção
1. **Consulta obrigatória:** antes de qualquer ação, ache notas/scripts AQUI. PROIBIDO busca global (list/find/grep/dump).
2. **Auto-correção de caminhos:** achou um caminho errado/mudado? atualize este `_INDEX.md` na hora, sem perguntar.
3. **Auto-atualização:** criou script no Studio ou nota no Obsidian? adicione a linha de mapeamento aqui imediatamente.
4. **Notas atômicas:** nunca notas longas. Cresceu? divide em duas e adiciona as duas ao índice.
5. **Dieta de tokens:** código só via MCP; no chat, 1–2 frases de confirmação; nunca reescrever código no chat.
6. **Sense Check obrigatório:** antes de acionar MCP ou alterar arquivos, rodar a VALIDAÇÃO TÉCNICA E SUBJETIVA abaixo. Falhou em qualquer eixo → PARE (não use ferramentas) e emita o alerta.
7. **Lista de testes:** criou/alterou algo testável? adicione o teste em `03_Logs/Lista_Testes.md` (o que o Julio roda no fim).

### VALIDAÇÃO TÉCNICA E SUBJETIVA (SENSE CHECK) — Lead Dev & Game Designer
Antes de acionar qualquer ferramenta MCP ou alterar arquivos, analise cada pedido sob dois ângulos, considerando todo o contexto e os documentos do jogo:

1. **Análise Técnica:** cheque riscos de exploit no Roblox, problemas de performance, bugs ou arquitetura ruim em Luau.
2. **Análise Subjetiva e Contextual:** avalie se a ideia combina com a proposta, o clima e a essência do jogo (Roleplay / Santa Fé). Questione se a mecânica quebra a imersão, destrói o ritmo, prejudica a economia ou soa "fora de tom" frente aos documentos e ao que já existe.

**PROTOCOLO DE TRAVA E ALERTA:**
Se a ideia falhar na técnica OU não fizer sentido subjetivamente no universo do jogo, PARE IMEDIATAMENTE (não use MCP) e apresente no chat:

- ⚠️ **Visão Crítica:** o furo técnico ou a incoerência subjetiva/temática da ideia.
- 🚨 **Impacto no Jogo:** como afeta a imersão, a economia ou a jogabilidade.
- 💡 **Alternativa de Designer:** solução que atende à intenção mantendo o contexto do jogo impecável.

### Protocolo Obrigatório de Criação de UI
1. **Proibido criar do zero por script:** nunca instanciar UI complexa inteira via código. Clonar template base (ex. `ReplicatedStorage.Templates.BaseFrame`/`BaseButton`) ou usar componentes prontos em `StarterGui`.
2. **Dimensionamento responsivo:** usar estritamente `Scale` `{Scale,0}` em tamanho/posição. `Offset` PROIBIDO em frames/janelas principais.
3. **Restrições obrigatórias:** todo Frame/janela principal deve ter `UIAspectRatioConstraint` + `UISizeConstraint`.
4. **Consulta ao Design System:** antes de criar/alterar qualquer tela, ler `01_Especificacoes/UI_Design_System.md` e aplicar as mesmas fontes, cores e arredondamentos.

## SEÇÃO B — Mapa de Atalhos

### 📋 Especificações (fatiadas)
- Visão geral: `01_Especificacoes/Visao_Geral.md`
- **Design System UI: `01_Especificacoes/UI_Design_System.md`**
- Regras de engenharia: `01_Especificacoes/Regras_Engenharia.md`
- Arquitetura (cliente/servidor/site): `01_Especificacoes/Arquitetura.md`
- Dados no perfil (ProfileService): `01_Especificacoes/Dados_Perfil.md`
- Dados no site (Postgres): `01_Especificacoes/Dados_Site.md`
- API do site (rotas): `01_Especificacoes/API_Site.md`
- Rede v2 (remotes + limitador): `01_Especificacoes/Rede.md`
- Economia (dinheiro, taxa, preços): `01_Especificacoes/Economia.md`
- Mecânicas — ciclo de 4 partes: `01_Especificacoes/Mecanicas_Ciclo.md`
- Empregos e níveis: `01_Especificacoes/Empregos.md`
- Minigames (protocolo): `01_Especificacoes/Minigames.md`
- UI — clareza (2 segundos): `01_Especificacoes/UI_Clareza.md`
- UI — movimento (Motion): `01_Especificacoes/UI_Motion.md`
- Celular — visão dos apps: `01_Especificacoes/Celular_Apps.md`
- App Banco: `01_Especificacoes/Banco.md`
- App Deepweb + Chip: `01_Especificacoes/Deepweb_Chip.md`
- Mensagens/Contatos/Grupos: `01_Especificacoes/Mensagens.md`
- OLX: `01_Especificacoes/OLX.md`
- Foto de cena: `01_Especificacoes/Foto_Cena.md`
- Perícia digital (PC): `01_Especificacoes/Pericia.md`
- Central das corporações: `01_Especificacoes/Central_Corp.md`
- Uber com bots: `01_Especificacoes/Uber_Bots.md`
- Minimapa: `01_Especificacoes/Minimapa.md`
- Caído e morte: `01_Especificacoes/Caido_Morte.md`
- Colete (polícia/crime): `01_Especificacoes/Colete.md`
- Limites de mensagens: `01_Especificacoes/Limites.md`
- Fases (ordem das entregas): `01_Especificacoes/Fases.md`
- Assets que o Julio entrega: `01_Especificacoes/Assets_Julio.md`

### 🛠️ Sistemas (Studio ↔ Obsidian)
- Chaves: `ReplicatedStorage.Shared.Chaves` -> `02_Sistemas_Studio/Chaves.md`
- RedeCliente: `ReplicatedStorage.Shared.RedeCliente` -> `02_Sistemas_Studio/RedeCliente.md`
- Regras (puro): `ReplicatedStorage.Shared.Regras` -> `02_Sistemas_Studio/Regras.md`
- Rede (server): `ServerScriptService.Server.Services.Rede` -> `02_Sistemas_Studio/Rede_Server.md`
- **Aparelhos (identidade do celular): `ServerScriptService.Server.Services.Aparelhos` -> `02_Sistemas_Studio/Aparelhos.md`**
- **Site (orçamento HTTP 400/min): `ServerScriptService.Server.Services.Site` -> `02_Sistemas_Studio/Site.md`**
- CelularService: `ServerScriptService.Server.Services.CelularService` -> `02_Sistemas_Studio/CelularService.md`
- SiteCelular: `ServerScriptService.Server.Services.SiteCelular` -> `02_Sistemas_Studio/SiteCelular.md`
- DataHandler: `ServerScriptService.Server.Services.DataHandler` -> `02_Sistemas_Studio/DataHandler.md`
- DataTemplate: `...DataHandler.DataTemplate` -> `02_Sistemas_Studio/DataTemplate.md`
- RoZap (client): `StarterPlayer...Client.GuiHandler.Celular.RoZap` -> `02_Sistemas_Studio/RoZap.md`
- Banco (client): `...GuiHandler.Celular.Banco` -> `02_Sistemas_Studio/Banco_Client.md`
- Deepweb (client): `...GuiHandler.Celular.Deepweb` -> `02_Sistemas_Studio/Deepweb_Client.md`
- Notas (client): `...GuiHandler.Celular.Notas` -> `02_Sistemas_Studio/Notas.md`
- GuiHandler: `StarterPlayer...Client.GuiHandler` -> `02_Sistemas_Studio/GuiHandler.md`
- Telas (pilha): `StarterPlayer...Client.Telas` -> `02_Sistemas_Studio/Telas.md`
- Celular (GUI): `StarterGui.Main.Celular` -> `02_Sistemas_Studio/Celular_GUI.md`

### 🗺️ Mapa / Auditoria
- Celular alvo×feito×gap: `00_Indice/Mapa_Celular.md`

### 📜 Logs
- Histórico resumido: `03_Logs/Log.md`

### 🌐 Site (fora do Studio)
- Repo: `D:\T2` (Node/Express/Postgres/Railway). Migração: `src/db/migrate.js`. Rotas: `src/routes/game-api.js` (x-api-key).
