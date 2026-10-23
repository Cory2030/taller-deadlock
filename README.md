# Taller de Deadlock

Web en español sobre Deadlock (Valve): tier list por rango, fichas de los 44 héroes con guía de
cómo jugarlos (arma / espíritu / vitalidad), orden de habilidades y build por fases explicada,
creador de builds, catálogo de 173 objetos, armador de equipos con sinergias y counters,
guía de sistemas y novedades de parche.

No necesita servidor ni dependencias: es un único `index.html` que lee los JSON de `data/`
y las imágenes de `assets/img/`.

## Estructura

```
index.html            Web completa (documento) para abrir en local o subir a cualquier hosting
artefacto.html        Misma web como fragmento, para publicarla como Artifact de Claude
src/                  Código fuente: plantilla.html, estilos.css, app.js, vistas.js, builder.js
scripts/actualizar.js Descarga datos e imágenes del parche actual desde api.deadlock-api.com
scripts/integrar.js   Convierte los archivos de investigación (guías, meta, objetos, comps) en data/*.json
scripts/md_a_json.js  Convierte un informe Markdown (p. ej. la guía de itemización) en data/itemizacion.json
scripts/construir.js  Ensambla index.html y artefacto.html a partir de src/
scripts/servir.js     Servidor estático para probar en local (http://localhost:8765)
data/                 JSON generados (héroes, habilidades, objetos, estadísticas, sinergias, builds, guías…)
assets/img/           Imágenes de héroes, habilidades, objetos y rangos
```

## Actualización diaria (datos del juego)

Requiere Node 18 o superior.

```bash
node scripts/actualizar.js
node scripts/construir.js
```

`actualizar.js` regenera: héroes y habilidades (en español), objetos, winrates por rango y
periodo (7 y 30 días), tier list por datos con la etiqueta «Nuevo», sinergias y counters
(14 días), estadísticas de objetos, qué habilidad se maxea primero y el orden más jugado
(7 días, Oracle o superior), y las builds de la comunidad más jugadas. Tarda 3–5 minutos.
Con `--rapido` omite las builds; con `--sin-imagenes` no descarga imágenes nuevas.

Los archivos escritos a mano o a partir de la investigación (no los toca `actualizar.js`):
`data/sistemas.json` (guía de sistemas), `data/parche.json` (resumen de parches),
`data/itemizacion.json` (guía de objetos, generada con `md_a_json.js`), `data/guias.json`,
`data/meta.json`, `data/objetos_guia.json` y `data/comps.json` (generados con `integrar.js`),
y `data/habilidades_extra.json` (descripciones escritas a mano para las habilidades que la API
entrega sin texto; la web solo las usa cuando la descripción oficial viene vacía).

La web publicada vive en https://claude.ai/artifact/6ffnzdPnGjwPXW3J3vxK7w (privada).

Después, si la web está publicada como Artifact, hay que volver a publicar `artefacto.html`
con la carpeta `data/` (y `assets/img/` solo si hay héroes u objetos nuevos).

## Actualización de las guías (texto)

Las guías por héroe, la tier list de la comunidad, las fichas de objetos y las composiciones
salen de una investigación por agentes que se guarda en una carpeta con estos archivos:
`heroes_lote1_v2.json … heroes_lote11_v2.json`, `meta_comunidad.json`, `meta_stats.json`,
`objetos.json`, `composiciones.json`, y opcionalmente `parche.json` y `sistemas.json`.

```bash
node scripts/integrar.js "<carpeta de investigación>"
node scripts/construir.js
```

## Alojarla en GitHub Pages (datos en vivo y actualización diaria)

Fuera de claude.ai la web hace dos cosas sola:

- **Al abrirse**, pide a la API los winrates de los últimos 7 y 30 días y recalcula la tier list
  (caché de 30 minutos en el navegador). La cabecera muestra «estadísticas en vivo · hh:mm».
  Si la API no responde, usa los datos del archivo.
- **Cada día a las 05:00** (hora de República Dominicana), la tarea
  `.github/workflows/actualizar-y-publicar.yml` ejecuta `actualizar.js` y `construir.js`
  (héroes, objetos, builds de la comunidad, órdenes de habilidad, sinergias), guarda los datos
  en el repositorio y vuelve a publicar la web. También se puede lanzar a mano desde la pestaña
  Actions.

Pasos (una sola vez), desde esta carpeta:

```bash
git init -b main
git add .
git commit -m "Taller de Deadlock"
gh repo create taller-deadlock --public --source . --push
gh api -X POST repos/{owner}/taller-deadlock/pages -f build_type=workflow
gh workflow run actualizar-y-publicar.yml
```

Publicada en https://cory2030.github.io/taller-deadlock/ (repositorio
https://github.com/Cory2030/taller-deadlock). Como la tarea diaria hace commits en `main`,
ejecuta `git pull` antes de cambiar nada en local.

La web queda en `https://<tu-usuario>.github.io/taller-deadlock/` a los 3-6 minutos. El
repositorio tiene que ser público para usar GitHub Pages gratis. Los commits diarios mantienen
viva la tarea programada (GitHub la pausa tras 60 días sin actividad).

**Alternativa con Cloudflare Pages:** en Cloudflare, Workers & Pages → Create → Pages →
Connect to Git, elige el repositorio, sin framework, comando de build `node scripts/construir.js`
y carpeta de salida `/`. Cada commit diario de la tarea de GitHub vuelve a publicar la web en
Cloudflare. En ese caso borra el trabajo `publicar` del archivo de la tarea.

La versión de claude.ai (`artefacto.html`) sigue siendo una foto de los datos: allí la API
está bloqueada y la capa en vivo no se activa.

## Abrirla en local

- **Acceso del escritorio «Taller de Deadlock»** (o doble clic en `Abrir Taller de Deadlock.bat`):
  trae de GitHub los datos que la tarea diaria publicó, regenera la web y abre `index.html`.
- **Doble clic en `index.html`** también funciona: `scripts/construir.js` genera `data/datos.js`
  con todos los datos, porque el navegador bloquea la lectura de los `.json` en archivos locales.
  Ese archivo no se sube a GitHub; si falta, ejecuta `node scripts/construir.js`.
- **Con servidor local** (como en internet):

```bash
node scripts/servir.js
```

y abrir <http://localhost:8765>.

En los tres casos la tier list se recalcula con las estadísticas en vivo de la API si hay internet.

## Fuentes

- Datos del juego y estadísticas: <https://api.deadlock-api.com> (API comunitaria, sin clave).
- Guías: deadlock.wiki, Steam Community, Reddit r/DeadlockTheGame, YouTube, tracklock.gg,
  deadlocktracker.gg, blast.tv, mobalytics y statlocker (cada ficha lista sus fuentes).
- Deadlock es una marca de Valve Corporation. Esta web es una guía no oficial.
