import { Fragment, type ReactNode } from 'react';

/*
 * Limited, safe Markdown for agent answers: paragraphs, lists, emphasis, inline code and http(s) links.
 * It builds React elements only; arbitrary HTML in the answer is shown as text, never parsed.
 * Headings degrade to a strong paragraph so a model's "## Resumen" does not compete with the interface.
 */
type Block = { kind: 'p' | 'h' | 'ul' | 'ol'; lines: string[] };

function blocks(source: string): Block[] {
  const out: Block[] = [];
  let current = null as Block | null;
  const push = () => { if (current) out.push(current); current = null; };
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (!line.trim()) { push(); continue; }
    if (heading) { push(); out.push({ kind: 'h', lines: [heading[1]] }); continue; }
    if (bullet || ordered) {
      const kind = bullet ? 'ul' : 'ol';
      if (current?.kind !== kind) { push(); current = { kind, lines: [] }; }
      current.lines.push((bullet ?? ordered)![1]);
      continue;
    }
    if (current && current.kind !== 'p' && /^\s{2,}/.test(raw)) { current.lines[current.lines.length - 1] += ' ' + line.trim(); continue; }
    if (current?.kind !== 'p') { push(); current = { kind: 'p', lines: [] }; }
    current.lines.push(line.trim());
  }
  push();
  return out;
}

const INLINE = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) nodes.push(text.slice(last, m.index));
    const key = nodes.length;
    if (m[2] ?? m[3]) nodes.push(<strong key={key}>{m[2] ?? m[3]}</strong>);
    else if (m[4] ?? m[5]) nodes.push(<em key={key}>{m[4] ?? m[5]}</em>);
    else if (m[6]) nodes.push(<code key={key}>{m[6]}</code>);
    else nodes.push(<a key={key} href={m[8]} target="_blank" rel="noreferrer noopener">{m[7]}</a>);
    last = m.index! + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ text }: { text: string }) {
  return <>{blocks(text).map((b, i) => {
    if (b.kind === 'h') return <p key={i} className="ap-md-heading"><strong>{inline(b.lines[0])}</strong></p>;
    if (b.kind === 'p') return <p key={i}>{b.lines.map((l, j) => <Fragment key={j}>{j ? <br /> : null}{inline(l)}</Fragment>)}</p>;
    const List = b.kind;
    return <List key={i}>{b.lines.map((l, j) => <li key={j}>{inline(l)}</li>)}</List>;
  })}</>;
}
