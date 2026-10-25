'use strict';
/* ============================================================
   Builds por fase (núcleo + situacionales), cuándo comprar cada objeto,
   textos para pegar en el editor de builds del juego y plan de mapa
   (mejoras de puente, jungla, cajas, rutas sobre el minimapa).
   ============================================================ */

const FASES = { inicial: { nombre: 'Fase inicial', min: '0-10' }, media: { nombre: 'Fase media', min: '10-22' }, avanzada: { nombre: 'Fase avanzada', min: '22+' } };
const NUM_ROMANO = ['', 'I', 'II', 'III', 'IV', 'IV'];
const MEJORAS_PUENTE = {
  arma: { nombre: 'Arma', juego: 'Gun', color: 'var(--arma)', efecto: 'cadencia y munición' },
  supervivencia: { nombre: 'Supervivencia', juego: 'Survival', color: 'var(--vit)', efecto: 'vida máxima y regeneración' },
  habilidades: { nombre: 'Lanzamiento', juego: 'Casting', color: 'var(--esp)', efecto: 'poder de espíritu y recarga' },
  movilidad: { nombre: 'Movimiento', juego: 'Movement', color: 'var(--movil)', efecto: 'aguante, esprint y tirolina' },
};
const TIPO_CAMPAMENTO = {
  weak: { nombre: 'Débil', r: 9, color: '#a7c4b1' },
  medium: { nombre: 'Mediano', r: 12, color: '#e2b65a' },
  strong: { nombre: 'Fuerte', r: 15, color: '#e8794a' },
  vault: { nombre: 'Sinner\'s Sacrifice', r: 12, color: '#b892f2' },
};
const CARRIL_ESPEJO = { York: 'Greenwich', Greenwich: 'York', Broadway: 'Broadway' };

/* ---------- Datos ---------- */
function fasesDe(h) { return (h && D.fases && D.fases[h.id]) || null; }
function compraDe(h, clase) { const c = h && D.compras && D.compras.heroes && D.compras.heroes[h.id]; return (c && c.objetos && c.objetos[clase]) || null; }
function compraGlobal(clase) { return (D.compras && D.compras.objetos && D.compras.objetos[clase]) || null; }
function textoCompra(d) {
  if (!d) return '';
  const p = [];
  if (d.min != null) p.push('min ' + d.min.toFixed(1).replace('.', ','));
  if (d.almas != null) p.push('~' + fmt(d.almas) + ' almas');
  if (d.pick != null) p.push('lo compra el ' + fmt(d.pick, 0) + ' %');
  return p.join(' · ');
}
/** Pantalla estrecha (móvil o tableta en vertical): ahí se pliegan los textos largos */
function pantallaEstrecha() { try { return window.matchMedia('(max-width: 960px)').matches; } catch (e) { return false; } }
/** Lo que se paga por cada objeto en orden de compra: si ya tienes su componente, solo la diferencia */
// previos: lista de clases ya compradas en orden, o el inventario (Map clase → unidades) que devuelve otra llamada.
// Al mejorar, el componente se gasta: otra mejora del mismo componente ya no lo descuenta.
function pagosDe(lista, previos) {
  const tengo = new Map(previos instanceof Map ? previos : []);
  const comprar = (o) => {
    const n = o.componente ? tengo.get(o.componente) || 0 : 0;
    const comp = n > 0 ? objeto(o.componente) : null;
    if (comp) { if (n > 1) tengo.set(o.componente, n - 1); else tengo.delete(o.componente); }
    tengo.set(o.clase, (tengo.get(o.clase) || 0) + 1);
    return { o, paga: o.coste - (comp ? comp.coste : 0), desde: comp };
  };
  if (Array.isArray(previos)) for (const c of previos) { const o = objeto(c); if (o) comprar(o); }
  const pagos = [];
  for (const e of lista || []) { const o = objeto(e.clase || e.objeto); if (o) pagos.push(comprar(o)); }
  pagos.inventario = tengo;
  return pagos;
}
/** Objetos que quedan en el inventario al final: los componentes que se mejoran desaparecen */
function objetosFinales(clases) {
  const set = new Set(clases.map((c) => (objeto(c) || {}).clase).filter(Boolean));
  const consumidos = new Set();
  for (const c of set) { const o = objeto(c); if (o.componente && set.has(o.componente)) consumidos.add(o.componente); }
  return [...set].filter((c) => !consumidos.has(c)).map(objeto);
}
/** "Improved Spirit (lo mejora)" → { etiqueta: 'Se mejora desde', texto: 'Improved Spirit' } */
function relacionReemplazo(x) {
  const s = String(x || '').trim(); if (!s || /^se a[ñn]ade/i.test(s)) return null;
  const m = s.match(/^(.*?)\s*\((.*)\)\s*$/);
  const nombre = nombreObjetoTexto(m ? m[1] : s); const nota = m ? m[2].trim() : '';
  if (!nota) return { etiqueta: 'En lugar de', texto: nombre };
  if (/^l[oa]s? mejora/i.test(nota)) return { etiqueta: 'Se mejora desde', texto: nombre };
  let r = nota.match(/^l[oa]s? retrasa\s*(.*)$/i); if (r) return { etiqueta: 'Retrasa', texto: nombre + (r[1] ? ' ' + r[1] : '') };
  r = nota.match(/^v[eé]ndel[oa]s?\s*(.*)$/i); if (r) return { etiqueta: 'Vende', texto: nombre + (r[1] ? ' (' + r[1] + ')' : '') };
  return { etiqueta: 'En lugar de', texto: nombre + ' (' + nota + ')' };
}
function chipCompra(d) {
  if (!d) return null;
  return el('span', { class: 'chip compra-chip num', title: 'Dato real de las partidas de los últimos 14 días: minuto medio de compra, almas acumuladas que se suelen llevar en ese minuto y porcentaje de partidas en que se compra.' }, textoCompra(d));
}
function botonCopiar(texto, etiqueta, titulo) {
  return el('button', { type: 'button', class: 'boton mini copiar', title: titulo || 'Copiar al portapapeles', 'aria-label': (etiqueta || 'Copiar') + ': ' + String(texto).slice(0, 60), onclick: (e) => { e.stopPropagation(); copiar(texto); } }, etiqueta || 'Copiar');
}
function lineaJuego(etiqueta, texto) {
  return el('div', { class: 'linea-juego' }, el('span', { class: 'etiqueta' }, etiqueta), el('span', { class: 'texto mono' }, texto), botonCopiar(texto));
}
function tileObjeto(o) {
  const r = RANURAS[o.ranura] || {};
  return el('button', { type: 'button', class: 'tile-obj ' + (r.clase || ''), onclick: () => abrirObjeto(o), title: nombreO(o) + ' · ' + fmtSouls(o.coste), 'aria-label': 'Ver ' + nombreO(o) },
    el('img', { src: o.imagen, alt: '', loading: 'lazy' }), el('span', { class: 'tier' }, NUM_ROMANO[o.tier] || ''));
}
function nombreObjetoTexto(x) { const o = objeto(x); return o ? nombreO(o) : String(x || ''); }

/* ---------- Build por fases (ficha de héroe) ---------- */
/** Quita del texto las cifras reales que ya da la ficha de datos de la tarjeta (y que se desfasan al actualizar los datos);
    el % de victorias, que la ficha no da, se pone con el dato del día */
function sinCifrasReales(t, d) {
  let s = String(t || '');
  if (!s) return s;
  // (?:[^.]|\.(?=\d))* = hasta el siguiente punto que no sea el de miles (1.650)
  s = s.replace(/\s*\((?:[Dd]ato real|real|curva real)[^()]*\)/g, '')
    .replace(/\s*\(~?[\d.]+ almas[^()]*%[^()]*\)/g, '')
    .replace(/\s*\(\d+(?:,\d)?[\s ]?% de (?:las |sus )?partidas\)/g, '')
    // Si la frase quitada seguía a «;» o «:», la anterior se cierra con punto
    .replace(/([;:,])?\s*[Ee]n partidas reales se compra hacia el min (?:[^.]|\.(?=\d))*\./g, (m, p) => (p ? '.' : ''))
    .replace(/([;:,])?\s*[Ee]n partidas reales:(?:[^.]|\.(?=\d))*\./g, (m, p) => (p ? '.' : ''))
    .replace(/([;:,])?\s*[Dd]ato real:?(?:[^.]|\.(?=\d))*\./g, (m, p) => (p ? '.' : ''))
    // "hacia el min 8,1 con ~5.200 almas (41 % de pick)" → "hacia el min 8,1": la ficha ya da almas y %
    .replace(/\s*con ~?[\d.]+ almas(?: acumuladas)?\s*\([^()]*%[^()]*\)/g, '')
    .replace(/\s*~?[\d.]+ almas\s*\(\d+(?:,\d)?[\s ]?%[^()]*\)/g, '');
  if (d && d.wr != null) s = s.replace(/Con él gana el [\d,]+[\s ]?%/g, 'Con él gana el ' + fmt(d.wr, 1) + ' %');
  return s.replace(/\s+([,.;:])/g, '$1').replace(/([;:,])\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();
}
/** "Si mueres 2 veces…" detrás de «Cómpralo si:» → "Mueres 2 veces…" */
function sinSiInicial(t) { const s = String(t || ''); return /^si\s/i.test(s) ? s.slice(3, 4).toUpperCase() + s.slice(4) : s; }
/** Nota para el editor del juego: si el objeto es situacional, empieza por cuándo comprarlo
    (contra qué rivales o en qué situación), sacado de «cuando», y sigue con la nota corta */
const CONDICION_NOTA = /^(Si |Solo |Contra |De soporte|Ruta |Build |Variante|Anticuraci|Para |Cuando |Ante |Frente a |Con un |Sin )/i;
const ACCION_NOTA = /^(c[oó]mpra|con \d|con ~|con \d|hacia|mej[oó]ra|sube|adel[aá]nt|\d|en la|en el|en cuanto|antes|justo|l[aá]nza|imb[uú]|tras|despu[eé]s|a partir|al |ll[eé]valo|vend|del min|desde|dato|s[uú]belo|qu[eé]datelo)/i;
const VERBO_NOTA = /\b(s[uú]belo|mej[oó]ralo|v[eé]ndelo|c[oó]mpralo|c[oó]mprala|dato real)\b/i;
const palabrasNota = (t) => new Set(sinAcentos(t).match(/[a-z0-9]{3,}/g) || []);
function notaJuego(e, situacional) {
  const nota = String((e && e.nota_juego) || '').trim();
  const cuando = String((e && e.cuando) || '').trim();
  // Núcleo: solo si su «cuando» es una condición. Situacional: siempre que no empiece por un minuto o una acción
  if (!CONDICION_NOTA.test(cuando) && !(situacional && cuando && !/^(min|hacia|con \d|con ~|\d|imbuid|una vez|ya |c[oó]mpra|mej[oó]ra|sube)/i.test(cuando))) return nota;
  // Condición: la primera frase de «cuando» sin la parte de qué hacer («: cómpralo con 800…») ni datos entre paréntesis con %
  let cond = (cuando.match(/^[\s\S]*?\.(?=\s+[A-ZÁÉÍÓÚÑ¿(]|$)/) || [cuando])[0].replace(/\.$/, '');
  // Primer «: » fuera de paréntesis: lo que sigue es qué hacer si empieza por una acción o lleva minutos y compras
  let dos = -1, prof = 0;
  for (let k = 0; k < cond.length - 1; k++) { const c = cond[k]; if (c === '(') prof++; else if (c === ')') prof = Math.max(0, prof - 1); else if (c === ':' && cond[k + 1] === ' ' && !prof) { dos = k; break; } }
  const tras = dos > 0 ? cond.slice(dos + 2) : '';
  if (dos > 0 && (ACCION_NOTA.test(tras) || VERBO_NOTA.test(tras) || /\b(hacia el|imbuid[oa]|en partidas reales)\b|\(\s*(min|\d)|~\d/i.test(tras))) cond = cond.slice(0, dos);
  // Sin dos puntos, la parte de cuándo («, hacia el min 14 con…») también se corta
  cond = cond.split(/[,;:]?\s+(?=hacia el min|con \d[\d.]* (?:en mano|almas)|con ~|dato real|en partidas reales)/i)[0];
  cond = cond.replace(/\s*\([^)]*\d\s*%[^)]*\)/g, '').replace(/[,;:\s]+$/, '').trim();
  if (!cond) return nota;
  // De la nota se quita su primer trozo si ya era una condición (para no repetirla)
  let resto = nota;
  const m = nota.match(/^([\s\S]*?)[.:](?:\s+|$)([\s\S]*)$/);
  const primero = m ? m[1] : nota;
  const pc = palabrasNota(cond); const pp = [...palabrasNota(primero)];
  const repetido = pp.length && pp.filter((w) => pc.has(w)).length / pp.length >= 0.6;
  if (CONDICION_NOTA.test(nota) || repetido) resto = m ? m[2] : '';
  resto = resto.trim();
  if (resto) resto = resto[0].toUpperCase() + resto.slice(1);
  return cond + '.' + (resto ? ' ' + resto.replace(/([^.!?])$/, '$1.') : '');
}
function tarjetaCompra(h, e, situacional, pago, abierto) {
  const o = objeto(e.clase || e.objeto); if (!o) return null;
  const r = RANURAS[o.ranura] || {};
  const d = compraDe(h, o.clase);
  const rel = situacional ? relacionReemplazo(e.reemplaza) : null;
  const coste = pago && pago.desde ? `${fmt(o.coste)} · pagas ${fmt(pago.paga)} si ya tienes ${nombreO(pago.desde)}` : fmt(o.coste);
  return el('article', { class: 'compra ' + (r.clase || '') + (situacional ? ' situacional' : '') },
    tileObjeto(o),
    el('div', { class: 'compra-cuerpo' },
      el('div', { class: 'compra-cab' },
        el('button', { type: 'button', class: 'compra-nombre', onclick: () => abrirObjeto(o) }, nombreO(o)),
        el('span', { class: 'muted pequeno num' }, coste + ' · ' + (r.nombre || '')),
        chipCompra(d)),
      e.cuando ? el('p', { class: 'compra-cuando' }, el('b', null, situacional ? 'Cómpralo si: ' : 'Cuándo: '), situacional ? sinSiInicial(sinCifrasReales(e.cuando, d)) : sinCifrasReales(e.cuando, d)) : null,
      rel ? el('p', { class: 'compra-meta' }, el('b', null, rel.etiqueta + ': '), rel.texto) : null,
      e.por_que ? el('details', { class: 'compra-mas', open: abierto }, el('summary', null, 'Por qué'), el('p', { class: 'compra-porque' }, sinCifrasReales(e.por_que, d))) : null,
      notaJuego(e, situacional) ? el('div', { class: 'compra-nota' }, el('span', { class: 'mono' }, notaJuego(e, situacional)), botonCopiar(notaJuego(e, situacional), 'Copiar nota', 'Copia la nota para pegarla en este objeto dentro del editor de builds del juego')) : null));
}
/** "Fase inicial 0-10 · Gana la línea…" → nombre corto para la categoría del juego + el resto como su descripción */
function partirTitulo(t, situacionales) {
  const s = String(t || '').trim(); const i = s.indexOf(' · ');
  if (i < 0) return { nombre: s, desc: '' };
  let nombre = s.slice(0, i).trim(); const resto = s.slice(i + 3).trim();
  if (situacionales && !/situacional|opcional/i.test(nombre)) nombre += ' · situacionales';
  return { nombre, desc: resto ? resto[0].toUpperCase() + resto.slice(1) : '' };
}
function lineasCategoria(t, situacionales) {
  const p = partirTitulo(t, situacionales); if (!p.nombre) return null;
  return el('div', { class: 'lineas-categoria' },
    lineaJuego(situacionales ? 'Nombre de la categoría opcional en el juego' : 'Nombre de la categoría en el juego', p.nombre),
    p.desc ? lineaJuego('Descripción de la categoría', p.desc) : null);
}
/** Clases del núcleo de las fases anteriores a la dada (lo que ya llevas al empezarla) */
function nucleoPrevio(h, fase) {
  // Inventario al empezar la fase: el núcleo de las anteriores, con los componentes ya gastados en sus mejoras
  const f = fasesDe(h); let inv = new Map();
  for (const x of (f && f.fases) || []) { if (x === fase) break; inv = pagosDe(x.nucleo, inv).inventario; }
  return inv;
}
function panelFase(h, f) {
  const info = FASES[f.fase] || { nombre: f.fase, min: f.minutos || '' };
  const estrecha = pantallaEstrecha();
  const previos = nucleoPrevio(h, f);
  const pagos = pagosDe(f.nucleo, previos);
  const pagaFase = pagos.reduce((s, p) => s + p.paga, 0);
  const pagoDe = (e) => pagos.find((p) => p.o.clase === (objeto(e.clase || e.objeto) || {}).clase);
  const nucleo = el('section', { class: 'panel-fase', 'aria-label': info.nombre, id: 'fase-' + f.fase },
    el('div', { class: 'panel-fase-cab' },
      el('div', null, el('h3', null, info.nombre, el('span', { class: 'muted pequeno' }, ' · ' + (f.minutos || info.min) + ' min')), f.objetivo ? el('p', { class: 'sec pequeno' }, f.objetivo) : null),
      el('span', { class: 'num pequeno muted', title: 'Almas que pagas en objetos en esta fase: al mejorar un objeto solo pagas la diferencia' }, fmtSouls(pagaFase) + ' en objetos')),
    // Orden de compra de un vistazo, para calcarlo en el editor del juego
    el('div', { class: 'orden-compra', 'aria-label': 'Orden de compra de la ' + info.nombre.toLowerCase() }, pagos.map((p) => tileObjeto(p.o))),
    lineasCategoria(f.titulo_categoria_juego, false),
    el('div', { class: 'compras' }, (f.nucleo || []).map((e) => tarjetaCompra(h, e, false, pagoDe(e), !estrecha))));
  let opc = null;
  if ((f.situacionales || []).length) {
    const tituloOpc = 'Situacionales de la ' + info.nombre.toLowerCase();
    const cuerpoOpc = [lineasCategoria(f.titulo_situacionales_juego, true), el('div', { class: 'compras' }, f.situacionales.map((e) => tarjetaCompra(h, e, true, null, false)))];
    opc = el('section', { class: 'panel-fase opcional', 'aria-label': tituloOpc },
      // En móvil los situacionales quedan debajo de su fase: plegados para no alargar la página
      el('details', { class: 'opcional-plegable', open: !estrecha },
        el('summary', { class: 'panel-fase-cab' }, el('h3', null, tituloOpc + ' ', el('span', { class: 'chip opcional-chip' }, 'Opcional')), el('span', { class: 'muted pequeno' }, f.situacionales.length + ' objetos · según el rival y la partida')),
        cuerpoOpc));
  }
  return el('div', { class: 'fase-fila' + (opc ? '' : ' sin-opcional') }, nucleo, opc);
}
function ayudaJuego() {
  return el('details', { class: 'plegable ayuda-juego' }, el('summary', null, 'Cómo pasar esta build al juego'),
    el('div', { class: 'contenido sec pequeno' }, el('ol', null,
      el('li', null, 'En el juego abre la tienda (tecla B), entra en las builds del héroe y crea una nueva (Create New Build).'),
      el('li', null, 'Pega el nombre y la descripción de la build con los botones «Copiar» de arriba.'),
      el('li', null, 'Por cada fase pulsa «Añadir categoría», pega su nombre y su descripción, y añade los objetos en el mismo orden.'),
      el('li', null, 'Crea otra categoría para los situacionales de esa fase y márcala como «Opcional»: el juego la muestra a la derecha de la build.'),
      el('li', null, 'Si el editor te deja añadir una nota al objeto, pega la que copias con «Copiar nota».'),
      el('li', null, 'Para las habilidades usa «Editar» en «Orden de los puntos de habilidad» y sigue la secuencia de la sección Orden de habilidades.'))));
}
function textoBuildFases(h) {
  const f = fasesDe(h); if (!f) return '';
  const L = [`${f.titulo_build_juego || 'Build de ' + nombreH(h)} — ${nombreH(h)} (Taller de Deadlock)`];
  if (f.descripcion_build_juego) L.push(f.descripcion_build_juego);
  for (const fase of f.fases || []) {
    const info = FASES[fase.fase] || { nombre: fase.fase };
    const tn = partirTitulo(fase.titulo_categoria_juego || info.nombre, false);
    L.push('', `== Categoría: ${tn.nombre}${/\d/.test(tn.nombre) ? '' : ` (${fase.minutos || info.min} min)`}`);
    if (tn.desc) L.push('Descripción: ' + tn.desc);
    if (fase.objetivo) L.push('Objetivo: ' + fase.objetivo);
    const pagos = pagosDe(fase.nucleo, nucleoPrevio(h, fase));
    (fase.nucleo || []).forEach((e, i) => {
      const o = objeto(e.clase || e.objeto); if (!o) return; const d = compraDe(h, o.clase); const p = pagos.find((x) => x.o === o);
      L.push(`${i + 1}. ${nombreO(o)} (${fmt(o.coste)}${p && p.desde ? ', pagas ' + fmt(p.paga) + ' si ya tienes ' + nombreO(p.desde) : ''})${d ? ' [' + textoCompra(d) + ']' : ''}`);
      if (notaJuego(e)) L.push('   Nota para el juego: ' + notaJuego(e));
      if (e.cuando) L.push('   Cuándo: ' + sinCifrasReales(e.cuando, d));
      if (e.por_que) L.push('   Por qué: ' + sinCifrasReales(e.por_que, d));
    });
    if ((fase.situacionales || []).length) {
      const ts = partirTitulo(fase.titulo_situacionales_juego || info.nombre, true);
      L.push('', `-- Categoría opcional: ${ts.nombre}`);
      if (ts.desc) L.push('Descripción: ' + ts.desc);
      for (const e of fase.situacionales) {
        const o = objeto(e.clase || e.objeto); if (!o) continue; const rel = relacionReemplazo(e.reemplaza); const d = compraDe(h, o.clase);
        L.push(`- ${nombreO(o)} (${fmt(o.coste)})${d ? ' [' + textoCompra(d) + ']' : ''}`);
        if (notaJuego(e, true)) L.push('   Nota para el juego: ' + notaJuego(e, true));
        if (e.cuando) L.push('   Cómpralo si: ' + sinSiInicial(sinCifrasReales(e.cuando, d)));
        if (rel) L.push(`   ${rel.etiqueta}: ${rel.texto}`);
        if (e.por_que) L.push('   Por qué: ' + sinCifrasReales(e.por_que, d));
      }
    }
  }
  if ((f.vender || []).length) { L.push('', '== Qué vender y cuándo'); for (const v of f.vender) L.push(`- ${nombreObjetoTexto(v.clase || v.objeto)}: ${v.cuando}`); }
  return L.join('\n');
}
function bloqueBuildFases(h) {
  const f = fasesDe(h); if (!f || !(f.fases || []).length) return null;
  const cont = el('div', { class: 'build-por-fases' });
  cont.append(el('div', { class: 'fila acciones-build' },
    el('button', { type: 'button', class: 'boton primario', onclick: () => copiar(textoBuildFases(h)) }, 'Copiar build completa'),
    el('a', { class: 'boton', href: '#build-nueva-' + h.clase }, 'Abrir en el creador y personalizar')));
  if (f.titulo_build_juego) cont.append(lineaJuego('Nombre de la build en el juego', f.titulo_build_juego));
  if (f.descripcion_build_juego) cont.append(lineaJuego('Descripción de la build en el juego', f.descripcion_build_juego));
  cont.append(ayudaJuego());
  // Saltos rápidos entre fases (la build es larga)
  const saltos = f.fases.map((x) => [x.fase, (FASES[x.fase] || { nombre: x.fase }).nombre.replace(/^Fase /, '')]);
  if ((f.vender || []).length) saltos.push(['vender', 'Qué vender']);
  cont.append(el('nav', { class: 'saltos-fase', 'aria-label': 'Ir a una fase' }, el('span', { class: 'etiqueta' }, 'Ir a'),
    saltos.map(([id, t]) => el('a', { href: '#', onclick: (ev) => { ev.preventDefault(); const d = document.getElementById(id === 'vender' ? 'vender-build' : 'fase-' + id); if (d) d.scrollIntoView({ block: 'start' }); } }, t[0].toUpperCase() + t.slice(1)))));
  for (const fase of f.fases) cont.append(panelFase(h, fase));
  if ((f.vender || []).length) cont.append(el('section', { class: 'tarjeta vender', id: 'vender-build' }, el('h3', null, 'Qué vender y cuándo'),
    el('div', { class: 'col' }, f.vender.map((v) => { const o = objeto(v.clase || v.objeto); return o ? el('div', { class: 'vender-fila' }, chipO(o), el('span', { class: 'sec pequeno' }, v.cuando)) : null; }))));
  cont.append(el('p', { class: 'muted pequeno' }, 'Minutos y almas: media real de las partidas de los últimos 14 días con este héroe (api.deadlock-api.com). «Almas» son las almas acumuladas que se suelen llevar en ese minuto, no las que tienes en mano.'));
  return cont;
}

/* ---------- Minimapa ---------- */
const SVG_NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, ...hijos) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
  for (const h of hijos.flat()) if (h != null) e.append(h instanceof Node ? h : document.createTextNode(String(h)));
  return e;
}
function campamentosMapa() { return (D.mapa && D.mapa.campamentos) || []; }
function campamento(id) { return campamentosMapa().find((c) => c.id === id) || null; }
/** Campamento equivalente para la base de arriba: giro de 180° del mapa y el más cercano del mismo tipo */
function campamentoGirado(c) {
  const x = 1 - c.x, y = 1 - c.y;
  let mejor = null, dmin = Infinity;
  for (const d of campamentosMapa()) { if (d.tipo !== c.tipo) continue; const dd = Math.hypot(d.x - x, d.y - y); if (dd < dmin) { dmin = dd; mejor = d; } }
  return mejor || { ...c, x, y };
}
/** "temprana (2:00-8:00): campamento pequeño…" → { corta: "Temprana (2:00-8:00)", resto: "Campamento pequeño…" } */
function partirEtapa(etapa) {
  const s = String(etapa || '').trim();
  const m = s.match(/^([^:(,]+(?:\([^)]*\))?)[:,]?\s*(.*)$/);
  const may = (t) => t ? t[0].toUpperCase() + t.slice(1) : '';
  return m ? { corta: may(m[1].trim()), resto: may(m[2].trim()) } : { corta: may(s), resto: '' };
}
/** "~46-61 s (desplazamiento ~21 s: 131 m…; limpieza ~25-40 s según daño)" → { total: "~46-61 s", desglose: "desplazamiento ~21 s · limpieza ~25-40 s según daño" } */
function partirTiempo(t) {
  const s = String(t || '');
  const m = s.match(/^([^(]+?)\s*\((.*)\)\s*$/);
  if (!m) return { total: s, desglose: '' };
  return { total: m[1].trim(), desglose: m[2].split(';').map((p) => p.split(':')[0].trim()).filter(Boolean).join(' · ') };
}
/** Pone el punto de miles a los números de 4 cifras dentro de un texto (~1389 → ~1.389) */
// (sin tocar el año de una fecha: 06-03-2026)
function milesEnTexto(s) { return String(s || '').replace(/(^|[^\d.,\-/])(\d)(\d{3})(?!\d)(?![.,\-/]\d)/g, '$1$2.$3'); }
/** york_abajo_media → "ruta media"; con las horas de la etapa si las hay: "ruta media · 8:00-20:00" */
const SUFIJO_RUTA = { temprana: 'temprana', media: 'media', walker: 'del Walker', puente: 'del puente', oeste: 'oeste', este: 'este', campanario: 'del campanario', capilla: 'de la capilla', exterior: 'exterior', obra: 'de la obra' };
// Al girar el mapa 180°, la ruta oeste de Broadway pasa a ser la este y la de la capilla cae en la obra
const SUFIJO_ARRIBA = { oeste: 'este', este: 'oeste', capilla: 'obra' };
function nombreRuta(r, arriba) {
  let suf = String(r.id || '').split('_').slice(2).join('_');
  if (arriba && SUFIJO_ARRIBA[suf]) suf = SUFIJO_ARRIBA[suf];
  const horas = ((partirEtapa(r.etapa).corta.match(/\(([^)]*)\)/) || [])[1] || '').split(' o ')[0];
  return 'ruta ' + (SUFIJO_RUTA[suf] || suf || partirEtapa(r.etapa).corta.toLowerCase()) + (horas ? ' · ' + horas : '');
}
function rutaPorId(id) { return ((D.mapa && D.mapa.rutas) || []).find((r) => r.id === id) || null; }
function minimapa(opts = {}) {
  const { ruta = [], capas = ['campamentos', 'puentes', 'urna', 'grietas'], titulo = 'Minimapa', marcarCampamentos } = opts;
  const zoom = ruta.length > 0 && opts.zoom !== false;
  const caja = el('figure', { class: 'minimapa' });
  // Con ruta: encuadre cuadrado alrededor de sus campamentos (mínimo 40 % del mapa); f agranda las marcas en proporción
  let vb = [0, 0, 1000, 1000];
  if (zoom) {
    const xs = ruta.map((c) => c.x * 1000), ys = ruta.map((c) => c.y * 1000);
    const lado = Math.min(1000, Math.max(400, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 220));
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const lim = (v) => Math.max(0, Math.min(1000 - lado, v));
    vb = [lim(cx - lado / 2), lim(cy - lado / 2), lado, lado];
  }
  // En pantallas pequeñas el mapa se pinta a ~320 px: marcas algo más grandes para poder tocarlas
  const f = Math.max(0.6, vb[2] / 1000) * (typeof window !== 'undefined' && window.innerWidth < 600 ? 1.35 : 1);
  const lienzo = svg('svg', { viewBox: vb.map((v) => Math.round(v)).join(' '), role: 'img', 'aria-label': titulo });
  // Fondo del mapa (ya aclarado en el archivo); se pide cuando el mapa se acerca a la pantalla
  const fondo = svg('image', { x: 0, y: 0, width: 1000, height: 1000 });
  const urlFondo = 'assets/img/mapa/minimap_midtown_mid.webp';
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) { fondo.setAttribute('href', urlFondo); io.disconnect(); } }, { rootMargin: '800px 0px' });
    setTimeout(() => io.observe(caja), 0);
  } else fondo.setAttribute('href', urlFondo);
  lienzo.append(fondo);
  const P = (D.mapa && D.mapa.puntos) || {};
  const capa = (n) => capas.includes(n);
  // Tocar el mapa muestra debajo qué es la marca más cercana (el <title> no se ve en pantallas táctiles,
  // y así también responden las marcas pequeñas)
  const info = el('p', { class: 'info-mapa muted pequeno', 'aria-live': 'polite' }, 'Toca una marca para ver qué es.');
  const marcas = [];
  const conInfo = (nodo, texto, x, y) => { nodo.style.cursor = 'pointer'; marcas.push({ x, y, texto }); return nodo; };
  lienzo.addEventListener('click', (ev) => {
    const m = lienzo.getScreenCTM(); if (!m) return;
    const pt = lienzo.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const q = pt.matrixTransform(m.inverse());
    const escala = vb[2] / (lienzo.getBoundingClientRect().width || 1); // unidades del mapa por píxel de pantalla
    let mejor = null, dmin = 24 * escala;
    for (const mk of marcas) { const d = Math.hypot(mk.x - q.x, mk.y - q.y); if (d < dmin) { dmin = d; mejor = mk; } }
    if (mejor) info.textContent = mejor.texto;
  });
  // Los números de las zonas de cajas se pintan al final, encima de las demás marcas
  const textosEncima = [];
  if (capa('zonas_cajas')) for (const z of (((D.mapa && D.mapa.mecanicas) || {}).cajas || {}).zonas_densas || []) {
    const g = svg('g', null, svg('circle', { cx: z.x * 1000, cy: z.y * 1000, r: (12 + (z.cuantas || 10)) * f, fill: 'rgba(201,162,122,0.28)', stroke: '#c9a27a', 'stroke-width': 2.5 * f, 'stroke-dasharray': `${5 * f} ${4 * f}` }), svg('title', null, z.zona));
    textosEncima.push(svg('text', { x: z.x * 1000, y: z.y * 1000 + 6 * f, 'text-anchor': 'middle', 'font-size': 16 * f, 'font-weight': 700, fill: '#f3e3cf', stroke: '#0d1110', 'stroke-width': 3 * f, 'paint-order': 'stroke', 'font-family': 'IBM Plex Mono, monospace', 'pointer-events': 'none' }, String(z.cuantas || '')));
    lienzo.append(conInfo(g, `Zona de cajas: ${z.zona} · ${z.cuantas} piezas${z.detalle ? ' (' + z.detalle + ')' : ''}`, z.x * 1000, z.y * 1000));
  }
  if (capa('contenedores')) for (const p of P.contenedores || []) lienzo.append(conInfo(svg('circle', { cx: p.x * 1000, cy: p.y * 1000, r: 3.5 * Math.max(1, f), fill: '#f0c972', opacity: 0.85 }), 'Contenedor dorado: 50 % de soltar una mejora permanente. Se rompe con cualquier cosa.', p.x * 1000, p.y * 1000));
  if (capa('cajas_duras')) for (const p of P.cajas_duras || []) lienzo.append(conInfo(svg('rect', { x: p.x * 1000 - 4 * Math.max(1, f), y: p.y * 1000 - 4 * Math.max(1, f), width: 8 * Math.max(1, f), height: 8 * Math.max(1, f), fill: '#c9a27a', stroke: '#111', 'stroke-width': 1.5 }), 'Caja dura: solo se rompe con un golpe pesado; da más almas que una de madera.', p.x * 1000, p.y * 1000));
  if (capa('tiendas')) for (const p of P.tiendas || []) lienzo.append(conInfo(svg('rect', { x: p.x * 1000 - 9 * f, y: p.y * 1000 - 9 * f, width: 18 * f, height: 18 * f, rx: 3, fill: '#4fb3bf', stroke: '#0d1110', 'stroke-width': 3 * f }), 'Tienda (lateral o secreta).', p.x * 1000, p.y * 1000));
  if (capa('campamentos')) for (const c of campamentosMapa()) {
    const t = TIPO_CAMPAMENTO[c.tipo] || TIPO_CAMPAMENTO.medium;
    const dest = marcarCampamentos && marcarCampamentos.has(c.id);
    const r = t.r * f, op = dest || !marcarCampamentos ? 1 : 0.45;
    const forma = c.tipo === 'vault'
      ? svg('rect', { x: c.x * 1000 - r, y: c.y * 1000 - r, width: r * 2, height: r * 2, transform: `rotate(45 ${c.x * 1000} ${c.y * 1000})`, fill: t.color, stroke: '#0d1110', 'stroke-width': 3 * f, opacity: op })
      : svg('circle', { cx: c.x * 1000, cy: c.y * 1000, r, fill: t.color, stroke: '#0d1110', 'stroke-width': 3 * f, opacity: op });
    const texto = `${c.nombre || c.id} · ${t.nombre}${c.aparece ? ' · aparece ' + c.aparece : ''}${c.reaparece ? ' · reaparece ' + c.reaparece : ''}`;
    forma.append(svg('title', null, texto));
    lienzo.append(conInfo(forma, texto, c.x * 1000, c.y * 1000));
  }
  if (capa('puentes')) for (const p of P.puentes || []) lienzo.append(conInfo(svg('rect', { x: p.x * 1000 - 13 * f, y: p.y * 1000 - 13 * f, width: 26 * f, height: 26 * f, transform: `rotate(45 ${p.x * 1000} ${p.y * 1000})`, fill: '#6f9cf2', stroke: '#fff', 'stroke-width': 3 * f }, svg('title', null, 'Mejora de puente')), 'Mejora de puente: sale a las 5:00 y cada 5 minutos; dura 160 s.', p.x * 1000, p.y * 1000));
  if (capa('urna')) for (const p of P.urna || []) lienzo.append(conInfo(svg('circle', { cx: p.x * 1000, cy: p.y * 1000, r: 11 * f, fill: 'none', stroke: '#5fd3c0', 'stroke-width': 5 * f }, svg('title', null, 'Urna de almas')), 'Urna de almas: aparece a las 10:00 y da 4 mejoras permanentes a quien la entrega.', p.x * 1000, p.y * 1000));
  if (capa('grietas')) for (const p of P.grietas || []) lienzo.append(conInfo(svg('circle', { cx: p.x * 1000, cy: p.y * 1000, r: 13 * f, fill: 'none', stroke: '#e86b8f', 'stroke-width': 4 * f, 'stroke-dasharray': `${6 * f} ${5 * f}` }, svg('title', null, 'Grieta inestable')), 'Grieta inestable: sale entre las 10:00 y las 12:00, en el puente de York o en el de Greenwich.', p.x * 1000, p.y * 1000));
  if (ruta.length) {
    // Ruta en blanco: un color que no usa ninguna otra marca del mapa; números con un tamaño mínimo legible
    // En el mapa entero los números serían diminutos (sobre todo en el móvil): tamaño mínimo legible
    const fr = Math.max(f, vb[2] / 1000 >= 0.99 ? (window.innerWidth < 600 ? 2 : 1.25) : f);
    const pts = ruta.map((c) => `${c.x * 1000},${c.y * 1000}`).join(' ');
    lienzo.append(svg('polyline', { points: pts, fill: 'none', stroke: '#0d1110', 'stroke-width': 11 * f, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    lienzo.append(svg('polyline', { points: pts, fill: 'none', stroke: '#ffffff', 'stroke-width': 6 * f, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': `${14 * f} ${8 * f}` }));
    ruta.forEach((c, i) => {
      const t = TIPO_CAMPAMENTO[c.tipo] || {};
      const g = svg('g', null,
        svg('circle', { cx: c.x * 1000, cy: c.y * 1000, r: 17 * fr, fill: '#ffffff', stroke: '#0d1110', 'stroke-width': 3 * fr }),
        svg('text', { x: c.x * 1000, y: c.y * 1000 + 6 * fr, 'text-anchor': 'middle', 'font-size': 18 * fr, 'font-weight': 700, fill: '#0d1110', 'font-family': 'IBM Plex Mono, monospace' }, String(i + 1)),
        svg('title', null, `${i + 1}. ${c.nombre || c.id}`));
      // Al final de la lista: si coincide con otra marca, gana el paso de la ruta
      marcas.unshift({ x: c.x * 1000, y: c.y * 1000, texto: `${i + 1}. ${c.nombre || c.id} · ${t.nombre || ''}${c.aparece ? ' · aparece ' + c.aparece : ''}` });
      g.style.cursor = 'pointer';
      lienzo.append(g);
    });
  }
  // Nombres de carril y de base encima de todo, para orientarse (York a la izquierda, Greenwich a la derecha;
  // Hidden King abajo). En la vista ampliada solo los que caben enteros en el encuadre.
  lienzo.append(textosEncima);
  const cabe = (x, y, ancho, alto) => x - ancho / 2 >= vb[0] && x + ancho / 2 <= vb[0] + vb[2] && y - alto * 0.8 >= vb[1] && y <= vb[1] + vb[3];
  const rotulo = (x, y, t, tam, color) => (cabe(x, y, t.length * tam * f * 0.6, tam * f) ? svg('text', { x, y, 'text-anchor': 'middle', 'font-size': tam * f, 'font-weight': 700, fill: color || '#f3eee2', stroke: '#0d1110', 'stroke-width': 4 * f, 'paint-order': 'stroke', 'font-family': 'Inter, system-ui, sans-serif', 'pointer-events': 'none' }, t) : null);
  for (const y of [270, 730]) lienzo.append(rotulo(165, y, 'York', 26, '#f1cc30'), rotulo(500, y, 'Broadway', 26, '#7fd3e6'), rotulo(845, y, 'Greenwich', 26, '#8fd27a'));
  lienzo.append(rotulo(500, 985, 'Base Hidden King', 24), rotulo(500, 34, 'Base Archmother', 24));
  caja.append(lienzo);
  if (ruta.length) caja.append(el('button', { type: 'button', class: 'boton-mapa', onclick: () => caja.replaceWith(minimapa({ ...opts, zoom: !zoom })) }, zoom ? 'Ver el mapa entero' : 'Acercar a la ruta'));
  caja.append(info);
  const ley = el('figcaption', { class: 'leyenda-mapa' });
  if (capa('campamentos')) for (const [k, t] of Object.entries(TIPO_CAMPAMENTO)) ley.append(el('span', null, el('i', { style: { background: t.color, borderRadius: k === 'vault' ? '2px' : '50%', transform: k === 'vault' ? 'rotate(45deg) scale(0.85)' : null } }), t.nombre));
  if (capa('puentes')) ley.append(el('span', null, el('i', { style: { background: '#6f9cf2', transform: 'rotate(45deg)', borderRadius: '2px' } }), 'Mejora de puente'));
  if (capa('urna')) ley.append(el('span', null, el('i', { style: { border: '3px solid #5fd3c0', background: 'transparent', borderRadius: '50%' } }), 'Urna'));
  if (capa('grietas')) ley.append(el('span', null, el('i', { style: { border: '3px dashed #e86b8f', background: 'transparent', borderRadius: '50%' } }), 'Grieta'));
  if (capa('contenedores')) ley.append(el('span', null, el('i', { style: { background: '#f0c972', borderRadius: '50%', width: '7px', height: '7px' } }), 'Contenedor de mejoras'));
  if (capa('zonas_cajas')) ley.append(el('span', null, el('i', { style: { border: '2px dashed #c9a27a', background: 'rgba(201,162,122,0.28)', borderRadius: '50%' } }), 'Zona de cajas (nº de piezas)'));
  if (capa('cajas_duras')) ley.append(el('span', null, el('i', { style: { background: '#c9a27a' } }), 'Caja dura'));
  if (capa('tiendas')) ley.append(el('span', null, el('i', { style: { background: '#4fb3bf' } }), 'Tienda'));
  if (ruta.length) ley.append(el('span', null, el('i', { style: { background: '#ffffff', borderRadius: '50%', border: '1px solid #0d1110' } }), 'Ruta (en orden)'));
  caja.append(ley);
  return caja;
}

/* ---------- Plan de mapa (ficha de héroe) ---------- */
function bloquePlanMapa(h) {
  const f = fasesDe(h); const pm = f && f.plan_mapa; if (!pm) return null;
  const M = (D.mapa && D.mapa.mecanicas) || {};
  const mp = M.mejoras_puente || {};
  const cont = el('div', { class: 'plan-mapa' });
  // Con la base arriba elegida: el plan está escrito para la base de abajo (las rutas sí se giran)
  const avisoArriba = el('div', { class: 'aviso-caja', hidden: PREF.ladoMapa !== 'arriba' }, el('b', null, 'Juegas con la base arriba (Archmother). '), 'Los textos de este plan están escritos para la base de abajo: cambia York por Greenwich (y al revés) y cada campamento por su equivalente. Las rutas de jungla de más abajo ya están giradas para tu lado.');
  cont.append(avisoArriba);
  if (pm.linea) cont.append(el('div', { class: 'nota-caja' }, el('b', null, 'Línea: '), pm.linea));

  const grid = el('div', { class: 'grid-2', style: { marginTop: '14px' } });
  // Mejoras de puente
  const cajaPuente = el('section', { class: 'tarjeta' }, el('h3', null, 'Mejoras de los puentes: cuáles coger'),
    el('p', { class: 'muted pequeno' }, 'Salen a las 5:00 y cada 5 minutos en los dos puentes del centro, una en cada uno y visible en el minimapa. El tipo es al azar (a las 10:00 suelen salir los dos que no salieron a las 5:00, aunque no está confirmado). Se cogen con un golpe pesado, duran 160 s y se pierden al morir. ', el('a', { href: '#guia-mapa' }, 'Más detalles en la guía del mapa'), '.'));
  const lista = el('div', { class: 'puentes' });
  for (const m of (pm.mejoras_puente || []).slice().sort((a, b) => (a.prioridad || 9) - (b.prioridad || 9))) {
    const t = MEJORAS_PUENTE[m.tipo] || { nombre: m.tipo, juego: '', color: 'var(--laton)', efecto: '' };
    const ir = String(m.ir_a_por_ella || '');
    lista.append(el('div', { class: 'puente', style: { '--c': t.color } },
      el('div', { class: 'puente-cab' }, el('span', { class: 'puente-prio num', title: 'Prioridad' }, m.prioridad || '–'), el('b', null, t.nombre), el('span', { class: 'muted pequeno' }, t.juego ? `${t.juego} · ${t.efecto}` : ''),
        ir ? el('span', { class: 'chip ' + (/siempre/i.test(ir) ? 'ok' : /no merece/i.test(ir) ? 'mal' : 'aviso') }, ir) : null),
      m.por_que ? el('p', { class: 'sec pequeno' }, m.por_que) : null));
  }
  cajaPuente.append(lista);
  cajaPuente.append(el('details', { class: 'plegable', style: { marginTop: '8px' } }, el('summary', null, '¿Son permanentes las mejoras de los puentes?'), el('div', { class: 'contenido' }, aclaracionPermanentes())));
  if (pm.mejoras_permanentes) cajaPuente.append(el('div', { style: { marginTop: '10px' } }, el('div', { class: 'etiqueta' }, 'Mejoras permanentes (contenedores dorados, Sinner\'s Sacrifice)'), el('p', { class: 'sec pequeno' }, pm.mejoras_permanentes)));
  grid.append(cajaPuente);

  // Cronología
  if ((pm.cronologia || []).length) grid.append(el('section', { class: 'tarjeta' }, el('h3', null, 'Minuto a minuto'),
    el('ol', { class: 'cronologia' }, pm.cronologia.map((c) => el('li', null, el('span', { class: 'cron-min num' }, c.min), el('span', null, c.accion))))));
  cont.append(grid);

  // Jungla y rutas
  const jg = pm.jungla || {};
  const cajaJ = el('section', { class: 'tarjeta', style: { marginTop: '14px' } }, el('h3', null, 'Jungla: cuándo y por dónde'));
  if (jg.cuando_empezar) cajaJ.append(el('p', { class: 'sec' }, el('b', null, 'Cuándo empezar: '), jg.cuando_empezar));
  if (jg.que_campamentos) cajaJ.append(el('p', { class: 'sec' }, el('b', null, 'Qué campamentos: '), jg.que_campamentos));
  const rutas = (jg.rutas || []).map((r) => ({ ...r, def: rutaPorId(r.ruta_id) })).filter((r) => r.def);
  if (rutas.length && campamentosMapa().length) {
    const carrilDe = (r) => r.def.carril || r.carril;
    const sufijo = (r) => String(r.def.id || '').split('_').slice(2).join('_');
    const lado0 = PREF.ladoMapa === 'arriba' ? 'arriba' : 'abajo';
    // Con la base arriba, tu carril C usa la ruta de abajo del carril espejo, girada 180°
    const carrilVisto = (r, lado) => (lado === 'abajo' ? carrilDe(r) : CARRIL_ESPEJO[carrilDe(r)]);
    const estado = { lado: lado0, carril: carrilVisto(rutas[0], lado0), etapa: sufijo(rutas[0]) };
    const zona = el('div', { class: 'ruta-zona' });
    const ctlCarril = el('div', { class: 'control' }), ctlEtapa = el('div', { class: 'control' });
    const controles = el('div', { class: 'controles', style: { margin: '8px 0' } },
      el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Tu base en el minimapa'), segmento([['abajo', 'Abajo (Hidden King)'], ['arriba', 'Arriba (Archmother)']], estado.lado, (v) => { estado.lado = v; PREF.ladoMapa = v; guardarPref(); avisoArriba.hidden = v !== 'arriba'; pintarControles(); pintar(); }, null, 'Tu base en el minimapa')),
      ctlCarril, ctlEtapa);
    cajaJ.append(controles, zona);
    const opcionesDe = () => rutas.filter((r) => carrilVisto(r, estado.lado) === estado.carril);
    function pintarControles() {
      const carriles = ['York', 'Broadway', 'Greenwich'].filter((c) => rutas.some((r) => carrilVisto(r, estado.lado) === c));
      if (!carriles.includes(estado.carril)) estado.carril = carriles[0];
      ctlCarril.innerHTML = ''; ctlCarril.append(el('span', { class: 'etiqueta' }, 'Tu carril'), segmento(carriles.map((c) => [c, c]), estado.carril, (v) => { estado.carril = v; pintarControles(); pintar(); }, null, 'Tu carril'));
      const ops = opcionesDe();
      if (!ops.some((r) => sufijo(r) === estado.etapa)) estado.etapa = ops.length ? sufijo(ops[0]) : '';
      ctlEtapa.innerHTML = '';
      if (ops.length > 1) ctlEtapa.append(el('span', { class: 'etiqueta' }, 'Ruta'), segmento(ops.map((r) => [sufijo(r), nombreRuta(r.def, estado.lado === 'arriba').replace(/^ruta /, '')]), estado.etapa, (v) => { estado.etapa = v; pintar(); }, null, 'Ruta de jungla'));
    }
    pintarControles();
    // La primera frase de «Cuándo salir» habla de oleadas y tiempos; las siguientes nombran campamentos del otro lado
    const primeraFrase = (t) => String(t || '').replace(/\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1')
      .split(/(?<=[a-záéíóú0-9)])\.\s+(?=[A-ZÁÉÍÓÚ])|;\s+/)[0].replace(/\.?\s*$/, '.')
      .replace(/\bla (oeste|este)\b/g, (m, x) => 'la ' + (x === 'oeste' ? 'este' : 'oeste'));
    const cambiaCarriles = (t) => String(t || '').replace(/\b(York|Greenwich)\b/g, (m) => (m === 'York' ? 'Greenwich' : 'York'));
    const pintar = () => {
      zona.innerHTML = '';
      const ops = opcionesDe();
      const r = ops.find((x) => sufijo(x) === estado.etapa) || ops[0];
      if (!r) { zona.append(el('div', { class: 'vacio' }, 'No hay ruta para este carril con este héroe.')); return; }
      const arriba = estado.lado === 'arriba';
      // Base arriba: cada campamento se cambia por su equivalente exacto al otro lado (dato del mapa); si falta, el más cercano girado
      const pasos = [];
      for (const p of r.def.pasos || []) {
        const c0 = campamento(p.campamento); if (!c0) continue;
        const c = arriba ? (c0.espejo && campamento(c0.espejo)) || campamentoGirado(c0) : c0;
        if (pasos.length && pasos[pasos.length - 1].c.id === c.id) continue;
        // El mapa es casi simétrico: si el equivalente cae lejos del punto girado o cambia de tipo, se avisa
        const aprox = arriba && (Math.hypot(1 - c0.x - c.x, 1 - c0.y - c.y) > 0.06 || c.tipo !== c0.tipo);
        pasos.push({ c, nota: arriba ? '' : p.nota, aprox });
      }
      const cuadro = el('div', { class: 'ruta-grid' });
      cuadro.append(minimapa({ ruta: pasos.map((p) => p.c), marcarCampamentos: new Set(pasos.map((p) => p.c.id)), titulo: 'Ruta de jungla en ' + estado.carril }));
      const et = partirEtapa(r.def.etapa), tp = partirTiempo(r.def.tiempo_aprox);
      const detalleCamp = (c) => [c.composicion, c.almas_aprox ? 'almas: ' + milesEnTexto(c.almas_aprox) : ''].filter(Boolean).join(' · ');
      // Almas de la vuelta con la base arriba: suma de lo que dan sus campamentos a los 10 min
      const almas10 = (c) => { const m = String(c.almas_aprox || '').match(/~?([\d.]+) a los 10 min/); return m ? parseInt(m[1].replace(/\./g, ''), 10) : 0; };
      const sumaArriba = arriba ? pasos.reduce((s, p) => s + almas10(p.c), 0) : 0;
      const sinEquivalente = arriba && /campanario/.test(r.def.id || '');
      const lista2 = el('div', null,
        el('h4', { class: 'ruta-titulo' }, estado.carril + ' · ' + nombreRuta(r.def, arriba)),
        tp.total ? el('p', { class: 'muted pequeno' }, 'Unos ' + tp.total.replace(/^~/, '') + (tp.desglose ? ' (' + tp.desglose + ')' : '')) : null,
        sinEquivalente ? el('div', { class: 'aviso-caja' }, 'Esta ruta no tiene equivalente exacto con la base arriba: los Sinner\'s de ese lado están sueltos en la Sunken Plaza. Los pasos son los más parecidos.') : null,
        // Con la base arriba, los textos escritos para la ruta de abajo nombran campamentos de ese lado: no se muestran
        !arriba && et.resto ? el('p', { class: 'sec pequeno' }, et.resto) : null,
        r.def.cuando ? el('p', { class: 'sec pequeno' }, el('b', null, 'Cuándo salir: '), arriba ? primeraFrase(cambiaCarriles(r.def.cuando)) : r.def.cuando) : null,
        el('ol', { class: 'pasos-ruta' }, pasos.map((p) => el('li', null, el('b', null, p.c.nombre || p.c.id),
          el('span', { class: 'muted pequeno' }, (/sinner/i.test(p.c.nombre || '') ? '' : ' · ' + ((TIPO_CAMPAMENTO[p.c.tipo] || {}).nombre || p.c.tipo)) + (p.c.aparece ? ' · aparece ' + p.c.aparece : '') + (p.c.reaparece ? ' · reaparece ' + p.c.reaparece : '')),
          p.aprox ? el('span', { class: 'chip aviso pequeno', style: { marginLeft: '6px' }, title: 'Al otro lado no hay un campamento idéntico en ese sitio: es el más parecido' }, 'equivalente aproximado') : null,
          p.nota ? el('div', { class: 'sec pequeno' }, milesEnTexto(p.nota)) : (detalleCamp(p.c) ? el('div', { class: 'sec pequeno' }, detalleCamp(p.c)) : null)))),
        r.nota ? el('div', { class: 'nota-caja' }, el('b', null, 'Con ' + nombreH(h) + (arriba ? ' (consejo escrito para la base de abajo; sirve con los campamentos equivalentes): ' : ': ')), r.nota) : null,
        !arriba && r.def.almas_aprox ? el('p', { class: 'muted pequeno' }, 'Almas aproximadas de la vuelta: ' + milesEnTexto(r.def.almas_aprox)) : null,
        arriba && sumaArriba ? el('p', { class: 'muted pequeno' }, 'Almas de estos campamentos a los 10 min: ~' + fmt(sumaArriba) + ' (más cajas y mejoras).') : null,
        arriba ? el('p', { class: 'muted pequeno' }, 'Base arriba: es la ruta de abajo girada 180°, con York y Greenwich cambiados. El mapa es casi simétrico: los pasos sin equivalente exacto van marcados.') : null);
      cuadro.append(lista2);
      zona.append(cuadro);
    };
    pintar();
  }
  if (pm.cajas) cajaJ.append(el('p', { class: 'sec', style: { marginTop: '10px' } }, el('b', null, 'Cajas: '), pm.cajas));
  if (pm.rotaciones) cajaJ.append(el('p', { class: 'sec' }, el('b', null, 'Rotaciones: '), pm.rotaciones));
  cont.append(cajaJ);
  return cont;
}

/* ---------- Guía: mapa y jungla ---------- */
/** Respuesta corta a la duda más común: las mejoras de los puentes NO son permanentes */
function aclaracionPermanentes() {
  return el('ul', { class: 'lista-aclaracion sec pequeno' },
    el('li', null, el('b', null, 'Las de los puentes son temporales: '), 'duran 160 s y se pierden al morir. Salen desde las 5:00 (no desde las 10:00) y se renuevan cada 5 minutos.'),
    el('li', null, el('b', null, 'Lo que pasa a las 10:00 y confunde: '), 'sale la segunda tanda de los puentes, aparece la Urna de almas, las mejoras permanentes suben a nivel 2 y, entre las 10:00 y las 12:00, sale la Grieta inestable.'),
    el('li', null, el('b', null, 'Las permanentes salen de: '), 'contenedores dorados (50 % de soltar una), Sinner\'s Sacrifice (desde las 8:00; con golpe pesado da 4), la Urna (4 a quien la entrega), el jefe central (2 a cada jugador del equipo) y el objeto Golden Goose Egg.'));
}

/** Nombres en español de los puntos del mapa (los datos traen claves internas) */
const NOMBRE_PUNTO = { urna: 'Urna de almas', grieta: 'Grieta inestable', sinner: 'Sinner\'s Sacrifice', jefe_central: 'Jefe central', respiraderos: 'Respiraderos de vapor', snacks: 'Tentempiés de curación', teletransportes: 'Teletransportes', tienda_lateral: 'Tienda lateral', tienda_secreta: 'Tienda secreta', pozo_base: 'Pozo de almas de la base', movilidad_mapa: 'Cuerdas, plataformas de salto y túneles' };
/** Termina una frase con punto si no lo tiene */
function frase(t) { const s = String(t || '').trim(); return !s ? '' : /[.!?…)]$/.test(s) ? s : s + '.'; }
/** Celda de tabla con su etiqueta (en móvil la tabla se ve como tarjetas y la etiqueta va delante) */
function celda(etiqueta, contenido, clase) { return el('td', { 'data-label': etiqueta, class: clase || null }, contenido); }

function vistaGuiaMapa() {
  const cont = el('div', { class: 'guia-mapa' });
  const M = (D.mapa && D.mapa.mecanicas) || null;
  if (!M) { cont.append(el('div', { class: 'vacio' }, 'La guía del mapa se cargará en la próxima actualización.')); return cont; }
  const mp = M.mejoras_puente || {};
  const secciones = [];
  const seccion = (id, titulo, ...hijos) => { secciones.push([id, titulo]); return el('section', { class: 'seccion', id }, el('h2', null, titulo), ...hijos); };
  const indice = el('nav', { class: 'saltos-fase indice-mapa', 'aria-label': 'Secciones de la guía del mapa' });
  cont.append(indice);

  // Mejoras de puente
  const filasP = [['Qué son', mp.que_son], ['Dónde', mp.donde], ['Cuándo aparecen', mp.aparecen], ['Cuánto duran', mp.duracion], ['Si nadie la coge', mp.caducan], ['Cómo se coge', mp.como_coger]].filter((f) => f[1]);
  const secP = seccion('gm-puentes', 'Mejoras de los puentes');
  if (filasP.length) secP.append(el('dl', { class: 'ficha-dl' }, filasP.map(([k, v]) => [el('dt', null, k), el('dd', null, v)])));
  secP.append(el('div', { class: 'nota-caja' }, el('b', null, '¿Son permanentes? No.'), aclaracionPermanentes()));
  if ((mp.tipos || []).length) {
    const tb = el('table', { class: 'tabla tabla-tarjetas' }, el('thead', null, el('tr', null, ['Tipo', 'Minuto 5', 'Minuto 20', 'Minuto 40', 'A quién le sirve'].map((t) => el('th', null, t)))));
    tb.append(el('tbody', null, mp.tipos.map((t) => {
      const T = MEJORAS_PUENTE[t.id] || { nombre: t.nombre_es || t.id, color: 'var(--laton)' };
      return el('tr', null, celda('Tipo', [el('span', { class: 'chip', style: { color: T.color } }, T.nombre), t.nombre_juego_en ? el('div', { class: 'muted pequeno' }, 'En inglés: ' + t.nombre_juego_en) : null]),
        celda('Minuto 5', t.efecto_min5 || '—', 'pequeno'), celda('Minuto 20', t.efecto_min20 || '—', 'pequeno'), celda('Minuto 40', t.efecto_min40 || '—', 'pequeno'), celda('A quién le sirve', t.para_quien || '', 'pequeno sec col-ancha'));
    })));
    secP.append(el('div', { class: 'tabla-env' }, tb));
  }
  cont.append(secP);

  // Mejoras permanentes
  const perm = M.mejoras_permanentes || {};
  if ((perm.fuentes || []).length || (perm.tipos || []).length) {
    const secM = seccion('gm-permanentes', 'Mejoras permanentes');
    const limpio = (v) => (v && v.trim() !== '—' ? v : null);
    if ((perm.fuentes || []).length) secM.append(el('ul', { class: 'sec' }, perm.fuentes.map((x) => el('li', null, el('b', null, x.fuente + ': '), [x.como, x.cuando, x.probabilidad].map(limpio).filter(Boolean).join(' · ')))));
    if ((perm.tipos || []).length) {
      const tb = el('table', { class: 'tabla tabla-tarjetas' }, el('thead', null, el('tr', null, ['Mejora', 'Desde el min 0', 'Desde el min 10', 'Desde el min 30'].map((t) => el('th', null, t)))));
      tb.append(el('tbody', null, perm.tipos.map((t) => el('tr', null, celda('Mejora', el('b', null, t.nombre_es || String(t.id).replace(/_/g, ' '))), celda('Desde el min 0', t.valores_min0 || '—', 'pequeno nowrap'), celda('Desde el min 10', t.valores_min10 || '—', 'pequeno nowrap'), celda('Desde el min 30', t.valores_min30 || '—', 'pequeno nowrap')))));
      secM.append(el('div', { class: 'tabla-env' }, tb));
    }
    if (perm.se_pueden_elegir) secM.append(el('p', { class: 'sec' }, el('b', null, '¿Se puede elegir? '), perm.se_pueden_elegir));
    cont.append(secM);
  }

  // Mapa completo con capas
  const secMapa = seccion('gm-mapa', 'Mapa: campamentos, puentes, urna y grietas');
  const capasDisp = [['campamentos', 'Campamentos'], ['puentes', 'Mejoras de puente'], ['urna', 'Urna'], ['grietas', 'Grieta'], ['zonas_cajas', 'Zonas de cajas'], ['contenedores', 'Contenedores de mejoras'], ['cajas_duras', 'Cajas duras'], ['tiendas', 'Tiendas']];
  let capas = ['campamentos', 'puentes', 'urna', 'grietas', 'tiendas'];
  const zonaMapa = el('div');
  const chips = el('div', { class: 'fila', style: { marginBottom: '8px' } }, capasDisp.map(([k, t]) => el('button', { type: 'button', class: 'chip boton-chip' + (capas.includes(k) ? ' activo' : ''), 'aria-pressed': capas.includes(k) ? 'true' : 'false', onclick: (e) => { capas = capas.includes(k) ? capas.filter((x) => x !== k) : [...capas, k]; e.currentTarget.classList.toggle('activo'); e.currentTarget.setAttribute('aria-pressed', capas.includes(k) ? 'true' : 'false'); pintarMapa(); } }, t)));
  const pintarMapa = () => { zonaMapa.innerHTML = ''; zonaMapa.append(el('div', { class: 'mapa-grande' }, minimapa({ capas, titulo: 'Mapa con capas' }))); };
  secMapa.append(chips, zonaMapa); pintarMapa();
  cont.append(secMapa);

  // Cronología
  if ((M.cronologia || []).length) cont.append(seccion('gm-cronologia', 'Cronología de la partida', el('ol', { class: 'cronologia' }, M.cronologia.map((c) => el('li', null, el('span', { class: 'cron-min num' }, c.min), el('span', null, c.evento))))));

  // Oleadas y cajas
  const otros = el('div', { class: 'grid-2' });
  if (M.ciclo_oleadas) {
    // "Intro… Ventanas para la jungla: (1) … (2) …" → párrafo + lista
    const partes = String(M.ciclo_oleadas).split(/\s*\((\d)\)\s*/);
    const intro = partes[0]; const items = []; for (let i = 2; i < partes.length; i += 2) items.push(partes[i].replace(/[;,]\s*$/, ''));
    otros.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Oleadas y tiempo para la jungla'), el('p', { class: 'sec pequeno' }, intro), items.length ? el('ol', { class: 'sec pequeno lista-ventanas' }, items.map((t) => el('li', null, frase(t[0].toUpperCase() + t.slice(1))))) : null));
  }
  const cj = M.cajas || {};
  // Zonas con más cajas del lado de abajo (las de arriba son sus equivalentes girados)
  const zonas = (cj.zonas_densas || []).filter((z) => z.lado !== 'arriba').sort((a, b) => (b.cuantas || 0) - (a.cuantas || 0)).slice(0, 8);
  if (cj.aparecen || cj.consejo) otros.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Cajas'),
    el('dl', { class: 'ficha-dl compacta' }, [['Aparecen', cj.aparecen], ['Reaparecen', cj.reaparecen], ['Tipos', cj.tipos], ['Qué dan', cj.que_dan]].filter((x) => x[1]).map(([k, v]) => [el('dt', null, k), el('dd', { class: 'pequeno' }, frase(v))])),
    cj.consejo ? el('p', { class: 'sec pequeno' }, el('b', null, 'Consejo: '), cj.consejo) : null,
    zonas.length ? el('div', null, el('div', { class: 'etiqueta', style: { marginTop: '10px' } }, 'Dónde hay más cajas (base abajo; actívalo en el mapa con «Zonas de cajas»)'),
      el('ol', { class: 'sec pequeno lista-ventanas' }, zonas.map((z) => el('li', null, el('b', null, z.zona), ' · ' + z.cuantas + ' piezas' + (z.detalle ? ': ' + z.detalle : ''))))) : null));
  if (otros.children.length) cont.append(seccion('gm-oleadas', 'Oleadas y cajas', otros));

  // Otros puntos del mapa
  if ((M.otros || []).length) cont.append(seccion('gm-otros', 'Otros objetivos y puntos del mapa', el('div', { class: 'grid-3' }, M.otros.map((o) => el('div', { class: 'tarjeta' },
    el('h3', null, NOMBRE_PUNTO[o.id] || String(o.id).replace(/_/g, ' ')), o.nombre_en ? el('div', { class: 'muted pequeno' }, 'En inglés: ' + o.nombre_en) : null,
    el('dl', { class: 'ficha-dl compacta' }, [['Cuándo', o.cuando], ['Dónde', o.donde], ['Para qué', o.para_que]].filter((x) => x[1] && x[1].trim() !== '—').map(([k, v]) => [el('dt', null, k), el('dd', { class: 'pequeno' }, v)])))))));

  // Rutas tipo
  const rutas = (D.mapa && D.mapa.rutas) || [];
  if (rutas.length) {
    const secR = seccion('gm-rutas', 'Rutas de jungla por carril', el('p', { class: 'sec' }, 'Rutas para la base de abajo (Hidden King). Con la base arriba (Archmother), la ruta del carril York equivale a la de Greenwich girada 180° (y al revés). En la ficha de cada héroe tienes las que mejor le encajan, con el botón para cambiar de lado.'));
    let sel = rutas[0].id;
    const zona = el('div');
    const pintarR = () => {
      zona.innerHTML = '';
      const r = rutas.find((x) => x.id === sel) || rutas[0];
      const pasos = (r.pasos || []).map((p) => ({ c: campamento(p.campamento), nota: p.nota })).filter((p) => p.c);
      const et = partirEtapa(r.etapa), tp = partirTiempo(r.tiempo_aprox);
      zona.append(el('div', { class: 'ruta-grid' }, minimapa({ ruta: pasos.map((p) => p.c), marcarCampamentos: new Set(pasos.map((p) => p.c.id)) }),
        el('div', null, el('h3', { class: 'ruta-titulo' }, `${r.carril} · ${nombreRuta(r)}`), et.resto ? el('p', { class: 'sec pequeno' }, et.resto) : null, r.para ? el('p', { class: 'sec pequeno' }, el('b', null, 'Para: '), r.para) : null, r.cuando ? el('p', { class: 'sec pequeno' }, el('b', null, 'Cuándo: '), r.cuando) : null,
          el('ol', { class: 'pasos-ruta' }, pasos.map((p) => el('li', null, el('b', null, p.c.nombre || p.c.id), el('span', { class: 'muted pequeno' }, (/sinner/i.test(p.c.nombre || '') ? '' : ' · ' + ((TIPO_CAMPAMENTO[p.c.tipo] || {}).nombre || '')) + (p.c.aparece ? ' · aparece ' + p.c.aparece : '')), p.nota ? el('div', { class: 'sec pequeno' }, milesEnTexto(p.nota)) : null))),
          tp.total ? el('p', { class: 'muted pequeno' }, 'Tiempo aproximado: ' + tp.total + (tp.desglose ? ' (' + tp.desglose + ')' : '')) : null,
          r.almas_aprox ? el('p', { class: 'muted pequeno' }, 'Almas aproximadas: ' + milesEnTexto(r.almas_aprox)) : null)));
    };
    const select = el('select', { class: 'select', 'aria-label': 'Elegir ruta', onchange: (e) => { sel = e.target.value; pintarR(); } }, rutas.map((r) => el('option', { value: r.id }, `${r.carril} · ${nombreRuta(r)}`)));
    secR.append(el('div', { class: 'controles' }, el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Ruta'), select)), zona);
    pintarR();
    cont.append(secR);
  }

  // Campamentos (tabla filtrable; en móvil, tarjetas)
  const camps = campamentosMapa();
  if (camps.length) {
    const secC = seccion('gm-campamentos', `Los ${camps.length} campamentos`, el('p', { class: 'sec pequeno' }, 'Tipo, carril, cuándo aparecen y reaparecen, y cuántas almas dan. Los Sinner\'s Sacrifice son máquinas: se golpean (mejor con golpe pesado) y el último golpe, con todas las luces encendidas, da 4 mejoras permanentes.'));
    // En móvil la lista de 51 tarjetas es muy larga: empieza filtrada por York
    let filtro = pantallaEstrecha() ? 'York' : '';
    const zonaT = el('div', { class: 'tabla-env' });
    const pintarT = () => {
      zonaT.innerHTML = '';
      const tb = el('table', { class: 'tabla tabla-tarjetas tabla-campamentos' }, el('thead', null, el('tr', null, ['Campamento', 'Tipo', 'Carril', 'Lado', 'Aparece', 'Reaparece', 'Almas'].map((t) => el('th', null, t)))));
      const lista = camps.filter((c) => !filtro || c.carril === filtro).sort((a, b) => String(a.carril).localeCompare(String(b.carril)) || String(a.lado).localeCompare(String(b.lado)));
      tb.append(el('tbody', null, lista.map((c) => el('tr', null,
        celda('Campamento', [el('b', null, c.nombre || c.id), c.composicion ? el('div', { class: 'muted pequeno' }, c.composicion) : null, c.nota && c.tipo !== 'vault' ? el('details', { class: 'compra-mas' }, el('summary', null, 'Detalles'), el('p', { class: 'pequeno sec' }, milesEnTexto(c.nota))) : null]),
        celda('Tipo', (TIPO_CAMPAMENTO[c.tipo] || {}).nombre || c.tipo), celda('Carril', c.carril || ''), celda('Lado', c.lado || ''),
        celda('Aparece', c.aparece || '', 'nowrap'), celda('Reaparece', c.reaparece || '', 'pequeno'), celda('Almas', milesEnTexto(c.almas_aprox || ''), 'pequeno')))));
      zonaT.append(tb);
    };
    secC.append(el('div', { class: 'controles' }, el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Carril'), segmento([['', 'Todos'], ['York', 'York'], ['Broadway', 'Broadway'], ['Greenwich', 'Greenwich']], filtro, (v) => { filtro = v; pintarT(); }, null, 'Filtrar campamentos por carril'))), zonaT);
    pintarT();
    cont.append(secC);
  }
  if ((M.fuentes || []).length) cont.append(el('details', { class: 'plegable', id: 'gm-fuentes', style: { marginTop: '10px' } }, el('summary', null, 'Fuentes'), el('ul', { class: 'contenido fuentes' }, M.fuentes.map((f) => el('li', null, el('a', { href: f.url, target: '_blank', rel: 'noopener' }, f.titulo || f.url), f.fecha ? el('span', { class: 'muted' }, ' · ' + f.fecha) : null)))));

  // Índice de secciones (el router usa el #, así que se salta con scroll)
  // Las secciones usan content-visibility: se maquetan las anteriores al destino antes de saltar (y se quedan así)
  const saltarSeccion = (d) => {
    for (let s = d.previousElementSibling; s; s = s.previousElementSibling) if (s.classList && s.classList.contains('seccion')) s.style.contentVisibility = 'visible';
    d.style.contentVisibility = 'visible'; d.scrollIntoView({ block: 'start' }); requestAnimationFrame(() => d.scrollIntoView({ block: 'start' }));
  };
  indice.append(el('span', { class: 'etiqueta' }, 'Ir a'), ...secciones.map(([id, t]) => el('a', { href: '#', onclick: (ev) => { ev.preventDefault(); const d = document.getElementById(id); if (d) saltarSeccion(d); } }, t.replace(/^Los \d+ /, '').replace(/^Mapa: .*/, 'Mapa').replace(/^\w/, (m) => m.toUpperCase()))));
  return cont;
}
