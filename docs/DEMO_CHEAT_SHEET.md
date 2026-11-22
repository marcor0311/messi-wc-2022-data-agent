# Demo: el Mundial de Messi

Gold `4f7a541c93d7271e6980966a0e5ba8614714567c1fea0b5391e7e6fede5e2ac9`. 7 partidos, 8 selecciones y 206 jugadores.

Protagonista: **Lionel Andrés Messi Cuccittini** (player_id 5503); comparador descubierto por volumen de tiros: **Lautaro Javier Martínez** (11456).

**Estado de verificación:** todas las consultas de esta guía se ejecutaron contra Gold. Esto verifica herramientas y datos; por sí solo no certifica que un modelo autenticado seleccione esas consultas. La inferencia y la conversación con cuenta real se verifican por separado; sus fechas, modelos y límites están en [VERIFICATION.md](VERIFICATION.md).

## Visualizaciones implementadas

| Vista | Qué muestra | Gold |
|---|---|---|
| table | Cifras exactas: un total se muestra como tarjetas, un listado como tabla. | * |
| bars | Compara jugadores, selecciones, partidos o períodos; cada métrica en su propio panel. | ['player_match', 'team_match', 'segment_player_metrics', 'actions', 'shot_creations'] |
| trend | Cómo cambia una métrica partido a partido, en orden cronológico. | ['player_match', 'team_match'] |
| pitch | Dónde ocurrió cada acción registrada y hacia dónde fue. No es seguimiento continuo. | ['actions', 'receipts'] |
| heatmap | Cuántas acciones ocurrieron en cada zona de la cancha (12 × 8). Cuenta eventos, no tiempo. | ['actions', 'receipts'] |
| network | Quién le pasó a quién: pases completados entre jugadores, en su ubicación promedio. | ['connections'] |
| lineup | Formación y posiciones declaradas, en un esquema. No son ubicaciones medidas. | ['initial_lineups'] |
| creation_chains | Cada tiro creado como una jugada: pase clave, recepción y tiro. Se agrega sola al consultar creación de tiros. | ['shot_creations'] |
| lineup_story | Cómo cambió la alineación durante el partido: cada cambio y ajuste táctico, con la posición de cada jugador. Se pide con la herramienta lineup_story. | ['lineup_segments'] |
| match_result | Marcador con escudos y línea de tiempo de goles, tarjetas y cambios. Solo partidos de Argentina; se pide con la herramienta match_result. | ['argentina_matches'] |

## Preguntas y consultas verificadas

1. **¿Cuántos tiros, goles, xG y npxG sumó Lionel Andrés Messi Cuccittini en el torneo?** — `table` / `player_match`. 1 filas devueltas de 7 filas de origen.

2. **Compara los tiros y npxG de Lionel Andrés Messi Cuccittini y Lautaro Javier Martínez en el torneo.** — `bars` / `player_match`. 2 filas devueltas de 14 filas de origen.

3. **¿Cómo evolucionó el xG de Lionel Andrés Messi Cuccittini partido a partido?** — `trend` / `player_match`. 7 filas devueltas de 7 filas de origen.

4. **Muestra los tiros de Lionel Andrés Messi Cuccittini en la final con sus destinos registrados.** — `pitch` / `actions`. 5 filas devueltas de 5 filas de origen.

5. **Quita los penales de los tiros de Lionel Andrés Messi Cuccittini en la final.** — `pitch` / `actions`. 4 filas devueltas de 4 filas de origen.

6. **Compara los tiros sin penal de Lionel Andrés Messi Cuccittini y Lautaro Javier Martínez en la final.** — `bars` / `actions`. 2 filas devueltas de 8 filas de origen.

7. **Muestra la densidad de las recepciones de Lionel Andrés Messi Cuccittini durante el torneo.** — `heatmap` / `receipts`. 63 filas devueltas de 387 filas de origen.

8. **¿Dónde recibió Lionel Andrés Messi Cuccittini en la final?** — `pitch` / `receipts`. 60 filas devueltas de 60 filas de origen.

9. **¿Con qué compañeros conectó pases Lionel Andrés Messi Cuccittini en la final?** — `network` / `connections`. 11 filas devueltas de 11 filas de origen.

10. **Muestra el once declarado de Argentina en la final.** — `lineup` / `initial_lineups`. 1 filas devueltas de 1 filas de origen.

11. **Compara ese once con el de France en la misma final.** — `lineup` / `initial_lineups`. 1 filas devueltas de 1 filas de origen.

12. **Muestra los dos onces de la final de Argentina, para comparar el contexto táctico de Lionel Andrés Messi Cuccittini.** — `lineup` / `initial_lineups`. 2 filas devueltas de 2 filas de origen.

13. **Ordena cronológicamente los tiros de Lionel Andrés Messi Cuccittini en la final.** — `pitch` / `actions`. 5 filas devueltas de 5 filas de origen.

14. **Muestra los pases de Lionel Andrés Messi Cuccittini en la primera parte de la final.** — `pitch` / `actions`. 24 filas devueltas de 24 filas de origen.

15. **¿Cómo cambió la creación de tiros de Lionel Andrés Messi Cuccittini por partido?** — `trend` / `player_match`. 7 filas devueltas de 7 filas de origen.

16. **¿Qué pases de Lionel Andrés Messi Cuccittini estuvieron vinculados a tiros durante el torneo?** — `table` / `shot_creations`. 19 filas devueltas de 19 filas de origen.

17. **Compara la precisión bajo presión de Lionel Andrés Messi Cuccittini y Lautaro Javier Martínez.** — `bars` / `player_match`. 2 filas devueltas de 14 filas de origen.

18. **¿Cuántas entradas al área por pase y conducción hizo Lionel Andrés Messi Cuccittini?** — `bars` / `player_match`. 1 filas devueltas de 7 filas de origen.

19. **¿Dónde realizó conducciones Lionel Andrés Messi Cuccittini en la final?** — `heatmap` / `actions`. 33 filas devueltas de 53 filas de origen.

20. **¿Qué conexiones de pase hacia Lionel Andrés Messi Cuccittini aparecen en el torneo?** — `table` / `connections`. 30 filas devueltas de 80 filas de origen (resultado limitado).

21. **¿Qué cambios de alineación realizó Argentina en la final?** — `table` / `lineup_changes`. 11 filas devueltas de 11 filas de origen.

22. **Muestra los segmentos tácticos declarados de Argentina en la final.** — `table` / `lineup_segments`. 12 filas devueltas de 12 filas de origen.

23. **¿Cómo se distribuyó la actividad de Lionel Andrés Messi Cuccittini por segmento táctico?** — `table` / `segment_player_metrics`. 63 filas devueltas de 63 filas de origen.

24. **¿Qué acciones de tanda de Lionel Andrés Messi Cuccittini están registradas?** — `table` / `shootout_actions`. 2 filas devueltas de 2 filas de origen.

25. **Compara recuperaciones, presiones y regates de Lionel Andrés Messi Cuccittini por partido.** — `bars` / `player_match`. 7 filas devueltas de 7 filas de origen.

26. **¿Cómo evolucionaron los tiros de Argentina a lo largo del Mundial de Lionel Andrés Messi Cuccittini?** — `trend` / `team_match`. 7 filas devueltas de 7 filas de origen.

27. **¿Cómo fue la precisión de pase de Lionel Andrés Messi Cuccittini en cada período de la final?** — `bars` / `actions`. 4 filas devueltas de 241 filas de origen.

## Partidos de Messi

- 2022-11-22: Argentina vs Saudi Arabia (`3857300`).
- 2022-11-26: Argentina vs Mexico (`3857289`).
- 2022-11-30: Argentina vs Poland (`3857264`).
- 2022-12-03: Argentina vs Australia (`3869151`).
- 2022-12-09: Argentina vs Netherlands (`3869321`).
- 2022-12-13: Argentina vs Croatia (`3869519`).
- 2022-12-18: Argentina vs France (`3869685`).

## Entidades, métricas y filtros

El inventario completo de jugadores, selecciones y partidos está en [GOLD_ENTITIES.json](GOLD_ENTITIES.json), y se sirve en `/api/agent/catalog`.
Todas las columnas, valores categóricos, rangos, coordenadas, métricas y definiciones están en [GOLD_CATALOG.json](GOLD_CATALOG.json).
Filtros admitidos: eq, ne, in (1–100 valores), gte, lte, contains, is_null; se combinan con AND. Hasta 4 dimensiones, 10 métricas y 500 filas. Las columnas se validan por dataset. Las ratios se recalculan desde sumas; no se promedian porcentajes.
Los contratos y consultas reproducibles de cada pregunta están en [DEMO_SCENARIOS.json](DEMO_SCENARIOS.json). Son evidencia de prueba, no respuestas o rutas predefinidas del agente.

## Límites

- No continuous tracking, speed, distance covered or physical workload.
- Declared tactical positions are not measured player coordinates.
- Shootouts are separate from match actions and match metrics.
- Do not sum percentages; recompute from their numerators and denominators.
- Missing coordinates and unknown outcomes remain missing.
- No reliable minutes denominator; per-90 metrics are unsupported.
- Shot goals exclude own goals; team goals_for is the match score.
- Las alineaciones se comparan de dos en dos en canchas identificadas; las posiciones son esquemáticas.
- Una red usa medias de ubicaciones de pases, no posiciones de seguimiento.
- El modelo explica estadísticas verificadas, pero sus textos requieren revisión; no hay garantía de ausencia de errores del LLM.
- El servicio está diseñado para uso local en loopback y un proceso de API. No es una instalación pública multiusuario.
- Sin autenticar, la pestaña Explorar datos muestra el catálogo; las consultas públicas están en /api/agent/query. No hay fallback de API keys ni de intenciones simuladas en /agent.
