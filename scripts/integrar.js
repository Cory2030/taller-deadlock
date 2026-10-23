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
  // Jerga técnica de la API y coordenadas internas: no aportan nada al lector
  [/\s*\((?:[^()]*?\b(?:API|bridge_buffs|initial_spawn_time|spawn_interval|expiration|hits_required|duration|loot_list_deck_size|generic-data|objective_params|rejuv_params|left_relative|top_relative|mapa_api|misc_entities|citadel_[a-z_]+|npc-units)\b[^()]*)\)/g, ''],
  [/\s*\(altura ~?\d+\)/g, ''], [/,?\s*en x \d+,\d+;? y \d+,\d+/g, ''], [/\s*\(x \d+,\d+\)/g, ''], [/\s*\(bridge_buffs\[\d\]\)/g, ''],
  // Coordenadas sueltas del minimapa: el mapa ya marca el sitio
  [/\s*\(\s*x\s*0[.,]\d+\s*;\s*y\s*0[.,]\d+\s*\)/g, ''], [/\s*\(0[.,]\d+\s*;\s*0[.,]\d+\)/g, ''],
  [/[^.]*\[no verificado\][^.]*\.\s*/g, ''], [/\s*\[no verificado\]/g, ''],
  // Citas de fuentes a mitad de frase (las fuentes ya se listan aparte)
  [/\((?:según|confirmado en) (?:la )?(?:wiki|tracklock(?:\.gg)?),\s*/gi, '('], [/\s*\((?:según |confirmado en )?(?:la )?(?:wiki|tracklock(?:\.gg)?)\)/gi, ''],
  [/,?\s*según (?:la )?wiki\b/gi, ''],
  // Creadores de contenido citados a mitad de frase: se quita el nombre sin romper la frase
  [/la guía(?: de la comunidad)? y SN\|P3R lo compran/g, 'las guías de la comunidad lo compran'],
  [/\((Lockbuilds|Cashcoryy|Eido|SN\|P3R|lomein|Shiere|carcosa):\s*/g, '('], [/\b(?:Lockbuilds|Cashcoryy|Eido|SN\|P3R)\s+lo considera\b/g, 'se considera'],
  [/\b(?:Lockbuilds|Cashcoryy|Eido|SN\|P3R)\s+vende\b/g, 'hay quien vende'],
  [/,?\s*según (?:Lockbuilds|Cashcoryy|Eido|SN\|P3R)\b/g, ''], [/\s+de (?:Lockbuilds|Cashcoryy|Eido|SN\|P3R)\b/g, ''], [/\s*\((?:Lockbuilds|Cashcoryy|Eido|SN\|P3R)\)/g, ''],
  [/\b(?:Lockbuilds|Cashcoryy|Eido|SN\|P3R):\s*/g, ''],
  [/\bVariante (?:de )?(?:Eido|SN\|P3R|Cashcoryy|Lockbuilds)\b/g, 'Variante'],
  // Cifras de otra fuente: se dice que son de otras estadísticas (la ficha de datos es de los últimos 14 días, todos los rangos)
  [/\b[Ll]a guía(?: de la comunidad)?(?:,? con datos de Phantom\+,)? le da ([\d,]+)\s?% de (?:victorias|wr|winrate)/g, 'en otras estadísticas gana el $1 %'],
  [/\ben Phantom\+/g, 'en rango Phantom o superior'], [/\bde Phantom\+/g, 'de rango Phantom o superior'], [/\bPhantom\+/g, 'rango Phantom o superior'],
  // Paréntesis que solo citan una fuente, un creador o un rango alto (otra población que la de la ficha de datos)
  [/\s*\([^()]*\b(?:tracklock(?:\.gg)?|Phantom\+|Cashcoryy|SN\|P3R|Eido|lomein|BeepBeepBilly|Saiah|p2mg|Shiere|carcosa|deadlockhandbook(?:\.com)?|consejo de)\b[^()]*\)/gi, ''],
  [/\ben [A-Z][\w|]+ y tracklock(?:\.gg)? es núcleo\b/g, 'es núcleo en las builds más jugadas'],
  [/,?\s*(?:en|de|según) (?:la (?:mejor )?(?:build|guía)[^,.;()]*? de )?tracklock(?:\.gg)?\b/gi, ''], [/\btracklock(?:\.gg)?\b/gi, 'las estadísticas de la comunidad'],
  [/\bdeadlockhandbook\.com\b[^.;]*[.;]?/gi, ''],
  [/,?\s*la guía (?:de la comunidad )?le da [\d,]+\s?% de victorias[^.;,)]*/gi, ''],
  [/\bLa guía (?:de la comunidad )?(?:del mapa )?(la|lo|los|las) recomienda\b/g, 'Se recomienda'], [/\bla guía (?:de la comunidad )?(?:del mapa )?(la|lo|los|las) recomienda\b/g, 'se recomienda'],
  [/\(la guía:\s*/gi, '('], [/,?\s*según la guía\b/gi, ''], [/\bla guía\b(?! de la comunidad)/g, 'la guía de la comunidad'], [/\bLa guía\b(?! de la comunidad)/g, 'La guía de la comunidad'],
  // Tipos de mejora de puente de las 10:00: lo dice la wiki, la API da el mismo peso a los cuatro
  [/\((?:salen )?(?:los )?(?:2|dos) tipos que (?:no salieron|faltaron|faltaban)(?: a las 5:00)?\)/g, '(suelen salir los 2 tipos que no salieron a las 5:00; sin confirmar)'],
  [/\(si a las 5:00 no salió (\w+), sale ahora\)/g, '(si a las 5:00 no salió $1, suele salir ahora)'], [/\((\w+) si no salió a las 5:00\)/g, '(suele salir $1 si no salió a las 5:00)'],
  // "Tu puente" depende de la base
  [/\(a la derecha de tu minimapa\)/g, '(el derecho si juegas abajo; el izquierdo si juegas arriba)'],
  [/tu puente es el derecho \(~14 s desde tu Guardián de Greenwich\)/g, 'tu puente es el derecho si juegas abajo (~14 s desde Greenwich) o el izquierdo si juegas arriba (~14 s desde York)'],
  [/\ben la API\b/g, 'en partidas reales'], [/\bComprobado con la API\.?\s*/g, ''],
  [/\s*\(página [^)]*wiki[^)]*\)/gi, ''], [/\s*\(o \d+ s según otra página de la wiki\)/gi, ''],
  [/\b[\w-]+\.(?:md|json)\b,?\s*/g, ''],
  // "(3 Mano Oculta II, 204 base)": almas base del campamento
  [/\b(\d{2,4}) base\b(?! de)/g, '$1 almas de base'],
  // Formato: decimales con coma, miles sin "k", ordinales, % de victorias
  [/(\d+)[.,](\d)k\b/g, (m, a, b) => (+a * 1000 + +b * 100).toLocaleString('es-ES').replace(/^(\d)(\d{3})$/, '$1.$2')], [/(\d+)k\b/g, (m, a) => (+a * 1000).toLocaleString('es-ES').replace(/^(\d)(\d{3})$/, '$1.$2')],
  [/\b(min\.? ?|minuto )(\d+)\.(\d)(?!\d)/g, '$1$2,$3'], [/(\d)\.(\d)(?=\s?%)/g, '$1,$2'], [/(\d)\.(\d)(?= ?min\b)/g, '$1,$2'], [/\b(el|al|del|hacia el|sobre el) (\d{1,2})\.(\d)\b(?!\d)/g, '$1 $2,$3'],
  // "WR bajo", "WR del 58 %"… → frases naturales (antes de la regla general de WR)
  [/\b(?:WR|[Ww]inrate) (?:bajo|baja)\b/g, 'gana poco'], [/\b(?:WR|[Ww]inrate) (?:medio|media)\b/g, 'gana lo normal'], [/\b(?:WR|[Ww]inrate) (?:global )?del? ([\d,]+\s?%)/g, 'gana el $1'], [/\b(?:WR|[Ww]inrate) global ([\d,]+\s?%)/g, 'gana el $1 en general'],
  [/(^|[.!?]\s+)(gana|porcentaje)\b/g, (m, p, w) => p + w[0].toUpperCase() + w.slice(1)],
  [/(\d)ª/g, '$1.ª'], [/\bde wr\b/gi, 'de victorias'], [/\bWR\b/g, 'porcentaje de victorias'], [/(\d)\s?%\s+de\s+winrate\b/gi, '$1 % de victorias'], [/\bwinrate\b/gi, 'porcentaje de victorias'],
  [/(\d)\s?%\s+(?:de\s+)?porcentaje de victorias/g, '$1 % de victorias'], [/%\s+% de victorias/g, '% de victorias'],
  // Términos unificados en toda la web
  [/\bPelea [Cc]allejera\b/g, 'Street Brawl'], [/\bulti\b/g, 'definitiva'], [/\bult\b/g, 'definitiva'], [/\bUlti?\b/g, 'Definitiva'],
  [/\bziplines\b/gi, 'tirolinas'], [/\bzipline\b/gi, 'tirolina'],
  // (esbirros → troopers: mismo género, así no se rompe la concordancia)
  [/\bultis\b|\bults\b/g, 'definitivas'], [/\besbirros\b/g, 'troopers'], [/\besbirro\b/g, 'trooper'], [/\bEsbirros\b/g, 'Troopers'],
  [/(\d+(?:,\d)?)\s?% de pick\b/g, 'lo compra el $1 %'], [/\bbuffs\b/g, 'mejoras'], [/\bbuff\b/g, 'mejora'], [/\bpor boon\b/g, 'por mejora'],
  // Redundancias que dejó la sustitución de nombres de campamento
  [/(Guardián de (York|Broadway|Greenwich)) en \2\b/g, '$1'],
  [/\(([^:()]+): Sinner's Sacrifice o ([^:()]+): Sinner's Sacrifice\)/g, "(el Sinner's de $1 o el de $2)"],
  [/:,\s/g, ': '],
  // Rutas "de arriba" que no existen como tales: la web tiene el selector de base
  [/\s*\(rutas (?:york|broadway|greenwich)_arriba_\*\)/g, ''],
  [/\((\d{3})\)(?=\s+cae)/g, '($1 almas de base)'],
  [/\s{2,}/g, ' '], [/\s+([,.;:])/g, '$1'], [/\(\s*\)/g, ''], [/(?<!\.)\.\.(?!\.)/g, '.'], [/…\./g, '…'],
  // Espacio duro antes de % para que no se separe del número
  [/(\d) ?%/g, '$1\u00a0%'],
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

/* Listas de héroes citadas en los textos de un objeto ("para héroes de arma (Paige, Seven, Rem)") contrastadas con
   los datos reales: fuera los que lo compran en menos del 3 % de sus partidas; si quedan menos de dos, los que más lo compran.
   No toca las listas de rivales ("contra Haze, Vindicta…"). */
let COMPRAS_HEROES = {};
try { COMPRAS_HEROES = JSON.parse(fs.readFileSync(path.join(DATA, 'compras.json'), 'utf8')).heroes || {}; } catch (e) { /* sin datos */ }
function pickDe(h, clase) { const d = ((COMPRAS_HEROES[h.id] || {}).objetos || {})[clase]; return d && d.pick != null ? d.pick : 0; }
function filtrarHeroesCitados(texto, clase) {
  if (!texto || !clase) return texto;
  return String(texto).replace(/\(([^()]+)\)/g, (m, dentro, pos, todo) => {
    const tokens = dentro.split(/,\s*|\s+y\s+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length < 2) return m;
    const hs = tokens.map((t) => buscarHeroe(t)); if (hs.some((h) => !h)) return m; // no es una lista de héroes
    if (/contra|rival|enemig|frente a|counter|castiga/i.test(todo.slice(Math.max(0, pos - 80), pos))) return m;
    let quedan = hs.filter((h) => pickDe(h, clase) >= 3);
    if (quedan.length < 2) {
      const top = heroes.filter((h) => pickDe(h, clase) >= 3).sort((a, b) => pickDe(b, clase) - pickDe(a, clase)).slice(0, 4);
      if (top.length >= 2) quedan = top;
    }
    if (!quedan.length) return '';
    return '(' + quedan.map((h) => h.nombre_en).join(', ') + ')';
  });
}

/* ---------- Fichas de objetos ---------- */
const oj = leer('objetos.json');
if (oj && oj.objetos) {
  const fichas = {}; let noRec = 0;
  for (const f of oj.objetos) { const o = buscarObjeto(f.nombre || f.clase); if (!o) { noRec++; avisos.push('objeto no reconocido: ' + (f.nombre || f.clase)); continue; } fichas[o.clase] = limpiarObjeto({ resumen: f.resumen || '', para_que: filtrarHeroesCitados(f.para_que || '', o.clase), etiquetas: (f.etiquetas || []).map((t) => sinAcentos(t).replace(/\s+/g, '_')), contra: f.contra || '', mejora_de: f.mejora_de || '', popularidad: f.popularidad || '' }, ['url', 'clase', 'id', 'tipo', 'etiquetas']); }
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

/* ---------- Cuándo comprar cada objeto (objetos_cuando_<ranura>.json) → objetos_guia.json ---------- */
{
  const rutaGuia = path.join(DATA, 'objetos_guia.json');
  const guiaObj = fs.existsSync(rutaGuia) ? JSON.parse(fs.readFileSync(rutaGuia, 'utf8')) : { objetos: {} };
  let n = 0;
  for (const ranura of ['weapon', 'vitality', 'spirit']) {
    const j = leer(`objetos_cuando_${ranura}.json`); if (!j) continue;
    for (const f of j.objetos || []) {
      const o = buscarObjeto(f.nombre || f.clase); if (!o) { avisos.push('cuando: objeto no reconocido ' + (f.nombre || f.clase)); continue; }
      const ficha = guiaObj.objetos[o.clase] || (guiaObj.objetos[o.clase] = {});
      Object.assign(ficha, limpiarObjeto({ fase: f.fase || '', cuando: filtrarHeroesCitados(f.cuando || '', o.clase), senales: f.senales || [], no_comprar_si: f.no_comprar_si || '', vender: f.vender || '', nota_juego: String(f.nota_juego || '').slice(0, 160) }));
      n++;
    }
  }
  if (n) { guiaObj.generado = new Date().toISOString(); fs.writeFileSync(rutaGuia, JSON.stringify(guiaObj)); console.log(`objetos_guia.json: cuándo comprar añadido a ${n} objetos`); }
}

/* ---------- Builds por fase + plan de mapa (fases_loteN_v2.json) → fases.json ---------- */
{
  const salida = {}; let lotesF = 0;
  // Nombres internos de campamentos (dept_store_camp…) → nombre legible, en los textos del plan de mapa
  const mmNombres = (leer('mapa_mecanicas.json') || {}).campamentos || [];
  const idsCamp = mmNombres.filter((c) => c.id && c.nombre).sort((a, b) => b.id.length - a.id.length);
  const altIds = idsCamp.map((c) => c.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  // En los textos, el nombre sin su aclaración entre paréntesis ("Autoridad Portuaria (pequeño, junto a…)" → "Autoridad Portuaria")
  const nombreDeId = Object.fromEntries(idsCamp.map((c) => [c.id, String(c.nombre).replace(/\s*\([^)]*\)\s*$/, '')]));
  // Identificadores de ruta (york_abajo_media…) → "ruta media de York"
  const SUFIJO_RUTA = { temprana: 'temprana', media: 'media', walker: 'del Walker', puente: 'del puente', oeste: 'oeste', este: 'este', campanario: 'del campanario', capilla: 'de la capilla', exterior: 'exterior', obra: 'de la obra' };
  const nombreRuta = (carril, lado, suf) => `ruta ${SUFIJO_RUTA[suf] || suf} de ${carril[0].toUpperCase() + carril.slice(1)}${lado === 'arriba' ? ' (base arriba)' : ''}`;
  const conNombres = (o) => {
    if (Array.isArray(o)) return o.map((x) => conNombres(x));
    if (o && typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) r[k] = ['campamento', 'ruta_id', 'tipo', 'carril'].includes(k) ? v : conNombres(v); return r; }
    if (typeof o === 'string' && altIds) {
      return o
        .replace(new RegExp('\\s*\\(\\s*`?(?:' + altIds + ')`?\\s*\\)', 'g'), '')           // "(dept_store_camp)" → nada
        .replace(new RegExp('\\(\\s*`?(?:' + altIds + ')`?\\s*[,;]\\s*', 'g'), '(')         // "(id, pegado a…)" → "(pegado a…)"
        .replace(new RegExp('`?\\b(' + altIds + ')\\b`?', 'g'), (m, id) => nombreDeId[id] || id) // resto → nombre legible
        .replace(/`?\b(york|broadway|greenwich)_(abajo|arriba)_([a-z]+)\b`?/g, (m, c, l, s) => nombreRuta(c, l, s))
        .replace(/\b(rutas?) ruta (?=\S)/gi, '$1 ').replace(/(^|[.!?:]\s+)ruta /g, '$1Ruta ')
        .replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1');
    }
    return o;
  };
  // Datos reales de compra por héroe (scripts/compras.js): para no repetir en el texto lo que ya dice la ficha de datos
  let comprasH = {};
  try { comprasH = JSON.parse(fs.readFileSync(path.join(DATA, 'compras.json'), 'utf8')).heroes || {}; } catch (e) { /* sin datos de compra */ }
  const dec1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const PCT = '[\\s\\u00a0]?%';
  const sinDatoRepetido = (t, d) => {
    let s = String(t || '');
    if (!s) return s;
    // "Dato real: min 5,8 con ~3.500 almas, 33 % de sus partidas, 48,4 % de victorias" → "Con él gana el 48,4 %" (el % de victorias es lo único que no está en la ficha)
    s = s.replace(new RegExp('Dato real: min [\\d.,]+ con ~?[\\d.]+ almas, [\\d.,]+' + PCT + ' de sus partidas, ([\\d.,]+)' + PCT + ' de victorias', 'g'), (m, w) => 'Con él gana el ' + (d && d.wr != null ? dec1(d.wr) : w) + ' %');
    // "(79 %; 51,7 % de victorias)" con el pick del héroe: el % de victorias tiene que ser el suyo
    if (d && d.wr != null && d.pick != null) s = s.replace(new RegExp('\\((\\d+(?:,\\d)?)' + PCT + '; ([\\d,]+)' + PCT + ' de victorias\\)', 'g'), (m, p, w) => Math.abs(parseFloat(p.replace(',', '.')) - d.pick) <= 2 ? `(${p} %; ${dec1(d.wr)} % de victorias)` : m);
    s = s.replace(new RegExp('[;:,]?\\s*en partidas reales (?:se compra )?hacia el min [\\d.,]+(?: con ~?[\\d.]+(?: almas)?)?(?:\\s*\\([^)]*\\))?', 'g'), '');
    s = s.replace(/\s*\(en partidas reales[^)]*\)/g, '');
    s = s.replace(/(^|[.;:]\s*)en partidas reales se vende/g, (m, p) => p + (/[.]\s*$|^$/.test(p) ? 'Se vende' : 'se vende'));
    s = s.replace(/\s+([,.;:])/g, '$1').replace(/([;:,])\s*\./g, '.').replace(/(?<!\.)\.\.(?!\.)/g, '.').replace(/\s{2,}/g, ' ').trim();
    return s;
  };
  // Nombres del juego de las mejoras de puente → los de la web (Arma, Supervivencia, Lanzamiento, Movimiento)
  const PUENTE_ES = (o) => {
    if (Array.isArray(o)) return o.map(PUENTE_ES);
    if (o && typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) r[k] = ['tipo', 'ruta_id', 'campamento', 'carril'].includes(k) ? v : PUENTE_ES(v); return r; }
    if (typeof o !== 'string') return o;
    return o.replace(/\bCasting\b/g, 'Lanzamiento').replace(/\bGun\b/g, 'Arma').replace(/\bSurvival\b/g, 'Supervivencia').replace(/\bMovement\b/g, 'Movimiento')
      // En el plan de mapa, "Habilidades" con mayúscula es siempre el tipo de mejora de puente
      .replace(/\bHabilidades\b/g, 'Lanzamiento');
  };
  const normFase = (f) => { const s = sinAcentos(f); return /inic|linea|early|tempr/.test(s) ? 'inicial' : /avanz|final|late|tard/.test(s) ? 'avanzada' : 'media'; };
  const normTipo = (t) => { const s = sinAcentos(t); return /arma|gun/.test(s) ? 'arma' : /super|vida|surviv/.test(s) ? 'supervivencia' : /habil|espir|cast/.test(s) ? 'habilidades' : /movil|movement|movim/.test(s) ? 'movilidad' : s; };
  for (let n = 1; n <= 20; n++) {
    const j = leer(`fases_lote${n}_v2.json`) || leer(`fases_lote${n}.json`); if (!j) continue; lotesF++;
    for (const x of j.heroes || []) {
      const h = buscarHeroe(x.id) || buscarHeroe(x.nombre); if (!h) { avisos.push('fases: héroe no reconocido ' + x.nombre); continue; }
      const item = (e, extra) => { const o = buscarObjeto(e.objeto || e.clase); if (!o) { avisos.push(`fases ${h.nombre_en}: objeto no reconocido "${e.objeto || e.clase}"`); return null; } return Object.assign({ clase: o.clase, objeto: o.nombre }, extra); };
      const fases = (x.fases || []).map((f) => ({
        // "(~5.800 almas)" en el objetivo son almas acumuladas, no lo que se paga en objetos (la cabecera)
        fase: normFase(f.fase), minutos: f.minutos || '', objetivo: String(f.objetivo || '').replace(/\(~([\d.]+) almas\)/g, '(~$1 almas acumuladas)'),
        titulo_categoria_juego: f.titulo_categoria_juego || '', titulo_situacionales_juego: f.titulo_situacionales_juego || '',
        nucleo: (f.nucleo || []).map((e) => item(e, { orden: e.orden || null, cuando: e.cuando || '', por_que: e.por_que || '', nota_juego: e.nota_juego || '' })).filter(Boolean),
        situacionales: (f.situacionales || []).map((e) => { const r = e.reemplaza ? buscarObjeto(e.reemplaza) : null; return item(e, { cuando: e.cuando || '', reemplaza: r ? r.clase : (e.reemplaza || ''), por_que: e.por_que || '', nota_juego: e.nota_juego || '' }); }).filter(Boolean),
      }));
      const orden = { inicial: 0, media: 1, avanzada: 2 }; fases.sort((a, b) => orden[a.fase] - orden[b.fase]);
      // Textos: sin el dato real repetido (ya sale en la ficha de datos) y con el % de victorias del propio héroe
      const ch = (comprasH[h.id] || {}).objetos || {};
      for (const f of fases) for (const e of [...f.nucleo, ...f.situacionales]) for (const k of ['cuando', 'por_que']) e[k] = sinDatoRepetido(e[k], ch[e.clase]);
      // Un situacional "inicial" que con este héroe se compra pasado el min 15 va a la fase media
      const ini = fases.find((f) => f.fase === 'inicial'), med = fases.find((f) => f.fase === 'media');
      if (ini && med) ini.situacionales = ini.situacionales.filter((e) => {
        const d = ch[e.clase]; if (!d || d.min == null || d.min <= 15) return true;
        if (!med.situacionales.some((y) => y.clase === e.clase) && !med.nucleo.some((y) => y.clase === e.clase)) med.situacionales.push(e);
        avisos.push(`fases ${h.nombre_en}: ${e.objeto} pasa de situacional inicial a media (min real ${d.min})`);
        return false;
      });
      const pm = x.plan_mapa ? PUENTE_ES(conNombres(x.plan_mapa)) : null;
      // "(dato real)", "real min"… en la cronología y en «Qué vender»: jerga de la investigación
      const sinJergaReal = (t) => String(t || '').replace(/\s*\(dato real\)/g, '').replace(/\((?:[Dd]ato real):?\s*/g, '(media ').replace(/\breal min\b/g, 'media min')
        .replace(/;\s*dato real:? ([\d,]+)\.?$/g, '; de media se vende hacia el min $1.')
        .replace(/\b[Ee]n partidas reales se vende\b/g, (m) => (m[0] === 'E' ? 'De media se vende' : 'de media se vende')).replace(/\s{2,}/g, ' ');
      if (pm && Array.isArray(pm.cronologia)) for (const c of pm.cronologia) c.accion = sinJergaReal(c.accion);
      if (Array.isArray(x.vender)) for (const v of x.vender) v.cuando = sinJergaReal(v.cuando);
      // Las notas de ruta traen "Con la Archmother: ruta X (base arriba)": sobra, la web tiene selector de base
      if (pm && pm.jungla && Array.isArray(pm.jungla.rutas)) for (const r of pm.jungla.rutas) if (r.nota) r.nota = String(r.nota)
        .replace(/\s*(?:Con la Archmother|En la Archmother|Si juegas arriba|Equipo de arriba|Para el equipo de arriba|Arriba(?: es (?:York|Greenwich|Broadway))?)[:,][^.]*\.?/g, '').trim();
      if (pm && Array.isArray(pm.mejoras_puente)) pm.mejoras_puente = pm.mejoras_puente.map((m) => ({ ...m, tipo: normTipo(m.tipo) }));
      salida[h.id] = limpiarObjeto({
        id: h.id, nombre: h.nombre_en, titulo_build_juego: x.titulo_build_juego || '', descripcion_build_juego: conNombres(x.descripcion_build_juego || ''),
        fases: conNombres(fases), vender: conNombres((x.vender || []).map((v) => item(v, { cuando: v.cuando || '' })).filter(Boolean)), plan_mapa: pm,
      }, ['url', 'clase', 'id', 'tipo', 'ruta_id', 'campamento', 'carril', 'fase', 'reemplaza']);
    }
  }
  if (lotesF) { fs.writeFileSync(path.join(DATA, 'fases.json'), JSON.stringify({ generado: new Date().toISOString(), heroes: salida })); console.log(`fases.json: ${Object.keys(salida).length} héroes de ${lotesF} lotes`); }
}

/* ---------- Mapa: mecánicas + campamentos con posición + puntos + rutas → mapa.json ---------- */
/** Quita de los textos del mapa las dudas entre fuentes (se quedan en el apartado de fuentes y dudas, que no se muestra) */
function limpiarMapa(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/\bla API \(([^)]*)\) da\b/g, 'los datos de partidas ($1) dan')
    .replace(/\s*\([^()]*(?:la wiki|la API|no confirmado|no se sabe|sin confirmar cuál)[^()]*\)/gi, '')
    .replace(/[^.]*\b(?:[Ll]a wiki (?:habla|dice)|la API (?:lista|da|dice))\b[^.]*\.\s*/g, '')
    .replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
}
function limpiarMapaObjeto(o, saltar = ['fuentes', 'dudas', 'id', 'url']) {
  if (Array.isArray(o)) return o.map((x) => limpiarMapaObjeto(x, saltar));
  if (o && typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) r[k] = saltar.includes(k) ? v : limpiarMapaObjeto(v, saltar); return r; }
  return limpiarMapa(o);
}
{
  const mm = leer('mapa_mecanicas.json'); const ma = leer('mapa_api.json');
  if (mm && ma) {
    const r4 = (v) => Math.round(v * 10000) / 10000;
    const info = Object.fromEntries((mm.campamentos || []).map((c) => [c.id, c]));
    const campamentos = (ma.neutral_camps || []).map((c) => { const i = info[c.name] || {}; return limpiarObjeto({ id: c.name, tipo: c.kind, x: r4(c.left_relative), y: r4(c.top_relative), nombre: i.nombre || c.name, distrito: i.distrito || '', carril: i.carril || '', lado: i.lado || '', aparece: i.aparece || '', reaparece: i.reaparece || '',
      // "543 base (3 × …) → ~590 al aparecer (8:00), ~602 a los 10 min…" → solo lo que se cobra
      // "3 máquinas × (310 + 3,35/min): ~1.011 a las 8:00…" → solo lo que se cobra
      almas_aprox: String(i.almas_aprox || '').split('→').pop().replace(/^[^:]*×[^:]*:\s*/, '').trim(), composicion: limpiarMapa(i.composicion || ''),
      nota: limpiarMapa(c.kind === 'weak' ? String(i.nota || '').replace(/\s*Ataque especial de los medianos\/grandes:[^.]*\.?/g, '') : i.nota || ''),
      espejo: i.equivalente_otro_lado || '' }, ['id', 'tipo', 'espejo']); });
    const ids = new Set(campamentos.map((c) => c.id));
    const P = (arr) => (arr || []).map((p) => ({ x: r4(p.left_relative), y: r4(p.top_relative) }));
    const E = ma.entities || {};
    const rutas = (mm.rutas || []).map((r) => ({ ...r, pasos: (r.pasos || []).filter((p) => { const ok = ids.has(p.campamento); if (!ok) avisos.push(`ruta ${r.id}: campamento inexistente ${p.campamento}`); return ok; }) })).filter((r) => r.pasos.length);
    const mecanicas = { ...mm }; delete mecanicas.campamentos; delete mecanicas.rutas;
    // Textos de la investigación que citan sus fuentes a mitad de frase: versión corta para la web
    if (mecanicas.mejoras_puente) {
      const mp = mecanicas.mejoras_puente = { ...mecanicas.mejoras_puente };
      mp.como_coger = 'Con un golpe pesado (cuerpo a cuerpo cargado). La puede coger cualquiera de los dos equipos y basta un golpe.';
      mp.aparecen = 'A las 5:00 sale la primera (una en cada puente, a la vez) y luego cada 5 minutos exactos: 10:00, 15:00, 20:00… Si la coges a las 14:55, a las 15:00 ya sale otra.';
    }
    const mecLimpias = limpiarMapaObjeto(limpiarObjeto(mecanicas));
    // Zonas con más cajas: identificadores internos de campamento → nombre legible
    const nombreCamp = (id) => { const i = info[id] || info[id + '_camp'] || info[String(id).replace(/_\d+$/, '')]; return i && i.nombre ? String(i.nombre).replace(/\s*\([^)]*\)\s*$/, '') : ''; };
    if (mecLimpias.cajas && Array.isArray(mecLimpias.cajas.zonas_densas)) for (const z of mecLimpias.cajas.zonas_densas) {
      z.zona = String(z.zona || '').replace(/\b([a-z]+(?:_[a-z0-9]+)+)\b/g, (m, id) => nombreCamp(id))
        .replace(/\(\s*\)/g, '').replace(/\s*\(\s*([^()]*?)\s*\)/g, (m, x) => (x ? ' (' + x + ')' : '')).replace(/\b(junto a|entre)\s+(?=[,)]|y\b)/g, '').replace(/\s{2,}/g, ' ').replace(/\s+([,)])/g, '$1').trim();
      // "(Tejado del Haunted Lot)" detrás de "Tejado del Haunted Lot junto a York": sobra
      const base = z.zona.split('(')[0];
      z.zona = z.zona.replace(/\s*\(([^()]+)\)/g, (m, x) => (base.includes(x.split(':')[0].trim()) ? '' : m));
    }
    // Títulos de las fuentes de la API: la limpieza de jerga los dejaba en "Deadlock API: la API…"
    const TITULO_API = [[/assets\/map/, 'mapa (campamentos, puentes, cajas)'], [/misc-entities/, 'entidades del mapa (mejoras, urna, grietas)'], [/generic-data/, 'datos generales del juego'], [/npc-units/, 'PNJ y campamentos en español'], [/version|build/, 'versión del cliente']];
    for (const f of mecLimpias.fuentes || []) if (/deadlock-api\.com/.test(f.url || '')) { const t = TITULO_API.find(([re]) => re.test(f.url)); f.titulo = 'Deadlock API: ' + (t ? t[1] : 'datos del juego'); }
    const mapa = {
      generado: new Date().toISOString(), mecanicas: mecLimpias, campamentos, rutas: limpiarMapaObjeto(limpiarObjeto(rutas, ['id', 'campamento', 'carril']), ['id', 'campamento', 'carril']),
      puntos: { puentes: P(E.bridge_buffs), urna: P(E.soul_urn_spawns), entregas_urna: P(E.soul_urn_pads), grietas: P(E.unstable_rifts), tiendas: P(E.shops), contenedores: P(E.golden_statues), cajas_duras: P(E.tough_crates), teletransportes: P(E.teleporters) },
      objetivos: ma.objective_positions || {},
    };
    fs.writeFileSync(path.join(DATA, 'mapa.json'), JSON.stringify(mapa)); console.log(`mapa.json: ${campamentos.length} campamentos, ${rutas.length} rutas`);
  }
}

/* ---------- Parches (si hay archivo) ---------- */
const pj = leer('parche.json');
if (pj) { fs.writeFileSync(path.join(DATA, 'parche.json'), JSON.stringify(pj)); console.log('parche.json copiado'); }
const sj = leer('sistemas.json');
if (sj) { fs.writeFileSync(path.join(DATA, 'sistemas.json'), JSON.stringify(sj)); console.log('sistemas.json copiado'); }

/* ---------- Correcciones a mano (scripts/correcciones.json) ---------- */
{
  const rutaC = path.join(__dirname, 'correcciones.json');
  const corr = fs.existsSync(rutaC) ? JSON.parse(fs.readFileSync(rutaC, 'utf8')) : {};
  for (const [archivo, cambios] of Object.entries(corr)) {
    if (archivo.startsWith('_')) continue;
    const ruta = path.join(DATA, archivo); if (!fs.existsSync(ruta)) { avisos.push('corrección: no existe data/' + archivo); continue; }
    const datos = JSON.parse(fs.readFileSync(ruta, 'utf8')); let n = 0;
    // En una lista, un tramo no numérico elige el elemento por id, clase, fase o nombre (más estable que la posición).
    // El valor puede ser el texto nuevo o { "de": "trozo", "a": "nuevo trozo" } para cambiar solo una parte.
    const paso = (o, p) => { if (o == null) return undefined; if (Array.isArray(o) && !/^\d+$/.test(p)) return o.find((x) => x && (x.id === p || x.clase === p || x.fase === p || x.nombre === p || x.fuente === p)); return o[p]; };
    for (const [camino, valor] of Object.entries(cambios)) {
      const partes = camino.split('.'); let o = datos;
      for (const p of partes.slice(0, -1)) o = paso(o, p);
      const ultimo = partes[partes.length - 1];
      if (o == null || !(ultimo in o)) { avisos.push(`corrección sin destino en ${archivo}: ${camino}`); continue; }
      if (valor && typeof valor === 'object' && 'de' in valor) {
        if (!String(o[ultimo]).includes(valor.de)) { avisos.push(`corrección: no aparece «${String(valor.de).slice(0, 50)}» en ${archivo}: ${camino}`); continue; }
        o[ultimo] = String(o[ultimo]).split(valor.de).join(valor.a);
      } else o[ultimo] = valor;
      n++;
    }
    if (n) { fs.writeFileSync(ruta, JSON.stringify(datos)); console.log(`correcciones: ${n} en ${archivo}`); }
  }
}

if (avisos.length) { console.log('\nAvisos (' + avisos.length + '):'); for (const a of [...new Set(avisos)].slice(0, 80)) console.log(' -', a); }
