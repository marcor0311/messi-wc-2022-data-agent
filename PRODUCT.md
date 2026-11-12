# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Explorar la historia de Messi con Argentina y los datos de la final del Mundial 2022. El showcase fotográfico «La memoria albiceleste» ocupa `/`; la conversación con visualizaciones y evidencia vive en `/analisis`. La interfaz y sus contenidos están en español.

## Operating Context

La galería recorre 21 capítulos de 2005 a 2026 mediante fotografías, relatos breves y resultados. La portada precede al recorrido horizontal con profundidad. Scroll, arrastre, teclado y enlaces con fragmento permiten explorar la historia y recuperar una posición.

En `/analisis`, la conversación está a la izquierda y el espacio visual a la derecha. Las consultas implementadas son «Muéstrame los tiros de Messi en la final», «Quita los penales» y «Compáralo con Mbappé». Cada turno conserva partido, filtros y resultado; recuperar un turno restaura ese contexto.

## Capabilities and Constraints

El alcance confirmado es solo escritorio y laptop. Validar a 1440×800, 1440×1000 y 1920×1080. Mantener lectura accesible, zoom, espaciado personalizado y movimiento reducido; los respaldos de redistribución no amplían el alcance a móvil. Presentar las propuestas visuales separadas de la página principal hasta que el usuario apruebe integrarlas.

Next.js y TypeScript sirven la interfaz; FastAPI, Python y LangGraph resuelven el análisis. La conversación actual usa los datos locales validados y requiere la API. La conexión con un modelo de IA queda pendiente.

Las cifras, la cancha, el arco y el detalle de eventos deben partir de una selección común. Excluir las tandas de penales de las métricas de partido. Mostrar origen y destino de los tiros; representar en el arco solo las alturas conocidas, sin estimarlas. Creación, recepciones, conexiones y alineaciones quedan para entregas posteriores.

## Evidence on Hand

Los artefactos Gold de StatsBomb están en `data/gold/statsbomb/wc2022/`, con manifiestos y evidencia por evento. La conversación lee estos artefactos inmutables sin requerir PostgreSQL activo; las migraciones conservan el modelo de base de datos.

Los capítulos y sus resultados están en `apps/web/src/app/page.tsx`. Las fotos se alojan en `apps/web/public/memoria/`; `sources.json` y `seleccion/selection.json` registran su procedencia. Una fotografía elegida puede ilustrar un capítulo sin pertenecer a ese partido: el texto alternativo debe describir lo visible sin atribuirle una fecha no verificada.

## Product Principles

- Conservar el contexto y los resultados anteriores durante nuevas consultas o errores.
- Derivar cifras y visualizaciones de la misma selección de eventos.
- Mantener cada capítulo legible cuando fallen la imagen o la mejora visual.
- Pedir aclaración cuando una consulta exceda las capacidades implementadas.

## Confirmed Direction

El showcase usa fotografías con profundidad, tipografía frontal y leyendas que conservan posición y tamaño al cambiar de capítulo. Los 21 capítulos incluyen el Balón de Oro de 2023 y la última eliminatoria de Messi como local en 2025. El teclado y los fragmentos de URL complementan el scroll y el arrastre. Con movimiento reducido, texto ampliado, espacio insuficiente o sin JavaScript, el recorrido conserva el documento vertical completo.

El análisis mantiene una presentación sobria centrada en la cancha, con comparación a igual escala, historial recuperable y evidencia inspeccionable. [DESIGN.md](DESIGN.md) define las reglas visuales vigentes de ambas rutas.

## Open Decisions

La audiencia contempla analistas y aficionados, pero su prioridad sigue abierta. La dirección del showcase está aprobada; la identidad general fuera de estas dos superficies y la integración con un modelo de IA siguen pendientes.
