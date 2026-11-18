import type { GoldResult, VisualCatalog } from '../agent-visual';

/* Same payloads as /agent: the proposal changes presentation only, never the contract. */
export type Catalog = VisualCatalog & { datasets: Record<string, { rows: number; columns: string[] }>; load_id: string; limitations: string[] };
export type Turn = { question: string; answer: string; visualizations: GoldResult[]; model: string; trace: { tool: string; ok: boolean }[] };
export type Session = { authenticated: boolean; email?: string; detail?: string };
export type Model = { slug: string; display_name: string };

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

export async function api<T>(path: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch('/api/' + path, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError('No se pudo conectar con la API. Verifica que el servidor está activo y vuelve a intentarlo.', 0);
  }
  const result = await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(typeof result?.detail === 'string' ? result.detail : 'No se pudo completar la solicitud. Vuelve a intentarlo.', r.status);
  return result as T;
}
