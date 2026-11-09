const $ = s => document.querySelector(s);
const { esc, brl, icon, CATS } = GM;
let db = GM.load();
let filtro = 'todos';
let bag = [];
try { bag = JSON.parse(localStorage.getItem('gm_bag')) || []; } catch { }
const saveBag = () => { try { localStorage.setItem('gm_bag', JSON.stringify(bag)); } catch { } };
const prod = id => db.produtos.find(p => p.id === id);
const thumb = (p, s = 1.6) => p.foto ? `<img src="${p.foto}" alt="${esc(p.nome)}" loading="lazy">` : GM.catIcon(CATS[p.categoria], s);

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); }

// ---------- links de contato ----------
const msgPadrao = 'Olá! Vim pelo site da GIOR Move & Style e gostaria de ajuda para escolher meu look.';
$('#heroWhats').href = $('#ctaWhats').href = $('#fab').href = GM.waLink(GM.WHATS, msgPadrao);
$('#ctaInsta').href = `https://ig.me/m/${GM.INSTA}`;
$('#ano').textContent = new Date().getFullYear();

// ---------- header / menu ----------
const hdr = $('#hdr');
const onScroll = () => hdr.classList.toggle('scrolled', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
$('#menuBtn').onclick = () => $('#nav').classList.toggle('on');
$('#nav').onclick = e => e.target.closest('a') && $('#nav').classList.remove('on');

// ---------- marquee ----------
const palavras = ['Fitness Feminino', 'Tênis', 'Oversized', 'Bermudas', 'Move & Style', 'Pronta entrega', 'Levamos até você'];
$('#marquee').innerHTML = [...palavras, ...palavras].map(w => `<span>${w}</span>`).join('');

// ---------- categorias ----------
const catsComProdutos = () => Object.entries(CATS).filter(([k]) => db.produtos.some(p => p.categoria === k));
function renderCats() {
  $('#cats').innerHTML = catsComProdutos().map(([k, c], i) => {
  const n = db.produtos.filter(p => p.categoria === k).length;
  return `<a href="#colecao" class="cat rv" style="--d:${i}" data-cat="${k}">${GM.catIcon(c, 1.1)}<b>${esc(c.nome)}</b><small>${n} ${n === 1 ? 'modelo' : 'modelos'}</small></a>`;
}).join('');
}
$('#cats').onclick = e => { const c = e.target.closest('[data-cat]'); if (c) setFiltro(c.dataset.cat); };

// ---------- vitrine ----------
function setFiltro(f) { filtro = f; renderChips(); renderGrid(); }
function renderChips() {
  $('#chips').innerHTML = [['todos', 'Todos'], ...catsComProdutos().map(([k, c]) => [k, esc(c.nome)])]
    .map(([k, n]) => `<button class="chip ${filtro === k ? 'on' : ''}" data-f="${k}">${n}</button>`).join('');
}
$('#chips').onclick = e => { const b = e.target.closest('[data-f]'); if (b) setFiltro(b.dataset.f); };

function renderGrid() {
  const lista = db.produtos.filter(p => filtro === 'todos' || p.categoria === filtro);
  $('#grid').innerHTML = lista.map((p, i) => `
    <article class="card rv" style="--d:${i % 4}" data-id="${p.id}">
      <span class="pill tag ${p.estoque > 0 ? 'tag-ok' : 'tag-enc'}"><span class="dot"></span>${p.estoque > 0 ? 'Pronta entrega' : 'Sob encomenda'}</span>
      <div class="ph">${thumb(p)}</div>
      <div class="info">
        <span class="cat-name">${esc(CATS[p.categoria]?.nome ?? '')}</span>
        <h3>${esc(p.nome)}</h3>
        <div class="row">
          <span class="price">${brl(p.preco)}</span>
          <select aria-label="Tamanho">${(CATS[p.categoria]?.tamanhos ?? ['Único']).map(t => `<option>${t}</option>`).join('')}</select>
          <button class="add" aria-label="Adicionar ${esc(p.nome)} à sacola"><svg><use href="#i-plus"/></svg></button>
        </div>
      </div>
    </article>`).join('') || '<p class="lead">Nenhum produto nesta categoria.</p>';
  observe();
}
$('#grid').addEventListener('click', e => {
  const b = e.target.closest('.add'); if (!b) return;
  const card = b.closest('.card'), id = card.dataset.id, tamanho = card.querySelector('select').value;
  const it = bag.find(i => i.produtoId === id && i.tamanho === tamanho);
  it ? it.qtd++ : bag.push({ produtoId: id, tamanho, qtd: 1 });
  saveBag(); updateCount(true); toast(`${prod(id).nome} (${tamanho}) adicionado à sacola`);
});
// efeito 3D
$('#grid').addEventListener('mousemove', e => {
  if (matchMedia('(hover: none)').matches) return;
  const c = e.target.closest('.card'); if (!c) return;
  const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
  c.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
});
$('#grid').addEventListener('mouseout', e => { const c = e.target.closest('.card'); if (c && !c.contains(e.relatedTarget)) c.style.transform = ''; });

// ---------- reveal ----------
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 });
const observe = () => document.querySelectorAll('.rv:not(.in)').forEach(el => io.observe(el));

// ---------- parallax emblema + cursor ----------
const glow = document.querySelector('.cursor-glow'), emb = $('#emblem');
addEventListener('pointermove', e => {
  glow.style.left = e.clientX + 'px'; glow.style.top = e.clientY + 'px';
  emb.style.setProperty('--mx', (e.clientX / innerWidth - .5) * 18 + 'px');
  emb.style.setProperty('--my', (e.clientY / innerHeight - .5) * 18 + 'px');
}, { passive: true });

// ---------- sacola ----------
function updateCount(bump) {
  const n = bag.reduce((s, i) => s + i.qtd, 0), c = $('#bagCount');
  c.textContent = n; c.classList.toggle('on', n > 0);
  if (bump) { const b = $('#bagBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
}
function openBag(atendimento) {
  renderBag(atendimento);
  $('#drawer').classList.add('on'); $('#veil').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false');
}
function closeBag() { $('#drawer').classList.remove('on'); $('#veil').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); }
$('#bagBtn').onclick = () => openBag();
$('#agendarBtn').onclick = () => openBag('provador');
$('#closeBag').onclick = $('#veil').onclick = closeBag;
addEventListener('keydown', e => e.key === 'Escape' && closeBag());

function renderBag(atendimento = 'entrega') {
  const itens = bag.filter(i => prod(i.produtoId));
  const total = itens.reduce((s, i) => s + prod(i.produtoId).preco * i.qtd, 0);
  const temEncomenda = itens.some(i => prod(i.produtoId).estoque < i.qtd);
  $('#bagBody').innerHTML = `
    ${itens.length ? itens.map((i, k) => { const p = prod(i.produtoId); return `
      <div class="bag-item"><div class="thumb">${thumb(p, .62)}</div>
        <div><b>${esc(p.nome)}</b><br><small>Tam. ${esc(i.tamanho)} · ${brl(p.preco)} ${p.estoque < i.qtd ? '· <span style="color:var(--gold-1)">sob encomenda</span>' : ''}</small></div>
        <div class="qty"><button data-q="${k}" data-d="-1" aria-label="Diminuir">−</button><b>${i.qtd}</b><button data-q="${k}" data-d="1" aria-label="Aumentar">+</button></div>
      </div>`; }).join('') + `<div class="bag-total"><span>Total estimado</span><span>${brl(total)}</span></div>`
      : `<div class="empty"><svg width="40" height="40"><use href="#i-bag"/></svg><span>Sua sacola está vazia.<br>Adicione produtos da coleção ou conte abaixo o que você procura.</span></div>`}
    ${temEncomenda ? '<p class="note">⚠ Alguns itens serão confirmados como <b>encomenda</b>: avisamos disponibilidade, valor e prazo antes de fechar.</p>' : ''}
    <form id="resForm" style="display:grid;gap:1rem">
      <label class="field">Seu nome<input name="cliente" required autocomplete="name"></label>
      <label class="field">WhatsApp<input name="telefone" required inputmode="tel" placeholder="(48) 99999-9999" autocomplete="tel"></label>
      <label class="field">Instagram (opcional)<input name="instagram" placeholder="@seuperfil"></label>
      <label class="field">Bairro / cidade<input name="local" required placeholder="Ex.: Centro, Criciúma"></label>
      <div class="field">Como prefere ser atendido(a)?
        <div class="opts">
          <label class="opt"><input type="radio" name="atendimento" value="entrega" ${atendimento === 'entrega' ? 'checked' : ''}><span>Receber o pedido<small>Entregamos no local combinado</small></span></label>
          <label class="opt"><input type="radio" name="atendimento" value="provador" ${atendimento === 'provador' ? 'checked' : ''}><span>Ver de perto<small>Levamos opções para você provar</small></span></label>
        </div>
      </div>
      <div class="field">Forma de pagamento preferida
        <div class="opts" style="grid-template-columns:repeat(3,1fr)">
          ${['Pix', 'Débito', 'Crédito'].map((p, i) => `<label class="opt"><input type="radio" name="pagamento" value="${p}" ${i ? '' : 'checked'}><span>${p}</span></label>`).join('')}
        </div>
      </div>
      <div class="field">Enviar reserva por
        <div class="opts">
          <label class="opt"><input type="radio" name="canal" value="WhatsApp" checked><span>WhatsApp</span></label>
          <label class="opt"><input type="radio" name="canal" value="Direct"><span>Direct Instagram</span></label>
        </div>
      </div>
      <label class="field">Observações<textarea name="obs" rows="2" placeholder="Modelos, cores, tamanhos, melhor horário..."></textarea></label>
      <button class="btn"><svg><use href="#i-send"/></svg>Enviar reserva</button>
      <p class="note">A reserva não é uma compra: nossa equipe confirma estoque, valores e combina pagamento e entrega com você.</p>
    </form>`;
  $('#resForm').onsubmit = enviar;
}
$('#bagBody').addEventListener('click', e => {
  const b = e.target.closest('[data-q]'); if (!b) return;
  const atend = $('#resForm input[name=atendimento]:checked')?.value;
  const it = bag.filter(i => prod(i.produtoId))[b.dataset.q];
  it.qtd += +b.dataset.d; bag = bag.filter(i => i.qtd > 0);
  saveBag(); updateCount(); renderBag(atend);
});

function enviar(e) {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  if (f.telefone.replace(/\D/g, '').length < 10) return toast('Informe um WhatsApp válido com DDD');
  const itens = bag.filter(i => prod(i.produtoId)).map(i => { const p = prod(i.produtoId); return { produtoId: p.id, nome: p.nome, tamanho: i.tamanho, qtd: i.qtd, preco: p.preco }; });
  if (!itens.length && !f.obs.trim()) return toast('Adicione produtos ou conte nas observações o que procura');
  db = GM.load(); // pega pedidos que o painel possa ter criado
  const num = Math.max(1000, ...db.pedidos.map(o => +o.id.slice(3))) + 1;
  const pedido = {
    id: 'GM-' + num, cliente: f.cliente.trim(), telefone: f.telefone.trim(), instagram: f.instagram.trim(), canal: f.canal,
    tipo: itens.some(i => prod(i.produtoId).estoque < i.qtd) ? 'encomenda' : 'pronta', itens, local: f.local.trim(),
    atendimento: f.atendimento, pagamento: f.pagamento, status: 'novo', historico: [{ status: 'novo', em: Date.now() }],
    criado: Date.now(), obs: f.obs.trim(), baixaEstoque: false,
  };
  const linhas = itens.map(i => `• ${i.qtd}x ${i.nome} (tam. ${i.tamanho}) – ${brl(i.preco * i.qtd)}`).join('\n');
  const msg = `Olá, GIOR! Fiz uma reserva pelo site.\n\nPedido: *${pedido.id}*\nNome: ${pedido.cliente}\n${linhas || ''}${itens.length ? `\nTotal estimado: ${brl(GM.total(pedido))}` : ''}\n\nAtendimento: ${f.atendimento === 'provador' ? 'quero ver de perto' : 'receber o pedido'}\nLocal: ${pedido.local}\nPagamento: ${pedido.pagamento}${pedido.obs ? `\nObs.: ${pedido.obs}` : ''}`;
  pedido.mensagens = [{ texto: msg, em: Date.now() }];
  db.pedidos.push(pedido);
  GM.notificar(db, pedido, `Reserva pelo site: ${itens.length ? linhas.replace(/\n/g, ' ') : pedido.obs}`);
  if (!GM.save(db)) return;
  bag = []; saveBag(); updateCount();

  const href = f.canal === 'WhatsApp' ? GM.waLink(GM.WHATS, msg) : `https://ig.me/m/${GM.INSTA}`;
  if (f.canal === 'Direct') navigator.clipboard?.writeText(msg).catch(() => { });

  $('#bagBody').innerHTML = `
    <div class="ok-box">
      <div class="check"><svg><use href="#i-check"/></svg></div>
      <h3 class="h-display" style="font-size:2.2rem">Reserva criada!</h3>
      <span class="note">Seu código de acompanhamento</span>
      <span class="code gold-text">${pedido.id}</span>
      <p class="note">Agora envie a reserva para nossa equipe${f.canal === 'Direct' ? ' (a mensagem já foi copiada, é só colar no direct)' : ''}.</p>
      <a class="btn" href="${href}" target="_blank" rel="noopener"><svg><use href="#i-${f.canal === 'WhatsApp' ? 'chat' : 'insta'}"/></svg>Enviar pelo ${f.canal}</a>
      <a class="btn ghost" href="#rastrear" id="goTrack">Acompanhar pedido</a>
    </div>`;
  $('#goTrack').onclick = () => { closeBag(); $('#trackInput').value = pedido.id; track(pedido.id); };
}

// ---------- rastrear ----------
function track(codigo) {
  db = GM.load();
  const c = codigo.trim().toUpperCase().replace(/^GM-?/, 'GM-');
  const o = db.pedidos.find(p => p.id === c);
  const res = $('#trackRes');
  if (!o) { res.innerHTML = `<p class="lead">Não encontramos o pedido <b>${esc(c)}</b>. Confira o código ou fale com a gente.</p>`; return; }
  const feito = new Set(o.historico.map(h => h.status));
  const quando = s => o.historico.findLast(h => h.status === s)?.em;
  const etapas = o.status === 'cancelado' ? [...GM.fluxoDe(o).filter(s => feito.has(s.id)), GM.ST.cancelado] : [...GM.fluxoDe(o), GM.ST.entregue];
  res.innerHTML = `
    <div class="order-card">
      <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center">
        <b style="font-family:var(--f-brand)">${o.id}</b>
        <span class="pill" style="color:${GM.ST[o.status].cor};background:${GM.ST[o.status].cor}22"><span class="dot"></span>${GM.ST[o.status].nome}</span>
      </div>
      <p class="note" style="margin-top:.6rem">${esc(GM.ST[o.status].desc)}</p>
      <p class="note" style="margin-top:.6rem">${o.itens.map(i => `${i.qtd}x ${esc(i.nome)} (${esc(i.tamanho)})`).join(' · ') || 'Atendimento personalizado'}${o.itens.length ? ` — <b style="color:var(--text)">${brl(GM.total(o))}</b>` : ''}</p>
    </div>
    <div class="timeline">${etapas.map((s, k) => {
      const cls = s.id === o.status ? 'done now' : feito.has(s.id) ? 'done' : 'todo';
      return `<div class="tl ${cls}" style="--k:${k}"><span class="dotc">${cls === 'todo' ? k + 1 : '<svg width="14" height="14"><use href="#i-check"/></svg>'}</span><div><b>${s.nome}</b><small>${quando(s.id) ? GM.dth(quando(s.id)) : 'Aguardando'}</small></div></div>`;
    }).join('')}</div>`;
}
$('#trackForm').onsubmit = e => { e.preventDefault(); track($('#trackInput').value); };
const hashCode = decodeURIComponent(location.hash).match(/rastrear=(GM-\d+)/i);
if (hashCode) { $('#trackInput').value = hashCode[1]; track(hashCode[1]); setTimeout(() => $('#rastrear').scrollIntoView(), 300); }

// atualiza a vitrine se o painel mudar algo em outra aba
addEventListener('storage', e => { if (e.key === GM.KEY) { db = GM.load(); if (filtro !== 'todos' && !CATS[filtro]) filtro = 'todos'; renderCats(); renderChips(); renderGrid(); observe(); } });

renderCats(); renderChips(); renderGrid(); updateCount(); observe();
