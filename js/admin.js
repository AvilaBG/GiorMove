const $ = s => document.querySelector(s);
const { esc, brl, icon, CATS, ST, STATUS } = GM;
let db = GM.load();
let view = 'dash', stFiltro = '';
const charts = {};
const dlg = $('#dlg');
const prod = id => db.produtos.find(p => p.id === id);
const thumb = p => p?.foto ? `<img src="${p.foto}" alt="">` : GM.catIcon(CATS[p?.categoria], .55);
const mesNome = () => new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const pill = st => `<span class="pill" style="color:${st.cor};background:${st.cor}1f"><span class="dot"></span>${st.nome}</span>`;
const dur = d => d < 1 / 24 ? '<1h' : d < 1 ? Math.round(d * 24) + 'h' : Math.round(d) + 'd';
const svg = id => `<svg><use href="#i-${id}"/></svg>`;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2800); }
function save() { if (GM.save(db)) renderAll(); }

// ---------- navegação ----------
const VIEWS = {
  dash: ['Dashboard', () => 'Resumo de ' + mesNome(), ''],
  prod: ['Produtos', () => `${db.produtos.length} produtos cadastrados`, `<button class="btn sm" id="newProd">${svg('plus')}Novo produto</button>`],
  cat: ['Categorias', () => `${Object.keys(CATS).length} categorias · aparecem no site quando têm produtos`, `<button class="btn sm" id="newCat">${svg('plus')}Nova categoria</button>`],
  ped: ['Pedidos', () => 'Pedidos do WhatsApp, Direct e site, ordenados por prioridade', `<button class="btn sm" id="newOrder">${svg('plus')}Novo pedido</button>`],
};
function go(v) {
  view = v;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
  scrollTo(0, 0);
  renderAll();
}
$('#tabs').onclick = e => { const b = e.target.closest('[data-v]'); if (b) go(b.dataset.v); };
$('#topActions').onclick = e => { if (e.target.closest('#newProd')) openProduct(); if (e.target.closest('#newOrder')) openOrder(); if (e.target.closest('#newCat')) openCategory(); };
$('#resetBtn').onclick = $('#resetBtn2').onclick = () => { if (confirm('Restaurar os dados de demonstração? Todas as alterações serão perdidas.')) { db = GM.reset(); renderAll(); toast('Dados de demonstração restaurados'); } };

function renderAll() {
  const [t, sub, actions] = VIEWS[view];
  $('#title').textContent = t; $('#subtitle').textContent = sub(); $('#topActions').innerHTML = actions;
  const abertos = db.pedidos.filter(GM.aberto).length;
  $('#navCount').textContent = abertos; $('#navCount').style.display = abertos ? '' : 'none';
  ({ dash: renderDash, prod: renderProducts, cat: renderCategories, ped: renderOrders })[view]();
}

// ---------- estatísticas ----------
// mesmoPeriodo: corta o mês no mesmo dia/hora de hoje (comparação justa com o mês anterior)
function stats(off = 0, mesmoPeriodo = false) {
  const corte = GM.inicioMes(off) + (Date.now() - GM.inicioMes(0));
  const ped = db.pedidos.filter(o => GM.doMes(o, off) && (!mesmoPeriodo || GM.pagoEm(o) <= corte));
  const porProd = {};
  ped.forEach(o => o.itens.forEach(i => porProd[i.produtoId] = (porProd[i.produtoId] || 0) + i.qtd));
  return { ped, porProd, receita: ped.reduce((s, o) => s + GM.total(o), 0), unidades: Object.values(porProd).reduce((a, b) => a + b, 0) };
}
const kpi = (ic, lbl, val, sub) => `<div class="panel kpi"><div class="lbl">${svg(ic)}${lbl}</div><div class="val">${val}</div><div class="sub">${sub}</div></div>`;

// ---------- dashboard ----------
if (window.Chart) { Object.assign(Chart.defaults, { color: '#9a9ca3', borderColor: 'rgba(255,255,255,.06)' }); Object.assign(Chart.defaults.font, { family: 'Manrope', weight: 600, size: 11 }); }
const compacto = v => v >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : 'R$ ' + v;
function chart(id, cfg) { charts[id]?.destroy(); if (window.Chart) charts[id] = new Chart($('#' + id), cfg); }

function renderDash() {
  const s = stats(0), s0 = stats(-1, true);
  const abertos = db.pedidos.filter(GM.aberto);
  const atrasados = abertos.filter(o => GM.atraso(o) > 0).length, novos = abertos.filter(o => o.status === 'novo').length;
  const delta = s0.receita ? (s.receita / s0.receita - 1) * 100 : null;
  $('#kpis').innerHTML =
    kpi('money', 'Receita do mês', brl(s.receita), delta == null ? 'Sem dados do mês anterior' : `<b class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(0)}%</b> vs mesmo período do mês anterior`) +
    kpi('bag', 'Produtos vendidos', s.unidades + ' un.', `${s.ped.length} pedidos pagos no mês`) +
    kpi('alert', 'Pedidos sem atender', abertos.length, `<b class="${atrasados ? 'down' : 'up'}">${atrasados} atrasados</b> · ${novos} novos sem contato`) +
    kpi('ticket', 'Ticket médio', brl(s.ped.length ? s.receita / s.ped.length : 0), 'Valor médio por pedido pago');

  // receita diária
  // só até hoje (mín. 7 dias) para as barras ocuparem o cartão em vez de deixar o resto do mês vazio
  const n = new Date(), fimMes = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
  const porDia = Array.from({ length: Math.min(fimMes, Math.max(7, n.getDate())) }, (_, d) => d < n.getDate() ? 0 : null);
  s.ped.forEach(o => porDia[new Date(GM.pagoEm(o)).getDate() - 1] += GM.total(o));
  $('#mesLbl').textContent = `1 a ${n.getDate()} de ${n.toLocaleDateString('pt-BR', { month: 'long' })}`;
  const ctx = $('#cRev').getContext('2d'), grad = ctx.createLinearGradient(0, 0, 0, 290);
  grad.addColorStop(0, '#f5d98b'); grad.addColorStop(1, 'rgba(184,134,47,.25)');
  chart('cRev', {
    type: 'bar',
    data: { labels: porDia.map((_, i) => i + 1), datasets: [{ data: porDia, backgroundColor: grad, hoverBackgroundColor: '#fbe7a1', borderRadius: 6, maxBarThickness: 22 }] },
    options: {
      maintainAspectRatio: false, animation: { duration: 900, easing: 'easeOutQuart' },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: c => `Dia ${c[0].label}`, label: c => brl(c.raw ?? 0) } } },
      layout: { padding: { top: 6 } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 6 }, title: { display: true, text: 'Dia do mês' } },
        y: { beginAtZero: true, grace: '8%', ticks: { maxTicksLimit: 6, callback: compacto }, grid: { color: 'rgba(255,255,255,.05)' } },
      },
    },
  });

  // mais vendidos
  const top = Object.entries(s.porProd).sort((a, b) => b[1] - a[1]);
  const fatias = top.slice(0, 5).map(([id, q]) => [prod(id)?.nome ?? db.pedidos.flatMap(o => o.itens).find(i => i.produtoId === id)?.nome ?? 'Produto removido', q]);
  const resto = top.slice(5).reduce((a, [, q]) => a + q, 0);
  if (resto) fatias.push(['Outros', resto]);
  const cores = ['#e2b85a', '#f5d98b', '#b8862f', '#7a5518', '#d6d4cf', '#4b4d55'];
  chart('cPie', {
    type: 'doughnut',
    data: { labels: fatias.map(f => f[0]), datasets: [{ data: fatias.map(f => f[1]), backgroundColor: cores, borderColor: '#111216', borderWidth: 3, hoverOffset: 8 }] },
    options: { maintainAspectRatio: false, cutout: '64%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.raw} un.` } } } },
  });
  $('#pieLegend').innerHTML = fatias.map(([nome, q], i) => `<div><i style="background:${cores[i]}"></i><span>${esc(nome)}</span><b>${q}</b></div>`).join('') || '<p class="muted">Nenhuma venda paga neste mês ainda.</p>';

  // atenção + funil
  $('#attn').innerHTML = abertos.sort((a, b) => GM.atraso(b) - GM.atraso(a)).slice(0, 6).map(o => `
    <button data-o="${o.id}">${prio(o)}<span><b>${o.id}</b> · ${esc(o.cliente)}<small>${ST[o.status].nome}</small></span><b>${brl(GM.total(o))}</b></button>`).join('') || '<p class="muted">Nenhum pedido em aberto 🎉</p>';
  const max = Math.max(1, ...STATUS.map(st => abertos.filter(o => o.status === st.id).length));
  $('#funnel').innerHTML = STATUS.filter(st => !st.final).map(st => { const c = abertos.filter(o => o.status === st.id).length; return `<div><span>${st.nome}</span><span class="bar"><i style="width:${c / max * 100}%;background:${st.cor}"></i></span><b>${c}</b></div>`; }).join('');
}
$('#attn').onclick = e => { const b = e.target.closest('[data-o]'); if (b) openOrder(b.dataset.o); };

// ---------- produtos ----------
$('#pSearch').oninput = $('#pCat').onchange = () => renderProducts();

function renderProducts() {
  const catSel = $('#pCat').value;
  $('#pCat').innerHTML = '<option value="">Todas as categorias</option>' + Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${k === catSel ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
  const s = stats(0), ps = db.produtos;
  const unidades = ps.reduce((a, p) => a + p.estoque, 0), semEstoque = ps.filter(p => !p.estoque).length;
  $('#prodKpis').innerHTML =
    kpi('tag', 'Produtos cadastrados', ps.length, `${new Set(ps.map(p => p.categoria)).size} categorias`) +
    kpi('box', 'Unidades em estoque', unidades, `<b class="${semEstoque ? 'down' : 'up'}">${semEstoque} sem estoque</b> (sob encomenda)`) +
    kpi('money', 'Valor de inventário', brl(ps.reduce((a, p) => a + p.preco * p.estoque, 0)), 'Preço de venda × estoque') +
    kpi('bag', 'Vendidos no mês', s.unidades + ' un.', `${brl(s.receita)} em vendas pagas`);
  const q = $('#pSearch').value.trim().toLowerCase(), cat = $('#pCat').value;
  const lista = ps.filter(p => (!cat || p.categoria === cat) && p.nome.toLowerCase().includes(q));
  $('#pBody').innerHTML = lista.map(p => `
    <tr>
      <td class="c-prod"><div class="prod-cell"><span class="thumb">${thumb(p)}</span>${esc(p.nome)}</div></td>
      <td class="c-cat" data-l="Categoria">${esc(CATS[p.categoria]?.nome ?? '-')}</td>
      <td class="nowrap c-price" data-l="Preço">${brl(p.preco)}</td>
      <td data-l="Estoque" class="c-stock nowrap ${p.estoque === 0 ? 'zero' : p.estoque <= 3 ? 'low' : ''}"><b>${p.estoque}</b> un.${p.estoque === 0 ? ' · encomenda' : p.estoque <= 3 ? ' · baixo' : ''}</td>
      <td class="c-sold" data-l="Vendidos no mês">${s.porProd[p.id] || 0} un.</td>
      <td class="nowrap c-act" style="text-align:right">
        <button class="icon-btn" data-edit="${p.id}" aria-label="Editar ${esc(p.nome)}">${svg('edit')}</button>
        <button class="icon-btn del" data-del="${p.id}" aria-label="Excluir ${esc(p.nome)}">${svg('trash')}</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="6" class="muted" style="text-align:center;padding:2rem">Nenhum produto encontrado.</td></tr>';
}
$('#pBody').onclick = e => {
  const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
  if (ed) openProduct(ed.dataset.edit);
  if (del) { const p = prod(del.dataset.del); if (confirm(`Excluir "${p.nome}"? Os pedidos já registrados mantêm o histórico.`)) { db.produtos = db.produtos.filter(x => x !== p); save(); toast('Produto excluído'); } }
};

function resizeImage(file, max = 640, tipo = 'image/jpeg') {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = img.width * k; c.height = img.height * k;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src); res(c.toDataURL(tipo, .82));
    };
    img.onerror = rej; img.src = URL.createObjectURL(file);
  });
}

function openProduct(id) {
  if (!Object.keys(CATS).length) { go('cat'); return toast('Crie uma categoria primeiro'); }
  const p = id ? prod(id) : { nome: '', categoria: Object.keys(CATS)[0], preco: '', estoque: 0, foto: null };
  let foto = p.foto;
  dlg.innerHTML = `
    <form method="dialog" id="pForm">
      <header><h2>${id ? 'Editar produto' : 'Novo produto'}</h2><button type="button" class="icon-btn x" data-close aria-label="Fechar">✕</button></header>
      <div class="mbody">
        <div class="photo-pick">
          <span class="thumb" id="pPrev">${thumb(p)}</span>
          <div style="display:grid;gap:.5rem">
            <label class="btn sm cam-btn">${svg("camera")}Tirar foto<input type="file" accept="image/*" capture="environment" class="pFoto" hidden></label>
            <label class="btn sm dark">${svg("image")}Escolher da galeria<input type="file" accept="image/*" class="pFoto" hidden></label>
            <button type="button" class="btn sm ghost" id="pNoFoto">Remover foto</button>
          </div>
        </div>
        <label class="field">Nome<input name="nome" required maxlength="80" value="${esc(p.nome)}"></label>
        <div class="g3">
          <label class="field">Categoria<select name="categoria">${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${k === p.categoria ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>
          <label class="field">Preço (R$)<input name="preco" type="number" min="0" step="0.01" required value="${p.preco}"></label>
          <label class="field">Estoque (un.)<input name="estoque" type="number" min="0" step="1" required value="${p.estoque}"></label>
        </div>
        <p class="muted">Produtos com estoque 0 aparecem no site como <b>Sob encomenda</b>.</p>
      </div>
      <div class="mfoot"><span class="sp"></span><button type="button" class="btn sm ghost" data-close>Cancelar</button><button class="btn sm">Salvar produto</button></div>
    </form>`;
  const prev = () => $('#pPrev').innerHTML = thumb({ ...p, foto, categoria: $('#pForm').categoria.value });
  document.querySelectorAll('.pFoto').forEach(i => i.onchange = async e => { const f = e.target.files[0]; if (!f) return; try { foto = await resizeImage(f); prev(); } catch { toast('Não foi possível ler esta imagem'); } e.target.value = ''; });
  $('#pNoFoto').onclick = () => { foto = null; prev(); };
  $('#pForm').categoria.onchange = prev;
  $('#pForm').onsubmit = e => {
    const f = e.target, preco = +f.preco.value, estoque = +f.estoque.value;
    if (!f.nome.value.trim() || preco < 0 || estoque < 0 || !Number.isInteger(estoque)) { e.preventDefault(); return toast('Confira nome, preço e estoque'); }
    const dados = { nome: f.nome.value.trim(), categoria: f.categoria.value, preco, estoque, foto };
    id ? Object.assign(p, dados) : db.produtos.push({ id: 'p' + Date.now(), ...dados });
    save(); toast(id ? 'Produto atualizado' : 'Produto cadastrado');
  };
  dlg.showModal();
}
dlg.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target === dlg) dlg.close(); });

// ---------- pedidos ----------
function prio(o) {
  if (!GM.aberto(o)) return `<span class="pill prio-done">Finalizado</span>`;
  const a = GM.atraso(o);
  if (a > 0) return `<span class="pill prio-late"><span class="dot"></span>Atrasado ${dur(a)}</span>`;
  if (a > -.3) return `<span class="pill prio-soon"><span class="dot"></span>Vence em ${dur(-a)}</span>`;
  return `<span class="pill prio-ok"><span class="dot"></span>No prazo</span>`;
}
const opcoesStatus = o => [...GM.fluxoDe(o), ST.entregue, ST.cancelado];
const proximo = o => { const f = [...GM.fluxoDe(o), ST.entregue], i = f.findIndex(s => s.id === o.status); return i >= 0 && i < f.length - 1 ? f[i + 1] : null; };

function waMsg(o) {
  const st = ST[o.status], nome = o.cliente.split(' ')[0];
  const link = new URL('index.html#rastrear=' + o.id, location.href).href;
  const extra = {
    novo: 'Recebemos seu pedido e já vamos verificar tudo para você.',
    estoque: 'Estamos conferindo a disponibilidade dos tamanhos. Já te retornamos!',
    pagamento: `Está tudo certo com o seu pedido! Total: *${brl(GM.total(o))}*.\nAceitamos Pix, débito ou crédito. Como prefere pagar?`,
    entrega: o.atendimento === 'provador' ? 'Vamos combinar o melhor local e horário para você conhecer os produtos?' : 'Vamos combinar o melhor local e horário para a entrega?',
  }[o.status] ?? st.desc;
  return `Olá, ${nome}! Aqui é da GIOR Move & Style.\n\nPedido *${o.id}*: *${st.nome}*\n${extra}\n\nAcompanhe seu pedido: ${link}`;
}

$('#oSearch').oninput = $('#oScope').onchange = () => renderOrders();
$('#stChips').onclick = e => { const b = e.target.closest('[data-st]'); if (b) { stFiltro = stFiltro === b.dataset.st ? '' : b.dataset.st; renderOrders(); } };

function renderOrders() {
  const scope = $('#oScope').value, q = $('#oSearch').value.trim().toLowerCase();
  const pool = db.pedidos.filter(o => stFiltro || scope === 'todos' || (scope === 'abertos') === GM.aberto(o));
  $('#stChips').innerHTML = `<button class="chip ${stFiltro ? '' : 'on'}" data-st="">Todos <i>${pool.length}</i></button>` +
    STATUS.map(st => { const c = db.pedidos.filter(o => o.status === st.id).length; return c ? `<button class="chip ${stFiltro === st.id ? 'on' : ''}" data-st="${st.id}"><span class="dot" style="background:${st.cor}"></span>${st.nome} <i>${c}</i></button>` : ''; }).join('');
  const lista = pool
    .filter(o => !stFiltro || o.status === stFiltro)
    .filter(o => !q || [o.id, o.cliente, o.telefone, o.instagram, o.local].join(' ').toLowerCase().includes(q))
    // abertos: mais atrasados primeiro; finalizados: mais recentes primeiro
    .sort((a, b) => (GM.aberto(b) - GM.aberto(a)) || (GM.aberto(a) ? GM.atraso(b) - GM.atraso(a) : GM.ultimaAtualizacao(b) - GM.ultimaAtualizacao(a)));
  $('#oBody').innerHTML = lista.map(o => {
    const st = ST[o.status], itens = o.itens.map(i => `${i.qtd}x ${i.nome}`);
    return `<tr class="click ${GM.atraso(o) > 0 ? 'late' : ''}" data-o="${o.id}">
      <td class="c-prio"><span class="prio">${prio(o)}<span class="muted">há ${dur((Date.now() - GM.ultimaAtualizacao(o)) / GM.DAY)} no status</span></span></td>
      <td class="nowrap c-id"><b>${o.id}</b><br><span class="muted">${GM.dth(o.criado)}</span></td>
      <td class="c-cli"><b>${esc(o.cliente)}</b>${o.auto ? ' <span class="pill auto-pill">⚡ Revisar</span>' : ''}<br><span class="muted">${esc(o.canal)} · ${esc(o.local)}</span></td>
      <td class="c-items" style="max-width:220px"><span title="${esc(itens.join(', '))}">${esc(itens[0] ?? 'A definir')}</span>${itens.length > 1 ? ` <span class="muted">+${itens.length - 1}</span>` : ''}</td>
      <td class="nowrap c-total"><b>${brl(GM.total(o))}</b><br><span class="muted">${esc(o.pagamento)}</span></td>
      <td class="nowrap c-tipo">${o.tipo === 'encomenda' ? 'Encomenda' : 'Pronta entrega'}<br><span class="muted">${o.atendimento === 'provador' ? 'Ver de perto' : 'Entrega'}</span></td>
      <td class="c-st"><select class="st-select" data-st-of="${o.id}" style="color:${st.cor}" aria-label="Status de ${o.id}">${opcoesStatus(o).map(s => `<option value="${s.id}" ${s.id === o.status ? 'selected' : ''}>${s.nome}</option>`).join('')}</select></td>
      <td class="nowrap c-contact">
        <a class="icon-btn wa" href="${GM.waLink(GM.foneCliente(o.telefone), waMsg(o))}" target="_blank" rel="noopener" aria-label="WhatsApp de ${esc(o.cliente)}">${svg('chat')}</a>
        ${o.instagram ? `<a class="icon-btn" href="https://ig.me/m/${esc(o.instagram.replace('@', ''))}" target="_blank" rel="noopener" aria-label="Direct de ${esc(o.cliente)}">${svg('insta')}</a>` : ''}
      </td></tr>`;
  }).join('') || '<tr><td colspan="8" class="muted" style="text-align:center;padding:2rem">Nenhum pedido encontrado.</td></tr>';
}
$('#oBody').addEventListener('change', e => {
  const sel = e.target.closest('[data-st-of]'); if (!sel) return;
  const o = db.pedidos.find(p => p.id === sel.dataset.stOf);
  GM.setStatus(db, o, sel.value); save();
  toast(`${o.id} → ${ST[o.status].nome}. Avise o cliente pelo WhatsApp.`);
});
$('#oBody').addEventListener('click', e => {
  if (e.target.closest('select, a')) return;
  const tr = e.target.closest('tr[data-o]'); if (tr) openOrder(tr.dataset.o);
});

function openOrder(id) {
  const orig = id && db.pedidos.find(p => p.id === id);
  if (orig) { (db.notificacoes ?? []).forEach(n => { if (n.pedidoId === id) n.lida = true; }); GM.save(db); renderBell?.(); }
  const num = Math.max(1000, ...db.pedidos.map(o => +o.id.slice(3))) + 1;
  const o = orig ? structuredClone(orig) : { id: 'GM-' + num, cliente: '', telefone: '', instagram: '', canal: 'WhatsApp', tipo: 'pronta', itens: [], local: '', atendimento: 'entrega', pagamento: 'Pix', status: 'novo', historico: [{ status: 'novo', em: Date.now() }], criado: Date.now(), obs: '', baixaEstoque: false };
  const sel = (name, opts, v) => `<select name="${name}">${opts.map(([k, t]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  const prox = orig && proximo(orig);
  dlg.innerHTML = `
    <form method="dialog" id="oForm">
      <header><h2>${orig ? 'Pedido ' + o.id : 'Novo pedido'}</h2>${orig ? pill(ST[o.status]) : ''}<button type="button" class="icon-btn x" data-close aria-label="Fechar">✕</button></header>
      <div class="mbody">
        ${o.mensagens?.length ? `<div class="section-t">Mensagem recebida · ${esc(o.canal)}</div><div class="chat">${o.mensagens.map(m => `<div class="bubble"><p>${esc(m.texto)}</p><small>${GM.dth(m.em)}</small></div>`).join('')}</div>${o.auto ? '<p class="auto-note">⚡ Pedido criado automaticamente a partir da mensagem. Confira itens, tamanhos e dados e salve para marcar como revisado.</p>' : ''}` : ''}
        <div class="section-t">Cliente</div>
        <div class="g2">
          <label class="field">Nome<input name="cliente" required value="${esc(o.cliente)}"></label>
          <label class="field">WhatsApp<input name="telefone" required inputmode="tel" placeholder="(48) 99999-9999" value="${esc(o.telefone)}"></label>
          <label class="field">Instagram<input name="instagram" placeholder="@perfil" value="${esc(o.instagram)}"></label>
          <label class="field">Bairro / cidade<input name="local" value="${esc(o.local)}"></label>
        </div>
        <div class="section-t">Pedido</div>
        <div class="g2">
          <label class="field">Recebido por${sel('canal', [['WhatsApp', 'WhatsApp'], ['Direct', 'Direct Instagram'], ['Site', 'Site']], o.canal)}</label>
          <label class="field">Tipo${sel('tipo', [['pronta', 'Pronta entrega'], ['encomenda', 'Encomenda']], o.tipo)}</label>
          <label class="field">Atendimento${sel('atendimento', [['entrega', 'Entrega do pedido'], ['provador', 'Ver de perto (levar opções)']], o.atendimento)}</label>
          <label class="field">Pagamento${sel('pagamento', [['Pix', 'Pix'], ['Débito', 'Débito'], ['Crédito', 'Crédito']], o.pagamento)}</label>
        </div>
        <div class="field">Itens<div class="items" id="items"></div></div>
        <button type="button" class="btn sm ghost" id="addItem" style="justify-self:start">${svg('plus')}Adicionar item</button>
        <div class="sum"><span>Total</span><span id="oTotal"></span></div>
        <label class="field">Status${sel('status', opcoesStatus(o).map(s => [s.id, s.nome]), o.status)}</label>
        <label class="field">Observações internas<textarea name="obs" rows="2">${esc(o.obs)}</textarea></label>
        ${orig ? `<div class="section-t">Histórico</div><div class="hist">${o.historico.map(h => `<div><i style="background:${ST[h.status].cor}"></i><span>${ST[h.status].nome}</span><span class="muted">${GM.dth(h.em)}</span></div>`).join('')}</div>` : ''}
      </div>
      <div class="mfoot">
        ${orig ? `<button type="button" class="icon-btn del" id="delOrder" aria-label="Excluir pedido">${svg('trash')}</button>
        <a class="btn sm dark" target="_blank" rel="noopener" href="${GM.waLink(GM.foneCliente(o.telefone), waMsg(o))}">${svg('chat')}Avisar no WhatsApp</a>` : ''}
        <span class="sp"></span>
        ${prox ? `<button type="button" class="btn sm dark" id="advance">${svg('next')}${prox.nome}</button>` : ''}
        <button class="btn sm">Salvar</button>
      </div>
    </form>`;

  const f = $('#oForm');
  const renderItems = () => {
    $('#items').innerHTML = o.itens.map((it, k) => {
      const p = prod(it.produtoId), tams = CATS[p?.categoria]?.tamanhos ?? [it.tamanho];
      return `<div class="item-row" data-k="${k}">
        <select data-f="produtoId" aria-label="Produto">${!p ? `<option value="${it.produtoId}">${esc(it.nome)} (removido)</option>` : ''}${db.produtos.map(x => `<option value="${x.id}" ${x.id === it.produtoId ? 'selected' : ''}>${esc(x.nome)}${x.estoque ? '' : ' (encomenda)'}</option>`).join('')}</select>
        <select data-f="tamanho" aria-label="Tamanho">${tams.map(t => `<option ${t === it.tamanho ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <input data-f="qtd" type="number" min="1" step="1" value="${it.qtd}" aria-label="Quantidade">
        <span class="nowrap">${brl(it.preco * it.qtd)}</span>
        <button type="button" class="icon-btn del" data-rm aria-label="Remover item">✕</button>
      </div>`;
    }).join('') || '<p class="muted">Nenhum item ainda. Pedidos de "ver de perto" podem ficar sem itens até o atendimento.</p>';
    $('#oTotal').textContent = brl(GM.total(o));
  };
  $('#items').onchange = e => {
    const row = e.target.closest('[data-k]'), it = o.itens[row.dataset.k], campo = e.target.dataset.f;
    if (campo === 'produtoId') { const p = prod(e.target.value); Object.assign(it, { produtoId: p.id, nome: p.nome, preco: p.preco, tamanho: GM.tamPadrao(CATS[p.categoria]) }); }
    else it[campo] = campo === 'qtd' ? Math.max(1, Math.round(+e.target.value) || 1) : e.target.value;
    renderItems();
  };
  $('#items').onclick = e => { const rm = e.target.closest('[data-rm]'); if (rm) { o.itens.splice(rm.closest('[data-k]').dataset.k, 1); renderItems(); } };
  $('#addItem').onclick = () => { const p = db.produtos[0]; if (!p) return toast('Cadastre um produto primeiro'); o.itens.push({ produtoId: p.id, nome: p.nome, tamanho: GM.tamPadrao(CATS[p.categoria]), qtd: 1, preco: p.preco }); renderItems(); };
  renderItems();

  const salvar = status => {
    if (!f.cliente.value.trim() || f.telefone.value.replace(/\D/g, '').length < 10) { toast('Informe nome e WhatsApp com DDD'); return false; }
    const dados = Object.fromEntries(['cliente', 'telefone', 'instagram', 'canal', 'tipo', 'local', 'atendimento', 'pagamento', 'obs'].map(k => [k, f[k].value.trim()]));
    // shortcut: editar itens de pedido já pago não reajusta o estoque; ajuste manual em Produtos se necessário
    const alvo = orig ?? o;
    Object.assign(alvo, dados, { itens: o.itens, auto: false });
    if (!orig) db.pedidos.push(alvo);
    GM.setStatus(db, alvo, status);
    save(); toast(orig ? 'Pedido atualizado' : `Pedido ${alvo.id} criado`);
    return true;
  };
  f.onsubmit = e => { if (!salvar(f.status.value)) e.preventDefault(); };
  $('#advance')?.addEventListener('click', () => { if (salvar(prox.id)) dlg.close(); });
  $('#delOrder')?.addEventListener('click', () => { if (confirm(`Excluir o pedido ${o.id}? Esta ação não pode ser desfeita.`)) { db.pedidos = db.pedidos.filter(p => p !== orig); save(); dlg.close(); toast('Pedido excluído'); } });
  dlg.showModal();
}

// ---------- categorias ----------
const slug = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat';
const qtdProdutos = k => db.produtos.filter(p => p.categoria === k).length;

function renderCategories() {
  $('#catGrid').innerHTML = Object.entries(CATS).map(([k, c]) => {
    const n = qtdProdutos(k);
    return `<div class="panel cat-card">
      ${GM.catIcon(c, .7)}
      <div class="cat-info"><b>${esc(c.nome)}</b><span class="muted">${n} ${n === 1 ? 'produto' : 'produtos'}${n ? '' : ' · oculta no site'}</span><span class="muted">Tam.: ${esc(c.tamanhos.join(', '))}</span></div>
      <div class="cat-act">
        <button class="icon-btn" data-edit-cat="${k}" aria-label="Editar ${esc(c.nome)}">${svg('edit')}</button>
        <button class="icon-btn del" data-del-cat="${k}" aria-label="Excluir ${esc(c.nome)}">${svg('trash')}</button>
      </div>
    </div>`;
  }).join('') || '<p class="muted">Nenhuma categoria. Crie a primeira para cadastrar produtos.</p>';
}
$('#catGrid').onclick = e => {
  const ed = e.target.closest('[data-edit-cat]'), del = e.target.closest('[data-del-cat]');
  if (ed) openCategory(ed.dataset.editCat);
  if (del) {
    const k = del.dataset.delCat, n = qtdProdutos(k);
    if (n) return toast(`"${CATS[k].nome}" tem ${n} ${n === 1 ? 'produto' : 'produtos'}. Mova ou exclua antes de remover a categoria.`);
    if (confirm(`Excluir a categoria "${CATS[k].nome}"?`)) { delete CATS[k]; save(); toast('Categoria excluída'); }
  }
};

function openCategory(k) {
  const c = k ? CATS[k] : { nome: '', icon: 0, tamanhos: ['P', 'M', 'G', 'GG'] };
  let sel = c.icon ?? 0;
  const emUso = id => Object.entries(CATS).filter(([key, x]) => key !== k && x.icon === id).map(([, x]) => x.nome);
  dlg.innerHTML = `
    <form method="dialog" id="cForm">
      <header><h2>${k ? 'Editar categoria' : 'Nova categoria'}</h2><button type="button" class="icon-btn x" data-close aria-label="Fechar">✕</button></header>
      <div class="mbody">
        <label class="field">Nome<input name="nome" required maxlength="40" value="${esc(c.nome)}" placeholder="Ex.: Acessórios"></label>
        <div class="field">Ícone
          <div class="icon-pick" id="iconPick"></div>
          <span class="muted">Toque em <b>+</b> para adicionar um ícone novo (foto ou imagem PNG). Ele fica salvo para usar em outras categorias.</span>
        </div>
        <label class="field">Tamanhos (separados por vírgula)<input name="tamanhos" value="${esc(c.tamanhos.join(', '))}" placeholder="P, M, G, GG"></label>
        <p class="muted">Os tamanhos aparecem para o cliente ao escolher produtos desta categoria. Deixe vazio para "Único".</p>
      </div>
      <div class="mfoot"><span class="sp"></span><button type="button" class="btn sm ghost" data-close>Cancelar</button><button class="btn sm">Salvar categoria</button></div>
    </form>`;
  const f = $('#cForm'), pick = $('#iconPick');
  const renderPick = () => {
    pick.innerHTML =
      GM.ICONES.map(([i, nome]) => `<label title="${nome}"><input type="radio" name="icon" value="${i}" ${sel === i ? 'checked' : ''}>${icon(i, .62)}</label>`).join('') +
      GM.ICONES_USER.map(u => `<span class="user"><label title="Ícone enviado"><input type="radio" name="icon" value="${u.id}" ${sel === u.id ? 'checked' : ''}>${GM.iconeUser(u.src, .62)}</label><button type="button" class="rm" data-rm-ico="${u.id}" aria-label="Remover ícone">✕</button></span>`).join('') +
      `<label class="add-ico" title="Adicionar ícone" aria-label="Adicionar ícone">${svg('plus')}<input type="file" accept="image/*" id="icoFile" hidden></label>`;
  };
  renderPick();
  pick.onchange = async e => {
    if (e.target.name === 'icon') { const v = e.target.value; sel = /^\d+$/.test(v) ? +v : v; return; }
    if (e.target.id !== 'icoFile') return;
    const file = e.target.files[0]; if (!file) return;
    try {
      const src = await resizeImage(file, 256, 'image/png'); // png mantém fundo transparente de ícones
      const id = 'u' + Date.now();
      GM.ICONES_USER.push({ id, src }); sel = id;
      GM.save(db); renderPick(); toast('Ícone adicionado');
    } catch { toast('Não foi possível ler esta imagem'); }
  };
  pick.onclick = e => {
    const b = e.target.closest('[data-rm-ico]'); if (!b) return;
    const id = b.dataset.rmIco, usos = emUso(id);
    if (usos.length) return toast(`Ícone em uso por: ${usos.join(', ')}`);
    if (!confirm('Remover este ícone da biblioteca?')) return;
    GM.ICONES_USER.splice(GM.ICONES_USER.findIndex(u => u.id === id), 1);
    if (sel === id) sel = 0;
    if (k && CATS[k].icon === id) CATS[k].icon = 0;
    GM.save(db); renderPick();
  };
  f.onsubmit = e => {
    const nome = f.nome.value.trim();
    const dup = Object.entries(CATS).some(([key, x]) => key !== k && x.nome.toLowerCase() === nome.toLowerCase());
    if (!nome || dup) { e.preventDefault(); return toast(dup ? 'Já existe uma categoria com esse nome' : 'Informe o nome'); }
    const tamanhos = [...new Set(f.tamanhos.value.split(',').map(t => t.trim()).filter(Boolean))];
    const dados = { nome, icon: sel, tamanhos: tamanhos.length ? tamanhos : ['Único'] };
    if (k) Object.assign(CATS[k], dados);
    else { let key = slug(nome), n = 2; while (CATS[key]) key = slug(nome) + '-' + n++; CATS[key] = dados; }
    save(); toast(k ? 'Categoria atualizada' : 'Categoria criada');
  };
  dlg.showModal();
}

renderAll();

// ---------- notificações + simulador de mensagens (representa a integração WhatsApp/Instagram) ----------
const notifs = () => db.notificacoes ?? (db.notificacoes = []);
const naoLidas = () => notifs().filter(n => !n.lida).length;
const canalIco = c => c === 'Direct' ? 'insta' : c === 'Site' ? 'ext' : 'chat';
const tituloBase = document.title;

function renderBell() {
  const n = naoLidas();
  $('#bellCount').textContent = n; $('#bellCount').style.display = n ? '' : 'none';
  document.title = (n ? `(${n}) ` : '') + tituloBase;
  if ($('#notif').hidden) return;
  $('#notifList').innerHTML = notifs().slice(0, 30).map(n => `
    <button class="notif-item ${n.lida ? '' : 'unread'}" data-n="${n.id}">
      <span class="ch ch-${n.canal}">${svg(canalIco(n.canal))}</span>
      <span class="txt"><span><b>${esc(n.cliente)}</b> <span class="muted">· ${esc(n.canal)} · ${GM.dth(n.em)}</span></span><span class="prev">${esc(n.texto)}</span><span class="muted">Pedido ${esc(n.pedidoId)} criado</span></span>
    </button>`).join('') || '<p class="muted" style="padding:1rem">Nenhuma notificação.</p>';
}
function toggleNotif(force) {
  const p = $('#notif'); p.hidden = force === undefined ? !p.hidden : !force;
  $('#bellBtn').setAttribute('aria-expanded', !p.hidden);
  renderBell();
}
$('#bellBtn').onclick = e => { e.stopPropagation(); toggleNotif(); };
document.addEventListener('click', e => { if (!$('#notif').hidden && !e.target.closest('#notif, #bellBtn')) toggleNotif(false); });
$('#notif').addEventListener('click', e => {
  if (e.target.closest('#readAll')) { notifs().forEach(n => n.lida = true); GM.save(db); renderBell(); }
  if (e.target.closest('[data-sim]')) simularMensagem(e.target.closest('[data-sim]').dataset.sim);
  const it = e.target.closest('[data-n]');
  if (it) { const n = notifs().find(x => x.id === it.dataset.n); n.lida = true; GM.save(db); toggleNotif(false); renderBell(); if (db.pedidos.some(o => o.id === n.pedidoId)) openOrder(n.pedidoId); else toast('Este pedido foi excluído'); }
});

let audioCtx;
function alertar(n) {
  toast(`🔔 Novo pedido ${n.pedidoId} via ${n.canal}: ${n.cliente}`);
  try { // "plim" curto; navegadores só liberam áudio depois de uma interação com a página
    audioCtx ??= new AudioContext();
    [880, 1320].forEach((f, i) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + i * .12; o.frequency.value = f; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + .26); });
  } catch { }
  if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([120, 60, 120]); // o navegador bloqueia antes do 1º toque
  const b = $('#bellBtn'); b.classList.remove('ring'); void b.offsetWidth; b.classList.add('ring');
  renderBell();
}

const NOMES_SIM = ['Luana Bortolotto', 'Jéssica Damiani', 'Renata Comin', 'Kauã Bez', 'Débora Feltrin', 'Sabrina Mazzuco', 'Mateus Zanatta', 'Priscila Bitencourt', 'Letícia Rovaris', 'Amanda Uggioni'];
const BAIRROS_SIM = ['Centro', 'Próspera', 'Pinheirinho', 'Santa Bárbara', 'Michel', 'Içara', 'Comerciário', 'Rio Maina'];
function simularMensagem(canal = Math.random() < .55 ? 'WhatsApp' : 'Direct') {
  const ps = db.produtos.filter(p => CATS[p.categoria]); if (!ps.length) return toast('Cadastre produtos primeiro');
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const nome = pick(NOMES_SIM), itens = [...new Set([pick(ps), Math.random() < .35 ? pick(ps) : null].filter(Boolean))]
    .map(p => ({ produtoId: p.id, nome: p.nome, tamanho: pick(CATS[p.categoria].tamanhos), qtd: 1, preco: p.preco }));
  const o = {
    id: 'GM-' + (Math.max(1000, ...db.pedidos.map(x => +x.id.slice(3))) + 1), cliente: nome,
    telefone: `(48) 9${8000 + Math.floor(Math.random() * 1999)}-${1000 + Math.floor(Math.random() * 8999)}`,
    instagram: canal === 'Direct' ? '@' + nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(' ', '.') : '',
    canal, tipo: itens.some(i => prod(i.produtoId).estoque < 1) ? 'encomenda' : 'pronta', itens, local: pick(BAIRROS_SIM),
    atendimento: Math.random() < .3 ? 'provador' : 'entrega', pagamento: pick(['Pix', 'Débito', 'Crédito']), status: 'novo',
    historico: [{ status: 'novo', em: Date.now() }], criado: Date.now(), obs: '', baixaEstoque: false, auto: true,
  };
  const texto = GM.msgCliente(o);
  o.mensagens = [{ texto, em: Date.now() }];
  db.pedidos.push(o); GM.notificar(db, o, texto);
  if (GM.save(db)) { renderAll(); alertar(notifs()[0]); }
}

// demo: mensagens automáticas enquanto o painel está aberto
let autoTimer = null;
const autoLigado = () => { try { return localStorage.getItem('gm_auto_msgs') === '1'; } catch { return false; } };
function setAuto(on) {
  try { localStorage.setItem('gm_auto_msgs', on ? '1' : '0'); } catch { }
  clearInterval(autoTimer); autoTimer = on ? setInterval(() => simularMensagem(), 30000) : null;
  $('#autoMsgs').checked = on;
}
$('#autoMsgs').onchange = e => { setAuto(e.target.checked); toast(e.target.checked ? 'Uma mensagem simulada chegará a cada 30 segundos' : 'Mensagens automáticas desligadas'); };
setAuto(autoLigado());

// pedidos feitos no site (outra aba) chegam como notificação
let vistas = new Set(notifs().map(n => n.id));
addEventListener('storage', e => {
  if (e.key !== GM.KEY) return;
  db = GM.load(); renderAll();
  const novas = notifs().filter(n => !vistas.has(n.id));
  vistas = new Set(notifs().map(n => n.id));
  if (novas.length) alertar(novas[0]);
});

renderBell();
