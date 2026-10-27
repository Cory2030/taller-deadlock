'use strict';
/* ============================================================
   Mi perfil: tus partidas, tu nivel y recomendaciones para tu caso
   (tier list de tu nivel, héroes para ti, builds ajustadas y composiciones).
   Datos: data/perfil.json (foto hecha con scripts/perfil.js, con el análisis de los agentes)
   y, fuera de claude.ai, la API pública en vivo para cualquier cuenta.
   Las medias «de tu nivel» salen de data/stats.json (30 días por rango), igual que la tier list.
   ============================================================ */

const NIVELES_PERFIL = [
  { clave: 'principiante', nombre: 'Initiate–Acolyte', largo: 'Principiante (Initiate a Acolyte)', min: 1, max: 36 },
  { clave: 'medio', nombre: 'Sentinel–Emissary', largo: 'Medio (Sentinel a Emissary)', min: 41, max: 76 },
  { clave: 'oracle', nombre: 'Oracle+', largo: 'Oracle o superior', min: 81 },
  { clave: 'phantom', nombre: 'Phantom+', largo: 'Phantom o superior', min: 91 },
  { clave: 'ascendant', nombre: 'Ascendant+', largo: 'Ascendant y Eternus', min: 101 },
];
const RANGOS_NOMBRE = ['Obscurus', 'Initiate', 'Seeker', 'Acolyte', 'Sentinel', 'Mystic', 'Ritualist', 'Emissary', 'Oracle', 'Phantom', 'Ascendant', 'Eternus'];
const nombreBadge = (b) => (b ? `${RANGOS_NOMBRE[Math.floor(b / 10)] || '?'} ${['', 'I', 'II', 'III', 'IV', 'V', 'VI'][b % 10] || ''}`.trim() : 'Sin rango');
const nivelPorBadge = (b) => NIVELES_PERFIL.slice().reverse().find((n) => b && b >= n.min) || NIVELES_PERFIL[0];
const nivelPorClave = (c) => NIVELES_PERFIL.find((n) => n.clave === c) || NIVELES_PERFIL[0];
const MAX_PARTIDAS_PERFIL = 50;
// Cifras con decimales fijos (7,0 y no 7) para que una columna se lea igual de arriba abajo
const FMT_FIJO = new Map();
function fmtD(n, dec) {
  if (n == null || Number.isNaN(n)) return '—';
  let f = FMT_FIJO.get(dec);
  if (!f) FMT_FIJO.set(dec, (f = new Intl.NumberFormat('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec })));
  return f.format(n);
}

/** SteamID3, SteamID64 o un enlace que los contenga (Steam, lockbuilds…) → SteamID3 */
function cuentaDeTexto(t) {
  const nums = String(t || '').match(/\d{6,20}/g) || [];
  try {
    const base = BigInt('76561197960265728');
    for (const n of nums) { const b = BigInt(n); if (b > base) return Number(b - base); if (b > 0n && b < 4294967296n) return Number(b); }
  } catch (e) { /* navegador sin BigInt */ }
  return null;
}

/** Nivel elegido para una cuenta (se guarda por cuenta; sin elección, el de su rango o el del análisis) */
function nivelElegidoDe(cuenta) { const m = PREF.nivelPerfil; return m && typeof m === 'object' ? m[cuenta] || null : null; }
function guardarNivelDe(cuenta, clave, porDefecto) {
  const m = PREF.nivelPerfil && typeof PREF.nivelPerfil === 'object' ? PREF.nivelPerfil : {};
  if (clave === porDefecto) delete m[cuenta]; else m[cuenta] = clave;
  PREF.nivelPerfil = m; guardarPref();
}

/* ---------- Datos en vivo (cualquier cuenta; fuera de claude.ai) ---------- */
const CACHE_PERFIL = new Map();
function perfilEnVivo(cuenta) {
  const c = CACHE_PERFIL.get(cuenta);
  if (c && Date.now() - c.hora < 5 * 60 * 1000) return c.promesa;
  const promesa = pedirPerfil(cuenta);
  CACHE_PERFIL.set(cuenta, { hora: Date.now(), promesa });
  promesa.catch(() => CACHE_PERFIL.delete(cuenta));
  return promesa;
}
async function pedirPerfil(cuenta) {
  const API = 'https://api.deadlock-api.com';
  const j = async (u) => { const r = await fetch(API + u); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
  const [steam, rango, historial] = await Promise.all([
    j(`/v1/players/steam?account_ids=${cuenta}`).catch(() => []), j(`/v1/players/${cuenta}/rank`).catch(() => null), j(`/v1/players/${cuenta}/match-history`),
  ]);
  // Solo las últimas partidas normales: con miles de partidas el resumen mezclaría años de juego
  const normales = (historial || []).filter((x) => x.game_mode === 1).sort((a, b) => b.start_time - a.start_time).slice(0, MAX_PARTIDAS_PERFIL);
  const desde = normales.length ? normales[normales.length - 1].start_time : null;
  const heroStats = normales.length ? await j(`/v1/players/hero-stats?account_ids=${cuenta}${desde ? '&min_unix_timestamp=' + desde : ''}`).catch(() => []) : [];
  const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null); const r1 = (x) => Math.round(x * 10) / 10;
  const partidas = normales.map((x) => ({ match_id: x.match_id, fecha: new Date(x.start_time * 1000).toLocaleDateString('sv-SE'), hero_id: x.hero_id, victoria: x.match_result === x.player_team, k: x.player_kills, d: x.player_deaths, a: x.player_assists, almas: x.net_worth, min: Math.round(x.match_duration_s / 60) }));
  const vict = partidas.filter((p) => p.victoria).length;
  // La precisión 0 es una partida sin disparos registrados (p. ej. Graves): no cuenta
  const conPrec = (heroStats || []).filter((s) => s.accuracy > 0 && s.time_played);
  const tPrec = conPrec.reduce((a, s) => a + s.time_played, 0);
  const t = partidas.reduce((a, p) => ({ k: a.k + p.k, d: a.d + p.d, a: a.a + p.a, almas: a.almas + p.almas, min: a.min + p.min }), { k: 0, d: 0, a: 0, almas: 0, min: 0 });
  const badge = rango && rango.badge ? rango.badge : null;
  return {
    vivo: true, generado: new Date().toISOString(), cuenta, nombre: (steam[0] || {}).personaname || String(cuenta), avatar: (steam[0] || {}).avatarmedium || '', perfil_steam: (steam[0] || {}).profileurl || '',
    limitadas: (historial || []).filter((x) => x.game_mode === 1).length > MAX_PARTIDAS_PERFIL,
    resumen: { partidas: partidas.length, victorias: vict, wr: pct(vict, partidas.length), kda: t.d ? r1((t.k + t.a) / t.d) : null, kills: r1(t.k / (partidas.length || 1)), muertes: r1(t.d / (partidas.length || 1)), asistencias: r1(t.a / (partidas.length || 1)), almas_min: t.min ? Math.round(t.almas / t.min) : null, precision: tPrec ? Math.round((1000 * conPrec.reduce((a, s) => a + s.accuracy * s.time_played, 0)) / tPrec) / 10 : null, desde: partidas.length ? partidas[partidas.length - 1].fecha : null, hasta: partidas.length ? partidas[0].fecha : null },
    nivel: { badge, rango: nombreBadge(badge), propio: !!badge, clave: badge ? nivelPorBadge(badge).clave : 'principiante', nombre: (badge ? nivelPorBadge(badge) : NIVELES_PERFIL[0]).largo },
    por_heroe: (heroStats || []).filter((s) => s.matches_played).map((s) => ({
      hero_id: s.hero_id, partidas: s.matches_played, victorias: s.wins, wr: pct(s.wins, s.matches_played),
      kills: r1(s.kills / s.matches_played), muertes: r1(s.deaths / s.matches_played), asistencias: r1(s.assists / s.matches_played), kda: s.deaths ? r1((s.kills + s.assists) / s.deaths) : null,
      almas_min: s.networth_per_min ? Math.round(s.networth_per_min) : null, dano_min: s.damage_per_min ? Math.round(s.damage_per_min) : null, minutos: Math.round(s.time_played / 60 / s.matches_played),
      precision: s.accuracy > 0 ? Math.round(s.accuracy * 1000) / 10 : null,
    })).sort((a, b) => b.partidas - a.partidas),
    partidas, rivales: [], companeros: [], te_matan: [], compras: [],
  };
}

/** Medias de un nivel por héroe (30 días), de la misma tabla que la tier list */
function mediasNivel(clave) {
  const d = D.stats && D.stats.datos && D.stats.datos['30d'] && D.stats.datos['30d'][clave];
  if (!d) return null;
  return Object.fromEntries(d.heroes.map((h) => [h.id, { wr: h.wr, partidas: h.partidas, muertes: h.muertes, precision: h.precision }]));
}

/* ---------- Ajustes de build del análisis → build del creador ---------- */
function analisisBuild(h) { const inv = D.perfil && D.perfil.investigacion; return (inv && inv.builds && inv.builds.heroes && (inv.builds.heroes[h.id] || inv.builds.heroes[String(h.id)])) || null; }
function ajustesPerfil(h) { const b = analisisBuild(h); return (b && b.ajustes) || []; }
// Un consejo con condición («si hay Billy», «solo si…») va a los situacionales: no se impone en todas las partidas.
// No cuentan las condiciones de una alternativa («…, o al 25 si…») ni las del orden («antes de X si…»).
const CONDICION_AJUSTE = /\b(si hay|si en tu l[ií]nea|si el rival|si tienes|si te |si mueres|si ves|si el equipo|si compraste|si llevas|solo si|cuando el rival)/i;
function esCondicional(a) {
  const t = String(a.cuando || '').replace(/,?\s+o\s+[^,.;]*?\bsi\b[^.;]*/gi, '').replace(/antes de [^,.;]*?\bsi\b[^.;]*/gi, '');
  return CONDICION_AJUSTE.test(t);
}
function notaAjuste(a) {
  const t = String(a.nota_juego || a.cuando || a.por_que || '').replace(/\s+/g, ' ').trim();
  if (t.length <= 120) return t;
  const corte = t.slice(0, 120);
  const p = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('; '));
  if (p > 60) return corte.slice(0, p + 1).replace(/;$/, '.');
  return corte.slice(0, corte.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…';
}
// Variante de build recomendada para el jugador, si no es la base (ya está pensada para su perfil)
function varianteParaTi(h) {
  const v = typeof variantesDe === 'function' ? variantesDe(h) : null;
  const k = v && v.veredicto && v.veredicto.recomendada_para_ti;
  const x = k && v.variantes.find((y) => y.clave === k);
  return x && !x.es_base ? x : null;
}
function hayBuildParaTi(h) { return !!(varianteParaTi(h) || ajustesPerfil(h).length); }
function buildConAjustes(h, ajustes) {
  // La variante «para ti» ya trae los ajustes de tu perfil: se usa tal cual. Los ajustes sueltos del
  // análisis se escribieron sobre la build base, así que solo se aplican cuando la recomendada es la base.
  const vt = varianteParaTi(h);
  if (vt) { const bv = buildDesdeGuia(h, vt.clave); bv.nombre = `Taller · ${nombreH(h)} para ti (${vt.nombre})`; const bh0 = analisisBuild(h); if (bh0 && bh0.nota_juego && !bv.notas) bv.notas = bh0.nota_juego; return bv; }
  const b = buildDesdeGuia(h, ajustes && ajustes.length ? 'base' : undefined);
  if (!(ajustes || []).length) return b;
  const catDe = (fase, opcional) => b.categorias.find((c) => c.fase === fase && !!c.opcional === opcional) || null;
  const nucleo = (fase) => catDe(fase, false) || b.categorias.find((c) => !c.opcional) || b.categorias[0];
  const dondeEsta = (clase) => { for (const c of b.categorias) { const i = c.objetos.findIndex((x) => x.clase === clase); if (i >= 0) return { c, i, item: c.objetos[i] }; } return null; };
  const quitar = (clase) => { for (const c of b.categorias) c.objetos = c.objetos.filter((x) => x.clase !== clase); };
  const minutoTipico = (clase) => { const d = compraDe(h, clase); return d && d.min != null ? d.min : null; };
  // Dónde va el objeto: «2.ª compra», «después de X», el minuto del consejo o el hueco del objeto al que sustituye
  const colocar = (dest, item, a, hueco) => {
    const t = String(a.cuando || '');
    let i = -1;
    const ord = t.match(/(\d)\.?\s*[ªa]\s+compra/i) || (/primera compra/i.test(t) ? [0, '1'] : null);
    if (ord) i = Math.max(0, parseInt(ord[1], 10) - 1);
    if (i < 0) {
      const antes = t.match(/antes de\s+([^.;(),]+)/i);
      if (antes) { const oa = objeto(antes[1].split(/\s+(?:si|y|o|para|cuando|en)\s+/i)[0].trim().replace(/^(el|la|los|las)\s+/i, '')); const k = oa ? dest.objetos.findIndex((x) => x.clase === oa.clase) : -1; if (k >= 0) i = k; }
    }
    if (i < 0) {
      const tras = t.match(/(?:despu[eé]s de|tras)\s+([^.;()]+)/i);
      if (tras) {
        const idx = tras[1].split(/,\s*|\s+e\s+|\s+y\s+/).map((n) => objeto(n.trim().replace(/^(el|la|los|las)\s+/i, ''))).filter(Boolean).map((o) => dest.objetos.findIndex((x) => x.clase === o.clase)).filter((k) => k >= 0);
        if (idx.length) i = Math.max(...idx) + 1;
      }
    }
    if (i < 0) {
      const m = t.match(/min(?:uto)?s?\.?\s*(\d+(?:[.,]\d+)?)/i);
      if (m) { const obj = parseFloat(m[1].replace(',', '.')); i = dest.objetos.findIndex((x) => { const tt = minutoTipico(x.clase); return tt != null && tt > obj; }); if (i < 0) i = dest.objetos.length; }
    }
    if (i < 0 && hueco != null) i = hueco;
    if (i < 0 && a.accion === 'adelantar') i = 0;
    if (i < 0 || i >= dest.objetos.length) dest.objetos.push(item); else dest.objetos.splice(i, 0, item);
  };
  const renombrados = [];
  const respetarSentido = (cat, clase, iAntes, accion) => {
    const k = cat.objetos.findIndex((x) => x.clase === clase); if (k < 0) return;
    if ((accion === 'adelantar' && k > iAntes) || (accion === 'retrasar' && k < iAntes)) { const [x] = cat.objetos.splice(k, 1); cat.objetos.splice(Math.min(iAntes, cat.objetos.length), 0, x); }
  };
  // El objeto sustituido no se borra: pasa a los situacionales de su fase
  const aSituacionales = (clase, fase) => { const p = dondeEsta(clase); if (!p) return; const op = catDe(fase || p.c.fase, true); if (!op || p.c === op) return; quitar(clase); op.objetos.push(p.item); };
  for (const a of ajustes) {
    const o = objeto(a.clase || a.objeto); if (!o) continue;
    if (a.accion === 'quitar') { quitar(o.clase); continue; }
    const fase = a.fase || 'media';
    const cond = esCondicional(a);
    const nota = notaAjuste(a);
    const previo = dondeEsta(o.clase);
    const item = { clase: o.clase, nota: nota || (previo && previo.item.nota) || '' };
    const viejo = a.en_lugar_de ? objeto(a.en_lugar_de) : null;
    const posViejo = viejo && viejo.clase !== o.clase ? dondeEsta(viejo.clase) : null;
    if (posViejo) {
      if (cond) { quitar(o.clase); colocar(catDe(posViejo.c.fase, true) || catDe(fase, true) || nucleo(fase), item, a); continue; }
      const cat = posViejo.c;
      if (previo && previo.c === cat && previo.i < posViejo.i) previo.item.nota = item.nota; // ya iba antes: se queda donde está
      if (a.accion === 'cambiar' && !/excepci[oó]n/i.test(a.cuando || '')) { quitar(viejo.clase); renombrados.push([viejo, o]); } else aSituacionales(viejo.clase, cat.fase);
      if (!(previo && previo.c === cat && previo.i < posViejo.i)) { quitar(o.clase); colocar(cat, item, a, Math.min(posViejo.i, cat.objetos.length)); }
      continue;
    }
    // Un consejo condicional sobre algo que ya está en el núcleo no lo saca de ahí: cambia su nota y, si es de orden, su sitio
    if (cond && previo && !previo.c.opcional) {
      if (a.accion === 'adelantar' || a.accion === 'retrasar') { quitar(o.clase); colocar(previo.c, item, a); respetarSentido(previo.c, o.clase, previo.i, a.accion); } else previo.item.nota = item.nota;
      continue;
    }
    const opcional = cond || (a.accion === 'retrasar' && previo && previo.c.opcional);
    const dest = (opcional && catDe(fase, true)) || nucleo(fase);
    // «Añadir» algo que ya está en el núcleo: solo se actualiza su nota
    if (previo && !previo.c.opcional && !cond && a.accion !== 'adelantar' && a.accion !== 'retrasar') { previo.item.nota = item.nota; continue; }
    quitar(o.clase);
    colocar(dest, item, a);
    if (previo && previo.c === dest) respetarSentido(dest, o.clase, previo.i, a.accion);
  }
  // Los textos de la build base que nombran un objeto sustituido pasan a nombrar el nuevo
  const renombrar = (t) => renombrados.reduce((s, [v, n]) => s.split(v.nombre).join(n.nombre).split(v.nombre_es).join(n.nombre_es), String(t || ''));
  if (renombrados.length) { for (const c of b.categorias) { c.descripcion = renombrar(c.descripcion); for (const x of c.objetos) if (x.nota && !ajustes.some((a) => objeto(a.clase || a.objeto) && objeto(a.clase || a.objeto).clase === x.clase)) x.nota = renombrar(x.nota); } b.notas = renombrar(b.notas); }
  const bh = analisisBuild(h);
  if (bh && bh.nota_juego) b.notas = bh.nota_juego + (b.notas ? '\n' + b.notas : '');
  b.nombre = `Taller · ${nombreH(h)} para ti (base + tus ajustes)`;
  return b;
}

/* ---------- Vista ---------- */
RUTAS.perfil = function (param) {
  const raiz = el('div', { class: 'perfil' });
  const ruta = rutaActual;
  const deParam = param ? (/^\d{1,10}$/.test(param) ? Number(param) : cuentaDeTexto(param)) : null;
  const paramMalo = !!param && !deParam;
  const cuenta = paramMalo ? null : deParam || PREF.cuenta || (D.perfil && D.perfil.cuenta) || null;
  // #perfil-<SteamID64> o un enlace: se normaliza a #perfil-<SteamID3>
  if (param && cuenta && String(cuenta) !== param) { location.replace('#perfil-' + cuenta); return raiz; }
  const foto = cuenta && D.perfil && D.perfil.cuenta === cuenta ? D.perfil : null;
  raiz.append(cabecera('Tus partidas, tu nivel', 'Mi perfil', foto && foto.investigacion
    ? 'Tier list, héroes, builds y composiciones recomendados para tu caso, a partir de tus partidas y del nivel de los jugadores con los que juegas.'
    : 'Tus partidas comparadas con la media de tu nivel y la tier list de ese nivel.'));

  // Formulario de cuenta
  const entrada = el('input', { class: 'entrada', type: 'text', value: paramMalo ? param : cuenta ? String(cuenta) : '', placeholder: 'SteamID o enlace de Steam', 'aria-label': 'Tu cuenta de Steam', autocomplete: 'off' });
  const cargar = () => {
    const txt = entrada.value.trim();
    if (/steamcommunity\.com\/id\//i.test(txt)) { toast('Ese enlace de Steam usa un nombre personalizado y no lleva el número. Pega el enlace de lockbuilds o tu SteamID64 (Steam → Detalles de la cuenta).', 6000); return; }
    const c = cuentaDeTexto(txt);
    if (!c) { toast('No encuentro un número de cuenta en ese texto'); return; }
    if (window.claude && !(D.perfil && D.perfil.cuenta === c)) { toast('Aquí solo se ve la foto publicada. Para ver otras cuentas, abre la web en GitHub Pages.', 5000); return; }
    if (D.perfil && D.perfil.cuenta === c) { PREF.cuenta = c; guardarPref(); }
    ir('perfil-' + c);
  };
  entrada.addEventListener('keydown', (e) => { if (e.key === 'Enter') cargar(); });
  const volver = D.perfil && cuenta && D.perfil.cuenta !== cuenta
    ? el('a', { href: '#perfil-' + D.perfil.cuenta, class: 'pequeno', onclick: () => { PREF.cuenta = D.perfil.cuenta; guardarPref(); } }, 'Volver a tu perfil (' + D.perfil.nombre + ')') : null;
  raiz.append(el('div', { class: 'controles perfil-cuenta' }, el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Tu cuenta'),
    el('div', { class: 'fila' }, entrada, el('button', { type: 'button', class: 'boton primario', onclick: cargar }, 'Cargar')),
    el('span', { class: 'muted pequeno' }, 'Vale tu SteamID, el enlace de tu perfil de Steam con número o el de lockbuilds.'), volver)));
  const estado = el('p', { class: 'muted pequeno estado-perfil' });
  const zona = el('div'); raiz.append(estado, zona);
  if (!cuenta) {
    if (paramMalo) zona.append(el('div', { class: 'vacio' }, `«${param}» no parece una cuenta de Steam.`));
    zona.append(el('div', { class: 'nota-caja' }, el('p', null, 'Pega tu SteamID, el enlace de tu perfil de Steam (steamcommunity.com/profiles/7656…) o el de lockbuilds (lockbuilds.com/players/…). Los datos salen de la API pública de Deadlock, la misma que usan lockbuilds y otras webs de estadísticas.')));
    return raiz;
  }

  // Lo pintado ahora (foto o datos en vivo); cambiar de nivel solo repinta, sin volver a pedir nada
  let actual = foto;
  const estadoPlegables = new Map();
  const pintar = () => {
    if (!actual) return;
    zona.querySelectorAll('details[data-clave]').forEach((d) => estadoPlegables.set(d.dataset.clave, d.open));
    // Repintar sin mover lo que estás leyendo: alturas recordadas y misma sección en el mismo sitio
    const alturas = new Map([...zona.querySelectorAll('.seccion[id]')].map((s) => [s.id, s.getBoundingClientRect().height]));
    const visible = [...zona.querySelectorAll('.seccion[id]')].find((s) => s.getBoundingClientRect().bottom > 80);
    const topAntes = visible ? visible.getBoundingClientRect().top : null; const idVisible = visible ? visible.id : null;
    zona.innerHTML = '';
    zona.append(vistaPerfil(actual, (v) => { guardarNivelDe(cuenta, v, (actual.nivel && actual.nivel.clave) || 'principiante'); requestAnimationFrame(() => setTimeout(pintar, 0)); }));
    zona.querySelectorAll('details[data-clave]').forEach((d) => { if (estadoPlegables.has(d.dataset.clave)) d.open = estadoPlegables.get(d.dataset.clave); });
    zona.querySelectorAll('.seccion[id]').forEach((s) => { if (alturas.get(s.id)) s.style.containIntrinsicSize = 'auto ' + Math.round(alturas.get(s.id)) + 'px'; });
    if (idVisible && window.scrollY > 100) { const n = document.getElementById(idVisible); if (n) window.scrollBy(0, n.getBoundingClientRect().top - topAntes); }
  };
  // Al volver atrás: los plegables que tenías abiertos (los guarda app.js en el historial)
  const st = history.state;
  if (st && st.ruta === ruta && Array.isArray(st.abiertos)) for (const k of st.abiertos) estadoPlegables.set(k, true);
  // Si llegan estadísticas nuevas de la tier list mientras se ve el perfil, se repinta sin perder lo abierto
  window.repintarPerfil = () => { if (rutaActual === ruta && zona.isConnected) pintar(); };
  if (foto && PREF.cuenta !== cuenta) { PREF.cuenta = cuenta; guardarPref(); }
  if (foto) { pintar(); estado.textContent = `Datos del ${fmtFecha(foto.generado)}${foto.investigacion ? ' con el análisis de tus partidas' : ''}.`; }
  else zona.append(el('div', { class: 'vacio cargando' }, 'Cargando tus partidas…'));

  // En vivo (no en claude.ai: allí la API está bloqueada)
  if (!window.claude) {
    perfilEnVivo(cuenta).then((vivo) => {
      if (rutaActual !== ruta || !zona.isConnected) return;
      const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      if (!vivo.resumen.partidas && !foto) {
        zona.innerHTML = '';
        zona.append(el('div', { class: 'vacio' }, `No hay partidas de Deadlock para la cuenta ${cuenta}. Revisa el número o comprueba que tu historial de partidas sea público.`));
        return;
      }
      if (cuenta !== PREF.cuenta) { PREF.cuenta = cuenta; guardarPref(); }
      if (foto) {
        // Sin partidas nuevas, la foto (con su análisis) ya es lo que hay: no se repinta
        const nuevas = vivo.partidas.filter((x) => !(foto.partidas || []).some((y) => y.match_id === x.match_id)).length;
        if (!nuevas) { estado.textContent = `Datos del ${fmtFecha(foto.generado)} con el análisis de tus partidas · comprobado en vivo a las ${hora}: no hay partidas nuevas.`; return; }
        actual = { ...foto, resumen: { ...vivo.resumen, precision: vivo.resumen.precision ?? foto.resumen.precision }, por_heroe: vivo.por_heroe.map((x) => { const f = (foto.por_heroe || []).find((y) => y.hero_id === x.hero_id); return { ...x, precision: x.precision ?? (f ? f.precision : null) }; }), partidas: vivo.partidas, generado: vivo.generado, vivo: true, limitadas: vivo.limitadas, nivel: vivo.nivel.propio ? vivo.nivel : foto.nivel };
        const texto = `Datos en vivo de la API (${hora}) con ${nuevas} ${nuevas === 1 ? 'partida nueva' : 'partidas nuevas'}; el análisis escrito es del ${fmtFecha((foto.investigacion && foto.investigacion.fecha) || foto.generado)} y no las incluye.`;
        if (window.scrollY > 200) {
          // Ya estás leyendo: no se mueve la página; se ofrece actualizar
          estado.innerHTML = '';
          estado.append(`Hay ${nuevas} ${nuevas === 1 ? 'partida nueva' : 'partidas nuevas'}. `, el('button', { type: 'button', class: 'boton mini', onclick: () => { estado.textContent = texto; pintar(); } }, 'Actualizar'));
          return;
        }
        estado.textContent = texto;
      } else {
        actual = vivo;
        estado.textContent = `Datos en vivo de la API (${hora}).`;
      }
      pintar();
    }).catch((e) => {
      if (rutaActual !== ruta || foto) return;
      zona.innerHTML = '';
      zona.append(el('div', { class: 'vacio' }, 'No se pudieron cargar las partidas de esa cuenta (' + e.message + '). Comprueba el número o inténtalo más tarde.'));
    });
  } else if (!foto) { zona.innerHTML = ''; zona.append(el('div', { class: 'vacio' }, 'Dentro de claude.ai no se puede consultar la API: aquí solo se ve la foto de datos que se publicó con la web.')); }
  return raiz;
};

function vistaPerfil(p, alCambiarNivel) {
  const cont = el('div');
  const inv = p.investigacion || null;
  const est = inv && inv.estadisticas; const tier = inv && inv.tier; const builds = inv && inv.builds; const comps = inv && inv.comps;
  const nivelBase = (p.nivel && p.nivel.clave) || 'principiante';
  const nivelP = nivelPorClave(nivelElegidoDe(p.cuenta) || nivelBase);
  // El análisis escrito está hecho para el nivel de la foto; si se elige otro, se avisa
  const nivelAnalisis = inv ? nivelBase : null;
  const otroNivel = nivelAnalisis && nivelP.clave !== nivelAnalisis;
  const avisoNivel = () => (otroNivel ? el('p', { class: 'nota-caja pequeno' }, `Este análisis está hecho para tu nivel (${nivelPorClave(nivelAnalisis).nombre}). Con ${nivelP.nombre} elegido cambian la tier list, la letra de tier de cada héroe y las medias de «Tus héroes»; los textos y las barras siguen siendo de tu nivel.`) : null);
  const mediaTxt = otroNivel ? 'Media de ' + nivelPorClave(nivelAnalisis).nombre : 'Media de tu nivel';
  // Plegable con clave estable (para recordar si estaba abierto al repintar)
  const plegable = (clave, resumen, contenido, abierto, estilo) => el('details', { class: 'plegable', 'data-clave': clave, open: abierto ? true : null, style: estilo || null }, el('summary', null, resumen), contenido);

  // Cabecera del jugador
  const nivelTxt = p.nivel && p.nivel.propio ? `Rango ${p.nivel.rango}`
    : p.nivel && p.nivel.badge ? `Sin rango propio · juegas con gente de nivel ${p.nivel.rango} (mediana de los ${p.nivel.con_rango} jugadores con rango de tus partidas)`
      : 'Sin rango propio · se compara con Initiate–Acolyte; si juegas con gente de más nivel, elige otro abajo';
  cont.append(el('div', { class: 'perfil-cab tarjeta' },
    p.avatar ? el('img', { src: p.avatar, alt: '', class: 'perfil-avatar', onerror: (e) => e.currentTarget.remove() }) : null,
    el('div', null, el('h2', null, p.nombre), el('p', { class: 'sec' }, nivelTxt),
      el('div', { class: 'control' }, el('span', { class: 'etiqueta' }, 'Comparar con el nivel'), segmento(NIVELES_PERFIL.map((n) => [n.clave, n.nombre + (n.clave === nivelBase ? ' (el tuyo)' : '')]), nivelP.clave, (v) => alCambiarNivel && alCambiarNivel(v), null, 'Nivel con el que comparar')),
      p.perfil_steam ? el('a', { href: p.perfil_steam, target: '_blank', rel: 'noopener', class: 'pequeno' }, 'Perfil de Steam') : null)));

  if (tier && tier.nivel && tier.nivel.por_que && !(p.nivel && p.nivel.propio)) cont.append(plegable('nivel', 'Cómo se calcula tu nivel sin rango', el('div', { class: 'contenido sec pequeno' }, el('p', null, tier.nivel.por_que)), false, { margin: '10px 0' }));
  const indice = el('nav', { class: 'saltos-fase indice-perfil', 'aria-label': 'Ir a una sección del perfil' }, el('span', { class: 'etiqueta' }, 'Ir a'));
  cont.append(indice);
  const seccion = (id, titulo, ...hijos) => { indice.append(el('button', { type: 'button', class: 'chip boton-chip', onclick: () => { const s = document.getElementById(id); if (!s) return; const ir2 = () => s.scrollIntoView({ block: 'start' }); ir2(); requestAnimationFrame(() => requestAnimationFrame(ir2)); setTimeout(ir2, 250); } }, titulo)); return el('section', { class: 'seccion', id }, el('h2', null, titulo), ...hijos); };

  // Medias del nivel elegido por héroe (30 días) y, para el nivel del análisis, por minuto
  const medias = mediasNivel(nivelP.clave) || {};
  const porMinuto = {};
  if (est && !otroNivel) for (const x of est.por_heroe || []) if (x.comparado_con_su_nivel) porMinuto[x.hero_id] = { almas_min: x.comparado_con_su_nivel.almas_min_media_nivel, dano_min: x.comparado_con_su_nivel.dano_min_media_nivel };

  // Resumen
  const r = p.resumen || {};
  const conNivel = (p.por_heroe || []).filter((x) => medias[x.hero_id] && medias[x.hero_id].muertes != null);
  const pesos = conNivel.reduce((s, x) => s + x.partidas, 0) || 1;
  const muertesNivel = conNivel.reduce((s, x) => s + medias[x.hero_id].muertes * x.partidas, 0) / pesos;
  const kpi = (et, val, extra) => el('div', { class: 'kpi' }, el('div', { class: 'etiqueta' }, et), el('div', { class: 'valor num' }, val), extra ? el('div', { class: 'muted pequeno' }, extra) : null);
  cont.append(el('div', { class: 'kpis' },
    kpi(p.limitadas ? 'Últimas partidas' : 'Partidas', fmt(r.partidas), r.desde ? `${fmtFecha(r.desde)} – ${fmtFecha(r.hasta)}` : ''), kpi('Victorias', fmtPct(r.wr), `${r.victorias} de ${r.partidas}`),
    kpi('KDA', fmtD(r.kda, 1), `${fmtD(r.kills, 1)} / ${fmtD(r.muertes, 1)} / ${fmtD(r.asistencias, 1)}`), kpi('Muertes por partida', fmtD(r.muertes, 1), conNivel.length ? `media de ${nivelP.nombre} con tus héroes: ${fmtD(muertesNivel, 1)}` : ''),
    kpi('Almas por minuto', fmt(r.almas_min)), r.precision != null ? kpi('Precisión', fmtPct(r.precision), 'balas que aciertan (también a tropas)') : null));
  if ((r.partidas || 0) > 0 && r.partidas < 30) cont.append(el('p', { class: 'muted pequeno' }, `Con ${r.partidas} partidas las cifras por héroe son orientativas: una o dos partidas pesan mucho.`));

  // Lo más importante (análisis)
  if (est) {
    const sec = seccion('perfil-partidas', 'Lo que dicen tus partidas', avisoNivel());
    if (est.resumen_juego) sec.append(el('p', { class: 'sec perfil-intro' }, est.resumen_juego));
    if ((est.conclusiones || []).length) sec.append(el('ol', { class: 'conclusiones' }, est.conclusiones.map((c) => el('li', null, typeof c === 'string' ? c : c.texto || ''))));
    const g = el('div', { class: 'grid-2' });
    if ((est.fortalezas || []).length) g.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Lo que haces bien'), el('ul', { class: 'lista-perfil' }, est.fortalezas.map((f) => el('li', null, el('b', null, f.titulo), f.dato ? el('span', { class: 'muted pequeno' }, ' · ' + f.dato) : null, f.explicacion ? el('div', { class: 'sec pequeno' }, f.explicacion) : null)))));
    if ((est.debilidades || []).length) g.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Lo que más te cuesta'), el('ul', { class: 'lista-perfil' }, est.debilidades.map((f) => el('li', null, el('b', null, f.titulo), f.dato ? el('span', { class: 'muted pequeno' }, ' · ' + f.dato) : null, f.que_hacer ? el('div', { class: 'sec pequeno' }, el('b', null, 'Qué hacer: '), f.que_hacer) : null)))));
    if (g.children.length) sec.append(g);
    cont.append(sec);
  }

  // Dónde se ganan y se pierden tus partidas (análisis de las partidas minuto a minuto)
  if (est && (est.muertes || est.economia || est.objetos)) {
    const sec = seccion('perfil-escapan', 'Dónde se te escapan las partidas', avisoNivel());
    const g = el('div', { class: 'grid-2' });
    // Barras pareadas: tú frente a la media de tu nivel; en rojo, donde estás peor
    const pares = (filas, fmtV, otro = mediaTxt) => { const max = Math.max(...filas.flatMap((x) => [x.tu, x.nivel]).filter((x) => x != null), 1);
      return el('div', { class: 'pares' }, el('div', { class: 'pares-leyenda muted pequeno' }, el('span', { class: 'pt-tu' }, 'Tú'), el('span', { class: 'pt-mal' }, 'Tú, peor que la media'), el('span', { class: 'pt-nivel' }, otro)),
        filas.map((x) => el('div', { class: 'par' }, el('div', { class: 'par-et pequeno' }, x.et, x.sub ? el('small', { class: 'muted' }, ' · ' + x.sub) : null),
          el('div', { class: 'par-barras' }, el('div', { class: 'barra-par tu' + (x.malo ? ' malo' : ''), title: x.malo ? 'Peor que la media' : '' }, el('i', { style: { width: (100 * (x.tu || 0)) / max + '%' } }), el('span', { class: 'num' }, fmtV(x.tu), x.malo ? el('small', { class: 'marca-peor' }, ' peor') : null)),
            el('div', { class: 'barra-par nivel' }, el('i', { style: { width: (100 * (x.nivel || 0)) / max + '%' } }), el('span', { class: 'num' }, fmtV(x.nivel)))))));
    };
    const m = est.muertes || {};
    if ((m.por_tramo || []).length) g.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Muertes por tramo de partida'),
      pares(m.por_tramo.map((t) => ({ et: t.tramo, sub: t.partidas + ' partidas', tu: t.suyas, nivel: t.nivel, malo: t.suyas > t.nivel * 1.1 })), (v) => fmtD(v, 2)),
      el('p', { class: 'muted pequeno' }, 'Mueres ' + fmtD(m.media_por_partida, 1) + ' veces por partida (' + (otroNivel ? 'media de ' + nivelPorClave(nivelAnalisis).nombre : 'media de tu nivel') + ': ' + fmtD(m.media_nivel, 1) + ').' + (m.tiempo_mediano_para_matarle_s ? ' Desde que te empiezan a pegar hasta que mueres pasan ' + fmt(m.tiempo_mediano_para_matarle_s, 0) + ' s (mediana).' : ''))));
    const fa = est.economia && est.economia.fuentes_de_almas;
    if (fa) { const NOM = { troopers: 'Tropas', jungla: 'Jungla', heroes: 'Kills y asistencias', otros: 'Objetivos y cajas' };
      const filas = Object.keys(NOM).filter((k) => fa[k]).map((k) => ({ et: NOM[k], tu: fa[k].min15, nivel: fa[k].min15_nivel, malo: fa[k].min15 < fa[k].min15_nivel * 0.9 }));
      g.append(el('div', { class: 'tarjeta' }, el('h3', null, 'De dónde salen tus almas (minuto 15)'), pares(filas, (v) => fmt(v)),
        el('ul', { class: 'lista-perfil sec pequeno', style: { marginTop: '8px' } }, Object.keys(NOM).filter((k) => fa[k] && fa[k].lectura).map((k) => el('li', null, el('b', null, NOM[k] + ': '), fa[k].lectura))))); }
    if (g.children.length) sec.append(g);
    const txt = (x) => (typeof x === 'string' ? x : x && (x.texto || x.lectura || x.resumen || x.patron)) || '';
    const e2 = el('div', { class: 'grid-2', style: { marginTop: '12px' } });
    if (txt(est.carriles)) e2.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Tus líneas'), el('p', { class: 'sec pequeno' }, txt(est.carriles))));
    const ec = est.economia || {};
    const sg = ec.almas_sin_gastar; const vt = ec.ventas;
    if (sg && typeof sg === 'object' && sg.min_10_20 != null) {
      const filas = [['0-10 min', 'min_0_10'], ['10-20 min', 'min_10_20'], ['20-30 min', 'min_20_30']].filter(([, k]) => sg[k] != null).map(([et, k]) => ({ et, tu: sg[k], nivel: sg[k + '_lobby'], malo: sg[k] > (sg[k + '_lobby'] || 0) * 1.15 }));
      e2.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Almas sin gastar en el bolsillo'), pares(filas, (v) => fmt(v), 'Resto de jugadores de tus partidas'),
        vt && vt.almas_perdidas_por_partida != null ? el('p', { class: 'sec pequeno' }, el('b', null, 'Vendiendo pierdes ' + fmt(vt.almas_perdidas_por_partida) + ' almas por partida'), ' (el resto de jugadores, ' + fmt(vt.almas_perdidas_por_partida_lobby) + '), aunque casi todo sale de dos partidas. Al vender un objeto recuperas la mitad de lo que costó.') : null));
    } else if (txt(sg) || txt(vt)) e2.append(el('div', { class: 'tarjeta' }, el('h3', null, 'Cómo gastas'), txt(sg) ? el('p', { class: 'sec pequeno' }, txt(sg)) : null, txt(vt) ? el('p', { class: 'sec pequeno' }, txt(vt)) : null));
    if (e2.children.length) sec.append(e2);
    const ob = est.objetos || {};
    if ((ob.comparacion_con_taller || []).length) {
      const tb = el('table', { class: 'tabla tabla-tarjetas tabla-perfil' }, el('thead', null, el('tr', null, [['Héroe'], ['Objeto'], ['Tú (minuto)', 'num'], ['Taller (minuto)', 'num'], ['Comentario']].map(([t, c]) => el('th', { class: c || null }, t)))));
      tb.append(el('tbody', null, ob.comparacion_con_taller.map((x) => { const h = heroe(Number(x.hero_id)); const o = objeto(x.clase || x.objeto);
        const tarde = x.su_minuto != null && x.minuto_taller != null && x.su_minuto - x.minuto_taller > 3;
        return el('tr', null, celda('Héroe', h ? chipH(h, null, true) : '—'), celda('Objeto', o ? chipO(o) : x.objeto || ''), celda('Tú (minuto)', el('span', { class: tarde ? 'peor' : null, title: tarde ? 'Más de 3 minutos tarde' : '' }, fmtD(x.su_minuto, 1)), 'num'), celda('Taller (minuto)', fmtD(x.minuto_taller, 1), 'num'), celda('Comentario', el('span', { class: 'pequeno sec' }, x.comentario || ''))); })));
      sec.append(plegable('cuando-compras', 'Cuándo compras tus objetos frente a la build del Taller', el('div', { class: 'contenido' }, ob.nota_comparacion ? el('p', { class: 'muted pequeno' }, txt(ob.nota_comparacion)) : null, el('div', { class: 'tabla-env' }, tb)), false, { marginTop: '12px' }));
    }
    if ((ob.errores || []).length) sec.append(plegable('errores', 'Errores de compra que se repiten', el('ul', { class: 'contenido lista-perfil sec pequeno' }, ob.errores.map((x) => el('li', null, x.dato ? el('div', null, x.dato) : null, x.consejo ? el('div', null, el('b', null, 'Consejo: '), x.consejo) : null))), false, { marginTop: '10px' }));
    const pr = est.precision || {};
    const filasPr = [['Puntería', pr.armas], ['Tiros a la cabeza', pr.headshots], ['Parry', pr.parry]].filter((x) => txt(x[1]));
    if (filasPr.length) sec.append(plegable('punteria', 'Puntería, tiros a la cabeza y parry', el('ul', { class: 'contenido lista-perfil sec pequeno' }, filasPr.map((x) => el('li', null, el('b', null, x[0] + ': '), txt(x[1])))), false, { marginTop: '10px' }));
    cont.append(sec);
  }

  // Tus héroes contra la media del nivel elegido
  if ((p.por_heroe || []).length) {
    // Verde si es mejor que la media, rojo si es peor; sin color si la diferencia es menor del 3 %
    const cmp = (v, m, mejorSiMenor, f) => {
      if (v == null || m == null) return el('span', null, v == null ? '—' : f(v));
      const dif = m ? (v - m) / Math.abs(m) : 0;
      const clase = Math.abs(dif) < 0.03 ? 'igual' : (mejorSiMenor ? dif < 0 : dif > 0) ? 'mejor' : 'peor';
      return el('span', { class: clase, title: 'Media del nivel: ' + f(m) }, f(v), el('small', { class: 'muted' }, ' / ' + f(m)));
    };
    const pc = (v) => fmtD(v, 1) + ' %'; const d1 = (v) => fmtD(v, 1); const d0 = (v) => fmt(v);
    const hayMedias = Object.keys(medias).length > 0;
    const tb = el('table', { class: 'tabla tabla-tarjetas tabla-perfil' }, el('thead', null, el('tr', null, ['Héroe', 'Partidas', '% victorias', 'KDA', 'Muertes', 'Almas / min', 'Daño a héroes / min', '% precisión'].map((t, i) => el('th', { class: i ? 'num' : null }, t)))));
    tb.append(el('tbody', null, p.por_heroe.map((x) => { const h = heroe(x.hero_id); const n = medias[x.hero_id] || {}; const pm = porMinuto[x.hero_id] || {}; return el('tr', null,
      celda('Héroe', h ? chipH(h, null, true) : String(x.hero_id)), celda('Partidas', fmt(x.partidas), 'num'), celda('% victorias', cmp(x.wr, n.wr, false, pc), 'num'), celda('KDA', fmtD(x.kda, 1), 'num'),
      celda('Muertes', cmp(x.muertes, n.muertes, true, d1), 'num'), celda('Almas / min', cmp(x.almas_min, pm.almas_min, false, d0), 'num'), celda('Daño a héroes / min', cmp(x.dano_min, pm.dano_min, false, d0), 'num'), celda('% precisión', cmp(x.precision, n.precision, false, pc), 'num')); })));
    const nota = !hayMedias ? `No hay medias de ${nivelP.nombre} para comparar.`
      : `Tu cifra / la media de ${nivelP.largo} con ese héroe (últimos 30 días). En verde, mejor que la media; en rojo, peor; sin color, casi igual.${Object.keys(porMinuto).length ? ' Las almas y el daño por minuto se comparan con la media de tus mismos héroes en tu nivel.' : ' Las almas y el daño por minuto no tienen media para este nivel.'}`;
    cont.append(seccion('perfil-heroes', 'Tus héroes', el('p', { class: 'muted pequeno' }, nota), el('div', { class: 'tabla-env' }, tb)));
  }

  // Héroes para ti
  const pool = (tier && tier.pool_recomendado) || [];
  const datosNivel = D.stats && D.stats.datos[PREF.ventana] && D.stats.datos[PREF.ventana][nivelP.clave];
  const tierEn = (id) => { const f = datosNivel && datosNivel.heroes.find((x) => x.id === id); return f ? f.tier : null; };
  if (pool.length) {
    cont.append(seccion('perfil-para-ti', 'Héroes para ti', avisoNivel(),
      el('div', { class: 'grid-3' }, pool.map((x) => { const h = heroe(Number(x.hero_id)) || heroe(x.nombre); const t = h ? tierEn(h.id) : x.tier_su_nivel; return el('div', { class: 'tarjeta perfil-heroe' },
        el('div', { class: 'fila' }, h ? chipH(h) : el('b', null, x.nombre), x.papel ? el('span', { class: 'chip laton' }, x.papel) : null, t ? el('span', { class: 'tier-de', title: `Tier en ${nivelP.nombre}` }, insigniaTier(t), otroNivel ? el('small', { class: 'muted' }, ' en ' + nivelP.nombre) : null) : null),
        x.por_que ? el('p', { class: 'sec pequeno' }, x.por_que) : null,
        el('div', { class: 'muted pequeno' }, [x.dificultad ? 'Dificultad ' + (typeof x.dificultad === 'number' ? x.dificultad + '/5' : x.dificultad) : '', x.su_historial ? 'Tu historial: ' + x.su_historial : ''].filter(Boolean).join(' · ')),
        h ? el('div', { class: 'fila acciones-heroe' }, el('a', { class: 'boton mini', href: '#heroe-' + h.clase }, 'Cómo jugarlo'), hayBuildParaTi(h) ? el('a', { class: 'boton mini', href: '#build-perfil-' + h.clase }, 'Build para ti') : null) : null); })),
      (tier.evitar_por_ahora || []).length ? plegable('evitar', `Mejor no por ahora (${tier.evitar_por_ahora.length} héroes)`,
        el('ul', { class: 'contenido sec pequeno lista-perfil' }, tier.evitar_por_ahora.map((x) => { const h = heroe(Number(x.hero_id)) || heroe(x.nombre); return el('li', null, h ? chipH(h, null, true) : el('b', null, x.nombre), x.por_que ? el('div', null, x.por_que) : null); })), false, { marginTop: '12px' }) : null,
      (tier.consejos_de_eleccion || []).length ? plegable('elegir', 'Cómo elegir héroe en cada partida', el('ul', { class: 'contenido sec pequeno lista-perfil' }, tier.consejos_de_eleccion.map((c) => el('li', null, c))), false, { marginTop: '10px' }) : null));
  }

  // Tier list del nivel elegido
  const listaNivel = datosNivel ? datosNivel.heroes : tier && tier.tier_list && (tier.tier_list[PREF.ventana] || tier.tier_list['7d'] || tier.tier_list['30d']);
  if (listaNivel && listaNivel.length) {
    const sec = seccion('perfil-tier', otroNivel || !nivelAnalisis ? `Tier list de ${nivelP.nombre}` : 'Tier list de tu nivel',
      el('p', { class: 'muted pequeno' }, `${nivelP.largo}, ${PREF.ventana === '30d' ? 'últimos 30 días' : 'últimos 7 días'}${datosNivel ? ` · ${fmt(datosNivel.partidas)} partidas` : ''}. Misma fórmula que la tier list general: % de victorias ajustado y comparado con el resto de héroes. Con borde dorado, los héroes que ya has jugado.`));
    const filas = el('div', { class: 'tier-tabla' });
    const misHeroes = new Set((p.por_heroe || []).map((x) => x.hero_id));
    for (const t of TIERS) {
      const hs = listaNivel.filter((x) => (x.tier || '') === t);
      filas.append(el('div', { class: 'tier-fila' }, el('div', { class: 'tier-letra t-' + t }, t), el('div', { class: 'tier-heroes' }, hs.map((x) => { const h = heroe(x.id || x.hero_id); if (!h) return null; const mio = misHeroes.has(h.id);
        return el('a', { class: 'tier-chip' + (mio ? ' tuyo' : ''), href: '#heroe-' + h.clase, title: `${nombreH(h)}: ${fmtPct(x.wr)} de victorias${x.partidas ? ', ' + fmt(x.partidas) + ' partidas' : ''}${mio ? ' · lo has jugado' : ''}` }, imgH(h, ''), el('span', { class: 'datos' }, el('span', null, nombreH(h)), el('span', { class: 'num' }, fmtD(x.wr, 1) + '\u00a0%'))); }))));
    }
    sec.append(filas);
    if (D.stats.brackets.some((b) => b.clave === nivelP.clave)) sec.append(el('div', { class: 'fila', style: { marginTop: '8px' } }, el('a', { class: 'boton', href: '#tier', onclick: () => { PREF.bracket = nivelP.clave; guardarPref(); } }, 'Ver la tier list completa de este nivel')));
    if (tier && !otroNivel && (tier.diferencias_con_general || []).length) sec.append(plegable('que-cambia', 'Qué cambia respecto a la tier list general',
      el('ul', { class: 'contenido sec pequeno lista-perfil' }, tier.diferencias_con_general.map((d) => el('li', null, el('b', null, d.nombre || nombreH(heroe(d.hero_id))), ` · general ${d.tier_general || '—'}, tu nivel ${d.tier_su_nivel || '—'}`, d.por_que ? el('div', null, d.por_que) : null))), false, { marginTop: '10px' }));
    cont.append(sec);
  }

  // Builds para ti: primero tu héroe principal y el resto del grupo recomendado; los desaconsejados, al final
  const ordenPool = pool.map((x) => Number(x.hero_id));
  const evitar = new Set(((tier && tier.evitar_por_ahora) || []).map((x) => Number(x.hero_id)));
  const jugadas = (id) => ((p.por_heroe || []).find((x) => x.hero_id === id) || {}).partidas || 0;
  const peso = (id) => (evitar.has(id) ? 2000 : 0) + (ordenPool.includes(id) ? ordenPool.indexOf(id) : 100 - jugadas(id));
  const bh = builds && builds.heroes ? Object.entries(builds.heroes).sort((a, b) => peso(Number(a[0])) - peso(Number(b[0]))) : [];
  if (bh.length) {
    const criterios = String(builds.criterios || '');
    // Entradilla: frases enteras hasta unos 160 caracteres; el resto, plegado
    let primera = '';
    for (const f of criterios.split(/(?<=\.)\s+/)) { if (primera && (primera + ' ' + f).length > 200) break; primera = primera ? primera + ' ' + f : f; if (primera.length >= 160) break; }
    const sec = seccion('perfil-builds', 'Builds para ti', avisoNivel(),
      primera ? el('p', { class: 'sec pequeno perfil-intro' }, primera) : null,
      criterios.length > primera.length + 5 ? plegable('criterios', 'Cómo se han hecho estas builds', el('div', { class: 'contenido sec pequeno' }, el('p', null, criterios.slice(primera.length).trim())), false, { margin: '6px 0 12px' }) : null);
    const ancho = window.matchMedia && window.matchMedia('(min-width: 861px)').matches;
    const ACCION = { adelantar: 'Adelantar', añadir: 'Añadir', anadir: 'Añadir', quitar: 'Quitar', cambiar: 'Cambiar', retrasar: 'Retrasar' };
    bh.forEach(([id, b], n) => {
      const h = heroe(Number(id)) || heroe(b.nombre); if (!h) return;
      const card = el('div', { class: 'tarjeta build-perfil' + (evitar.has(h.id) ? ' desaconsejado' : '') },
        el('div', { class: 'fila entre' }, el('div', { class: 'fila' }, chipH(h), evitar.has(h.id) ? el('span', { class: 'chip aviso' }, 'mejor no por ahora') : null), el('div', { class: 'fila' }, el('a', { class: 'boton mini', href: '#heroe-' + h.clase }, 'Build completa del héroe'), varianteParaTi(h) ? el('a', { class: 'boton mini primario', href: '#build-perfil-' + h.clase }, 'Abrir la recomendada para ti (' + varianteParaTi(h).nombre + ')') : (b.ajustes || []).length ? el('a', { class: 'boton mini primario', href: '#build-perfil-' + h.clase }, 'Abrir en el creador con tus ajustes') : null)),
        b.resumen || b.por_que_este_heroe ? el('p', { class: 'sec pequeno' }, b.resumen || b.por_que_este_heroe) : null);
      if ((b.ajustes || []).length) {
        const lista = el('div', { class: 'compras' }, b.ajustes.map((a) => {
          const o = objeto(a.clase || a.objeto); const viejo = a.en_lugar_de ? objeto(a.en_lugar_de) : null;
          const cond = esCondicional(a);
          return el('div', { class: 'ajuste' }, el('span', { class: 'chip ' + (a.accion === 'quitar' ? 'mal' : a.accion === 'añadir' || a.accion === 'anadir' ? 'ok' : 'aviso') }, (ACCION[a.accion] || a.accion || '') + (a.fase ? ' · fase ' + a.fase : '') + (cond ? ' · según la partida' : '')),
            o ? chipO(o) : el('b', null, a.objeto || a.clase), viejo ? el('span', { class: 'muted pequeno' }, ' en lugar de ', chipO(viejo)) : null,
            a.cuando ? el('div', { class: 'pequeno' }, el('b', null, 'Cuándo: '), a.cuando) : null, a.por_que ? el('div', { class: 'sec pequeno' }, el('b', null, 'Por qué: '), a.por_que) : null, a.dato ? el('div', { class: 'muted pequeno' }, a.dato) : null);
        }));
        card.append(el('details', { class: 'plegable ajustes-plegable', 'data-clave': 'build-' + h.id, open: n === 0 && ancho ? true : null }, el('summary', null, `${nombreH(h)}: los ${b.ajustes.length} cambios frente a la build base del Taller` + (varianteParaTi(h) ? ` (la recomendada, «${varianteParaTi(h).nombre}», ya está pensada para tu perfil)` : "")), el('div', { class: 'contenido' }, lista)));
      }
      if ((b.errores_detectados || []).length) card.append(el('details', { class: 'compra-mas' }, el('summary', null, 'Lo que se vio en tus partidas'), el('ul', { class: 'sec pequeno lista-perfil' }, b.errores_detectados.map((e) => el('li', null, e.dato ? el('span', { class: 'muted' }, e.dato + ' → ') : null, e.consejo || '')))));
      if (b.nota_juego) card.append(lineaJuego('Nota para la build en el juego', b.nota_juego));
      sec.append(card);
    });
    cont.append(sec);
  }

  // Composiciones para ti
  if (comps) {
    const hDe = (id, nombre) => heroe(Number(id)) || heroe(id) || heroe(nombre);
    const sec = seccion('perfil-comps', 'Composiciones para ti', avisoNivel(), comps.su_papel ? el('p', { class: 'sec perfil-intro' }, el('b', null, 'Tu papel: '), comps.su_papel) : null);
    if ((comps.composiciones || []).length) sec.append(el('div', { class: 'grid-2' }, comps.composiciones.map((c) => { const yo = hDe(c.tu_heroe_id, c.tu_heroe);
      return el('div', { class: 'comp-tarjeta' }, el('h3', null, c.nombre || 'Composición'),
        el('div', { class: 'fila' }, yo ? chipH(yo, 'tú', true) : null, (c.companeros || []).map((x) => { const h = hDe(x); return h && h !== yo ? chipH(h, null, true) : null; })),
        c.lineas ? el('p', { class: 'pequeno' }, el('b', null, 'Líneas: '), c.lineas) : null, c.plan ? el('p', { class: 'pequeno' }, el('b', null, 'Plan: '), c.plan) : null,
        (c.si_tus_companeros_eligen_otra_cosa || []).length ? el('div', { class: 'pequeno' }, el('b', null, 'Si tus compañeros eligen otra cosa:'), el('ul', { class: 'lista-perfil sec', style: { marginTop: '4px' } }, c.si_tus_companeros_eligen_otra_cosa.map((t) => el('li', null, t)))) : null,
        c.por_que || c.dato ? el('details', { class: 'compra-mas' }, el('summary', null, 'Por qué y datos'), c.por_que ? el('p', { class: 'sec pequeno' }, c.por_que) : null, c.dato ? el('p', { class: 'muted pequeno' }, c.dato) : null) : null); })));
    const tablaParejas = (filas) => el('div', { class: 'tabla-env' }, el('table', { class: 'tabla tabla-tarjetas tabla-parejas' }, el('thead', null, el('tr', null, [['Tú'], ['Pareja'], ['Victorias', 'num'], ['Esperado', 'num'], ['Almas a los 15 min', 'num'], ['Por qué']].map(([t, c]) => el('th', { class: c || null }, t)))),
        el('tbody', null, filas.map((x) => { const a = hDe(x.tu_heroe_id, x.tu_heroe); const b = hDe(x.pareja_id, x.pareja);
          return el('tr', null, celda('Tú', a ? chipH(a, null, true) : x.tu_heroe), celda('Pareja', b ? chipH(b, null, true) : x.pareja),
            celda('Victorias', x.wr != null ? el('span', null, fmtD(x.wr, 1) + '\u00a0%', x.partidas ? el('small', { class: 'muted bloque-cifra' }, fmt(x.partidas) + ' partidas') : null) : '—', 'num'), celda('Esperado', x.esperado != null ? fmtD(x.esperado, 1) + '\u00a0%' : '—', 'num'),
            celda('Almas a los 15 min', x.almas_15min != null ? (x.almas_15min > 0 ? '+' : '') + fmt(x.almas_15min) : '—', 'num'), celda('Por qué', el('span', { class: 'pequeno sec' }, x.por_que || ''))); }))));
    const parejas = comps.mejores_parejas_de_linea || [];
    if (parejas.length) sec.append(el('h3', { class: 'sub-perfil' }, 'Mejores parejas de línea'), tablaParejas(parejas.slice(0, 4)),
      parejas.length > 4 ? plegable('parejas', `Ver ${parejas.length - 4} parejas más`, el('div', { class: 'contenido' }, tablaParejas(parejas.slice(4))), false, { marginTop: '8px' }) : null);
    if ((comps.rivales_dificiles || []).length) sec.append(el('h3', { class: 'sub-perfil' }, 'Rivales que más te cuestan'), el('div', { class: 'grid-2' }, comps.rivales_dificiles.map((x) => { const h = hDe(x.hero_id, x.nombre);
      return el('div', { class: 'tarjeta' }, el('div', { class: 'fila' }, h ? chipH(h) : el('b', null, x.nombre), el('span', { class: 'muted pequeno' }, x.sus_partidas_contra ? `te tocó en contra en ${x.sus_partidas_contra} ${x.sus_partidas_contra === 1 ? 'partida' : 'partidas'}${x.wr_contra != null ? ' · ganaste el ' + fmtPct(x.wr_contra, 0) : ''}` : 'aún no te ha tocado')),
        x.como_jugarlo ? el('p', { class: 'sec pequeno' }, x.como_jugarlo) : null,
        (x.objetos || []).length ? el('div', { class: 'fila' }, el('span', { class: 'etiqueta' }, 'Objetos'), x.objetos.map((c) => { const o = objeto(c); return o ? chipO(o) : null; })) : null); })));
    if ((comps.consejos_de_draft || []).length) sec.append(el('h3', { class: 'sub-perfil' }, 'Al elegir héroe'), el('ul', { class: 'sec pequeno lista-perfil' }, comps.consejos_de_draft.map((c) => el('li', null, c))));
    if (comps.como_leer_las_cifras) sec.append(plegable('leer-cifras', 'Cómo leer estas cifras',
      el('div', { class: 'contenido sec pequeno' }, el('p', null, comps.como_leer_las_cifras), est && est.muestra ? el('p', null, typeof est.muestra === 'string' ? est.muestra : '') : null), false, { marginTop: '12px' }));
    cont.append(sec);
  }

  // Quién te mata, contra quién y con quién juegas
  if ((p.te_matan || []).length || (p.rivales || []).length) {
    const g = el('div', { class: 'grid-3' });
    const lista = (titulo, arr, campo) => el('div', { class: 'tarjeta' }, el('h3', null, titulo), el('div', { class: 'lista-compradores' }, arr.slice(0, 8).map((x) => { const h = heroe(x.hero_id); return h ? el('div', { class: 'comprador' }, chipH(h, null, true), el('span', { class: 'pequeno sec' }, campo(x))) : null; })));
    if ((p.te_matan || []).length) g.append(lista('Quién te mata más', p.te_matan, (x) => x.veces + ' muertes'));
    if ((p.rivales || []).length) g.append(lista('Rivales más frecuentes', p.rivales, (x) => `${x.partidas} partidas · ganaste ${fmt(x.wr, 0)} %`));
    if ((p.companeros || []).length) g.append(lista('Compañeros más frecuentes', p.companeros, (x) => `${x.partidas} partidas · ganaste ${fmt(x.wr, 0)} %`));
    cont.append(seccion('perfil-rivales', 'Rivales y compañeros', g));
  }

  // Compras habituales y partidas
  if ((p.compras || []).length) cont.append(plegable('compras', 'Lo que más compras', el('div', { class: 'contenido fila' }, p.compras.slice(0, 16).map((c) => { const o = objeto(c.clase); return o ? el('span', { class: 'fila', style: { gap: '4px' } }, chipO(o), el('span', { class: 'muted pequeno num' }, `×${c.veces} · min ${fmtD(c.minuto, 1)}`)) : null; })), false));
  if ((p.partidas || []).length) {
    const tb = el('table', { class: 'tabla tabla-tarjetas' }, el('thead', null, el('tr', null, [['Fecha'], ['Héroe'], ['Resultado'], ['K / D / A', 'num'], ['Almas', 'num'], ['Duración', 'num']].map(([t, c]) => el('th', { class: c || null }, t)))));
    tb.append(el('tbody', null, p.partidas.map((x) => { const h = heroe(x.hero_id); return el('tr', null, celda('Fecha', fmtFecha(x.fecha)), celda('Héroe', h ? chipH(h, null, true) : x.hero_id), celda('Resultado', el('span', { class: 'chip ' + (x.victoria ? 'ok' : 'mal') }, x.victoria ? 'Victoria' : 'Derrota')), celda('K / D / A', `${x.k} / ${x.d} / ${x.a}`, 'num'), celda('Almas', fmt(x.almas), 'num'), celda('Duración', x.min + ' min', 'num')); })));
    cont.append(plegable('partidas', p.limitadas ? `Tus últimas ${p.partidas.length} partidas` : `Tus ${p.partidas.length} partidas`, el('div', { class: 'contenido tabla-env' }, tb), false, { marginTop: '10px' }));
  }
  if (indice.children.length < 3) indice.remove();
  cont.append(el('p', { class: 'muted pequeno', style: { marginTop: '16px' } }, 'Fuente: API pública de Deadlock (api.deadlock-api.com), la misma que usan lockbuilds y otras webs de estadísticas. Tus partidas son públicas para cualquiera que tenga tu SteamID.'));
  return cont;
}
