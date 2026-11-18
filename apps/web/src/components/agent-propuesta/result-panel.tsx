'use client';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { ResultTable, datasetLabel, resultBody, type GoldResult } from '../agent-visual';
import { ViewIcon } from './icons';
import { limitationEs } from './limitations';
import type { Catalog, Turn } from './types';

export const resultTitle = (r: GoldResult, catalog: Catalog | null) => r.query.title || catalog?.views[r.visualization]?.label || r.visualization;
export const isAggregated = (r: GoldResult) => (r.query.metrics?.length ?? 0) > 0;
/** First non-tabular result the server returned, in its own order; the table only when it is all there is. */
export const defaultResult = (t: Turn) => { const i = t.visualizations.findIndex(v => v.visualization !== 'table'); return i < 0 ? 0 : i; };

function Evidence({ result, catalog }: { result: GoldResult; catalog: Catalog }) {
  const [open, setOpen] = useState<'data' | 'source' | null>(null);
  const id = useId();
  const toggle = (k: 'data' | 'source') => setOpen(o => (o === k ? null : k));
  return <div className="ap-evidence">
    <div className="ap-evidence-bar">
      {result.rows.length ? <button type="button" aria-expanded={open === 'data'} aria-controls={id + 'data'} onClick={() => toggle('data')}>Datos exactos</button> : null}
      <button type="button" aria-expanded={open === 'source'} aria-controls={id + 'source'} onClick={() => toggle('source')}>Fuentes y consulta</button>
      <span className="ap-evidence-note">{datasetLabel(result.query.dataset)}, {result.matched_source_rows.toLocaleString('es')} registros de origen</span>
    </div>
    {open === 'data' ? <div id={id + 'data'} className="ap-evidence-body"><ResultTable result={result} catalog={catalog} /></div> : null}
    {open === 'source' ? <div id={id + 'source'} className="ap-evidence-body">
      <dl className="ap-provenance">
        <div><dt>Fuente</dt><dd>StatsBomb Open Data, carga Gold <code>{result.provenance.gold_load_id.slice(0, 12)}</code></dd></div>
        <div><dt>Conjunto</dt><dd>{datasetLabel(result.provenance.dataset)} <code>{result.provenance.dataset}</code></dd></div>
        <div><dt>Huella de datos</dt><dd><code>{result.provenance.source_sha256}</code></dd></div>
        <div><dt>Huella de consulta</dt><dd><code>{result.provenance.query_sha256}</code></dd></div>
      </dl>
      {result.limitations.length ? <><p className="ap-subhead">Limitaciones de los datos</p><ul className="ap-limits">{result.limitations.map(l => <li key={l}>{limitationEs(l)}</li>)}</ul></> : null}
      <p className="ap-subhead">Consulta reproducible</p>
      <pre tabIndex={0} aria-label="Consulta reproducible en JSON">{JSON.stringify({ query: result.query, provenance: result.provenance }, null, 2)}</pre>
    </div> : null}
  </div>;
}

export function ResultView({ result, catalog, headingId, showTitle = false }: { result: GoldResult; catalog: Catalog; headingId: string; showTitle?: boolean }) {
  const body = resultBody({ result, catalog });
  // The visual already says what it shows and the question names the scope: title, view kind and filter chips only repeat it.
  // Keep the title for screen readers and focus; the filters stay in the evidence (reproducible query).
  return <>
    <h3 id={headingId} tabIndex={-1} className={showTitle ? 'ap-dash-title' : 'ap-sr'}>{resultTitle(result, catalog)}</h3>
    <div className="ap-stage">
      {result.rows.length === 0 ? <p className="ap-empty-result">No hay registros para esta selección. Prueba con otro partido, jugador o tipo de acción.</p>
        : body ?? <ResultTable result={result} catalog={catalog} />}
    </div>
    {result.truncated ? <p role="status" className="ap-warning">Se muestran solo {result.rows.length} filas de {result.matched_source_rows.toLocaleString('es')}. No representan el conjunto completo; afina los filtros.</p> : null}
    <Evidence result={result} catalog={catalog} />
  </>;
}

/** Results of one answer as a tab list: only what the server actually returned, in its order. */
export function ResultTabs({ turn, turnIndex, active, catalog, onSelect }: { turn: Turn; turnIndex: number; active: number; catalog: Catalog | null; onSelect: (i: number) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const n = turn.visualizations.length;
  const key = (e: KeyboardEvent) => {
    const next = e.key === 'ArrowRight' ? (active + 1) % n : e.key === 'ArrowLeft' ? (active - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
    if (next === null) return;
    e.preventDefault(); onSelect(next); refs.current[next]?.focus();
  };
  if (n < 2) return null;
  return <div className="ap-tabs" role="tablist" aria-label={`Resultados de la respuesta ${turnIndex + 1}`} onKeyDown={key}>
    {turn.visualizations.map((v, i) => <button key={i} ref={el => { refs.current[i] = el; }} type="button" role="tab" id={`ap-tab-${turnIndex}-${i}`} aria-selected={i === active} aria-controls="ap-result" tabIndex={i === active ? 0 : -1} title={resultTitle(v, catalog)} onClick={() => onSelect(i)}>
      <ViewIcon view={v.visualization} aggregated={isAggregated(v)} /><span>{resultTitle(v, catalog)}</span>
    </button>)}
  </div>;
}

/** Dashboard order: every chart the server returned, in its order, then the tabular results (headline stat cards) below. */
const hasBalance = (t: Turn) => t.visualizations.some(v => v.visualization === 'trend' && v.rows.some(r => 'known_dribbles' in r));
/** With the match-by-match balance present, its four cards are the only headline numbers: other stat-card results are left out. */
export const dashboardOrder = (t: Turn) => t.visualizations.map((v, i) => ({ v, i })).filter(({ v }) => !(hasBalance(t) && v.visualization === 'table' && isAggregated(v))).sort((a, b) => Number(a.v.visualization === 'table') - Number(b.v.visualization === 'table') || a.i - b.i);

/** A headline total (one row, one or two numbers) from the same dataset as a comparison chart sits beside that chart. */
const isHeadline = (v: Turn['visualizations'][number]) => v.visualization === 'table' && isAggregated(v) && v.rows.length === 1 && (v.query.metrics?.length ?? 0) <= 2;
export function dashboardGroups(t: Turn) {
  const items = dashboardOrder(t), used = new Set<number>(), groups: (typeof items)[] = [];
  for (const item of items) {
    if (used.has(item.i)) continue;
    const comparison = (item.v.visualization === 'bars' || item.v.visualization === 'table') && isAggregated(item.v) && (item.v.query.group_by?.length ?? 0) > 0 && item.v.rows.length > 1;
    const side = comparison ? items.find(o => !used.has(o.i) && o.i !== item.i && isHeadline(o.v) && o.v.query.dataset === item.v.query.dataset) : undefined;
    used.add(item.i);
    if (side) { used.add(side.i); groups.push([item, side]); } else groups.push([item]);
  }
  return groups;
}
