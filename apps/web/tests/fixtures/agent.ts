import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import type { GoldResult, VisualCatalog } from '../../src/components/agent-visual';

type Catalog = VisualCatalog & { datasets: Record<string, unknown> };
export type Case = { name: string; selector: string; results: GoldResult[] };
export type ChatBody = { question: string; conversation_id: string | null; model: string; audience?: string };
export type Turn = { question: string; answer: string; visualizations: GoldResult[]; model: string; trace: { tool: string; ok: boolean }[] };

/** Public queries hit FastAPI; special tools execute the same backend code over the same local Gold. */
export async function goldCases(request: APIRequestContext): Promise<Case[]> {
  const response = await request.get('/api/agent/catalog');
  expect(response.ok()).toBeTruthy();
  const catalog: Catalog = await response.json();
  expect(catalog.entities.matches).toHaveLength(7);
  const messi = catalog.entities.players.find(p => p.player_name.includes('Messi'))!;
  const mbappe = catalog.entities.players.find(p => p.player_name.includes('Mbapp'))!;
  const final = catalog.entities.matches.find(m => m.stage_name === 'Final')!;
  const me = { column: 'player_id', value: messi.player_id };
  const match = { column: 'match_id', value: final.match_id };
  const gold = async (data: object): Promise<GoldResult> => {
    const result = await request.post('/api/agent/query', { data });
    expect(result.ok(), JSON.stringify(data)).toBeTruthy();
    return result.json();
  };
  const root = resolve(__dirname, '../../../..');
  const python = process.env.AGENT_TEST_PYTHON || resolve(root, '.venv/bin/python');
  const special: Record<string, GoldResult[]> = JSON.parse(execFileSync(python, [resolve(__dirname, 'gold_payloads.py')], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  }));
  return [
    { name: 'Tiros de Messi', selector: '.agent-shotmap', results: [await gold({ dataset: 'actions', visualization: 'pitch', filters: [me, { column: 'type_name', value: 'Shot' }] })] },
    { name: 'Estadísticas de Messi', selector: '.agent-tiles', results: [await gold({ dataset: 'player_match', filters: [me], metrics: ['shots', 'goals', 'xg', 'assists'] })] },
    { name: 'Onces de la final', selector: '.agent-lineups', results: [await gold({ dataset: 'initial_lineups', visualization: 'lineup', filters: [match] })] },
    { name: 'Jugadas de tiros creados', selector: '.agent-shotmap', results: special.creation },
    { name: 'Cambios de alineación', selector: '.agent-story', results: special.lineup_story },
    { name: 'Resultado de la final', selector: '.mr', results: special.match_result },
    { name: 'Evolución de Messi', selector: '.agent-trend', results: [await gold({ dataset: 'player_match', visualization: 'trend', filters: [me], group_by: ['match_id'], metrics: ['goals', 'assists', 'shots', 'xg', 'shots_created', 'complete_dribbles'], order_by: 'match_id', descending: false })] },
    { name: 'Messi y Mbappé', selector: '.agent-panels', results: [await gold({ dataset: 'player_match', visualization: 'bars', filters: [match, { column: 'player_id', op: 'in', value: [messi.player_id, mbappe.player_id] }], group_by: ['player_id'], metrics: ['shots', 'goals', 'npxg', 'xg_assisted'] })] },
    { name: 'Zonas de recepción', selector: 'svg[aria-label="Cancha: heatmap"]', results: [await gold({ dataset: 'receipts', visualization: 'heatmap', filters: [me] })] },
    { name: 'Red de pases', selector: 'svg[aria-label="Cancha: network"]', results: [await gold({ dataset: 'connections', visualization: 'network', filters: [me, match] })] },
  ];
}

/** Only account/model/answer text are simulated; result payloads above are real tool output. */
export async function mockChat(page: Page, cases: Case[], options: { delay?: number; failOn?: number; expireOn?: number; answer?: string } = {}) {
  const bodies: ChatBody[] = [], turns: Turn[] = [];
  await page.route('**/api/auth/status', r => r.fulfill({ json: { authenticated: true } }));
  await page.route('**/api/auth/accounts', r => r.fulfill({ json: [] }));
  await page.route('**/api/agent/models', r => r.fulfill({ json: { models: [{ slug: 'model-a', display_name: 'Modelo A (simulado)' }, { slug: 'model-b', display_name: 'Modelo B (simulado)' }], selected: 'model-a' } }));
  await page.route('**/api/agent/conversations/test-conversation', r => r.fulfill({ json: { conversation_id: 'test-conversation', turns } }));
  await page.route('**/api/agent/chat', async r => {
    const body: ChatBody = r.request().postDataJSON(); bodies.push(body);
    if (options.delay) await new Promise(resolve => setTimeout(resolve, options.delay));
    if (options.expireOn === bodies.length) return r.fulfill({ status: 401, json: { detail: 'Sesión vencida' } });
    if (options.failOn === bodies.length) return r.fulfill({ status: 502, json: { detail: 'La inferencia no se completó.' } });
    const turn: Turn = { question: body.question, answer: options.answer ?? '[Texto simulado] Resultado de herramientas Gold reales.', visualizations: cases[turns.length % cases.length].results, model: body.model, trace: [{ tool: 'query_gold', ok: true }] };
    turns.push(turn);
    return r.fulfill({ json: { conversation_id: 'test-conversation', turn } });
  });
  return { bodies, turns };
}
