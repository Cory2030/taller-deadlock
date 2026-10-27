#!/usr/bin/env node
/* ============================================================
   Taller de Deadlock — variantes de build por héroe
   Reúne los análisis por héroe (<carpeta>/<hero_id>.json) en data/variantes.json:
   veredicto (la mejor en Initiate–Acolyte y en todos los rangos) y las variantes
   (arma, espíritu, vitalidad, híbrida), cada una con sus fases y su fase final.
   Valida clases de objeto, forma de las fases y límites de la fase final; quita lo que no cuadra
   y lo avisa. Las correcciones propuestas a la build base se guardan aparte para revisarlas.

   Uso: node scripts/variantes.js <carpeta_con_los_json>
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const carpeta = process.argv[2];
if (!carpeta) { console.error('Uso: node scripts/variantes.js <carpeta>'); process.exit(1); }
const leer = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const O = leer(path.join(RAIZ, 'data', 'objetos.json')); const objs = Array.isArray(O) ? O : O.objetos;
const porClase = Object.fromEntries(objs.map((o) => [o.clase, o]));
const H = leer(path.join(RAIZ, 'data', 'heroes.json')); const heroes = Array.isArray(H) ? H : H.heroes;
const avisos = []; const correcciones = {};
const aviso = (h, t) => avisos.push(`${h}: ${t}`);
const corta = (t, n) => { const s = String(t || '').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };

function limpiarEntrada(h, e, donde) {
  if (!e || !porClase[e.clase]) { aviso(h, `${donde}: objeto desconocido «${e && (e.clase || e.objeto)}», se quita`); return null; }
  const r = { ...e, objeto: porClase[e.clase].nombre };
  if (r.nota_juego && r.nota_juego.length > 120) { aviso(h, `${donde}: nota de ${r.nota_juego.length} caracteres, se recorta`); r.nota_juego = corta(r.nota_juego, 120); }
  return r;
}
function limpiarFases(h, fases, clave) {
  if (!Array.isArray(fases)) return null;
  const ORDEN = ['inicial', 'media', 'avanzada'];
  const r = fases.filter((x) => x && ORDEN.includes(x.fase)).sort((a, b) => ORDEN.indexOf(a.fase) - ORDEN.indexOf(b.fase)).map((x) => ({
    ...x,
    nucleo: (x.nucleo || []).map((e) => limpiarEntrada(h, e, `${clave}/${x.fase}/núcleo`)).filter(Boolean),
    situacionales: (x.situacionales || []).map((e) => limpiarEntrada(h, e, `${clave}/${x.fase}/situacionales`)).filter(Boolean),
  }));
  if (r.length !== 3) aviso(h, `${clave}: ${r.length} fases (se esperaban 3)`);
  return r.length ? r : null;
}
function limpiarFinal(h, fin, clave) {
  if (!fin || !Array.isArray(fin.pasos)) return null;
  const pasos = fin.pasos.filter((p) => {
    if (!p || !porClase[p.compra]) { aviso(h, `${clave}/final: compra desconocida «${p && p.compra}», se quita`); return false; }
    if (p.vende && !porClase[p.vende]) { aviso(h, `${clave}/final: venta desconocida «${p.vende}», se quita el paso`); return false; }
    return true;
  }).map((p) => ({ ...p, nota_juego: p.nota_juego && p.nota_juego.length > 120 ? corta(p.nota_juego, 120) : p.nota_juego }));
  const comp = (fin.build_completa || []).filter((c) => porClase[c]);
  if (comp.length > 12) aviso(h, `${clave}/final: build completa con ${comp.length} objetos`);
  return pasos.length ? { ...fin, titulo_categoria_juego: corta(fin.titulo_categoria_juego || 'Final · ranuras llenas', 60), descripcion_juego: corta(fin.descripcion_juego, 140), pasos, build_completa: comp } : null;
}

const salida = { generado: new Date().toISOString(), heroes: {} };
for (const h of heroes) {
  const f = path.join(carpeta, h.id + '.json');
  if (!fs.existsSync(f)) { aviso(h.nombre_en, 'sin análisis'); continue; }
  let j; try { j = leer(f); } catch (e) { aviso(h.nombre_en, 'JSON inválido: ' + e.message); continue; }
  const vistas = new Set();
  const variantes = (j.variantes || []).map((v) => {
    if (!v || !v.clave || vistas.has(v.clave)) { aviso(h.nombre_en, `variante repetida o sin clave «${v && v.clave}»`); return null; }
    vistas.add(v.clave);
    // La base puede traer sus fases corregidas (si no, se usa data/fases.json tal cual)
    const fases = v.es_base ? (Array.isArray(v.fases) && v.fases.length ? limpiarFases(h.nombre_en, v.fases, v.clave) : null) : limpiarFases(h.nombre_en, v.fases, v.clave);
    if (!v.es_base && !fases) { aviso(h.nombre_en, `variante ${v.clave} sin fases, se quita`); return null; }
    if (v.es_base && (v.correcciones_base || []).length) correcciones[h.nombre_en] = v.correcciones_base;
    return {
      clave: v.clave, nombre: v.nombre, es_base: !!v.es_base, cuando_elegirla: v.cuando_elegirla || '', datos: v.datos || null,
      estadisticas_resumen: v.estadisticas_resumen || null, para_tu_perfil: v.para_tu_perfil || '',
      titulo_build_juego: v.titulo_build_juego ? corta(v.titulo_build_juego, 70) : null, descripcion_build_juego: v.descripcion_build_juego || null,
      orden_habilidades: v.orden_habilidades || null, fases, vender: v.es_base && !fases ? null : (v.vender || []).filter((x) => x && porClase[x.clase]),
      final: limpiarFinal(h.nombre_en, v.final, v.clave), fuentes: (v.fuentes || []).filter((s) => s && (s.url || s.titulo)),
    };
  }).filter(Boolean);
  if (!variantes.some((v) => v.es_base)) aviso(h.nombre_en, 'sin variante base');
  const claves = variantes.map((v) => v.clave);
  const ver = j.veredicto || {};
  for (const k of ['mejor_tu_nivel', 'mejor_todos']) if (ver[k] && !claves.includes(ver[k])) { aviso(h.nombre_en, `veredicto ${k}=${ver[k]} no es una variante`); ver[k] = (variantes.find((v) => v.es_base) || variantes[0] || {}).clave; }
  if (variantes.length) salida.heroes[h.id] = { veredicto: ver, variantes };
}
// Dos copias por héroe (la ficha solo descarga la suya):
// - data/variantes_perfil/<id>.json: completa, con lo personal del jugador («para ti», sus datos). Privada: en .gitignore.
// - data/variantes/<id>.json: pública, sin campos personales, sin frases con datos del jugador y con
//   «tu nivel» → «Initiate–Acolyte» (la web pública la ve cualquiera).
// Reglas en orden: lo que habla de SUS datos se reescribe en genérico o se quita;
// lo que es estadística de su nivel («tus partidas», «tu nivel») pasa a nombrar el nivel.
const may = (m, c) => c.toUpperCase();
const REGLAS = [
  [/:\s*aciertas el \d+ ?%(?=\))/g, ''],
  [/con tu \d+ ?% de tiros a la cabeza/g, 'si aciertas poco a la cabeza'],
  [/\s*\([^()]*\b(?:tu punto d[eé]bil|tu perfil|tu caso|haces el 37|tu 37 ?%|tienes (?:un )?37|aciertas el \d+ ?%)[^()]*\)/gi, ''],
  [/,\s*tu punto d[eé]bil(?=[.;:)]|$)/gi, ''],
  [/Farmear la jungla es tu punto d[eé]bil: /g, 'Para farmear la jungla: '],
  [/ Es la pieza para tu punto d[eé]bil: mueres más entre los min 15 y 25\./g, ' Es la pieza para no morir entre los min 15 y 25.'],
  [/(Defensa (?:de vitalidad )?)para tu punto d[eé]bil:/g, '$1para no morir en las peleas:'],
  [/,\s*(?:lo que más te falta según tu perfil|que es lo que te falta)/g, ''],
  [/la jungla segura que te falta/g, 'la jungla segura'],
  [/recibes más daño que nadie en tus partidas, así que/g, 'si te pones delante,'],
  [/Tus muertes deciden tus partidas(?: \([^)]*\))?: (\S)/g, may],
  [/\b([Tt])us muertes\b/g, (m, t) => (t === 'T' ? 'Las' : 'las') + ' muertes'],
  [/ y tú mueres en el medio juego/g, ' y se muere en el medio juego'],
  [/tu 37 ?% de parrys acertados es tu mejor arma/g, 'un buen parry es tu mejor arma'],
  [/tienes un 37 ?% de parrys, así que rinde/g, 'rinde'],
  [/con tu 37 ?% de parrys, /g, ''],
  [/;\s*aciertas el 37 ?% de tus parrys y /g, '; '],
  [/;\s*aciertas el 37 ?% de tus parrys\./g, '.'],
  [/\s*Tú aciertas el 15 ?% a la cabeza, así que para ti rinde poco\./g, ''],
  [/^Para ti, [yo] (\S)/, may],
  [/^Para ti y para quien /, 'Para quien '],
  [/^La recomendada para ti y para cualquiera que/, 'Para cualquiera que'],
  [/^Por defecto para ti: (\S)/, may],
  [/Para ti, la de salir/g, 'Si mueres mucho, la de salir'],
  [/Para ti, que mueres más entre los min 15 y 25, no lo saltes/g, 'Si mueres entre los min 15 y 25, no lo saltes'],
  [/Para ti suma algo más/g, 'Suma algo más'],
  [/,\s*tu héroe más jugado/g, ''],
  [/en tu nivel mandan tus partidas/g, 'en Initiate–Acolyte manda el dato de ese nivel'],
  [/el dato de tus partidas/g, 'el dato de Initiate–Acolyte'],
  [/\btus partidas\b/g, 'las partidas'],
  [/\b([Ee])n tu nivel\b/g, '$1n Initiate–Acolyte'],
  [/\b([Aa]) tu nivel\b/g, (m, a) => (a === 'A' ? 'E' : 'e') + 'n Initiate–Acolyte'],
  [/\bde tu nivel\b/g, 'de Initiate–Acolyte'],
  [/\b[Tt]u nivel\b/g, 'Initiate–Acolyte'],
  // «cuando más mueres» sale de su perfil (muere más entre los min 15 y 25): en lo público, el tramo de más peleas
  [/\s*\(\d+(?:,\d+)? muertes frente a \d+(?:,\d+)? de media\)/g, ''],
  [/\s*\(de los que más te matan\)/g, ''],
  [/las peleas del medio juego, donde más mueres/g, 'las peleas del medio juego'],
  [/en las peleas en que más mueres/g, 'en las peleas'],
  [/\b(cuando|donde) más mueres\b/g, '$1 más peleas hay'],
  [/\ben (el|la) que más mueres\b/g, 'en $1 que más peleas hay'],
  [/\ben que más mueres\b/g, 'en que más peleas hay'],
];
// Red de seguridad: si tras las reglas queda algo de esto, la frase entera se quita
const PERSONAL = /más mueres|muertes frente a [0-9]+(?:,[0-9]+)? de media|más te matan|stiveeng|1096317017|9,5 en derrotas|37 ?% de parr|tu 37 ?%|haces el 37|20 ?% de precisi|aciertas el [0-9]+ ?%|tu [0-9]+ ?% de (?:tiros|parr)|tus parrys|tu perfil|tu historial|jugaste|tu caso|Tú aciertas|tus muertes|tus partidas|^Para ti[,:]|recomendada para ti|tu héroe más jugado|punto d[eé]bil (?:son|es) (?:las muertes|morir|farmear|la jungla)/i;
let cambios = 0; let frasesQuitadas = 0; const vacios = [];
function neutro(t, ruta) {
  if (typeof t !== 'string') return t;
  let s = t;
  for (const [re, por] of REGLAS) { const n = s.replace(re, por); if (n !== s) { cambios++; s = n; } }
  const frases = s.split(/(?<=[.!?])\s+/);
  const quedan = frases.filter((f) => !PERSONAL.test(f));
  frasesQuitadas += frases.length - quedan.length;
  s = quedan.join(' ').trim();
  if (!s && t.trim()) vacios.push(ruta);
  return s;
}
const NO_PUBLICOS = new Set(['para_tu_perfil', 'recomendada_para_ti', 'por_que_para_ti', 'encaje_heroe']);
function publico(v, ruta) {
  if (typeof v === 'string') return neutro(v, ruta);
  if (Array.isArray(v)) return v.map((x, i) => publico(x, ruta + '[' + i + ']'));
  if (v && typeof v === 'object') { const r = {}; for (const [k, x] of Object.entries(v)) if (!NO_PUBLICOS.has(k)) r[k] = /^(clase|vende|compra|en_lugar_de|url|clave|fase)$/.test(k) ? x : publico(x, ruta + '.' + k); return r; }
  return v;
}
const DIR = path.join(RAIZ, 'data', 'variantes'); const DIRP = path.join(RAIZ, 'data', 'variantes_perfil');
for (const d of [DIR, DIRP]) { fs.mkdirSync(d, { recursive: true }); for (const f of fs.readdirSync(d)) if (f.endsWith('.json')) fs.unlinkSync(path.join(d, f)); }
for (const [id, v] of Object.entries(salida.heroes)) {
  fs.writeFileSync(path.join(DIRP, id + '.json'), JSON.stringify({ generado: salida.generado, ...v }));
  fs.writeFileSync(path.join(DIR, id + '.json'), JSON.stringify({ generado: salida.generado, ...publico(v, id) }));
}
// Copia privada en un solo archivo, para el Artifact (no admite tantos archivos)
fs.writeFileSync(path.join(RAIZ, 'data', 'variantes_perfil.json'), JSON.stringify({ generado: salida.generado, heroes: salida.heroes }));
console.log(`Versión pública: ${cambios} reescrituras, ${frasesQuitadas} frases personales quitadas, ${vacios.length} textos que se quedaban vacíos${vacios.length ? ': ' + vacios.slice(0, 12).join(', ') : ''}`);
const residuo = []; for (const f of fs.readdirSync(DIR)) { const s = fs.readFileSync(path.join(DIR, f), 'utf8'); if (/stiveeng|1096317017|9,5 en derrotas|37 ?% de parr|37 ?% de tus parr|aciertas el 37|tu 37 ?%|tu perfil|tu caso|tus muertes|tus partidas|tu nivel|para_tu_perfil|recomendada_para_ti|por_que_para_ti|encaje_heroe/i.test(s)) residuo.push(f); }
if (residuo.length) console.log('OJO: quedan marcas personales en ' + residuo.join(', '));
if (fs.existsSync(path.join(RAIZ, 'data', 'variantes.json'))) fs.unlinkSync(path.join(RAIZ, 'data', 'variantes.json'));
fs.writeFileSync(path.join(carpeta, '_correcciones_base.json'), JSON.stringify(correcciones, null, 1));
fs.writeFileSync(path.join(carpeta, '_avisos.txt'), avisos.join('\n'));
const n = Object.keys(salida.heroes).length;
const nv = Object.values(salida.heroes).reduce((s, x) => s + x.variantes.length, 0);
console.log(`data/variantes/<id>.json: ${n} héroes, ${nv} variantes · ${avisos.length} avisos · correcciones a la base en ${Object.keys(correcciones).length} héroes`);
