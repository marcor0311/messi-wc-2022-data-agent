# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Explorar datos de Messi en el Mundial 2022 mediante una conversación que transforma
un espacio visual y conserva el contexto entre turnos. La entrada `/` presenta
un recorrido fotográfico de Messi con Argentina y conduce al análisis de la
final de Qatar 2022 en `/analisis`.

## Operating Context

Primera entrega local: «Muéstrame los tiros de Messi en la final», «Quita los
penales», «Compáralo con Mbappé». La comparación conserva el partido y los filtros.
En `/analisis`, conversación en el panel izquierdo, espacio visual en el derecho. Recuperar un
turno recupera tanto su resultado como su contexto.

## Capabilities and Constraints

Alcance persistente confirmado por el usuario el 9 de noviembre de 2026:
solo desktop. Todas las propuestas visuales, implementaciones y validaciones
de interfaz deben centrarse en navegadores de escritorio y laptop. No ofrecer
variantes móviles ni ejecutar pruebas móviles salvo petición explícita del usuario.
Conservar los respaldos existentes de lectura accesible, zoom y movimiento reducido.
Las propuestas visuales se presentan separadas de la página principal hasta aprobarlas.

Next.js y TypeScript, FastAPI y Python, LangGraph. Gold contiene datos reales
StatsBomb con manifiestos y evidencia por evento. Los puntos y las cifras deben
derivarse de una selección común. Las tandas se excluyen de las métricas de partido.
Creación, recepciones, conexiones y alineaciones quedan para entregas posteriores.
Los tiros deben mostrar tanto origen como destino. Debajo de la cancha, una
vista frontal del arco muestra los destinos con altura conocida. Ambas vistas
comparten filtros y selección de eventos; las alturas faltantes no se estiman.
Toda la tipografía debe permitir lectura accesible: tamaños escalables, contraste,
ampliación, espaciado personalizable y redistribución del contenido. La validación
tipográfica de ambas rutas cubre WCAG 2.2 AA 1.4.3, 1.4.4, 1.4.10 y 1.4.12;
no constituye una certificación integral del sitio ni de las fuentes.

## Evidence on Hand

Artefactos Gold locales en `data/gold/statsbomb/wc2022/`. Las migraciones existentes
también definen Gold en PostgreSQL. La primera conversación lee el artefacto
inmutable y validado, sin requerir una base PostgreSQL activa.

## Product Principles

- Conservar el contexto explícitamente.
- Una selección de eventos alimenta cifras, mapa y evidencia.
- Conservar resultados anteriores al consultar o recuperarse de un error.
- Pedir aclaración cuando la petición excede el alcance implementado.

## Confirmed Direction

El usuario confirmó una herramienta de análisis en español, sobria y centrada
en la cancha, con conversación a la izquierda y recuperación de cada resultado
desde el historial. También aprobó implementar la entrada fotográfica inmersiva
«La memoria albiceleste» y, el 9 de noviembre de 2026, aprobó trasladar la
galería de `apps/web/public/playbook-memoria.html` a la página oficial incluyendo
todas las fotos. El objetivo de esta galería y su criterio de entrega son solo
escritorio; las redistribuciones estrechas son respaldo de lectura accesible.
La portada sale verticalmente antes de una galería fotográfica
con profundidad y desplazamiento horizontal ligado al scroll nativo. Se conservan
los quince capítulos, sus textos y resultados, y la invitación final al análisis.
El índice completo, la línea de tiempo contextual y los controles anterior/siguiente
permiten recorrerlos. El contenido permanece en un documento vertical con
movimiento reducido, tipografía ampliada, pantallas muy estrechas o bajas, o sin
JavaScript. Esta ampliación visual pertenece a `/`; el espacio analítico conserva
su sistema.

## Open Decisions

Se contemplan analistas y aficionados. La dirección de la galería de entrada
está aprobada; la identidad general y las preferencias visuales más allá de
estas dos superficies siguen abiertas. El usuario decidió dejar la conexión con
un modelo de IA para después.
