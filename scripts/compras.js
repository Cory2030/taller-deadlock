#!/usr/bin/env node
/**
 * compras.js — Cuándo se compra cada objeto con cada héroe (datos reales de partidas).
 *
 * Para cada héroe descarga de api.deadlock-api.com:
 *   - /v1/analytics/item-stats?hero_id=…           minuto medio de compra y de venta, partidas, victorias
 *   - /v1/analytics/player-performance-curve        almas acumuladas (patrimonio) minuto a minuto
 * y convierte el minuto de compra en «almas que sueles llevar en ese momento».
 * Genera data/compras.json. Lo llama scripts/actualizar.js; también se puede ejecutar solo:
 *
 *   node scripts/compras.js
 */
const fs = require('fs');
const path = require('path');

const API = 'https://api.deadlock-api.com';
const DATA = path.join(__dirname, '..', 'data');
const DIAS = 14;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function getJSON(url, intentos = 4) {
  for (let i = 1; i <= intentos; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'deadlock-guia-es/1.0' } });
      if (r.status === 503 || r.status === 429) { await dormir(Math.min(parseInt(r.headers.get('retry-after') || '5', 10) * 1000, 60000)); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (i === intentos) throw new Error(url + ': ' + e.message); await dormir(1500 * i); }
  }
}

/** Interpola las almas acumuladas en el segundo t a partir de la curva [[segundos, almas], …] */
function almasEn(curva, t) {
  if (!curva.length) return null;
  if (t <= curva[0][0]) return Math.round((curva[0][1] * t) / curva[0][0]) || 0;
  for (let i = 1; i < curva.length; i++) {
    const [t0, a0] = curva[i - 1]; const [t1, a1] = curva[i];
    if (t <= t1) return Math.round(a0 + ((a1 - a0) * (t - t0)) / (t1 - t0));
  }
  return curva[curva.length - 1][1];
}
const redondearAlmas = (n) => (n == null ? null : n < 2000 ? Math.round(n / 50) * 50 : Math.round(n / 100) * 100);

async function descargarCompras() {
  const heroes = JSON.parse(fs.readFileSync(path.join(DATA, 'heroes.json'), 'utf8'));
  const objetos = JSON.parse(fs.readFileSync(path.join(DATA, 'objetos.json'), 'utf8'));
  const objPorId = Object.fromEntries(objetos.map((o) => [o.id, o]));
  const desde = Math.floor(Date.now() / 1000) - DIAS * 86400;
  log('Cuándo se compra cada objeto…');

  // Partidas por héroe en la misma ventana (para el % de compra)
  const hs = await getJSON(`${API}/v1/analytics/hero-stats?min_unix_timestamp=${desde}`);
  const partidasHeroe = Object.fromEntries(hs.map((r) => [r.hero_id, r.matches]));
  await dormir(350);

  // Curva global (para objetos sin datos del héroe)
  const curvaG = await getJSON(`${API}/v1/analytics/player-performance-curve?min_unix_timestamp=${desde}&resolution=0`);
  const curvaGlobal = curvaG.map((p) => [p.game_time, Math.round(p.net_worth_avg)]).filter((p) => p[0] <= 60 * 60);

  const salida = { generado: new Date().toISOString(), dias: DIAS, nota: 'min = minuto medio de compra; almas = almas acumuladas (patrimonio) que suele llevar ese héroe en ese minuto; pick = % de sus partidas en que lo compra; venta_min = minuto medio de venta cuando se vende; vendido = % de veces que se vende o se usa como componente.', curva_global: curvaGlobal.map(([t, a]) => [Math.round(t / 60), a]), heroes: {} };

  for (const h of heroes) {
    try {
      await dormir(350);
      const c = await getJSON(`${API}/v1/analytics/player-performance-curve?min_unix_timestamp=${desde}&resolution=0&hero_ids=${h.id}`);
      const curva = c.map((p) => [p.game_time, Math.round(p.net_worth_avg)]).filter((p) => p[0] <= 60 * 60);
      await dormir(350);
      const filas = await getJSON(`${API}/v1/analytics/item-stats?hero_id=${h.id}&min_unix_timestamp=${desde}&min_matches=20`);
      const total = partidasHeroe[h.id] || Math.max(1, ...filas.map((f) => f.matches));
      const objs = {};
      for (const f of filas) {
        const o = objPorId[f.item_id]; if (!o || o.tier >= 5) continue;
        const pick = Math.round((1000 * f.matches) / total) / 10;
        if (pick < 0.5) continue;
        objs[o.clase] = {
          min: Math.round((f.avg_buy_time_s / 60) * 10) / 10,
          almas: redondearAlmas(almasEn(curva.length ? curva : curvaGlobal, f.avg_buy_time_s)),
          pick, wr: Math.round((1000 * f.wins) / f.matches) / 10, partidas: f.matches,
          venta_min: f.sold ? Math.round((f.avg_sell_time_s / 60) * 10) / 10 : null,
          vendido: f.matches ? Math.round((100 * (f.sold || 0)) / f.matches) : 0,
        };
      }
      salida.heroes[h.id] = { partidas: total, curva: curva.map(([t, a]) => [Math.round(t / 60), a]), objetos: objs };
      log(`  ${h.nombre_en}: ${Object.keys(objs).length} objetos`);
    } catch (e) { log('  fallo', h.nombre_en, e.message); }
  }

  // Resumen global por objeto: minuto y almas medios ponderados por partidas
  const global = {};
  for (const hh of Object.values(salida.heroes)) for (const [clase, d] of Object.entries(hh.objetos)) {
    const g = global[clase] || (global[clase] = { partidas: 0, sMin: 0 }); g.partidas += d.partidas; g.sMin += d.min * d.partidas;
  }
  salida.objetos = {};
  for (const [clase, g] of Object.entries(global)) { const min = g.sMin / g.partidas; salida.objetos[clase] = { min: Math.round(min * 10) / 10, almas: redondearAlmas(almasEn(curvaGlobal, min * 60)), partidas: g.partidas }; }

  fs.writeFileSync(path.join(DATA, 'compras.json'), JSON.stringify(salida));
  log(`  compras.json (${Math.round(fs.statSync(path.join(DATA, 'compras.json')).size / 1024)} KB)`);
  return salida;
}

module.exports = { descargarCompras };
if (require.main === module) descargarCompras().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
