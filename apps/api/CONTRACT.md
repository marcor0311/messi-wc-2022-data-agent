# Contrato de conversación 1.0

La API es dueña del contexto y de las selecciones de Gold. El navegador envía
texto y referencias de contexto, nunca cifras o filtros para sobrescribir estado.
Los modelos Pydantic están en `src/app/agent/models.py`; los tipos TypeScript,
en `../web/src/lib/contracts.ts`. Las respuestas HTTP validan el contrato y
OpenAPI expone sus esquemas.

## Respuesta de cada turno

| Campo | Significado |
| --- | --- |
| `contract_version` | `1.0` |
| `status` | `result`, `empty` o `clarification` |
| `explanation` | Texto derivado de los datos o aclaración de alcance |
| `visualization_action` | `create`, `update` o `retain` |
| `visualization` | Snapshot completo del mapa/comparación; nulo antes del primer resultado |
| `applied_filters` | Partido, IDs de jugadores, exclusión de penales y período |
| `state` | Selección actual, métrica, ID visual activo y evento seleccionado |
| `evidence` | Carga Gold, hashes de definiciones/consulta, commit y cargas de origen, UUID de eventos, enlace a los eventos originales |
| `tool_name` | `gold_shots`, `gold_compare_shots`, o nulo si no hubo consulta |

`visualization.type` admite `shot_map` y `shot_comparison`. `data` contiene
`scope`, `match_label`, `shots`, `summaries` y `evidence`. Las coordenadas son
StatsBomb 120 × 80; el ataque siempre aumenta x. La comparación usa dos canchas
con la misma escala, para evitar que se tapen tiros de jugadores distintos.

Cada tiro incluye `end_x`, `end_y` y `end_z` opcionales y nulos cuando no se
conocen. La cancha dibuja un segmento de `(x,y)` a `(end_x,end_y)`; no reconstruye
el vuelo. Debajo se representa `(end_y,end_z)` frente al arco, desde el rematador.
El marco nativo va de y=36 a y=44, suelo z=0 y travesaño z=2.67, según el
[Apéndice 2 de StatsBomb](https://github.com/hudl/open-data/blob/master/doc/StatsBomb%20Open%20Data%20Specification%20v1.1.pdf).
Los límites se comparten entre jugadores y se amplían para incluir tiros fuera
del marco. Destinos anteriores a x=120 se dibujan como rombos: su proyección
lateral/vertical no implica un cruce de la línea. No se extrapola ningún destino.

`endpoint_data_version=1` identifica resultados con soporte de destinos. Su
valor predeterminado 0 permite leer snapshots anteriores. Al abrir o recuperar
historial, la API completa su presentación con los destinos de la misma carga
Gold únicamente si coinciden todos los eventos, sus atributos y los resúmenes.
La escritura original, los filtros, la selección y la evidencia de la consulta
permanecen intactos. `endpoint_definitions_sha256` identifica por separado las
definiciones que completaron esas coordenadas. Si la carga no coincide o no está
disponible, se conserva el resultado original y la UI ofrece volver a consultar.

Una visualización nueva recibe un ID nuevo. Cambiar filtros o añadir un comparador
en el mismo partido actualiza el mismo ID visual. Cambiar de partido crea otro
ID (la interpretación de otros partidos queda fuera del alcance inicial).
Una aclaración retiene el resultado previo, sin ejecutar herramientas. Cada turno
guarda su propio snapshot aunque comparta ID visual; actualizar nunca altera uno
anterior. No hay patches parciales que dependan de recomponer turnos viejos.

## Herramientas Gold

`GoldRepository.gold_shots(ShotScope)` exige un jugador.
`GoldRepository.gold_compare_shots(ShotScope)` exige dos jugadores diferentes.
`ShotScope` valida `match_id`, `player_ids`, `exclude_penalties` y `period` (1–4).
El repositorio rechaza IDs desconocidos y ambas herramientas llaman a la misma
selección de eventos. No se mezclan agregados de `player_match` con mapas filtrados.
No se ejecuta SQL generado libremente ni se necesita red para consultar.

Los resúmenes cuentan exactamente los eventos devueltos. xG es la suma de
`statsbomb_xg`, goles son eventos con `is_goal=true`. Excluir penales elimina
solo `is_penalty=true`; no significa juego abierto. Las tandas se excluyen siempre.
Un tiro sin coordenadas permanece en el conteo y se declara en `unlocated_shots`;
no se inventa un punto. Un xG ausente produce `xg=null` y `missing_xg>0`.
Una selección vacía devuelve cero tiros, cero goles, cero xG y evidencia vacía.

Gold v1 conserva destinos horizontales, pero no la altura. El adaptador enlaza
`end_z` de `silver.shots` exclusivamente por `(match_id,event_id)` contra el padre
referenciado en `source_manifest_hashes.base` y `source_load_ids.base`. Verifica
manifiesto, commit y checksum de `shots.jsonl`, y rechaza diferencias de destino
horizontal entre capas. La evidencia opcional `shot_height_source` documenta esa
carga, ambos hashes y los eventos seleccionados con altura conocida. No añade
eventos ni cambia métricas. Sin altura conocida no hay punto frontal y se informa
cuántos tiros se omiten de esa vista. Los tiros bloqueados no se prolongan al arco.

## Estado, continuidad y recuperación

El grafo LangGraph resuelve intención → consulta tipada → composición. El
intérprete actual es determinista y acotado: no pretende resolver lenguaje libre.
Una futura interpretación con modelo debe seguir invocando estas herramientas
y producir el mismo contrato.

1. `POST /api/conversations` crea una conversación.
2. `POST /api/conversations/{id}/turns` recibe `message`, `base_turn_id` obligatorio
   (nulo en el primer turno) y `selected_event_id` opcional. La API hereda el
   contexto guardado y modifica únicamente lo que la petición expresa.
3. `GET /api/conversations/{id}` recupera historial y `active_turn_id`.
4. `POST /api/conversations/{id}/activate` recibe `turn_id` y
   `expected_active_turn_id`. Activa un snapshot de esa conversación. El siguiente
   turno conserva esa selección y registra `parent_turn_id` apuntando al recuperado.

«Quita los penales» solo cambia `exclude_penalties`. «Compáralo con Mbappé»
conserva el primer jugador, partido y filtros y añade el comparador. «Ese tiro»
requiere una selección explícita que exista entre los eventos del resultado
activo. Un UUID ajeno no se usa como evidencia.

SQLite guarda turnos inmutables y el puntero activo en transacciones. Las
conversaciones se aíslan por ID. Un contexto desactualizado devuelve 409 y no
escribe un turno. Recuperar un turno ajeno devuelve 404. Ante un error de Gold
se devuelve 503; un fallo inesperado devuelve 500 con un mensaje recuperable y
sin exponer detalles internos. Un fallo revierte toda la escritura del turno.

La UI conserva el mapa durante las consultas y los errores, restaura el texto
fallido, ofrece reintentar y reconcilia la conversación antes de repetir una
petición cuya respuesta se perdió. Recargar conserva tanto el historial como
el resultado activo. Crear una nueva conversación mantiene la anterior en disco.
