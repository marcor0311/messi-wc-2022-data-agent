import { test, expect } from '@playwright/test';
import { goldCases, mockChat } from './fixtures/agent';

const SIZES = [{ width: 1440, height: 800 }, { width: 1440, height: 1000 }, { width: 1920, height: 1080 }];

for (const size of SIZES) test(`El chat actual muestra diez familias Gold a ${size.width}×${size.height}`, async ({ page, request }, testInfo) => {
  test.setTimeout(180000);
  const cases = await goldCases(request);
  const { bodies } = await mockChat(page, cases);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize(size);
  await page.goto('/agent');
  await expect(page.getByLabel('Modelo', { exact: true })).toHaveValue('model-a');
  await page.getByLabel('Modelo', { exact: true }).selectOption('model-b');
  for (const [i, sample] of cases.entries()) {
    await page.getByLabel('Tu pregunta sobre el Mundial de Messi').fill(sample.name);
    await page.getByRole('button', { name: 'Enviar pregunta', exact: true }).click();
    await expect(page.locator('article.ap-turn')).toHaveCount(i + 1);
    await expect(page.locator('#ap-result ' + sample.selector).first()).toBeVisible();
    await expect(page.locator('#ap-result .ap-dash-item')).toHaveCount(sample.results.length);
    expect(bodies[i]).toMatchObject({ model: 'model-b', conversation_id: i ? 'test-conversation' : null });
    expect(bodies[i].audience).toBeUndefined();
    if (sample.name === 'Tiros de Messi') await expect(page.getByLabel('Cancha: pitch').getByRole('button')).toHaveCount(32);
    if (sample.name === 'Evolución de Messi') await expect(page.locator('.agent-trend')).toHaveCount(6);
    if (sample.name === 'Onces de la final') {
      await expect(page.getByRole('tab', { name: 'Argentina', exact: true })).toBeVisible();
      await page.getByRole('tab', { name: 'Francia', exact: true }).click();
      await expect(page.getByLabel('Once de Francia', { exact: true })).toBeVisible();
    }
    if (sample.name === 'Cambios de alineación') {
      await page.getByRole('group', { name: 'Elegir momento del partido' }).getByRole('button').last().click();
      await expect(page.locator('.agent-story-when')).toContainText('Minuto');
    }
    await page.getByRole('button', { name: 'Datos exactos', exact: true }).first().click();
    await expect(page.getByRole('region', { name: 'Datos exactos', exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Fuentes y consulta', exact: true }).first().click();
    await expect(page.getByLabel('Consulta reproducible en JSON').first()).toContainText('query_sha256');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), sample.name).toBeTruthy();
    if (size.height === 1000) await page.screenshot({ path: testInfo.outputPath(`resultado-${i}.png`) });
  }
  await page.locator('.ap-user-open').first().click();
  await expect(page.locator('.agent-shotmap')).toBeVisible();
  await page.reload();
  await expect(page.locator('article.ap-turn')).toHaveCount(cases.length);
  await expect(page.getByLabel('Cancha: network')).toBeVisible();
  expect(errors).toEqual([]);
});
