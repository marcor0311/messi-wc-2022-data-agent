import { decimal, playerLabel, type Shot } from "@/lib/contracts";
import { beforeGoalLine, goalBounds, hasHeight } from "@/lib/shot-geometry";

export default function GoalMouth({ shots, allShots, playerName, index, selected, onSelect }: {
  shots: Shot[]; allShots: Shot[]; playerName: string; index: number; selected: string | null; onSelect: (id: string) => void;
}) {
  const color = index === 0 ? "var(--player-one)" : "var(--player-two)";
  const { left, right, height } = goalBounds(allShots);
  const located = shots.filter(hasHeight);
  const missing = shots.length - located.length;
  const tickStep = Math.max(1, Math.ceil(height / 6));
  const ticks = Array.from({ length: Math.ceil(height / tickStep) }, (_, i) => i * tickStep);
  return <figure className="goal-figure">
    <figcaption><span className="player-dot" style={{ background: color }} />{playerLabel(playerName)}<span>{located.length} de {shots.length} destinos con altura</span></figcaption>
    <svg className="goal-mouth" viewBox={`${left} ${-height} ${right - left} ${height + .85}`} aria-label={`Vista frontal del arco para ${playerLabel(playerName)}, desde el rematador. Altura en escala StatsBomb.`}>
      <g className="goal-grid" fill="none" strokeWidth=".025" aria-hidden="true">
        {ticks.filter(z => z > 0).map(z => <line key={z} x1={left + .8} x2={right - .3} y1={-z} y2={-z} />)}
        <path d={`M${left + .8} 0H${right - .3}`} />
      </g>
      <g className="goal-axis" aria-hidden="true">
        {ticks.map(z => <text key={z} x={left + .1} y={-z + .09} fontSize=".3">{z}</text>)}
        <text x="36" y=".52" textAnchor="middle" fontSize=".3">Izquierda</text>
        <text x="44" y=".52" textAnchor="middle" fontSize=".3">Derecha</text>
      </g>
      <path className="goal-frame" d="M36 0V-2.67H44V0" fill="none" strokeWidth=".12" aria-hidden="true" />
      {located.map(s => {
        const x = s.end_y!, y = -s.end_z!;
        const earlier = beforeGoalLine(s);
        return <g key={s.event_id} className="goal-marker" role="button" tabIndex={0}
          data-event-id={s.event_id} data-end-y={s.end_y} data-end-z={s.end_z} data-before-line={earlier}
          aria-pressed={selected === s.event_id} aria-label={`${s.minute}:${String(s.second).padStart(2, "0")}, ${s.outcome}, altura ${decimal(s.end_z, 1)} en escala StatsBomb${earlier ? ", detenido antes de la línea de gol" : ", en la línea de gol"}`}
          onClick={() => onSelect(s.event_id)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(s.event_id); } }}>
          <title>{`${s.minute}′ · ${s.outcome} · Altura ${decimal(s.end_z, 1)}${earlier ? " · Antes de la línea" : ""}`}</title>
          <circle cx={x} cy={y} r=".38" fill="transparent" />
          {selected === s.event_id ? <circle className="goal-selection" cx={x} cy={y} r=".31" fill="none" stroke="white" strokeWidth=".05" /> : null}
          {earlier ? <path className="goal-point" d={`M${x} ${y - .19}l.19 .19-.19 .19-.19-.19Z`} fill="var(--pitch)" stroke={color} strokeWidth=".06" />
            : <circle className="goal-point" cx={x} cy={y} r=".15" fill={s.is_goal ? color : "var(--pitch)"} stroke={color} strokeWidth=".06" />}
        </g>;
      })}
    </svg>
    {missing ? <p className="goal-missing">{missing} {missing === 1 ? "tiro sin altura registrada" : "tiros sin altura registrada"}; {missing === 1 ? "se muestra" : "se muestran"} en la cancha.</p> : null}
  </figure>;
}
