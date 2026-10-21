# Varre TODAS as consultas SQL do site e classifica cada uma quanto à cidade.
import re, os, json, sys
RAIZ = sys.argv[1]
PLATAFORMA = {'users','session','user_ips','cidades','cidade_staff','plataforma_migracoes'}
DIRETA = {'corporations','game_players','game_patrimonio','game_logs','game_commands','game_item_fila',
  'game_servers','game_config','game_bans','admin_audit','player_snapshots','aparelhos','aparelho_donos',
  'celular_contatos','celular_mensagens','deepweb_posts','alertas_compra','procurados','veiculos_procurados',
  'fichas_encerradas','eleicao_config','eleicao_estado','eleicao_votantes','eleicao_votos','net_editais',
  'net_candidaturas','olx_anuncios','olx_vendas','mf_reembolsos','tester_liberacoes'}
VIA_CORP = {'ranks','members','corp_managers','corp_caixa','corp_estoque','corp_lancamentos','corp_emprestimos',
  'corp_orcamento_pago','corp_vinculos_hist','corp_atividade','empresa_depositos'}
TODAS = PLATAFORMA | DIRETA | VIA_CORP
SQL_RE = re.compile(r'(`(?:[^`\\]|\\.)*`|\'(?:[^\'\\\n]|\\.)*\'|"(?:[^"\\\n]|\\.)*")', re.S)
KW = re.compile(r'\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|ALTER\s+TABLE|CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX))\b', re.I)
ROTA = re.compile(r"router\.(get|post|put|patch|delete)\(\s*'([^']+)'([^\n]*)")
FUNC = re.compile(r'^\s*(?:async\s+)?function\s+(\w+)|^\s*(?:const|let)\s+(\w+)\s*=\s*async', re.M)
saida = []
for dirp, _, fs in os.walk(os.path.join(RAIZ,'src')):
    for f in fs:
        if not f.endswith('.js'): continue
        p = os.path.join(dirp, f); rel = os.path.relpath(p, RAIZ)
        txt = open(p, encoding='utf-8').read()
        # contexto: rota ou função mais próxima acima
        marcos = []
        for m in ROTA.finditer(txt): marcos.append((m.start(), f"{m.group(1).upper()} {m.group(2)}", 'requireCorpOwner' in m.group(3)))
        for m in FUNC.finditer(txt): marcos.append((m.start(), 'fn ' + (m.group(1) or m.group(2)), False))
        marcos.sort()
        for m in SQL_RE.finditer(txt):
            s = m.group(0)[1:-1]
            if not KW.search(s): continue
            low = s.lower()
            tabs = sorted(t for t in TODAS if re.search(r'\b' + t + r'\b', low))
            if not tabs: continue
            if re.match(r'\s*(create|alter)\b', low) or 'create table' in low or 'create index' in low or 'alter table' in low:
                classe = 'ddl'
            else:
                d = [t for t in tabs if t in DIRETA]; v = [t for t in tabs if t in VIA_CORP]
                ctx = None; corpOwner = False
                for pos, nome, co in marcos:
                    if pos < m.start(): ctx, corpOwner = nome, co
                if 'cidade_id' in low:
                    classe = 'ok'
                elif not d and not v:
                    classe = 'plataforma'
                elif not d and v and corpOwner:
                    classe = 'ok_corp'           # rota de corp: a corp já foi conferida (ctxDaCorp filtra cidade)
                elif not d and v and re.search(r'corporation_id\s*=\s*\$', low):
                    classe = 'corp_por_id'       # filtra por UMA corp: seguro SE quem chama já conferiu a corp
                else:
                    classe = 'aberta'
            linha = txt.count('\n', 0, m.start()) + 1
            ctx = None
            for pos, nome, co in marcos:
                if pos < m.start(): ctx = nome
            saida.append({'arq': rel, 'linha': linha, 'ctx': ctx, 'tabelas': tabs, 'classe': classe,
                          'sql': re.sub(r'\s+', ' ', s)[:140]})
json.dump(saida, open(os.path.join(RAIZ,'consultas_cidades.json'),'w'), ensure_ascii=False, indent=0)
from collections import Counter, defaultdict
c = Counter(x['classe'] for x in saida); print('TOTAL', len(saida), dict(c))
por = defaultdict(Counter)
for x in saida: por[x['arq']][x['classe']] += 1
for a in sorted(por): print(f"{a:32s}", dict(por[a]))
