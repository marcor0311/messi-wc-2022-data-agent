# Messi · Football Data Agent

El laboratorio conversacional del Mundial 2022 de Messi está en `/agent`. Consulta Gold con herramientas validadas, compara jugadores y alineaciones, y renderiza ocho visualizaciones. La portada del museo y `/analisis` conservan sus recorridos previos.

## Preparar

Requiere los Gold locales existentes, Python 3.11+, Node 20.9+ y una cuenta elegible para uso del plan ChatGPT mediante OAuth. No se usan API keys.

```sh
uv venv .venv
uv pip install --python .venv/bin/python -e 'apps/api[test]'
npm --prefix apps/web ci
.venv/bin/python scripts/discover_gold.py
.venv/bin/python scripts/generate_demo.py
```

## Ejecutar el agente

Terminal 1, desde la raíz:

```sh
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

Terminal 2:

```sh
npm --prefix apps/web run dev -- --hostname 127.0.0.1 --port 3000
```

Abre http://127.0.0.1:3000/agent y pulsa **Continue with ChatGPT**. Completa autorización y consentimiento en OpenAI. El modelo se descubre de la cuenta autenticada; puede elegirse en la interfaz. Sin autenticar, el explorador determinista permite verificar datos y visualizaciones. Eso no constituye una conversación con un modelo.

Si 8000/3000 están ocupados, esta es la configuración alternativa usada para verificar la entrega:

```sh
AGENT_CALLBACK=http://127.0.0.1:8001/auth/callback AGENT_WEB_ORIGIN=http://127.0.0.1:3001 .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --no-access-log
# En otra terminal:
API_URL=http://127.0.0.1:8001 NEXT_DIST_DIR=.next-agent npm --prefix apps/web run dev -- --hostname 127.0.0.1 --port 3001
```

Abre http://127.0.0.1:3001/agent. Usa `127.0.0.1`, como requiere el callback OAuth. Ejecuta un único proceso API. Las credenciales se guardan con permisos 0600 en `data/agent/credentials.json`; el historial autenticado en `data/agent/chats.sqlite3`. No se incluyen en Git. `AGENT_AUTH_FILE` y `AGENT_GOLD_DB` permiten cambiar sus rutas.

## Documentación y verificación

- [Guía de demo: 27 consultas centradas en Messi](docs/DEMO_CHEAT_SHEET.md).
- [Catálogo semántico Gold](docs/GOLD_CATALOG.md) y [esquemas completos](docs/GOLD_CATALOG.json).
- [Jugadores, selecciones y partidos](docs/GOLD_ENTITIES.json).
- [Arquitectura y límites](docs/ARCHITECTURE.md).
- [Resultados y estado de autorización](docs/VERIFICATION.md).

```sh
.venv/bin/python -m pytest apps/api/tests -q
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm --prefix apps/web run test:e2e -- tests/data-agent.spec.ts --project=desktop
```

La verificación de consultas contra Gold, las pruebas con modelos simulados y una inferencia OAuth real son pruebas diferentes. Consulta el informe para el estado comprobado de cada una.

---

# Prototipo anterior: museo y conversación acotada
Primera conversación funcional sobre los tiros de la final, conectada a eventos
reales de Gold. Next.js + TypeScript, FastAPI + Python y LangGraph.

```text
Muéstrame los tiros de Messi en la final
Quita los penales
Compáralo con Mbappé
```

La comparación conserva la final y la exclusión de penales. Cada turno guarda
su resultado y contexto; «Recuperar» permite continuar desde un turno anterior.
Selecciona un punto o evento y pregunta «ese tiro» para consultar su detalle.
La cancha muestra origen y destino con flechas; debajo, la vista frontal del
arco sitúa el destino según su posición lateral y altura registrada. Seleccionar
un tiro lo resalta en ambas vistas. Los rombos identifican tiros detenidos antes
de la línea de gol, y los tiros sin altura se conservan en la cancha.

## Ejecutar localmente

Requiere Python 3.11+, Node 20.9+ y un artefacto Gold v1 previamente construido.
Los datos regenerables están fuera de Git. La aplicación lee Gold directamente;
PostgreSQL no es necesario para este primer recorrido.

```sh
uv venv .venv
uv pip install --python .venv/bin/python -e 'apps/api[test]'
npm --prefix apps/web ci
```

En una terminal desde la raíz:

```sh
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

En otra:

```sh
npm --prefix apps/web run dev -- --hostname 127.0.0.1
```

Abre [la aplicación local](http://127.0.0.1:3000). La portada `/` es **La memoria
albiceleste**, una portada que sale verticalmente y una galería con profundidad
que avanza horizontalmente con el scroll nativo. La galería está dirigida solo
a escritorio; los modos estrechos conservan la lectura como respaldo accesible.
Conserva los quince capítulos fotográficos y sus resultados. Las leyendas comparten
una retícula que reserva espacio para los textos más largos: el año, título,
subtítulo, ubicación y marcador mantienen su posición y tamaño al cambiar de
capítulo. El recorrido admite scroll, arrastre, flechas del teclado, Home/End y
PageUp/PageDown; los enlaces directos y el historial conservan la navegación.
El panel de conversación está en [`/analisis`](http://127.0.0.1:3000/analisis),
disponible mediante esa ruta. Las fotografías y
tipografías se sirven localmente; `apps/web/public/memoria/sources.json` y
`apps/web/public/memoria/seleccion/selection.json` conservan la procedencia existente.
Solo la foto de portada se precarga; las vecinas se cargan al acercarse. Con
movimiento reducido, texto o espaciado ampliado, menos de 1000 px de ancho o 740 px
de alto, o sin JavaScript, los capítulos se leen en un documento vertical completo.

El navegador usa `/api` a través
del proxy de Next.js. `API_URL` permite cambiar el destino del proxy; exporta la
variable antes de iniciar Next.js. Las variables de `.env.example` son ejemplos,
no se cargan automáticamente desde la raíz.

Por defecto, la API selecciona el manifiesto más reciente por fecha de modificación
en `data/gold/statsbomb/wc2022/v1-*/`. Para fijar la carga, exporta `GOLD_ARTIFACT`
con la ruta absoluta de su carpeta. Se verifican todos los checksums antes de
leer; un artefacto ausente o corrupto devuelve un error recuperable, sin datos
inventados. La carga verificada permanece fija durante la vida del proceso.

La altura se lee de `shots.jsonl` en el Silver padre exacto referenciado por Gold,
verificando el hash del manifiesto, la carga, el commit y el checksum del archivo.
`SHOT_HEIGHT_ARTIFACT` permite indicar su carpeta cuando no está en la ruta local
estándar. Un padre ausente deja las alturas como desconocidas; uno configurado
incompatible o corrupto se rechaza. Los artefactos Gold v1 no se reescriben.
Los resultados guardados antes de añadir destinos completan automáticamente su
presentación al abrirlos si la misma carga Gold y la selección exacta de eventos
siguen disponibles. El registro original no se modifica. Si no es posible,
«Actualizar con destinos y vista del arco» permite volver a consultar conservando
los filtros activos.

Las conversaciones se guardan en `data/conversations.sqlite3`; `CONVERSATION_DB`
permite cambiar esa ruta. El navegador conserva el identificador de la conversación
actual. Esta entrega está orientada a ejecución local y no incluye autenticación.

## Contrato y alcance

Ver [contrato agente/interfaz](apps/api/CONTRACT.md). También está disponible el
esquema OpenAPI en [la API local](http://127.0.0.1:8000/docs).

El intérprete inicial usa intenciones acotadas en español dentro de LangGraph,
sin una clave de modelo. Admite Messi y Mbappé en la final, inclusión/exclusión de
penales, comparación y detalle del tiro seleccionado. Las consultas fuera de ese
alcance piden aclaración y conservan la visualización anterior. El adaptador Gold
ya valida IDs, partido, período y filtros; sus parámetros permiten ampliar luego
la interpretación sin cambiar el contrato visual.

## Verificación

```sh
.venv/bin/python -m pytest apps/api/tests -q
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
# Con ambos servidores activos y el Gold real local:
cd apps/web
npx playwright install chromium
npm run test:e2e -- --project=desktop
# Si la vista previa usa otro puerto:
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm run test:e2e -- --project=desktop
```

Las pruebas de API usan un Gold sintético sellado con checksums y cubren filtros,
historial, aislamiento, errores, datos ausentes y ausencia de resultados. Las de
navegador recorren los tres mensajes con el Gold real en escritorio,
recuperan un turno, seleccionan un tiro y recargan la página. Las pruebas de
error y ausencia de datos interceptan respuestas de forma explícita.
El recorrido también verifica saltos y retrocesos entre capítulos, estabilidad de
los elementos en los quince capítulos a 1440×800, 1440×1000 y 1920×1080,
navegación por teclado, movimiento reducido, fallos de imágenes y lectura sin
JavaScript. El alcance de entrega es solo escritorio.

Datos: [StatsBomb Open Data](https://github.com/statsbomb/open-data).
