#!/usr/bin/env node
/**
 * integrar.js — Convierte los archivos de investigación (guías por héroe, meta de la comunidad,
 * fichas de objetos, composiciones, parches) en los JSON que lee la web:
 *   data/guias.json, data/meta.json, data/objetos_guia.json, data/comps.json, data/parche.json
 *
 * Uso: node scripts/integrar.js <carpeta_investigacion>
 * La carpeta debe contener heroes_lote1_v2.json … (o heroes_loteN.json), meta_comunidad.json,
 * meta_stats.json, objetos.json, composiciones.json y, opcionalmente, parche.json.
 * Los archivos de data/ que ya existan se conservan si no hay fuente nueva.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DATA = path.join(RAIZ, 'data');
const ORIGEN = process.argv[2];
if (!ORIGEN || !fs.existsSync(ORIGEN)) { console.error('Uso: node scripts/integrar.js <carpeta_investigacion>'); process.exit(1); }

const leer = (n) => { const p = path.join(ORIGEN, n); if (!fs.existsSync(p)) return null; try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { console.warn('JSON inválido:', n, e.message); return null; } };
const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const heroes = JSON.parse(fs.readFileSync(path.join(DATA, 'heroes.json'), 'utf8'));
const objetos = JSON.parse(fs.readFileSync(path.join(DATA, 'objetos.json'), 'utf8'));
const heroPorNombre = {}; for (const h of heroes) { heroPorNombre[sinAcentos(h.nombre)] = h; heroPorNombre[sinAcentos(h.nombre_en)] = h; heroPorNombre[String(h.id)] = h; }
const objPorNombre = {}; for (const o of objetos) { objPorNombre[sinAcentos(o.nombre)] = o; objPorNombre[sinAcentos(o.nombre_es)] = o; objPorNombre[o.clase] = o; }
const ALIAS_HEROE = { 'mo and krill': 'mo & krill', 'mo&krill': 'mo & krill', 'doorman': 'the doorman', 'vyper': 'vyper', 'baba yaga': 'baba', 'grey talon': 'grey talon', 'lady geist': 'lady geist', 'geist': 'lady geist', 'nurse harrow': 'nurse harrow', 'harrow': 'nurse harrow', 'rat king': 'rat king', 'deadman danny': 'deadman danny', 'danny': 'deadman danny' };
function buscarHeroe(n) { if (n == null) return null; if (typeof n === 'object') n = n.id || n.heroe || n.nombre; let k = sinAcentos(n); k = ALIAS_HEROE[k] || k; return heroPorNombre[k] || null; }
function buscarObjeto(n) { if (!n) return null; if (typeof n === 'object') n = n.clase || n.objeto || n.nombre; let k = sinAcentos(n); if (objPorNombre[k]) return objPorNombre[k]; k = k.replace(/^upgrade_/, ''); const cand = objetos.find((o) => sinAcentos(o.nombre).replace(/[^a-z0-9]/g, '') === k.replace(/[^a-z0-9]/g, '')); return cand || null; }
const avisos = [];

/* ---------- Limpieza de textos para el lector (jerga de la investigación, nombres viejos, líneas) ---------- */
const REEMPLAZOS = [
  [/\s*\((?:ver|véase) dudas\)/gi, ''],
  [/\(?\bmin_average_badge\s*=\s*\d+\)?/g, ''], [/\(?\bmin_matches\s*=\s*\d+\)?/g, ''], [/\bmin_unix_timestamp\s*=?\s*[\w<>]*/g, ''],
  [/\bhero-(?:counter|synergy|comb)-stats\b/g, 'estadísticas de la API'], [/\bability-(?:order|max-first)-(?:stats|tree)\b/g, 'estadísticas de habilidades de la API'],
  [/\bpopular_items\b/g, 'objetos populares de la API'], [/\/?v1\/(?:assets|analytics)\/[\w/{}-]*/g, 'la API'], [/\bby-hero-id\b/g, 'la API'],
  [/`?(?:items_detalle|items_lista|heroes_lista|items_ids)\.txt`?/g, 'la lista de objetos del parche'],
  [/\bdel lote\b/g, 'entre los héroes comparados'], [/\bde los cuatro\b/g, 'del grupo comparado'], [/\bdel grupo de cuatro\b/g, 'del grupo comparado'],
  [/\b(?:Re)?verificad[oa] el \d{1,2}[-/ ](?:\w{3,}|\d{2})[-/ ]\d{4}(?: con)?/g, 'Comprobado con'], [/\(?\bal reverificar\b\)?/g, ''],
  [/Kudzu Bomb/g, 'Entangling Thorns'], [/Watcher'?s Covenant/g, 'Kudzu Connection'], [/Conjure Dragon/g, 'Bookwyrm'], [/Defend and Fight!?/g, 'Plot Armor'], [/Flying Strike/g, 'Flying Slash'],
  [/Armor Piercing Rounds/g, 'Armor Piercer'], [/\bBackstabber\b/g, 'Stalker'],
  [/l[ií]nea solitaria\s*\(offlane\)/gi, 'línea sin compañero cerca'], [/l[ií]nea solitaria/gi, 'línea sin compañero cerca'], [/\bsolo lane\b/gi, 'línea sin compañero'], [/\bofflane\b/gi, 'línea lateral'], [/\ben solitario\b/gi, 'sin compañero cerca'],
  [/\s{2,}/g, ' '], [/\s+([,.;:])/g, '$1'], [/\(\s*\)/g, ''],
];
function limpiarTexto(s) { let t = String(s); for (const [re, rep] of REEMPLAZOS) t = t.replace(re, rep); return t.trim(); }
function limpiarObjeto(o, saltar = ['url', 'clase', 'id', 'tipo']) {
  if (Array.isArray(o)) return o.map((x) => limpiarObjeto(x, saltar));
  if (o && typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) r[k] = saltar.includes(k) ? v : limpiarObjeto(v, saltar); return r; }
  if (typeof o === 'string') return limpiarTexto(o);
  return o;
}
/* Acentos para textos escritos sin tildes (meta de la comunidad) */
const TILDES = ['más', 'espíritu', 'daño', 'regeneración', 'según', 'fácil', 'fáciles', 'también', 'útil', 'útiles', 'posición', 'héroe', 'héroes', 'votación', 'reducción', 'duración', 'línea', 'líneas', 'categoría', 'difícil', 'difíciles', 'rápido', 'rápida', 'rápidos', 'máximo', 'máxima', 'mínimo', 'número', 'información', 'así', 'día', 'días', 'último', 'última', 'últimos', 'únicos', 'único', 'única', 'práctica', 'energía', 'salió', 'cayó', 'subió', 'bajó', 'táctica', 'tácticas', 'físico', 'ráfaga', 'ráfagas', 'básico', 'básica', 'crítico', 'críticos', 'economía', 'mecánica', 'mecánicas', 'límite', 'versión', 'acción', 'protección', 'curación', 'además', 'después', 'todavía', 'aquí', 'compañero', 'compañeros', 'año', 'años', 'pequeño', 'pequeña', 'señal', 'sólido', 'sólida', 'fácilmente', 'rápidamente', 'automático', 'automática', 'estratégico', 'específico', 'específica', 'frágil', 'frágiles', 'difícilmente', 'cómodo', 'cómoda', 'débil', 'débiles', 'móvil', 'móviles', 'tiradores', 'alcance', 'teléfono', 'párrafo', 'análisis', 'crítica', 'táctico', 'ágil', 'ágiles', 'definitiva', 'penalización', 'explosión', 'explosiones', 'presión', 'rotación', 'rotaciones', 'iniciación', 'resistencia', 'ralentización', 'inmovilización', 'curación', 'sanación', 'rendimiento', 'estadística', 'estadísticas', 'mecánicamente', 'jugándolo', 'escalado', 'teletransporte', 'habilidad', 'púa', 'cañón', 'cañones', 'melé', 'lánzate', 'elección', 'selección', 'razón', 'razones', 'desventaja', 'inútil', 'lógica', 'técnica', 'técnicas', 'fáciles', 'inmóvil', 'frío', 'baño', 'niño', 'muñeca', 'bajón', 'subidón', 'aún', 'mí', 'sí', 'qué', 'cómo', 'cuándo', 'dónde', 'cuánto', 'cuánta', 'cuántos', 'quién'];
const MAPA_TILDES = Object.fromEntries(TILDES.map((w) => [w.normalize('NFD').replace(/[̀-ͯ]/g, ''), w]));
const RE_TILDES = new RegExp('\\b(' + Object.keys(MAPA_TILDES).filter((w) => !['si', 'mi', 'que', 'como', 'cuando', 'donde', 'cuanto', 'cuanta', 'cuantos', 'quien', 'aun', 'mas', 'bajo', 'ano', 'anos'].includes(w)).join('|') + ')\\b', 'gi');
function acentuar(s) { return String(s).replace(RE_TILDES, (m) => { const w = MAPA_TILDES[m.toLowerCase()]; return m[0] === m[0].toUpperCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w; }).replace(/\bmas (?=(?:de|que|alto|alta|bajo|baja|fuerte|rapido|rápido|lento|facil|fácil|dificil|difícil|util|útil|popular|jugado|jugada|baneado|baneada|daño|dano|vida|espiritu|espíritu|presencia|consistente|seguro|segura|movilidad|control|burst))/gi, (m) => (m[0] === 'M' ? 'Más ' : 'más ')).replace(/\bdano\b/gi, (m) => (m[0] === 'D' ? 'Daño' : 'daño')); }
function acentuarObjeto(o, saltar = ['url', 'clase', 'id', 'heroe', 'titulo', 'autor']) {
  if (Array.isArray(o)) return o.map((x) => acentuarObjeto(x, saltar));
  if (o && typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) r[k] = saltar.includes(k) ? v : acentuarObjeto(v, saltar); return r; }
  if (typeof o === 'string') return acentuar(o);
  return o;
}

/* ---------- Guías por héroe ---------- */
const guias = {}; let lotes = 0;
for (let n = 1; n <= 20; n++) {
  const j = leer(`heroes_lote${n}_v2.json`) || leer(`heroes_lote${n}.json`); if (!j) continue; lotes++;
  for (const g of j.heroes || []) {
    const h = buscarHeroe(g.id) || buscarHeroe(g.nombre); if (!h) { avisos.push('Héroe no reconocido en lote ' + n + ': ' + g.nombre); continue; }
    const conv = (arr, campo) => (arr || []).map((e) => { const o = buscarObjeto(e.objeto || e.clase || e.nombre); if (!o) { avisos.push(`${h.nombre_en}: objeto no reconocido "${e.objeto || e.clase || e.nombre}"`); return null; } return { clase: o.clase, objeto: o.nombre, [campo]: e[campo] || e.por_que || e.cuando || '' }; }).filter(Boolean);
    const convH = (arr) => (arr || []).map((e) => { const o = buscarHeroe(e.heroe || e); if (!o) { avisos.push(`${h.nombre_en}: héroe no reconocido "${e.heroe || e}"`); return null; } return { id: o.id, heroe: o.nombre_en, por_que: e.por_que || '' }; }).filter(Boolean);
    // Normalizar "linea": tipo (duo | solo | ambas) + explicación
    const lineaRaw = String(g.linea || '').trim();
    const mTipo = lineaRaw.match(/^(duo|dúo|solo|ambas|ambos)\b/i);
    const linea_tipo = mTipo ? (/^d/i.test(mTipo[1]) ? 'duo' : /^s/i.test(mTipo[1]) ? 'solo' : 'ambas') : '';
    const linea_texto = lineaRaw.replace(/^(duo|dúo|solo|ambas|ambos)\b\s*[—–\-+;:.()]*\s*/i, '').replace(/^\(?(?:prefiere|preferencia)[^)]*\)?\s*[:;.-]?\s*/i, (m) => m).trim();
    // Separar las notas de verificación del resto de notas
    const notasRaw = String(g.notas || '');
    const iVer = notasRaw.search(/VERIFICACI[ÓO]N\s*\(/i);
    const notas = iVer >= 0 ? notasRaw.slice(0, iVer).trim() : notasRaw.trim();
    const notas_verificacion = iVer >= 0 ? notasRaw.slice(iVer).trim() : '';
    guias[h.id] = limpiarObjeto(Object.assign({}, g, {
      id: h.id, nombre: h.nombre_en, linea_tipo, linea_texto, notas, notas_verificacion,
      build: g.build ? { inicio: conv(g.build.inicio, 'por_que'), medio: conv(g.build.medio, 'por_que'), final: conv(g.build.final, 'por_que'), situacionales: conv(g.build.situacionales, 'cuando') } : null,
      counters: convH(g.counters), sinergias: convH(g.sinergias),
      arquetipo_principal: ['arma', 'espiritu', 'vitalidad', 'hibrido'].includes(sinAcentos(g.arquetipo_principal)) ? sinAcentos(g.arquetipo_principal) : 'hibrido',
      arquetipos_alternativos: (g.arquetipos_alternativos || []).map((a) => ({ tipo: sinAcentos(a.tipo), cuando: a.cuando || '' })).filter((a) => ['arma', 'espiritu', 'vitalidad', 'hibrido'].includes(a.tipo)),
    }));
  }
}
if (lotes) { fs.writeFileSync(path.join(DATA, 'guias.json'), JSON.stringify({ generado: new Date().toISOString(), heroes: guias })); console.log(`guias.json: ${Object.keys(guias).length} héroes de ${lotes} lotes`); }

/* ---------- Meta de la comunidad ---------- */
const mc = leer('meta_comunidad.json');
if (mc) {
  const consenso = (mc.consenso || []).map((c) => { const h = buscarHeroe(c.heroe); if (!h) { avisos.push('meta: héroe no reconocido ' + c.heroe); return null; } const tier = (String(c.tier || '').toUpperCase().match(/[SABCD]/) || ['B'])[0]; return { id: h.id, heroe: h.nombre_en, tier, coincidencias: c.coincidencias || 0, por_que: acentuar(limpiarTexto(c.por_que || '')) }; }).filter(Boolean);
  const lista = (arr) => (arr || []).map((x) => { const h = buscarHeroe(x.heroe || x); return h ? { id: h.id, heroe: h.nombre_en, por_que: acentuar(limpiarTexto(x.por_que || '')) } : null; }).filter(Boolean);
  const ms = leer('meta_stats.json');
  const meta = { fecha: mc.fecha || new Date().toISOString().slice(0, 10), parche: mc.parche || (ms && ms.parche) || '', fuentes: (mc.fuentes || []).map((f) => ({ titulo: f.titulo, autor: f.autor, url: f.url, fecha: f.fecha })), consenso, principiantes: lista(mc.principiantes), mas_baneados: lista(mc.mas_baneados), cambios_recientes: acentuar(limpiarTexto(mc.cambios_recientes || '')) };
  if (ms) meta.stats_externas = { fecha: ms.fecha, parche: ms.parche, regla: ms.regla };
  fs.writeFileSync(path.join(DATA, 'meta.json'), JSON.stringify(meta)); console.log(`meta.json: ${consenso.length} héroes en el consenso, ${meta.fuentes.length} fuentes`);
}

/* ---------- Fichas de objetos ---------- */
const oj = leer('objetos.json');
if (oj && oj.objetos) {
  const fichas = {}; let noRec = 0;
  for (const f of oj.objetos) { const o = buscarObjeto(f.nombre || f.clase); if (!o) { noRec++; avisos.push('objeto no reconocido: ' + (f.nombre || f.clase)); continue; } fichas[o.clase] = { resumen: f.resumen || '', para_que: f.para_que || '', etiquetas: (f.etiquetas || []).map((t) => sinAcentos(t).replace(/\s+/g, '_')), contra: f.contra || '', mejora_de: f.mejora_de || '', popularidad: f.popularidad || '' }; }
  fs.writeFileSync(path.join(DATA, 'objetos_guia.json'), JSON.stringify({ generado: new Date().toISOString(), objetos: fichas })); console.log(`objetos_guia.json: ${Object.keys(fichas).length} fichas (${noRec} no reconocidas)`);
}

/* ---------- Composiciones ---------- */
const cj = leer('composiciones.json');
if (cj) {
  const ids = (arr) => (arr || []).map((x) => { const h = buscarHeroe(x); if (!h) avisos.push('comps: héroe no reconocido ' + x); return h ? h.id : null; }).filter(Boolean);
  const comps = {
    fecha: cj.fecha || '',
    mapa_y_lineas: 'En el mapa actual (The Cursed Apple, tres carriles: York, Broadway y Greenwich) las tres líneas se juegan 2 contra 2, así que cada composición se reparte en tres parejas. Estas composiciones de seis héroes vienen de guías, torneos y de las estadísticas de sinergia de la API; cada una explica cómo se reparten las líneas, el plan de juego y por qué funciona.',
    arquetipos: (cj.arquetipos || []).map((a) => ({ nombre: limpiarTexto(a.nombre || ''), descripcion: limpiarTexto(a.descripcion || ''), heroes_ids: ids(a.heroes) })),
    duo_lanes: (cj.duo_lanes || []).map((d) => ({ heroes_ids: ids(d.heroes), por_que: limpiarTexto(d.por_que || '') })).filter((d) => d.heroes_ids.length === 2),
    solo_lane: (cj.solo_lane || []).map((s) => { const h = buscarHeroe(s.heroe); return h ? { id: h.id, heroe: h.nombre_en, por_que: limpiarTexto(String(s.por_que || '').replace(/\b(laner|carry) solitari[oa]\b/gi, '$1 que gana su línea').replace(/\bsolitari[oa]s?\b/gi, 'por sí mismo')) } : null; }).filter(Boolean),
    composiciones: (cj.composiciones || []).map((c) => ({ nombre: c.nombre, heroes_ids: ids(c.heroes), lineas: limpiarTexto(c.lineas || ''), plan: limpiarTexto(c.plan || ''), por_que: limpiarTexto(c.por_que || ''), nivel: c.nivel || '' })).filter((c) => c.heroes_ids.length >= 5),
    reglas: (cj.reglas || []).map((r) => limpiarTexto(String(r))), fuentes: cj.fuentes || [],
  };
  fs.writeFileSync(path.join(DATA, 'comps.json'), JSON.stringify(comps)); console.log(`comps.json: ${comps.composiciones.length} composiciones, ${comps.duo_lanes.length} parejas`);
}

/* ---------- Parches (si hay archivo) ---------- */
const pj = leer('parche.json');
if (pj) { fs.writeFileSync(path.join(DATA, 'parche.json'), JSON.stringify(pj)); console.log('parche.json copiado'); }
const sj = leer('sistemas.json');
if (sj) { fs.writeFileSync(path.join(DATA, 'sistemas.json'), JSON.stringify(sj)); console.log('sistemas.json copiado'); }

if (avisos.length) { console.log('\nAvisos (' + avisos.length + '):'); for (const a of [...new Set(avisos)].slice(0, 80)) console.log(' -', a); }
