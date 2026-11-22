import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { goldCases, mockChat } from './fixtures/agent';

// This component family is now the production /agent workspace.
const question = (page: import('@playwright/test').Page) => page.getByLabel('Tu pregunta sobre el Mundial de Messi');
const axe = async (page: import('@playwright/test').Page) => expect((await new AxeBuilder({ page }).include('.ap').analyze()).violations).toEqual([]);

test('Sin sesión, el chat conserva las sugerencias y el catálogo público', async ({ page }) => {
  await page.route('**/api/auth/status', r => r.fulfill({ json: { authenticated: false } }));
  await page.route('**/api/auth/accounts', r => r.fulfill({ json: [] }));
  await page.goto('/agent');
  await expect(page.getByRole('heading', { name: 'Conecta tu cuenta para conversar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar pregunta', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /Desde dónde remató Messi/ }).click();
  await expect(question(page)).toHaveValue(/remató Messi/);
  await axe(page);
  await page.getByRole('link', { name: 'Explorar datos', exact: true }).click();
  await expect(page).toHaveURL(/#ap-explorer$/);
  await expect(page.getByRole('heading', { name: 'Explora el Mundial 2022' })).toBeVisible();
  await expect(page.locator('.ap-views > div')).toHaveCount(10);
  await page.getByRole('button', { name: 'Volver a conversación' }).click();
  await expect(question(page)).toHaveValue(/remató Messi/);
});

test('Teclado, modelo, turnos previos y errores conservan el contexto y el borrador', async ({ page, request }) => {
  const cases = await goldCases(request);
  const { bodies } = await mockChat(page, [cases[0], cases[6]], { delay: 800, failOn: 3, answer: '## Resumen\n[Texto simulado] Datos verificados.\n\n- Primera lectura.\n- Segunda lectura.' });
  await page.goto('/agent');
  await expect(page.getByLabel('Modelo', { exact: true })).toHaveValue('model-a');
  await question(page).fill('Tiros de Messi');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('En el Mundial');
  await expect(question(page)).toHaveValue('Tiros de Messi\nEn el Mundial');
  await page.keyboard.press('Enter');
  await expect(page.locator('.ap-pending .ap-user')).toHaveText('Tiros de Messi\nEn el Mundial');
  await expect(page.getByRole('button', { name: 'Consultando los datos', exact: true })).toBeDisabled();
  await expect(page.locator('.agent-shotmap')).toBeVisible();
  await expect(page.locator('.ap-answer').first().locator('li')).toHaveCount(2);
  await expect(page.locator('.ap-answer').first()).not.toContainText('##');
  await axe(page);
  await page.getByLabel('Modelo', { exact: true }).selectOption('model-b');
  await question(page).fill('Ahora partido a partido'); await page.keyboard.press('Enter');
  await expect(page.locator('.agent-trend')).toHaveCount(6);
  expect(bodies[1]).toMatchObject({ conversation_id: 'test-conversation', model: 'model-b' });
  await page.locator('.ap-user-open').first().click();
  await expect(page.locator('.agent-shotmap')).toBeVisible();
  await question(page).fill('Pregunta que falla'); await page.keyboard.press('Enter');
  await expect(page.locator('.ap-error[role=alert]')).toContainText('La inferencia no se completó');
  await expect(question(page)).toHaveValue('Pregunta que falla');
  await expect(page.locator('article.ap-turn')).toHaveCount(2);
  await expect(page.locator('.agent-shotmap')).toBeVisible();
  await page.reload();
  await expect(page.locator('article.ap-turn')).toHaveCount(2);
  await expect(page.locator('.agent-trend')).toHaveCount(6);
  await page.getByRole('button', { name: 'Nueva conversación', exact: true }).click();
  await expect(page.locator('article.ap-turn')).toHaveCount(0);
});

test('Sesión vencida y pregunta de 4000 caracteres conservan el texto', async ({ page, request }) => {
  const cases = await goldCases(request); await mockChat(page, cases, { expireOn: 1 });
  await page.goto('/agent'); await expect(page.getByLabel('Modelo', { exact: true })).toHaveValue('model-a');
  const long = 'Compara tiros y goles. '.repeat(200).slice(0, 4000);
  await question(page).fill(long);
  await expect(page.locator('.ap-count')).toHaveText('4000/4000');
  await page.keyboard.press('Enter');
  await expect(page.locator('.ap-error[role=alert]')).toContainText('Tu sesión venció');
  await expect(page.getByRole('link', { name: 'Conectar de nuevo' })).toBeVisible();
  await expect(question(page)).toHaveValue(long);
});

test('Resultados vacíos y límites de filas se explican sin inventar datos', async ({ page, request }) => {
  const [shots] = await goldCases(request);
  await mockChat(page, [
    { ...shots, results: [{ ...shots.results[0], rows: [], matched_source_rows: 0 }] },
    { ...shots, results: [{ ...shots.results[0], rows: shots.results[0].rows.slice(0, 1), truncated: true }] },
  ]);
  await page.goto('/agent'); await expect(page.getByLabel('Modelo', { exact: true })).toHaveValue('model-a');
  await question(page).fill('Una selección vacía'); await page.keyboard.press('Enter');
  await expect(page.locator('.ap-empty-result')).toContainText('No hay registros');
  await question(page).fill('Una selección limitada'); await page.keyboard.press('Enter');
  await expect(page.locator('.ap-warning')).toContainText('Se muestran solo 1 filas de 32');
});

test('Movimiento reducido, zoom y texto ampliado conservan lectura y controles', async ({ page, request }) => {
  const cases = await goldCases(request); await mockChat(page, cases);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/agent'); await expect(page.getByLabel('Modelo', { exact: true })).toHaveValue('model-a');
  await question(page).fill('Tiros de Messi'); await page.keyboard.press('Enter');
  await expect(page.locator('.agent-shotmap')).toBeVisible();
  expect(await page.locator('#ap-result').evaluate(e => getComputedStyle(e).animationName)).toBe('none');
  // A zoom fallback on desktop, not a separate mobile product or device project.
  await page.setViewportSize({ width: 720, height: 500 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await question(page).scrollIntoViewIfNeeded(); await expect(question(page)).toBeInViewport();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addStyleTag({ content: 'html{font-size:32px!important}' });
  await page.evaluate(() => dispatchEvent(new Event('resize')));
  await expect(page.locator('.ap')).toHaveClass(/ap-reflow/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await question(page).scrollIntoViewIfNeeded(); await expect(question(page)).toBeInViewport();
});


test('Los botones de acciones conservan su texto visible en el nombre accesible', async ({ page, request }) => {
  const catalog = await (await request.get('/api/agent/catalog')).json();
  const messi = catalog.entities.players.find((p: { player_name: string }) => p.player_name.includes('Messi'));
  const response = await request.post('/api/agent/query', { data: {
    dataset: 'actions', visualization: 'pitch', filters: [
      { column: 'player_id', value: messi.player_id }, { column: 'type_name', value: 'Pass' },
    ], limit: 5,
  } });
  expect(response.ok()).toBeTruthy();
  const result = await response.json();
  await mockChat(page, [{ name: 'Pases', selector: '.agent-pitch', results: [result] }]);
  await page.goto('/agent'); await expect(page.getByLabel('Modelo', { exact: true })).toHaveValue('model-a');
  await question(page).fill('Pases de Messi'); await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: 'Elegir acción', exact: true })).toBeVisible();
  await axe(page);
});
