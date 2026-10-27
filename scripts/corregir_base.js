#!/usr/bin/env node
/* ============================================================
   Taller de Deadlock — correcciones de la build base («la del Taller»)
   Aplica scripts/correcciones_base.json a data/fases.json y, si se le pasa la carpeta de
   análisis de variantes, a la variante base de cada héroe (orden de habilidades y fase final).
   Se puede repetir sin duplicar nada (integrar.js lo vuelve a pasar al regenerar fases.json).

   Operaciones (por héroe, en orden):
     poner    { ruta, valor }                 cambia un campo entero
     cambiar  { ruta, de, a }                 cambia un trozo del texto («de» debe aparecer una vez)
     insertar { ruta (lista), valor, antes_de } añade un elemento (antes del de esa clase o al final)
     mover    { ruta (elemento), destino (lista), antes_de }
     quitar   { ruta (elemento) }
   archivo: "fases" (data/fases.json → heroes.<id>), "variante" (la variante base del análisis) o
   "analisis" (la raíz del archivo de análisis del héroe, p. ej. veredicto.explicacion).
   En las rutas, un tramo no numérico de una lista elige el elemento por id, clave (variante), clase, compra, fase o nombre.

   Uso: node scripts/corregir_base.js [carpeta_variantes] [--probar]
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const args = process.argv.slice(2);
const probar = args.includes('--probar');
const carpetaVar = args.find((a) => !a.startsWith('--')) || null;
const leer = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
// Las operaciones de data/fases.json (públicas) están en scripts/correcciones_base.json. Las de la variante base
// van en <carpeta_variantes>/_correcciones_variante.json: tocan textos del análisis privado («para ti») y no se suben.
// --ops=<archivo> prueba otro archivo de operaciones ({ "<id>": [...] } o { id, ops }) con los dos tipos mezclados.
const argOps = (args.find((a) => a.startsWith('--ops=')) || '').slice(6);
const rutaOps = argOps || path.join(__dirname, 'correcciones_base.json');
if (!fs.existsSync(rutaOps)) { console.log('Sin ' + rutaOps); process.exit(0); }
let OPS = leer(rutaOps);
if (Array.isArray(OPS.ops) && OPS.id != null) OPS = { [OPS.id]: OPS.ops };
if (!argOps && carpetaVar) {
  const rutaV = path.join(carpetaVar, '_correcciones_variante.json');
  if (fs.existsSync(rutaV)) for (const [id, l] of Object.entries(leer(rutaV))) if (!id.startsWith('_')) OPS[id] = [...(OPS[id] || []), ...l.map((o) => ({ ...o, archivo: o.archivo === 'analisis' ? 'analisis' : 'variante' }))];
}
const O = leer(path.join(RAIZ, 'data', 'objetos.json')); const objs = Array.isArray(O) ? O : O.objetos;
const porClase = Object.fromEntries(objs.map((o) => [o.clase, o]));
const rutaFases = path.join(RAIZ, 'data', 'fases.json');
const FASES = leer(rutaFases);

const errores = []; const avisos = []; const resumen = [];
const paso = (o, p) => {
  if (o == null) return undefined;
  if (Array.isArray(o) && !/^\d+$/.test(p)) return o.find((x) => x && (x.id === p || x.clave === p || x.clase === p || x.compra === p || x.fase === p || x.nombre === p));
  return o[p];
};
function resolver(raiz, ruta) {
  const partes = String(ruta).split('.'); let padre = null; let o = raiz;
  for (const p of partes) { padre = o; o = paso(o, p); if (o === undefined) return { padre, clave: p, valor: undefined }; }
  return { padre, clave: partes[partes.length - 1], valor: o };
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function indiceEn(lista, clave) { return lista.findIndex((x) => x && (x.clase === clave || x.compra === clave || x.id === clave || x.fase === clave)); }
function colocar(lista, el, antesDe) {
  const i = antesDe ? indiceEn(lista, antesDe) : -1;
  if (antesDe && i < 0) avisos.push(`«antes_de» ${antesDe} no está en la lista: va al final`);
  if (i >= 0) lista.splice(i, 0, el); else lista.push(el);
}

function aplicar(raiz, op, donde) {
  const { ruta } = op;
  if (op.op === 'poner') {
    const r = resolver(raiz, ruta);
    if (!r.padre || typeof r.padre !== 'object') return errores.push(`${donde}: ruta sin destino ${ruta}`), 'error';
    if (igual(r.valor, op.valor)) return 'ya';
    if (Array.isArray(r.padre) && !/^\d+$/.test(r.clave)) return errores.push(`${donde}: «poner» sobre un elemento de lista (${ruta}); usa insertar/quitar`), 'error';
    r.padre[r.clave] = op.valor; return 'ok';
  }
  if (op.op === 'cambiar') {
    const r = resolver(raiz, ruta);
    if (typeof r.valor !== 'string') return errores.push(`${donde}: ${ruta} no es texto`), 'error';
    const n = r.valor.split(op.de).length - 1;
    if (op.a && op.a.includes(op.de) && r.valor.includes(op.a)) return 'ya';
    if (n === 0) { if (!op.a || r.valor.includes(op.a)) return 'ya'; return errores.push(`${donde}: no aparece «${String(op.de).slice(0, 60)}» en ${ruta}`), 'error'; }
    if (n > 1) return errores.push(`${donde}: «${String(op.de).slice(0, 60)}» aparece ${n} veces en ${ruta}`), 'error';
    r.padre[r.clave] = r.valor.replace(op.de, () => op.a); return 'ok';
  }
  if (op.op === 'insertar') {
    const r = resolver(raiz, ruta);
    if (!Array.isArray(r.valor)) return errores.push(`${donde}: ${ruta} no es una lista`), 'error';
    const clave = op.valor && (op.valor.clase || op.valor.compra);
    if (clave && indiceEn(r.valor, clave) >= 0) return 'ya';
    colocar(r.valor, op.valor, op.antes_de); return 'ok';
  }
  if (op.op === 'quitar') {
    const r = resolver(raiz, ruta);
    if (r.valor === undefined) return 'ya';
    if (!Array.isArray(r.padre)) { delete r.padre[r.clave]; return 'ok'; }
    r.padre.splice(r.padre.indexOf(r.valor), 1); return 'ok';
  }
  if (op.op === 'mover') {
    const r = resolver(raiz, ruta); const d = resolver(raiz, op.destino);
    if (!Array.isArray(d.valor)) return errores.push(`${donde}: destino ${op.destino} no es una lista`), 'error';
    const clave = String(ruta).split('.').pop();
    if (r.valor === undefined) { if (indiceEn(d.valor, clave) >= 0) return 'ya'; return errores.push(`${donde}: no existe ${ruta}`), 'error'; }
    if (!Array.isArray(r.padre)) return errores.push(`${donde}: ${ruta} no es un elemento de lista`), 'error';
    const ya = r.padre === d.valor && (op.antes_de ? d.valor.indexOf(r.valor) === indiceEn(d.valor, op.antes_de) - 1 : d.valor[d.valor.length - 1] === r.valor);
    if (ya) return 'ya';
    r.padre.splice(r.padre.indexOf(r.valor), 1); colocar(d.valor, r.valor, op.antes_de); return 'ok';
  }
  errores.push(`${donde}: operación desconocida ${op.op}`); return 'error';
}

// Nada del jugador en lo público: data/fases.json lo ve cualquiera
const PERSONAL = /stiveeng|1096317017|\btu nivel\b|\btus partidas\b|\btus muertes\b|\btu perfil\b|\btu historial\b|\btu caso\b|\bjugaste\b|tu \d+ ?% de (?:tiros|parr|precis)|aciertas el \d+ ?%|(?:\(|, )tú,? (?:un|mueres|haces|aciertas)/i;
function revisarTextos(o, donde) {
  if (typeof o === 'string') { if (PERSONAL.test(o)) errores.push(`${donde}: dato personal en texto público: «${o.match(PERSONAL)[0]}»`); return; }
  if (Array.isArray(o)) o.forEach((x, i) => revisarTextos(x, donde + '[' + i + ']'));
  else if (o && typeof o === 'object') for (const [k, x] of Object.entries(o)) revisarTextos(x, donde + '.' + k);
}
function normalizarHeroe(h, nombre) {
  for (const f of h.fases || []) {
    for (const [lista, tipo] of [[f.nucleo, 'núcleo'], [f.situacionales, 'situacionales']]) {
      for (const e of lista || []) {
        if (!porClase[e.clase]) { errores.push(`${nombre}/${f.fase}/${tipo}: clase desconocida ${e.clase}`); continue; }
        e.objeto = porClase[e.clase].nombre;
        if (e.nota_juego && e.nota_juego.length > 120) errores.push(`${nombre}/${f.fase}/${tipo}/${e.clase}: nota de ${e.nota_juego.length} caracteres (máx. 120)`);
        for (const k of ['cuando', 'por_que']) if (!e[k]) avisos.push(`${nombre}/${f.fase}/${tipo}/${e.clase}: falta «${k}»`);
      }
    }
    (f.nucleo || []).forEach((e, i) => { e.orden = i + 1; });
    const vistos = new Set();
    for (const e of [...(f.nucleo || []), ...(f.situacionales || [])]) { if (vistos.has(e.clase)) avisos.push(`${nombre}/${f.fase}: ${e.clase} repetido en la fase`); vistos.add(e.clase); }
  }
  for (const v of h.vender || []) { if (!porClase[v.clase]) errores.push(`${nombre}/vender: clase desconocida ${v.clase}`); else v.objeto = porClase[v.clase].nombre; }
  const nucleos = (h.fases || []).flatMap((f) => (f.nucleo || []).map((e) => e.clase));
  const rep = nucleos.filter((c, i) => nucleos.indexOf(c) !== i);
  if (rep.length) avisos.push(`${nombre}: en el núcleo de dos fases: ${[...new Set(rep)].join(', ')}`);
}

// Huella de lo ya aplicado (por héroe y archivo): mover y añadir no siempre se pueden repetir sin efecto,
// así que una lista ya aplicada no se vuelve a pasar. Si fases.json se regenera, la huella desaparece y se aplica una vez.
const huella = (ops) => require('crypto').createHash('sha1').update(JSON.stringify(ops)).digest('hex').slice(0, 12);
FASES.correcciones_base = FASES.correcciones_base || {};
let cambiosFases = 0; const variantesTocadas = new Map();
for (const [id, ops] of Object.entries(OPS)) {
  if (id.startsWith('_')) continue;
  const h = FASES.heroes[id]; if (!h) { errores.push(`héroe ${id} no está en fases.json`); continue; }
  const cuenta = { ok: 0, ya: 0, error: 0, variante_sin_carpeta: 0 };
  const privada = (o) => o.archivo === 'variante' || o.archivo === 'analisis';
  const opsF = (ops || []).filter((o) => !privada(o)); const opsV = (ops || []).filter(privada);
  // Huella = { n: operaciones ya aplicadas, h: huella de esas n }. Si las n primeras no han cambiado,
  // solo se aplican las añadidas al final; si cambiaron, se avisa y se aplican todas.
  const yaHechas = (marca, lista, nombre) => {
    if (!marca || typeof marca !== 'object') return 0;
    if (marca.n <= lista.length && marca.h === huella(lista.slice(0, marca.n))) return marca.n;
    avisos.push(`${h.nombre}: cambiaron operaciones ya aplicadas en ${nombre}; se aplican todas otra vez (mejor partir del archivo sin corregir)`);
    return 0;
  };
  const desdeF = yaHechas(FASES.correcciones_base[id], opsF, 'fases');
  let vb = null; let desdeV = 0;
  if (opsV.length && carpetaVar) {
    if (!variantesTocadas.has(id)) variantesTocadas.set(id, leer(path.join(carpetaVar, id + '.json')));
    vb = variantesTocadas.get(id).variantes.find((x) => x.es_base);
    if (!vb) errores.push(`${h.nombre}: sin variante base`); else desdeV = yaHechas(vb._correcciones_base, opsV, 'la variante');
  }
  let iF = 0; let iV = 0;
  for (const [i, op] of (ops || []).entries()) {
    const donde = `${h.nombre} op ${i + 1} (corr. ${op.correccion})`;
    let raiz = h;
    if (privada(op)) {
      if (!carpetaVar) { cuenta.variante_sin_carpeta++; continue; }
      if (!vb) continue;
      if (iV++ < desdeV) { cuenta.ya++; continue; }
      // «analisis»: la raíz del archivo de análisis (veredicto); «variante»: la variante base
      raiz = op.archivo === 'analisis' ? variantesTocadas.get(id) : vb;
    } else if (iF++ < desdeF) { cuenta.ya++; continue; }
    const r = aplicar(raiz, op, donde); cuenta[r]++;
    if (r === 'ok' && !privada(op)) cambiosFases++;
  }
  if (opsF.length) FASES.correcciones_base[id] = { n: opsF.length, h: huella(opsF) };
  if (vb && opsV.length) vb._correcciones_base = { n: opsV.length, h: huella(opsV) };
  if (!vb || desdeV === opsV.length) variantesTocadas.delete(id);
  normalizarHeroe(h, h.nombre);
  revisarTextos({ titulo_build_juego: h.titulo_build_juego, descripcion_build_juego: h.descripcion_build_juego, fases: h.fases, vender: h.vender, plan_mapa: h.plan_mapa }, h.nombre);
  if (variantesTocadas.has(id)) {
    const vb = variantesTocadas.get(id).variantes.find((x) => x.es_base);
    if (vb.final && vb.final.descripcion_juego && vb.final.descripcion_juego.length > 120) avisos.push(`${h.nombre}/final: descripción de ${vb.final.descripcion_juego.length} caracteres (máx. 120)`);
    for (const p of (vb.final && vb.final.pasos) || []) {
      if (!porClase[p.compra]) errores.push(`${h.nombre}/final: compra desconocida ${p.compra}`);
      if (p.vende && !porClase[p.vende]) errores.push(`${h.nombre}/final: venta desconocida ${p.vende}`);
      if (p.nota_juego && p.nota_juego.length > 120) errores.push(`${h.nombre}/final/${p.compra}: nota de ${p.nota_juego.length} caracteres`);
    }
  }
  resumen.push(`${h.nombre}: ${cuenta.ok} aplicadas, ${cuenta.ya} ya estaban${cuenta.error ? ', ' + cuenta.error + ' con error' : ''}${cuenta.variante_sin_carpeta ? ', ' + cuenta.variante_sin_carpeta + ' de la variante sin carpeta' : ''}`);
}

console.log(resumen.join('\n'));
if (avisos.length) { console.log('\nAvisos (' + avisos.length + '):'); for (const a of [...new Set(avisos)]) console.log(' -', a); }
if (errores.length) { console.log('\nErrores (' + errores.length + '):'); for (const e of errores) console.log(' -', e); console.log('\nNo se escribe nada hasta corregirlos.'); process.exit(1); }
if (probar) { console.log('\n(prueba: no se escribe nada)'); process.exit(0); }
fs.writeFileSync(rutaFases, JSON.stringify(FASES));
for (const [id, j] of variantesTocadas) fs.writeFileSync(path.join(carpetaVar, id + '.json'), JSON.stringify(j, null, 1));
console.log(`\nfases.json: ${cambiosFases} cambios; variantes base tocadas: ${variantesTocadas.size}`);
