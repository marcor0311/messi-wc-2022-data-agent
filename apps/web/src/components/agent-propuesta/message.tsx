'use client';
import Markdown from './markdown';
import { defaultResult } from './result-panel';
import type { Catalog, Turn } from './types';

const TOOLS: Record<string, string> = { find_entities: 'Identificar jugadores, selecciones y partidos', query_gold: 'Consultar los datos Gold', describe_data: 'Revisar qué datos existen' };

export function UserMessage({ text }: { text: string }) {
  return <div className="ap-user"><p>{text}</p></div>;
}

export function AgentMessage({ turn, index, catalog, activeResult, onOpen }: { turn: Turn; index: number; catalog: Catalog | null; activeResult: number | null; onOpen: (i: number) => void }) {
  return <article className="ap-turn" aria-label={`Respuesta ${index + 1}`}>
    {turn.visualizations.length
      /* The question bubble reopens this answer's result in the panel; history lives until "Nueva conversación". */
      ? <button type="button" className="ap-user ap-user-open" aria-pressed={activeResult !== null} onClick={() => onOpen(defaultResult(turn))}
          title="Ver de nuevo el resultado de esta pregunta"><p>{turn.question}</p></button>
      : <UserMessage text={turn.question} />}
    <div className="ap-answer"><Markdown text={turn.answer} /></div>
    <details className="ap-trace">
      <summary>Cómo se obtuvo</summary>
      <p>Modelo <code>{turn.model}</code></p>
      <ol>{turn.trace.map((s, i) => <li key={i}>{TOOLS[s.tool] ?? s.tool} <code>{s.tool}</code> {s.ok ? 'completada' : 'con error'}</li>)}</ol>
      <p>Las consultas completadas indican que la herramienta respondió; la evidencia está en los datos exactos y la procedencia de cada resultado.</p>
    </details>
  </article>;
}
