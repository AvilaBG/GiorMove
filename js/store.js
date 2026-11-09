// Dados compartilhados entre o site e o painel (demo: tudo em localStorage).
const GM = (() => {
  const DAY = 864e5;
  const WHATS = '5548996474013';
  const INSTA = 'gior.move';

  // icon = índice do ícone na arte da marca (0-5) ou foto própria (dataURL)
  const DEFAULT_CATS = {
    fitness:   { nome: 'Fitness Feminino', icon: 0, tamanhos: ['P', 'M', 'G', 'GG'] },
    tenis:     { nome: 'Tênis',            icon: 1, tamanhos: ['35', '36', '37', '38', '39', '40', '41', '42', '43'] },
    oversized: { nome: 'Oversized',        icon: 3, tamanhos: ['P', 'M', 'G', 'GG', 'XG'] },
    bermudas:  { nome: 'Bermudas',         icon: 5, tamanhos: ['P', 'M', 'G', 'GG'] },
  };

  // Objeto vivo: preenchido no load() e salvo junto com os dados (db.categorias === CATS)
  const CATS = {};
  const ICONES = [[0, 'Fitness'], [1, 'Tênis'], [2, 'Pessoas'], [3, 'Camiseta'], [4, 'Atendimento'], [5, 'Bermuda']];

  // Fluxo manual de venda. sla = dias que o pedido pode ficar no status antes de ficar "atrasado".
  const STATUS = [
    { id: 'novo',       nome: 'Novo pedido',          cor: '#60a5fa', sla: 0.5, desc: 'Recebemos seu pedido! Em breve entraremos em contato.' },
    { id: 'estoque',    nome: 'Verificando estoque',  cor: '#a78bfa', sla: 1,   desc: 'Estamos conferindo tamanhos e disponibilidade.' },
    { id: 'pagamento',  nome: 'Aguardando pagamento', cor: '#fbbf24', sla: 2,   desc: 'Valor e condições confirmados. Aguardando pagamento via Pix, débito ou crédito.' },
    { id: 'pago',       nome: 'Pagamento confirmado', cor: '#34d399', sla: 1,   desc: 'Pagamento recebido. Obrigado!' },
    { id: 'encomenda',  nome: 'Aguardando chegada',   cor: '#f472b6', sla: 12,  desc: 'Produto encomendado ao fornecedor. Avisamos assim que chegar.', soEncomenda: true },
    { id: 'preparando', nome: 'Preparando pacote',    cor: '#fb923c', sla: 1,   desc: 'Seu pedido está sendo separado e embalado.' },
    { id: 'entrega',    nome: 'Entrega agendada',     cor: '#22d3ee', sla: 2,   desc: 'Local e horário combinados. Levamos até você!' },
    { id: 'entregue',   nome: 'Entregue',             cor: '#d4a64a', final: true, desc: 'Pedido entregue. Aproveite seu look!' },
    { id: 'cancelado',  nome: 'Cancelado',            cor: '#6b7280', final: true, desc: 'Pedido cancelado.' },
  ];
  const ST = Object.fromEntries(STATUS.map(s => [s.id, s]));
  const PAGOS = ['pago', 'encomenda', 'preparando', 'entrega', 'entregue'];

  const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dt = t => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const dth = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const icon = (i, s = 1) => `<span class="ico" style="--i:${i};--s:${s}"></span>`;
  // Ícones enviados pelo lojista: [{ id: 'u…', src: dataURL png }]. Objeto vivo salvo em db.icones.
  const ICONES_USER = [];
  const srcIcone = id => ICONES_USER.find(i => i.id === id)?.src;
  const iconeUser = (src, s = 1) => `<span class="ico ico-img" style="--s:${s}"><img src="${src}" alt=""></span>`;
  // c.icon: número = ícone da marca; texto = ícone enviado
  const catIcon = (c, s = 1) => typeof c?.icon === 'string' && srcIcone(c.icon) ? iconeUser(srcIcone(c.icon), s) : icon(typeof c?.icon === 'number' ? c.icon : 2, s);
  const tamPadrao = c => c?.tamanhos?.[1] ?? c?.tamanhos?.[0] ?? 'Único';

  // ---------- seed determinístico ----------
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function seedProducts() {
    const p = [
      ['Legging Sculpt Gold', 'fitness', 159.9, 14], ['Top Nadador Move', 'fitness', 89.9, 22],
      ['Conjunto Seamless Aura', 'fitness', 229.9, 6], ['Macaquinho Fit Studio', 'fitness', 179.9, 3],
      ['Shorts Biker Power', 'fitness', 99.9, 18], ['Tênis Runner Gold Pulse', 'tenis', 499.9, 5],
      ['Tênis Street Move Preto', 'tenis', 429.9, 0], ['Tênis Training Flex', 'tenis', 389.9, 7],
      ['Camiseta Oversized GIOR Classic', 'oversized', 129.9, 25], ['Oversized Heavy Graphite', 'oversized', 149.9, 11],
      ['Moletom Oversized Concrete', 'oversized', 259.9, 0], ['Bermuda Dry Fit Motion', 'bermudas', 109.9, 16],
      ['Bermuda Moletom Urban', 'bermudas', 139.9, 9], ['Bermuda Tactel Gold Line', 'bermudas', 119.9, 2],
    ];
    return p.map(([nome, categoria, preco, estoque], i) => ({ id: 'p' + (i + 1), nome, categoria, preco, estoque, foto: null }));
  }

  function seedOrders(products) {
    const r = rng(42), pick = a => a[Math.floor(r() * a.length)], now = Date.now();
    const nomes = ['Ana Paula Souza', 'Juliana Martins', 'Camila Rocha', 'Fernanda Lima', 'Bruna Alves', 'Larissa Costa', 'Gabriel Silva', 'Lucas Pereira', 'Mariana Duarte', 'Rafael Gomes', 'Beatriz Nunes', 'Patrícia Melo', 'Thiago Becker', 'Aline Zanette', 'Vitória Cardoso', 'Eduardo Rosso', 'Natália Fabris', 'Isadora Pavei', 'Carolina Dal Pont', 'Pedro Machado'];
    const bairros = ['Centro', 'Próspera', 'Pinheirinho', 'Santa Bárbara', 'Michel', 'Comerciário', 'Rio Maina', 'Pio Corrêa', 'Ana Maria', 'Içara', 'Forquilhinha', 'Cocal do Sul'];
    const abertos = ['novo', 'novo', 'estoque', 'estoque', 'pagamento', 'pagamento', 'pago', 'encomenda', 'preparando', 'entrega'];
    const out = [];
    for (let i = 0; i < 96; i++) {
      const dias = i < 14 ? r() * 3 : 3 + r() * 45;
      const criado = now - dias * DAY - r() * 8 * 36e5;
      const itens = Array.from({ length: 1 + Math.floor(r() * r() * 3) }, () => {
        const p = pick(products);
        return { produtoId: p.id, nome: p.nome, tamanho: pick(CATS[p.categoria].tamanhos.slice(1, 5)), qtd: r() < .8 ? 1 : 2, preco: p.preco };
      });
      const tipo = itens.some(it => products.find(p => p.id === it.produtoId).estoque === 0) || r() < .15 ? 'encomenda' : 'pronta';
      const alvo = dias > 3 ? (r() < .88 ? 'entregue' : 'cancelado') : pick(abertos);
      const fluxo = STATUS.filter(s => !s.final && (tipo === 'encomenda' || !s.soEncomenda)).map(s => s.id);
      let caminho = alvo === 'cancelado' ? [...fluxo.slice(0, 1 + Math.floor(r() * 3)), 'cancelado']
        : alvo === 'entregue' ? [...fluxo, 'entregue'] : fluxo.slice(0, fluxo.indexOf(alvo) + 1);
      if (alvo === 'encomenda' && tipo !== 'encomenda') caminho = fluxo.slice(0, fluxo.indexOf('pago') + 1);
      const passo = Math.min(1.1 * DAY, (now - criado) / (caminho.length + .5));
      const historico = caminho.map((s, k) => ({ status: s, em: Math.min(now - 36e5, criado + k * passo * (0.6 + r() * 0.4)) }));
      const nome = nomes[i % nomes.length];
      out.push({
        id: 'GM-' + (1001 + i), cliente: nome, telefone: `(48) 9${8000 + Math.floor(r() * 1999)}-${1000 + Math.floor(r() * 8999)}`,
        instagram: '@' + nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(' ').slice(0, 2).join('.'),
        canal: r() < .55 ? 'WhatsApp' : r() < .8 ? 'Direct' : 'Site', tipo, itens, local: pick(bairros),
        atendimento: r() < .5 ? 'provador' : 'entrega', pagamento: pick(['Pix', 'Pix', 'Débito', 'Crédito']),
        status: caminho.at(-1), historico, criado, obs: '', baixaEstoque: alvo !== 'cancelado' && caminho.some(s => PAGOS.includes(s)), // estoque do seed já é pós-venda
      });
    }
    return out.sort((a, b) => a.criado - b.criado).map((o, i) => ({ ...o, id: 'GM-' + (1001 + i) }));
  }

  // ---------- mensagens / notificações ----------
  function msgCliente(o) {
    const lista = o.itens.map(i => `${i.qtd > 1 ? i.qtd + 'x ' : ''}${i.nome} tam. ${i.tamanho}`).join(', ');
    const t = [
      `Oi! Tudo bem? Tenho interesse em: ${lista}. Ainda tem? Sou de ${o.local}.`,
      `Olá! Queria reservar ${lista}. Vocês entregam em ${o.local}? Pago no ${o.pagamento}.`,
      `Boa tarde! Vi no perfil de vocês: ${lista}. Se tiver, quero 🙏`,
    ];
    return o.itens.length ? t[(+o.id.slice(3) || 0) % t.length] : 'Oi! Queria ver algumas opções de vocês, podem me ajudar?';
  }
  function notificar(d, o, texto) {
    (d.notificacoes ??= []).unshift({ id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6), pedidoId: o.id, canal: o.canal, cliente: o.cliente, texto, em: Date.now(), lida: false });
    d.notificacoes.length = Math.min(d.notificacoes.length, 60);
  }
  // dados antigos/seed: cria notificações dos pedidos novos que vieram por mensagem
  function prepNotif(d) {
    if (d.notificacoes) return;
    d.notificacoes = d.pedidos.filter(o => o.status === 'novo' && o.canal !== 'Site').map(o => {
      o.mensagens ??= [{ texto: msgCliente(o), em: o.criado }];
      return { id: 'n' + o.id, pedidoId: o.id, canal: o.canal, cliente: o.cliente, texto: o.mensagens[0].texto, em: o.criado, lida: false };
    }).sort((a, b) => b.em - a.em);
  }

  // ---------- persistência ----------
  const KEY = 'gm_demo_v3';
  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch { }
    Object.keys(CATS).forEach(k => delete CATS[k]);
    Object.assign(CATS, d?.categorias ?? structuredClone(DEFAULT_CATS));
    ICONES_USER.length = 0; ICONES_USER.push(...(d?.icones ?? []));
    // migra a "foto própria" antiga da categoria para a biblioteca de ícones
    Object.entries(CATS).forEach(([k, c]) => { if (c.foto) { ICONES_USER.push({ id: 'u-' + k, src: c.foto }); c.icon = 'u-' + k; delete c.foto; } });
    if (d?.produtos) { d.categorias = CATS; d.icones = ICONES_USER; prepNotif(d); return d; }
    const produtos = seedProducts();
    d = { categorias: CATS, icones: ICONES_USER, produtos, pedidos: seedOrders(produtos) };
    prepNotif(d);
    save(d); return d;
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; }
    catch { alert('Não foi possível salvar (armazenamento do navegador cheio). Tente uma foto menor.'); return false; }
  }
  const reset = () => { localStorage.removeItem(KEY); return load(); };

  // ---------- regras ----------
  const total = o => o.itens.reduce((s, i) => s + i.preco * i.qtd, 0);
  const ultimaAtualizacao = o => o.historico.at(-1)?.em ?? o.criado;
  const pagoEm = o => o.historico.find(h => PAGOS.includes(h.status))?.em ?? null;
  const aberto = o => !ST[o.status].final;
  // dias além do prazo do status atual (>0 = atrasado)
  const atraso = o => aberto(o) ? (Date.now() - ultimaAtualizacao(o)) / DAY - ST[o.status].sla : -Infinity;
  const fluxoDe = o => STATUS.filter(s => !s.final && (o.tipo === 'encomenda' || !s.soEncomenda));

  function setStatus(d, o, status) {
    if (o.status === status) return;
    // baixa no estoque quando o pagamento é confirmado; devolve se cancelar depois
    if (PAGOS.includes(status) && !o.baixaEstoque) { mexeEstoque(d, o, -1); o.baixaEstoque = true; }
    if (status === 'cancelado' && o.baixaEstoque) { mexeEstoque(d, o, 1); o.baixaEstoque = false; }
    o.status = status;
    o.historico.push({ status, em: Date.now() });
  }
  function mexeEstoque(d, o, sinal) {
    o.itens.forEach(i => { const p = d.produtos.find(p => p.id === i.produtoId); if (p) p.estoque = Math.max(0, p.estoque + sinal * i.qtd); });
  }

  const inicioMes = (off = 0) => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + off, 1).getTime(); };
  const doMes = (o, off = 0) => { const t = pagoEm(o); return t != null && o.status !== 'cancelado' && t >= inicioMes(off) && t < inicioMes(off + 1); };

  const waLink = (fone, msg) => `https://wa.me/${fone}?text=${encodeURIComponent(msg)}`;
  const foneCliente = f => { const d = String(f).replace(/\D/g, ''); return d.startsWith('55') ? d : '55' + d; };

  return { KEY, DAY, WHATS, INSTA, CATS, ICONES, ICONES_USER, iconeUser, catIcon, tamPadrao, msgCliente, notificar, STATUS, ST, PAGOS, brl, dt, dth, esc, icon, load, save, reset, total, ultimaAtualizacao, pagoEm, aberto, atraso, fluxoDe, setStatus, inicioMes, doMes, waLink, foneCliente };
})();
