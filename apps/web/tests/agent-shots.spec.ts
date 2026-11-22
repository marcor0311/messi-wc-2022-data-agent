import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

/*
 * Shot map on /agent. Simulated: session and answer text. Real: every shot payload is a live Gold query.
 */
const SIZES = [{ width: 1440, height: 800 }, { width: 1440, height: 1000 }, { width: 1920, height: 1080 }];
type Row = Record<string, unknown>;

async function shotPayloads(request: APIRequestContext) {
  const catalog = await (await request.get('/api/agent/catalog')).json();
  const messi = catalog.entities.players.find((p: { player_name: string }) => p.player_name.includes('Messi'));
  const final = catalog.entities.matches.find((m: { stage_name: string }) => m.stage_name === 'Final');
  const gold = async (data: object) => { const r = await request.post('/api/agent/query', { data }); expect(r.ok(), JSON.stringify(data)).toBeTruthy(); return r.json(); };
  const shot = { column: 'type_name', value: 'Shot' };
  return {
    tournament: await gold({ dataset: 'actions', visualization: 'pitch', filters: [{ column: 'player_id', value: messi.player_id }, shot], title: 'Todos los tiros de Messi' }),
    final: await gold({ dataset: 'actions', visualization: 'pitch', filters: [{ column: 'match_id', value: final.match_id }, shot], title: 'Tiros de la final' }),
  };
}

async function mockSession(page: Page, result: object) {
  await page.route('**/api/auth/status', r => r.fulfill({ json: { authenticated: true, account_id: 'test', email: 'demo@example.com' } }));
  await page.route('**/api/agent/models', r => r.fulfill({ json: { models: [{ slug: 'model-a', display_name: 'Modelo A (simulado)' }], selected: 'model-a' } }));
  await page.route('**/api/agent/chat', r => r.fulfill({ json: { conversation_id: 'c-1', turn: { question: r.request().postDataJSON().question, answer: '[Texto simulado] Aquí están los tiros.', model: 'model-a', trace: [{ tool: 'query_gold', ok: true }], visualizations: [result] } } }));
}

async function ask(page: Page, result: object) {
  await mockSession(page, result);
  await page.goto('/agent');
  await page.getByLabel('Tu pregunta sobre el Mundial de Messi').fill('Muéstrame los tiros');
  await page.keyboard.press('Enter');
  await expect(page.locator('.agent-shotmap')).toBeVisible();
}

test('Mapa de tiros: mitad de cancha vertical, arco arriba y marcas por resultado', async ({ page, request }, testInfo) => {
  const { tournament } = await shotPayloads(request);
  const rows: Row[] = tournament.rows;
  // Contract: the cache carries shot height and body part from the same Silver load as Gold.
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every(r => r.type_name === 'Shot' && 'end_z' in r && 'body_part_name' in r)).toBeTruthy();
  const goals = rows.filter(r => r.is_goal === 1 || r.is_goal === true).length;
  const withHeight = rows.filter(r => typeof r.end_z === 'number').length;

  await page.setViewportSize(SIZES[1]);
  await ask(page, tournament);
  const pitch = page.getByLabel('Cancha: pitch');
  await expect(pitch.getByRole('button')).toHaveCount(rows.length);
  // Totals come from the same rows that are drawn.
  const totals = page.locator('.agent-shot-stats');
  await expect(totals.locator('div').filter({ hasText: 'Tiros' }).locator('dd')).toHaveText(String(rows.length));
  await expect(totals.locator('div').filter({ hasText: 'Goles' }).locator('dd')).toHaveText(String(goals));
  await expect(page.locator('.agent-shot-chip')).toHaveCount(rows.length + 1);
  // Goal mouth: only shots with a recorded height, the rest counted, never estimated.
  const goalMarks = page.locator('.agent-goal > g[aria-hidden=true]');
  await expect(goalMarks).toHaveCount(withHeight);
  if (withHeight < rows.length) await expect(page.locator('.agent-shots > .agent-muted')).toContainText(`${rows.length - withHeight} tiro`);
  // The goal sits above the half pitch.
  const goalBox = (await page.locator('.agent-goal').boundingBox())!, pitchBox = (await pitch.boundingBox())!;
  expect(goalBox.y + goalBox.height).toBeLessThanOrEqual(pitchBox.y + 1);
  // Every marker has the same size.
  const radii = await pitch.locator('g[role=button] > circle:nth-of-type(2), g[role=button] > g > circle:first-child').evaluateAll(c => [...new Set(c.map(e => e.getAttribute('r')))]);
  expect(radii.length).toBeLessThanOrEqual(2); // ShotMark radius and the selection hit area only

  // Selecting draws the trajectory and the detail; selecting again clears it. Keyboard works the same.
  const first = pitch.getByRole('button').first();
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.agent-shot-stats')).toContainText('Resultado');
  await expect(pitch.locator('g[aria-hidden=true] > line')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.agent-shot-stats')).toContainText('xG total');

  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.locator('.agent-shot-chip').filter({ has: page.locator('svg') }).first().click();
    await page.mouse.move(0, 0); await page.waitForTimeout(400);
    await page.screenshot({ path: testInfo.outputPath(`tiros-messi-${size.width}x${size.height}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sin overflow horizontal').toBeTruthy();
  }
});

test('Mapa de tiros de la final: dos selecciones y ningún penal de la tanda', async ({ page, request }, testInfo) => {
  const { final } = await shotPayloads(request);
  const rows: Row[] = final.rows;
  expect(rows.every(r => r.period !== 5)).toBeTruthy();
  await page.setViewportSize(SIZES[2]);
  await ask(page, final);
  await expect(page.getByLabel('Cancha: pitch').getByRole('button')).toHaveCount(rows.length);
  await expect(page.locator('.agent-shot-chip')).toHaveCount(rows.length + 1);
  await page.screenshot({ path: testInfo.outputPath('tiros-final-1920x1080.png') });
});
