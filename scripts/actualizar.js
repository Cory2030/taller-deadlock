#!/usr/bin/env node
/**
 * actualizar.js — Descarga los datos del parche actual de Deadlock desde la API pública
 * (api.deadlock-api.com, sin clave) y genera los archivos de /data que usa la web.
 *
 * Uso:  node scripts/actualizar.js            (todo: datos + imágenes nuevas)
 *       node scripts/actualizar.js --sin-imagenes
 *       node scripts/actualizar.js --rapido   (omite builds de la comunidad)
 *
 * Requiere Node 18 o superior. No necesita dependencias.
 */
const fs = require('fs');
const path = require('path');

const API = 'https://api.deadlock-api.com';
const RAIZ = path.join(__dirname, '..');
const DATA = path.join(RAIZ, 'data');
const IMG = path.join(RAIZ, 'assets', 'img');
const args = new Set(process.argv.slice(2));
const SIN_IMAGENES = args.has('--sin-imagenes');
const RAPIDO = args.has('--rapido');
const AHORA = Math.floor(Date.now() / 1000);
const DIA = 86400;

const BRACKETS = [
  { clave: 'todos', nombre: 'Todos los rangos', min: null },
  // badge = tier × 10 + subrango: Oracle I = 81, Phantom I = 91, Ascendant I = 101
  { clave: 'oracle', nombre: 'Oracle o superior', min: 81 },
  { clave: 'phantom', nombre: 'Phantom o superior', min: 91 },
  { clave: 'ascendant', nombre: 'Ascendant y Eternus', min: 101 },
];
const VENTANAS = [
  { clave: '7d', nombre: 'Últimos 7 días', dias: 7 },
  { clave: '30d', nombre: 'Últimos 30 días', dias: 30 },
];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function getJSON(url, intentos = 4) {
  for (let i = 1; i <= intentos; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'deadlock-guia-es/1.0' } });
      if (r.status === 503 || r.status === 429) {
        const espera = parseInt(r.headers.get('retry-after') || '5', 10) * 1000;
        log(`  ${r.status} en ${url.slice(API.length)} — espero ${espera / 1000}s`);
        await dormir(Math.min(espera, 60000));
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === intentos) throw new Error(`${url}: ${e.message}`);
      await dormir(1500 * i);
    }
  }
}

async function descargar(url, destino) {
  if (SIN_IMAGENES || !url) return null;
  if (fs.existsSync(destino) && fs.statSync(destino).size > 0) return destino;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, buf);
    return destino;
  } catch (e) {
    log('  imagen fallida', url, e.message);
    return null;
  }
}

/** Convierte el HTML de la API (svg, img, spans) en texto con marcas {{Clase|texto}} */
function limpiarTexto(html) {
  if (!html) return '';
  return String(html)
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<img[^>]*>/g, '')
    .replace(/<span class="inline-attribute-label ([A-Za-z_]+)">([^<]*)<\/span>/g, '{{$1|$2}}')
    .replace(/<span class="inline-attribute ([A-Za-z_]+)">([^<]*)<\/span>/g, '{{$1|$2}}')
    .replace(/<span class="diminish">([\s\S]*?)<\/span>/g, '($1)')
    .replace(/<span class="highlight">([\s\S]*?)<\/span>/g, '**$1**')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** Propiedades con valor distinto de 0, con etiqueta y sufijo */
function propiedades(props) {
  const out = {};
  for (const [k, p] of Object.entries(props || {})) {
    if (!p || p.value === undefined) continue;
    const v = num(p.value);
    if (v === null || v === 0) continue;
    out[k] = { v, etiqueta: p.label || k, sufijo: p.postfix || '' };
  }
  return out;
}

function pct(a, b) { return b ? Math.round((1000 * a) / b) / 10 : null; }

async function main() {
  fs.mkdirSync(DATA, { recursive: true });
  const version = { generado: new Date().toISOString(), fuente: API };

  // ---------- 1. Héroes (ES + EN) ----------
  log('Héroes…');
  const heroesES = await getJSON(`${API}/v1/assets/heroes?only_active=true&language=spanish`);
  const heroesEN = await getJSON(`${API}/v1/assets/heroes?only_active=true&language=english`);
  const enPorId = Object.fromEntries(heroesEN.map((h) => [h.id, h]));
  const armas = await getJSON(`${API}/v1/assets/items/by-type/weapon?language=spanish`);
  const armaPorClase = Object.fromEntries(armas.map((w) => [w.class_name, w]));
  const clienteVersion = await getJSON(`${API}/v1/assets/client-versions`).catch(() => null);
  if (Array.isArray(clienteVersion) && clienteVersion.length) version.cliente = clienteVersion[clienteVersion.length - 1];

  const heroes = [];
  const habilidades = {};
  for (const h of heroesES) {
    const en = enPorId[h.id] || {};
    const clase = h.class_name.replace(/^hero_/, '');
    const st = h.starting_stats || {};
    const g = (k) => (st[k] ? st[k].value : null);
    const arma = armaPorClase[(h.items || {}).weapon_primary] || {};
    const wi = arma.weapon_info || {};
    const clip = wi.clip_size || null;
    const balas = wi.bullets || 1;
    const bulletDmg = wi.bullet_damage || null;
    const ciclo = wi.cycle_time || null;
    const burst = wi.burst_shot_count || 1;
    let dps = null;
    if (bulletDmg && wi.bullets_per_second) dps = Math.round(bulletDmg * wi.bullets_per_second * 10) / 10;
    else if (bulletDmg && ciclo) dps = Math.round((bulletDmg * balas * burst) / ciclo * 10) / 10;
    const dpsRecarga = bulletDmg && wi.bullets_per_second_with_reload ? Math.round(bulletDmg * wi.bullets_per_second_with_reload * 10) / 10 : null;
    const niveles = Object.entries(h.level_info || {}).map(([n, l]) => ({
      nivel: parseInt(n, 10), souls: l.required_gold || 0,
      da: (l.bonus_currencies || []).includes('EAbilityPoints') ? 'ap' : (l.bonus_currencies || []).includes('EAbilityUnlocks') ? 'desbloqueo' : (l.bonus_currencies || []).length ? 'otro' : 'stats',
    })).sort((a, b) => a.nivel - b.nivel);
    const slu = h.standard_level_up_upgrades || {};
    const hero = {
      id: h.id, clase, nombre: h.name, nombre_en: en.name || h.name, buscar: (h.search_name || h.name).toLowerCase(),
      tipo: h.hero_type || '', arma_tipo: h.gun_tag || '', etiquetas: h.tags || [], complejidad: h.complexity || null,
      color: (h.colors && h.colors.style_hex) || null,
      rol: (h.description || {}).role || '', estilo: (h.description || {}).playstyle || '', historia: (h.description || {}).lore || '',
      rol_en: (en.description || {}).role || '', estilo_en: (en.description || {}).playstyle || '',
      imagen: { icono: `assets/img/heroes/${clase}_sm.webp`, carta: `assets/img/heroes/${clase}_card.webp`, minimapa: `assets/img/heroes/${clase}_mm.webp` },
      imagen_url: { icono: h.images && h.images.icon_image_small_webp, carta: h.images && h.images.icon_hero_card_webp, minimapa: h.images && h.images.minimap_image_webp },
      stats: {
        vida: g('max_health'), regen: g('base_health_regen'), velocidad: g('max_move_speed'), sprint: g('sprint_speed'),
        estamina: g('stamina'), melee_ligero: g('light_melee_damage'), melee_pesado: g('heavy_melee_damage'),
        poder_arma: g('weapon_power'), dash_suelo: g('ground_dash_distance_in_meters'), dash_aire: g('air_dash_distance_in_meters'),
      },
      arma: {
        nombre: arma.name || '', dano_bala: bulletDmg, balas_por_disparo: balas, rafaga: burst, cadencia: ciclo ? Math.round((1 / ciclo) * 100) / 100 : null,
        cargador: clip, dps, dps_con_recarga: dpsRecarga, recarga: wi.reload_duration || null, disparos_por_segundo: wi.shots_per_second || null, zoom: !!wi.can_zoom,
        alcance_caida_inicio: wi.damage_falloff_start_range ? Math.round(wi.damage_falloff_start_range / 39.37) : null,
        alcance_caida_fin: wi.damage_falloff_end_range ? Math.round(wi.damage_falloff_end_range / 39.37) : null,
      },
      por_nivel: {
        vida: slu.MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL || 0, dano_bala: Math.round((slu.MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL || 0) * 1000) / 1000,
        melee: slu.MODIFIER_VALUE_BASE_MELEE_DAMAGE_FROM_LEVEL || 0, espiritu: slu.MODIFIER_VALUE_TECH_POWER || 0,
      },
      niveles,
      habilidades_clave: [h.items.signature1, h.items.signature2, h.items.signature3, h.items.signature4],
      populares: null,
    };
    // popular_items (API: early/mid/late con pick% y winrate%)
    if (h.popular_items) {
      const conv = (arr) => (arr || []).map((x) => ({ clase: x.class_name, pick: Math.round(x.pick_pct * 10) / 10, wr: Math.round(x.winrate_pct * 10) / 10 }))
        .sort((a, b) => b.pick - a.pick);
      hero.populares = { fecha: h.popular_items.timestamp, inicio: conv(h.popular_items.early_game), medio: conv(h.popular_items.mid_game), final: conv(h.popular_items.late_game) };
    }
    heroes.push(hero);
    await descargar(hero.imagen_url.icono, path.join(IMG, 'heroes', `${clase}_sm.webp`));
    await descargar(hero.imagen_url.carta, path.join(IMG, 'heroes', `${clase}_card.webp`));
    await descargar(hero.imagen_url.minimapa, path.join(IMG, 'heroes', `${clase}_mm.webp`));
  }
  heroes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  log(`  ${heroes.length} héroes`);

  // ---------- 2. Habilidades por héroe ----------
  log('Habilidades…');
  const abilitiesEN = await getJSON(`${API}/v1/assets/items/by-type/ability?language=english`);
  const enAbil = Object.fromEntries(abilitiesEN.map((a) => [a.class_name, a]));
  for (const hero of heroes) {
    const lista = await getJSON(`${API}/v1/assets/items/by-hero-id/${hero.id}?language=spanish`);
    const porClase = Object.fromEntries(lista.map((a) => [a.class_name, a]));
    habilidades[hero.id] = hero.habilidades_clave.map((clase, i) => {
      const a = porClase[clase] || {};
      const d = a.description || {};
      const props = propiedades(a.properties);
      const importantes = [];
      for (const sec of ((a.tooltip_details || {}).info_sections || [])) {
        for (const blk of sec.properties_block || []) for (const p of blk.properties || []) {
          const k = p.important_property; if (k && props[k] && !importantes.includes(k)) importantes.push(k);
        }
      }
      const en = enAbil[clase] || {}; const dEn = en.description || {};
      const etiquetaProp = (prop) => ((a.properties || {})[prop] || {}).label || ((en.properties || {})[prop] || {}).label || prop.replace(/([a-z])([A-Z])/g, '$1 $2');
      const sufijoProp = (prop) => ((a.properties || {})[prop] || {}).postfix || '';
      const textoDesdeCambios = (cambios) => (cambios || []).map((c) => { const b = String(c.bonus); const signo = /^[-+]/.test(b) ? '' : '+'; const suf = /[a-z%]$/i.test(b) ? '' : sufijoProp(c.prop); return `${signo}${b}${suf} ${etiquetaProp(c.prop)}`; }).join(', ');
      const mejoras = (a.upgrades || []).map((u, ti) => {
        const cambios = (u.property_upgrades || []).map((pu) => ({ prop: pu.name, bonus: pu.bonus }));
        let texto = ti === 0 ? '' : limpiarTexto(ti === 1 ? d.t2_desc : d.t3_desc) || limpiarTexto(ti === 1 ? dEn.t2_desc : dEn.t3_desc);
        if (!texto) texto = textoDesdeCambios(cambios); // la API no trae texto para ese nivel: lo componemos
        return { nivel: ti + 1, coste_pa: [1, 2, 5][ti], texto, cambios };
      });
      const nombreEN = en.name || '';
      return {
        id_api: a.id, clase, indice: i + 1, tecla: ['1', '2', '3', '4'][i], nombre: a.name || clase, nombre_en: nombreEN,
        tipo: a.ability_type || (i === 3 ? 'ultimate' : 'signature'),
        descripcion: limpiarTexto(d.desc) || limpiarTexto(dEn.desc), resumen: limpiarTexto(d.quip) || limpiarTexto(dEn.quip),
        enfriamiento: props.AbilityCooldown ? props.AbilityCooldown.v : null,
        cargas: props.AbilityCharges ? props.AbilityCharges.v : null,
        duracion: props.AbilityDuration ? props.AbilityDuration.v : null,
        alcance: props.AbilityCastRange ? props.AbilityCastRange.v : null,
        importantes: importantes.map((k) => ({ clave: k, etiqueta: props[k].etiqueta, valor: props[k].v, sufijo: props[k].sufijo })),
        mejoras,
        imagen: `assets/img/abilities/${clase}.webp`, imagen_url: a.image_webp || a.image,
      };
    });
    for (const ab of habilidades[hero.id]) await descargar(ab.imagen_url, path.join(IMG, 'abilities', `${ab.clase}.webp`));
    await dormir(60);
  }

  // ---------- 3. Objetos ----------
  log('Objetos…');
  const itemsES = await getJSON(`${API}/v1/assets/items/by-type/upgrade?language=spanish`);
  const itemsEN = await getJSON(`${API}/v1/assets/items/by-type/upgrade?language=english`);
  const enItem = Object.fromEntries(itemsEN.map((i) => [i.class_name, i]));
  const objetos = [];
  for (const it of itemsES) {
    if (!it.shopable || it.disabled) continue;
    const en = enItem[it.class_name] || {};
    const d = it.description || {}; const dEn = en.description || {};
    const props = propiedades(it.properties);
    const stats = Object.entries(props).filter(([k]) => !/^Ability(Cooldown|Duration|CastRange|UnitTargetLimit|CastDelay|ChannelTime|Charges|CooldownBetweenCharge)$/.test(k))
      .map(([k, p]) => ({ clave: k, etiqueta: p.etiqueta, valor: p.v, sufijo: p.sufijo }));
    objetos.push({
      id: it.id, clase: it.class_name, nombre: en.name || it.name, nombre_es: it.name,
      ranura: it.item_slot_type, tier: it.item_tier, coste: it.cost, activo: !!it.is_active_item, activacion: it.activation || '',
      imbuir: !!it.imbue, componente: (it.component_items && it.component_items[0]) || null,
      enfriamiento: props.AbilityCooldown ? props.AbilityCooldown.v : null, duracion: props.AbilityDuration ? props.AbilityDuration.v : null,
      stats,
      descripcion: limpiarTexto(d.desc), activa: limpiarTexto(d.active), pasiva: limpiarTexto(d.passive),
      descripcion_en: limpiarTexto(dEn.desc), activa_en: limpiarTexto(dEn.active), pasiva_en: limpiarTexto(dEn.passive),
      imagen: `assets/img/items/${it.class_name}.webp`, imagen_url: it.shop_image_webp || it.shop_image || it.image_webp,
    });
  }
  objetos.sort((a, b) => (a.ranura > b.ranura ? 1 : a.ranura < b.ranura ? -1 : 0) || a.tier - b.tier || a.coste - b.coste || a.nombre.localeCompare(b.nombre));
  for (const o of objetos) await descargar(o.imagen_url, path.join(IMG, 'items', `${o.clase}.webp`));
  log(`  ${objetos.length} objetos comprables`);

  // ---------- 4. Rangos ----------
  const ranksRaw = await getJSON(`${API}/v1/assets/ranks`);
  const rangos = [];
  for (const r of ranksRaw) {
    rangos.push({ tier: r.tier, nombre: r.name, badge_min: r.tier * 10 + 1, imagen: `assets/img/ranks/rank${String(r.tier).padStart(2, '0')}.webp` });
    await descargar(r.images && (r.images.small_webp || r.images.large_webp), path.join(IMG, 'ranks', `rank${String(r.tier).padStart(2, '0')}.webp`));
  }

  // ---------- 5. Estadísticas por héroe (ventanas x brackets) ----------
  log('Estadísticas de héroes…');
  const stats = { generado: version.generado, brackets: BRACKETS, ventanas: VENTANAS, datos: {} };
  const heroPorId = Object.fromEntries(heroes.map((h) => [h.id, h]));
  for (const v of VENTANAS) {
    stats.datos[v.clave] = {};
    for (const b of BRACKETS) {
      const q = new URLSearchParams({ min_unix_timestamp: String(AHORA - v.dias * DIA) });
      if (b.min) q.set('min_average_badge', String(b.min));
      const filas = await getJSON(`${API}/v1/analytics/hero-stats?${q}`);
      const total = filas.reduce((s, r) => s + r.matches, 0);
      const partidas = Math.round(total / 12);
      const lista = filas.filter((r) => heroPorId[r.hero_id]).map((r) => ({
        id: r.hero_id, partidas: r.matches, wr: pct(r.wins, r.matches), pick: partidas ? Math.round((1000 * r.matches) / partidas) / 10 : null,
        kda: r.total_deaths ? Math.round(((r.total_kills + r.total_assists) / r.total_deaths) * 100) / 100 : null,
        kills: r.matches ? Math.round((10 * r.total_kills) / r.matches) / 10 : null,
        muertes: r.matches ? Math.round((10 * r.total_deaths) / r.matches) / 10 : null,
        asistencias: r.matches ? Math.round((10 * r.total_assists) / r.matches) / 10 : null,
        dano: r.matches ? Math.round(r.total_player_damage / r.matches) : null,
        souls: r.matches ? Math.round(r.total_net_worth / r.matches) : null,
        precision: r.total_shots_hit + r.total_shots_missed ? pct(r.total_shots_hit, r.total_shots_hit + r.total_shots_missed) : null,
        wins: r.wins,
      }));
      // Tier por winrate suavizado (Bayes, k=400 partidas al 50 %, como deadlocktiers) y bandas de desviación típica
      const K = 400;
      for (const h of lista) { h.wr_ajustado = Math.round((1000 * (h.wins + K * 0.5)) / (h.partidas + K)) / 10; delete h.wins; }
      const vals = lista.map((h) => h.wr_ajustado);
      const media = vals.reduce((a, c) => a + c, 0) / (vals.length || 1);
      const sd = Math.sqrt(vals.reduce((a, c) => a + (c - media) ** 2, 0) / (vals.length || 1)) || 1;
      for (const h of lista) {
        const z = (h.wr_ajustado - media) / sd; h.z = Math.round(z * 100) / 100;
        h.tier = z >= 1.1 ? 'S' : z >= 0.4 ? 'A' : z >= -0.4 ? 'B' : z >= -1.1 ? 'C' : 'D';
        if (h.partidas < 150) h.tier = h.tier === 'S' ? 'A' : h.tier === 'D' ? 'C' : h.tier; // pocos datos: sin extremos
      }
      lista.sort((a, b) => b.wr_ajustado - a.wr_ajustado);
      stats.datos[v.clave][b.clave] = { partidas, media: Math.round(media * 10) / 10, sd: Math.round(sd * 100) / 100, heroes: lista };
      log(`  ${v.clave}/${b.clave}: ${partidas} partidas`);
      await dormir(350);
    }
  }

  // Héroes nuevos: si la mayoría de sus partidas de 30 días están en los últimos 7, lleva menos de ~10 días en el juego
  stats.nuevos = [];
  try {
    const m7 = Object.fromEntries(stats.datos['7d'].todos.heroes.map((h) => [h.id, h.partidas]));
    for (const h of stats.datos['30d'].todos.heroes) if (h.partidas && (m7[h.id] || 0) / h.partidas > 0.55) stats.nuevos.push(h.id);
    log(`  héroes nuevos: ${stats.nuevos.map((id) => heroPorId[id].nombre_en).join(', ') || 'ninguno'}`);
  } catch (e) { /* sin datos */ }

  // ---------- 6. Sinergias y counters (14 días, todos los rangos) ----------
  log('Sinergias y counters…');
  const desde14 = AHORA - 14 * DIA;
  const sin = await getJSON(`${API}/v1/analytics/hero-synergy-stats?min_unix_timestamp=${desde14}&min_matches=30`);
  await dormir(350);
  const sinLinea = await getJSON(`${API}/v1/analytics/hero-synergy-stats?min_unix_timestamp=${desde14}&min_matches=20&same_lane_filter=true`);
  await dormir(350);
  const ctr = await getJSON(`${API}/v1/analytics/hero-counter-stats?min_unix_timestamp=${desde14}&min_matches=30`);
  await dormir(350);
  const ctrLinea = await getJSON(`${API}/v1/analytics/hero-counter-stats?min_unix_timestamp=${desde14}&min_matches=20&same_lane_filter=true`);
  const sinergias = {
    generado: version.generado, desde: desde14,
    parejas: sin.filter((r) => heroPorId[r.hero_id1] && heroPorId[r.hero_id2]).map((r) => ({ a: r.hero_id1, b: r.hero_id2, wr: pct(r.wins, r.matches_played), n: r.matches_played })),
    parejas_linea: sinLinea.filter((r) => heroPorId[r.hero_id1] && heroPorId[r.hero_id2]).map((r) => ({ a: r.hero_id1, b: r.hero_id2, wr: pct(r.wins, r.matches_played), n: r.matches_played })),
    counters: ctr.filter((r) => heroPorId[r.hero_id] && heroPorId[r.enemy_hero_id]).map((r) => ({ h: r.hero_id, e: r.enemy_hero_id, wr: pct(r.wins, r.matches_played), n: r.matches_played })),
    counters_linea: ctrLinea.filter((r) => heroPorId[r.hero_id] && heroPorId[r.enemy_hero_id]).map((r) => ({ h: r.hero_id, e: r.enemy_hero_id, wr: pct(r.wins, r.matches_played), n: r.matches_played })),
  };
  // Si el filtro de línea de la API no filtra nada (misma respuesta que la general), no fingimos datos de línea
  if (JSON.stringify(sinergias.parejas_linea) === JSON.stringify(sinergias.parejas)) { sinergias.parejas_linea = []; log('  aviso: same_lane_filter no cambia las sinergias; se omiten las parejas de línea'); }
  if (JSON.stringify(sinergias.counters_linea) === JSON.stringify(sinergias.counters)) { sinergias.counters_linea = []; }

  // ---------- 6b. Habilidades: qué se maxea primero y orden más jugado (7 días, Oracle+) ----------
  log('Estadísticas de habilidades…');
  const habStats = { generado: version.generado, desde: AHORA - 7 * DIA, bracket: 'Oracle o superior', heroes: {} };
  for (const hero of heroes) {
    const abs = habilidades[hero.id] || []; const porIdApi = Object.fromEntries(abs.map((a) => [a.id_api, a]));
    const entrada = { maxea_primero: [], orden: [], orden_partidas: 0 };
    try {
      await dormir(350);
      const mf = await getJSON(`${API}/v1/analytics/ability-max-first-stats?hero_id=${hero.id}&min_unix_timestamp=${AHORA - 7 * DIA}&min_average_badge=81`);
      const total = mf.reduce((s, r) => s + r.matches, 0) || 1;
      entrada.maxea_primero = mf.filter((r) => r.ability_id && porIdApi[r.ability_id]).map((r) => ({ h: porIdApi[r.ability_id].indice, pct: Math.round((1000 * r.matches) / total) / 10, wr: pct(r.wins, r.matches), partidas: r.matches })).sort((a, b) => b.pct - a.pct);
    } catch (e) { log('  max-first fallido', hero.nombre_en, e.message); }
    try {
      await dormir(350);
      const arbol = await getJSON(`${API}/v1/analytics/ability-order-tree?hero_id=${hero.id}&min_unix_timestamp=${AHORA - 7 * DIA}&min_average_badge=81&min_matches=50`);
      // Seguir en cada paso el prefijo más jugado: nodos con prefijo de longitud n+1 que extienden el actual
      let prefijo = []; let ultimo = null;
      for (let paso = 0; paso < 16; paso++) {
        const hijos = arbol.filter((n) => n.abilities.length === prefijo.length + 1 && prefijo.every((id, i) => n.abilities[i] === id));
        if (!hijos.length) break;
        hijos.sort((a, b) => b.matches - a.matches); ultimo = hijos[0]; prefijo = ultimo.abilities.slice();
      }
      entrada.orden = prefijo.map((id) => (porIdApi[id] ? porIdApi[id].indice : null)).filter(Boolean);
      entrada.orden_partidas = ultimo ? ultimo.matches : 0;
      // Si el árbol se corta en el paso 15, el último punto es determinista: la única habilidad que aún no está al máximo
      if (entrada.orden.length === 15) { const cuenta = { 1: 0, 2: 0, 3: 0, 4: 0 }; for (const i of entrada.orden) cuenta[i]++; const falta = [1, 2, 3, 4].find((i) => cuenta[i] === 3); if (falta) entrada.orden.push(falta); }
    } catch (e) { log('  order-tree fallido', hero.nombre_en, e.message); }
    habStats.heroes[hero.id] = entrada;
  }

  // ---------- 7. Estadísticas de objetos (14 días) ----------
  log('Estadísticas de objetos…');
  await dormir(350);
  const isRaw = await getJSON(`${API}/v1/analytics/item-stats?min_unix_timestamp=${desde14}`);
  const objPorId = Object.fromEntries(objetos.map((o) => [o.id, o]));
  const objetos_stats = { generado: version.generado, desde: desde14, objetos: {} };
  for (const r of isRaw) {
    if (!objPorId[r.item_id]) continue;
    objetos_stats.objetos[r.item_id] = {
      partidas: r.matches, wr: pct(r.wins, r.matches), jugadores: r.players,
      compra_min: r.avg_buy_time_s ? Math.round(r.avg_buy_time_s / 60) : null, compra_rel: r.avg_buy_time_relative ? Math.round(r.avg_buy_time_relative) : null,
    };
  }
  const maxP = Math.max(1, ...Object.values(objetos_stats.objetos).map((o) => o.partidas));
  for (const o of Object.values(objetos_stats.objetos)) o.pick_rel = Math.round((1000 * o.partidas) / maxP) / 10;

  // ---------- 8. Builds de la comunidad ----------
  const builds = { generado: version.generado, heroes: {} };
  if (!RAPIDO) {
    log('Builds de la comunidad…');
    const idObjeto = Object.fromEntries(objetos.map((o) => [o.id, o]));
    for (const hero of heroes) {
      const porId = {};
      try {
        const top = await getJSON(`${API}/v1/builds?hero_id=${hero.id}&sort_by=favorites&sort_direction=desc&only_latest=true&limit=4`);
        for (const b of top) porId[b.hero_build.hero_build_id] = b;
        await dormir(80);
        const semana = await getJSON(`${API}/v1/builds?hero_id=${hero.id}&sort_by=weekly_favorites&sort_direction=desc&only_latest=true&limit=3`);
        for (const b of semana) if (!porId[b.hero_build.hero_build_id]) porId[b.hero_build.hero_build_id] = b;
      } catch (e) { log('  builds fallidas', hero.nombre, e.message); }
      let statsBuilds = [];
      try {
        await dormir(350);
        statsBuilds = await getJSON(`${API}/v1/analytics/hero-build-stats/${hero.id}?min_unix_timestamp=${AHORA - 30 * DIA}&min_matches=100`);
      } catch (e) { log('  build-stats fallidas', hero.nombre, e.message); }
      const wrPorBuild = Object.fromEntries(statsBuilds.map((s) => [s.hero_build_id, { partidas: s.matches, wr: pct(s.wins, s.matches), jugadores: s.players }]));
      // Las 3 builds más jugadas según los datos: traerlas si no están
      const masJugadas = statsBuilds.sort((a, b) => b.matches - a.matches).slice(0, 3);
      for (const s of masJugadas) {
        if (porId[s.hero_build_id]) continue;
        try { await dormir(80); const b = await getJSON(`${API}/v1/builds/${hero.id}/${s.hero_build_id}`); if (b && b.hero_build) porId[s.hero_build_id] = b; } catch (e) { /* build privada o borrada */ }
      }
      const lista = [];
      for (const b of Object.values(porId)) {
        const hb = b.hero_build; const det = hb.details || {};
        const categorias = (det.mod_categories || []).map((c) => ({
          nombre: c.name || '', descripcion: c.description || '',
          objetos: (c.mods || []).map((m) => { const o = idObjeto[m.ability_id]; return o ? { clase: o.clase, nota: m.annotation || '' } : null; }).filter(Boolean),
        }));
        // Orden de habilidades: currency_type 2 = desbloqueo, 1 = punto de habilidad
        const orden = []; const desbloqueo = [];
        for (const c of ((det.ability_order || {}).currency_changes || [])) {
          const ab = (habilidades[hero.id] || []).find((a) => a.id_api === c.ability_id);
          const idx = ab ? ab.indice : null; if (!idx) continue;
          if (c.currency_type === 2) desbloqueo.push(idx); else orden.push({ h: idx, pa: Math.abs(c.delta || 1) });
        }
        lista.push({
          id: hb.hero_build_id, nombre: hb.name || '', autor: hb.author_account_id, descripcion: (hb.description || '').slice(0, 600),
          favoritos: b.num_favorites || 0, favoritos_semana: b.num_weekly_favorites || 0, actualizado: hb.last_updated_timestamp || null, version: hb.version,
          idioma: hb.language, categorias, desbloqueo, orden, stats: wrPorBuild[hb.hero_build_id] || null,
        });
      }
      lista.sort((a, b) => ((b.stats && b.stats.partidas) || 0) - ((a.stats && a.stats.partidas) || 0) || b.favoritos - a.favoritos);
      builds.heroes[hero.id] = lista;
      log(`  ${hero.nombre}: ${lista.length} builds`);
    }
  }

  // ---------- 9. Guardar ----------
  for (const h of heroes) delete h.imagen_url;
  for (const o of objetos) delete o.imagen_url;
  for (const l of Object.values(habilidades)) for (const a of l) delete a.imagen_url;
  const guardar = (nombre, obj) => { fs.writeFileSync(path.join(DATA, nombre), JSON.stringify(obj)); log(`  ${nombre} (${Math.round(fs.statSync(path.join(DATA, nombre)).size / 1024)} KB)`); };
  guardar('heroes.json', heroes);
  guardar('habilidades.json', habilidades);
  guardar('objetos.json', objetos);
  guardar('rangos.json', rangos);
  guardar('stats.json', stats);
  guardar('sinergias.json', sinergias);
  guardar('objetos_stats.json', objetos_stats);
  guardar('habilidades_stats.json', habStats);
  if (!RAPIDO) guardar('builds.json', builds);
  version.heroes = heroes.length; version.objetos = objetos.length;
  guardar('version.json', version);
  log('Listo.');
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
