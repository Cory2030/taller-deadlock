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

---

# Segunda entrega (23-10-2026): build por fases, cuándo comprar y plan de mapa

**Estado:** publicado con tu aprobación el 23-10-2026 en GitHub Pages (commit 60d344e) y en el Artifact (versión 7).

## Qué pediste y qué hay

| Pedido | Dónde está |
|---|---|
| Build como en el editor del juego: por fases, núcleo a la izquierda y situacionales «Opcional» a la derecha, con su explicación | Ficha de cada héroe › **Build recomendada** (44 héroes, 3 fases: 0-10, 10-22 y 22+). En el móvil los situacionales van debajo, plegados. |
| Cuándo comprar cada objeto, con cuántas almas o en qué situación | En cada tarjeta: minuto, almas y % de compra **reales** de ese héroe (14 días), «Cuándo» o «Cómpralo si», qué sustituye y por qué. En la ficha de cada uno de los 173 objetos: cuándo comprarlo, señales, cuándo no, cuándo venderlo, quién lo compra y qué builds del Taller lo recomiendan. |
| Copiar para hacerlo en el juego | Botones «Copiar» para el nombre y la descripción de la build y de cada categoría, «Copiar nota» por objeto y «Copiar build completa». La pestaña «Cómo pasar esta build al juego» explica los pasos. «Abrir en el creador» la deja editable con las categorías opcionales a la derecha. |
| Mejoras de los puentes: cuáles coger con cada héroe | Ficha › **Plan de mapa**: los 4 tipos (Arma, Supervivencia, Lanzamiento, Movimiento) ordenados por prioridad para ese héroe, con «siempre», «si estás cerca» o «no merece la pena». |
| Cuándo rotar a la jungla y en qué minutos; cuándo hacer las cajas | Plan de mapa › **Minuto a minuto** (de 0:00 a 30:00+), **Jungla: cuándo y por dónde** y **Cajas**. |
| Rutas eficientes para cada héroe | Plan de mapa › rutas dibujadas sobre el minimapa, eligiendo tu base (Abajo = Hidden King, Arriba = Archmother), tu carril y la etapa (temprana, media, Walker…). 211 rutas asignadas a los 44 héroes. |
| (Extra) Guía del mapa | Guía › **Mapa y jungla**: mejoras de puente y permanentes, mapa con capas (campamentos, puentes, urna, grieta, zonas de cajas, contenedores, cajas duras, tiendas), cronología, oleadas, rutas por carril y los 51 campamentos. |

## Una corrección importante

**Las mejoras de los puentes no son permanentes.** Salen a las 5:00 (no a las 10:00) y luego cada 5 minutos, una en cada puente; duran 160 s, se pierden al morir y se cogen con un golpe pesado. Lo que pasa a las 10:00 y confunde: la segunda tanda de los puentes, la Urna de almas (4 mejoras permanentes a quien la entrega), las mejoras permanentes suben a nivel 2 y, entre las 10:00 y las 12:00, la Grieta. Las permanentes salen de contenedores dorados (50 %), Sinner's Sacrifice (desde las 8:00), la Urna, el jefe central y Golden Goose Egg. La web lo explica en la ficha y en la guía.

## Cómo se hizo

1. **Investigación (21 agentes):** mecánicas del mapa con la API y la wiki, el cuándo de los 173 objetos y la build por fases y plan de mapa de los 44 héroes (8 lotes, cada uno revisado por un verificador que contrastó cada cifra con los datos reales), más un revisor crítico final.
2. **Datos reales nuevos:** `scripts/compras.js` saca de la API, para cada héroe y objeto, el minuto medio de compra y las almas que se llevan en ese momento (14 días).
3. **Construcción a una sola mano** de las vistas (`src/fases.js`).
4. **Revisión repartida en tres rondas** (PC, móvil, velocidad, textos y datos; 12 agentes en total). En la última no quedó ningún fallo grave visual y se corrigió lo que encontró.

## Cambios que tomé sin preguntarte

- Las cifras de cada tarjeta salen de los datos del día; los textos ya no las repiten, así no se desfasan con cada actualización.
- Seis objetos situacionales pasaron de la fase inicial a la media porque, en partidas reales, se compran después del minuto 15.
- El Golden Goose Egg de Seven y Sinclair decía «rómpelo en el min 10-16»; lo cambié a 20-24, que es lo que hacen sus jugadores.
- Con la base arriba, cuando un campamento no tiene un equivalente exacto (el mapa es casi simétrico, no del todo), el paso se marca «equivalente aproximado».
- Más rápida: cada sección solo descarga lo que usa, las imágenes pesan bastante menos (iconos de 6,9 a 3,2 MB; cartas de héroe de 2,3 a 0,5 MB) y los datos quedan en la caché del navegador hasta que cambian. La portada descarga un 65 % menos y la ficha en el móvil abre en la mitad de tiempo.

## Lo que falta

- **Publicar.** Hace falta tu visto bueno: subir a GitHub (la tarea diaria lo publica en GitHub Pages) y volver a publicar el Artifact.
- **Ficha en frío:** la primera vez que se abre un héroe directamente, descarga 1,3 MB de datos de todos los héroes. Partirlos por héroe la haría bastante más rápida.
- **Doble clic:** `data/datos.js` pesa 6,4 MB y se carga entero.
- **Rutas «arriba» escritas a mano:** con la base arriba, las rutas son las de abajo giradas; los consejos escritos de cada héroe siguen redactados para la base de abajo (la web lo avisa).
- **Algunas cifras vienen de otras fuentes** (rango Phantom o superior, guías de la comunidad) y se indica así; los minutos recomendados para los T4 de 6 héroes van 2-7 min por detrás de la media real.
- **Las rutas son propuestas razonadas** a partir del mapa y los tiempos de los campamentos, no rutas publicadas por jugadores profesionales.

## Fuentes de esta entrega

- api.deadlock-api.com: mapa (`/v1/assets/map`), entidades (`misc-entities`), datos generales, PNJ en español, estadísticas de compra por héroe y objeto, curva de almas por minuto.
- deadlock.wiki: páginas del mapa, mejoras de puente, Urna, Grieta, Sinner's Sacrifice, cajas y campamentos.
- Guías por héroe de tracklock.gg, deadlocktracker.gg, mobalytics, statlocker, Steam, Reddit y YouTube (citadas en cada ficha).
- Las fuentes del mapa están en Guía › Mapa y jungla › Fuentes.

## Capturas de esta entrega

`capturas/12-build-por-fases-pc.png`, `13-build-por-fases-movil.png`, `14-plan-de-mapa-puentes.png`, `15-ruta-jungla-base-arriba.png`, `16-guia-mapa-zonas-de-cajas.png`, `17-panel-huevo-de-oro.png`, `18-creador-dos-columnas.png`, `19-movil-ruta-jungla.png`.

# Tercera entrega (23-10-2026): Mi perfil

**Estado:** terminado en local. **No está publicado**: ni en GitHub Pages ni en el Artifact, hasta que des el visto bueno.

## Qué pediste y qué hay

| Pedido | Dónde está |
|---|---|
| Tener en cuenta tu nivel aunque no juegues clasificatorias | Si no tienes rango, la web estima tu nivel con el rango de los jugadores de tus partidas. La tier list tiene dos rangos nuevos: **Initiate–Acolyte** y **Sentinel–Emissary**. |
| Usar tu % de victorias y tus estadísticas | Sección **Mi perfil**:<br>• Resumen y comparación con la media de tu nivel, héroe a héroe.<br>• «Lo que dicen tus partidas».<br>• «Dónde se te escapan las partidas»: muertes por tramo, de dónde salen tus almas y almas sin gastar.<br>• Tus partidas, quién te mata y con quién juegas. |
| Tier list para tu caso | **Tier list de tu nivel**, con borde dorado en los héroes que ya has jugado, y **Héroes para ti**: principal, reserva, para aprender y «mejor no por ahora». |
| Builds para tu caso | **Builds para ti** con 6 héroes: qué cambiar respecto a la build del Taller, cuándo y por qué. El botón «Abrir en el creador con tus ajustes» deja la build lista para copiar al juego. |
| Composiciones para tu caso | **Composiciones para ti**:<br>• 5 equipos con quién va en cada línea y el plan de partida.<br>• Las mejores parejas de línea.<br>• Los rivales que más te cuestan, con los objetos contra ellos.<br>• Consejos para elegir héroe. |
| Tus datos de lockbuilds | Salen de la misma API pública que usa lockbuilds. Pega tu SteamID o el enlace de lockbuilds en «Tu cuenta». |

## Cómo se hizo

1. **Datos:** `scripts/perfil.js` descarga tus partidas de la API pública y escribe `data/perfil.json`.
2. **Análisis (8 agentes):** cuatro analistas (estadísticas, tier list, builds y composiciones), cada uno con un verificador que recalculó sus cifras. Corrigieron unas 70 cosas.
3. **Redacción (8 agentes):** una pasada para quitar la jerga técnica. Un comprobador automático garantizó que no cambiara ninguna cifra.
4. **Construcción a una sola mano:** `src/perfil.js` y los estilos.
5. **Revisión en tres rondas** (computadora, celular, velocidad, enlaces, datos y la versión pública sin tus datos):
   - 1.ª ronda: 58 problemas confirmados.
   - 2.ª ronda: comprobó los arreglos y encontró unos 35 detalles más.
   - 3.ª ronda: comprobación final.

## Decisiones que tomé sin preguntarte

- **Tus datos personales no van al repositorio público.** `data/perfil.json` (tus partidas y el análisis) y `MI-PERFIL.md` están en `.gitignore`.
- **En GitHub Pages, «Mi perfil» funciona para cualquier cuenta** con los datos en vivo de la API (resumen, tus héroes, la tier list de tu nivel y las partidas), pero sin el análisis escrito. El análisis escrito solo estaría en la copia local y en el Artifact privado.
- **Comparación con tu nivel:** las medias salen de la misma tabla que la tier list (30 días). Puedes elegir otro nivel en «Comparar con el nivel».
- **Consejos condicionales:** en el creador, un consejo con condición («si hay Billy») va a los situacionales y no sustituye al objeto de la build.
- **Mejoras para toda la web:**
  - Al volver atrás, cada sección vuelve a donde estabas.
  - Los avisos se leen bien en el móvil.
  - Mejor contraste en los temas claro y oscuro.
  - Icono de la web.
  - En el creador, un objeto que ya está en el núcleo no se repite en los situacionales.

## Lo que falta

- **Publicar.** Hace falta tu visto bueno, y también decidir si la versión del Artifact lleva tu análisis.
- **El análisis escrito no se rehace solo.** Las partidas se actualizan en vivo, pero los textos son del 23-10. Para rehacerlo hace falta otra pasada de análisis.
- **Pocas partidas.** Con pocas partidas, las cifras por héroe son orientativas.
- **El nivel sin rango es una estimación.** Sale del rango de los jugadores de tus partidas.

## Fuentes de esta entrega

- **API pública de Deadlock** (api.deadlock-api.com):
  - historial, partidas, estadísticas por héroe y rango;
  - estadísticas de héroes, objetos, parejas, cruces y baneos por nivel;
  - curvas de almas por minuto.
- **Tu captura de lockbuilds.**
- **Datos de la web:** la build por fases, las reglas de composición y las guías.

## Capturas de esta entrega

Están en `capturas/perfil/` y no se suben al repositorio porque llevan tus datos: `01-perfil-pc-arriba.png`, `02-perfil-pc-donde-se-escapan.png`, `03-perfil-pc-tier-de-tu-nivel.png`, `04-perfil-pc-builds-para-ti.png`, `05-perfil-pc-composiciones.png`, `06-perfil-movil-arriba.png`, `07-perfil-movil-barras.png`, `08-creador-victor-para-ti.png`.

# Cuarta entrega (26-10-2026): la mejor build de cada héroe y la fase final

**Estado:** publicado en GitHub Pages (sin datos personales) y en el Artifact privado (con el análisis de tu perfil).

## Qué pediste y qué hay

| Pedido | Dónde está |
|---|---|
| La mejor build de cada héroe (arma, espíritu, vitalidad o híbrida) | En la ficha de cada uno de los 44 héroes, **«Estilo de build»**: 120 variantes en total. Cada héroe tiene marcada la mejor en Initiate–Acolyte, en todos los rangos y la de los mejores jugadores, con el porqué y los datos. |
| Builds para héroes aunque no te los recomiende | Todos los héroes tienen sus variantes, se recomienden o no. |
| Lo más usado, lo que más gana y lo de los mejores | En cada variante, **«Por qué esta recomendación (datos)»**; en la ficha, **«Lo que dicen los datos»** en cuatro niveles: Initiate–Acolyte, todos los rangos, Ascendant y Eternus, y los mejores jugadores del héroe según la tabla de clasificación. |
| Fase final (35-60 min): vender un nivel 1-3 y comprar un nivel 4 | Cada variante tiene su **fase final** con pasos en orden: qué vender, qué comprar, en qué minuto, por qué y la nota para pegar en el editor de builds del juego. Hay 588 pasos en total. |
| Copiar al juego | «Copiar build completa» incluye el estilo, el orden de habilidades y la fase final. «Abrir en el creador» abre la variante elegida. |

## Cómo se hizo

1. **Investigación (un agente por héroe y otro que lo verificó):** datos de la API pública (compras, builds de la comunidad, habilidades y tabla de clasificación) y guías actuales.
2. **Estadísticas por nivel:** `scripts/estadisticas_builds.js` las reduce a `data/estadisticas_builds.json`. El total de partidas de cada nivel sale de las estadísticas del héroe con los mismos filtros.
3. **Unión y validación:** `scripts/variantes.js` comprueba clases de objeto, fases y fase final.
4. **Construcción a una sola mano:** selector de variante, fase final y bloque de datos.
5. **Revisión por agentes** (computadora, celular, datos y privacidad) y comprobación automática de las 120 variantes: sin errores, sin notas repetidas, y la definitiva siempre se desbloquea la última.

## Decisiones que tomé sin preguntarte

- **Dos copias de las variantes.** La pública (`data/variantes/`) no lleva nada del jugador: sin «para ti» y con «tu nivel» cambiado por «Initiate–Acolyte». La completa (`data/variantes_perfil/`) está en `.gitignore` y solo va a la copia local y al Artifact.
- **El orden de habilidades** de cada variante es una prioridad para mejorar. Al desbloquear, las tres normales van primero y la definitiva al final, como se juega.
- **El total de partidas** se corrigió: antes se tomaba el objeto más comprado como total, y los % de compra salían entre un 10 y un 20 % más altos. Las 39 frases que citaban ese total se reescribieron con el dato real.
- **Al cambiar de variante** la página no salta y los plegables abiertos siguen abiertos.

## Lo que falta

- **Correcciones a la build base:** los agentes propusieron unas 210, guardadas para revisarlas en una segunda pasada. *(Hechas en la quinta entrega.)*
- **Algunos % de compra en los textos** pueden venir de totales antiguos sin citarlos. Los que citaban el total ya están corregidos; los demás son orientativos.
- **Las variantes no se rehacen solas.** Los datos diarios se actualizan, pero los textos de las variantes son del 25-26 de octubre.

## Fuentes de esta entrega

- **API pública de Deadlock** (api.deadlock-api.com): compras por minuto, builds de la comunidad, habilidades, estadísticas por rango y tabla de clasificación.
- **Guías y estadísticas:**
  - deadlock.wiki
  - lockbuilds.com
  - seemeta.com
  - tracklock.gg
  - metabot.gg
  - statlocker.gg
  - games.gg
  - buildlocker.gg
  - deadlocktiers.com
  - vídeos de jugadores en YouTube y Twitch

---

# Quinta entrega (27-10-2026): correcciones a las builds base

**Estado:** publicado en GitHub Pages (sin datos personales) y en el Artifact privado.

## Qué pediste y qué hay

| Pedido | Resultado |
|---|---|
| Aplicar las ~210 correcciones a las builds base | 211 revisadas una por una contra los datos: 193 aplicadas, 14 en parte y 4 descartadas (la base ya lo hacía bien, o la corrección era falsa). |
| Revisar | 6 revisores (4 de datos y redacción, 1 en computadora y 1 en celular) encontraron 81 puntos: todos corregidos salvo los de «Lo que falta». Después, 2 verificadores comprobaron los arreglos: 78 de 81 estaban bien. Encontraron otros 17 detalles y también quedan corregidos. |
| Publicar como la vez anterior | GitHub Pages sin datos personales y Artifact privado con tu análisis. |

**Qué cambia en la web:** en la ficha de cada héroe, la build del Taller (la variante base) trae el nuevo orden de compra, minutos que cuadran con las almas reales, opcionales nuevos y una fase final coherente con lo que llevas. Ejemplos:

- **Abrams:** Colossus antes que Phantom Strike.
- **Billy:** Scourge por defecto; Juggernaut pasa a alternativa.
- **Venator:** sin Close Quarters; Hollow Point en el núcleo.
- **Sinclair:** sin objetos de arma en línea.
- **Paradox:** Mystic Reverb antes del min 30.

## Errores antiguos que salieron en la revisión (y quedan arreglados)

- **Spirit Resilience y Bullet Resilience:** dan +30 % de resistencia siempre y +15 % más por debajo del 50 % de vida. 25 héroes lo tenían al revés (más Abrams, que venía en sus correcciones).
- **Sharpshooter y Leech se hacen con dos objetos:**
  - Sharpshooter = Long Range + High-Velocity Rounds.
  - Leech = Bullet Lifesteal + Spirit Lifesteal.
  - Antes la web solo contaba el primero: cobraba de más al mejorar y contaba una ranura de más.
  - Ahora `data/objetos.json` guarda todos los componentes y la web los descuenta todos.
  - La actualización diaria también los guarda.
- **Cifras de compra sin verbo:** unas 200 frases decían «(59,5 % de sus partidas)» o «acumuladas (…)». Ahora dicen «se compra en el 59,5 % de las partidas de McGinnis».
- **Kelvin:** la lista de ventas mandaba vender Healing Booster aunque la fase final lo mejora a Healing Tempo.
- **Privacidad:**
  - Algunas variantes públicas conservaban frases del análisis privado («cuando más mueres»).
  - El filtro que genera la copia pública (`scripts/variantes.js`) ahora las cambia por «cuando más peleas hay» y quita cualquier cifra de muertes.
- **Creador de builds:** contaba como ranura lo que la propia build vende antes del min 30 (por ejemplo, Paradox salía con 13 de 12). Ya no lo cuenta.
- **Minutos de la fase final y de los niveles 4:**
  - Algunos minutos no cuadraban con las almas reales tras los cambios (McGinnis, Vyper, Shiv, Pocket, Sinclair, Rem, Baba y Paradox).
  - Ahora siguen la curva de almas de cada héroe.
  - Las descripciones de la categoría final caben en los 120 caracteres del juego.

## Cómo se hizo

1. **Verificación por agentes:** 9 agentes, unos 5 héroes cada uno. Comprobaron cada corrección contra la API y los datos locales y la convirtieron en cambios exactos.
2. **Aplicación a una sola mano:** con `scripts/corregir_base.js`. Se puede repetir sin duplicar nada y `integrar.js` lo vuelve a pasar si algún día se regenera `fases.json`.
   - Las correcciones públicas están en `scripts/correcciones_base.json`.
   - Las de la variante privada (tocan tu análisis) están en `investigacion/variantes/_correcciones_variante.json`, fuera de git.
3. **Revisión por 6 agentes** y comprobaciones automáticas:
   - orden de minutos;
   - ranuras;
   - fase final coherente;
   - menciones a objetos que ya no están;
   - notas de 120 caracteres o menos;
   - ningún dato personal en lo público.
4. **Verificación de los arreglos** por 2 agentes más, y una segunda ronda de arreglos con las mismas comprobaciones.

## Decisiones que tomé sin preguntarte

- **Descarté la corrección que decía que Sharpshooter no necesita High-Velocity Rounds** (Solomon). La API dice que sí lo necesita, y ese error se había colado también en un arreglo mío en Paradox: quedó deshecho.
- **Shiv sigue con escopeta en la build del Taller.** La de cuchillos gana más en Initiate–Acolyte, pero ya está como variante «Espíritu» y el selector la marca como la mejor de tu nivel.
- **El análisis de variantes ahora vive en `investigacion/`**, dentro del proyecto y fuera de git. Antes solo estaba en una carpeta temporal de la sesión y era la única fuente de `data/variantes/`.

## Lo que falta

- **Orden de desbloqueo de habilidades:**
  - La secuencia que pinta la ficha, y la que se copia al juego, desbloquea en el orden de prioridad de mejora.
  - En unos 17 héroes eso no coincide con el texto de debajo (por ejemplo, Drifter dice «desbloquea Rend» y la secuencia empieza por Stalker's Mark).
  - Ya pasaba antes de hoy. Arreglarlo pide un campo «desbloqueo» por héroe, sacado de los datos de la API.
- **Creador en el celular:** el nombre largo de la build y algunos nombres de habilidades salen cortados.
- **Títulos de categoría para el juego:** la mitad de los héroes los lleva con minutos («Fase inicial 0-10 · …») y la otra mitad sin ellos.
- **Fase final de 7 héroes** (Vindicta, Ivy, Warden, Victor, Apollo, Rem y Abrams): algún paso vende un objeto que es opcional. Si no lo compraste, ese paso no aplica. Ya pasaba antes de hoy.
- **Las cifras de los textos son del 25 al 27 de octubre**; los datos diarios se actualizan solos, pero los textos no.

## Fuentes de esta entrega

- **API pública de Deadlock** (api.deadlock-api.com):
  - estadísticas de objetos por rango y por minuto de compra;
  - orden de habilidades;
  - builds de la comunidad;
  - fichas de objetos (componentes y valores).
- **deadlock.wiki** (coste de la bomba de Lady Geist).
