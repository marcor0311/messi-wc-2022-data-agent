'use client';
/* Match result card: both crests with the score, then a horizontal timeline of goals, cards and substitutions.
   Only Argentina's seven 2022 World Cup matches exist in the payload (the API rejects any other match). */
import { useState, type CSSProperties, type ReactNode } from 'react';
import './match-result.css';

type Kind = 'goal' | 'penalty_goal' | 'own_goal' | 'yellow' | 'second_yellow' | 'red' | 'substitution';
type MatchEvent = { period: number; minute: number; second: number; team_id: number; player: string | null; player_in?: string | null; assist?: string | null; event_id: string; kind: Kind };
type Side = { team_id: number; name: string; score: number };
export type MatchSummary = {
  match_id: number; match_date: string; stage_name: string; home: Side; away: Side; extra_time: boolean;
  shootout: { home: number; away: number; kicks: { team_id: number; player: string | null; number?: number | null; scored: boolean }[] } | null;
  events: MatchEvent[];
};

const CREST: Record<number, string> = { 779: 'argentina', 799: 'arabia-saudita', 794: 'mexico', 789: 'polonia', 792: 'australia', 941: 'paises-bajos', 785: 'croacia', 771: 'francia' };
const NAME_ES: Record<string, string> = { 'Saudi Arabia': 'Arabia Saudita', Mexico: 'México', Poland: 'Polonia', Netherlands: 'Países Bajos', Croatia: 'Croacia', France: 'Francia' };
const STAGE_ES: Record<string, string> = { 'Group Stage': 'Fase de grupos, Grupo C', 'Round of 16': 'Octavos de final', 'Quarter-finals': 'Cuartos de final', 'Semi-finals': 'Semifinal', Final: 'Final' };
const KIND_ES: Record<Kind, string> = { goal: 'Gol', penalty_goal: 'Gol de penal', own_goal: 'Gol en contra', yellow: 'Tarjeta amarilla', second_yellow: 'Segunda amarilla', red: 'Tarjeta roja', substitution: 'Cambio' };
/* End minute of each period on the clock; stoppage time is drawn at the period's end and labelled 45+2'. */
const PERIOD_END = [0, 45, 90, 105, 120];

const teamName = (n: string) => NAME_ES[n] ?? n;
const clock = (e: MatchEvent) => { const end = PERIOD_END[e.period]; const m = e.minute + 1; return end && m > end ? `${end}+${m - end}'` : `${m}'`; };
const position = (e: MatchEvent, length: number) => Math.min(e.minute + e.second / 60, PERIOD_END[e.period] ?? length) / length * 100;
const longDate = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function Crest({ side }: { side: Side }) {
  const file = CREST[side.team_id];
  return file ? <img className="mr-crest" src={`/crests/${file}.png`} alt="" width={64} height={64} /> : <span className="mr-crest" aria-hidden />;
}

/** Event marks, drawn in CSS/SVG so they read at 18px: ball, card, or in/out arrows. */
export function EventIcon({ kind }: { kind: Kind }) {
  return <span className="mr-glyph" aria-hidden><Glyph kind={kind} /></span>;
}

function Glyph({ kind }: { kind: Kind }) {
  if (kind === 'yellow' || kind === 'red') return <span className={`mr-card mr-card-${kind}`} aria-hidden />;
  if (kind === 'second_yellow') return <span className="mr-card-pair" aria-hidden><span className="mr-card mr-card-yellow" /><span className="mr-card mr-card-red" /></span>;
  if (kind === 'substitution') return <svg className="mr-icon" viewBox="0 0 16 16" aria-hidden><path d="M5 13V4M2.5 6.5 5 4l2.5 2.5" stroke="#1f8a4c" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M11 3v9M8.5 9.5 11 12l2.5-2.5" stroke="#c0392b" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return <span className={`mr-ball${kind === 'own_goal' ? ' mr-ball-own' : ''}`} aria-hidden>
    <svg className="mr-icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#fff" stroke="currentColor" strokeWidth="1.2" /><path d="m8 4.6 2.6 1.9-1 3.1H6.4l-1-3.1Z" fill="currentColor" /><path d="M8 4.6V1.2M10.6 6.5l3.2-1M9.6 9.6l2 2.8M6.4 9.6l-2 2.8M5.4 6.5l-3.2-1" stroke="currentColor" strokeWidth="1" /></svg>
    {kind === 'penalty_goal' ? <b>P</b> : null}
  </span>;
}

function describe(e: MatchEvent) {
  if (e.kind === 'substitution') return `Cambio. Entra ${e.player_in ?? 'sin dato'}, sale ${e.player ?? 'sin dato'}`;
  return `${KIND_ES[e.kind]}. ${e.player ?? 'sin dato'}`;
}

/** Greedy lanes per side, so marks in the same minute stack instead of overlapping. */
function lanes(events: MatchEvent[], length: number) {
  const last: number[] = [];
  return events.map(e => {
    const x = position(e, length);
    let lane = last.findIndex(p => x - p >= 3.4);
    if (lane < 0) lane = last.length;
    last[lane] = x;
    return { e, x, lane };
  });
}

/* One popover for every hoverable mark on the card: timeline events and shootout kicks share format and behaviour. */
type Placement = 'above' | 'below';
function Popover({ head, sub, placement, children }: { head?: string; sub?: string; placement: Placement; children: ReactNode }) {
  return <span className="mr-tip" role="tooltip" data-placement={placement}>
    {head ? <span className="mr-tip-head"><strong>{head}</strong>{sub}</span> : null}
    {children}
  </span>;
}
const TipLine = ({ tag, tone, children }: { tag?: string; tone?: 'in' | 'out'; children: ReactNode }) =>
  <span className="mr-tip-line" data-tagged={tag ? true : undefined}>{tag ? <i className={tone ? `mr-${tone}` : undefined}>{tag}</i> : null}{children}</span>;

function PopoverTrigger({ className, style, label, popover, active, onActive, children }: {
  className: string; style?: CSSProperties; label: string; popover: ReactNode; active?: boolean; onActive?: (on: boolean) => void; children: ReactNode;
}) {
  return <button type="button" className={`mr-pop ${className}`} style={style} aria-label={label} data-active={active || undefined}
    onMouseEnter={() => onActive?.(true)} onMouseLeave={() => onActive?.(false)} onFocus={() => onActive?.(true)} onBlur={() => onActive?.(false)}>
    {children}{popover}
  </button>;
}

function EventPopover({ e, placement }: { e: MatchEvent; placement: Placement }) {
  return <Popover head={clock(e)} sub={KIND_ES[e.kind]} placement={placement}>
    {e.kind === 'substitution'
      ? <><TipLine tag="Entra" tone="in">{e.player_in ?? 'Sin dato'}</TipLine><TipLine tag="Sale" tone="out">{e.player ?? 'Sin dato'}</TipLine></>
      : <TipLine>{e.player ?? 'Sin dato'}</TipLine>}
  </Popover>;
}

function Track({ events, side, length, active, setActive }: { events: MatchEvent[]; side: 'home' | 'away'; length: number; active: string | null; setActive: (id: string | null) => void }) {
  const placed = lanes(events, length);
  const depth = Math.max(2, ...placed.map(p => p.lane + 1));
  return <div className={`mr-track mr-track-${side}`} style={{ height: 8 + depth * 26 }}>
    {placed.map(({ e, x, lane }) => <PopoverTrigger key={e.event_id} className="mr-mark" style={{ left: `${x}%`, ['--lane' as string]: lane }}
      label={`${clock(e)} ${describe(e)}`} active={active === e.event_id} onActive={on => setActive(on ? e.event_id : null)}
      popover={<EventPopover e={e} placement={side === 'home' ? 'above' : 'below'} />}>
      <EventIcon kind={e.kind} />
    </PopoverTrigger>)}
  </div>;
}

type ShootoutData = NonNullable<MatchSummary['shootout']>;
/** Penalty shootout under the score: home total, home kicks, away kicks, away total. */
function Shootout({ shootout, home, away }: { shootout: ShootoutData; home: Side; away: Side }) {
  const kicks = (side: Side) => <ol>{shootout.kicks.filter(k => k.team_id === side.team_id).map((k, i) => {
    const result = k.scored ? 'Convirtió' : 'Falló';
    return <li key={i}><PopoverTrigger className="mr-kick" label={`Penal ${i + 1} de ${teamName(side.name)}: ${k.player ?? 'sin dato'}, ${result.toLowerCase()}`}
      popover={<Popover placement="below"><span className="mr-tip-player">{k.player ?? 'Sin dato'}</span></Popover>}>
      <span className="mr-kick-dot" data-scored={k.scored} aria-hidden />
    </PopoverTrigger></li>;
  })}</ol>;
  return <div className="mr-shootout" aria-label={`Penales: ${teamName(home.name)} ${shootout.home}, ${teamName(away.name)} ${shootout.away}`}>
    <span className="mr-shootout-label">Penales</span>
    <div className="mr-shootout-row"><strong>{shootout.home}</strong>{kicks(home)}<i aria-hidden />{kicks(away)}<strong>{shootout.away}</strong></div>
  </div>;
}

export default function MatchResult({ match }: { match: MatchSummary }) {
  const [active, setActive] = useState<string | null>(null);
  const { home, away } = match;
  const length = match.extra_time ? 120 : 90;
  const regular = match.events.filter(e => e.period <= 4);
  const ticks = match.extra_time ? [0, 45, 90, 105, 120] : [0, 45, 90];
  const tickLabel: Record<number, string> = { 0: "0'", 45: 'Descanso', 90: match.extra_time ? "90'" : 'Final', 105: "105'", 120: 'Final' };
  const winner = match.shootout ? (match.shootout.home > match.shootout.away ? home : away) : home.score === away.score ? null : home.score > away.score ? home : away;
  const label = `${teamName(home.name)} ${home.score}, ${teamName(away.name)} ${away.score}` + (match.shootout ? `; penales ${match.shootout.home} a ${match.shootout.away}` : '');

  return <article className="mr" aria-label={`Resultado: ${label}`}>
    <div className="mr-board">
      <div className="mr-team" data-winner={winner === home || undefined}><Crest side={home} /><span>{teamName(home.name)}</span></div>
      <div className="mr-score">
        <strong aria-hidden>{home.score}<span>:</span>{away.score}</strong>
        {match.shootout ? <Shootout shootout={match.shootout} home={home} away={away} />
          : <span className="mr-shootout-label">{match.extra_time ? 'Final tras prórroga' : 'Final del partido'}</span>}
      </div>
      <div className="mr-team" data-winner={winner === away || undefined}><Crest side={away} /><span>{teamName(away.name)}</span></div>
    </div>

    <div className="mr-timeline" role="group" aria-label="Línea de tiempo del partido">
      <Track events={regular.filter(e => e.team_id === home.team_id)} side="home" length={length} active={active} setActive={setActive} />
      <div className="mr-axis">
        <div className="mr-axis-line" />
        {ticks.map(t => <span key={t} className="mr-tick" style={{ left: `${t / length * 100}%` }}><i />{tickLabel[t]}</span>)}
      </div>
      <Track events={regular.filter(e => e.team_id === away.team_id)} side="away" length={length} active={active} setActive={setActive} />
    </div>

    <ul className="mr-legend" aria-label="Leyenda">
      {(['goal', 'penalty_goal', 'own_goal', 'yellow', 'red', 'substitution'] as Kind[]).filter(k => regular.some(e => e.kind === k || (k === 'red' && e.kind === 'second_yellow'))).map(k => <li key={k}><EventIcon kind={k} />{KIND_ES[k]}</li>)}
    </ul>

    <ol className="mr-list" aria-label="Eventos en orden">
      {regular.map(e => <li key={e.event_id} data-side={e.team_id === home.team_id ? 'home' : 'away'} data-active={active === e.event_id || undefined}>
        <span className="mr-list-min">{clock(e)}</span><EventIcon kind={e.kind} />
        <span className="mr-list-who">
          <b>{(e.kind === 'substitution' ? e.player_in : e.player) ?? 'Sin dato'}</b>
          {e.kind === 'substitution' ? <em>{e.player ?? 'Sin dato'}</em> : e.assist ? <em>{e.assist}</em> : null}
        </span>
      </li>)}
    </ol>

    {/* Context is secondary: score first, events next, stage and date last. */}
    <p className="mr-meta">{STAGE_ES[match.stage_name] ?? match.stage_name}, {longDate(match.match_date)}</p>

  </article>;
}
