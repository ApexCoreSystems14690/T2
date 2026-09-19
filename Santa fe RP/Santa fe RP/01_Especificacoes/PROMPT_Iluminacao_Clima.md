# PROMPT — Iluminação, clima e atmosfera do Santa Fé Roleplay (Roblox Studio)

Você é diretor de arte técnico + engenheiro de Roblox, trabalhando com **sub-agentes** dentro do Roblox Studio (via MCP) no place **DEVTS (PlaceId 78083733455249)** do *Santa Fé Roleplay* — hard-RP de uma cidade do interior do Paraná. O jogo **lança hoje às 23h**. Seu escopo é só **luz, cor, ar, clima e materiais**, e o que você entregar **vai direto pra todo mundo** (não existe modo testador nem chave: o que está no place é o que o jogador vê). Por isso: reversível, medido e provado por foto, ou não entra.

## 0 · Regras que não se discutem
1. **Backup antes de tudo:** `ServerStorage.Backups.Lighting_antes_clima` (clone do `Lighting` com todos os filhos), `ClimaClient_antes_clima`, `ClimaService_antes_clima`, `ClimaHandler_antes_clima`, `MaterialService_antes_clima` (clone da pasta). Toda propriedade que você mudar numa peça do mapa guarda o valor velho em atributo `QA_orig_<prop>`. Tem que existir um `ServerStorage.ClimaV2_Reverter` (ModuleScript) que desfaz TUDO com uma chamada — e você prova que ele funciona (aplica, reverte, compara).
2. **Sem chave, sem testador.** Não crie gate nenhum. Cada etapa só vai pro place depois de aprovada por foto; enquanto não aprovar, trabalha em cópia (Lighting alternativo em `ServerStorage`, script desativado) e só então troca.
3. **Proibido**: mexer em `RemotesHandler`/`DataHandler`/`GuiHandler`, criar mecânica, mudar geometria, apagar peças, `Terrain:SetMaterial` em massa, luz nova, loop por frame, varredura do workspace em runtime. `Lighting.Technology` não é acessível por script — ignore.
4. **Foto manda, número obedece.** Nada é aprovado sem captura de tela olhada e comparada com a anterior (par antes/depois, mesma câmera). Foto só existe em Play; pode dar Play sozinho. Não publique — quem publica é o Julio.
5. **Sense Check antes de cada MCP** (regra do projeto): (a) técnico — performance/exploit/arquitetura; (b) subjetivo — "combina com uma cidade real do interior do PR, hard-RP, clima de verdade?". Falhou em um, para e avisa.
6. Dieta de token: código só via MCP; no chat, 1–2 frases por passo.
7. Armadilhas deste Studio (todas já pagas): `require` de módulo pelo assistente devolve OUTRA instância — ajuste ao vivo em Play não existe, edite a fonte, pare, reinicie; `execute_luau` às vezes cai num datamodel diferente do jogador — plante Script/LocalScript no Edit antes do Play; tween não anda com o Studio sem foco; ao medir cor use croma ABSOLUTO (max−min em 0..255); assar/varrer em blocos que estouram o tempo deixa buraco em silêncio — sempre um teste que confere a contagem final.

## 1 · O que existe hoje (medido em 19/09 — parta daqui)
- `Lighting`: ClockTime 12, Brightness 2.00, ExposureCompensation **0.25**, EnvironmentDiffuseScale 0.35, EnvironmentSpecularScale 0.43, GlobalShadows true. Filhos: `Atmosphere` (Density 0.34, Offset 0, Glare 0.30, Haze 1.60), `Bloom` (0.80 / 24 / 1.70), `ColorCorrection` (Saturation **−0.30**, Contrast 0.10, Brightness 0), `Blur`. Vieram da correção de 18/09 (antes tudo era neon: Exposure 1.0, EnvDiffuse 0). Spec: `D:\T2\Santa fe RP\Santa fe RP\01_Especificacoes\Iluminacao.md` — leia antes.
- 438 luzes com teto de brilho 5 (`QA_brilho_orig`); 512 pinturas de chão Neon → SmoothPlastic (`QA_material_orig`). Não desfaça.
- **Ciclo do dia**: `ServerScriptService["Realism Mod"]` escreve `ClockTime` no boot; `ServerScriptService.ClimaService` (8k) lê `Lighting.ClockTime` e publica em `ReplicatedStorage` os atributos `Chuva` (0..3), `Molhado`, `Trovao`, `SecouEm`; chão fica molhado 240 s depois da chuva.
- **Cliente**: `StarterPlayer.StarterPlayerScripts.ClimaClient` (13k) tweena `Atmosphere`, `ColorCorrection` (na chuva: TintColor 214,224,240), `Terrain.Clouds`, sons e passos. `Client.GuiHandler.ClimaHandler` (+ `Tela`, `Chuva` = partículas) tweena `Clouds.Cover` 1 / 0.675.
- **Chão molhado = troca de MaterialVariant** (`ClimaClient` ~linhas 112–150): peças com tag `RuaMolhavel` trocam pra `<VarBase>Molhada` (existem: RuaMolhada, Rua2Molhada, CalçadaMolhada, Calçada2/3/4Molhada, ConcretoMolhado, GramaMolhada, GramaFolhosaMolhada), cor ×0.78 (×0.62 sem variante), reflectância sobe.
- `MaterialService`: 73 variantes (Rua, Rua2, Calçada*, Barro(Concrete), RockyGround(Ground), DeadGrass(Grass), GrassyMountain(Grass), OldRoad(Asphalt)…).
- Chão da favela (Vila Pantanal), peças rasas grandes: LeafyGrass 41, Concrete 51, Marble 7, Plastic 7, Slate 4. **A "terra" da favela é LeafyGrass/Grass pintada de marrom**, não é material de terra.
- Bairros já existem como dado puro: `ReplicatedStorage.Resources.Ruas` → `R.EnderecoDe(pos)` devolve via + bairro (Centro, Vila Pantanal, Conjunto Sol Nascente, Distrito Industrial, Zona Rural…). Use isso pra saber onde o jogador está; não invente zonas.
- ~120k peças no cliente com StreamingEnabled; 564 postes com `ParteNeon`.

## 2 · O BUG que se corrige primeiro (causa já achada)
**Sintoma:** começa a chover e chão que era **terra** (favela, estradas de terra) vira **grama verde**.
**Causa:** `ClimaClient` ~linha 121: `OVERRIDE_GRAMA = { [Grass] = "GramaMolhada", [LeafyGrass] = "GramaFolhosaMolhada" }` aplicado por `MaterialService:SetBaseMaterialOverride(material, variante)` — override **global por material base**: toda peça Grass/LeafyGrass do mapa passa a usar a ColorMap verde da variante e a cor marrom da peça deixa de mandar.
**Correção (escolha, implemente, prove):**
- (a) acabar com o override global; trocar variante **por peça**: verde (G dominante) → `GramaMolhada`/`GramaFolhosaMolhada`; cor de terra (R > G) → variante nova **`TerraMolhada`** (base Ground ou LeafyGrass, ColorMap neutra que respeite a `Color` da peça, RoughnessMap liso/molhado), cor ×0.7, reflectância 0.05; **ou**
- (b) manter o override só pra grama e marcar as peças de terra uma vez no Edit (atributo `Terra = true`, lista salva) pra receberem `TerraMolhada` por peça.
Critério: em Play com `Chuva ≥ 1` e `Molhado = true`, foto da favela e de uma estrada de terra: **terra continua terra, só mais escura e brilhando**; grama continua grama. 240 s depois de secar tudo volta ao `QA_orig`.

## 3 · O que construir (vai pra todos — então cada item entra só depois da foto aprovada)
### 3.1 Perfis por hora × tempo
Módulo **puro** `ReplicatedStorage.Shared.ClimaPerfis` (tabela, sem Instance, roda por `loadstring`): horas-chave **0, 5, 6, 7, 9, 12, 15, 17, 18, 19, 21** × tempo **sol / nublado / chuva leve (1) / chuva forte (2–3)** → `Lighting` (Brightness, ExposureCompensation, EnvironmentDiffuseScale, EnvironmentSpecularScale, Ambient, OutdoorAmbient, ColorShift_Top/Bottom, ShadowSoftness), `Atmosphere` (Density, Offset, Color, Decay, Glare, Haze), `ColorCorrection` (Saturation, Contrast, Brightness, TintColor), `Bloom`, `Clouds` (Cover, Density, Color). O cliente interpola entre horas-chave; transição de tempo ≥ 8 s; nada pula.
Direção de arte (do Julio): **no Centro e onde tem mais prédio o ar é carregado — haze alto, saturação baixa, tom cinza, peso de cidade; quanto mais afastado (Zona Rural, sítios, estradas), ar limpo e claro, mais saturado e colorido, sensação de calma.** Meio-dia não estoura (foi o neon); noite legível sem virar dia; amanhecer/entardecer quentes e curtos; chuva dessatura, azula de leve, baixa contraste, fecha o haze.
### 3.2 Gradiente por região (cinza no centro → limpo longe)
No cliente, a cada 1 s: `R.EnderecoDe(pos)` → bairro → **peso urbano** (tabela no `ClimaPerfis`: Centro 1.0, Distrito Industrial 0.9, Vila Pantanal 0.8, Sol Nascente 0.6, residenciais 0.4, Zona Rural 0.0). Perfil final = perfil hora/tempo **misturado** com o "perfil urbano" (+haze, −saturação, tint cinza, −contraste) proporcional ao peso, com **tween de 6–10 s** ao trocar de bairro. Prove Centro → Zona Rural na mesma hora, lado a lado, sem piscar.
### 3.3 Materiais e rugosidade
Passe pelas 73 variantes: rugosidade coerente (asfalto ≠ calçada ≠ barro ≠ metal), variantes molhadas com RoughnessMap realmente mais liso, `TerraMolhada` nova, par molhado pra `Barro` e `RockyGround`. Parede/prédio só com foto antes/depois.
### 3.4 Performance
Nenhuma luz nova; clima muda por segundo, não por Heartbeat; marcação de peças feita no Edit e salva em atributo. FPS antes/depois em Play no Centro e na favela: **queda máxima 3%**.

## 4 · Agentes (4 frentes em paralelo + 1 coordenador que só junta e fotografa)
1. **Cartógrafo** — lê `Resources.Ruas`, monta a tabela de pesos por bairro e **9 pontos de foto fixos** (Centro praça, Centro avenida, Distrito Industrial, beco da Vila Pantanal, Sol Nascente, estrada de terra rural, sítio/mato, água, posto na rodovia) com posição + CFrame de câmera. Todo mundo fotografa dos mesmos pontos.
2. **Luz** — `ClimaPerfis` (3.1) + gradiente (3.2) num bloco `[ClimaV2]` do `ClimaClient`. Trabalha em cópia até a foto aprovar.
3. **Materiais** — bug da terra (seção 2) + rugosidade (3.3).
4. **Olho (QA visual)** — o único que aprova. Para cada um dos 9 pontos: **6 horas** (6, 9, 12, 17, 19, 22) × **sol e chuva forte** = 108 fotos por rodada. Por foto responde: estourou? escuro demais? o Centro está mais cinza que a rural? a terra continua terra na chuva? céu com banda/serrilhado? Reprovou → volta pra frente certa com o motivo. Máximo 3 rodadas sem chamar o Julio.
Ferramentas: `Lighting.ClockTime` e `ReplicatedStorage:SetAttribute("Chuva", n)` pra forçar hora/tempo em Play; captura de tela do MCP; ao terminar, Edit como achou (ClockTime 12, Brightness 2).

## 5 · Entrega (nesta ordem; cada item só depois do anterior provado)
1. Backups + `ClimaV2_Reverter` provado (aplica → reverte → Lighting idêntico ao backup, byte a byte).
2. Bug da terra corrigido e fotografado (favela + estrada de terra, na chuva e depois de secar).
3. `ClimaPerfis` + bloco `[ClimaV2]` no `ClimaClient`; foto das 6 horas no Centro, sol e chuva.
4. Gradiente por região (foto Centro × Zona Rural na mesma hora).
5. Contato das fotos que provam cada afirmação, uma linha de veredito por foto.
6. Vault (`D:\T2\Santa fe RP\Santa fe RP`): leia o `_INDEX.md` PRIMEIRO, nunca busca global. Atualize `01_Especificacoes/Iluminacao.md` (valores finais por hora × tempo, pesos por bairro, como reverter), linha no `_INDEX.md`, entrada no `03_Logs/Log.md`, e até 6 linhas "Pra ti conferir jogando" em `03_Logs/Lista_Testes.md`.
7. Ao final, 5 linhas pro Julio: o que mudou, como reverter (`ClimaV2_Reverter`), e as 3 fotos que ele tem que olhar. **Não publique.**
