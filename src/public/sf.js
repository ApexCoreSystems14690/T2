/* Santa Fé — foto da organização que não carrega (link quebrado, link que não é
   imagem direta, arquivo apagado) vira um selo com as iniciais na cor dela,
   em vez do ícone de imagem quebrada do navegador. */
function sfSemFoto(img) {
  if (!img || img.dataset.sfTrocado) return;
  img.dataset.sfTrocado = '1';
  var nome = (img.getAttribute('data-nome') || img.getAttribute('alt') || '').replace(/[—–-].*$/, '').trim();
  var ini = nome.split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p[0]; }).join('').toUpperCase() || '?';
  var cor = img.getAttribute('data-cor') || '#1D3F94';
  var cs = getComputedStyle(img);
  var d = document.createElement('span');
  d.className = (img.className ? img.className + ' ' : '') + 'sf-selo';
  d.textContent = ini;
  d.title = nome;
  d.style.cssText = 'display:inline-grid;place-items:center;flex-shrink:0;color:#fff;font-weight:800;' +
    'font-stretch:75%;font-variation-settings:"wdth" 75;letter-spacing:.02em;' +
    'width:' + cs.width + ';height:' + cs.height + ';border-radius:' + cs.borderRadius + ';' +
    'font-size:calc(' + cs.height + ' * .42);background:' + cor + ';';
  img.replaceWith(d);
}
