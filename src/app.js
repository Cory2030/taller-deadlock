'use strict';
/* ============================================================
   Taller de Deadlock — núcleo: datos, utilidades, router, almacén
   ============================================================ */

const D = { heroes: [], habilidades: {}, objetos: [], stats: null, sinergias: null, builds: null, objStats: null, rangos: [], version: null, guias: {}, meta: null, comps: null, objGuia: {}, parche: null, sistemas: null, itemizacion: null, habStats: null, compras: null, fases: {}, mapa: null, perfil: null, variantes: null, estadBuilds: null };
const IDX = { heroPorId: {}, heroPorClase: {}, heroPorNombre: {}, objPorClase: {}, objPorId: {}, objPorNombre: {} };
const PREF = (() => {
  let p = { nombres: 'en', ventana: '7d', bracket: 'todos', fuenteTier: 'datos' };
  try { p = Object.assign(p, JSON.parse(localStorage.getItem('td_pref') || '{}')); } catch (e) { /* sin almacenamiento */ }
  return p;
})();
function guardarPref() { try { localStorage.setItem('td_pref', JSON.stringify(PREF)); } catch (e) { /* sin almacenamiento */ } }

const RANURAS = { weapon: { nombre: 'Arma', clase: 'r-weapon', arq: 'arma' }, vitality: { nombre: 'Vitalidad', clase: 'r-vitality', arq: 'vitalidad' }, spirit: { nombre: 'Espíritu', clase: 'r-spirit', arq: 'espiritu' } };
const ARQUETIPOS = { arma: { nombre: 'Arma', corto: 'AR', clase: 'arq-arma', desc: 'Daño de disparos y cadencia: objetos de arma (naranja).' }, espiritu: { nombre: 'Espíritu', corto: 'ES', clase: 'arq-espiritu', desc: 'Poder de habilidades: objetos de espíritu (morado).' }, vitalidad: { nombre: 'Vitalidad', corto: 'VI', clase: 'arq-vitalidad', desc: 'Vida, resistencias y sostén: objetos de vitalidad (verde).' }, hibrido: { nombre: 'Híbrido', corto: 'HB', clase: 'arq-hibrido', desc: 'Mezcla equilibrada de arma y espíritu según la partida.' } };
const TIPOS_HEROE = { marksman: 'Tirador', mystic: 'Místico', brawler: 'Luchador', assassin: 'Asesino', support: 'Soporte', tank: 'Tanque' };
const TIERS = ['S', 'A', 'B', 'C', 'D'];

/* ---------- Utilidades DOM y formato ---------- */
// Red de seguridad: el append() nativo escribe como texto los arrays ("url1,url2") y los null ("null").
// Aquí se aplanan y se descartan, igual que hace el().
(() => {
  const nativo = Element.prototype.append;
  Element.prototype.append = function (...hijos) { return nativo.apply(this, hijos.flat(Infinity).filter((x) => x != null && x !== false)); };
})();
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function el(tag, attrs, ...hijos) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k === 'style' && typeof v === 'object') { for (const [p, val] of Object.entries(v)) { if (val == null) continue; if (p.startsWith('--')) e.style.setProperty(p, val); else e.style[p] = val; } }
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat(Infinity)) { if (h == null || h === false) continue; e.append(h instanceof Node ? h : document.createTextNode(typeof h === 'string' ? traducirNombres(h) : String(h))); }
  return e;
}
const fmtNum = new Intl.NumberFormat('es-ES');
// El formato es-ES no agrupa los números de 4 cifras (2300); aquí se fuerza el punto (2.300).
// Un formateador por nº de decimales: crearlo en cada llamada era lo más caro al pintar.
const FORMATEADORES = new Map();
function fmt(n, dec = 0) {
  if (n == null || Number.isNaN(n)) return '—';
  let f = FORMATEADORES.get(dec);
  if (!f) FORMATEADORES.set(dec, (f = new Intl.NumberFormat('es-ES', { maximumFractionDigits: dec, minimumFractionDigits: 0 })));
  return f.format(n).replace(/^(-?\d)(\d{3})(?=,|$)/, '$1.$2');
}
// Espacio duro antes de «%» para que no se separe del número al partir la línea
function fmtPct(n, dec = 1) { if (n == null) return '—'; return fmt(n, dec) + ' %'; }
function fmtSouls(n) { if (n == null) return '—'; return fmt(n) + ' almas'; }
function fmtFecha(ts) {
  if (!ts) return '—';
  let d;
  if (typeof ts === 'number') d = new Date(ts < 1e12 ? ts * 1000 : ts); // segundos Unix (API) o milisegundos (Date.now)
  else if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) { const [y, m, dd] = ts.split('-').map(Number); d = new Date(y, m - 1, dd); } // fecha de solo día: en hora local
  else d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}
const ETIQUETAS_OBJ = { dano_arma: 'Daño de arma', dano_espiritu: 'Daño de espíritu', tanque: 'Tanque', curacion: 'Curación', anti_curacion: 'Anticuración', movilidad: 'Movilidad', escape: 'Escape', control: 'Control', anti_control: 'Anticontrol', burst: 'Burst', sostenido: 'Daño sostenido', farmeo: 'Farmeo', linea: 'Línea', soporte: 'Soporte', vision: 'Visión', resistencia_bala: 'Resistencia a balas', resistencia_espiritu: 'Resistencia a espíritu', activo: 'Activo', imbuir: 'Imbuir', late_game: 'Final de partida', early_game: 'Inicio de partida', mid_game: 'Medio de partida' };
function etiquetaObj(t) { return ETIQUETAS_OBJ[t] || String(t).replace(/_/g, ' '); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function sinAcentos(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/** Texto de la API con marcas {{Clase|texto}} y **negrita** → HTML seguro */
function rico(texto) {
  if (!texto) return '';
  // Caracteres invisibles de unión y la terminación de género «vivo/a» de los textos del juego
  let s = esc(String(texto).replace(/[⁠​]/g, '').replace(/([a-záéíóúñ])\/a\b/g, '$1'));
  s = s.replace(/\{\{([A-Za-z_]+)\|([^}]*)\}\}/g, (m, c, t) => `<span class="atr atr-${esc(c)}">${t}</span>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  // Los textos del juego traen saltos de línea a mitad de frase: si sigue minúscula, es la misma frase
  s = s.replace(/\n(?=[a-záéíóúñ])/g, ' ').replace(/\n/g, '<br>');
  return s;
}

/* ---------- Héroes y objetos ---------- */
function nombreH(h) { if (!h) return '—'; return PREF.nombres === 'es' ? h.nombre : h.nombre_en; }
function nombreAlt(h) { if (!h || h.nombre === h.nombre_en) return ''; return PREF.nombres === 'es' ? h.nombre_en : h.nombre; }
function nombreO(o) { if (!o) return '—'; return PREF.nombres === 'es' ? o.nombre_es : o.nombre; }
/* Con «Nombres ES», los textos (cuándo, por qué, notas, análisis) cambian los nombres en inglés
   de objetos, habilidades y héroes por los del juego en español; también lo que se copia */
let REGEX_ES = null; let MAPA_ES = null;
function traducirNombres(t) {
  if (PREF.nombres !== 'es' || !t || typeof t !== 'string' || !D.objetos.length) return t;
  if (!REGEX_ES) {
    const m = new Map();
    for (const h of D.heroes) if (h.nombre_en && h.nombre && h.nombre_en !== h.nombre) m.set(h.nombre_en, h.nombre);
    for (const id in D.habilidades) for (const a of D.habilidades[id] || []) if (a.nombre_en && a.nombre && a.nombre_en !== a.nombre) m.set(a.nombre_en, a.nombre);
    for (const o of D.objetos) if (o.nombre && o.nombre_es && o.nombre !== o.nombre_es) m.set(o.nombre, o.nombre_es);
    // Nombres cortos que usan las guías y la comunidad («Kevlar», «Titanic»): solo si una palabra identifica un único objeto
    for (const corto of ['Transcendent', 'Kevlar', 'Reverb', 'Titanic', 'Plated', 'Overflow', 'Exposure', 'Locket', 'Crippling', 'Emblem', 'Cultist', 'Boundless']) {
      if (m.has(corto)) continue;
      const cand = D.objetos.filter((o) => o.nombre && o.nombre_es && o.nombre.split(/[\s']+/).includes(corto));
      if (cand.length === 1) m.set(corto, cand[0].nombre_es);
    }
    if (!m.size || !Object.keys(D.habilidades).length) return t;
    const claves = [...m.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c));
    REGEX_ES = new RegExp('(?<![\\p{L}\\p{N}])(?:' + claves.join('|') + ')(?![\\p{L}\\p{N}])', 'gu');
    MAPA_ES = m;
  }
  return t.replace(REGEX_ES, (x) => MAPA_ES.get(x) || x);
}
function nombreOAlt(o) { if (!o || o.nombre === o.nombre_es) return ''; return PREF.nombres === 'es' ? o.nombre : o.nombre_es; }
function heroe(idOClase) { return IDX.heroPorId[idOClase] || IDX.heroPorClase[idOClase] || IDX.heroPorNombre[sinAcentos(idOClase)] || null; }
function objeto(x) { if (!x) return null; return IDX.objPorClase[x] || IDX.objPorId[x] || IDX.objPorNombre[sinAcentos(x)] || null; }
/** Clases de los objetos con los que se hace (Sharpshooter = Long Range + High-Velocity Rounds) */
function compsDe(o) { return !o ? [] : Array.isArray(o.componentes) && o.componentes.length ? o.componentes : o.componente ? [o.componente] : []; }
function imgH(h, clase = 'icono-heroe') { return el('img', { loading: 'lazy', src: h.imagen.icono, alt: nombreH(h), class: clase, width: 36, height: 36 }); }
function imgO(o, attrs = {}) { return el('img', Object.assign({ loading: 'lazy', src: o.imagen, alt: nombreO(o), class: RANURAS[o.ranura] ? RANURAS[o.ranura].clase : '', title: nombreO(o) + ' · ' + fmtSouls(o.coste) }, attrs)); }
function chipH(h, extra, mini) {
  const a = el('a', { class: 'heroe-chip' + (mini ? ' mini' : ''), href: '#heroe-' + h.clase }, imgH(h, ''), el('span', null, nombreH(h)));
  if (extra != null) a.append(el('span', { class: 'num' }, extra));
  return a;
}
function chipO(o, attrs) {
  const b = el('button', Object.assign({ class: 'obj-mini ' + (RANURAS[o.ranura] ? RANURAS[o.ranura].clase : ''), type: 'button', onclick: () => abrirObjeto(o) }, attrs || {}), imgO(o), el('span', null, nombreO(o)));
  return b;
}
function insigniaTier(t) { return el('span', { class: 'insignia t-' + (t || 'sin'), title: t ? 'Tier ' + t : 'Sin datos suficientes' }, t || '–'); }
function pillArq(arq) { const a = ARQUETIPOS[arq] || ARQUETIPOS.hibrido; return el('span', { class: 'arquetipo ' + a.clase }, el('i'), a.nombre); }
function tipoHeroe(h) { return TIPOS_HEROE[h.tipo] || h.tipo || ''; }

/** Guía de investigación de un héroe (puede no existir) */
function guia(h) { return (h && D.guias && D.guias[h.id]) || null; }
/** Arquetipo principal: de la guía, o deducido de los objetos populares de fase final */
function arquetipoDe(h) {
  const g = guia(h); if (g && g.arquetipo_principal) return g.arquetipo_principal;
  if (!h.populares) return 'hibrido';
  const peso = { weapon: 0, vitality: 0, spirit: 0 };
  for (const p of h.populares.final) { const o = objeto(p.clase); if (o) peso[o.ranura] += p.pick; }
  const total = peso.weapon + peso.vitality + peso.spirit || 1;
  const w = peso.weapon / total, s = peso.spirit / total;
  if (w > 0.5) return 'arma'; if (s > 0.5) return 'espiritu';
  if (Math.abs(w - s) < 0.12) return 'hibrido';
  return w > s ? 'arma' : 'espiritu';
}
/** Estadísticas de un héroe en ventana/bracket */
function statsDe(h, ventana = PREF.ventana, bracket = PREF.bracket) {
  const v = D.stats && D.stats.datos[ventana]; const b = v && v[bracket]; if (!b) return null;
  return b.heroes.find((x) => x.id === h.id) || null;
}
function tierDe(h, ventana, bracket) { const s = statsDe(h, ventana, bracket); return s ? s.tier : null; }
function tierComunidad(h) {
  if (!D.meta || !D.meta.consenso) return null;
  const c = D.meta.consenso.find((x) => x.id === h.id || sinAcentos(x.heroe) === sinAcentos(h.nombre_en) || sinAcentos(x.heroe) === sinAcentos(h.nombre));
  return c ? c.tier : null;
}
function guiaObjeto(o) { return (o && D.objGuia && (D.objGuia[o.clase] || D.objGuia[sinAcentos(o.nombre)])) || null; }

/* ---------- Toasts y modales ---------- */
function toast(msg, ms = 2600) {
  const t = el('div', { class: 'toast' }, msg); $('#toasts').append(t);
  setTimeout(() => t.remove(), ms);
}
/** Aviso con botón «Deshacer» (para acciones que borran algo sin confirmar) */
function toastDeshacer(msg, deshacer, ms = 6000) {
  const t = el('div', { class: 'toast con-accion' }, el('span', null, msg), el('button', { type: 'button', class: 'boton mini', onclick: () => { t.remove(); deshacer(); } }, 'Deshacer'));
  $('#toasts').append(t);
  setTimeout(() => t.remove(), ms);
}
let modalActual = null;
function abrirModal(titulo, contenido, opciones = {}) {
  cerrarModal();
  const caja = el('div', { class: 'caja', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo });
  const cab = el('div', { class: 'cab' }, el('h3', null, titulo), el('button', { class: 'cerrar boton mini', type: 'button', onclick: cerrarModal, 'aria-label': 'Cerrar' }, '✕'));
  const cont = el('div', { class: 'contenido' }, contenido);
  if (opciones.alto) cont.style.height = opciones.alto;
  caja.append(cab, cont);
  const m = el('div', { class: 'modal', onclick: (e) => { if (e.target === m) cerrarModal(); } }, caja);
  const capa = $('#capa-modal'); capa.innerHTML = ''; capa.append(m); capa.hidden = false; modalActual = m;
  document.body.style.overflow = 'hidden';
  return cont;
}
function cerrarModal() { const capa = $('#capa-modal'); capa.hidden = true; capa.innerHTML = ''; modalActual = null; document.body.style.overflow = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { cerrarModal(); cerrarPanel(); } });

/* ---------- Panel lateral de objeto ---------- */
let panelActual = null;
function cerrarPanel() { if (panelActual) { panelActual.remove(); panelActual = null; document.body.style.overflow = ''; } }
function abrirPanel(contenido, titulo) {
  cerrarPanel();
  const cuerpo = el('div', { class: 'cuerpo', role: 'dialog', 'aria-modal': 'true', tabindex: '-1', 'aria-label': titulo || 'Detalle' }, el('button', { class: 'cerrar', type: 'button', onclick: cerrarPanel, 'aria-label': 'Cerrar' }, '✕'), contenido);
  panelActual = el('div', { class: 'panel' }, el('div', { class: 'fondo', onclick: cerrarPanel }), cuerpo);
  document.body.append(panelActual); document.body.style.overflow = 'hidden';
  cuerpo.focus();
}
function abrirObjeto(o) {
  if (typeof o === 'string') o = objeto(o);
  if (!o) return;
  // El panel usa la guía de objetos y los datos de compra: si aún no han llegado, se abre al llegar
  const necesita = ['objGuia', 'compras', 'fases'];
  if (!hayDatos(necesita)) {
    toast('Cargando la ficha de ' + nombreO(o) + '…', 1800);
    const ruta = rutaActual;
    asegurarDatos(necesita).then(() => { if (rutaActual === ruta) abrirObjeto(o); });
    return;
  }
  const r = RANURAS[o.ranura] || {};
  const g = guiaObjeto(o);
  const st = D.objStats && D.objStats.objetos[o.id];
  const cont = el('div', { class: 'obj-detalle ' + (r.clase || '') });
  cont.append(el('div', { class: 'cab' }, imgO(o), el('div', null,
    el('h2', null, nombreO(o)), nombreOAlt(o) ? el('div', { class: 'muted' }, nombreOAlt(o)) : null,
    el('div', { class: 'fila', style: { marginTop: '6px' } }, el('span', { class: 'chip ' + r.clase }, r.nombre || o.ranura), el('span', { class: 'chip' }, o.tier >= 5 ? 'Solo Street Brawl' : 'Tier ' + o.tier), el('span', { class: 'chip num' }, o.tier >= 5 ? 'no está en partida normal' : fmtSouls(o.coste)), o.activo ? el('span', { class: 'chip laton' }, 'Activo' + (o.enfriamiento ? ' · ' + o.enfriamiento + ' s' : '')) : null, o.imbuir ? el('span', { class: 'chip laton' }, 'Imbuir') : null))));
  if (g && g.resumen) cont.append(el('p', { class: 'sec', style: { fontSize: '1.02rem' } }, g.resumen));
  const stats = o.stats.filter((s) => s.etiqueta !== s.clave);
  if (stats.length) cont.append(el('div', { class: 'stats-lista' }, stats.map((s) => el('div', { class: 'stat' }, el('span', null, s.etiqueta), el('b', null, (s.valor > 0 && !/Penal|Reducci|Penalty|Tiempo|Acumulaci|Frecuencia|Duraci|Enfriamiento/.test(s.etiqueta) ? '+' : '') + fmt(s.valor, 2) + (s.sufijo === 'm' && /esprint|velocidad/i.test(s.etiqueta) ? ' m/s' : s.sufijo))))));
  const bloques = [['Pasiva', o.pasiva || o.descripcion], ['Activa', o.activa]].filter((b) => b[1]);
  for (const [t, txt] of bloques) cont.append(el('h3', { class: 'sub' }, t), el('div', { class: 'desc', html: rico(txt) }));
  // Cuándo comprarlo: dato real (minuto y almas medias) + guía concreta
  const cg = compraGlobal(o.clase);
  if (o.tier < 5 && (cg || (g && g.cuando))) {
    const caja = el('section', { class: 'cuando-caja' }, el('h3', { class: 'sub' }, 'Cuándo comprarlo'));
    if (cg) caja.append(el('p', { class: 'pequeno' }, 'En partidas reales se compra de media hacia el ', el('b', { class: 'num' }, 'min ' + fmt(cg.min, 1)), ', cuando se llevan unas ', el('b', { class: 'num' }, fmt(cg.almas) + ' almas'), ' acumuladas (14 días, todos los héroes).'));
    // La primera frase de la guía («Media global min X con…») repite el párrafo de datos de arriba
    let cuandoG = g && g.cuando ? String(g.cuando) : '';
    if (cg && cuandoG) cuandoG = cuandoG.replace(/^Media global:?\s*(?:min(?:uto)?\s*)?[\d,]+ con ~?[\d.]+ almas(?:\s*\([^)]*\))?[;.,]\s*/, '').replace(/^([a-záéíóúñ])/, (m) => m.toUpperCase());
    if (cuandoG) caja.append(el('p', { class: 'sec' }, cuandoG));
    if (g && (g.senales || []).length) caja.append(el('div', { class: 'etiqueta' }, 'Señales para comprarlo'), el('ul', { class: 'sec pequeno' }, g.senales.map((s) => el('li', null, s))));
    if (g && g.no_comprar_si) caja.append(el('p', { class: 'sec pequeno' }, el('b', null, 'No lo compres si: '), g.no_comprar_si));
    if (g && g.vender) caja.append(el('p', { class: 'sec pequeno' }, el('b', null, 'Vender o mejorar: '), g.vender));
    if (g && g.nota_juego) caja.append(lineaJuego('Nota para el juego', g.nota_juego));
    cont.append(caja);
  }
  if (g) {
    if (g.para_que) cont.append(el('h3', { class: 'sub' }, 'Para qué sirve'), el('p', { class: 'sec' }, g.para_que));
    if (g.contra) cont.append(el('h3', { class: 'sub' }, 'Especialmente bueno contra'), el('p', { class: 'sec' }, g.contra));
    if (g.etiquetas && g.etiquetas.length) cont.append(el('div', { class: 'etiquetas-obj', style: { marginTop: '8px' } }, g.etiquetas.map((t) => el('span', { class: 'chip' }, etiquetaObj(t)))));
  }
  const comps = compsDe(o).map(objeto).filter(Boolean);
  if (comps.length) cont.append(el('h3', { class: 'sub' }, 'Se mejora desde'), el('div', { class: 'fila' }, comps.map((c) => chipO(c))));
  const mejoras = D.objetos.filter((x) => compsDe(x).includes(o.clase));
  if (mejoras.length) cont.append(el('h3', { class: 'sub' }, 'Se puede mejorar a'), el('div', { class: 'fila' }, mejoras.map((m) => chipO(m))));
  if (st) cont.append(el('h3', { class: 'sub' }, 'Uso en los últimos 14 días'), el('div', { class: 'fila', style: { gap: '14px' } }, el('span', null, 'Gana el ', el('b', { class: 'num' }, fmtPct(st.wr)), ' de las partidas en que se compra'), el('span', null, 'Partidas ', el('b', { class: 'num' }, fmt(st.partidas)))));
  // Quién lo compra y cuándo (datos reales por héroe); si no hay, los objetos populares por fase
  const porHeroe = [];
  for (const h of D.heroes) { const x = compraDe(h, o.clase); if (x && x.pick >= 3) porHeroe.push({ h, ...x }); }
  porHeroe.sort((a, b) => b.pick - a.pick);
  if (porHeroe.length) {
    cont.append(el('h3', { class: 'sub' }, 'Quién lo compra y cuándo'), el('div', { class: 'lista-compradores' }, porHeroe.slice(0, 10).map((c) => el('div', { class: 'comprador' }, chipH(c.h, fmtPct(c.pick, 0), true),
      el('span', { class: 'num pequeno sec' }, 'min ' + c.min.toFixed(1).replace('.', ',') + ' · ~' + fmt(c.almas) + ' almas' + (c.vendido >= 50 && c.venta_min ? ' · se vende hacia el min ' + fmt(c.venta_min, 0) : ''))))));
  } else {
    const compradores = [];
    for (const h of D.heroes) { if (!h.populares) continue; let mejor = 0; for (const f of ['inicio', 'medio', 'final']) for (const p of h.populares[f]) if (p.clase === o.clase && p.pick > mejor) mejor = p.pick; if (mejor >= 15) compradores.push({ h, pick: mejor }); }
    compradores.sort((a, b) => b.pick - a.pick);
    if (compradores.length) cont.append(el('h3', { class: 'sub' }, 'Quién lo compra más'), el('div', { class: 'fila' }, compradores.slice(0, 10).map((c) => chipH(c.h, fmtPct(c.pick, 0), true))));
  }
  // Builds del Taller que lo recomiendan (por fase), con enlace a la ficha del héroe
  const enTaller = [];
  for (const h of D.heroes) {
    const f = typeof fasesDe === 'function' ? fasesDe(h) : null; if (!f) continue;
    for (const fa of f.fases || []) {
      const nombreFase = ({ inicial: 'inicial', media: 'media', avanzada: 'avanzada' })[fa.fase] || fa.fase;
      if ((fa.nucleo || []).some((e) => e.clase === o.clase)) enTaller.push({ h, txt: 'núcleo, fase ' + nombreFase });
      else if ((fa.situacionales || []).some((e) => e.clase === o.clase)) enTaller.push({ h, txt: 'situacional, fase ' + nombreFase });
    }
  }
  if (enTaller.length) {
    const vistos = new Set(); const unicos = enTaller.filter((x) => (vistos.has(x.h.id) ? false : vistos.add(x.h.id)));
    cont.append(el('h3', { class: 'sub' }, 'Lo recomiendan las builds del Taller'), el('div', { class: 'lista-compradores' }, unicos.slice(0, 14).map((x) => el('div', { class: 'comprador' }, chipH(x.h, null, true), el('span', { class: 'pequeno sec' }, x.txt)))),
      unicos.length > 14 ? el('p', { class: 'muted pequeno' }, 'Y ' + (unicos.length - 14) + ' héroes más.') : '');
  }
  cont.append(el('div', { style: { marginTop: '16px' } }, el('a', { class: 'boton mini', href: '#objetos', onclick: cerrarPanel }, 'Ver todos los objetos')));
  abrirPanel(cont, nombreO(o));
}

/* ---------- Almacén de builds del usuario ---------- */
const ALMACEN = {
  clave: 'td_builds', lista: [], db: null, uid: null, coleccion: null, listo: false,
  cargarLocal() { try { this.lista = JSON.parse(localStorage.getItem(this.clave) || '[]'); } catch (e) { this.lista = []; } },
  guardarLocal() { try { localStorage.setItem(this.clave, JSON.stringify(this.lista)); } catch (e) { /* sin almacenamiento */ } },
  async conectar() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const id = await user.id(); if (!id) return;
      this.db = db; this.uid = id; this.coleccion = db.doc('data/users/' + id + '/perfil').collection('builds');
      const snap = await this.coleccion.get();
      const remotas = snap.docs.filter((d) => d.exists).map((d) => d.data());
      // Fusión: la copia más reciente de cada build gana; las locales sin copia remota se suben
      const porId = {}; for (const b of this.lista) porId[b.id] = b;
      for (const r of remotas) { if (!porId[r.id] || (r.actualizado || 0) >= (porId[r.id].actualizado || 0)) porId[r.id] = r; }
      this.lista = Object.values(porId); this.guardarLocal();
      for (const b of this.lista) if (!remotas.find((r) => r.id === b.id)) await this.coleccion.doc(b.id).set(b).catch(() => {});
      this.listo = true;
      document.dispatchEvent(new CustomEvent('builds-cambiadas'));
    } catch (e) { /* sin db: seguimos en local */ }
  },
  obtener(id) { return this.lista.find((b) => b.id === id) || null; },
  async guardar(b) {
    b.actualizado = Date.now();
    const i = this.lista.findIndex((x) => x.id === b.id); if (i >= 0) this.lista[i] = b; else this.lista.unshift(b);
    this.guardarLocal();
    if (this.coleccion) await this.coleccion.doc(b.id).set(JSON.parse(JSON.stringify(b))).catch(() => {});
    document.dispatchEvent(new CustomEvent('builds-cambiadas'));
  },
  async borrar(id) {
    this.lista = this.lista.filter((b) => b.id !== id); this.guardarLocal();
    if (this.coleccion) await this.coleccion.doc(id).delete().catch(() => {});
    document.dispatchEvent(new CustomEvent('builds-cambiadas'));
  },
};
function codificarBuild(b) { return btoa(unescape(encodeURIComponent(JSON.stringify(b)))); }
function decodificarBuild(c) {
  try {
    const b = JSON.parse(decodeURIComponent(escape(atob(c.trim()))));
    if (!b || !b.heroe || !Array.isArray(b.categorias)) return null;
    b.categorias = b.categorias.map((cat) => ({ nombre: String((cat && cat.nombre) || 'Objetos'), descripcion: String((cat && cat.descripcion) || ''), opcional: cat && cat.opcional != null ? !!cat.opcional : undefined, objetos: Array.isArray(cat && cat.objetos) ? cat.objetos.filter((x) => x && objeto(x.clase)).map((x) => ({ clase: x.clase, nota: String(x.nota || '') })) : [] }));
    b.desbloqueo = Array.isArray(b.desbloqueo) ? b.desbloqueo.filter((x) => [1, 2, 3, 4].includes(x)) : [];
    b.orden = Array.isArray(b.orden) ? b.orden.filter((x) => x && [1, 2, 3, 4].includes(x.h)).map((x) => ({ h: x.h, pa: [1, 2, 5].includes(x.pa) ? x.pa : 1 })) : [];
    // Lista exacta de puntos (builds nuevas); si viene vacía o rota, se usa desbloqueo + orden
    const accP = Array.isArray(b.puntos) ? accionesDePuntos(b.puntos) : [];
    if (accP.length) fijarSecuencia(b, accP); else delete b.puntos;
    b.nombre = String(b.nombre || 'Build importada'); b.notas = String(b.notas || '');
    return b;
  } catch (e) { /* código inválido */ }
  return null;
}
async function copiar(texto) {
  texto = traducirNombres(texto);
  try { await navigator.clipboard.writeText(texto); toast('Copiado al portapapeles'); return true; } catch (e) {
    // Segundo intento: método clásico (funciona donde la API moderna está bloqueada)
    try {
      const oculto = el('textarea', { style: { position: 'fixed', top: '-1000px', opacity: '0' } }, texto);
      document.body.append(oculto); oculto.select();
      const ok = document.execCommand('copy'); oculto.remove();
      if (ok) { toast('Copiado al portapapeles'); return true; }
    } catch (e2) { /* sigue al cuadro manual */ }
    const ta = el('textarea', { class: 'entrada', style: { width: '100%', height: '120px' } }, texto);
    abrirModal('Copia el texto', el('div', null, el('p', { class: 'sec' }, 'Tu navegador no permite copiar automáticamente. Selecciónalo y cópialo:'), ta)); ta.select(); return false;
  }
}

/* ---------- Sinergias ---------- */
function sinergiaPar(a, b, linea) {
  if (!D.sinergias) return null;
  const lista = linea ? D.sinergias.parejas_linea : D.sinergias.parejas;
  return lista.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a)) || null;
}
function counterPar(h, e, linea) {
  if (!D.sinergias) return null;
  const lista = linea ? D.sinergias.counters_linea : D.sinergias.counters;
  return lista.find((p) => p.h === h && p.e === e) || null;
}
function mejoresSinergias(h, n = 8, linea = false) {
  if (!D.sinergias) return [];
  const lista = linea ? D.sinergias.parejas_linea : D.sinergias.parejas;
  return lista.filter((p) => (p.a === h.id || p.b === h.id) && p.n >= 100).map((p) => ({ otro: heroe(p.a === h.id ? p.b : p.a), wr: p.wr, n: p.n })).filter((x) => x.otro).sort((a, b) => b.wr - a.wr).slice(0, n);
}
function mejoresCounters(h, n = 8, linea = false) {
  if (!D.sinergias) return { gana: [], pierde: [] };
  const lista = linea ? D.sinergias.counters_linea : D.sinergias.counters;
  const filas = lista.filter((p) => p.h === h.id && p.n >= 100).map((p) => ({ otro: heroe(p.e), wr: p.wr, n: p.n })).filter((x) => x.otro).sort((a, b) => b.wr - a.wr);
  return { gana: filas.slice(0, n), pierde: filas.slice(-n).reverse() };
}

/* ---------- Router ---------- */
const RUTAS = {};
let rutaActual = '';
function tokenRuta() { const h = (location.hash || '#tier').slice(1); try { return decodeURIComponent(h) || 'tier'; } catch (e) { return 'tier'; } }
function ir(token) { if (location.hash !== '#' + token) location.hash = token; else render(); }
let rutaPintada = '';
function render() {
  const token = tokenRuta();
  const [base, ...resto] = token.split('-');
  const param = resto.join('-');
  const vista = RUTAS[base] || RUTAS.tier;
  rutaActual = token;
  const raiz = $('#vista'); raiz.innerHTML = '';
  // Solo al cambiar de sección: un repintado de la misma (al llegar datos) no cierra lo que el lector abrió
  if (token !== rutaPintada) { cerrarPanel(); cerrarModal(); }
  rutaPintada = token;
  // Si la sección necesita datos que aún no han llegado, se espera a ellos (solo a esos) y se vuelve a pintar
  const necesita = datosDeRuta(token);
  if (!hayDatos(necesita)) {
    const activaN = token.startsWith('build-perfil-') ? 'perfil' : ({ heroe: 'heroes', build: 'builds', objeto: 'objetos' }[base] || base);
    $$('#nav a').forEach((a) => a.classList.toggle('activo', a.dataset.ruta === activaN));
    raiz.append(el('div', { class: 'vacio cargando' }, 'Cargando…'));
    asegurarDatos(necesita).then(() => { if (rutaActual === token) render(); });
    return;
  }
  try { const out = vista(param, token); if (out) raiz.append(out); } catch (e) { console.error(e); raiz.append(el('div', { class: 'vacio' }, 'No se pudo mostrar esta sección. ', el('a', { href: '#tier' }, 'Volver al inicio'))); }
  const activa = token.startsWith('build-perfil-') ? 'perfil' : ({ heroe: 'heroes', build: 'builds', objeto: 'objetos' }[base] || base);
  $$('#nav a').forEach((a) => a.classList.toggle('activo', a.dataset.ruta === activa));
  const navActivo = $('#nav a.activo'); if (navActivo && navActivo.scrollIntoView) { try { navActivo.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) { /* nada */ } }
  restaurarScroll(token);
}
window.addEventListener('hashchange', render);

/* Al volver atrás, cada sección vuelve a donde estabas: la posición se guarda en la entrada del historial,
   anclada a la primera sección visible (las secciones largas usan content-visibility y su altura cambia al repintar) */
let guardarScrollDesde = 0;
/* Repintar la misma sección sin mover lo que el lector tiene delante (p. ej. al cambiar de variante de build):
   el elemento «sel» queda a la misma altura, los plegables con data-clave abiertos siguen abiertos
   y el foco vuelve al botón activo si estaba dentro */
let anclaRepintado = null;
function repintarAnclado(sel) {
  const e = document.querySelector('#vista ' + sel);
  const act = document.activeElement;
  anclaRepintado = { sel, top: e ? e.getBoundingClientRect().top : null, foco: !!(e && act && e.contains(act)),
    abiertos: [...document.querySelectorAll('#vista details[data-clave]')].filter((d) => d.open).map((d) => d.dataset.clave) };
  render();
}
function restaurarScroll(token) {
  const st = history.state;
  guardarScrollDesde = Date.now() + 700;
  if (anclaRepintado) {
    const a = anclaRepintado; anclaRepintado = null;
    document.querySelectorAll('#vista details[data-clave]').forEach((d) => { if (a.abiertos.includes(d.dataset.clave)) d.open = true; });
    const fijar = () => { const e = document.querySelector('#vista ' + a.sel); if (e && a.top != null) { const dy = e.getBoundingClientRect().top - a.top; if (Math.abs(dy) > 1) window.scrollBy(0, dy); } };
    fijar(); requestAnimationFrame(() => { fijar(); requestAnimationFrame(fijar); });
    if (a.foco) { const b = document.querySelector('#vista ' + a.sel + ' .segmento button.activo'); if (b) try { b.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
    return;
  }
  if (!(st && st.ruta === token && (st.ancla || st.y))) { window.scrollTo({ top: 0 }); return; }
  const saltar = () => {
    if (st.ancla) {
      const h = [...document.querySelectorAll('#vista .seccion > h2')].find((x) => x.textContent === st.ancla.h2);
      if (h) { window.scrollTo({ top: window.scrollY + h.parentElement.getBoundingClientRect().top - st.ancla.off }); return; }
    }
    window.scrollTo({ top: st.y || 0 });
  };
  saltar(); requestAnimationFrame(() => { saltar(); requestAnimationFrame(saltar); });
}
let temporizadorScroll = 0;
function apuntarPosicion() {
  if (Date.now() < guardarScrollDesde) return;
  clearTimeout(temporizadorScroll);
  temporizadorScroll = setTimeout(() => {
    const token = tokenRuta(); if (token !== rutaPintada) return;
    let ancla = null;
    for (const s of document.querySelectorAll('#vista .seccion')) {
      const r = s.getBoundingClientRect();
      if (r.bottom > 80) { const h = s.querySelector(':scope > h2'); if (h && r.top < window.innerHeight) ancla = { h2: h.textContent, off: Math.round(r.top) }; break; }
    }
    const abiertos = [...document.querySelectorAll('#vista details[data-clave]')].filter((d) => d.open).map((d) => d.dataset.clave);
    try { history.replaceState(Object.assign({}, history.state || {}, { ruta: token, y: Math.round(window.scrollY), ancla, abiertos }), ''); } catch (e) { /* sin historial */ }
  }, 150);
}
window.addEventListener('scroll', apuntarPosicion, { passive: true });
document.addEventListener('toggle', (e) => { if (e.target && e.target.matches && e.target.matches('#vista details[data-clave]')) apuntarPosicion(); }, true);

/* ---------- Búsqueda global ---------- */
function montarBusqueda() {
  const input = $('#buscar-global'); const caja = $('#buscar-resultados');
  let sel = -1;
  const cerrar = () => { caja.hidden = true; caja.innerHTML = ''; sel = -1; };
  const buscar = () => {
    const q = sinAcentos(input.value.trim()); if (q.length < 2) return cerrar();
    const hs = D.heroes.filter((h) => sinAcentos(h.nombre).includes(q) || sinAcentos(h.nombre_en).includes(q)).slice(0, 6);
    const os = D.objetos.filter((o) => sinAcentos(o.nombre).includes(q) || sinAcentos(o.nombre_es).includes(q)).slice(0, 8);
    caja.innerHTML = '';
    for (const h of hs) caja.append(el('a', { href: '#heroe-' + h.clase, onclick: cerrar }, imgH(h, ''), el('span', null, nombreH(h), nombreAlt(h) ? el('span', { class: 'muted' }, ' · ' + nombreAlt(h)) : null), el('span', { class: 'tipo' }, 'héroe')));
    for (const o of os) caja.append(el('a', { href: '#objetos', onclick: (e) => { e.preventDefault(); cerrar(); abrirObjeto(o); } }, imgO(o), el('span', null, nombreO(o), nombreOAlt(o) ? el('span', { class: 'muted' }, ' · ' + nombreOAlt(o)) : null), el('span', { class: 'tipo' }, 'objeto')));
    if (!hs.length && !os.length) caja.append(el('div', { class: 'muted', style: { padding: '8px' } }, 'Sin resultados'));
    caja.hidden = false; sel = -1;
  };
  input.addEventListener('input', buscar);
  input.addEventListener('focus', buscar);
  const ajustarPlaceholder = () => { input.placeholder = window.innerWidth < 900 ? 'Buscar' : 'Buscar héroe u objeto'; };
  ajustarPlaceholder(); window.addEventListener('resize', ajustarPlaceholder);
  input.addEventListener('keydown', (e) => {
    const items = $$('a', caja); if (!items.length) return;
    if (e.key === 'ArrowDown') { sel = (sel + 1) % items.length; } else if (e.key === 'ArrowUp') { sel = (sel - 1 + items.length) % items.length; } else if (e.key === 'Enter') { if (sel >= 0) items[sel].click(); else items[0].click(); input.blur(); return; } else return;
    e.preventDefault(); items.forEach((a, i) => a.classList.toggle('sel', i === sel));
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.cabecera-acciones')) cerrar(); });
  // Si el lector ya escribió mientras cargaban los datos, se busca al montar
  if (document.activeElement === input && input.value.trim().length >= 2) buscar();
}

/* ---------- Carga de datos ---------- */
/* Al abrir index.html con doble clic (file://) el navegador bloquea fetch() de archivos locales:
   en ese caso los datos vienen de data/datos.js, que scripts/construir.js genera junto a la web. */
let promesaDatosLocales = null;
// construir.js sustituye __GENERADO__ por la fecha de los datos con los que se generó esta página.
const GENERADO_PAGINA = '__GENERADO__';
// construir.js sustituye __HUELLA_DATOS__ por una huella de data/*.json (ver cargarJSON)
const HUELLA_DATOS = '__HUELLA_DATOS__';
// construir.js pone 'si' cuando existe data/perfil.json (foto personal, fuera del repositorio público)
const HAY_PERFIL = '__HAY_PERFIL__' === 'si';
// En el Artifact (máximo de archivos por versión) las variantes privadas van en un solo archivo
const VARIANTES_JUNTAS = '__VARIANTES_JUNTAS__' === 'si';
/** Con doble clic: avisa si data/datos.js es más viejo que la página (p. ej. tras un git pull sin regenerar) */
function avisarDatosLocalesViejos() {
  if (location.protocol !== 'file:' || !window.__DATOS__ || !/^\d{4}-\d{2}-\d{2}$/.test(GENERADO_PAGINA)) return;
  const fechaDatos = String(((window.__DATOS__['data/version.json'] || {}).generado) || '').slice(0, 10);
  if (fechaDatos && fechaDatos < GENERADO_PAGINA) toast('Los datos de esta copia son del ' + fmtFecha(fechaDatos) + '. Ábrela con el acceso «Taller de Deadlock» para traer los de hoy.', 10000);
}
function cargarDatosLocales() {
  if (window.__DATOS__) return Promise.resolve(true);
  if (!promesaDatosLocales) promesaDatosLocales = new Promise((resolver) => {
    const s = document.createElement('script');
    s.src = 'data/datos.js';
    s.onload = () => resolver(!!window.__DATOS__);
    s.onerror = () => resolver(false);
    (document.head || document.documentElement).appendChild(s);
  });
  return promesaDatosLocales;
}
async function cargarJSON(ruta, opcional) {
  if (location.protocol === 'file:') {
    await cargarDatosLocales();
    if (window.__DATOS__ && Object.prototype.hasOwnProperty.call(window.__DATOS__, ruta)) return window.__DATOS__[ruta];
    if (opcional) return null;
    throw new Error(ruta + ': no está en data/datos.js. Abre la web con «Abrir Taller de Deadlock.bat» o ejecuta «node scripts/construir.js» en la carpeta del proyecto.');
  }
  // Con la huella de los datos en la URL, el navegador puede usar su caché sin riesgo: al cambiar los datos cambia la URL
  // (en claude.ai los archivos los sirve la plataforma: se piden como siempre, sin parámetro)
  const version = !window.claude && /^[0-9a-f]{10}$/.test(HUELLA_DATOS) ? HUELLA_DATOS : '';
  try { const r = await fetch(ruta + (version ? '?v=' + encodeURIComponent(version) : ''), { cache: version ? 'default' : 'no-cache' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } catch (e) { if (opcional) return null; throw new Error(ruta + ': ' + e.message); }
}
/* Datos que se cargan bajo demanda: cada sección espera solo a lo que usa y el resto llega en segundo plano.
   (Antes se descargaban los 21 archivos antes de pintar nada; builds, fases y compras pesan ~0,9 MB comprimidos.) */
const GRUPOS_DATOS = {
  guias: ['data/guias.json', (j) => { D.guias = (j && j.heroes) || {}; }],
  builds: ['data/builds.json', (j) => { D.builds = j; }],
  comps: ['data/comps.json', (j) => { D.comps = j; }],
  objGuia: ['data/objetos_guia.json', (j) => { D.objGuia = (j && j.objetos) || {}; }],
  sistemas: ['data/sistemas.json', (j) => { D.sistemas = j; }],
  itemizacion: ['data/itemizacion.json', (j) => { D.itemizacion = j; }],
  compras: ['data/compras.json', (j) => { D.compras = j; }],
  fases: ['data/fases.json', (j) => { D.fases = (j && j.heroes) || {}; }],
  mapa: ['data/mapa.json', (j) => { D.mapa = j; }],
  estadBuilds: ['data/estadisticas_builds.json', (j) => { D.estadBuilds = j; }],
  // Foto de tus partidas (scripts/perfil.js). Es personal: no se sube al repositorio público
  perfil: ['data/perfil.json', (j) => { D.perfil = j; }],
};
const DATOS_POR_RUTA = {
  tier: ['guias'], heroes: ['guias'], heroe: ['guias', 'fases', 'compras', 'builds', 'mapa', 'objGuia', 'estadBuilds', 'perfil'],
  objetos: ['objGuia'], objeto: ['objGuia', 'compras', 'fases'],
  builds: [], build: ['guias', 'fases', 'compras', 'builds', 'objGuia', 'perfil'], perfil: ['perfil'],
  equipos: ['guias', 'comps'], guia: ['sistemas'], 'guia-objetos': ['itemizacion'], 'guia-mapa': ['mapa'], novedades: ['guias', 'objGuia'],
};
/** Datos que necesita una ruta (#guia-mapa tiene los suyos; si no, los de su sección) */
function datosDeRuta(token) {
  const lista = token.startsWith('build-perfil-') ? [...DATOS_POR_RUTA.build, 'perfil'] : (() => { const base = token.split('-')[0]; return DATOS_POR_RUTA[token] || DATOS_POR_RUTA[RUTAS[base] ? base : 'tier'] || DATOS_POR_RUTA.tier; })();
  // Variantes de build del héroe de la ficha o del creador (#heroe-<clase>, #build-nueva-<clase>, #build-perfil-<clase>,
  // y también #build-com-<heroId>-<build> y #build-<id> guardada: el creador enseña la guía de la variante)
  const m = token.match(/^(?:heroe|build-nueva|build-perfil)-(.+)$/) || token.match(/^build-com-(\d+)-/);
  const guardada = !m && token.startsWith('build-') ? ALMACEN.obtener(token.slice(6)) : null;
  const h = m ? heroe(m[1]) : guardada ? heroe(guardada.heroe) : null;
  return h ? [...lista, VARIANTES_JUNTAS && HAY_PERFIL ? 'varTodas' : 'var:' + h.id] : lista;
}
// Grupos de datos por héroe: «var:<id>» → data/variantes/<id>.json (pública) o, con perfil,
// data/variantes_perfil/<id>.json (la misma, con lo que es solo para el jugador)
function grupoDatos(k) {
  if (GRUPOS_DATOS[k]) return GRUPOS_DATOS[k];
  if (k === 'varTodas') return ['data/variantes_perfil.json', (j) => { if (!j || !j.heroes) return; D.variantes = D.variantes || { heroes: {} }; Object.assign(D.variantes.heroes, j.heroes); }];
  const id = k.startsWith('var:') ? k.slice(4) : null;
  if (id) return ['data/' + (HAY_PERFIL ? 'variantes_perfil/' : 'variantes/') + id + '.json', (j) => { if (!j) return; D.variantes = D.variantes || { heroes: {} }; D.variantes.heroes[id] = j; }];
  return null;
}
const datosCargados = new Set(); const promesasDatos = {};
function hayDatos(claves) { return (claves || []).every((k) => datosCargados.has(k)); }
function asegurarDatos(claves) {
  // perfil.json solo existe en la copia local y en el Artifact privado: en la web pública no se pide (evita un 404)
  if (!HAY_PERFIL) datosCargados.add('perfil');
  return Promise.all((claves || []).filter((k) => (HAY_PERFIL || k !== 'perfil') && grupoDatos(k)).map((k) => promesasDatos[k] || (promesasDatos[k] = cargarJSON(grupoDatos(k)[0], true)
    .then((j) => { grupoDatos(k)[1](j); }).catch(() => { /* opcional: la sección lo indica */ }).then(() => { datosCargados.add(k); }))));
}
async function cargarDatos() {
  const [heroes, habilidades, objetos, stats, sinergias, objStats, rangos, version, meta, parche, habStats] = await Promise.all([
    // En cuanto se conocen los héroes, se piden las variantes del de la ruta (sin esperar al resto de datos base)
    cargarJSON('data/heroes.json').then((hs) => { for (const h of hs || []) { IDX.heroPorId[h.id] = h; IDX.heroPorClase[h.clase] = h; } asegurarDatos(datosDeRuta(tokenRuta())); return hs; }), cargarJSON('data/habilidades.json'), cargarJSON('data/objetos.json'), cargarJSON('data/stats.json'),
    cargarJSON('data/sinergias.json', true), cargarJSON('data/objetos_stats.json', true), cargarJSON('data/rangos.json', true), cargarJSON('data/version.json', true),
    cargarJSON('data/meta.json', true), cargarJSON('data/parche.json', true), cargarJSON('data/habilidades_stats.json', true),
    cargarJSON('data/habilidades_extra.json', true),
    // La sección de entrada suele ser la tier list, que usa las guías (arquetipo, dificultad): se piden ya, en paralelo
    asegurarDatos(datosDeRuta(tokenRuta())),
  ]).then((r) => { r.pop(); const extra = r.pop(); if (extra && extra.habilidades) for (const lista of Object.values(r[1] || {})) for (const a of lista) { const e = extra.habilidades[a.clase]; if (!e) continue; if (!a.descripcion) a.descripcion = e.descripcion || ''; if (!a.resumen) a.resumen = e.resumen || ''; } return r; });
  Object.assign(D, { heroes, habilidades, objetos, stats, sinergias, objStats, rangos: rangos || [], version, meta, parche, habStats });
  // Preferencias guardadas con claves que ya no existen (p. ej. un rango renombrado)
  if (!stats.datos[PREF.ventana]) PREF.ventana = '7d';
  if (!stats.datos[PREF.ventana][PREF.bracket]) PREF.bracket = 'todos';
  for (const h of heroes) { IDX.heroPorId[h.id] = h; IDX.heroPorClase[h.clase] = h; IDX.heroPorNombre[sinAcentos(h.nombre)] = h; IDX.heroPorNombre[sinAcentos(h.nombre_en)] = h; }
  for (const o of objetos) { IDX.objPorClase[o.clase] = o; IDX.objPorId[o.id] = o; IDX.objPorNombre[sinAcentos(o.nombre)] = o; IDX.objPorNombre[sinAcentos(o.nombre_es)] = o; }
  const fecha = version && version.generado ? fmtFecha(version.generado) : '';
  for (const id of ['marca-parche', 'pie-parche']) { const e = document.getElementById(id); if (e && fecha) e.textContent = 'datos del ' + fecha; }
}

/* ---------- Estadísticas en vivo ----------
   Al abrir la web fuera de claude.ai (GitHub Pages, Cloudflare Pages, local), pide a la API
   los winrates de los últimos 7 y 30 días y recalcula la tier list con la misma fórmula que
   scripts/actualizar.js. Si la API no responde, se queda con los datos del archivo. */
const VIVO = { estado: 'archivo', hora: null };
const VIVO_CACHE_MIN = 30;
function calcularBracket(filas) {
  const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
  const total = filas.reduce((s, r) => s + r.matches, 0);
  const partidas = Math.round(total / 12);
  const lista = filas.filter((r) => IDX.heroPorId[r.hero_id]).map((r) => ({
    id: r.hero_id, partidas: r.matches, wr: pct(r.wins, r.matches), pick: partidas ? Math.round((1000 * r.matches) / partidas) / 10 : null,
    kda: r.total_deaths ? Math.round(((r.total_kills + r.total_assists) / r.total_deaths) * 100) / 100 : null,
    kills: r.matches ? Math.round((10 * r.total_kills) / r.matches) / 10 : null,
    muertes: r.matches ? Math.round((10 * r.total_deaths) / r.matches) / 10 : null,
    asistencias: r.matches ? Math.round((10 * r.total_assists) / r.matches) / 10 : null,
    dano: r.matches ? Math.round(r.total_player_damage / r.matches) : null,
    souls: r.matches ? Math.round(r.total_net_worth / r.matches) : null,
    precision: r.total_shots_hit + r.total_shots_missed ? pct(r.total_shots_hit, r.total_shots_hit + r.total_shots_missed) : null,
    wr_ajustado: Math.round((1000 * (r.wins + 400 * 0.5)) / (r.matches + 400)) / 10,
  }));
  const vals = lista.map((h) => h.wr_ajustado);
  const media = vals.reduce((a, c) => a + c, 0) / (vals.length || 1);
  const sd = Math.sqrt(vals.reduce((a, c) => a + (c - media) ** 2, 0) / (vals.length || 1)) || 1;
  for (const h of lista) {
    const z = (h.wr_ajustado - media) / sd; h.z = Math.round(z * 100) / 100;
    h.tier = z >= 1.1 ? 'S' : z >= 0.4 ? 'A' : z >= -0.4 ? 'B' : z >= -1.1 ? 'C' : 'D';
    if (h.partidas < 150) h.tier = h.tier === 'S' ? 'A' : h.tier === 'D' ? 'C' : h.tier;
  }
  lista.sort((a, b) => b.wr_ajustado - a.wr_ajustado);
  return { partidas, media: Math.round(media * 10) / 10, sd: Math.round(sd * 100) / 100, heroes: lista };
}
function pintarIndicadorVivo() {
  const txt = VIVO.estado === 'vivo' && VIVO.hora
    ? 'estadísticas en vivo · ' + new Date(VIVO.hora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : (D.version && D.version.generado ? 'datos del ' + fmtFecha(D.version.generado) : '');
  const e = document.getElementById('marca-parche'); if (e && txt) e.textContent = txt;
  const p = document.getElementById('pie-parche'); if (p && txt) p.textContent = txt;
}
async function refrescarEnVivo() {
  if (window.claude || !D.stats || !D.stats.brackets) return; // en claude.ai la API está bloqueada; con doble clic (file://) sí funciona
  try {
    const cache = JSON.parse(localStorage.getItem('td_vivo') || 'null');
    if (cache && Date.now() - cache.hora < VIVO_CACHE_MIN * 60000 && cache.datos) {
      Object.assign(D.stats.datos, cache.datos); VIVO.estado = 'vivo'; VIVO.hora = cache.hora; pintarIndicadorVivo(); return true;
    }
  } catch (e) { /* sin caché */ }
  const ahora = Math.floor(Date.now() / 1000);
  const nuevos = {}; let ok = 0;
  // Las peticiones (periodos × rangos) van en paralelo, de 4 en 4 para no cargar la API
  const tareas = [];
  for (const v of D.stats.ventanas) { nuevos[v.clave] = {}; for (const b of D.stats.brackets) tareas.push([v, b]); }
  const pedir = async ([v, b]) => {
    const q = new URLSearchParams({ min_unix_timestamp: String(ahora - v.dias * 86400) });
    if (b.min) q.set('min_average_badge', String(b.min));
    if (b.max) q.set('max_average_badge', String(b.max));
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch('https://api.deadlock-api.com/v1/analytics/hero-stats?' + q, { signal: ctrl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const filas = await r.json();
      if (Array.isArray(filas) && filas.length) { nuevos[v.clave][b.clave] = calcularBracket(filas); ok++; }
    } catch (e) { /* esta combinación se queda con los datos del archivo */ } finally { clearTimeout(t); }
  };
  for (let i = 0; i < tareas.length; i += 4) await Promise.all(tareas.slice(i, i + 4).map(pedir));
  if (!ok) return false;
  for (const [v, porB] of Object.entries(nuevos)) Object.assign(D.stats.datos[v] = D.stats.datos[v] || {}, porB);
  VIVO.estado = 'vivo'; VIVO.hora = Date.now();
  try { localStorage.setItem('td_vivo', JSON.stringify({ hora: VIVO.hora, datos: nuevos })); } catch (e) { /* sin almacenamiento */ }
  pintarIndicadorVivo();
  return true;
}

async function iniciar() {
  ALMACEN.cargarLocal(); // antes de los datos: así una build guardada (#build-<id>) pide ya las variantes de su héroe
  try { await cargarDatos(); } catch (e) {
    $('#vista').innerHTML = ''; $('#vista').append(el('div', { class: 'vacio' }, el('p', null, 'No se pudieron cargar los datos del parche.'), el('p', { class: 'muted pequeno' }, String(e.message)),
      el('p', { class: 'pequeno' }, 'También puedes verla en ', el('a', { href: 'https://cory2030.github.io/taller-deadlock/', target: '_blank', rel: 'noopener' }, 'cory2030.github.io/taller-deadlock'), '.')));
    return;
  }
  montarBusqueda();
  render();
  avisarDatosLocalesViejos();
  ALMACEN.conectar();
  // El resto de datos, en segundo plano cuando el navegador esté libre (así las demás secciones abren al instante)
  // (no se precarga con el ahorro de datos activado o en redes muy lentas)
  const conexion = navigator.connection || {};
  const precargar = () => { if (!conexion.saveData && !/2g/.test(conexion.effectiveType || '')) asegurarDatos(Object.keys(GRUPOS_DATOS)); };
  // La precarga empieza cuando la sección de entrada ya tiene sus datos (no compite con ella)
  asegurarDatos(datosDeRuta(tokenRuta())).then(() => { if ('requestIdleCallback' in window) requestIdleCallback(precargar, { timeout: 4000 }); else setTimeout(precargar, 1500); });
  // Estadísticas en vivo: al llegar, se repinta solo si el lector está en una vista de listas y no tiene nada abierto
  refrescarEnVivo().then((cambio) => {
    if (!cambio) return;
    const base = tokenRuta().split('-')[0];
    if (base === 'tier' && !panelActual && !modalActual && window.scrollY < 120) render();
    if (base === 'perfil' && typeof window.repintarPerfil === 'function') window.repintarPerfil();
  }).catch(() => { /* seguimos con los datos del archivo */ });
  if (window.claude && window.claude.hot && typeof window.claude.hot.snapshot === 'function') {
    try { window.claude.hot.snapshot(() => ({ hash: location.hash })); } catch (e) { /* sin hot */ }
  }
}
function arrancar() { const inicio = () => iniciar(); if (window.claude && window.claude.hot && typeof window.claude.hot.ready === 'function') { window.claude.hot.ready((datos) => { if (datos && datos.hash && !location.hash) location.hash = datos.hash; inicio(); }); } else inicio(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
