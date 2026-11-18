/*
 * The Gold catalog states its limitations in English (the model reads them too, so the contract stays as is).
 * The proposal shows them in Spanish; an unknown sentence is shown as received rather than guessed.
 */
const ES: Record<string, string> = {
  'No continuous tracking, speed, distance covered or physical workload.': 'No hay seguimiento continuo de jugadores: ni velocidad, ni distancia recorrida, ni carga física.',
  'Declared tactical positions are not measured player coordinates.': 'Las posiciones tácticas declaradas no son coordenadas medidas del jugador.',
  'Shootouts are separate from match actions and match metrics.': 'Las tandas de penales van aparte de las acciones y métricas del partido.',
  'Do not sum percentages; recompute from their numerators and denominators.': 'Los porcentajes no se suman: se recalculan a partir de sus numeradores y denominadores.',
  'Missing coordinates and unknown outcomes remain missing.': 'Las coordenadas que faltan y los resultados desconocidos se dejan vacíos; no se completan.',
  'No reliable minutes denominator; per-90 metrics are unsupported.': 'No hay minutos jugados fiables, así que no se calculan métricas por 90 minutos.',
  'Shot goals exclude own goals; team goals_for is the match score.': 'Los goles de tiros no incluyen autogoles; los goles de una selección son el marcador del partido.',
};
export const limitationEs = (text: string) => ES[text.trim()] ?? text;
