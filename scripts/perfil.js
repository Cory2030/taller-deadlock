#!/usr/bin/env node
/* ============================================================
   Taller de Deadlock — perfil de un jugador
   Descarga las partidas de una cuenta y escribe data/perfil.json: resumen, héroes comparados con
   la media de su nivel, nivel estimado (por el rango de con quien juega si no tiene rango propio),
   rivales y compañeros por héroe, quién le mata y qué compra. Si se le pasa una carpeta con el
   análisis de los agentes (estadisticas.json, tier_nivel.json, builds_personales.json,
   comps_personales.json), lo añade en "investigacion".

   Uso:  node scripts/perfil.js <cuenta> [carpeta_investigacion]
         <cuenta>: SteamID3 (p. ej. 123456789), SteamID64 (7656…) o un enlace de Steam/lockbuilds con el número.
   data/perfil.json es personal: está en .gitignore y no se publica en GitHub.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DATA = path.join(RAIZ, 'data');
const API = 'https://api.deadlock-api.com';
const STEAM64_BASE = 76561197960265728n;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/** Acepta SteamID3, SteamID64 o un texto que los contenga (enlace de Steam, lockbuilds…) → SteamID3 */
function cuentaDe(entrada) {
  const nums = String(entrada || '').match(/\d{6,20}/g) || [];
  for (const n of nums) {
    const b = BigInt(n);
    if (b > STEAM64_BASE) return Number(b - STEAM64_BASE);
    if (b > 0n && b < 4294967296n) return Number(b);
  }
  return null;
}
async function getJSON(url, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } catch (e) {
      if (i === intentos - 1) throw new Error(url + ': ' + e.message);
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
    }
  }
}
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
const r1 = (x) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10) / 10);
const leer = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };

// Niveles de la tier list (mismos que scripts/actualizar.js): el del jugador se elige por la mediana de badge
const NIVELES = [
  { clave: 'principiante', nombre: 'Principiante (Initiate a Acolyte)', min: 1, max: 36 },
  { clave: 'medio', nombre: 'Medio (Sentinel a Emissary)', min: 41, max: 76 },
  { clave: 'oracle', nombre: 'Oracle o superior', min: 81 },
];
const RANGOS = ['Obscurus', 'Initiate', 'Seeker', 'Acolyte', 'Sentinel', 'Mystic', 'Ritualist', 'Emissary', 'Oracle', 'Phantom', 'Ascendant', 'Eternus'];
const nombreBadge = (b) => (b ? `${RANGOS[Math.floor(b / 10)] || '?'} ${['', 'I', 'II', 'III', 'IV', 'V', 'VI'][b % 10] || ''}`.trim() : 'Sin rango');

async function main() {
  const cuenta = cuentaDe(process.argv[2]);
  if (!cuenta) { console.error('Uso: node scripts/perfil.js <SteamID3 | SteamID64 | enlace con el número> [carpeta_investigacion]'); process.exit(1); }
  const carpetaInv = process.argv[3] || null;
  const heroes = leer(path.join(DATA, 'heroes.json')) || [];
  const objetos = leer(path.join(DATA, 'objetos.json')) || [];
  const objPorId = Object.fromEntries(objetos.map((o) => [o.id, o]));
  const heroPorId = Object.fromEntries(heroes.map((h) => [h.id, h]));

  log('Cuenta', cuenta);
  const [steam, rango, historial, heroStats] = await Promise.all([
    getJSON(`${API}/v1/players/steam?account_ids=${cuenta}`).catch(() => []),
    getJSON(`${API}/v1/players/${cuenta}/rank`).catch(() => null),
    getJSON(`${API}/v1/players/${cuenta}/match-history`),
    getJSON(`${API}/v1/players/hero-stats?account_ids=${cuenta}`).catch(() => []),
  ]);
  const normales = (historial || []).filter((x) => x.game_mode === 1);
  log('Partidas:', normales.length);

  // Metadatos de cada partida (en tandas de 4): equipos, quién le mata, compras
  const metas = {};
  for (let i = 0; i < normales.length; i += 4) {
    await Promise.all(normales.slice(i, i + 4).map(async (x) => {
      try { const j = await getJSON(`${API}/v1/matches/${x.match_id}/metadata`); metas[x.match_id] = j.match_info || j; } catch (e) { log('  sin metadatos', x.match_id); }
    }));
  }

  const disparos = {}; // hero_id → [aciertos, fallos]
  const partidas = []; const rivales = {}; const companeros = {}; const teMatan = {}; const compras = {}; const lobby = new Set();
  for (const x of normales) {
    const m = metas[x.match_id];
    const yo = m ? m.players.find((p) => p.account_id === cuenta) : null;
    const victoria = m && yo ? m.winning_team === yo.team : x.match_result === x.player_team;
    partidas.push({ match_id: x.match_id, fecha: new Date(x.start_time * 1000).toLocaleDateString('sv-SE'), hero_id: x.hero_id, victoria, k: x.player_kills, d: x.player_deaths, a: x.player_assists, almas: x.net_worth, min: Math.round(x.match_duration_s / 60), carril: yo ? yo.assigned_lane : null });
    if (!m || !yo) continue;
    const ult = (yo.stats || [])[yo.stats.length - 1];
    if (ult) { const d = disparos[x.hero_id] || (disparos[x.hero_id] = [0, 0]); d[0] += ult.shots_hit || 0; d[1] += ult.shots_missed || 0; }
    for (const p of m.players) {
      if (p.account_id === cuenta) continue;
      lobby.add(p.account_id);
      const t = p.team === yo.team ? companeros : rivales;
      const e = t[p.hero_id] || (t[p.hero_id] = { hero_id: p.hero_id, partidas: 0, victorias: 0 });
      e.partidas++; if (victoria) e.victorias++;
    }
    const porSlot = Object.fromEntries(m.players.map((p) => [p.player_slot, p]));
    for (const dd of yo.death_details || []) { const k = porSlot[dd.killer_player_slot]; if (k && k.team !== yo.team) teMatan[k.hero_id] = (teMatan[k.hero_id] || 0) + 1; }
    for (const it of yo.items || []) {
      const o = objPorId[it.item_id]; if (!o || o.tier >= 5 || !/^upgrade_/.test(o.clase)) continue;
      const c = compras[o.clase] || (compras[o.clase] = { clase: o.clase, veces: 0, minutos: [], vendido: 0 });
      c.veces++; c.minutos.push(it.game_time_s / 60); if (it.sold_time_s) c.vendido++;
    }
  }

  const precisionHeroe = Object.fromEntries(Object.entries(disparos).map(([h, [a, f]]) => [h, pct(a, a + f)]));
  const totDisp = Object.values(disparos).reduce((t, [a, f]) => [t[0] + a, t[1] + f], [0, 0]);
  // Nivel: rango propio si lo tiene; si no, mediana del rango de quienes juegan con él
  let badgeMediana = rango && rango.badge ? rango.badge : null; let conRango = 0;
  if (!badgeMediana && lobby.size) {
    const ids = [...lobby]; const badges = [];
    for (let i = 0; i < ids.length; i += 50) { const r = await getJSON(`${API}/v1/players/rank?account_ids=${ids.slice(i, i + 50).join(',')}`).catch(() => []); for (const x of r || []) if (x.badge > 0) badges.push(x.badge); }
    badges.sort((a, b) => a - b); conRango = badges.length;
    if (badges.length) badgeMediana = badges[Math.floor(badges.length / 2)];
  }
  const nivel = NIVELES.find((n) => badgeMediana && badgeMediana >= n.min && badgeMediana <= (n.max ?? 255)) || NIVELES[0];

  // Media de su nivel por héroe (30 días): para comparar
  const desde = Math.floor(Date.now() / 1000) - 30 * 86400;
  const filasNivel = await getJSON(`${API}/v1/analytics/hero-stats?min_unix_timestamp=${desde}&min_average_badge=${nivel.min}${nivel.max ? `&max_average_badge=${nivel.max}` : ''}`).catch(() => []);
  const mediaNivel = Object.fromEntries((filasNivel || []).map((r) => [r.hero_id, {
    wr: pct(r.wins, r.matches), partidas: r.matches,
    kills: r1(r.total_kills / r.matches), muertes: r1(r.total_deaths / r.matches), asistencias: r1(r.total_assists / r.matches),
    almas: Math.round(r.total_net_worth / r.matches), dano: Math.round(r.total_player_damage / r.matches),
    dano_recibido: Math.round(r.total_player_damage_taken / r.matches),
    precision: pct(r.total_shots_hit, r.total_shots_hit + r.total_shots_missed),
  }]));

  const porHeroe = (heroStats || []).map((s) => {
    const min = s.time_played / 60 || 1;
    return {
      hero_id: s.hero_id, nombre: (heroPorId[s.hero_id] || {}).nombre_en || String(s.hero_id), partidas: s.matches_played, victorias: s.wins, wr: pct(s.wins, s.matches_played),
      kills: r1(s.kills / s.matches_played), muertes: r1(s.deaths / s.matches_played), asistencias: r1(s.assists / s.matches_played),
      kda: s.deaths ? r1((s.kills + s.assists) / s.deaths) : null,
      almas_min: Math.round(s.networth_per_min), dano_min: Math.round(s.damage_per_min), dano_recibido_min: Math.round(s.damage_taken_per_min || 0),
      // Por partida, para comparar con la media de su nivel (la API no da minutos jugados de la media)
      almas: Math.round((s.networth_per_min * s.time_played) / 60 / s.matches_played), dano: Math.round(s.total_player_damage / s.matches_played),
      dano_recibido: Math.round(s.total_player_damage_taken / s.matches_played), minutos: Math.round(s.time_played / 60 / s.matches_played),
      precision: precisionHeroe[s.hero_id] != null ? precisionHeroe[s.hero_id] : null,
      nivel: mediaNivel[s.hero_id] || null,
    };
  }).sort((a, b) => b.partidas - a.partidas);

  const victorias = partidas.filter((p) => p.victoria).length;
  const tot = partidas.reduce((a, p) => ({ k: a.k + p.k, d: a.d + p.d, a: a.a + p.a, almas: a.almas + p.almas, min: a.min + p.min }), { k: 0, d: 0, a: 0, almas: 0, min: 0 });
  const lista = (o) => Object.values(o).map((e) => ({ ...e, nombre: (heroPorId[e.hero_id] || {}).nombre_en || String(e.hero_id), wr: pct(e.victorias, e.partidas) })).sort((a, b) => b.partidas - a.partidas);

  const perfil = {
    generado: new Date().toISOString(), cuenta, nombre: (steam[0] || {}).personaname || String(cuenta),
    avatar: (steam[0] || {}).avatarmedium || '', perfil_steam: (steam[0] || {}).profileurl || '',
    resumen: {
      partidas: partidas.length, victorias, wr: pct(victorias, partidas.length),
      kda: tot.d ? r1((tot.k + tot.a) / tot.d) : null, kills: r1(tot.k / (partidas.length || 1)), muertes: r1(tot.d / (partidas.length || 1)), asistencias: r1(tot.a / (partidas.length || 1)),
      almas_min: tot.min ? Math.round(tot.almas / tot.min) : null, precision: pct(totDisp[0], totDisp[0] + totDisp[1]),
      desde: partidas.length ? partidas[partidas.length - 1].fecha : null, hasta: partidas.length ? partidas[0].fecha : null,
    },
    nivel: { badge: badgeMediana, rango: nombreBadge(badgeMediana), propio: !!(rango && rango.badge), con_rango: conRango, jugadores: lobby.size, clave: nivel.clave, nombre: nivel.nombre },
    por_heroe: porHeroe,
    partidas,
    rivales: lista(rivales), companeros: lista(companeros),
    te_matan: Object.entries(teMatan).map(([id, v]) => ({ hero_id: +id, nombre: (heroPorId[id] || {}).nombre_en || id, veces: v })).sort((a, b) => b.veces - a.veces),
    compras: Object.values(compras).map((c) => ({ clase: c.clase, veces: c.veces, minuto: r1(c.minutos.reduce((s, x) => s + x, 0) / c.minutos.length), vendido: c.vendido })).sort((a, b) => b.veces - a.veces),
  };
  // Análisis de los agentes (opcional): se guarda tal cual en "investigacion"
  const anterior = leer(path.join(DATA, 'perfil.json'));
  if (carpetaInv) {
    perfil.investigacion = {};
    for (const [k, f] of [['estadisticas', 'estadisticas.json'], ['tier', 'tier_nivel.json'], ['builds', 'builds_personales.json'], ['comps', 'comps_personales.json']]) {
      const j = leer(path.join(carpetaInv, f)); if (j) perfil.investigacion[k] = j;
    }
    perfil.investigacion.fecha = new Date().toLocaleDateString('sv-SE');
  } else if (anterior && anterior.cuenta === cuenta && anterior.investigacion) perfil.investigacion = anterior.investigacion;

  fs.writeFileSync(path.join(DATA, 'perfil.json'), JSON.stringify(perfil));
  log(`data/perfil.json: ${perfil.nombre}, ${partidas.length} partidas (${perfil.resumen.wr} %), nivel ${perfil.nivel.rango} → ${nivel.nombre}`);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { cuentaDe };
