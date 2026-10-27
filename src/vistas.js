'use strict';
/* ============================================================
   Vistas: tier list, héroes, ficha de héroe, objetos, equipos, guía, novedades
   ============================================================ */

function segmento(opciones, valor, onCambio, clasePorValor, etiqueta) {
  const s = el('div', { class: 'segmento', role: 'group', 'aria-label': etiqueta || null });
  for (const [v, texto] of opciones) {
    const b = el('button', { type: 'button', 'aria-pressed': v === valor ? 'true' : 'false', class: (v === valor ? 'activo ' : '') + (clasePorValor ? clasePorValor(v) : ''), onclick: () => { $$('button', s).forEach((x) => { x.classList.remove('activo'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('activo'); b.setAttribute('aria-pressed', 'true'); onCambio(v); } }, texto);
    s.append(b);
  }
  return s;
}
function cabecera(pretitulo, titulo, texto, extra) {
  return el('div', { class: 'seccion-cab' }, el('div', null, pretitulo ? el('div', { class: 'pretitulo' }, pretitulo) : null, el('h1', null, titulo), texto ? el('p', null, texto) : null), extra || null);
}
function selectorNombres() {
  return segmento([['en', 'Nombres EN'], ['es', 'Nombres ES']], PREF.nombres, (v) => { PREF.nombres = v; guardarPref(); render(); });
}
function medidor(etiqueta, valor, max, clase, textoValor) {
  return el('div', { class: 'medidor ' + (clase || '') }, el('span', { class: 'sec' }, etiqueta), el('div', { class: 'barra' }, el('i', { style: { width: clamp((100 * valor) / max, 0, 100) + '%' } })), el('span', { class: 'num' }, textoValor != null ? textoValor : valor));
}
function barraWr(wr) {
  // Winrate centrado en 50 %: hacia la derecha si gana, hacia la izquierda si pierde
  const d = clamp((wr - 50) * 4, -50, 50);
  const b = el('div', { class: 'barra centro', title: fmtPct(wr) });
  const i = el('i', { style: { left: d >= 0 ? '50%' : (50 + d) + '%', width: Math.abs(d) + '%', background: d >= 0 ? 'var(--ok)' : 'var(--mal)' } });
  b.append(i); return b;
}

/* ============================================================ TIER LIST */
RUTAS.tier = function () {
  const raiz = el('div');
  const v = D.stats;
  // Etiquetas cortas con los nombres de rango del juego (el nombre largo va en el texto de la tabla)
  const CORTO = { todos: 'Todos', principiante: 'Initiate–Acolyte', medio: 'Sentinel–Emissary', oracle: 'Oracle+', phantom: 'Phantom+', ascendant: 'Ascendant+' };
  const bracketOpc = (v.brackets || []).map((b) => [b.clave, CORTO[b.clave] || b.nombre]);
  if (!(v.brackets || []).some((b) => b.clave === PREF.bracket)) PREF.bracket = 'todos';
  const ventanaOpc = (v.ventanas || []).map((w) => [w.clave, w.nombre]);
  const ctrl = el('div', { class: 'controles' },
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Fuente'), segmento([['datos', 'Datos de partidas'], ['comunidad', 'Comunidad y pros']], PREF.fuenteTier, (x) => { PREF.fuenteTier = x; guardarPref(); pintar(); })),
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Rango'), segmento(bracketOpc, PREF.bracket, (x) => { PREF.bracket = x; guardarPref(); pintar(); })),
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Periodo'), segmento(ventanaOpc, PREF.ventana, (x) => { PREF.ventana = x; guardarPref(); pintar(); })),
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Nombres'), selectorNombres()));
  const fecha = D.version && D.version.generado ? fmtFecha(D.version.generado) : '';
  const pre = VIVO.estado === 'vivo' && VIVO.hora ? 'Parche actual · estadísticas en vivo de las ' + new Date(VIVO.hora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Parche actual · datos del ' + fecha;
  raiz.append(cabecera(pre, 'Tier list de héroes', 'Qué héroes ganan más partidas ahora mismo, por rango y periodo, y qué opina la comunidad. Pulsa un héroe para ver cómo jugarlo y con qué build.'));
  raiz.append(ctrl);
  const cuerpo = el('div'); raiz.append(cuerpo);

  function pintar() {
    cuerpo.innerHTML = '';
    const datos = D.stats.datos[PREF.ventana] && D.stats.datos[PREF.ventana][PREF.bracket];
    if (PREF.fuenteTier === 'comunidad') {
      if (!D.meta || !D.meta.consenso || !D.meta.consenso.length) { cuerpo.append(el('div', { class: 'vacio' }, 'La tier list de la comunidad todavía no está cargada.')); return; }
      const urls = new Set((D.meta.fuentes || []).map((f) => String(f.url || '').replace(/[?#].*$/, '').replace(/\/$/, '')).filter(Boolean));
      const nTier = [...urls].filter((u) => !/youtube\.com|youtu\.be|reddit\.com|api\.deadlock-api/.test(u)).length;
      const nVideos = [...urls].filter((u) => /youtube\.com|youtu\.be/.test(u)).length; const nReddit = [...urls].filter((u) => /reddit\.com/.test(u)).length;
      cuerpo.append(el('p', { class: 'intro' }, `Consenso de ${nTier} tier lists de sitios de estadísticas y creadores, ${nVideos} vídeos y ${nReddit} hilos de Reddit recientes` + (D.meta.fecha ? ' (recogidos el ' + fmtFecha(D.meta.fecha) + ')' : '') + '. El número de cada héroe indica cuántas fuentes coinciden en su tier.'));
      const tabla = el('div', { class: 'tier-tabla' });
      for (const t of TIERS) {
        const fila = el('div', { class: 'tier-fila' }, el('div', { class: 'tier-letra t-' + t }, t));
        const chips = el('div', { class: 'tier-heroes' });
        for (const c of D.meta.consenso.filter((x) => x.tier === t)) {
          const h = heroe(c.id) || heroe(c.heroe); if (!h) continue;
          const s = datos && datos.heroes.find((x) => x.id === h.id);
          chips.append(el('a', { class: 'tier-chip', href: '#heroe-' + h.clase, title: c.por_que || '' }, imgH(h, ''), el('span', { class: 'datos' }, el('span', null, nombreH(h)), el('span', { class: 'num' }, (c.coincidencias ? c.coincidencias + ' fuentes' : '') + (s ? ' · ' + fmtPct(s.wr) : '')))));
        }
        fila.append(chips); tabla.append(fila);
      }
      cuerpo.append(tabla);
      if (D.meta.cambios_recientes) { const partes = partirCambios(D.meta.cambios_recientes); cuerpo.append(el('details', { class: 'plegable', style: { marginTop: '16px' } }, el('summary', null, 'Qué ha cambiado últimamente (parches y lectura de la comunidad)'), el('div', { class: 'contenido' }, el('ul', { class: 'sec', style: { paddingLeft: '1.1em', margin: 0 } }, partes.map((t) => el('li', { style: { marginBottom: '6px' } }, t)))))); }
      const extra = el('div', { class: 'grid-2', style: { marginTop: '16px' } });
      if (D.meta.principiantes && D.meta.principiantes.length) extra.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Recomendados para empezar'), el('div', { class: 'fila' }, D.meta.principiantes.map((n) => { const h = heroe(n.id || n.heroe || n); return h ? chipH(h, null, true) : null; }))));
      if (D.meta.mas_baneados && D.meta.mas_baneados.length) extra.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Los más baneados'), el('div', { class: 'fila' }, D.meta.mas_baneados.map((n) => { const h = heroe(n.id || n.heroe || n); return h ? chipH(h, null, true) : null; }))));
      if (extra.children.length) cuerpo.append(extra);
      return;
    }
    if (!datos) { cuerpo.append(el('div', { class: 'vacio' }, 'Sin datos para esta combinación.')); return; }
    const tabla = el('div', { class: 'tier-tabla' });
    for (const t of TIERS) {
      const fila = el('div', { class: 'tier-fila' }, el('div', { class: 'tier-letra t-' + t }, t));
      const chips = el('div', { class: 'tier-heroes' });
      for (const s of datos.heroes.filter((x) => x.tier === t)) {
        const h = heroe(s.id); if (!h) continue;
        const nuevo = (D.stats.nuevos || []).includes(h.id);
        const otra = PREF.ventana === '7d' ? statsDe(h, '30d', PREF.bracket) : null;
        const delta = otra && otra.wr != null ? Math.round((s.wr - otra.wr) * 10) / 10 : null;
        const pocas = s.partidas < 2000;
        chips.append(el('a', { class: 'tier-chip', href: '#heroe-' + h.clase, title: `${nombreH(h)}: ${fmtPct(s.wr)} de victorias, ${fmtPct(s.pick)} de presencia, ${fmt(s.partidas)} partidas${pocas ? ' (muestra pequeña)' : ''}${delta != null ? `, ${delta >= 0 ? '+' : ''}${delta} puntos frente a los últimos 30 días` : ''}${nuevo ? '. Héroe nuevo: su winrate aún refleja la curva de aprendizaje' : ''}` },
          imgH(h, ''), el('span', { class: 'datos' }, el('span', null, nombreH(h), nuevo ? el('span', { class: 'chip laton', style: { marginLeft: '6px', padding: '0 6px', fontSize: '0.66rem' } }, 'Nuevo') : null),
            el('span', { class: 'num' }, fmtPct(s.wr) + (pocas ? '*' : ''), delta != null && Math.abs(delta) >= 0.8 ? el('span', { class: 'delta ' + (delta > 0 ? 'sube' : 'baja') }, delta > 0 ? '▲' : '▼') : null, ' · ' + fmtPct(s.pick, 0) + ' pick'))));
      }
      fila.append(chips); tabla.append(fila);
    }
    cuerpo.append(tabla);
    cuerpo.append(el('p', { class: 'muted pequeno', style: { marginTop: '8px' } }, '* menos de 2.000 partidas: tómalo con cautela. ▲▼ tendencia del winrate frente a los últimos 30 días. «Nuevo»: héroe reciente, con mucha presencia y winrate aún en curva de aprendizaje.'));
    const info = el('div', { class: 'grid-2', style: { marginTop: '16px' } });
    info.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Cómo se calcula'),
      el('p', { class: 'sec pequeno' }, `Se usan ${fmt(datos.partidas)} partidas del periodo y rango elegidos (modo normal, ranked y no ranked). El winrate se suaviza hacia el 50 % cuando un héroe tiene pocas partidas (equivale a sumar 400 partidas neutras) y se compara con la media de todos los héroes (${fmtPct(datos.media)}). S = muy por encima de la media, B = en la media, D = muy por debajo. Los héroes con menos de 150 partidas no pueden ser S ni D.`),
      el('p', { class: 'sec pequeno' }, 'Un héroe con winrate alto pero poca presencia suele ser un héroe de nicho que funciona en manos de quien lo domina. Un héroe con presencia alta y winrate medio es sólido y fácil de encajar en cualquier equipo.')));
    const top = el('div', { class: 'tarjeta' }, el('h3', null, 'Lectura rápida'));
    const conHeroe = datos.heroes.filter((s) => heroe(s.id));
    const porPick = conHeroe.slice().sort((a, b) => b.pick - a.pick).slice(0, 5);
    const porKda = conHeroe.slice().sort((a, b) => (b.kda || 0) - (a.kda || 0)).slice(0, 5);
    top.append(el('div', { class: 'etiqueta' }, 'Más jugados'), el('div', { class: 'fila', style: { marginBottom: '10px' } }, porPick.map((s) => chipH(heroe(s.id), fmtPct(s.pick, 0), true))));
    top.append(el('div', { class: 'etiqueta' }, 'Mejor KDA medio'), el('div', { class: 'fila' }, porKda.map((s) => chipH(heroe(s.id), fmt(s.kda, 2), true))));
    info.append(top);
    cuerpo.append(info);
    // Tabla completa
    const det = el('details', { class: 'plegable', style: { marginTop: '16px' } }, el('summary', null, 'Tabla completa de estadísticas'));
    const tb = el('table', { class: 'tabla' }, el('thead', null, el('tr', null, ['Héroe', 'Tier', 'Winrate', 'Presencia', 'Partidas', 'KDA', 'Daño/partida', 'Almas/partida'].map((t, i) => el('th', { class: i >= 2 ? 'num' : '' }, t)))));
    const tbody = el('tbody');
    for (const s of datos.heroes) { const h = heroe(s.id); if (!h) continue; tbody.append(el('tr', { class: 'clicable', onclick: () => ir('heroe-' + h.clase) }, el('td', null, el('span', { class: 'fila', style: { gap: '8px', flexWrap: 'nowrap' } }, imgH(h, 'icono-heroe'), nombreH(h))), el('td', null, insigniaTier(s.tier)), el('td', { class: 'num' }, fmtPct(s.wr)), el('td', { class: 'num' }, fmtPct(s.pick)), el('td', { class: 'num' }, fmt(s.partidas)), el('td', { class: 'num' }, fmt(s.kda, 2)), el('td', { class: 'num' }, fmt(s.dano)), el('td', { class: 'num' }, fmt(s.souls)))); }
    tb.append(tbody); det.append(el('div', { class: 'contenido tabla-env' }, tb)); cuerpo.append(det);
  }
  pintar();
  return raiz;
};

/* ============================================================ HÉROES */
RUTAS.heroes = function () {
  const raiz = el('div');
  const estado = { q: '', tipo: '', arq: '', comp: '', orden: 'nombre' };
  raiz.append(cabecera(D.heroes.length + ' héroes', 'Héroes', 'Elige un héroe para ver su guía: cómo se juega, si conviene llevarlo a arma, espíritu o vitalidad, orden de habilidades y build por fases.'));
  const q = el('input', { class: 'entrada', type: 'search', placeholder: 'Filtrar por nombre', oninput: (e) => { estado.q = e.target.value; pintar(); }, 'aria-label': 'Filtrar héroes' });
  const ctrl = el('div', { class: 'controles' },
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Buscar'), q),
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Tipo'), segmento([['', 'Todos'], ...Object.entries(TIPOS_HEROE).filter(([k]) => D.heroes.some((h) => h.tipo === k))], '', (v) => { estado.tipo = v; pintar(); })),
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Se juega a'), segmento([['', 'Todo'], ['arma', 'Arma'], ['espiritu', 'Espíritu'], ['vitalidad', 'Vitalidad'], ['hibrido', 'Híbrido']], '', (v) => { estado.arq = v; pintar(); })),
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Dificultad'), segmento([['', 'Toda'], ['1', 'Fácil'], ['2', 'Media'], ['3', 'Alta']], '', (v) => { estado.comp = v; pintar(); })),
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Orden'), segmento([['nombre', 'Nombre'], ['wr', 'Winrate'], ['pick', 'Presencia'], ['tier', 'Tier']], 'nombre', (v) => { estado.orden = v; pintar(); })),
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Nombres'), selectorNombres()));
  raiz.append(ctrl);
  const grid = el('div', { class: 'grid-heroes' }); raiz.append(grid);
  function pintar() {
    grid.innerHTML = '';
    let lista = D.heroes.filter((h) => {
      if (estado.q && !sinAcentos(h.nombre).includes(sinAcentos(estado.q)) && !sinAcentos(h.nombre_en).includes(sinAcentos(estado.q))) return false;
      if (estado.tipo && h.tipo !== estado.tipo) return false;
      if (estado.arq && arquetipoDe(h) !== estado.arq) return false;
      if (estado.comp) { const g = guia(h); const c = g && g.dificultad ? (g.dificultad <= 2 ? 1 : g.dificultad === 3 ? 2 : 3) : Math.min(3, h.complejidad || 2); if (String(c) !== estado.comp) return false; }
      return true;
    });
    const ordenTier = { S: 0, A: 1, B: 2, C: 3, D: 4 };
    lista.sort((a, b) => {
      const sa = statsDe(a) || {}, sb = statsDe(b) || {};
      if (estado.orden === 'wr') return (sb.wr || 0) - (sa.wr || 0);
      if (estado.orden === 'pick') return (sb.pick || 0) - (sa.pick || 0);
      if (estado.orden === 'tier') return (ordenTier[sa.tier] ?? 9) - (ordenTier[sb.tier] ?? 9) || (sb.wr || 0) - (sa.wr || 0);
      return nombreH(a).localeCompare(nombreH(b), 'es');
    });
    if (!lista.length) { grid.append(el('div', { class: 'vacio', style: { gridColumn: '1 / -1' } }, 'Ningún héroe coincide con los filtros.')); return; }
    for (const h of lista) {
      const s = statsDe(h); const g = guia(h);
      grid.append(el('a', { class: 'tarjeta-heroe', href: '#heroe-' + h.clase },
        el('img', { src: h.imagen.carta, alt: '', loading: 'lazy' }),
        el('div', { class: 'esquina' }, pillArq(arquetipoDe(h)), (D.stats.nuevos || []).includes(h.id) ? el('span', { class: 'arquetipo', style: { background: 'var(--laton)', color: '#1a1409' } }, 'Nuevo') : null),
        el('div', { class: 'esquina-der' }, insigniaTier(s && s.tier)),
        el('div', { class: 'velo' }, el('div', { class: 'nombre' }, nombreH(h)), el('div', { class: 'rol' }, (g && g.rol) || tipoHeroe(h) + (s ? ' · ' + fmtPct(s.wr) : '')))));
    }
  }
  pintar();
  return raiz;
};

/* ============================================================ FICHA DE HÉROE */
/** Nombres de categoría de las builds del juego: traduce los tokens de localización (#CITADEL_HEROBUILDS_…) */
const CATEGORIAS_JUEGO = { EARLY: 'Inicio', EARLYGAME: 'Inicio de partida', LANE: 'Línea', LANING: 'Línea', MID: 'Medio', MIDGAME: 'Medio de partida', LATE: 'Final', LATEGAME: 'Final de partida', CORE: 'Núcleo', SITUATIONAL: 'Situacionales', OPTIONAL: 'Opcionales', LUXURY: 'Lujo', DEFENSIVE: 'Defensivos', OFFENSIVE: 'Ofensivos', ACTIVES: 'Activos', FLEX: 'Flexibles' };
function nombreCategoria(n) {
  const s = String(n || '').trim();
  const m = s.match(/^#?CITADEL_HEROBUILDS_([A-Z_]+)$/i);
  if (m) { const k = m[1].toUpperCase(); return CATEGORIAS_JUEGO[k] || k.charAt(0) + k.slice(1).toLowerCase().replace(/_/g, ' '); }
  return s || 'Objetos';
}
function bloque(id, titulo, sub, ...hijos) { return el('section', { class: 'bloque', id: 'b-' + id }, el('h2', null, titulo, sub ? el('span', { class: 'sub' }, sub) : null), ...hijos); }
function listaItemsBuild(entradas, campoTexto) {
  const cont = el('div');
  for (const e of entradas || []) {
    const o = objeto(e.clase || e.objeto); if (!o) continue;
    const r = RANURAS[o.ranura] || {};
    cont.append(el('div', { class: 'item-fila ' + (r.clase || '') }, imgO(o, { onclick: () => abrirObjeto(o) }), el('div', null, el('div', { class: 'nombre', onclick: () => abrirObjeto(o) }, nombreO(o), el('span', { class: 'coste' }, fmtSouls(o.coste) + ' · ' + (r.nombre || ''))), e[campoTexto] ? el('div', { class: 'porque' }, e[campoTexto]) : null)));
  }
  if (!cont.children.length) cont.append(el('div', { class: 'muted pequeno' }, 'Sin objetos.'));
  return cont;
}
function tarjetaHabilidad(a, h) {
  const t = el('div', { class: 'habilidad' });
  t.append(el('div', { class: 'cab' }, el('img', { src: a.imagen, alt: '' }), el('div', null, el('div', { class: 'tecla' }, (a.tipo === 'ultimate' ? 'Definitiva' : 'Habilidad') + ' · tecla ' + a.tecla), el('div', { class: 'nombre' }, PREF.nombres === 'es' ? a.nombre : a.nombre_en || a.nombre, (a.nombre_en && a.nombre_en !== a.nombre) ? el('small', null, PREF.nombres === 'es' ? a.nombre_en : a.nombre) : null))));
  const metas = el('div', { class: 'metas' });
  if (a.enfriamiento) metas.append(el('span', { class: 'chip' }, '⟳ ' + fmt(a.enfriamiento, 1) + ' s'));
  if (a.cargas && a.cargas > 1) metas.append(el('span', { class: 'chip' }, a.cargas + ' cargas'));
  if (a.duracion) metas.append(el('span', { class: 'chip' }, fmt(a.duracion, 1) + ' s de duración'));
  if (a.alcance) metas.append(el('span', { class: 'chip' }, fmt(a.alcance, 0) + ' m'));
  if (metas.children.length) t.append(metas);
  if (a.resumen) t.append(el('div', { class: 'sec', style: { fontWeight: 600 } }, a.resumen));
  t.append(el('div', { class: 'desc', html: rico(a.descripcion) }));
  if (a.importantes && a.importantes.length) t.append(el('div', { class: 'importantes' }, a.importantes.slice(0, 6).map((p) => el('span', null, p.etiqueta + ': ', el('b', null, fmt(p.valor, 2) + p.sufijo)))));
  const mej = el('div', { class: 'mejoras' });
  for (const m of a.mejoras || []) mej.append(el('div', { class: 'mejora' }, el('span', { class: 'pa' }, m.nivel + '·' + m.coste_pa + ' PA'), el('span', { html: rico(m.texto) || '<span class="muted">—</span>' })));
  if (mej.children.length) t.append(mej);
  return t;
}
function pasoOrden(ab, etiqueta, nivel, extraClase) {
  return el('div', { class: 'orden-paso ' + (extraClase || ''), title: ab ? (PREF.nombres === 'es' ? ab.nombre : ab.nombre_en || ab.nombre) + ' — ' + etiqueta : etiqueta }, el('img', { src: ab ? ab.imagen : '', alt: '' }), el('span', { class: 'n' }, etiqueta), nivel ? el('span', { class: 'nivel' }, nivel) : null);
}
/** Dada una secuencia de acciones [{tipo:'desbloqueo'|'mejora', h}] calcula el nivel en el que se puede ejecutar cada una */
function nivelesDeSecuencia(h, acciones) {
  const niveles = h.niveles || []; const resultado = [];
  let i = 0, pa = 0, desb = 0, tiers = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const coste = [1, 2, 5];
  for (const ac of acciones) {
    const necesita = ac.tipo === 'desbloqueo' ? 1 : coste[tiers[ac.h] || 0];
    while (i < niveles.length && (ac.tipo === 'desbloqueo' ? desb < necesita : pa < necesita)) { const n = niveles[i]; if (n.da === 'ap') pa++; if (n.da === 'desbloqueo') desb++; i++; }
    const nivelActual = i > 0 ? niveles[i - 1] : niveles[0];
    if (ac.tipo === 'desbloqueo') desb -= 1; else { pa -= necesita; tiers[ac.h] = (tiers[ac.h] || 0) + 1; }
    resultado.push({ ...ac, nivel: nivelActual ? nivelActual.nivel : null, souls: nivelActual ? nivelActual.souls : null, tier: ac.tipo === 'mejora' ? tiers[ac.h] : null, pa: necesita });
  }
  return resultado;
}
/** Lista de puntos [idx...] (la 1.ª aparición de cada habilidad es su desbloqueo; las siguientes, T1-T3) → acciones */
function accionesDePuntos(puntos) {
  const acciones = []; const vistos = new Set(); const tiers = {};
  for (const x of puntos || []) {
    if (![1, 2, 3, 4].includes(x)) continue;
    if (!vistos.has(x)) { vistos.add(x); acciones.push({ tipo: 'desbloqueo', h: x }); continue; }
    if ((tiers[x] || 0) >= 3) continue;
    tiers[x] = (tiers[x] || 0) + 1; acciones.push({ tipo: 'mejora', h: x });
  }
  return acciones;
}
/** Guarda unas acciones en la build: la lista exacta (puntos) y, por compatibilidad, desbloqueo y orden */
function fijarSecuencia(b, acciones) {
  const tiers = {};
  b.puntos = acciones.map((a) => a.h);
  b.desbloqueo = acciones.filter((a) => a.tipo === 'desbloqueo').map((a) => a.h);
  b.orden = acciones.filter((a) => a.tipo === 'mejora').map((a) => { tiers[a.h] = (tiers[a.h] || 0) + 1; return { h: a.h, pa: [1, 2, 5][tiers[a.h] - 1] }; });
  return b;
}
function secuenciaDesdeBuild(b) {
  // Con b.puntos, el orden exacto; si no (builds antiguas y de la comunidad), b.desbloqueo: [idx...] y
  // b.orden: [{h, pa}] → acciones en orden intercalando desbloqueos cuando hacen falta
  if (Array.isArray(b.puntos) && b.puntos.length) return accionesDePuntos(b.puntos);
  const acciones = []; const desbloqueados = new Set();
  const pendientes = (b.desbloqueo || []).slice();
  const tiers = {};
  for (const o of b.orden || []) {
    while (!desbloqueados.has(o.h) && pendientes.length) { const d = pendientes.shift(); desbloqueados.add(d); acciones.push({ tipo: 'desbloqueo', h: d }); }
    if (!desbloqueados.has(o.h)) { desbloqueados.add(o.h); acciones.push({ tipo: 'desbloqueo', h: o.h }); }
    if ((tiers[o.h] || 0) >= 3) continue; tiers[o.h] = (tiers[o.h] || 0) + 1;
    acciones.push({ tipo: 'mejora', h: o.h });
  }
  for (const d of pendientes) if (!desbloqueados.has(d)) { desbloqueados.add(d); acciones.push({ tipo: 'desbloqueo', h: d }); }
  return acciones;
}
function vistaSecuencia(h, acciones) {
  const abs = D.habilidades[h.id] || [];
  const cont = el('div', { class: 'orden-hab' });
  const calc = nivelesDeSecuencia(h, acciones);
  for (const ac of calc) {
    const ab = abs[ac.h - 1];
    cont.append(pasoOrden(ab, ac.tipo === 'desbloqueo' ? 'Desbl.' : 'Nivel ' + ac.tier, ac.nivel ? 'N' + ac.nivel : '', ac.tipo === 'desbloqueo' ? 'desbloqueo' : ''));
  }
  return cont;
}

RUTAS.heroe = function (clase) {
  const h = heroe(clase);
  if (!h) return el('div', { class: 'vacio' }, 'No existe ese héroe. ', el('a', { href: '#heroes' }, 'Ver todos los héroes'));
  const g = guia(h); const abs = D.habilidades[h.id] || []; const s = statsDe(h);
  const arq = arquetipoDe(h); const A = ARQUETIPOS[arq];
  const raiz = el('div');

  // Cabecera
  const cab = el('div', { class: 'heroe-cab' });
  cab.append(el('div', { class: 'carta' }, el('img', { src: h.imagen.carta, alt: nombreH(h) })));
  const info = el('div');
  info.append(el('div', { class: 'pretitulo' }, tipoHeroe(h) + ' · ' + (h.arma_tipo || '') + ' · dificultad ' + (g && g.dificultad ? g.dificultad + '/5' : (h.complejidad || '?') + '/3')));
  info.append(el('h1', null, nombreH(h), nombreAlt(h) ? el('span', { class: 'alias' }, ' · ' + nombreAlt(h)) : null));
  info.append(el('div', { class: 'rol-linea' }, (g && g.rol) || h.rol));
  const estilo = h.estilo || h.estilo_en || (g && g.arquetipo_por_que ? g.arquetipo_por_que.split(/(?<=\.)\s/).slice(0, 2).join(' ') : '');
  if (estilo) info.append(el('p', { class: 'sec' }, estilo));
  const LINEA_TXT = { duo: 'Línea en pareja', solo: 'Aguanta solo', ambas: 'Cualquier línea' };
  info.append(el('div', { class: 'fila' }, pillArq(arq), (D.stats.nuevos || []).includes(h.id) ? el('span', { class: 'chip laton', title: 'Héroe reciente: su winrate todavía refleja la curva de aprendizaje de los jugadores' }, 'Nuevo') : null, ...(h.etiquetas || []).map((t) => el('span', { class: 'chip' }, t)), g && g.linea_tipo ? el('span', { class: 'chip laton', title: 'En el mapa actual las tres líneas se juegan 2 contra 2; «aguanta solo» significa que no sufre cuando su pareja rota.' }, LINEA_TXT[g.linea_tipo] || g.linea_tipo) : null));
  const kpis = el('div', { class: 'kpis' });
  const bracketNombre = (D.stats.brackets.find((b) => b.clave === PREF.bracket) || {}).nombre || '';
  kpis.append(el('div', { class: 'kpi' }, el('div', { class: 'etiqueta' }, 'Tier · ' + bracketNombre), el('div', { class: 'valor' }, insigniaTier(s && s.tier), tierComunidad(h) ? el('small', null, ' comunidad: ' + tierComunidad(h)) : null)));
  kpis.append(el('div', { class: 'kpi' }, el('div', { class: 'etiqueta' }, 'Winrate ' + PREF.ventana), el('div', { class: 'valor num' }, s ? fmtPct(s.wr) : '—')));
  kpis.append(el('div', { class: 'kpi' }, el('div', { class: 'etiqueta' }, 'Presencia'), el('div', { class: 'valor num' }, s ? fmtPct(s.pick) : '—')));
  kpis.append(el('div', { class: 'kpi' }, el('div', { class: 'etiqueta' }, 'KDA medio'), el('div', { class: 'valor num' }, s ? fmt(s.kda, 2) : '—', s ? el('small', null, ` ${fmt(s.kills, 1)}/${fmt(s.muertes, 1)}/${fmt(s.asistencias, 1)}`) : null)));
  kpis.append(el('div', { class: 'kpi' }, el('div', { class: 'etiqueta' }, 'Partidas analizadas'), el('div', { class: 'valor num' }, s ? fmt(s.partidas) : '—')));
  info.append(kpis);
  info.append(el('div', { class: 'fila', style: { marginTop: '12px' } }, el('a', { class: 'boton primario', href: '#build-nueva-' + h.clase }, '＋ Crear build con este héroe'), el('a', { class: 'boton', href: '#equipos' }, 'Probar en el armador de equipos'), selectorNombres()));
  cab.append(info); raiz.append(cab);

  // Subnavegación
  const secciones = [['jugar', 'Cómo jugarlo'], ['habilidades', 'Habilidades'], ['orden', 'Orden de habilidades'], ['build', 'Build'], ...(fasesDe(h) && fasesDe(h).plan_mapa ? [['mapa', 'Plan de mapa']] : []), ['datos', 'Objetos por datos'], ['comunidad', 'Builds de la comunidad'], ['vs', 'Counters y sinergias'], ['stats', 'Estadísticas'], ['fuentes', 'Fuentes']];
  // Los bloques usan content-visibility (no se maquetan hasta acercarse): para saltar con precisión se
  // desactiva un momento, se salta y se vuelve a saltar cuando ya tienen su altura real
  // Solo hace falta maquetar los bloques anteriores al destino (son los que deciden dónde cae). Se quedan
  // maquetados: si volvieran a su altura provisional, la página se movería después del salto.
  const saltarA = (dest) => {
    for (let b = dest.previousElementSibling; b; b = b.previousElementSibling) if (b.classList && b.classList.contains('bloque')) b.style.contentVisibility = 'visible';
    dest.style.contentVisibility = 'visible';
    dest.scrollIntoView({ block: 'start' });
    requestAnimationFrame(() => dest.scrollIntoView({ block: 'start' }));
  };
  const subnav = el('nav', { class: 'subnav', 'aria-label': 'Secciones de la ficha' }, secciones.map(([id, t]) => el('a', { href: '#' + rutaActual, 'data-bloque': 'b-' + id, onclick: (e) => { e.preventDefault(); const dest = document.getElementById('b-' + id); if (dest) saltarA(dest); } }, t)));
  raiz.append(subnav);
  // Marca en el índice la sección que se está leyendo: la última cuyo principio ya pasó bajo las barras fijas
  // (tras un salto, la pulsada, aunque asome el final de la anterior)
  const marcar = (id) => {
    $$('a', subnav).forEach((a) => a.classList.toggle('activo', a.dataset.bloque === id));
    // En móvil el índice se desplaza de lado: que el enlace marcado quede a la vista (sin mover la página)
    const a = subnav.querySelector('a.activo');
    if (a && subnav.scrollWidth > subnav.clientWidth) subnav.scrollTo({ left: a.offsetLeft - (subnav.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' });
  };
  let fijadoHasta = 0;
  subnav.addEventListener('click', (e) => { const a = e.target.closest('a[data-bloque]'); if (a) { marcar(a.dataset.bloque); fijadoHasta = Date.now() + 900; } });
  if ('IntersectionObserver' in window) setTimeout(() => {
    const bloques = secciones.map(([id]) => document.getElementById('b-' + id)).filter(Boolean);
    const io = new IntersectionObserver(() => {
      if (Date.now() < fijadoHasta) return;
      const umbral = (window.innerWidth <= 900 ? 176 : 130) + 12;
      let actual = bloques[0];
      for (const b of bloques) if (b.getBoundingClientRect().top <= umbral) actual = b;
      if (actual) marcar(actual.id);
    }, { rootMargin: '-100px 0px -40% 0px', threshold: [0, 0.01] });
    bloques.forEach((b) => io.observe(b));
    window.addEventListener('hashchange', () => io.disconnect(), { once: true });
  }, 0);

  // Cómo jugarlo
  const panel = el('div', { class: 'arquetipo-panel' });
  const izq = el('div');
  izq.append(el('div', { class: 'arquetipo-grande ' + A.clase, style: { '--c': `var(--${arq === 'arma' ? 'arma' : arq === 'espiritu' ? 'esp' : arq === 'vitalidad' ? 'vit' : 'laton'})`, '--c-bg': `var(--${arq === 'arma' ? 'arma' : arq === 'espiritu' ? 'esp' : arq === 'vitalidad' ? 'vit' : 'laton'}-bg)` } }, el('div', { class: 'sello' }, A.corto), el('div', { class: 'titulo' }, 'Se juega a ' + A.nombre.toLowerCase(), el('small', null, A.desc))));
  if (g && g.arquetipo_por_que) izq.append(el('p', { class: 'sec' }, g.arquetipo_por_que));
  else izq.append(el('p', { class: 'sec' }, 'Deducido de los objetos que más compran los jugadores en la fase final de la partida (datos de la API). La guía detallada de este héroe se añadirá en la próxima actualización.'));
  if (g && g.arquetipos_alternativos && g.arquetipos_alternativos.length) { izq.append(el('div', { class: 'etiqueta', style: { marginTop: '10px' } }, 'Otras formas de jugarlo')); for (const alt of g.arquetipos_alternativos) { const AA = ARQUETIPOS[alt.tipo] || ARQUETIPOS.hibrido; izq.append(el('div', { class: 'fila', style: { marginBottom: '6px', alignItems: 'start' } }, pillArq(alt.tipo), el('span', { class: 'sec pequeno' }, alt.cuando))); } }
  const der = el('div');
  const escalado = (g && g.escalado) || null;
  if (escalado) {
    der.append(el('div', { class: 'etiqueta' }, 'Cuánto aprovecha cada tipo de objeto'));
    der.append(el('div', { class: 'escalado' }, medidor('Arma', escalado.arma || 0, 5, 'r-weapon', (escalado.arma || 0) + '/5'), medidor('Espíritu', escalado.espiritu || 0, 5, 'r-spirit', (escalado.espiritu || 0) + '/5'), medidor('Vitalidad', escalado.vitalidad || 0, 5, 'r-vitality', (escalado.vitalidad || 0) + '/5')));
  }
  if (g) {
    const lista = (t, arr, claseChip) => arr && arr.length ? el('div', { style: { marginTop: '10px' } }, el('div', { class: 'etiqueta' }, t), el('ul', { style: { margin: '4px 0 0', paddingLeft: '1.1em' }, class: 'sec pequeno' }, arr.map((x) => el('li', null, x)))) : null;
    der.append(lista('Fortalezas', g.fortalezas), lista('Debilidades', g.debilidades));
  }
  panel.append(izq, der);
  const fases = g && g.como_jugar ? el('div', { class: 'fases', style: { marginTop: '16px' } }, [['Inicio (0–10 min)', g.como_jugar.inicio], ['Medio (10–25 min)', g.como_jugar.medio], ['Final (25+ min)', g.como_jugar.final]].map(([t, txt]) => el('div', { class: 'fase' }, el('div', { class: 'etiqueta' }, t), el('p', null, txt || '—')))) : null;
  const consejos = g && g.consejos && g.consejos.length ? el('div', { class: 'grid-2', style: { marginTop: '16px' } }, el('div', { class: 'tarjeta' }, el('h3', null, 'Consejos'), el('ul', { class: 'sec', style: { margin: 0, paddingLeft: '1.1em' } }, g.consejos.map((c) => el('li', null, c)))), g.combos && g.combos.length ? el('div', { class: 'tarjeta' }, el('h3', null, 'Combos'), el('ul', { class: 'sec', style: { margin: 0, paddingLeft: '1.1em' } }, g.combos.map((c) => el('li', null, c)))) : null) : null;
  const lineaTxt = g && (g.linea_texto || g.linea) ? el('div', { class: 'nota-caja', style: { marginTop: '14px' } }, el('b', null, 'En línea: '), g.linea_texto || g.linea) : null;
  raiz.append(bloque('jugar', 'Cómo jugarlo', '', panel, lineaTxt, fases, consejos));

  // Habilidades
  raiz.append(bloque('habilidades', 'Habilidades', 'niveles de mejora: 1, 2 y 5 puntos', el('div', { class: 'habilidades' }, abs.map((a) => tarjetaHabilidad(a, h)))));

  // Orden de habilidades
  const ordenCont = el('div');
  let acciones = null;
  const ohV = ordenHabilidadesDe(h);
  if (ohV) {
    const oh = ohV;
    // Los 16 puntos en el orden del texto (o, sin lista, deducidos de la prioridad para mejorar)
    const sec = secuenciaHabilidades(h, oh);
    if (sec) {
      acciones = secuenciaDesdeBuild(sec);
      ordenCont.append(el('p', { class: 'sec' }, oh.detalle || ''), el('div', { class: 'etiqueta', style: { margin: '8px 0 4px' } }, sec.puntos && sec.puntos.length >= 16 ? 'Los 16 puntos en orden, como dice el texto (N = nivel de poder en el que llega ese punto)' : 'Secuencia orientativa (N = nivel de poder en el que llega ese punto)'), vistaSecuencia(h, acciones));
    } else ordenCont.append(el('p', { class: 'sec' }, oh.detalle || ''));
  }
  const buildsCom = (D.builds && D.builds.heroes && D.builds.heroes[h.id]) || [];
  const conOrden = buildsCom.find((b) => b.orden && b.orden.length >= 6);
  if (!acciones && conOrden) ordenCont.append(el('p', { class: 'sec' }, 'Orden que usa la build de la comunidad más jugada:'), vistaSecuencia(h, secuenciaDesdeBuild(conOrden)));
  // Datos reales: qué habilidad se maxea primero y el orden más jugado (7 días, Oracle o superior)
  const hs = D.habStats && D.habStats.heroes && D.habStats.heroes[h.id];
  if (hs && (hs.maxea_primero.length || hs.orden.length)) {
    const caja = el('div', { class: 'grid-2', style: { marginTop: '14px' } });
    if (hs.maxea_primero.length) caja.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Qué maxean primero los jugadores'), el('p', { class: 'muted pequeno' }, 'Partidas de los últimos 7 días en ' + (D.habStats.bracket || 'rango alto') + ': porcentaje de jugadores que maxea cada habilidad antes que las demás y su winrate.'),
      el('div', { class: 'col', style: { gap: '6px' } }, hs.maxea_primero.map((m) => { const ab = abs[m.h - 1]; return ab ? el('div', { class: 'popular', style: { gridTemplateColumns: '36px 1fr 56px 56px' } }, el('img', { src: ab.imagen, alt: '', style: { width: '36px', height: '36px', borderRadius: '8px' } }), el('div', null, el('div', { class: 'nombre' }, PREF.nombres === 'es' ? ab.nombre : ab.nombre_en || ab.nombre), el('div', { class: 'barra' }, el('i', { style: { width: clamp(m.pct, 0, 100) + '%' } }))), el('span', { class: 'num pequeno' }, fmtPct(m.pct, 0)), el('span', { class: 'num pequeno', style: { color: m.wr >= 50 ? 'var(--ok)' : 'var(--mal)' } }, fmtPct(m.wr))) : null; }))));
    if (hs.orden.length) { const acc = []; const des = new Set(); const tiers = {}; for (const idx of hs.orden) { if (!des.has(idx)) { des.add(idx); acc.push({ tipo: 'desbloqueo', h: idx }); } else { tiers[idx] = (tiers[idx] || 0) + 1; if (tiers[idx] <= 3) acc.push({ tipo: 'mejora', h: idx }); } }
      caja.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Orden más jugado'), el('p', { class: 'muted pequeno' }, 'Camino más frecuente punto a punto (' + fmt(hs.orden_partidas) + ' partidas siguen este prefijo completo).'), vistaSecuencia(h, acc))); }
    ordenCont.append(caja);
  }
  if (!ordenCont.children.length) ordenCont.append(el('div', { class: 'muted' }, 'Sin datos de orden de habilidades todavía.'));
  raiz.append(bloque('orden', 'Orden de habilidades', '', ordenCont));

  // Build recomendada: por fases (núcleo + situacionales, con cuándo comprar) si existe; si no, la guía clásica
  const buildCont = el('div');
  const porFases = bloqueBuildFases(h);
  if (porFases) buildCont.append(porFases);
  else if (g && g.build) {
    buildCont.append(el('div', { class: 'build-fases' },
      el('div', { class: 'build-fase' }, el('div', { class: 'cab' }, el('span', { class: 'etiqueta' }, 'Inicio de línea'), el('span', { class: 'num pequeno muted' }, fmtSouls((g.build.inicio || []).reduce((s2, e) => s2 + ((objeto(e.clase || e.objeto) || {}).coste || 0), 0)))), listaItemsBuild(g.build.inicio, 'por_que')),
      el('div', { class: 'build-fase' }, el('div', { class: 'cab' }, el('span', { class: 'etiqueta' }, 'Medio de partida'), el('span', { class: 'num pequeno muted' }, fmtSouls((g.build.medio || []).reduce((s2, e) => s2 + ((objeto(e.clase || e.objeto) || {}).coste || 0), 0)))), listaItemsBuild(g.build.medio, 'por_que')),
      el('div', { class: 'build-fase' }, el('div', { class: 'cab' }, el('span', { class: 'etiqueta' }, 'Final'), el('span', { class: 'num pequeno muted' }, fmtSouls((g.build.final || []).reduce((s2, e) => s2 + ((objeto(e.clase || e.objeto) || {}).coste || 0), 0)))), listaItemsBuild(g.build.final, 'por_que')),
      el('div', { class: 'build-fase' }, el('div', { class: 'cab' }, el('span', { class: 'etiqueta' }, 'Situacionales'), el('span', { class: 'pequeno muted' }, 'según el rival')), listaItemsBuild(g.build.situacionales, 'cuando'))));
    buildCont.append(el('div', { class: 'fila', style: { marginTop: '12px' } }, el('a', { class: 'boton primario', href: '#build-nueva-' + h.clase }, 'Abrir esta build en el creador y personalizarla')));
  } else buildCont.append(el('div', { class: 'muted' }, 'La build explicada de este héroe llegará en la próxima actualización. Mientras tanto, abajo tienes los objetos con mejores resultados y las builds de la comunidad.'));
  raiz.append(bloque('build', 'Build recomendada', porFases ? 'por fases, con cuándo comprar cada objeto y sus situacionales (a la derecha en pantalla ancha)' : 'por fases, con el porqué de cada objeto', buildCont));
  const planMapa = bloquePlanMapa(h);
  if (planMapa) raiz.append(bloque('mapa', 'Plan de mapa', 'mejoras de puente, jungla, cajas y rutas', planMapa));

  // Objetos por datos
  const datosCont = el('div', { class: 'build-fases' });
  if (h.populares) {
    for (const [f, t] of [['inicio', 'Inicio'], ['medio', 'Medio'], ['final', 'Final']]) {
      const caja = el('div', { class: 'build-fase' }, el('div', { class: 'cab' }, el('span', { class: 'etiqueta' }, t), el('span', { class: 'pequeno muted' }, 'pick · winrate')));
      const lista = el('div', { class: 'populares' });
      for (const p of h.populares[f].slice(0, 8)) { const o = objeto(p.clase); if (!o) continue; const r = RANURAS[o.ranura] || {}; lista.append(el('div', { class: 'popular ' + (r.clase || '') }, imgO(o, { onclick: () => abrirObjeto(o) }), el('div', null, el('div', { class: 'nombre', onclick: () => abrirObjeto(o) }, nombreO(o)), el('div', { class: 'barra', title: 'Lo compra el ' + fmtPct(p.pick) }, el('i', { style: { width: clamp(p.pick, 0, 100) + '%' } }))), el('span', { class: 'num pequeno' }, fmtPct(p.pick, 0)), el('span', { class: 'num pequeno', style: { color: p.wr >= 50 ? 'var(--ok)' : 'var(--mal)' } }, fmtPct(p.wr)))); }
      caja.append(lista); datosCont.append(caja);
    }
  }
  raiz.append(bloque('datos', 'Objetos con mejores resultados', 'qué compran los jugadores de este héroe y con qué winrate (API, últimos 30 días)', datosCont, g && g.datos_api && g.datos_api.popular_items_resumen ? el('p', { class: 'sec', style: { marginTop: '10px' } }, g.datos_api.popular_items_resumen) : null));

  // Builds de la comunidad: recientes (o muy jugadas), sin nombres ofensivos, con categorías traducidas
  const comCont = el('div', { class: 'col' });
  const limiteFecha = Date.now() / 1000 - 150 * 86400;
  const buildsVisibles = buildsCom.filter((b) => ((b.actualizado || 0) >= limiteFecha || (b.stats && b.stats.partidas >= 1000)) && !/nutting|chup[aá]|piko|chromosom|минет|puta|nigg|fag|retard/i.test(b.nombre || ''));
  for (const b of buildsVisibles.slice(0, 5)) {
    const caja = el('div', { class: 'build-com' });
    const antigua = (b.actualizado || 0) < limiteFecha;
    caja.append(el('div', { class: 'cab' }, el('div', null, el('b', null, b.nombre || 'Build sin nombre'), el('span', { class: 'muted pequeno' }, b.actualizado ? ' · actualizada el ' + fmtFecha(b.actualizado) : ''), antigua ? el('span', { class: 'chip aviso', style: { marginLeft: '6px' } }, 'anterior al parche actual') : null), el('div', { class: 'fila' }, b.stats ? el('span', { class: 'chip ' + (b.stats.wr >= 50 ? 'ok' : 'mal') }, fmtPct(b.stats.wr) + ' en ' + fmt(b.stats.partidas) + ' partidas') : null, b.favoritos ? el('span', { class: 'chip' }, fmt(b.favoritos) + ' favoritos') : null, el('a', { class: 'boton mini', href: `#build-com-${h.id}-${b.id}` }, 'Abrir en el creador'))));
    for (const c of b.categorias.slice(0, 8)) { if (!c.objetos.length) continue; caja.append(el('div', { class: 'cat' + (c.opcional ? ' opcional' : '') }, el('div', { class: 'etiqueta' }, nombreCategoria(c.nombre), c.opcional ? el('span', { class: 'chip opcional-chip', style: { marginLeft: '6px' } }, 'Opcional') : null), el('div', { class: 'objs' }, c.objetos.slice(0, 14).map((x) => { const o = objeto(x.clase); return o ? imgO(o, { class: (RANURAS[o.ranura] || {}).clase || '', title: nombreO(o) + (x.nota ? ' — ' + x.nota : ''), onclick: () => abrirObjeto(o) }) : null; })))); }
    if (b.orden && b.orden.length) { const sec = secuenciaDesdeBuild(b); caja.append(el('div', { class: 'cat' }, el('div', { class: 'etiqueta' }, 'Orden de habilidades'), vistaSecuencia(h, sec.slice(0, 10)))); }
    comCont.append(caja);
  }
  if (!comCont.children.length) comCont.append(el('div', { class: 'muted' }, 'No hay builds de la comunidad descargadas para este héroe.'));
  raiz.append(bloque('comunidad', 'Builds de la comunidad', 'las más usadas en partidas reales (datos de 30 días) y las más guardadas', comCont));

  // Counters y sinergias
  const vsCont = el('div', { class: 'grid-2' });
  const ct = mejoresCounters(h, 6); const sin = mejoresSinergias(h, 8); const sinLinea = mejoresSinergias(h, 6, true);
  const listaVs = (arr, color) => el('div', { class: 'lista-heroes-mini' }, arr.map((x) => el('div', { class: 'vs' }, chipH(x.otro, null, true), barraWr(x.wr), el('span', { class: 'num pequeno', style: { color } }, fmtPct(x.wr)))));
  vsCont.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Le cuesta contra'), el('p', { class: 'muted pequeno' }, 'Winrate de ' + nombreH(h) + ' cuando el rival está en el equipo contrario (14 días, todos los rangos).'), listaVs(ct.pierde, 'var(--mal)'),
    g && g.counters && g.counters.length ? el('div', { style: { marginTop: '10px' } }, el('div', { class: 'etiqueta' }, 'Por qué, según las guías'), g.counters.map((c) => { const o = heroe(c.id || c.heroe); return el('div', { class: 'vs' }, o ? chipH(o, null, true) : el('span', null, c.heroe), el('span', { class: 'porque' }, c.por_que), el('span')); })) : null));
  vsCont.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Gana contra'), el('p', { class: 'muted pequeno' }, 'Rivales ante los que este héroe tiene mejor winrate.'), listaVs(ct.gana, 'var(--ok)')));
  vsCont.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Mejores compañeros'), el('p', { class: 'muted pequeno' }, 'Winrate del par cuando juegan juntos en el mismo equipo.'), listaVs(sin, 'var(--ok)'),
    g && g.sinergias && g.sinergias.length ? el('div', { style: { marginTop: '10px' } }, el('div', { class: 'etiqueta' }, 'Por qué, según las guías'), g.sinergias.map((c) => { const o = heroe(c.id || c.heroe); return el('div', { class: 'vs' }, o ? chipH(o, null, true) : el('span', null, c.heroe), el('span', { class: 'porque' }, c.por_que), el('span')); })) : null));
  if (sinLinea.length) vsCont.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Mejores parejas de línea'), el('p', { class: 'muted pequeno' }, 'Compañeros con los que mejor le va compartiendo línea.'), listaVs(sinLinea, 'var(--ok)')));
  raiz.append(bloque('vs', 'Counters y sinergias', 'datos de partidas + explicación', el('p', { class: 'muted pequeno', style: { marginTop: '-6px', marginBottom: '10px' } }, 'Un mismo héroe puede aparecer como mal rival y como buen compañero: son situaciones distintas (enfrente o en tu equipo).'), vsCont));

  // Estadísticas base
  const st = h.stats; const ar = h.arma;
  const statsCont = el('div', { class: 'grid-2' });
  statsCont.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Atributos base'), el('div', { class: 'stats-base' }, [['Vida', st.vida], ['Regeneración', st.regen + '/s'], ['Velocidad', st.velocidad + ' m/s'], ['Esprint', '+' + st.sprint + ' m/s'], ['Estamina', st.estamina], ['Melé ligero', st.melee_ligero], ['Melé pesado', st.melee_pesado], ['Dash en suelo', st.dash_suelo + ' m'], ['Dash en aire', st.dash_aire + ' m']].map(([k, v]) => el('div', { class: 'stat' }, el('span', null, k), el('b', null, v == null ? '—' : v)))),
    el('div', { class: 'etiqueta', style: { marginTop: '10px' } }, 'Por cada nivel de poder'), el('div', { class: 'stats-base' }, [['Vida', '+' + h.por_nivel.vida], ['Daño por bala', '+' + fmt(h.por_nivel.dano_bala != null ? h.por_nivel.dano_bala : (h.por_nivel.dano_bala_pct || 0) / 100, 3)], ['Melé', '+' + h.por_nivel.melee], ['Poder de espíritu', '+' + h.por_nivel.espiritu]].map(([k, v]) => el('div', { class: 'stat' }, el('span', null, k), el('b', null, v))))));
  statsCont.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Arma: ' + (ar.nombre || '')), el('div', { class: 'stats-base' }, [['Daño por bala', ar.dano_bala], ['Balas por disparo', ar.balas_por_disparo], ['Disparos/s', fmt(ar.disparos_por_segundo, 2)], ['Cargador', ar.cargador], ['Recarga', ar.recarga ? fmt(ar.recarga, 2) + ' s' : null], ['DPS', ar.dps], ['DPS con recarga', ar.dps_con_recarga], ['Caída de daño', ar.alcance_caida_inicio ? ar.alcance_caida_inicio + '–' + ar.alcance_caida_fin + ' m' : null], ['Mira', ar.zoom ? 'Sí' : 'No']].filter((x) => x[1] != null).map(([k, v]) => el('div', { class: 'stat' }, el('span', null, k), el('b', null, v))))));
  // Winrate por rango
  const porRango = el('div', { class: 'tarjeta' }, el('h3', null, 'Rendimiento por rango (' + PREF.ventana + ')'));
  const tb = el('table', { class: 'tabla' }, el('thead', null, el('tr', null, ['Rango', 'Tier', 'Winrate', 'Presencia', 'Partidas'].map((t, i) => el('th', { class: i >= 2 ? 'num' : '' }, t)))));
  const tbody = el('tbody');
  for (const b of D.stats.brackets) { const x = statsDe(h, PREF.ventana, b.clave); tbody.append(el('tr', null, el('td', null, b.nombre), el('td', null, insigniaTier(x && x.tier)), el('td', { class: 'num' }, x ? fmtPct(x.wr) : '—'), el('td', { class: 'num' }, x ? fmtPct(x.pick) : '—'), el('td', { class: 'num' }, x ? fmt(x.partidas) : '—'))); }
  tb.append(tbody); porRango.append(el('div', { class: 'tabla-env' }, tb)); statsCont.append(porRango);
  raiz.append(bloque('stats', 'Estadísticas', '', statsCont));

  // Fuentes y vídeos
  const fCont = el('div');
  if (g && g.videos && g.videos.length) fCont.append(el('div', { class: 'etiqueta', style: { marginBottom: '6px' } }, 'Vídeos recientes'), el('div', { class: 'videos' }, g.videos.map((v) => el('div', { class: 'video' }, el('a', { href: v.url, target: '_blank', rel: 'noopener' }, v.titulo || v.url), el('div', { class: 'meta' }, [v.canal, v.fecha].filter(Boolean).join(' · ')), v.resumen ? el('div', { class: 'sec pequeno' }, v.resumen) : null))));
  if (g && g.fuentes && g.fuentes.length) fCont.append(el('div', { class: 'etiqueta', style: { margin: '12px 0 6px' } }, 'Fuentes consultadas'), el('ul', { class: 'fuentes' }, g.fuentes.map((f) => el('li', null, el('a', { href: f.url, target: '_blank', rel: 'noopener' }, f.titulo || f.url), el('span', { class: 'muted' }, [f.tipo, f.fecha].filter(Boolean).map((x) => ' · ' + x).join(''))))));
  if (g && g.confianza) fCont.append(el('p', { class: 'sec pequeno', style: { marginTop: '12px' } }, el('b', null, 'Confianza de la guía: ' + g.confianza + '. '), g.confianza === 'media' ? 'Hay afirmaciones que no se pudieron confirmar con la API ni con la wiki, o el héroe lleva poco tiempo en el juego.' : 'Objetos, habilidades, counters y sinergias comprobados contra la API y deadlock.wiki.'));
  fCont.append(el('p', { class: 'muted pequeno', style: { marginTop: '12px' } }, 'Estadísticas: api.deadlock-api.com. Descripciones de habilidades: datos oficiales del cliente del juego en español.'));
  raiz.append(bloque('fuentes', 'Fuentes', '', fCont));
  return raiz;
};

/* ============================================================ OBJETOS */
RUTAS.objetos = function (param) {
  const raiz = el('div');
  const estado = { q: '', ranura: RANURAS[param] ? param : '', tier: '', activo: '', etiqueta: '', orden: 'tier' };
  raiz.append(cabecera(D.objetos.length + ' objetos del parche actual', 'Objetos', 'Pulsa un objeto para ver sus estadísticas, para qué sirve, cuándo comprarlo y quién lo compra más.'));
  const etiquetas = new Set(); for (const g of Object.values(D.objGuia || {})) for (const t of g.etiquetas || []) etiquetas.add(t);
  const q = el('input', { class: 'entrada', type: 'search', placeholder: 'Nombre (ES o EN)', oninput: (e) => { estado.q = e.target.value; pintar(); }, 'aria-label': 'Filtrar objetos' });
  const ctrl = el('div', { class: 'controles' },
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Buscar'), q),
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Categoría'), segmento([['', 'Todas'], ['weapon', 'Arma'], ['vitality', 'Vitalidad'], ['spirit', 'Espíritu']], estado.ranura, (v) => { estado.ranura = v; pintar(); }, (v) => RANURAS[v] ? RANURAS[v].clase : '')),
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Tier'), segmento([['', 'Todos'], ['1', 'T1 · 800'], ['2', 'T2 · 1.600'], ['3', 'T3 · 3.200'], ['4', 'T4 · 6.400'], ['5', 'Street Brawl']], '', (v) => { estado.tier = v; pintar(); })),
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Tipo'), segmento([['', 'Todos'], ['activo', 'Activos'], ['pasivo', 'Pasivos'], ['imbuir', 'Imbuir']], '', (v) => { estado.activo = v; pintar(); })),
    etiquetas.size ? el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Función'), el('select', { class: 'select', onchange: (e) => { estado.etiqueta = e.target.value; pintar(); } }, el('option', { value: '' }, 'Cualquiera'), [...etiquetas].sort().map((t) => el('option', { value: t }, t.replace(/_/g, ' '))))) : null,
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Orden'), segmento([['tier', 'Tier'], ['nombre', 'Nombre'], ['wr', 'Winrate'], ['pick', 'Más comprados']], 'tier', (v) => { estado.orden = v; pintar(); })),
    el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Nombres'), selectorNombres()));
  raiz.append(ctrl);
  const cuerpo = el('div'); raiz.append(cuerpo);
  function pintar() {
    cuerpo.innerHTML = '';
    let lista = D.objetos.filter((o) => {
      if (estado.q) { const qq = sinAcentos(estado.q); if (!sinAcentos(o.nombre).includes(qq) && !sinAcentos(o.nombre_es).includes(qq)) return false; }
      if (estado.ranura && o.ranura !== estado.ranura) return false;
      if (estado.tier && String(Math.min(o.tier, 5)) !== estado.tier) return false;
      if (estado.activo === 'activo' && !o.activo) return false;
      if (estado.activo === 'pasivo' && o.activo) return false;
      if (estado.activo === 'imbuir' && !o.imbuir) return false;
      if (estado.etiqueta) { const g = guiaObjeto(o); if (!g || !(g.etiquetas || []).includes(estado.etiqueta)) return false; }
      return true;
    });
    const st = (o) => (D.objStats && D.objStats.objetos[o.id]) || {};
    lista.sort((a, b) => {
      if (estado.orden === 'nombre') return nombreO(a).localeCompare(nombreO(b), 'es');
      if (estado.orden === 'wr') return (st(b).wr || 0) - (st(a).wr || 0);
      if (estado.orden === 'pick') return (st(b).partidas || 0) - (st(a).partidas || 0);
      return a.tier - b.tier || a.ranura.localeCompare(b.ranura) || nombreO(a).localeCompare(nombreO(b), 'es');
    });
    if (!lista.length) { cuerpo.append(el('div', { class: 'vacio' }, 'Ningún objeto coincide.')); return; }
    const tile = (o) => { const r = RANURAS[o.ranura] || {}; const s = st(o); const g = guiaObjeto(o); return el('button', { type: 'button', class: 'obj-tile ' + (r.clase || ''), onclick: () => abrirObjeto(o), title: g && g.resumen ? g.resumen : '' }, imgO(o), el('div', { style: { minWidth: 0 } }, el('div', { class: 'nombre' }, nombreO(o)), nombreOAlt(o) ? el('div', { class: 'nombre-es' }, nombreOAlt(o)) : null, el('div', { class: 'sub' }, (o.tier >= 5 ? 'Street Brawl' : fmt(o.coste)) + (o.activo ? ' · activo' : '') + (s.wr ? ' · ' + fmtPct(s.wr, 0) : '')))); };
    const grupos = estado.orden === 'tier' && !estado.tier ? [1, 2, 3, 4, 5].map((t) => [t, lista.filter((o) => Math.min(o.tier, 5) === t)]).filter((g) => g[1].length) : [[null, lista]];
    const tienda = estado.orden === 'tier' && !estado.tier && !estado.ranura; // como la tienda del juego: tres columnas por tier
    for (const [t, objs] of grupos) {
      if (t) cuerpo.append(el('h3', { style: { margin: '18px 0 8px' } }, t >= 5 ? 'Objetos de Street Brawl' : `Tier ${t} · ${fmtSouls(objs[0].coste)}`, t >= 5 ? el('span', { class: 'muted pequeno', style: { fontFamily: 'var(--f-body)', fontWeight: 400 } }, ' (solo en ese modo; no existen en partida normal ni clasificatoria)') : null));
      if (tienda) {
        const cols = el('div', { class: 'tienda' });
        for (const [k, r] of Object.entries(RANURAS)) { const sub = objs.filter((o) => o.ranura === k); cols.append(el('div', { class: 'tienda-col ' + r.clase }, el('div', { class: 'etiqueta', style: { color: 'var(--c)' } }, r.nombre + ' · ' + sub.length), el('div', { class: 'col', style: { gap: '6px' } }, sub.map(tile)))); }
        cuerpo.append(cols);
      } else cuerpo.append(el('div', { class: 'grid-objetos' }, objs.map(tile)));
    }
  }
  pintar();
  return raiz;
};
RUTAS.objeto = function (clase) { const v = RUTAS.objetos(''); const o = objeto(clase); if (o) setTimeout(() => abrirObjeto(o), 0); return v; };

/* ============================================================ EQUIPOS */
RUTAS.equipos = function () {
  const raiz = el('div');
  raiz.append(cabecera('Composiciones y armador', 'Equipos', 'Arma tu equipo y el rival para ver sinergias, counters, parejas de línea y qué le falta a la composición. Abajo, composiciones recomendadas por la comunidad.'));
  const estado = { nuestro: [], rival: [] };
  try { Object.assign(estado, JSON.parse(sessionStorage.getItem('td_equipos') || '{}')); } catch (e) { /* nada */ }
  const guardar = () => { try { sessionStorage.setItem('td_equipos', JSON.stringify(estado)); } catch (e) { /* nada */ } };
  const armador = el('div', { class: 'armador' }); raiz.append(armador);
  const analisis = el('div', { class: 'grid-2', style: { marginTop: '16px' } }); raiz.append(analisis);
  function elegirHeroe(lado) {
    const cont = el('div', { class: 'grid-heroes', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' } });
    const usados = new Set([...estado.nuestro, ...estado.rival]);
    for (const h of D.heroes.slice().sort((a, b) => nombreH(a).localeCompare(nombreH(b), 'es'))) {
      if (usados.has(h.id)) continue;
      cont.append(el('button', { type: 'button', class: 'tarjeta-heroe', style: { border: 0, padding: 0, cursor: 'pointer' }, onclick: () => { estado[lado].push(h.id); guardar(); cerrarModal(); pintar(); } }, el('img', { src: h.imagen.carta, alt: '', loading: 'lazy' }), el('div', { class: 'velo' }, el('div', { class: 'nombre', style: { fontSize: '1rem' } }, nombreH(h)))));
    }
    abrirModal(lado === 'nuestro' ? 'Añadir a tu equipo' : 'Añadir al equipo rival', cont);
  }
  function equipoCaja(lado, titulo) {
    const caja = el('div', { class: 'equipo ' + (lado === 'nuestro' ? 'nuestro' : 'rival') });
    caja.append(el('div', { class: 'fila entre' }, el('h3', null, titulo), el('button', { class: 'boton mini', type: 'button', onclick: () => { estado[lado] = []; guardar(); pintar(); } }, 'Vaciar')));
    const slots = el('div', { class: 'slots' });
    for (let i = 0; i < 6; i++) {
      const id = estado[lado][i]; const h = id && heroe(id);
      if (h) slots.append(el('div', { class: 'slot', title: nombreH(h) }, el('img', { src: h.imagen.icono, alt: nombreH(h) }), el('button', { class: 'quitar', type: 'button', 'aria-label': 'Quitar ' + nombreH(h), onclick: () => { estado[lado] = estado[lado].filter((x) => x !== id); guardar(); pintar(); } }, '✕')));
      else slots.append(el('button', { class: 'slot', type: 'button', 'aria-label': 'Añadir héroe', onclick: () => elegirHeroe(lado) }, el('span', { class: 'mas' }, '+')));
    }
    caja.append(slots);
    caja.append(el('div', { class: 'fila' }, estado[lado].map((id) => { const h = heroe(id); return h ? chipH(h, null, true) : null; })));
    return caja;
  }
  function pintar() {
    armador.innerHTML = ''; analisis.innerHTML = '';
    armador.append(equipoCaja('nuestro', 'Tu equipo'), equipoCaja('rival', 'Equipo rival'));
    const nuestros = estado.nuestro.map(heroe).filter(Boolean); const rivales = estado.rival.map(heroe).filter(Boolean);
    // Sinergias internas
    const pares = [];
    for (let i = 0; i < nuestros.length; i++) for (let j = i + 1; j < nuestros.length; j++) { const p = sinergiaPar(nuestros[i].id, nuestros[j].id); if (p) pares.push({ a: nuestros[i], b: nuestros[j], wr: p.wr, n: p.n }); }
    pares.sort((x, y) => y.wr - x.wr);
    const mediaSin = pares.length ? pares.reduce((s2, p) => s2 + p.wr, 0) / pares.length : null;
    const cajaSin = el('div', { class: 'tarjeta' }, el('h3', null, 'Sinergias de tu equipo'), el('p', { class: 'muted pequeno' }, 'Winrate de cada pareja cuando juega junta (14 días). La media de un equipo normal ronda el 50 %.'));
    if (mediaSin != null) cajaSin.append(el('div', { class: 'fila', style: { marginBottom: '8px' } }, el('span', { class: 'chip ' + (mediaSin >= 51 ? 'ok' : mediaSin < 49 ? 'mal' : '') }, 'Media de parejas: ' + fmtPct(mediaSin))));
    cajaSin.append(pares.length ? el('div', { class: 'lista-sinergia' }, pares.map((p) => el('div', { class: 'fila-s' }, el('span', { class: 'fila', style: { gap: '4px' } }, chipH(p.a, null, true), '+', chipH(p.b, null, true)), el('span', { class: 'num', style: { color: p.wr >= 50 ? 'var(--ok)' : 'var(--mal)' } }, fmtPct(p.wr))))) : el('div', { class: 'muted pequeno' }, 'Añade al menos dos héroes.'));
    analisis.append(cajaSin);
    // Counters contra el rival
    const cajaVs = el('div', { class: 'tarjeta' }, el('h3', null, 'Tu equipo contra el rival'), el('p', { class: 'muted pequeno' }, 'Winrate de cada héroe tuyo contra cada rival. Verde: ventaja; rojo: desventaja.'));
    if (nuestros.length && rivales.length) {
      const tb = el('table', { class: 'tabla' }); const thead = el('tr', null, el('th', null, ''), rivales.map((r) => el('th', null, el('img', { src: r.imagen.icono, alt: nombreH(r), title: nombreH(r), class: 'icono-heroe', style: { width: '28px', height: '28px' } }))), el('th', { class: 'num' }, 'Media'));
      tb.append(el('thead', null, thead)); const tbody = el('tbody');
      for (const n of nuestros) { let suma = 0, k = 0; const celdas = rivales.map((r) => { const c = counterPar(n.id, r.id); if (c) { suma += c.wr; k++; } return el('td', { class: 'num', style: { color: c ? (c.wr >= 51 ? 'var(--ok)' : c.wr <= 49 ? 'var(--mal)' : 'inherit') : 'var(--fg-3)' } }, c ? fmtPct(c.wr, 0) : '—'); }); tbody.append(el('tr', null, el('td', null, chipH(n, null, true)), celdas, el('td', { class: 'num', style: { fontWeight: 600 } }, k ? fmtPct(suma / k, 0) : '—'))); }
      tb.append(tbody); cajaVs.append(el('div', { class: 'tabla-env' }, tb));
    } else cajaVs.append(el('div', { class: 'muted pequeno' }, 'Añade héroes en los dos equipos.'));
    analisis.append(cajaVs);
    // Chequeo de la composición
    const cajaChk = el('div', { class: 'tarjeta' }, el('h3', null, 'Qué tiene y qué le falta'));
    if (nuestros.length) {
      const arqs = nuestros.map(arquetipoDe); const roles = nuestros.map((h) => sinAcentos(((guia(h) || {}).rol || '') + ' ' + (h.rol || '') + ' ' + (h.etiquetas || []).join(' ')));
      const tiene = (re) => roles.some((r) => re.test(r));
      const nArma = arqs.filter((a) => a === 'arma').length, nEsp = arqs.filter((a) => a === 'espiritu').length;
      const chk = el('div', { class: 'chequeo' });
      const linea = (ok, txt) => chk.append(el('div', null, el('span', { class: ok ? 'ok' : 'falta' }, ok ? '✔' : '△'), el('span', null, txt)));
      linea(nArma >= 1 && nEsp >= 1, `Daño mixto: ${nArma} de arma, ${nEsp} de espíritu, ${arqs.length - nArma - nEsp} vitalidad/híbrido`);
      linea(tiene(/iniciad|tanque|frontal|bruiser|luchador|iniciar|engage/), 'Un iniciador o tanque que abra las peleas');
      linea(tiene(/cura|sana|soporte|sosten|heal/), 'Curación o sostén para el equipo');
      linea(tiene(/control|aturd|stun|silenc|ralent|inmovil|cc/), 'Control de masas (aturdimientos, silencios, ralentizaciones)');
      linea(tiene(/tirador|carry|dps|daño sostenido|arma a distancia/), 'Un carry de daño sostenido para el final');
      linea(nuestros.length === 6, nuestros.length === 6 ? 'Equipo completo' : `Faltan ${6 - nuestros.length} héroes`);
      cajaChk.append(chk);
      // Sugerencias: héroes con mejor sinergia media con el equipo actual
      if (nuestros.length < 6 && D.sinergias) {
        const usados = new Set([...estado.nuestro, ...estado.rival]);
        const cand = D.heroes.filter((h) => !usados.has(h.id)).map((h) => { let s2 = 0, k = 0; for (const n of nuestros) { const p = sinergiaPar(h.id, n.id); if (p && p.n >= 100) { s2 += p.wr; k++; } } for (const r of rivales) { const c = counterPar(h.id, r.id); if (c && c.n >= 100) { s2 += c.wr; k++; } } return { h, media: k ? s2 / k : null, k }; }).filter((x) => x.media != null && x.k >= Math.max(1, Math.floor((nuestros.length + rivales.length) / 2))).sort((a, b) => b.media - a.media).slice(0, 8);
        if (cand.length) cajaChk.append(el('div', { class: 'etiqueta', style: { margin: '12px 0 6px' } }, 'Quién encaja mejor ahora'), el('div', { class: 'fila' }, cand.map((c) => el('button', { type: 'button', class: 'heroe-chip mini', onclick: () => { estado.nuestro.push(c.h.id); guardar(); pintar(); } }, imgH(c.h, ''), el('span', null, nombreH(c.h)), el('span', { class: 'num' }, fmtPct(c.media, 0))))));
      }
    } else cajaChk.append(el('div', { class: 'muted pequeno' }, 'Añade héroes a tu equipo.'));
    analisis.append(cajaChk);
    // Parejas de línea sugeridas (solo si hay datos específicos de línea)
    if (D.sinergias && D.sinergias.parejas_linea && D.sinergias.parejas_linea.length) {
      const cajaLinea = el('div', { class: 'tarjeta' }, el('h3', null, 'Parejas de línea de tu equipo'), el('p', { class: 'muted pequeno' }, 'Winrate de cada pareja cuando comparte línea. Úsalo para repartir las tres líneas.'));
      const paresLinea = [];
      for (let i = 0; i < nuestros.length; i++) for (let j = i + 1; j < nuestros.length; j++) { const p = sinergiaPar(nuestros[i].id, nuestros[j].id, true); if (p) paresLinea.push({ a: nuestros[i], b: nuestros[j], wr: p.wr, n: p.n }); }
      paresLinea.sort((x, y) => y.wr - x.wr);
      cajaLinea.append(paresLinea.length ? el('div', { class: 'lista-sinergia' }, paresLinea.slice(0, 8).map((p) => el('div', { class: 'fila-s' }, el('span', { class: 'fila', style: { gap: '4px' } }, chipH(p.a, null, true), '+', chipH(p.b, null, true)), el('span', { class: 'num', style: { color: p.wr >= 50 ? 'var(--ok)' : 'var(--mal)' } }, fmtPct(p.wr))))) : el('div', { class: 'muted pequeno' }, 'Añade al menos dos héroes.'));
      analisis.append(cajaLinea);
    }
  }
  pintar();

  // Composiciones recomendadas
  const comps = D.comps;
  const secComp = el('section', { class: 'seccion', style: { marginTop: '32px' } });
  secComp.append(el('div', { class: 'seccion-cab' }, el('div', null, el('div', { class: 'pretitulo' }, 'Investigación'), el('h2', null, 'Composiciones recomendadas'), el('p', null, comps && comps.mapa_y_lineas ? comps.mapa_y_lineas : 'Equipos de seis héroes con un plan claro, para que sepas qué hace cada uno y cómo se reparten las líneas.'))));
  if (comps && comps.composiciones && comps.composiciones.length) {
    const grid = el('div', { class: 'grid-3' });
    for (const c of comps.composiciones) {
      const hs = (c.heroes_ids || c.heroes || []).map(heroe).filter(Boolean);
      const corto = (t, n = 230) => (t && t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t);
      const largo = (c.plan || '').length + (c.por_que || '').length > 420;
      grid.append(el('div', { class: 'comp-tarjeta' }, el('div', { class: 'fila entre' }, el('h3', null, c.nombre), c.nivel ? el('span', { class: 'chip laton' }, c.nivel) : null), el('div', { class: 'heroes' }, hs.map((h) => el('a', { href: '#heroe-' + h.clase, title: nombreH(h) }, el('img', { src: h.imagen.icono, alt: nombreH(h) })))), el('div', { class: 'fila' }, hs.map((h) => chipH(h, null, true))), c.lineas ? el('p', null, el('b', null, 'Líneas: '), c.lineas) : null,
        c.plan ? el('p', null, el('b', null, 'Plan: '), largo ? corto(c.plan) : c.plan) : null,
        largo ? el('details', { class: 'plegable' }, el('summary', null, 'Ver plan completo y por qué funciona'), el('div', { class: 'contenido' }, c.plan ? el('p', { class: 'sec pequeno' }, el('b', null, 'Plan: '), c.plan) : null, c.por_que ? el('p', { class: 'sec pequeno' }, el('b', null, 'Por qué funciona: '), c.por_que) : null)) : (c.por_que ? el('p', null, el('b', null, 'Por qué funciona: '), c.por_que) : null),
        el('div', { class: 'fila', style: { marginTop: '4px' } }, el('button', { type: 'button', class: 'boton mini', onclick: () => { estado.nuestro = hs.map((h) => h.id).slice(0, 6); estado.rival = estado.rival.filter((id) => !estado.nuestro.includes(id)); guardar(); pintar(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, 'Cargar en el armador'))));
    }
    secComp.append(grid);
    if (comps.arquetipos && comps.arquetipos.length) { const det = el('details', { class: 'plegable', style: { marginTop: '16px' } }, el('summary', null, 'Arquetipos de composición')); const c2 = el('div', { class: 'contenido grid-2' }); for (const a of comps.arquetipos) c2.append(el('div', null, el('h4', null, a.nombre), el('p', { class: 'sec pequeno' }, a.descripcion), el('div', { class: 'fila' }, (a.heroes_ids || a.heroes || []).map(heroe).filter(Boolean).map((h) => chipH(h, null, true))))); det.append(c2); secComp.append(det); }
    if (comps.reglas && comps.reglas.length) { const det = el('details', { class: 'plegable', style: { marginTop: '10px' } }, el('summary', null, 'Reglas para armar una composición'), el('div', { class: 'contenido' }, el('ul', { class: 'sec' }, comps.reglas.map((r) => el('li', null, r))))); secComp.append(det); }
  } else secComp.append(el('div', { class: 'vacio' }, 'Las composiciones recomendadas se cargarán en la próxima actualización.'));
  raiz.append(secComp);

  // Mejores parejas según datos y según la comunidad
  if (D.sinergias) {
    const sec = el('section', { class: 'seccion' });
    const hayLinea = D.sinergias.parejas_linea && D.sinergias.parejas_linea.length;
    const fuente = hayLinea ? D.sinergias.parejas_linea : D.sinergias.parejas;
    sec.append(el('div', { class: 'seccion-cab' }, el('div', null, el('div', { class: 'pretitulo' }, 'Datos de 14 días'), el('h2', null, hayLinea ? 'Mejores parejas de línea' : 'Mejores parejas de equipo'), el('p', null, hayLinea ? 'Parejas con mayor winrate cuando comparten línea (mínimo 300 partidas juntas).' : 'Parejas con mayor winrate cuando juegan en el mismo equipo (mínimo 300 partidas juntas).'))));
    const top = fuente.filter((p) => p.n >= 300).sort((a, b) => b.wr - a.wr).slice(0, 15);
    sec.append(el('div', { class: 'lista-sinergia', style: { maxWidth: '640px' } }, top.map((p) => { const a = heroe(p.a), b = heroe(p.b); return a && b ? el('div', { class: 'fila-s' }, el('span', { class: 'fila', style: { gap: '4px' } }, chipH(a, null, true), '+', chipH(b, null, true), el('span', { class: 'muted pequeno' }, fmt(p.n) + ' partidas')), el('span', { class: 'num', style: { color: 'var(--ok)' } }, fmtPct(p.wr))) : null; })));
    if (comps && comps.duo_lanes && comps.duo_lanes.length) { sec.append(el('h3', { style: { margin: '18px 0 8px' } }, 'Parejas de línea que recomienda la comunidad')); sec.append(el('div', { class: 'grid-2' }, comps.duo_lanes.map((d) => { const hs = (d.heroes_ids || d.heroes || []).map(heroe).filter(Boolean); return el('div', { class: 'tarjeta' }, el('div', { class: 'fila' }, hs.map((h) => chipH(h, null, true))), el('p', { class: 'sec pequeno', style: { margin: '6px 0 0' } }, d.por_que)); }))); }
    if (comps && comps.solo_lane && comps.solo_lane.length) { sec.append(el('h3', { style: { margin: '18px 0 8px' } }, 'Héroes que ganan su línea por sí mismos'), el('p', { class: 'muted pequeno' }, 'Las tres líneas se juegan 2 contra 2; estos héroes aguantan y ganan la línea aunque su pareja rote o farmee.')); sec.append(el('div', { class: 'grid-2' }, comps.solo_lane.map((d) => { const h = heroe(d.id || d.heroe); return el('div', { class: 'tarjeta' }, h ? chipH(h, null, true) : el('b', null, d.heroe), el('p', { class: 'sec pequeno', style: { margin: '6px 0 0' } }, d.por_que)); }))); }
    raiz.append(sec);
  }
  return raiz;
};

/* ============================================================ GUÍA */
RUTAS.guia = function (param) {
  const raiz = el('div');
  const pestana = param === 'objetos' ? 'objetos' : param === 'mapa' ? 'mapa' : 'sistemas';
  raiz.append(cabecera('Cómo funciona el juego', 'Guía', 'Tres pestañas: cómo funcionan las almas, los niveles, las categorías de objetos y el escalado; qué objetos comprar según tu arquetipo y contra qué; y el mapa: mejoras de puente, jungla, cajas y rutas.'));
  const pest = (id, ruta, texto) => el('button', { type: 'button', class: pestana === id ? 'activo' : '', 'aria-current': pestana === id ? 'page' : null, onclick: () => ir(ruta) }, texto);
  raiz.append(el('div', { class: 'tabs', role: 'navigation', 'aria-label': 'Pestañas de la guía' }, pest('sistemas', 'guia', 'Sistemas del juego'), pest('objetos', 'guia-objetos', 'Itemización: qué comprar y por qué'), pest('mapa', 'guia-mapa', 'Mapa y jungla')));
  if (pestana === 'mapa') { raiz.append(vistaGuiaMapa()); return raiz; }
  const fuente = pestana === 'objetos' ? D.itemizacion : D.sistemas;
  if (!fuente || !fuente.secciones) { raiz.append(el('div', { class: 'vacio' }, 'Esta guía se cargará en la próxima actualización.')); return raiz; }
  const cont = el('div', { class: 'guia' });
  cont.append(el('nav', { class: 'indice', 'aria-label': 'Índice' }, fuente.secciones.map((s) => el('a', { href: '#' + rutaActual, onclick: (e) => { e.preventDefault(); const d = document.getElementById('g-' + s.id); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, s.titulo))));
  const prosa = el('div', { class: 'prosa' });
  for (const s of fuente.secciones) prosa.append(el('h2', { id: 'g-' + s.id }, s.titulo), el('div', { html: s.html }));
  if (fuente.glosario && fuente.glosario.length) { prosa.append(el('h2', { id: 'g-glosario' }, 'Glosario')); const dl = el('dl', { class: 'glosario' }); for (const g of fuente.glosario) dl.append(el('dt', null, g.termino), el('dd', null, g.definicion)); prosa.append(dl); }
  // Nombres de objetos y héroes en negrita abren su ficha
  prosa.addEventListener('click', (e) => {
    const b = e.target.closest('strong, b'); if (!b) return;
    const txt = b.textContent.replace(/\s*\(.*$/, '').trim();
    const o = objeto(txt); if (o) { abrirObjeto(o); return; }
    const h = heroe(txt); if (h) ir('heroe-' + h.clase);
  });
  for (const b of $$('strong', prosa)) { const txt = b.textContent.replace(/\s*\(.*$/, '').trim(); if (objeto(txt) || heroe(txt)) { b.style.cursor = 'pointer'; b.style.textDecoration = 'underline dotted'; b.title = 'Ver ficha'; } }
  cont.append(prosa); raiz.append(cont);
  // Niveles de poder (tabla desde datos)
  const h0 = D.heroes[0];
  if (pestana === 'sistemas' && h0 && h0.niveles) { const det = el('details', { class: 'plegable', style: { marginTop: '20px' } }, el('summary', null, 'Tabla de niveles de poder: almas ganadas (sin las 600 iniciales) y qué dan')); const tb = el('table', { class: 'tabla' }, el('thead', null, el('tr', null, ['Nivel', 'Almas ganadas', 'En el marcador', 'Da'].map((t) => el('th', null, t))))); const tbody = el('tbody'); for (const n of h0.niveles) tbody.append(el('tr', null, el('td', { class: 'num' }, n.nivel), el('td', { class: 'num' }, fmt(n.souls)), el('td', { class: 'num' }, fmt(n.souls + 600)), el('td', null, n.da === 'ap' ? 'Punto de habilidad' : n.da === 'desbloqueo' ? 'Desbloqueo de habilidad' : 'Mejora de atributos'))); tb.append(tbody); det.append(el('div', { class: 'contenido tabla-env' }, tb)); raiz.append(det); }
  return raiz;
};

/** Un texto largo con varias fechas ("16-09-2026: …") → una entrada por fecha */
function partirCambios(texto) {
  const partes = String(texto || '').split(/\s+(?=\d{2}-\d{2}(?:-\d{4})?:\s)/).map((s) => s.trim()).filter(Boolean);
  return partes.length > 1 ? partes : [String(texto || '')];
}

/* ============================================================ NOVEDADES */
RUTAS.novedades = function () {
  const raiz = el('div');
  raiz.append(cabecera('Parches y actualizaciones', 'Novedades', 'Qué ha cambiado en el juego y cuándo se actualizaron los datos de esta web.'));
  const v = D.version || {};
  const grid = el('div', { class: 'grid-2' });
  grid.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Estado de los datos'), el('div', { class: 'stats-base' }, [['Datos descargados', fmtFecha(v.generado)], ['Versión del cliente', v.cliente || '—'], ['Héroes', v.heroes || D.heroes.length], ['Objetos', v.objetos || D.objetos.length], ['Guías de héroe', Object.keys(D.guias || {}).length + ' de ' + D.heroes.length], ['Fichas de objetos', Object.keys(D.objGuia || {}).length + ' de ' + D.objetos.length]].map(([k, val]) => el('div', { class: 'stat' }, el('span', null, k), el('b', null, val)))),
    el('p', { class: 'muted pequeno', style: { marginTop: '10px' } }, 'Las estadísticas (winrates, objetos populares, sinergias, builds) salen de partidas reales a través de api.deadlock-api.com y se regeneran con el script de actualización. Las guías escritas se revisan tras cada parche importante.')));
  if (D.meta && D.meta.cambios_recientes) grid.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Lo que se comenta en la comunidad'), el('ul', { class: 'sec', style: { paddingLeft: '1.1em', margin: 0 } }, partirCambios(D.meta.cambios_recientes).map((t) => el('li', { style: { marginBottom: '6px' } }, t))), D.meta.fecha ? el('p', { class: 'muted pequeno', style: { marginTop: '8px' } }, 'Recogido el ' + fmtFecha(D.meta.fecha) + ' de tier lists, Reddit y vídeos recientes.') : null));
  raiz.append(grid);
  const p = D.parche;
  const sec = el('section', { class: 'seccion', style: { marginTop: '24px' } }, el('h2', { style: { marginBottom: '12px' } }, 'Últimos parches'));
  if (p && p.parches && p.parches.length) {
    for (const x of p.parches) sec.append(el('div', { class: 'parche' }, el('div', { class: 'fecha' }, fmtFecha(x.fecha)), el('b', null, x.titulo || 'Actualización'), x.resumen && x.resumen.length ? el('ul', null, (Array.isArray(x.resumen) ? x.resumen : [x.resumen]).map((r) => el('li', null, r))) : null, x.url ? el('div', null, el('a', { href: x.url, target: '_blank', rel: 'noopener', class: 'pequeno' }, 'Notas completas')) : null));
    if (p.cadencia) sec.append(el('p', { class: 'sec pequeno' }, p.cadencia));
  } else sec.append(el('div', { class: 'vacio' }, 'El resumen de parches se cargará en la próxima actualización.'));
  raiz.append(sec);
  const fuentes = (p && p.fuentes) || [];
  const sec2 = el('section', { class: 'seccion' }, el('h2', { style: { marginBottom: '12px' } }, 'Dónde seguir las novedades'));
  const lista = el('ul', { class: 'fuentes' }, [
    ['Notas de parche oficiales (foro de Valve)', 'https://forums.playdeadlock.com/forums/changelog.10/'],
    ['Noticias en Steam', 'https://store.steampowered.com/news/app/1422450'],
    ['Wiki de la comunidad (en inglés)', 'https://deadlock.wiki'],
    ['API de datos usada por esta web', 'https://api.deadlock-api.com/docs'],
    ...fuentes.map((f) => [f.nombre + (f.que ? ' · ' + f.que : ''), f.url]),
  ].map(([t, u]) => el('li', null, el('a', { href: u, target: '_blank', rel: 'noopener' }, t))));
  sec2.append(lista); raiz.append(sec2);
  return raiz;
};
