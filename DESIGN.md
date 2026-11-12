---
name: Messi / Mundial 2022
description: Photographic Argentina narrative entry and Spanish World Cup final analysis workspace.
colors:
  paper: "#f5f5f0"
  surface: "#fff"
  ink: "#202d29"
  muted: "#66716b"
  line: "#dedfd7"
  accent: "#275c47"
  accent-hover: "#1c4836"
  pitch: "#244c3d"
  pitch-line: "#91aa98"
  player-one: "#98deee"
  player-two: "#f3ce7b"
  danger: "#873a2e"
  focus: "#27715a"
  memory-ink: "#0b203b"
  memory-blue: "#b8e4ed"
  memory-paper: "#f2eee3"
  memory-muted: "#c2cfdc"
  memory-line: "#ffffff35"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "2rem"
    fontWeight: 550
    lineHeight: 1.25
    letterSpacing: "-.03em"
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.75rem"
    fontWeight: 550
    lineHeight: 1.25
    letterSpacing: "-.03em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.0625rem"
    fontWeight: 600
    letterSpacing: "-.02em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
  mono:
    fontFamily: "ui-monospace, monospace"
    fontSize: "0.875rem"
    lineHeight: 1.6
  memory-display:
    fontFamily: '"Barlow Condensed", sans-serif'
    fontSize: "clamp(4.2rem, 9.6vw, 9rem)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "-.02em"
  memory-headline:
    fontFamily: '"Barlow Condensed", sans-serif'
    fontSize: "clamp(3rem, 4.55vw, 6rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-.02em"
  memory-body:
    fontFamily: '"Manrope", sans-serif'
    fontSize: "clamp(1.125rem, 1.25vw, 1.375rem)"
    fontWeight: 400
    lineHeight: 1.5
  memory-label:
    fontFamily: '"Manrope", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  chip: "4px"
  control: "5px"
  pitch: "6px"
  composer: "8px"
  memory-square: "0"
  memory-circle: "50%"
spacing:
  compact: "8px"
  control: "12px"
  group: "16px"
  inset: "20px"
  section: "24px"
  conversation: "26px"
  header: "32px"
  memory-gutter: "5%"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    width: "34px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "8px 0"
  button-prompt:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "14px"
    width: "100%"
  button-result:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px"
    width: "100%"
  composer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.composer}"
    padding: "12px"
  filter-chip:
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "3px 9px"
  pitch:
    backgroundColor: "{colors.pitch}"
    rounded: "{rounded.pitch}"
    padding: "17px 15px 10px"
  memory-start-circle:
    backgroundColor: "transparent"
    textColor: "{colors.memory-paper}"
    rounded: "{rounded.memory-circle}"
    width: "44px"
    height: "44px"
---

# Design System: Messi / Mundial 2022

## Overview

**Creative North Star: "El juego en contexto"**

Este documento describe el sistema implementado. «El juego en contexto» es una referencia de trabajo tomada de la interfaz, no una marca confirmada. [PRODUCT.md](PRODUCT.md) define alcance y capacidades; el historial de cambios pertenece a Git y a los PR.

La ruta `/` presenta «La memoria albiceleste»: fotografía protagonista, fondo azul noche, titulares condensados y una galería con profundidad. `/analisis` conserva superficies claras, tipografía del sistema y canchas verdes. Cada superficie mantiene su identidad.

**Key Characteristics:**

- Fotografías rectangulares, opacas y con perspectiva en el showcase.
- Leyendas frontales con posiciones y tamaños estables entre capítulos.
- Paneles planos y jerarquía tipográfica en el análisis.
- Colores de jugador acompañados de nombres y evidencia inspeccionable.
- Lectura completa con zoom, movimiento reducido o sin JavaScript.

## Colors

El frontmatter reúne los valores de referencia; los estilos de cada ruta son la implementación comprobable.

| Superficie | Tokens | Uso |
| --- | --- | --- |
| Showcase | `memory-ink`, `memory-paper` | Fondo continuo y texto principal |
| Showcase | `memory-blue`, `memory-muted`, `memory-line` | Año, relato, ubicación, texto auxiliar y divisores |
| Análisis | `paper`, `surface`, `ink`, `muted`, `line` | Lienzo, paneles, lectura y separación |
| Análisis | `accent`, `accent-hover`, `focus`, `danger` | Acciones, foco y recuperación de errores |
| Análisis | `pitch`, `pitch-line`, `player-one`, `player-two` | Campo y marcadores de Messi y Mbappé |

**The Route Scope Rule.** Aplicar los tokens `memory-*` solo al showcase; conservar el sistema analítico en `/analisis`.

La selección de texto y las barras de scroll siguen la paleta de su superficie. El análisis usa el acento para el cursor de escritura. Mantener contraste mínimo de 4.5:1 en texto normal y 3:1 en texto grande.

## Typography

El showcase carga Barlow Condensed Bold para titulares, años y resultados, y Manrope para lectura. El análisis usa la pila del sistema; los identificadores de evidencia usan monoespaciada. Conservar texto erguido, títulos sin punto final y cifras tabulares.

La portada usa `memory-display`; las leyendas mejoradas usan `memory-headline` y `memory-body`. El año conserva texto HTML con cifras alineadas y tamaño compartido (`clamp(9rem,15.5vw,19rem)`); los resultados usan `clamp(6rem,8vw,9rem)`. Las ubicaciones comparten la escala del relato y los equipos y competiciones usan 1rem. Marca y enlace de entrada usan `memory-label`.

En lectura vertical, los títulos vuelven a `clamp(2.3rem,4vw,4.2rem)` y el relato a 1.125rem. El análisis usa las escalas `display`, `headline`, `title`, `body`, `label` y `mono`; la lectura y el compositor usan 1rem y el texto auxiliar parte de .875rem.

**The Scalable Reading Rule.** Conservar lectura y acciones al duplicar el texto o personalizar su espaciado. Permitir redistribución antes que recortar contenido para mantener una composición.

## Layout

La entrega cubre escritorio y laptop a 1440×800, 1440×1000 y 1920×1080. Los modos estrechos conservan lectura y accesibilidad; no constituyen una variante de producto móvil.

### Showcase

La portada llena la primera vista (`100svh`, mínimo 680px). La marca de tres estrellas en disposición triangular queda arriba a la izquierda; el título de dos líneas y «Recorrer la historia» quedan abajo a la izquierda. La portada sale con el scroll vertical antes de entrar en la galería.

La galería mejorada ocupa una vista (`100svh`, mínimo 740px). Las fotografías usan el 62% del ancho y una altura limitada por la banda de leyendas (`min(60svh,calc(100svh - var(--gallery-copy-height) - 24px))`). La banda inferior reserva `clamp(19rem,38svh,27rem)`, con márgenes laterales del 5% y relleno vertical de 24px.

Una retícula compartida distribuye año, relato y resultado en tres columnas (`max-content minmax(0,1.4fr) minmax(0,1fr)`). Todas las leyendas, incluidas las inactivas, contribuyen a las mismas tres filas mediante `subgrid`. Año, título y ubicación se alinean por la parte superior visible; relato y competición comparten la fila inferior. Cambiar de capítulo modifica la visibilidad y el estado accesible, no la geometría ni el tamaño del texto.

La portada y la galería incluyen marca, enlace de entrada, enlace de salto y un recorrido enfocable. Los fragmentos de URL, el historial, las flechas, Home/End y PageUp/PageDown complementan scroll y arrastre. El índice, la línea de tiempo, los botones anterior/siguiente y la invitación final al análisis fueron retirados. `/analisis` sigue disponible por su ruta.

### Lectura accesible

El documento servido desde el servidor contiene todos los capítulos en vertical. La mejora se desactiva con movimiento reducido, ancho menor de 1000px, altura menor de 740px, raíz tipográfica mayor de 20px, interlineado del título mayor de 1.35 o tracking mayor de .08em. ResizeObserver y los cambios de preferencia permiten restaurarla cuando vuelve a haber espacio.

En lectura vertical, las fotos quedan centradas, con ancho del 90% y máximo de 1200px; el texto fluye debajo. Conservar las reglas estrechas existentes, el foco visible y los anclajes. Sin JavaScript o si falla la mejora, la historia sigue disponible.

### Análisis

El espacio analítico ocupa `100dvh` con mínimo de 560px y cabecera de 76px. La conversación usa una columna entre 320px y 390px; la visualización ocupa el ancho restante. Ambos paneles desplazan su contenido de forma independiente. Las comparaciones muestran dos canchas de igual escala con separación de 18px.

Hasta 1050px, la conversación usa 330px y las canchas se apilan. Desde 1700px, la conversación crece a 430px y las canchas admiten hasta 430px de alto. Conservar la redistribución de lectura existente y el scroll interno de tablas cuando su contenido lo requiera.

## Elevation & Depth

El análisis separa grupos con superficies, bordes y espacio, sin sombras. La portada usa un sombreado lateral y un desvanecido inferior que termina en el fondo continuo; conservar el borde inferior sin costuras.

Loopem controla la perspectiva de la galería: foto central frontal, vecinas giradas, imágenes opacas y extremos acotados. La geometría escala con el ancho de la foto: step 100, spread 80, depth 86 y perspective 900, multiplicados por ancho/220; angle 56 y reach 5. Las leyendas permanecen en un plano frontal.

El scroll vertical dentro de la galería actualiza la posición horizontal, con ajuste al capítulo más cercano tras 120 ms; en los extremos permite salir verticalmente. El arrastre y el scroll horizontal usan Loopem. GSAP queda disponible para navegación programática de 280 ms con `power3.out`; el teclado y los fragmentos actuales cambian de posición sin animación. Conservar la interrupción del movimiento y evitar renderizados React por fotograma.

## Shapes

Las fotos del showcase son rectángulos sin bordes decorativos, radios ni sombras. El círculo de entrada contiene una flecha SVG. El análisis conserva esquinas discretas: chips de 4px, controles de 5px, cancha de 6px y compositor de 8px. Marcadores, leyendas de jugador y estados de selección mantienen su forma circular.

## Components

### Fotografías y leyendas

Los 21 capítulos se definen en `apps/web/src/app/page.tsx`. Las imágenes se alojan en `apps/web/public/memoria/`; `sources.json` y `seleccion/selection.json` conservan las URLs originales. Los prototipos `playbook-*.html` documentan exploraciones anteriores y no sustituyen la implementación actual.

MuseumPhoto usa `next/image`, importaciones estáticas y una reserva desenfocada; solo precarga la portada. Loopem crea sus imágenes desde el documento original. `object-fit: cover` llena el marco; las fotos de Quito 2017 y Brasil 2013 se alinean arriba para preservar el sujeto. Cuando falla una foto, aparece una reserva azul con el mensaje «La fotografía no está disponible. La historia continúa.» y el relato permanece legible.

Cada resultado expone competición, equipos y goles mediante un grupo accesible. Las tandas se muestran separadas. El debut de 2005 incluye la tarjeta roja y el minuto 64; el capítulo de 2023 presenta ocho Balones de Oro y France Football en lugar de un resultado. El capítulo de 2025 registra Argentina 3–0 Venezuela en Buenos Aires, el 4 de septiembre, rumbo al Mundial 2026. Su foto elegida tiene un nombre de origen fechado en 2024: el texto alternativo describe la celebración sin atribuirla al partido de 2025.

Las fuentes de los capítulos añadidos se conservan como referencia factual: [debut de 2005, AFA](https://www.afa.com.ar/es122/posts/hace-18-anos-debutaba-leo-messi-en-la-seleccion-argentina), [camiseta 10 en 2009, FIFA](https://www.fifa.com/es/articles/messi-a-20-anos-de-un-debut-muy-especial), [clasificación de 2013, AFA](https://www.afa.com.ar/Sitio/posts/quiero-vale-cuatro), [Quito 2017, AFA](https://www.afa.com.ar/Sitio/posts/un-poco-de-historia-historial-ante-ecuador), [Balón de Oro de 2023, AFA](https://www.afa.com.ar/A/posts/messi-emblema-del-futbol-argentino-y-simbolo-mundial-se-adjudico-su-octavo-balon-de-oro) y [Argentina–Venezuela de 2025, APF](https://www.apf.org.py/partidos/qualifying-world-cup-2026-conmebol-world-cup-qualifiers-17-argentina-vs-venezuela).

### Conversación y evidencia

El compositor agrupa textarea y acción de envío, cambia el borde al enfocar y permite Enter para enviar y Shift+Enter para nueva línea. Los mensajes se separan con bordes; cada resultado recuperable muestra contexto y `aria-pressed`. Mantener visibles los resultados previos durante consultas pendientes o errores.

Las canchas conservan la geometría completa y la misma escala en comparación. Los goles usan marcadores rellenos; otros resultados, huecos. La cancha, el arco y la lista de eventos comparten el tiro seleccionado; la tabla comparte sus filtros. Las alturas faltantes quedan identificadas. Los identificadores largos se redistribuyen y los desplegables permiten inspeccionar la evidencia.

### Verificación

`apps/web/tests/museum.spec.ts` comprueba las posiciones y tamaños de todos los capítulos en las tres resoluciones, navegación, extremos, opacidad, movimiento reducido, fallos de imagen y lectura sin JavaScript. `typography.spec.ts` cubre contraste, texto duplicado y espaciado personalizado. Su comprobación conjunta de contraste de ambas rutas requiere la API local para poblar el análisis. Los resultados de cada ejecución deben registrarse en el PR; estas pruebas no equivalen a una certificación integral de accesibilidad.

## Do's and Don'ts

### Do:

- Do conservar los sistemas visuales de cada ruta.
- Do mantener las posiciones y tamaños compartidos de las leyendas al añadir capítulos.
- Do preservar sujetos fotográficos, procedencia, anclajes, historial y lectura accesible.
- Do distinguir goles, tandas, premios y alturas desconocidas con texto y estructura.
- Do comprobar el contenido real en las tres resoluciones de escritorio.

### Don't:

- Don't deformar el año ni medirlo por capítulo para ajustarlo al relato.
- Don't girar las leyendas ni añadirles fondos, sombras de texto o decoración.
- Don't introducir controles retirados desde los prototipos históricos.
- Don't recortar la cancha ni alterar la escala entre jugadores.
- Don't atribuir a una fotografía un partido o una fecha que su fuente no confirma.
