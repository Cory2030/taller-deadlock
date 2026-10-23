# Taller de Deadlock: informe de entrega (23-10-2026)

**Enlace privado:** https://claude.ai/artifact/6ffnzdPnGjwPXW3J3vxK7w
Solo lo puedes abrir tú. Para enseñárselo a alguien, usa el botón «Compartir» de la página.

**Versión local:** abre `index.html` con `node scripts/servir.js` (http://localhost:8765). Es la misma web.

## Qué tiene la web

| Sección | Qué hace |
|---|---|
| Tier list | Tiers S-D de los 44 héroes por rango (todos, Oracle+, Phantom+, Ascendant/Eternus) y periodo (7 o 30 días), con winrate, presencia, tendencia y etiqueta «Nuevo». Un segundo modo muestra el consenso de la comunidad (tier lists, creadores, Reddit, vídeos). |
| Héroes | Cuadrícula filtrable por tipo, por cómo se juega (arma, espíritu, vitalidad, híbrido), dificultad y orden. |
| Ficha de héroe | Cómo jugarlo por fases (0-10, 10-25, 25+ min), si va a arma, espíritu o vitalidad y por qué, alternativas, habilidades con sus mejoras, orden de habilidades recomendado y el más jugado de verdad, build por fases con el porqué de cada objeto, objetos con mejor winrate según datos, builds de la comunidad, counters y sinergias con explicación, estadísticas base y del arma, vídeos y fuentes. |
| Builds | Creador: orden de habilidades por clics (ve en qué nivel llega cada punto), objetos por fase con nota de «por qué», coste, bonus de categoría (el salto de 4.800 almas), control de ranuras (12) y activos (4). Se guarda, duplica, exporta como texto o como código y se importa. Puede partir de la build recomendada o de una build de la comunidad. |
| Objetos | Los 173 objetos como en la tienda del juego (arma, vitalidad, espíritu por tier), con ficha: estadísticas, para qué sirve, cuándo comprarlo, contra qué, de qué se mejora y quién lo compra más. |
| Equipos | Armador 6 contra 6: sinergias de tu equipo, tabla de counters contra el rival, qué le falta a la composición y quién encaja mejor. Debajo, 11 composiciones recomendadas con reparto de líneas, plan y por qué funcionan. |
| Guía | Sistemas del juego (almas, niveles, puntos de habilidad, objetos y ranuras, cómo decidir arma/espíritu/vitalidad, mapa y objetivos, rangos, glosario) e itemización (núcleo por arquetipo, objetos contra curación, burst, arma, control, invisibilidad y movilidad, economía, objetos fuertes y débiles del parche). |
| Novedades | Últimos parches resumidos en español y estado de los datos. |

## Cómo decide si un héroe va a arma, espíritu o vitalidad

1. Coeficientes de sus habilidades (cuánto escala cada una con el poder de espíritu), DPS y caída de daño de su arma.
2. Lo que compran de verdad los jugadores en la fase final y con qué winrate (API).
3. Builds y guías recientes de jugadores de alto rango y vídeos.
4. Un revisor independiente intentó refutar cada guía con la API y la wiki: 242 correcciones aplicadas.

Resultado: 25 héroes a espíritu, 12 híbridos y 7 a arma. Cada ficha explica por qué y cuándo cambiar de arquetipo.

## Decisiones que tomé sin preguntarte

- **deadlock.com.gg no existe hoy para internet.** No resuelve por DNS (toda la zona com.gg está caída), no tiene capturas en el archivo de internet y ningún buscador lo indexa. Basé la web en lo que hacen bien los sitios equivalentes que sí funcionan: deadlocktiers.com, tracklock.gg, deadlocked.gg, seemeta.com, metabot.gg y deadlockhandbook.com.
- **Nombres de héroes y objetos en inglés por defecto**, porque así aparecen en guías y vídeos. Hay un botón para verlos en español (nombres oficiales del juego).
- **Diseño oscuro tipo «taller noir»** (verde tinta, latón), con tema claro automático. Los colores de arma, vitalidad y espíritu son los del juego.
- **Las builds se guardan en tu navegador** y, dentro de claude.ai, también en tu cuenta.

## Fuentes

640 enlaces únicos de 44 sitios, citados en cada ficha. Los principales:

| Fuente | Para qué |
|---|---|
| api.deadlock-api.com | Héroes, habilidades y objetos del parche (en español), 853.000 partidas de 7 días, objetos por fase, órdenes de habilidad, sinergias, counters, 432 builds de la comunidad |
| deadlock.wiki | Mecánicas, coeficientes de habilidades, historial de cambios |
| YouTube (190 vídeos citados) | Guías y gameplay comentado de los últimos 3 meses |
| tracklock.gg, deadlocktiers.com, seemeta.com, metabot.gg, statlocker.gg, blitz.gg, deadlockhandbook.com | Tier lists y builds por rango |
| Steam (guías y noticias), Reddit r/DeadlockTheGame, games.gg, dexerto, deadlocked.gg | Guías, opinión de la comunidad, notas de parche |

## Lo que falta o no se pudo hacer

- **Actualización diaria automática.** Dentro de claude.ai la página no puede consultar la API en vivo, así que muestra una foto de los datos del 23-10-2026. Para que se actualice sola hay dos caminos: una tarea programada que regenere y republique cada día, o alojarla en un hosting gratuito (Cloudflare Pages o GitHub Pages). Necesito tu visto bueno para cualquiera de los dos.
- **Discord**: no hay acceso público a sus canales, así que no se usó. Reddit se leyó solo en parte (bloquea a clientes automatizados) y YouTube no deja leer transcripciones: se usaron títulos, descripciones y lo que citan otras guías.
- **Parejas de línea**: el filtro de la API para «misma línea» no filtra nada; esas secciones se ocultaron en lugar de mostrar datos falsos.
- **16 de 44 guías tienen confianza media**: algunas cifras de sitios externos no se pudieron recomprobar, o el héroe es muy nuevo (Violet, Nurse Harrow, Solomon, Deadman Danny). Conviene revisarlas la semana del 27-10.
- **70 habilidades sin frase resumen** (la API no la trae); la descripción completa sí está.
- **No hay importación directa al juego.** La build se exporta como texto o código; en el juego hay que recrearla a mano.

## Mejoras que propongo

1. Alojar la web en Cloudflare Pages con una actualización diaria automática: datos siempre al día y enlace público.
2. Aviso de parche nuevo: el script detecta un cambio de versión en Steam y marca las guías de los héroes afectados.
3. Publicar en el juego las builds recomendadas con un nombre buscable («Taller …») para cargarlas desde la tienda.
4. Comparador de dos héroes, clasificación de mejores jugadores por héroe y asistente de draft (bans y picks).
5. Sección de vídeos en español.

## Cómo actualizar

```bash
node scripts/actualizar.js
node scripts/construir.js
```

Después se republica `artefacto.html` con la carpeta `data/`. Detalle en `README.md`.

## Capturas

En la carpeta `capturas/`: tier list, héroes, ficha de Abrams, build recomendada, orden de habilidades, creador de builds, objetos, composiciones, guía de itemización, móvil y tema claro.
