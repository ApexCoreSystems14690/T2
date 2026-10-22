// [22/10] REGULAMENTOS POR CIDADE — nativos no site.
//
// [stated] Julio: "nao tem o arquivo de regulamentos la nativo no site na tela de entrada etc
// ( da nossa cidade somente, cada uma vai ter a sua )".
//
// Cada cidade tem os SEUS documentos (Regulamento Oficial, Regulamento das Facções...).
// O texto mora no banco em markdown simples e o site desenha ele como página de verdade:
// sumário, link direto pra cada artigo (#art-2-5), busca, e as citações "Art. 7.3" viram link.
// O PDF original fica junto, pra baixar.
//
// Isolamento: toda leitura é por (cidade_id, slug). A página pública acha a cidade pelo slug
// da URL; o editor só mexe na cidade da sessão e só o Dono DESSA cidade (perm.ehDonoAqui).
//
// Toda gravação guarda a versão anterior em cidade_regulamentos_hist (dá pra voltar).
const fs = require('fs');
const path = require('path');

const SANTA_FE = 1;
const STATUS = ['vigente', 'rascunho', 'arquivado'];

async function garantir(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cidade_regulamentos (
      id SERIAL PRIMARY KEY,
      cidade_id INTEGER NOT NULL REFERENCES cidades(id) ON DELETE CASCADE,
      slug VARCHAR(40) NOT NULL,
      titulo VARCHAR(120) NOT NULL,
      subtitulo VARCHAR(200),
      versao VARCHAR(20),
      status VARCHAR(16) NOT NULL DEFAULT 'vigente',
      vigente_desde DATE,
      aviso VARCHAR(200),                 -- ex.: "entra em vigor após a votação"
      meta JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{k:'Responsável', v:'Israel'}]
      conteudo TEXT NOT NULL DEFAULT '',
      pdf BYTEA,
      pdf_nome VARCHAR(120),
      ordem INTEGER NOT NULL DEFAULT 100,
      atualizado_em TIMESTAMP DEFAULT NOW(),
      atualizado_por INTEGER,
      UNIQUE (cidade_id, slug)
    );
    CREATE TABLE IF NOT EXISTS cidade_regulamentos_hist (
      id SERIAL PRIMARY KEY,
      regulamento_id INTEGER NOT NULL,
      cidade_id INTEGER NOT NULL,
      foto JSONB NOT NULL,                -- a linha inteira (sem o PDF) antes da mudança
      por INTEGER,
      em TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_regras_hist ON cidade_regulamentos_hist(regulamento_id, em DESC);
  `);

  // Semente: os dois documentos do Santa Fé Oficial. Só entra se a cidade ainda não tem o slug
  // (depois disso quem manda é o editor do site: o boot nunca sobrescreve).
  const pasta = path.join(__dirname, 'regulamentos');
  const ler = (f, bin) => { try { return fs.readFileSync(path.join(pasta, f), bin ? undefined : 'utf8'); } catch (e) { return null; } };
  const sementes = [
    { slug: 'oficial', titulo: 'Regulamento Oficial', subtitulo: 'Termos de Uso, Regras de Roleplay e Leis da Cidade',
      versao: '2.3', status: 'vigente', vigente_desde: '2026-10-21', aviso: null,
      meta: [{ k: 'Publicado por', v: 'Equipe Santa Fé Roleplay' }, { k: 'Alterações', v: 'anunciadas em #avisos' }],
      md: 'oficial.md', pdf: 'oficial.pdf', pdf_nome: 'Regulamento-Santa-Fe-RP-v2.3.pdf', ordem: 10 },
    { slug: 'faccoes', titulo: 'Regulamento das Facções', subtitulo: 'Facções Oficiais de Santa Fé · Reestruturação',
      versao: '3', status: 'rascunho', vigente_desde: null, aviso: 'Rascunho: entra em vigor após a votação',
      meta: [{ k: 'Responsável', v: 'Israel' }, { k: 'Substitui', v: 'Todas as regras anteriores do servidor das facções' },
             { k: 'Liga com', v: 'Regulamento Oficial v2.3 (Cap. 4 a 7 e 11)' }],
      md: 'faccoes.md', pdf: 'faccoes.pdf', pdf_nome: 'Regulamento-Faccoes-v3.pdf', ordem: 20 },
  ];
  const tem = await pool.query('SELECT 1 FROM cidades WHERE id = $1', [SANTA_FE]);
  if (!tem.rows[0]) return;
  for (const s of sementes) {
    const md = ler(s.md);
    if (!md) continue;
    await pool.query(
      `INSERT INTO cidade_regulamentos (cidade_id, slug, titulo, subtitulo, versao, status, vigente_desde, aviso, meta, conteudo, pdf, pdf_nome, ordem)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13)
       ON CONFLICT (cidade_id, slug) DO NOTHING`,
      [SANTA_FE, s.slug, s.titulo, s.subtitulo, s.versao, s.status, s.vigente_desde, s.aviso,
       JSON.stringify(s.meta), md, ler(s.pdf, true), s.pdf_nome, s.ordem]);
  }
}

const COLS = `id, cidade_id, slug, titulo, subtitulo, versao, status, to_char(vigente_desde, 'YYYY-MM-DD') AS vigente_desde, aviso, meta, ordem,
              atualizado_em, (pdf IS NOT NULL) AS tem_pdf, pdf_nome`;

// Documentos de UMA cidade. publico=true esconde os arquivados.
async function listar(pool, cidadeId, publico) {
  const r = await pool.query(
    `SELECT ${COLS} FROM cidade_regulamentos WHERE cidade_id = $1 ${publico ? `AND status <> 'arquivado'` : ''}
      ORDER BY ordem, id`, [cidadeId]);
  return r.rows;
}

// Quantos documentos públicos cada cidade tem (pra tela Cidades).
async function contagem(pool) {
  try {
    const r = await pool.query(`SELECT cidade_id, COUNT(*)::int AS n FROM cidade_regulamentos WHERE status <> 'arquivado' GROUP BY cidade_id`);
    const out = {}; for (const x of r.rows) out[x.cidade_id] = x.n; return out;
  } catch (e) { return {}; }
}

async function doc(pool, cidadeId, slug, comConteudo) {
  const r = await pool.query(
    `SELECT ${COLS}${comConteudo ? ', conteudo' : ''} FROM cidade_regulamentos WHERE cidade_id = $1 AND slug = $2`, [cidadeId, slug]);
  return r.rows[0] || null;
}

async function pdfDe(pool, cidadeId, slug) {
  const r = await pool.query(`SELECT pdf, pdf_nome FROM cidade_regulamentos WHERE cidade_id = $1 AND slug = $2 AND status <> 'arquivado'`, [cidadeId, slug]);
  return r.rows[0] && r.rows[0].pdf ? r.rows[0] : null;
}

function slugOk(s) { return typeof s === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(s); }

function limpar(b) {
  const txt = (v, n) => (v == null || v === '') ? null : String(v).slice(0, n);
  const out = {};
  if (b.titulo !== undefined) { out.titulo = txt(b.titulo, 120); if (!out.titulo) throw new Error('Título é obrigatório'); }
  if (b.subtitulo !== undefined) out.subtitulo = txt(b.subtitulo, 200);
  if (b.versao !== undefined) out.versao = txt(b.versao, 20);
  if (b.aviso !== undefined) out.aviso = txt(b.aviso, 200);
  if (b.status !== undefined) { if (!STATUS.includes(b.status)) throw new Error('Status inválido'); out.status = b.status; }
  if (b.vigente_desde !== undefined) {
    out.vigente_desde = b.vigente_desde ? String(b.vigente_desde).slice(0, 10) : null;
    if (out.vigente_desde && !/^\d{4}-\d{2}-\d{2}$/.test(out.vigente_desde)) throw new Error('Data inválida');
  }
  if (b.ordem !== undefined) out.ordem = Math.max(0, Math.min(999, parseInt(b.ordem) || 100));
  if (b.meta !== undefined) {
    const arr = Array.isArray(b.meta) ? b.meta : [];
    out.meta = JSON.stringify(arr.slice(0, 8).map(m => ({ k: String(m.k || '').slice(0, 40), v: String(m.v || '').slice(0, 160) })).filter(m => m.k && m.v));
  }
  if (b.conteudo !== undefined) {
    out.conteudo = String(b.conteudo || '');
    if (out.conteudo.length > 400000) throw new Error('Texto grande demais');
  }
  return out;
}

async function guardarFoto(cli, cidadeId, id, por) {
  await cli.query(
    `INSERT INTO cidade_regulamentos_hist (regulamento_id, cidade_id, foto, por)
     SELECT id, cidade_id, to_jsonb(r) - 'pdf', $3 FROM cidade_regulamentos r WHERE id = $1 AND cidade_id = $2`,
    [id, cidadeId, por]);
}

// Cria ou atualiza. Sempre preso à cidade passada (a da sessão).
async function salvar(pool, cidadeId, slug, body, porUserId) {
  if (!slugOk(slug)) throw new Error('Endereço inválido (use letras minúsculas, números e hífen)');
  const campos = limpar(body || {});
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const atual = await cli.query('SELECT id FROM cidade_regulamentos WHERE cidade_id = $1 AND slug = $2 FOR UPDATE', [cidadeId, slug]);
    let id;
    if (atual.rows[0]) {
      id = atual.rows[0].id;
      await guardarFoto(cli, cidadeId, id, porUserId);
      const ks = Object.keys(campos);
      if (ks.length) {
        const sets = ks.map((k, i) => `${k} = $${i + 3}${k === 'meta' ? '::jsonb' : ''}`).join(', ');
        await cli.query(`UPDATE cidade_regulamentos SET ${sets}, atualizado_em = NOW(), atualizado_por = $2 WHERE id = $1`,
          [id, porUserId, ...ks.map(k => campos[k])]);
      }
    } else {
      if (!campos.titulo) throw new Error('Título é obrigatório');
      const r = await cli.query(
        `INSERT INTO cidade_regulamentos (cidade_id, slug, titulo, subtitulo, versao, status, vigente_desde, aviso, meta, conteudo, ordem, atualizado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::jsonb,'[]'::jsonb),$10,$11,$12) RETURNING id`,
        [cidadeId, slug, campos.titulo, campos.subtitulo || null, campos.versao || null, campos.status || 'rascunho',
         campos.vigente_desde || null, campos.aviso || null, campos.meta || null, campos.conteudo || '', campos.ordem || 100, porUserId]);
      id = r.rows[0].id;
    }
    await cli.query('COMMIT');
    return id;
  } catch (e) { try { await cli.query('ROLLBACK'); } catch (_) {} throw e; }
  finally { cli.release(); }
}

async function salvarPdf(pool, cidadeId, slug, buf, nome, porUserId) {
  if (!buf || buf.length < 5 || buf.slice(0, 5).toString() !== '%PDF-') throw new Error('Isso não é um PDF');
  if (buf.length > 8 * 1024 * 1024) throw new Error('PDF maior que 8 MB');
  const nomeOk = (String(nome || slug + '.pdf').replace(/[^\w.\-]+/g, '-').slice(0, 110) || 'regulamento') .replace(/(\.pdf)?$/i, '.pdf');
  const r = await pool.query(
    `UPDATE cidade_regulamentos SET pdf = $3, pdf_nome = $4, atualizado_em = NOW(), atualizado_por = $5
      WHERE cidade_id = $1 AND slug = $2`, [cidadeId, slug, buf, nomeOk, porUserId]);
  if (!r.rowCount) throw new Error('Documento não existe nesta cidade');
}

async function historico(pool, cidadeId, slug) {
  const r = await pool.query(
    `SELECT h.id, h.em, h.por, u.discord_username AS por_nome, h.foto->>'versao' AS versao, length(h.foto->>'conteudo') AS tamanho
       FROM cidade_regulamentos_hist h JOIN cidade_regulamentos d ON d.id = h.regulamento_id
       LEFT JOIN users u ON u.id = h.por
      WHERE d.cidade_id = $1 AND d.slug = $2 ORDER BY h.em DESC LIMIT 30`, [cidadeId, slug]);
  return r.rows;
}

async function restaurar(pool, cidadeId, slug, histId, porUserId) {
  const h = await pool.query(
    `SELECT h.foto FROM cidade_regulamentos_hist h JOIN cidade_regulamentos d ON d.id = h.regulamento_id
      WHERE h.id = $1 AND d.cidade_id = $2 AND d.slug = $3`, [histId, cidadeId, slug]);
  if (!h.rows[0]) throw new Error('Versão não encontrada');
  const f = h.rows[0].foto;
  return salvar(pool, cidadeId, slug, {
    titulo: f.titulo, subtitulo: f.subtitulo, versao: f.versao, status: f.status, vigente_desde: f.vigente_desde ? String(f.vigente_desde).slice(0, 10) : null,
    aviso: f.aviso, meta: f.meta, conteudo: f.conteudo, ordem: f.ordem,
  }, porUserId);
}

// ------------------------------------------------------------------ desenho
// Markdown simples -> HTML. Tudo é escapado ANTES; só as marcações abaixo viram tag.
//   ## Capítulo N · Título     ### Subtítulo     > nota
//   **Art. 1.1** [NOVO] — texto     - item     | tabela | (• dentro da célula vira lista)
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const idArt = n => 'art-' + String(n).toLowerCase().replace(/\./g, '-');

function renderizar(md, opts) {
  opts = opts || {};
  const linkOficial = opts.linkOficial || null;        // '/cidade/x/regras/oficial' pra citar o Oficial
  const arts = new Set();
  const caps = [];
  String(md || '').replace(/^\*\*Art\. ([0-9]+\.[0-9]+[A-Z]?)\*\*/gm, (_, n) => { arts.add(n); return _; });

  function inline(t) {
    let s = esc(t);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[(NOVO|ALTERADO)\]/g, (_, x) => `<span class="rg-tag rg-${x.toLowerCase()}">${x === 'NOVO' ? 'Novo' : 'Alterado'}</span>`);
    // citação do Regulamento Oficial a partir de outro documento
    if (linkOficial) {
      s = s.replace(/(^|[^\w>#-])Cap\.\s([0-9]+)(\s+do\s+Regulamento Oficial)/g,
        (_, pre, n, resto) => `${pre}<a class="rg-ref" href="${linkOficial}#cap-${n}">Cap. ${n}</a>${resto}`);
      s = s.replace(/(Regulamento(?: Oficial)?,\s*)(Arts?\.)\s*([0-9]+\.[0-9]+[A-Z]?)/g,
        (_, a, b, n) => `${a}<a class="rg-ref" href="${linkOficial}#${idArt(n)}">${b} ${n}</a>`);
    }
    // citação interna: Art. 7.3 / Arts. 2.17 / Cap. 5
    s = s.replace(/(^|[^\w>#-])(Arts?\.)\s([0-9]+\.[0-9]+[A-Z]?)(?![\w<])/g, (m, pre, b, n) =>
      arts.has(n) ? `${pre}<a class="rg-ref" href="#${idArt(n)}">${b} ${n}</a>` : m);
    s = s.replace(/(^|[^\w>#-])Cap\.\s([0-9]+)(?![\w<])/g, (m, pre, n) => `${pre}<a class="rg-ref" href="#cap-${n}">Cap. ${n}</a>`);
    return s;
  }
  function celula(c) {
    const t = c.trim();
    if (t.includes('•')) {
      const itens = t.split('•').map(x => x.trim()).filter(Boolean);
      return '<ul>' + itens.map(i => `<li>${inline(i)}</li>`).join('') + '</ul>';
    }
    return inline(t);
  }
  const blocos = String(md || '').replace(/\r/g, '').split(/\n{2,}/);
  const html = [];
  let abriuCap = false;
  for (const b0 of blocos) {
    const b = b0.trim();
    if (!b) continue;
    const linhas = b.split('\n');
    if (b.startsWith('## ')) {
      const t = b.slice(3).trim();
      const m = /^Cap[íi]tulo\s+(\d+)\s*[·\-:]\s*(.+)$/i.exec(t);
      const n = m ? m[1] : String(caps.length + 1);
      const titulo = m ? m[2] : t;
      caps.push({ n, titulo, id: 'cap-' + n });
      if (abriuCap) html.push('</section>');
      html.push(`<section class="rg-cap" id="cap-${esc(n)}"><h2><span class="rg-capn">Capítulo ${esc(n)}</span>${inline(titulo)}</h2>`);
      abriuCap = true;
      continue;
    }
    if (b.startsWith('### ')) { html.push(`<h3 class="rg-sub">${inline(b.slice(4))}</h3>`); continue; }
    if (linhas.every(l => l.trim().startsWith('|'))) {
      const rows = linhas.filter(l => !/^\|\s*-{2,}/.test(l.trim()) && !/^\|(\s*-+\s*\|)+\s*$/.test(l.trim()))
        .map(l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|'));
      const [cab, ...corpo] = rows;
      const vv = cab.length === 2 && /VALE|PODE|JUSTA/i.test(cab.join(' ')) ? ' rg-vv' : '';
      html.push(`<div class="rg-tabela${vv}"><table><thead><tr>${cab.map(c => `<th>${inline(c.trim())}</th>`).join('')}</tr></thead><tbody>` +
        corpo.map(r => `<tr>${r.map((c, i) => `<td${cab[i] ? ` data-col="${esc(cab[i].trim().replace(/\*\*/g, ''))}"` : ''}>${celula(c)}</td>`).join('')}</tr>`).join('') +
        '</tbody></table></div>');
      continue;
    }
    if (b.startsWith('> ')) { html.push(`<p class="rg-nota">${inline(linhas.map(l => l.replace(/^>\s?/, '')).join(' '))}</p>`); continue; }
    // artigo (ou parágrafo) com lista opcional embaixo
    const corpo = [], itens = [];
    for (const l of linhas) (l.startsWith('- ') ? itens : corpo).push(l.startsWith('- ') ? l.slice(2) : l);
    const txt = corpo.join(' ').trim();
    const ul = itens.length ? '<ul class="rg-lista">' + itens.map(i => `<li>${inline(i)}</li>`).join('') + '</ul>' : '';
    const ma = /^\*\*Art\. ([0-9]+\.[0-9]+[A-Z]?)\*\*\s*(.*)$/.exec(txt);
    if (ma) {
      const id = idArt(ma[1]);
      const resto = ma[2].replace(/^((?:\[(?:NOVO|ALTERADO)\]\s*)*)—\s*/, '$1');
      html.push(`<div class="rg-art" id="${id}"><p><a class="rg-artn" href="#${id}">Art. ${esc(ma[1])}</a> ${inline(resto)}</p>${ul}</div>`);
    } else if (txt || ul) {
      html.push(`${txt ? `<p class="rg-p">${inline(txt)}</p>` : ''}${ul}`);
    }
  }
  if (abriuCap) html.push('</section>');
  return { html: html.join('\n'), capitulos: caps, artigos: arts.size };
}

module.exports = { SANTA_FE, STATUS, garantir, listar, contagem, doc, pdfDe, salvar, salvarPdf, historico, restaurar, renderizar, slugOk };
