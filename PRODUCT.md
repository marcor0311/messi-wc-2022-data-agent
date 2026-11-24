# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Explorar la historia de Messi con Argentina y los datos de la final del Mundial 2022. El showcase fotográfico «La memoria albiceleste» ocupa `/`; la conversación con visualizaciones y evidencia vive en `/agent`. La interfaz y sus contenidos están en español.

## Operating Context

La galería recorre 22 capítulos de 2005 a 2026 mediante fotografías, relatos breves y resultados. La portada precede al recorrido horizontal con profundidad. Scroll, arrastre, teclado y enlaces con fragmento permiten explorar la historia y recuperar una posición.

## Capabilities and Constraints

El alcance confirmado es solo escritorio y laptop. Validar a 1440×800, 1440×1000 y 1920×1080. Mantener lectura accesible, zoom, espaciado personalizado y movimiento reducido; los respaldos de redistribución no amplían el alcance a móvil. Presentar las propuestas visuales separadas de la página principal hasta que el usuario apruebe integrarlas.

Next.js y TypeScript sirven la interfaz; FastAPI y Python ejecutan el agente general mediante Responses y herramientas Gold validadas. La conversación de `/agent` requiere sesión OAuth y permite elegir el modelo por pregunta. LangGraph permanece en los endpoints del prototipo anterior y no dirige el chat actual.

Las cifras, la cancha, el arco y el detalle de eventos deben partir de una selección común. Excluir las tandas de penales de las métricas de partido. Mostrar origen y destino de los tiros; representar en el arco solo las alturas conocidas, sin estimarlas. Creación de tiros, recepciones, conexiones, alineaciones y sus cambios ya forman parte del agente actual; el alcance analítico cubre los siete partidos de Argentina en Qatar 2022.

## Evidence on Hand

Los artefactos Gold de StatsBomb están en `data/gold/statsbomb/wc2022/`, con manifiestos y evidencia por evento. La conversación lee estos artefactos inmutables sin requerir PostgreSQL activo; las migraciones conservan el modelo de base de datos.

Los capítulos y sus resultados están en `apps/web/src/app/page.tsx`. Las fotos se alojan en `apps/web/public/memoria/`; `sources.json` y `seleccion/selection.json` registran su procedencia. Una fotografía elegida puede ilustrar un capítulo sin pertenecer a ese partido: el texto alternativo debe describir lo visible sin atribuirle una fecha no verificada.

## Product Principles

- Conservar el contexto y los resultados anteriores: mientras una nueva consulta carga, el panel muestra un esqueleto y los resultados previos siguen disponibles en la conversación; si la consulta falla, vuelve el resultado anterior.
- Derivar cifras y visualizaciones de la misma selección de eventos.
- Mantener cada capítulo legible cuando fallen la imagen o la mejora visual.
- Pedir aclaración cuando una consulta exceda las capacidades implementadas.

## Confirmed Direction

El showcase usa fotografías con profundidad, tipografía frontal y leyendas que conservan posición y tamaño al cambiar de capítulo. Los 22 capítulos incluyen el Balón de Oro de 2023 y la última eliminatoria de Messi como local en 2025. «El fin de una era» cierra el recorrido con Messi saludando y el marcador Argentina 3–0 Benín del amistoso de despedida, disputado el 6 de octubre de 2026 en el Monumental. El teclado y los fragmentos de URL complementan el scroll y el arrastre. Con movimiento reducido, texto ampliado, espacio insuficiente o sin JavaScript, el recorrido conserva el documento vertical completo.

El análisis mantiene una presentación sobria centrada en la cancha, con comparación a igual escala, historial recuperable y evidencia inspeccionable. [DESIGN.md](DESIGN.md) define las reglas visuales vigentes de ambas rutas.

## Open Decisions

La conversación actual escribe para analistas y usa el modelo elegido de la cuenta. La dirección del showcase está aprobada; la identidad general fuera de estas dos superficies sigue abierta.
