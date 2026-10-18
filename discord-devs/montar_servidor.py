# -*- coding: utf-8 -*-
"""
Monta o servidor da EQUIPE DE DESENVOLVIMENTO do Santa Fé Roleplay.

Pode rodar quantas vezes quiser: o que já existe (mesmo nome) é reaproveitado,
nada é apagado. Lê o token do arquivo .env que fica na mesma pasta:
    DISCORD_TOKEN=seu_token
    GUILD_ID=id_do_servidor   (opcional: sem ele, usa o único servidor onde o bot está)
"""
import os
import sys
import asyncio
import discord

AQUI = os.path.dirname(os.path.abspath(__file__))


def ler_env():
    env = {}
    caminho = os.path.join(AQUI, ".env")
    if not os.path.exists(caminho):
        sys.exit("Falta o arquivo .env nesta pasta (DISCORD_TOKEN=...).")
    with open(caminho, encoding="utf-8-sig") as f:
        for linha in f:
            linha = linha.strip()
            if linha and not linha.startswith("#") and "=" in linha:
                k, v = linha.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    if not env.get("DISCORD_TOKEN"):
        sys.exit("O .env não tem DISCORD_TOKEN.")
    return env


SEP = "━━━━━━━━━━━━━━━━━━━━"

# ------------------------------------------------------------------ CARGOS
# (nome, cor, é "time" = vê a área da equipe, é "direção" = escreve em tudo)
CARGOS = [
    ("👑 Dono",           0xE8B10E, True, True),
    ("🛠️ Direção",        0xE67E22, True, True),
    ("📋 Secretaria",     0x9B59B6, True, False),
    ("💻 Scripter",       0x3498DB, True, False),
    ("🧱 Builder",        0x2ECC71, True, False),
    ("🧊 Modelador",      0x1ABC9C, True, False),
    ("🎬 Animador",       0xE91E63, True, False),
    ("🎨 Artista",        0xF1C40F, True, False),
    ("🧪 Tester",         0x95A5A6, True, False),
    ("🤖 Bot",            0x607D8B, False, False),
]

# ------------------------------------------------------------------ TEXTOS
REGRAS = f"""# REGRAS DA EQUIPE

Este é o servidor de **desenvolvimento** do Santa Fé Roleplay. Aqui ficam as tarefas, as entregas, os relatórios de bug e as mecânicas novas.

**CONFIDENCIAL**
- Nada daqui sai do servidor: prints, arquivos, planos e datas são **internos**.
- Mecânica em votação não é anunciada para a comunidade antes da staff liberar.

**TRABALHO**
- Toda tarefa chega como **ficha** em **📋・fichas**. Sem ficha, não é tarefa.
- Ninguém mexe no **mapa** nem no **jogo publicado** direto. Tudo entra pela entrega na ficha.
- Todo trabalho precisa ser **original**: nada copiado de outro jogo, nada de marca registrada.
- Dúvida sobre a tarefa se tira **antes** de começar, no próprio post da ficha.

**CONVIVÊNCIA**
- Crítica é sobre o trabalho, nunca sobre a pessoa.
- Prazo que não vai dar: avise **antes** de vencer, no post da ficha.

{SEP}"""

COMO_TRABALHAMOS = f"""# COMO TRABALHAMOS

O trabalho da equipe segue **um caminho só**. Cada etapa tem o seu canal.

**1. MECÂNICA NOVA**
A direção publica a proposta em **💡・mecânicas** (documento + PDF). A equipe lê e vota em **🗳️・votações**. Aprovada, a mecânica vira fichas.

**2. FICHA**
Cada tarefa é um post em **📋・fichas**, com a área e o status nas etiquetas. A ficha diz **o que entregar, onde, a referência e o critério de pronto**.

**3. TRABALHO**
Quem pegou a ficha responde no post: "peguei". Dúvidas e prévias vão no mesmo post. O andamento do dia vai em **📝・diário**.

**4. ENTREGA**
A entrega é postada **no post da ficha**: foto ou vídeo do resultado no jogo + onde está o arquivo. Sem prova, não conta como entregue.

**5. REVISÃO**
A direção revisa e troca a etiqueta: **Pronta** ou **Ajustar** (com o que mudar).

**6. BUGS**
A secretaria posta o relatório em **🗂️・relatórios**. A direção abre um post por bug em **🐞・triagem** (prioridade + área). Corrigido, vai para **✅・corrigidos** e a secretaria confere no próximo relatório.

**PRIORIDADE DE BUG**
- **P1:** perde ou duplica item, dinheiro, carro ou documento; não entra no jogo; exploit.
- **P2:** mecânica importante parada.
- **P3:** funciona, mas com erro chato ou desconforto.
- **P4:** detalhe visual.

{SEP}"""

FUNCOES = f"""# FUNÇÕES DA EQUIPE

- **👑 Dono:** decide prioridades, aprova mecânicas e dá a palavra final em dado salvo e economia.
- **🛠️ Direção:** escreve fichas, revisa entregas e faz a triagem dos bugs.
- **📋 Secretaria:** junta os bugs e sugestões da cidade e entrega o relatório (segunda, quarta e sexta, até **18h**).
- **💻 Scripter:** programa o que a ficha pede e prova em vídeo.
- **🧱 Builder:** monta o mapa e os prédios. Posiciona o que os modeladores entregam.
- **🧊 Modelador:** modelos 3D (veículos, objetos, props), com foto de cada um.
- **🎬 Animador:** animações R6.
- **🎨 Artista:** roupas, decals e artes.
- **🧪 Tester:** testa o que a direção pedir em **🧪・pedidos-de-teste**.

{SEP}"""

GUIA_FICHAS = """**COMO É UMA FICHA**
Título: [ÁREA] o que é (ex.: [Build] Portão da base do BOPE)
- **O que entregar:** o resultado, em uma frase.
- **Onde:** lugar exato no mapa ou pasta no Studio.
- **Referência:** print, vídeo ou link.
- **Critério de pronto:** o que precisa aparecer na foto/vídeo.
- **Prazo:** dia.
- **Quem:** quem pegou (responda "peguei" no post).
Entrega = foto ou vídeo no jogo, postado aqui no post da ficha."""

GUIA_TRIAGEM = """**COMO É UM BUG NA TRIAGEM**
Título: [P1-P4] o que acontece (ex.: [P2] F de carregar não aparece no caído)
- **Onde:** lugar exato.
- **Como repetir:** passos.
- **Aparelho:** PC, celular ou os dois.
- **Prova:** link com dia e hora.
- **Vem do relatório:** nº do relatório e da ficha (ex.: Rel. 02 · B3).
Corrigido: etiqueta **Corrigido** + o que mudou numa linha."""

GUIA_MECANICAS = """**COMO É UMA MECÂNICA**
Título: nome da mecânica (ex.: SAMU: o corpo contínuo)
- PDF da proposta + PDF do Livro da Mecânica.
- O que o jogador **vê** e **faz**, o que muda, assets, quem faz.
- Votação em 🗳️・votações. Aprovada vira fichas em 📋・fichas."""

GUIA_RELATORIOS = """**COMO POSTAR O RELATÓRIO**
Título: Relatório nº XX — DD/MM a DD/MM
- Anexe o PDF da Ficha da Secretaria preenchido.
- Na mensagem: o pior bug e a ordem de correção (copie do resumo).
Entrega: segunda, quarta e sexta, até 18h."""

EXEMPLO_FICHA = f"""**O que entregar:** portão de correr funcional na entrada da base do BOPE.
**Onde:** Base do BOPE, entrada principal (rua de trás da DP).
**Referência:** portão da base da PC (o mesmo estilo, na cor do BOPE).
**Critério de pronto:** vídeo abrindo e fechando com o F do jogo, sem atravessar parede.
**Prazo:** [DATA]
**Quem:** responda "peguei" aqui.

*Este post é um exemplo de formato. Pode apagar depois.*"""

LINKS = f"""# LINKS

- **Jogo:** [LINK DO JOGO]
- **Grupo Roblox:** [LINK DO GRUPO]
- **Discord da cidade:** [LINK]
- **Servidor dos testers:** [LINK]
- **Painel (site):** stunning-victory-production-d2b2.up.railway.app

{SEP}"""

BOAS_VINDAS = f"""# BEM-VINDO À EQUIPE

Leia **📜・regras** e **📖・como-trabalhamos** antes de qualquer coisa. Seu cargo é liberado pela direção depois da aprovação.

{SEP}"""

# ------------------------------------------------------------------ ESTRUTURA
# tipo: text | forum | voice ; modo: livre | leitura | posts (só direção cria post, time responde)
ESTRUTURA = [
    ("🚪┆ PORTARIA", "publico", [
        ("text", "👋・boas-vindas", "leitura", "Primeiro passo de quem chega.", [BOAS_VINDAS]),
        ("text", "📜・regras", "leitura", "Regras da equipe.", [REGRAS]),
    ]),
    ("📢┆ INFORMAÇÕES", "time", [
        ("text", "📢・anúncios", "leitura", "Avisos da direção para a equipe.", []),
        ("text", "📖・como-trabalhamos", "leitura", "O caminho de toda tarefa: mecânica → ficha → entrega → revisão.", [COMO_TRABALHAMOS]),
        ("text", "👥・funções", "leitura", "Quem faz o quê.", [FUNCOES]),
        ("text", "🔗・links", "leitura", "Jogo, grupo, painel e servidores.", [LINKS]),
        ("text", "📝・changelog-interno", "leitura", "O que entrou no jogo, por data.", []),
    ]),
    ("📋┆ TAREFAS", "time", [
        ("forum", "📋・fichas", "posts", GUIA_FICHAS,
         ["Build", "Modelagem", "Script", "Animação", "Arte", "UI", "Som", "Aberta", "Em andamento", "Em revisão", "Ajustar", "Pronta"]),
        ("text", "📝・diário", "livre", "O que você fez hoje: 1 a 3 linhas + print. Uma mensagem por dia.", []),
        ("text", "❓・dúvidas", "livre", "Dúvida geral de ferramenta, Studio, Blender. Dúvida de ficha vai no post da ficha.", []),
        ("text", "🖼️・referências", "livre", "Prints, vídeos e links de referência.", []),
    ]),
    ("🐞┆ BUGS E TESTES", "time", [
        ("forum", "🗂️・relatórios", "secretaria", GUIA_RELATORIOS, ["Novo", "Triado", "Fechado"]),
        ("forum", "🐞・triagem", "posts", GUIA_TRIAGEM,
         ["P1", "P2", "P3", "P4", "Carros", "Polícia", "SAMU", "Casas", "Mapa", "Celular", "Armas", "Inventário", "Empregos", "Tela/HUD", "Desconforto", "Aberto", "Corrigindo", "Corrigido", "Voltou"]),
        ("text", "✅・corrigidos", "leitura", "Bug corrigido: nº + o que mudou, uma linha. A secretaria confere no próximo relatório.", []),
        ("text", "🧪・pedidos-de-teste", "livre", "O que os testers devem testar, onde e em qual aparelho.", []),
    ]),
    ("🧠┆ MECÂNICAS", "time", [
        ("forum", "💡・mecânicas", "posts", GUIA_MECANICAS, ["Em votação", "Aprovada", "Em produção", "No jogo", "Arquivada"]),
        ("text", "🗳️・votações", "votacao", "Uma mensagem por ponto em votação. Vote só com ✅ e ❌.", []),
        ("text", "📚・livros-da-mecânica", "leitura", "PDF final de cada mecânica que entrou no jogo.", []),
    ]),
    ("🎨┆ PRODUÇÃO", "time", [
        ("text", "🧱・build", "livre", "Builder e suporte de build.", []),
        ("text", "🧊・modelagem", "livre", "Veículos, objetos e props.", []),
        ("text", "💻・scripts", "livre", "Programação.", []),
        ("text", "🎬・animação", "livre", "Animações R6.", []),
        ("text", "🎨・arte", "livre", "Roupas, decals e artes.", []),
    ]),
    ("💬┆ EQUIPE", "time", [
        ("text", "💬・chat-devs", "livre", "Conversa da equipe.", []),
    ]),
    ("🔊┆ CALLS", "time", [
        ("voice", "💼┆Reunião", "livre", None, []),
        ("voice", "🛠️┆Trabalhando 1", "livre", None, []),
        ("voice", "🛠️┆Trabalhando 2", "livre", None, []),
        ("voice", "🧪┆Teste em jogo", "livre", None, []),
        ("voice", "💤┆AFK", "livre", None, []),
    ]),
    ("🔒┆ DIREÇÃO", "direcao", [
        ("text", "🔒・direção", "livre", "Só dono e direção.", []),
        ("text", "🤖・logs", "leitura", "Registro automático.", []),
    ]),
]


async def montar(guild: discord.Guild):
    log = []
    p = lambda *a: (print(*a), log.append(" ".join(str(x) for x in a)))

    # cargos
    cargos = {}
    for nome, cor, time, direcao in CARGOS:
        r = discord.utils.get(guild.roles, name=nome)
        if not r:
            r = await guild.create_role(name=nome, colour=discord.Colour(cor), hoist=True, mentionable=True,
                                        reason="Montagem do servidor da equipe")
            p("cargo criado:", nome)
        cargos[nome] = (r, time, direcao)
    dono = cargos["👑 Dono"][0]
    try:
        owner = guild.owner or await guild.fetch_member(guild.owner_id)
        if owner and dono not in owner.roles:
            await owner.add_roles(dono, reason="Dono do servidor")
            p("cargo Dono dado a", owner.display_name)
    except Exception as e:
        p("não deu pra dar o cargo Dono:", e)

    time_roles = [r for (r, t, d) in cargos.values() if t]
    dir_roles = [r for (r, t, d) in cargos.values() if d]
    secretaria = cargos["📋 Secretaria"][0]
    eu = guild.me

    def ow(acesso, modo):
        e = guild.default_role
        o = {eu: discord.PermissionOverwrite(view_channel=True, send_messages=True, manage_channels=True,
                                             manage_messages=True, manage_threads=True, create_public_threads=True,
                                             send_messages_in_threads=True, embed_links=True, attach_files=True)}
        if acesso == "publico":
            o[e] = discord.PermissionOverwrite(view_channel=True, send_messages=False, add_reactions=False)
        else:
            o[e] = discord.PermissionOverwrite(view_channel=False)
            quem = dir_roles if acesso == "direcao" else time_roles
            for r in quem:
                o[r] = discord.PermissionOverwrite(view_channel=True, connect=True, speak=True)
        # modo de escrita para quem não é direção
        nao_dir = [r for r in time_roles if r not in dir_roles] if acesso != "direcao" else []
        for r in nao_dir:
            po = o.get(r, discord.PermissionOverwrite(view_channel=True))
            if modo == "leitura":
                po.send_messages = False
                po.add_reactions = False
                po.create_public_threads = False
            elif modo == "votacao":
                po.send_messages = False
                po.add_reactions = True
            elif modo == "posts":          # fórum: só a direção abre post; o time responde dentro
                po.send_messages = False
                po.send_messages_in_threads = True
            elif modo == "secretaria":
                po.send_messages = (r == secretaria)
                po.send_messages_in_threads = True
            o[r] = po
        for r in dir_roles:
            po = o.get(r, discord.PermissionOverwrite(view_channel=True))
            po.view_channel = True
            po.send_messages = True
            po.send_messages_in_threads = True
            po.manage_messages = True
            po.manage_threads = True
            o[r] = po
        return o

    for nome_cat, acesso, canais in ESTRUTURA:
        cat = discord.utils.get(guild.categories, name=nome_cat)
        if not cat:
            cat = await guild.create_category(nome_cat, overwrites=ow(acesso, "livre"), reason="Montagem")
            p("categoria criada:", nome_cat)
        else:
            await cat.edit(overwrites=ow(acesso, "livre"))
        for tipo, nome, modo, topico, extra in canais:
            existe = discord.utils.get(cat.channels, name=nome) or discord.utils.get(guild.channels, name=nome)
            perms = ow(acesso, modo)
            if existe:
                await existe.edit(category=cat, overwrites=perms)
                p("já existia, permissões atualizadas:", nome)
                continue
            if tipo == "voice":
                await guild.create_voice_channel(nome, category=cat, overwrites=perms)
                p("call criada:", nome)
            elif tipo == "forum":
                tags = [discord.ForumTag(name=t) for t in extra]
                try:
                    f = await guild.create_forum(nome, category=cat, topic=topico, overwrites=perms,
                                                 available_tags=tags, reason="Montagem")
                    p("fórum criado:", nome)
                    if nome == "📋・fichas":
                        try:
                            ap = [t for t in f.available_tags if t.name in ("Build", "Aberta")]
                            await f.create_thread(name="[Build] EXEMPLO — Portão da base do BOPE",
                                                  content=EXEMPLO_FICHA, applied_tags=ap)
                            p("  post de exemplo criado em", nome)
                        except Exception as e:
                            p("  exemplo não criado:", e)
                except discord.HTTPException as e:
                    # servidor sem fórum: vira canal de texto com o guia fixado
                    c = await guild.create_text_channel(nome, category=cat, overwrites=ow(acesso, "livre"), topic=topico[:1024])
                    m = await c.send(topico)
                    await m.pin()
                    p("fórum não deu (", e.text if hasattr(e, "text") else e, ") -> canal de texto:", nome)
            else:
                c = await guild.create_text_channel(nome, category=cat, overwrites=perms, topic=(topico or "")[:1024])
                p("canal criado:", nome)
                for texto in extra:
                    m = await c.send(texto)
                    try:
                        await m.pin()
                    except Exception:
                        pass
    p("PRONTO.")
    with open(os.path.join(AQUI, "resultado.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(log))


def main():
    env = ler_env()
    intents = discord.Intents.default()
    cli = discord.Client(intents=intents)

    @cli.event
    async def on_ready():
        try:
            gid = env.get("GUILD_ID")
            guild = cli.get_guild(int(gid)) if gid else (cli.guilds[0] if len(cli.guilds) == 1 else None)
            if not guild:
                print("O bot está em", len(cli.guilds), "servidores. Coloque GUILD_ID no .env.")
                for g in cli.guilds:
                    print("  ", g.id, g.name)
            else:
                print("Montando em:", guild.name)
                await montar(guild)
        except discord.Forbidden:
            print("ERRO: o bot não tem permissão. Dê o cargo de Administrador pro bot e suba o cargo dele pro topo.")
        except Exception as e:
            print("ERRO:", repr(e))
        finally:
            await cli.close()

    cli.run(env["DISCORD_TOKEN"], log_handler=None)


if __name__ == "__main__":
    main()
