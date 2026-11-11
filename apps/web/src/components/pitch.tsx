import { useId } from "react";
import { decimal, playerLabel, type Shot } from "@/lib/contracts";
import { hasEndpoint, pitchViewBox } from "@/lib/shot-geometry";

export default function Pitch({ shots, allShots = shots, playerName, index, selected, onSelect }: {
  shots: Shot[]; allShots?: Shot[]; playerName: string; index: number; selected: string | null; onSelect: (id: string) => void;
}) {
  const color = index === 0 ? "var(--player-one)" : "var(--player-two)";
  const arrowId = `shot-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return <figure className="pitch-figure">
    <figcaption><span className="player-dot" style={{ background: color }} />{playerLabel(playerName)}<span className="attack-direction">Ataque →</span></figcaption>
    <svg className="pitch" viewBox={pitchViewBox(allShots)} aria-label={`Origen y destino de los tiros de ${playerLabel(playerName)}. Selecciona un tiro para ver su detalle.`}>
      <defs><marker id={arrowId} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="2.2" markerHeight="2.2" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 6 3 0 6Z" fill={color} /></marker></defs>
      <g className="pitch-lines" fill="none" strokeWidth=".32">
        <rect x="0" y="0" width="120" height="80" />
        <path d="M60 0v80 M0 18h18v44H0 M120 18h-18v44h18 M0 30h6v20H0 M120 30h-6v20h6 M0 36h-2v8h2 M120 36h2v8h-2" />
        <circle cx="60" cy="40" r="9.15" />
        <path d="M18 32.7a9.15 9.15 0 0 1 0 14.6 M102 32.7a9.15 9.15 0 0 0 0 14.6" />
        <circle cx="60" cy="40" r=".35" fill="currentColor" /><circle cx="12" cy="40" r=".35" fill="currentColor" /><circle cx="108" cy="40" r=".35" fill="currentColor" />
      </g>
      <g className="shot-paths" aria-hidden="true" pointerEvents="none">
        {shots.filter(s => s.x !== null && s.y !== null && hasEndpoint(s)).map(s => <line key={s.event_id}
          className={`shot-path ${selected === s.event_id ? "selected-path" : ""}`} data-event-id={s.event_id}
          x1={s.x!} y1={s.y!} x2={s.end_x!} y2={s.end_y!} stroke={color} markerEnd={`url(#${arrowId})`}
          strokeWidth={selected === s.event_id ? .85 : .45} opacity={selected && selected !== s.event_id ? .3 : .85} />)}
      </g>
      {shots.filter(s => s.x !== null && s.y !== null).map(s => <g key={s.event_id}
        className="shot-marker" role="button" tabIndex={0}
        data-event-id={s.event_id} aria-label={`${s.minute}:${String(s.second).padStart(2, "0")}, ${s.is_goal ? "gol" : s.outcome}, ${decimal(s.xg)} xG${hasEndpoint(s) ? `, destino ${s.end_x}, ${s.end_y}` : ", destino no disponible"}`}
        aria-pressed={s.event_id === selected} onClick={() => onSelect(s.event_id)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(s.event_id); } }}>
        <title>{`${s.minute}′ · ${s.outcome} · ${decimal(s.xg)} xG`}</title>
        <circle cx={s.x!} cy={s.y!} r="3.2" fill="transparent" />
        {selected === s.event_id ? <circle cx={s.x!} cy={s.y!} r="2.9" fill="none" stroke="white" strokeWidth=".5" /> : null}
        <circle cx={s.x!} cy={s.y!} r="1.65" fill={s.is_goal ? color : "var(--pitch)"} stroke={color} strokeWidth=".65" />
      </g>)}
    </svg>
  </figure>;
}
