#!/usr/bin/env node
/* ============================================================
   Taller de Deadlock — «Lo que dicen los datos» de cada héroe
   Reduce las estadísticas por héroe (<carpeta>/<hero_id>.json: tu nivel, todos los rangos,
   Ascendant y Eternus, y los mejores jugadores del héroe) a data/estadisticas_builds.json:
   partidas, % del héroe, estilos de build con su % de victorias, niveles 4 más usados y más
   ganadores y qué habilidad se maxea primero.
   Uso: node scripts/estadisticas_builds.js <carpeta>
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const carpeta = process.argv[2];
if (!carpeta) { console.error('Uso: node scripts/estadisticas_builds.js <carpeta>'); process.exit(1); }
const salida = { generado: new Date().toISOString(), heroes: {} };
const corto = (l) => (l || []).slice(0, 4).map((x) => ({ clase: x.clase, pick: x.pick, wr: x.wr, partidas: x.partidas }));
for (const f of fs.readdirSync(carpeta).filter((n) => /^\d+\.json$/.test(n))) {
  const j = JSON.parse(fs.readFileSync(path.join(carpeta, f), 'utf8'));
  const h = {};
  for (const [k, n] of Object.entries(j.niveles || {})) {
    if (!n || !n.partidas) continue;
    h[k] = {
      partidas: n.partidas, wr_heroe: n.wr_heroe, jugadores: n.jugadores || null,
      estilos: n.estilos || {},
      t4_usados: corto(n.objetos && n.objetos.t4 && n.objetos.t4.mas_usados),
      t4_ganadores: corto(n.objetos && n.objetos.t4 && n.objetos.t4.mas_ganadores),
      t3_usados: corto(n.objetos && n.objetos.t3 && n.objetos.t3.mas_usados),
      maxea_primero: (n.maxea_primero || []).slice(0, 3),
    };
  }
  salida.heroes[j.id] = h;
}
fs.writeFileSync(path.join(__dirname, '..', 'data', 'estadisticas_builds.json'), JSON.stringify(salida));
console.log(`data/estadisticas_builds.json: ${Object.keys(salida.heroes).length} héroes`);
