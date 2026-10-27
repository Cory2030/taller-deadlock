#!/usr/bin/env node
/**
 * construir.js — Ensambla index.html a partir de src/plantilla.html, src/estilos.css,
 * src/app.js y src/vistas.js (CSS y JS quedan incrustados: un solo archivo, sin build tools).
 *
 * Uso: node scripts/construir.js
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SRC = path.join(RAIZ, 'src');
const leer = (n) => fs.readFileSync(path.join(SRC, n), 'utf8');

const plantilla = leer('plantilla.html');
const css = leer('estilos.css');
const ARCHIVOS_JS = ['app.js', 'vistas.js', 'fases.js', 'builder.js', 'perfil.js'];
for (const f of ARCHIVOS_JS) if (!fs.existsSync(path.join(SRC, f))) throw new Error('Falta src/' + f + ' (¿se te olvidó añadirlo a git?)');
const js = ARCHIVOS_JS.map(leer).join('\n\n');
if (/<\/script>/i.test(js)) throw new Error('El JS contiene "</script>": rómpelo con "<\\/script>"');

let version = {};
try { version = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'version.json'), 'utf8')); } catch (e) { /* sin datos aún */ }

// Huella de los datos: cambia con cualquier cambio en data/*.json. La web la añade a la URL de cada JSON,
// así el navegador puede guardarlos en caché sin servir nunca datos viejos.
// Con perfil (copia privada) las variantes salen de data/variantes_perfil/; sin él, de data/variantes/ (públicas)
const HAY_PERFIL = fs.existsSync(path.join(RAIZ, 'data', 'perfil.json'));
const SUBCARPETAS = HAY_PERFIL ? ['variantes', 'variantes_perfil'] : ['variantes'];
let huella = '';
try {
  const h = require('crypto').createHash('sha1');
  for (const f of fs.readdirSync(path.join(RAIZ, 'data')).filter((n) => n.endsWith('.json')).sort()) h.update(f).update(fs.readFileSync(path.join(RAIZ, 'data', f)));
  for (const sub of SUBCARPETAS) { const d = path.join(RAIZ, 'data', sub); if (fs.existsSync(d)) for (const f of fs.readdirSync(d).filter((n) => n.endsWith('.json')).sort()) h.update(sub + '/' + f).update(fs.readFileSync(path.join(d, f))); }
  huella = h.digest('hex').slice(0, 10);
} catch (e) { /* sin datos aún */ }

const salida = plantilla
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => js)
  .replace(/__GENERADO__/g, () => (version.generado || '').slice(0, 10))
  .replace(/__HUELLA_DATOS__/g, () => huella)
  .replace(/__HAY_PERFIL__/g, () => (HAY_PERFIL ? 'si' : 'no'));

// artefacto.html: fragmento para publicar como Artifact (la plataforma añade doctype, head y body)
fs.writeFileSync(path.join(RAIZ, 'artefacto.html'), salida);
// index.html: documento completo para servir en cualquier hosting o en local
const corteCabeza = salida.indexOf('<header');
const cabeza = corteCabeza > 0 ? salida.slice(0, corteCabeza).replace(/\n<meta name="claude:viewport-fit-sides"[^>]*>/, '') : '';
const cuerpoHtml = corteCabeza > 0 ? salida.slice(corteCabeza) : salida.replace(/\n<meta name="claude:viewport-fit-sides"[^>]*>/, '');
const completo = [
  '<!doctype html>', '<html lang="es">', '<head>', '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>',
  cabeza.trim(),
  '</head>', '<body>',
  cuerpoHtml,
  '</body>', '</html>', '',
].join('\n');
fs.writeFileSync(path.join(RAIZ, 'index.html'), completo);
console.log(`artefacto.html (${Math.round(salida.length / 1024)} KB) e index.html (${Math.round(completo.length / 1024)} KB) generados`);

// data/datos.js: los mismos JSON de data/ dentro de un script. Al abrir index.html con doble clic
// (file://) el navegador bloquea fetch() de archivos locales, pero sí carga un <script> de la carpeta.
// No se sube al repositorio ni a GitHub Pages (ver .gitignore y la tarea de GitHub).
const DATA = path.join(RAIZ, 'data');
if (fs.existsSync(DATA)) {
  const datos = {};
  for (const sub of SUBCARPETAS) {
    const SUB = path.join(DATA, sub);
    if (fs.existsSync(SUB)) for (const f of fs.readdirSync(SUB).filter((n) => n.endsWith('.json')).sort()) {
      try { datos['data/' + sub + '/' + f] = JSON.parse(fs.readFileSync(path.join(SUB, f), 'utf8')); } catch (e) { console.warn('  JSON inválido, no se incluye: ' + sub + '/' + f, e.message); }
    }
  }
  for (const f of fs.readdirSync(DATA).filter((n) => n.endsWith('.json')).sort()) {
    try { datos['data/' + f] = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (e) { console.warn('  JSON inválido, no se incluye:', f, e.message); }
  }
  // JSON.parse de una cadena se evalúa ~30 % más rápido que un literal de objeto gigante
  const js = '/* Generado por scripts/construir.js. No editar: se regenera con cada build. */\nwindow.__DATOS__ = JSON.parse(' + JSON.stringify(JSON.stringify(datos)) + ');\n';
  fs.writeFileSync(path.join(DATA, 'datos.js'), js);
  console.log(`data/datos.js (${Object.keys(datos).length} archivos, ${Math.round(js.length / 1024)} KB) generado para abrir la web con doble clic`);
}
