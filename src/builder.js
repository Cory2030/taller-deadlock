'use strict';
/* ============================================================
   Creador de builds: lista de builds guardadas y editor
   ============================================================ */

/** Una categoría es opcional si lo marca su campo (como en el juego) o, en builds antiguas, si su nombre lo sugiere */
function esOpcional(c) { return c.opcional != null ? !!c.opcional : /situacional|opcional|contra|optional/i.test(c.nombre || ''); }
function buildNueva(h) {
  return { id: uid(), nombre: 'Build de ' + nombreH(h), heroe: h.id, creado: Date.now(), actualizado: Date.now(), notas: '', desbloqueo: [], orden: [], categorias: [
    { nombre: 'Fase inicial', objetos: [], opcional: false }, { nombre: 'Inicial · situacionales', objetos: [], opcional: true },
    { nombre: 'Fase media', objetos: [], opcional: false }, { nombre: 'Media · situacionales', objetos: [], opcional: true },
    { nombre: 'Fase avanzada', objetos: [], opcional: false }, { nombre: 'Avanzada · situacionales', objetos: [], opcional: true }] };
}
function buildDesdeGuia(h) {
  const b = buildNueva(h); const g = guia(h); const f = fasesDe(h);
  if (f && (f.fases || []).length) {
    // Build por fases: núcleo + situacionales (opcional) por fase, con la nota corta para el juego
    const conv = (arr) => (arr || []).map((e) => { const o = objeto(e.clase || e.objeto); return o ? { clase: o.clase, nota: e.nota_juego || e.cuando || e.por_que || '' } : null; }).filter(Boolean);
    b.categorias = [];
    for (const fase of f.fases) {
      const info = FASES[fase.fase] || { nombre: fase.fase };
      const tn = partirTitulo(fase.titulo_categoria_juego || info.nombre, false), ts = partirTitulo(fase.titulo_situacionales_juego || info.nombre, true);
      b.categorias.push({ nombre: tn.nombre, descripcion: tn.desc || fase.objetivo || '', objetos: conv(fase.nucleo), opcional: false, fase: fase.fase });
      if ((fase.situacionales || []).length) b.categorias.push({ nombre: ts.nombre, descripcion: ts.desc, objetos: conv(fase.situacionales), opcional: true, fase: fase.fase });
    }
    // Un situacional que ya está en el núcleo de otra fase no se repite
    const enNucleo = new Set(b.categorias.filter((c) => !c.opcional).flatMap((c) => c.objetos.map((x) => x.clase)));
    for (const c of b.categorias) if (c.opcional) c.objetos = c.objetos.filter((x) => !enNucleo.has(x.clase));
    b.nombre = f.titulo_build_juego || nombreH(h) + ' · por fases';
    b.notas = f.descripcion_build_juego || (g && g.arquetipo_por_que) || '';
  } else if (g && g.build) {
    const conv = (arr, campo) => (arr || []).map((e) => { const o = objeto(e.clase || e.objeto); return o ? { clase: o.clase, nota: e[campo] || '' } : null; }).filter(Boolean);
    b.categorias = [{ nombre: 'Inicio de línea', objetos: conv(g.build.inicio, 'por_que') }, { nombre: 'Medio de partida', objetos: conv(g.build.medio, 'por_que') }, { nombre: 'Final', objetos: conv(g.build.final, 'por_que') }, { nombre: 'Situacionales', objetos: conv(g.build.situacionales, 'cuando') }];
    b.nombre = nombreH(h) + ' · ' + (ARQUETIPOS[g.arquetipo_principal] || ARQUETIPOS.hibrido).nombre.toLowerCase();
    b.notas = g.arquetipo_por_que || '';
  } else if (h.populares) {
    const conv = (arr) => arr.slice(0, 5).map((p) => { const o = objeto(p.clase); return o ? { clase: o.clase, nota: `Lo compra el ${fmtPct(p.pick, 0)} de los jugadores, con ${fmtPct(p.wr)} de victorias.` } : null; }).filter(Boolean);
    b.categorias = [{ nombre: 'Inicio de línea', objetos: conv(h.populares.inicio) }, { nombre: 'Medio de partida', objetos: conv(h.populares.medio) }, { nombre: 'Final', objetos: conv(h.populares.final) }, { nombre: 'Situacionales', objetos: [] }];
    b.notas = 'Build generada a partir de los objetos más comprados y con mejor winrate según los datos de la API.';
  }
  // Orden de habilidades desde la guía (misma lógica que la ficha) o desde la build comunitaria más jugada
  const abs = D.habilidades[h.id] || [];
  if (g && g.orden_habilidades && g.orden_habilidades.orden) {
    const idxDeNombre = (n) => { const i = abs.findIndex((a) => sinAcentos(a.nombre) === sinAcentos(n) || sinAcentos(a.nombre_en) === sinAcentos(n) || sinAcentos(n).includes(sinAcentos(a.nombre_en)) || sinAcentos(n).includes(sinAcentos(a.nombre))); return i >= 0 ? i + 1 : null; };
    const ordenIdx = g.orden_habilidades.orden.map(idxDeNombre).filter(Boolean);
    if (ordenIdx.length) {
      const desbloqueo = ordenIdx.slice(); for (let i = 1; i <= 4; i++) if (!desbloqueo.includes(i)) desbloqueo.push(i);
      const primera = idxDeNombre(g.orden_habilidades.primera_maxima || '') || ordenIdx[0];
      const orden = []; for (const x of desbloqueo) orden.push({ h: x, pa: 1 }); orden.push({ h: primera, pa: 2 }, { h: primera, pa: 5 }); for (const x of desbloqueo.filter((x) => x !== primera)) orden.push({ h: x, pa: 2 }, { h: x, pa: 5 });
      b.desbloqueo = desbloqueo; b.orden = orden;
    }
  }
  if (!b.orden.length) { const com = ((D.builds && D.builds.heroes && D.builds.heroes[h.id]) || []).find((x) => x.orden && x.orden.length >= 6); if (com) { b.desbloqueo = com.desbloqueo.slice(); b.orden = com.orden.slice(); } }
  return b;
}
function buildDesdeComunidad(h, com) {
  const b = buildNueva(h);
  b.nombre = com.nombre || 'Build de la comunidad'; b.notas = (com.descripcion || '').slice(0, 400);
  b.categorias = com.categorias.filter((c) => c.objetos.length).map((c) => ({ nombre: nombreCategoria(c.nombre), descripcion: c.descripcion || '', opcional: c.opcional != null ? !!c.opcional : undefined, objetos: c.objetos.map((x) => ({ clase: x.clase, nota: x.nota || '' })) }));
  if (!b.categorias.length) b.categorias = buildNueva(h).categorias;
  b.desbloqueo = (com.desbloqueo || []).slice(); b.orden = (com.orden || []).slice();
  return b;
}
function textoBuild(b) {
  const h = heroe(b.heroe); const abs = D.habilidades[h.id] || [];
  const lineas = [`${b.nombre} — ${nombreH(h)} (Taller de Deadlock)`, ''];
  if (b.notas) lineas.push(b.notas, '');
  const acciones = nivelesDeSecuencia(h, secuenciaDesdeBuild(b));
  if (acciones.length) { lineas.push('Orden de habilidades:'); lineas.push(acciones.map((a) => { const ab = abs[a.h - 1]; return (a.tipo === 'desbloqueo' ? '[' + (ab ? (PREF.nombres === 'es' ? ab.nombre : ab.nombre_en || ab.nombre) : a.h) + ']' : (ab ? (PREF.nombres === 'es' ? ab.nombre : ab.nombre_en || ab.nombre) : a.h) + ' ' + a.tier) + (a.nivel ? ' (N' + a.nivel + ')' : ''); }).join(' → ')); lineas.push(''); }
  for (const c of b.categorias) {
    if (!c.objetos.length) continue;
    lineas.push(c.nombre + (esOpcional(c) ? ' (opcional)' : '') + ':');
    if (c.descripcion) lineas.push('  ' + c.descripcion);
    for (const x of c.objetos) { const o = objeto(x.clase); if (!o) continue; const d = compraDe(h, o.clase); lineas.push(`  - ${nombreO(o)} (${fmt(o.coste)})${d ? ' [' + textoCompra(d) + ']' : ''}${x.nota ? ' — ' + x.nota : ''}`); }
    lineas.push('');
  }
  return lineas.join('\n');
}

/* ---------- Lista de builds ---------- */
RUTAS.builds = function () {
  const raiz = el('div');
  raiz.append(cabecera('Tus builds', 'Creador de builds', 'Diseña el orden de habilidades y los objetos por fase de cualquier héroe, anota por qué compras cada cosa y guarda tus builds. Puedes partir de la build recomendada de cada héroe o de una build de la comunidad.'));
  const acciones = el('div', { class: 'fila', style: { marginBottom: '16px' } },
    el('button', { class: 'boton primario', type: 'button', onclick: () => elegirHeroeParaBuild() }, '＋ Nueva build'),
    el('button', { class: 'boton', type: 'button', onclick: importarBuild }, 'Importar código'),
    el('span', { class: 'muted pequeno' }, ALMACEN.coleccion ? 'Guardado en tu cuenta (sincronizado) y en este navegador.' : 'Las builds se guardan en este navegador. Exporta el código para llevarlas a otro dispositivo.'));
  raiz.append(acciones);
  const lista = el('div', { class: 'builds-lista' }); raiz.append(lista);
  function pintar() {
    lista.innerHTML = '';
    if (!ALMACEN.lista.length) { lista.append(el('div', { class: 'vacio', style: { gridColumn: '1 / -1' } }, 'Todavía no tienes builds. Crea una nueva o abre la build recomendada desde la ficha de un héroe.')); return; }
    for (const b of ALMACEN.lista.slice().sort((x, y) => (y.actualizado || 0) - (x.actualizado || 0))) {
      const h = heroe(b.heroe); if (!h) continue;
      const total = b.categorias.reduce((s, c) => s + c.objetos.reduce((s2, x) => s2 + ((objeto(x.clase) || {}).coste || 0), 0), 0);
      lista.append(el('div', { class: 'build-tarjeta', role: 'link', tabindex: '0', onclick: () => ir('build-' + b.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir('build-' + b.id); } } }, el('img', { src: h.imagen.icono, alt: '' }), el('div', { class: 'info' }, el('b', null, b.nombre), el('small', null, nombreH(h) + ' · ' + b.categorias.reduce((s, c) => s + c.objetos.length, 0) + ' objetos · ' + fmtSouls(total) + ' · ' + fmtFecha(b.actualizado)))));
    }
  }
  pintar();
  const alCambiar = () => pintar();
  document.addEventListener('builds-cambiadas', alCambiar);
  const quitar = () => { document.removeEventListener('builds-cambiadas', alCambiar); window.removeEventListener('hashchange', quitar); };
  window.addEventListener('hashchange', quitar);
  return raiz;
};
function elegirHeroeParaBuild() {
  const cont = el('div', { class: 'grid-heroes', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' } });
  for (const h of D.heroes.slice().sort((a, b) => nombreH(a).localeCompare(nombreH(b), 'es'))) cont.append(el('a', { class: 'tarjeta-heroe', href: '#build-nueva-' + h.clase, onclick: cerrarModal }, el('img', { src: h.imagen.carta, alt: '', loading: 'lazy' }), el('div', { class: 'velo' }, el('div', { class: 'nombre', style: { fontSize: '1rem' } }, nombreH(h)))));
  abrirModal('Elige un héroe', cont);
}
function importarBuild() {
  const ta = el('textarea', { class: 'entrada', placeholder: 'Pega aquí el código de la build', style: { minHeight: '100px' } });
  const btn = el('button', { class: 'boton primario', type: 'button', onclick: async () => { const b = decodificarBuild(ta.value); if (!b || !heroe(b.heroe)) { toast('El código no es válido'); return; } b.id = uid(); b.nombre = (b.nombre || 'Build importada'); await ALMACEN.guardar(b); cerrarModal(); ir('build-' + b.id); } }, 'Importar');
  abrirModal('Importar build', el('div', { class: 'col' }, ta, el('div', null, btn)));
}

/* ---------- Editor ---------- */
RUTAS.build = function (param) {
  // param: "nueva-<clase>" | "perfil-<clase>" | "com-<heroId>-<buildId>" | "<id>"
  let b = null; let h = null; let guardada = false;
  if (param.startsWith('nueva-')) { h = heroe(param.slice(6)); if (h) b = buildDesdeGuia(h); }
  else if (param.startsWith('perfil-')) { h = heroe(param.slice(7)); if (h) b = buildConAjustes(h, ajustesPerfil(h)); }
  else if (param.startsWith('com-')) { const [, hid, bid] = param.split('-'); h = heroe(hid); const com = h && D.builds && D.builds.heroes[h.id] && D.builds.heroes[h.id].find((x) => String(x.id) === bid); if (h && com) b = buildDesdeComunidad(h, com); }
  else { b = ALMACEN.obtener(param); if (b) { b = JSON.parse(JSON.stringify(b)); h = heroe(b.heroe); guardada = true; } }
  if (!b || !h) return el('div', { class: 'vacio' }, 'No se encontró la build. ', el('a', { href: '#builds' }, 'Ver tus builds'));
  const abs = D.habilidades[h.id] || [];
  const raiz = el('div');
  let sucio = false;

  // Cabecera
  const titulo = el('input', { class: 'titulo', value: b.nombre, 'aria-label': 'Nombre de la build', oninput: (e) => { b.nombre = e.target.value; sucio = true; } });
  const cab = el('div', { class: 'builder-cab' }, el('img', { src: h.imagen.icono, alt: '' }), el('div', null, el('div', { class: 'pretitulo' }, 'Build de ' + nombreH(h) + ' · ', el('a', { href: '#heroe-' + h.clase }, 'ver ficha'), param.startsWith('perfil-') ? [' · ', el('a', { href: '#perfil' }, '← Mi perfil')] : null), titulo));
  raiz.append(cab);
  const barra = el('div', { class: 'fila', style: { marginBottom: '16px' } });
  const btnGuardar = el('button', { class: 'boton primario', type: 'button', onclick: async () => { await ALMACEN.guardar(b); guardada = true; sucio = false; toast('Build guardada'); if (rutaActual !== 'build-' + b.id) ir('build-' + b.id); } }, 'Guardar');
  barra.append(...[btnGuardar,
    el('button', { class: 'boton', type: 'button', onclick: () => copiar(textoBuild(b)) }, 'Copiar como texto'),
    el('button', { class: 'boton', type: 'button', onclick: () => { const c = codificarBuild(b); abrirModal('Código de la build', el('div', { class: 'col' }, el('p', { class: 'sec pequeno' }, 'Guarda o comparte este código. Se importa desde la pestaña Builds.'), el('div', { class: 'codigo' }, c), el('div', null, el('button', { class: 'boton primario', type: 'button', onclick: () => copiar(c) }, 'Copiar código')))); } }, 'Exportar código'),
    el('button', { class: 'boton', type: 'button', onclick: async () => { const copia = JSON.parse(JSON.stringify(b)); copia.id = uid(); copia.nombre = b.nombre + ' (copia)'; await ALMACEN.guardar(copia); ir('build-' + copia.id); } }, 'Duplicar'),
    guardada ? el('button', { class: 'boton peligro', type: 'button', onclick: () => { const c = abrirModal('Borrar build', el('div', { class: 'col' }, el('p', null, '¿Borrar «' + b.nombre + '»? No se puede deshacer.'), el('div', { class: 'fila' }, el('button', { class: 'boton peligro', type: 'button', onclick: async () => { await ALMACEN.borrar(b.id); cerrarModal(); ir('builds'); } }, 'Sí, borrar'), el('button', { class: 'boton', type: 'button', onclick: cerrarModal }, 'Cancelar')))); } }, 'Borrar') : null,
    el('a', { class: 'boton', href: '#builds' }, 'Todas las builds')].filter(Boolean));
  raiz.append(barra);
  const notas = el('textarea', { class: 'entrada', placeholder: 'Notas generales: cómo se juega esta build, cuándo elegirla…', oninput: (e) => { b.notas = e.target.value; sucio = true; } }, b.notas || '');
  raiz.append(el('div', { style: { marginBottom: '16px' } }, el('div', { class: 'etiqueta' }, 'Notas'), notas));

  const cuerpo = el('div', { class: 'builder' }); raiz.append(cuerpo);

  // ----- Columna izquierda: habilidades -----
  const colHab = el('div', { class: 'col' });
  colHab.append(el('h2', null, 'Orden de habilidades'), el('p', { class: 'sec pequeno' }, 'Pulsa una habilidad para desbloquearla o subirle el siguiente nivel (cuestan 1, 2 y 5 puntos). Las 4 habilidades se desbloquean en los niveles de poder 1, 3, 5 y 8; los puntos llegan con el resto de niveles. N = nivel de poder en el que suele ser posible.'));
  const tablero = el('div', { class: 'pa-tablero' }); colHab.append(tablero);
  function estadoHab() {
    const acciones = secuenciaDesdeBuild(b); const des = new Set(); const tiers = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const a of acciones) { if (a.tipo === 'desbloqueo') des.add(a.h); else tiers[a.h]++; }
    return { acciones, des, tiers };
  }
  function pintarHab() {
    tablero.innerHTML = '';
    const { acciones, des, tiers } = estadoHab();
    const botones = el('div', { class: 'pa-botones' });
    abs.forEach((a, i) => {
      const idx = i + 1; const t = tiers[idx]; const desb = des.has(idx);
      const texto = !desb ? 'Desbloquear' : t >= 3 ? 'Máximo' : `Nivel ${t + 1} · ${[1, 2, 5][t]} PA`;
      botones.append(el('button', { type: 'button', class: 'pa-boton' + (!desb ? ' pendiente' : ''), disabled: desb && t >= 3, title: (PREF.nombres === 'es' ? a.nombre : a.nombre_en || a.nombre), onclick: () => {
        if (!desb) { b.desbloqueo.push(idx); } else { b.orden.push({ h: idx, pa: [1, 2, 5][t] }); }
        sucio = true; pintarHab();
      } }, el('img', { src: a.imagen, alt: '' }), el('span', { class: 'nombre' }, PREF.nombres === 'es' ? a.nombre : a.nombre_en || a.nombre), el('span', { class: 'nivel' }, texto)));
    });
    tablero.append(botones);
    const sec = el('div', { class: 'secuencia' });
    const calc = nivelesDeSecuencia(h, acciones);
    calc.forEach((ac, i) => {
      const ab = abs[ac.h - 1];
      const paso = pasoOrden(ab, ac.tipo === 'desbloqueo' ? 'Desbl.' : 'Nivel ' + ac.tier, ac.nivel ? 'N' + ac.nivel : '', ac.tipo === 'desbloqueo' ? 'desbloqueo' : '');
      paso.title += ' — pulsa para quitar este paso y los posteriores';
      paso.addEventListener('click', () => {
        // Reconstruir desde las acciones anteriores a i
        const previas = acciones.slice(0, i); b.desbloqueo = previas.filter((x) => x.tipo === 'desbloqueo').map((x) => x.h); const tiersN = {}; b.orden = previas.filter((x) => x.tipo === 'mejora').map((x) => { tiersN[x.h] = (tiersN[x.h] || 0) + 1; return { h: x.h, pa: [1, 2, 5][tiersN[x.h] - 1] }; }); sucio = true; pintarHab();
      });
      sec.append(paso);
    });
    if (!calc.length) sec.append(el('span', { class: 'muted pequeno' }, 'Sin pasos todavía. Empieza desbloqueando una habilidad.'));
    tablero.append(sec);
    const paUsados = calc.filter((x) => x.tipo === 'mejora').reduce((s, x) => s + x.pa, 0);
    const ultimo = calc.length ? calc[calc.length - 1] : null;
    tablero.append(el('div', { class: 'resumen-pa' }, el('span', null, 'Puntos usados: ', el('b', { class: 'num' }, paUsados + ' / 32')), el('span', null, 'Desbloqueadas: ', el('b', { class: 'num' }, des.size + ' / 4')), ultimo && ultimo.nivel ? el('span', null, 'Último paso en el nivel ', el('b', { class: 'num' }, ultimo.nivel), ' (', fmtSouls(ultimo.souls), ')') : null));
    tablero.append(el('div', { class: 'fila' },
      el('button', { class: 'boton mini', type: 'button', onclick: () => { // Autocompletar: desbloquear las que faltan, 1 punto en cada una, luego maxear en orden de desbloqueo
        const { des: d2, tiers: t2 } = estadoHab(); for (let i = 1; i <= 4; i++) if (!d2.has(i)) b.desbloqueo.push(i); const ordenDes = secuenciaDesdeBuild(b).filter((x) => x.tipo === 'desbloqueo').map((x) => x.h); for (const i of ordenDes) if (t2[i] < 1) { b.orden.push({ h: i, pa: 1 }); t2[i] = 1; } for (const i of ordenDes) while (t2[i] < 3) { b.orden.push({ h: i, pa: [1, 2, 5][t2[i]] }); t2[i]++; } sucio = true; pintarHab(); } }, 'Autocompletar'),
      el('button', { class: 'boton mini', type: 'button', onclick: () => { b.desbloqueo = []; b.orden = []; sucio = true; pintarHab(); } }, 'Vaciar'),
      guia(h) && guia(h).orden_habilidades ? el('button', { class: 'boton mini', type: 'button', onclick: () => { const g2 = buildDesdeGuia(h); b.desbloqueo = g2.desbloqueo; b.orden = g2.orden; sucio = true; pintarHab(); } }, 'Usar el orden de la guía') : null));
    if (guia(h) && guia(h).orden_habilidades && guia(h).orden_habilidades.detalle) tablero.append(el('div', { class: 'nota-caja' }, el('b', null, 'Guía: '), guia(h).orden_habilidades.detalle));
  }
  pintarHab();
  cuerpo.append(colHab);

  // ----- Columna derecha: objetos por categoría -----
  const colObj = el('div', { class: 'col' });
  colObj.append(el('h2', null, 'Objetos por fase'), el('p', { class: 'sec pequeno' }, 'Añade objetos a cada fase y escribe por qué los compras. Marca como «Opcional» las categorías de situacionales: en el juego aparecen a la derecha. Con «Copiar» llevas el nombre de cada categoría y la nota de cada objeto al editor del juego. Debajo de cada objeto ves en qué minuto y con cuántas almas se suele comprar con este héroe.'));
  const resumen = el('div', { class: 'ranuras' }); colObj.append(resumen);
  const cats = el('div', { class: 'categorias' }); colObj.append(cats);
  colObj.append(el('div', { class: 'fila' }, el('button', { class: 'boton', type: 'button', onclick: () => { b.categorias.push({ nombre: 'Nueva categoría', objetos: [] }); sucio = true; pintarObj(); } }, '＋ Añadir categoría')));
  function pintarResumen() {
    resumen.innerHTML = '';
    const cuenta = { weapon: 0, vitality: 0, spirit: 0 }; const coste = { weapon: 0, vitality: 0, spirit: 0 };
    // Al mejorar un objeto, la mejora sustituye a su componente (pagas la diferencia y no ocupa otra ranura):
    // solo cuentan los objetos que quedan al final
    const finales = objetosFinales(b.categorias.filter((c) => !esOpcional(c)).flatMap((c) => c.objetos.map((x) => x.clase)));
    for (const o of finales) { cuenta[o.ranura]++; coste[o.ranura] += o.coste; }
    // Bonus pasivo por almas invertidas en cada categoría (cost_bonuses del cliente; idéntico para todos los héroes)
    const BONUS = { weapon: [[800, 9], [1600, 12], [2400, 15], [3200, 18], [4800, 46], [6400, 54], [8000, 62], [11200, 74], [16000, 86], [22400, 100], [28800, 115]], vitality: [[800, 9], [1600, 12], [2400, 15], [3200, 20], [4800, 38], [6400, 42], [8000, 46], [11200, 50], [16000, 54], [22400, 60], [28800, 66]], spirit: [[800, 7], [1600, 11], [2400, 15], [3200, 19], [4800, 38], [6400, 45], [8000, 52], [11200, 59], [16000, 66], [22400, 75], [28800, 100]] };
    const bonusDe = (k, souls) => { let b = 0; for (const [s, v] of BONUS[k]) if (souls >= s) b = v; return b; };
    const textoBonus = { weapon: (v) => '+' + v + ' % daño de arma', vitality: (v) => '+' + v + ' % de vida', spirit: (v) => '+' + v + ' de espíritu' };
    for (const [k, r] of Object.entries(RANURAS)) resumen.append(el('div', { class: 'ranura ' + r.clase, title: 'Bonus pasivo por almas invertidas en ' + r.nombre.toLowerCase() + ' (el gran salto está en 4.800)' }, el('b', null, cuenta[k]), el('span', null, r.nombre + ' · ' + fmtSouls(coste[k]) + ' · ' + textoBonus[k](bonusDe(k, coste[k])))));
    const total = coste.weapon + coste.vitality + coste.spirit; const nObj = cuenta.weapon + cuenta.vitality + cuenta.spirit;
    const activos = finales.filter((o) => o.activo).length;
    const nivel = (h.niveles || []).filter((n) => n.souls <= total).pop();
    resumen.append(el('div', { class: 'ranura', style: { gridColumn: '1 / -1', background: 'var(--bg-3)' } }, el('span', null, 'Build principal al final (sin situacionales; cada mejora sustituye a su componente): ', el('b', { class: 'num', style: { display: 'inline', fontSize: '1rem' } }, fmtSouls(total)), nivel ? ' · equivale aproximadamente al nivel ' + nivel.nivel : '', ' · ', el('b', { class: 'num', style: { display: 'inline', fontSize: '1rem', color: nObj > 12 ? 'var(--mal)' : 'inherit' } }, nObj + '/12'), ' ranuras (9 base + 1 por cada Walker enemigo destruido) · ', el('b', { class: 'num', style: { display: 'inline', fontSize: '1rem', color: activos > 4 ? 'var(--mal)' : 'inherit' } }, activos + '/4'), ' activos')));
    if (nObj > 12 || activos > 4) resumen.append(el('div', { class: 'aviso-caja', style: { gridColumn: '1 / -1' } }, nObj > 12 ? 'Hay más de 12 objetos en la build principal: en el juego no caben todos a la vez, marca cuáles se venden. ' : '', activos > 4 ? 'Hay más de 4 objetos activos: solo se pueden equipar 4.' : ''));
  }
  function pintarObj() {
    cats.innerHTML = ''; pintarResumen();
    b.categorias.forEach((c, ci) => {
      const caja = el('div', { class: 'categoria' + (esOpcional(c) ? ' opcional' : '') });
      const nombre = el('input', { value: c.nombre, 'aria-label': 'Nombre de la categoría', oninput: (e) => { c.nombre = e.target.value; sucio = true; pintarResumen(); } });
      // Lo que se paga en esta categoría, sabiendo lo que ya llevas de las anteriores (las mejoras pagan la diferencia)
      const previos = b.categorias.slice(0, ci).filter((x) => !esOpcional(x)).flatMap((x) => x.objetos.map((y) => y.clase));
      const total = esOpcional(c) ? c.objetos.reduce((s, x) => s + ((objeto(x.clase) || {}).coste || 0), 0) : pagosDe(c.objetos, previos).reduce((s, p) => s + p.paga, 0);
      const idOpc = 'opc-' + b.id + '-' + ci;
      const nCat = c.nombre || 'categoría';
      caja.append(el('div', { class: 'cab' }, nombre, el('span', { class: 'total', title: esOpcional(c) ? 'Precio de lista de los objetos opcionales' : 'Almas que pagas en esta categoría (al mejorar, solo la diferencia)' }, fmtSouls(total)),
        el('button', { class: 'boton mini', type: 'button', title: 'Copiar el nombre de la categoría para pegarlo en el juego', 'aria-label': 'Copiar nombre de la categoría ' + nCat, onclick: () => copiar(c.nombre) }, 'Copiar'),
        el('button', { class: 'boton mini', type: 'button', title: 'Subir', 'aria-label': 'Subir la categoría ' + nCat, disabled: ci === 0, onclick: () => { [b.categorias[ci - 1], b.categorias[ci]] = [b.categorias[ci], b.categorias[ci - 1]]; sucio = true; pintarObj(); } }, '▲'),
        el('button', { class: 'boton mini', type: 'button', title: 'Bajar', 'aria-label': 'Bajar la categoría ' + nCat, disabled: ci === b.categorias.length - 1, onclick: () => { [b.categorias[ci + 1], b.categorias[ci]] = [b.categorias[ci], b.categorias[ci + 1]]; sucio = true; pintarObj(); } }, '▼'),
        el('button', { class: 'boton mini peligro', type: 'button', title: 'Quitar categoría', 'aria-label': 'Quitar la categoría ' + nCat, onclick: () => {
          if (!c.objetos.length) { b.categorias.splice(ci, 1); sucio = true; pintarObj(); return; }
          abrirModal('Quitar categoría', el('div', { class: 'col' }, el('p', null, '¿Quitar «' + nCat + '» y sus ' + c.objetos.length + ' objetos?'), el('div', { class: 'fila' },
            el('button', { class: 'boton peligro', type: 'button', onclick: () => { b.categorias.splice(ci, 1); sucio = true; cerrarModal(); pintarObj(); } }, 'Sí, quitar'),
            el('button', { class: 'boton', type: 'button', onclick: cerrarModal }, 'Cancelar'))));
        } }, '✕')));
      caja.append(el('div', { class: 'cat-opciones' },
        el('label', { for: idOpc, class: 'pequeno' }, el('input', { type: 'checkbox', id: idOpc, checked: esOpcional(c), onchange: (e) => { c.opcional = e.target.checked; sucio = true; pintarObj(); } }), ' Opcional (en el juego va a la derecha)')));
      // Descripción de la categoría (el editor del juego la muestra bajo el nombre)
      caja.append(el('div', { class: 'cat-desc' },
        el('textarea', { class: 'entrada', rows: 2, placeholder: 'Descripción de la categoría (opcional)', 'aria-label': 'Descripción de la categoría ' + nCat, oninput: (e) => { c.descripcion = e.target.value; sucio = true; } }, c.descripcion || ''),
        el('button', { class: 'boton mini', type: 'button', title: 'Copiar la descripción para pegarla en el juego', 'aria-label': 'Copiar la descripción de la categoría ' + nCat, onclick: () => copiar(c.descripcion || '') }, 'Copiar')));
      const items = el('div', { class: 'items' });
      c.objetos.forEach((x, xi) => {
        const o = objeto(x.clase); if (!o) return;
        const r = RANURAS[o.ranura] || {};
        const d = compraDe(h, o.clase);
        items.append(el('div', { class: 'cat-item ' + (r.clase || '') }, imgO(o, { onclick: () => abrirObjeto(o) }), el('div', { style: { minWidth: 0 } }, el('div', { class: 'nombre' }, nombreO(o), el('span', { class: 'coste' }, fmt(o.coste) + ' · ' + (r.nombre || '') + ' T' + o.tier)), d ? el('div', { class: 'cat-compra num' }, textoCompra(d)) : null, el('textarea', { placeholder: 'Cuándo y por qué comprarlo', 'aria-label': 'Nota de ' + nombreO(o), rows: 2, oninput: (e) => { x.nota = e.target.value; sucio = true; } }, x.nota || '')),
          el('div', { class: 'acciones' },
            el('button', { type: 'button', class: 'con-texto', title: 'Copiar la nota para pegarla en el juego', 'aria-label': 'Copiar nota de ' + nombreO(o), onclick: () => copiar(x.nota || nombreO(o)) }, 'Nota'),
            el('button', { type: 'button', title: 'Subir', 'aria-label': 'Subir ' + nombreO(o), disabled: xi === 0, onclick: () => { [c.objetos[xi - 1], c.objetos[xi]] = [c.objetos[xi], c.objetos[xi - 1]]; sucio = true; pintarObj(); } }, '▲'),
            el('button', { type: 'button', title: 'Bajar', 'aria-label': 'Bajar ' + nombreO(o), disabled: xi === c.objetos.length - 1, onclick: () => { [c.objetos[xi + 1], c.objetos[xi]] = [c.objetos[xi], c.objetos[xi + 1]]; sucio = true; pintarObj(); } }, '▼'),
            el('button', { type: 'button', title: 'Quitar', 'aria-label': 'Quitar ' + nombreO(o), onclick: () => {
              // «Deshacer» devuelve la categoría tal como estaba (así varios deshacer seguidos respetan el orden)
              const antes = c.objetos.slice(); c.objetos.splice(xi, 1); sucio = true; pintarObj();
              $$('#toasts .toast.con-accion').forEach((t) => t.remove());
              toastDeshacer('Quitado ' + nombreO(o), () => { c.objetos.splice(0, c.objetos.length, ...antes); pintarObj(); });
            } }, '✕'))));
      });
      caja.append(items);
      caja.append(el('div', { class: 'fila', style: { marginTop: '8px' } }, el('button', { class: 'boton mini', type: 'button', onclick: () => abrirCatalogo((o) => { c.objetos.push({ clase: o.clase, nota: '' }); sucio = true; pintarObj(); }) }, '＋ Añadir objeto')));
      cats.append(caja);
    });
  }
  pintarObj();
  cuerpo.append(colObj);

  // Aviso al salir con cambios sin guardar
  const aviso = (e) => { if (sucio) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', aviso);
  const salir = () => { window.removeEventListener('beforeunload', aviso); window.removeEventListener('hashchange', salir); };
  window.addEventListener('hashchange', salir);
  // Las notas crecen con su texto (los navegadores sin field-sizing: content)
  const ajustarAlto = (t) => { if (t.scrollHeight > t.clientHeight + 2) t.style.height = Math.min(t.scrollHeight + 2, 400) + 'px'; };
  raiz.addEventListener('input', (e) => { if (e.target.tagName === 'TEXTAREA') ajustarAlto(e.target); });
  requestAnimationFrame(() => raiz.querySelectorAll('textarea').forEach(ajustarAlto));
  return raiz;
};

/** Catálogo de objetos para añadir a una build */
function abrirCatalogo(alElegir) {
  const estado = { q: '', ranura: '', tier: '' };
  const lista = el('div', { class: 'lista' });
  const q = el('input', { class: 'entrada', type: 'search', placeholder: 'Buscar objeto', oninput: (e) => { estado.q = e.target.value; pintar(); }, 'aria-label': 'Buscar objeto' });
  const cont = el('div', { class: 'catalogo' }, q, el('div', { class: 'fila' }, segmento([['', 'Todas'], ['weapon', 'Arma'], ['vitality', 'Vitalidad'], ['spirit', 'Espíritu']], '', (v) => { estado.ranura = v; pintar(); }, (v) => RANURAS[v] ? RANURAS[v].clase : ''), segmento([['', 'Todos'], ['1', 'T1'], ['2', 'T2'], ['3', 'T3'], ['4', 'T4']], '', (v) => { estado.tier = v; pintar(); })), lista);
  function pintar() {
    lista.innerHTML = '';
    const qq = sinAcentos(estado.q);
    for (const o of D.objetos) {
      if (o.tier >= 5) continue;
      if (qq && !sinAcentos(o.nombre).includes(qq) && !sinAcentos(o.nombre_es).includes(qq)) continue;
      if (estado.ranura && o.ranura !== estado.ranura) continue;
      if (estado.tier && String(o.tier) !== estado.tier) continue;
      const r = RANURAS[o.ranura] || {};
      lista.append(el('button', { type: 'button', class: 'obj-tile ' + (r.clase || ''), onclick: () => { alElegir(o); cerrarModal(); } }, imgO(o), el('div', { style: { minWidth: 0 } }, el('div', { class: 'nombre' }, nombreO(o)), el('div', { class: 'sub' }, 'T' + o.tier + ' · ' + fmt(o.coste)))));
    }
    if (!lista.children.length) lista.append(el('div', { class: 'muted' }, 'Sin resultados'));
  }
  pintar();
  abrirModal('Añadir objeto', cont, { alto: '70vh' });
  setTimeout(() => q.focus(), 50);
}
