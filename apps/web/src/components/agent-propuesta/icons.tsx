/* One stroke family (1.5px on a 16px grid) for every icon in the proposal. Decorative: labels carry the meaning. */
const base = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: false };

export const SendIcon = () => <svg {...base}><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /></svg>;
export const PlusIcon = () => <svg {...base}><path d="M8 3v10M3 8h10" /></svg>;
export const ChevronIcon = () => <svg {...base}><path d="m6 4 4 4-4 4" /></svg>;

function PitchIcon() { return <svg {...base}><rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1" /><path d="M8 3.25v9.5" /><circle cx="8" cy="8" r="1.75" /></svg>; }
function BarsIcon() { return <svg {...base}><path d="M2.5 4.5h8M2.5 8h11M2.5 11.5h5.5" /></svg>; }
function TrendIcon() { return <svg {...base}><path d="M2 12.5 5.5 8l3 2.5L14 4" /></svg>; }
function ScoreIcon() { return <svg {...base}><circle cx="4" cy="8" r="2.25" /><circle cx="12" cy="8" r="2.25" /><path d="M7.25 8h1.5" /></svg>; }
function TableIcon() { return <svg {...base}><rect x="2" y="2.75" width="12" height="10.5" rx="1" /><path d="M2 6.25h12M2 9.75h12M6.5 6.25v7" /></svg>; }

export function ViewIcon({ view, aggregated }: { view: string; aggregated?: boolean }) {
  if (['pitch', 'heatmap', 'network', 'lineup', 'lineup_story', 'creation_chains'].includes(view)) return <PitchIcon />;
  if (view === 'bars' || (view === 'table' && aggregated)) return <BarsIcon />;
  if (view === 'trend') return <TrendIcon />;
  if (view === 'match_result') return <ScoreIcon />;
  return <TableIcon />;
}
