import { test, expect, type Page, type APIRequestContext, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/*
 * /agent-propuesta review suite.
 * Simulated: session, model catalog and the agent's answer text (every answer starts with "[Texto simulado]").
 * Real: every visualization payload is a live Gold query result from /api/agent/query.
 */
const SHOTS = '../../docs/agent-propuesta/capturas/';
const SIZES = [{ width: 1440, height: 800 }, { width: 1440, height: 1000 }, { width: 1920, height: 1080 }];

async function goldPayloads(request: APIRequestContext) {
  const catalog = await (await request.get('/api/agent/catalog')).json();
  const player = (f: string) => catalog.entities.players.find((p: { player_name: string }) => p.player_name.includes(f));
  const messi = player('Messi'), mbappe = player('Mbapp');
  const final = catalog.entities.matches.find((m: { stage_name: string }) => m.stage_name === 'Final');
  const gold = async (data: object) => { const r = await request.post('/api/agent/query', { data }); expect(r.ok(), JSON.stringify(data)).toBeTruthy(); return r.json(); };
  const me = { column: 'player_id', value: messi.player_id }, inFinal = { column: 'match_id', value: final.match_id }, both = { column: 'player_id', op: 'in', value: [messi.player_id, mbappe.player_id] };
  return {
    first: [
      await gold({ dataset: 'player_match', filters: [me], metrics: ['shots', 'goals', 'xg', 'assists'], title: 'Los números de Messi en el Mundial' }),
      await gold({ dataset: 'actions', visualization: 'pitch', filters: [me, { column: 'type_name', value: 'Shot' }], title: 'Todos los tiros de Messi' }),
      await gold({ dataset: 'player_match', visualization: 'bars', filters: [both], metrics: ['shots', 'goals', 'npxg', 'xg_assisted'], group_by: ['player_id'], title: 'Messi y Mbappé en el torneo' }),
      await gold({ dataset: 'player_match', visualization: 'trend', filters: [me], metrics: ['npxg', 'xg_assisted'], group_by: ['match_id'], order_by: 'match_id', descending: false, title: 'Peligro generado partido a partido' }),
    ],
    second: [
      await gold({ dataset: 'initial_lineups', visualization: 'lineup', filters: [inFinal], limit: 2, title: 'Los onces de la final' }),
      await gold({ dataset: 'connections', visualization: 'network', filters: [inFinal, { column: 'team_id', value: messi.team_id }], limit: 300, title: 'Red de pases de Argentina en la final' }),
      await gold({ dataset: 'receipts', visualization: 'heatmap', filters: [me], title: 'Dónde recibió Messi' }),
      await gold({ dataset: 'actions', visualization: 'pitch', filters: [inFinal, both, { column: 'type_name', value: 'Shot' }], title: 'Tiros de Messi y Mbappé en la final' }),
    ],
    third: [await gold({ dataset: 'actions', visualization: 'pitch', filters: [inFinal, both, { column: 'type_name', value: 'Shot' }], title: 'Tiros de Messi y Mbappé en la final' })],
  };
}

const ANSWERS = [
  '## Resumen\n[Texto simulado] Messi remató **32 veces** en el torneo y marcó 7 goles con 6,03 de xG.\n\n- Casi todos sus tiros salieron desde dentro o al borde del área.\n- Sus goles más claros llegaron cerca del punto penal.\n\nAbre el mapa para ver cada tiro.',
  '[Texto simulado] Francia salió con 4-2-3-1 y Argentina con 4-3-3. Messi partió por la derecha, pero recibió sobre todo entre líneas.',
  '[Texto simulado] En la final, Messi y Mbappé sumaron once tiros entre los dos.',
];

type Body = { question: string; conversation_id: string | null; model: string; audience?: string };
async function mockSession(page: Page, payloads: Awaited<ReturnType<typeof goldPayloads>>, opts: { delay?: number; failOn?: number[]; expireOn?: number } = {}) {
  const bodies: Body[] = [];
  const turns: object[] = [];
  const sets = [payloads.first, payloads.second, payloads.third];
  await page.route('**/api/auth/status', r => r.fulfill({ json: { authenticated: true, account_id: 'test', email: 'demo@example.com' } }));
  await page.route('**/api/agent/models', r => r.fulfill({ json: { models: [{ slug: 'model-a', display_name: 'Modelo A (simulado)' }, { slug: 'model-b', display_name: 'Modelo B (simulado)' }], selected: 'model-a' } }));
  await page.route('**/api/agent/conversations/c-1', r => r.fulfill({ json: { conversation_id: 'c-1', turns } }));
  await page.route('**/api/agent/chat', async r => {
    const body = r.request().postDataJSON(); bodies.push(body);
    if (opts.delay) await new Promise(res => setTimeout(res, opts.delay));
    if (opts.expireOn === bodies.length) return r.fulfill({ status: 401, json: { detail: 'Sesión vencida' } });
    if (opts.failOn?.includes(bodies.length)) return r.fulfill({ status: 502, json: { detail: 'La inferencia no se completó. Revisa los límites de tu plan o vuelve a intentarlo.' } });
    const n = turns.length;
    const turn = { question: body.question, answer: ANSWERS[n % 3], model: body.model, trace: [{ tool: 'find_entities', ok: true }, { tool: 'query_gold', ok: true }], visualizations: sets[n % 3] };
    turns.push(turn);
    return r.fulfill({ json: { conversation_id: 'c-1', turn } });
  });
  return bodies;
}

const question = (page: Page) => page.getByLabel('Tu pregunta sobre el Mundial de Messi');
async function inViewport(page: Page, locator: Locator, what: string) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize()!;
  expect(box, what).not.toBeNull();
  expect(box!.y, `${what} top`).toBeGreaterThanOrEqual(0);
  expect(box!.x, `${what} left`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${what} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
  expect(box!.x + box!.width, `${what} right`).toBeLessThanOrEqual(vp.width + 0.5);
}
async function firstScreenUsable(page: Page) {
  await inViewport(page, question(page), 'compositor');
  await inViewport(page, page.getByRole('button', { name: 'Enviar pregunta' }), 'botón enviar');
  await inViewport(page, page.locator('#ap-result .agent-pitch, #ap-result .agent-panels, #ap-result .agent-strip').first(), 'gráfico principal');
  const reading = page.locator('#ap-result .agent-plot + .agent-muted');
  if (await reading.count()) await inViewport(page, reading.first(), 'lectura bajo la cancha');
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), 'sin scroll de página').toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sin overflow horizontal').toBeTruthy();
}
const axe = async (page: Page) => expect((await new AxeBuilder({ page }).include('.ap').analyze()).violations).toEqual([]);

test('Estado inicial sin sesión: acceso a la conversación y al explorador público', async ({ page }) => {
  await page.setViewportSize(SIZES[0]);
  await page.goto('/agent-propuesta');
  await expect(page.getByRole('heading', { name: 'Conecta tu cuenta para conversar' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir el explorador público' })).toHaveAttribute('href', '/agent');
  await expect(page.getByRole('heading', { name: 'Aquí verás la evidencia de cada respuesta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver los 32 remates de Messi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar pregunta' })).toBeDisabled();
  await page.getByRole('button', { name: /Desde dónde remató Messi/ }).click();
  await expect(question(page)).toHaveValue(/remató Messi/);
  await expect(page.getByRole('button', { name: 'Enviar pregunta' })).toBeDisabled();
  await axe(page);
  await page.screenshot({ path: SHOTS + '01-inicial-sin-sesion-1440x800.png' });
});

test('Conversación con varios resultados, selección, evidencia, turnos previos y error', async ({ page, request }) => {
  test.setTimeout(180000);
  const payloads = await goldPayloads(request);
  const bodies = await mockSession(page, payloads, { delay: 900, failOn: [4] });
  await page.setViewportSize(SIZES[0]);
  await page.goto('/agent-propuesta');
  await expect(page.getByText('demo@example.com')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await expect(page.getByLabel('Modelo')).toHaveValue('model-a');
  await expect(page.getByRole('heading', { name: '¿Qué quieres saber del Mundial de Messi?' })).toBeVisible();
  await axe(page);
  await page.screenshot({ path: SHOTS + '02-inicial-con-sesion-1440x800.png' });

  // Keyboard-only first question: Shift+Enter adds a line, Enter sends.
  await question(page).focus();
  await page.keyboard.type('¿Desde dónde remató Messi en el Mundial?');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('Muéstralo en la cancha.');
  await expect(question(page)).toHaveValue('¿Desde dónde remató Messi en el Mundial?\nMuéstralo en la cancha.');
  await page.keyboard.press('Enter');
  // Pending: the question shows at once, an honest status, no fake progress.
  await expect(page.locator('.ap-pending .ap-user')).toHaveText(/Muéstralo en la cancha/);
  await expect(page.locator('.ap-working')).toHaveText('Consultando los datos…');
  await expect(page.getByRole('button', { name: 'Consultando los datos' })).toBeDisabled();
  await expect(question(page)).toHaveValue('');
  await page.screenshot({ path: SHOTS + '03-cargando-1440x800.png' });

  await expect(page.locator('.ap-answer').first()).toContainText('[Texto simulado]');
  await expect(question(page)).toHaveValue('');
  await expect(question(page)).toBeFocused();
  expect(bodies[0]).toMatchObject({ conversation_id: null, model: 'model-a' });
  expect(bodies[0].audience).toBeUndefined();
  // Markdown: heading degraded to strong text, list kept, no raw markers.
  await expect(page.locator('.ap-answer').first().locator('li')).toHaveCount(2);
  await expect(page.locator('.ap-answer').first()).not.toContainText('##');
  // One dashboard: every result stacked, charts first and the headline stat cards below them; no tabs.
  await expect(page.getByRole('heading', { name: 'Todos los tiros de Messi', level: 3 })).toBeVisible();
  await expect(page.locator('#ap-result')).toHaveCount(1);
  await expect(page.locator('#ap-result .ap-dash-item')).toHaveCount(4);
  await expect(page.locator('#ap-result .ap-dash-item').last().locator('.agent-tile')).toHaveCount(4);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByLabel('Cancha: pitch').getByRole('button')).toHaveCount(32);
  await expect(page.getByRole('list', { name: 'Filtros aplicados' })).toContainText('Jugador: Lionel Messi');
  await firstScreenUsable(page);
  await axe(page);
  await page.screenshot({ path: SHOTS + '04-respuesta-mapa-1440x800.png' });

  // Exact data and provenance per result, inside each dashboard section.
  await expect(page.getByRole('heading', { name: 'Messi y Mbappé en el torneo', level: 3 })).toBeAttached();
  await expect(page.getByRole('region', { name: 'Tiros', exact: true }).getByText('Kylian Mbappé')).toBeAttached();
  const cards = page.locator('.ap-dash-item').filter({ has: page.getByRole('heading', { name: 'Los números de Messi en el Mundial', level: 3 }) });
  await cards.scrollIntoViewIfNeeded();
  await cards.getByRole('button', { name: 'Datos exactos' }).click();
  await expect(cards.getByRole('region', { name: 'Datos exactos' })).toBeVisible();
  await cards.getByRole('button', { name: 'Fuentes y consulta' }).click();
  await expect(page.getByText('Huella de consulta')).toBeVisible();
  await expect(page.locator('.ap-limits')).toContainText('No hay minutos jugados fiables');
  await expect(page.locator('.ap-limits')).not.toContainText('per-90');
  await expect(page.getByLabel('Consulta reproducible en JSON')).toContainText('"dataset": "player_match"');
  await axe(page);
  await page.screenshot({ path: SHOTS + '05-datos-y-procedencia-1440x800.png' });

  // Second turn with new model and level: context and choices travel with the request.
  await page.getByLabel('Modelo').selectOption('model-b');
  await question(page).fill('Ahora compara los dos onces de ese partido.');
  await page.getByRole('button', { name: 'Enviar pregunta' }).click();
  await expect(page.getByRole('heading', { name: 'Los onces de la final', level: 3 })).toBeVisible();
  expect(bodies[1]).toMatchObject({ conversation_id: 'c-1', model: 'model-b' });
  await expect(page.getByRole('group', { name: 'Once de Argentina', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Once de Francia', exact: true })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await firstScreenUsable(page);
  await page.screenshot({ path: SHOTS + '06-segundo-turno-onces-1440x800.png' });
  await page.getByRole('heading', { name: 'Red de pases de Argentina en la final', level: 3 }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: SHOTS + '07-red-de-pases-1440x800.png' });

  // Open a result of the first turn from the chat: inspection changes, conversation context does not.
  await page.getByRole('list', { name: 'Resultados de la respuesta 1' }).getByRole('button', { name: 'Peligro generado partido a partido' }).click();
  await expect(page.getByRole('heading', { name: 'Peligro generado partido a partido', level: 3 })).toBeVisible();
  await expect(page.locator('.ap-notice')).toContainText('la próxima pregunta continúa la conversación completa');
  await expect(page.getByLabel('Evolución de xG sin penales')).toBeVisible();
  await axe(page);
  await page.screenshot({ path: SHOTS + '08-resultado-anterior-1440x800.png' });

  // A new answer while inspecting an earlier one is announced, not forced.
  await question(page).fill('¿Cuántos tiros hicieron Messi y Mbappé en la final?');
  await page.keyboard.press('Enter');
  await expect(page.locator('.ap-context-status')).toHaveText('Consultando una nueva pregunta…');
  await expect(page.getByRole('button', { name: 'Abrir la respuesta nueva' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Peligro generado partido a partido', level: 3 })).toBeVisible();
  expect(bodies[2]).toMatchObject({ conversation_id: 'c-1' });
  await page.screenshot({ path: SHOTS + '09-respuesta-nueva-sin-arrebatar-1440x800.png' });
  await page.getByRole('button', { name: 'Abrir la respuesta nueva' }).click();
  await expect(page.locator('.ap-notice')).toHaveCount(0);
  await expect(page.getByLabel('Cancha: pitch')).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);

  // Failure keeps the draft and the previous turns; no duplicate turn.
  await question(page).fill('Pregunta que falla');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'La inferencia no se completó' })).toBeVisible();
  await expect(question(page)).toHaveValue('Pregunta que falla');
  await expect(page.locator('article.ap-turn')).toHaveCount(3);
  await expect(page.getByLabel('Cancha: pitch')).toBeVisible();
  await axe(page);
  await page.screenshot({ path: SHOTS + '10-error-1440x800.png' });

  // Reload restores the conversation; there is no level to choose.
  await page.reload();
  await expect(page.locator('article.ap-turn')).toHaveCount(3);
  await expect(page.locator('.ap-notice')).toHaveCount(0);
  await expect(page.getByLabel('Nivel de explicación')).toHaveCount(0);
});

for (const size of SIZES) test(`Primera pantalla utilizable tras responder a ${size.width}x${size.height}`, async ({ page, request }) => {
  const payloads = await goldPayloads(request);
  await mockSession(page, payloads);
  await page.setViewportSize(size);
  await page.goto('/agent-propuesta');
  await expect(page.getByLabel('Modelo')).toHaveValue('model-a');
  await question(page).fill('¿Desde dónde remató Messi en el Mundial? Muéstralo en la cancha.');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Todos los tiros de Messi', level: 3 })).toBeVisible();
  await firstScreenUsable(page);
  await page.screenshot({ path: SHOTS + `11-primer-turno-${size.width}x${size.height}.png` });
  await question(page).fill('Ahora compara los dos onces de ese partido.');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Los onces de la final', level: 3 })).toBeVisible();
  await firstScreenUsable(page);
  for (const title of ['Red de pases de Argentina en la final', 'Dónde recibió Messi', 'Tiros de Messi y Mbappé en la final']) {
    await expect(page.getByRole('heading', { name: title, level: 3 })).toBeAttached();
  }
  await page.screenshot({ path: SHOTS + `12-segundo-turno-${size.width}x${size.height}.png` });
});

test('Sesión vencida y texto de 4000 caracteres', async ({ page, request }) => {
  const payloads = await goldPayloads(request);
  await mockSession(page, payloads, { expireOn: 1 });
  await page.setViewportSize(SIZES[1]);
  await page.goto('/agent-propuesta');
  await expect(page.getByLabel('Modelo')).toHaveValue('model-a');
  const long = 'Compara tiros y goles. '.repeat(200).slice(0, 4000);
  await question(page).fill(long);
  await expect(page.locator('.ap-count')).toHaveText('4000/4000');
  const box = await question(page).boundingBox();
  expect(box!.height).toBeLessThanOrEqual(193);
  await inViewport(page, page.getByRole('button', { name: 'Enviar pregunta' }), 'botón enviar con texto largo');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Tu sesión venció' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conectar de nuevo' })).toBeVisible();
  await expect(question(page)).toHaveValue(long);
});

test('Movimiento reducido, zoom del navegador y texto ampliado', async ({ page, request }) => {
  const payloads = await goldPayloads(request);
  await mockSession(page, payloads);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(SIZES[1]);
  await page.goto('/agent-propuesta');
  await expect(page.getByLabel('Modelo')).toHaveValue('model-a');
  await question(page).fill('¿Desde dónde remató Messi en el Mundial?');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Todos los tiros de Messi', level: 3 })).toBeVisible();
  const motion = await page.evaluate(() => {
    const s = (sel: string) => getComputedStyle(document.querySelector(sel)!);
    return { result: s('#ap-result').animationName, send: s('.ap-send').transitionDuration };
  });
  expect(motion).toEqual({ result: 'none', send: '0s' });

  // 200% browser zoom on a 1440×1000 window = 720×500 CSS pixels: reading reflow, nothing clipped.
  await page.setViewportSize({ width: 720, height: 500 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await inViewport(page, question(page), 'compositor con zoom 200%');
  await page.getByLabel('Cancha: pitch').scrollIntoViewIfNeeded();
  await expect(page.getByLabel('Cancha: pitch')).toBeInViewport();
  await page.screenshot({ path: SHOTS + '13-zoom-200-720x500.png' });

  // Enlarged root text (200%): the two-pane layout yields to the vertical reading document.
  await page.setViewportSize(SIZES[1]);
  await page.addStyleTag({ content: 'html{font-size:32px!important}' });
  await page.evaluate(() => dispatchEvent(new Event('resize')));
  await expect(page.locator('.ap')).toHaveClass(/ap-reflow/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await inViewport(page, question(page), 'compositor con texto 200%');
  await page.screenshot({ path: SHOTS + '14-texto-200-1440x1000.png' });
});
