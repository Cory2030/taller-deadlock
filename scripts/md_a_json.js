#!/usr/bin/env node
/**
 * md_a_json.js — Convierte un informe en Markdown (secciones "## ", tablas, listas, negritas)
 * en un JSON de secciones con HTML para la pestaña Guía de la web.
 *
 * Uso: node scripts/md_a_json.js <entrada.md> <salida.json> [--omitir "## 6,## 7"] [--titulo "Guía de objetos"]
 */
const fs = require('fs');

const [entrada, salida, ...resto] = process.argv.slice(2);
if (!entrada || !salida) { console.error('Uso: node scripts/md_a_json.js <entrada.md> <salida.json> [--omitir "## 6,## 7"]'); process.exit(1); }
const opc = {}; for (let i = 0; i < resto.length; i += 2) opc[resto[i].replace(/^--/, '')] = resto[i + 1];
const omitir = (opc.omitir || '').split(',').map((s) => s.trim()).filter(Boolean);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
  let t = esc(s.replace(/`?(items_detalle|items_lista|heroes_lista|items_ids)\.txt`?/g, 'los datos del parche actual').replace(/\s*\((ver|véase) dudas\)/gi, '').replace(/"/g, '&quot;'));
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  t = t.replace(/\[([^\]]+)\]\((https?:[^)\s"'&]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  t = t.replace(/(^|\s)(https?:\/\/[^\s<)"']+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  return t;
}
function bloqueAHtml(lineas) {
  const out = []; let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];
    if (!l.trim()) { i++; continue; }
    if (/^###\s+/.test(l)) { out.push('<h3>' + inline(l.replace(/^###\s+/, '')) + '</h3>'); i++; continue; }
    if (/^####\s+/.test(l)) { out.push('<h4>' + inline(l.replace(/^####\s+/, '')) + '</h4>'); i++; continue; }
    if (/^\|/.test(l)) {
      const filas = []; while (i < lineas.length && /^\|/.test(lineas[i])) { filas.push(lineas[i]); i++; }
      const celdas = (f) => f.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const cab = celdas(filas[0]); const cuerpo = filas.slice(1).filter((f) => !/^\|\s*-+/.test(f));
      let t = '<div class="tabla-env"><table class="tabla"><thead><tr>' + cab.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>';
      for (const f of cuerpo) t += '<tr>' + celdas(f).map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>';
      out.push(t + '</tbody></table></div>'); continue;
    }
    if (/^\s*[-*]\s+/.test(l)) {
      const items = []; while (i < lineas.length && /^\s*[-*]\s+/.test(lineas[i])) { items.push(lineas[i].replace(/^\s*[-*]\s+/, '')); i++; }
      out.push('<ul>' + items.map((x) => '<li>' + inline(x) + '</li>').join('') + '</ul>'); continue;
    }
    if (/^\s*\d+\.\s+/.test(l)) {
      const items = []; while (i < lineas.length && /^\s*\d+\.\s+/.test(lineas[i])) { items.push(lineas[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      out.push('<ol>' + items.map((x) => '<li>' + inline(x) + '</li>').join('') + '</ol>'); continue;
    }
    if (/^---+$/.test(l.trim())) { i++; continue; }
    const p = []; while (i < lineas.length && lineas[i].trim() && !/^(#|\||\s*[-*]\s|\s*\d+\.\s|---)/.test(lineas[i])) { p.push(lineas[i]); i++; }
    out.push('<p>' + inline(p.join(' ')) + '</p>');
  }
  return out.join('\n');
}

const md = fs.readFileSync(entrada, 'utf8').split(/\r?\n/);
const secciones = []; let actual = null; let titulo = opc.titulo || '';
for (const l of md) {
  if (/^#\s+/.test(l)) { if (!titulo) titulo = l.replace(/^#\s+/, ''); continue; }
  if (/^##\s+/.test(l)) {
    if (actual) secciones.push(actual);
    const t = l.replace(/^##\s+/, '');
    actual = { id: t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40), titulo: t.replace(/^\d+\.\s*/, ''), lineas: [], omitida: omitir.some((o) => l.startsWith(o)) };
    continue;
  }
  if (actual) actual.lineas.push(l); else { /* preámbulo */ }
}
if (actual) secciones.push(actual);
const resultado = { generado: new Date().toISOString().slice(0, 10), titulo, secciones: secciones.filter((s) => !s.omitida).map((s) => ({ id: s.id, titulo: s.titulo, html: bloqueAHtml(s.lineas) })) };
fs.writeFileSync(salida, JSON.stringify(resultado));
console.log(`${salida}: ${resultado.secciones.length} secciones (${Math.round(JSON.stringify(resultado).length / 1024)} KB)`);
