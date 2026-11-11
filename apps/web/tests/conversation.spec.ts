import { test, expect, type Page } from "@playwright/test";

async function ask(page: Page, message: string) {
  const input = page.getByRole("textbox", { name: "Tu consulta de fútbol" });
  await expect(input).toBeEnabled();
  await input.fill(message);
  await page.getByRole("button", { name: "Enviar consulta" }).click();
  await expect(input).toBeEnabled();
  await expect(page.locator(".user-message").last()).toHaveText(message);
}

test("real Gold: three turns, snapshot restoration, selection and reload", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/analisis");
  await expect(page.getByRole("button", { name: /Muéstrame los tiros/ })).toBeEnabled();
  await page.screenshot({ path: `../../.impeccable/review/${info.project.name}-empty.png`, fullPage: true });
  await ask(page, "Muéstrame los tiros de Messi en la final");
  await expect(page.locator(".shot-marker")).toHaveCount(5);
  await expect(page.locator(".shot-path")).toHaveCount(5);
  await expect(page.locator(".goal-marker")).toHaveCount(5);
  await expect(page.locator('.shot-path[data-event-id="9615ffbc-b513-45e6-9ccc-015234483f95"]')).toHaveAttribute("x2", "120");
  await expect(page.locator('.shot-path[data-event-id="9615ffbc-b513-45e6-9ccc-015234483f95"]')).toHaveAttribute("y2", "45.5");
  await expect(page.locator(".summary-table tbody tr")).toHaveText(/Lionel Messi521,46/);
  await ask(page, "Quita los penales");
  await expect(page.locator(".shot-marker")).toHaveCount(4);
  await expect(page.locator(".shot-path")).toHaveCount(4);
  await expect(page.locator(".goal-marker")).toHaveCount(4);
  await expect(page.locator(".summary-table tbody tr")).toHaveText(/Lionel Messi410,67/);
  await ask(page, "Compáralo con Mbappé");
  await expect(page.locator(".pitch")).toHaveCount(2);
  await expect(page.locator(".shot-marker")).toHaveCount(8);
  await expect(page.locator(".shot-path")).toHaveCount(8);
  await expect(page.locator(".goal-mouth")).toHaveCount(2);
  await expect(page.locator(".goal-marker")).toHaveCount(6);
  await expect(page.locator(".goal-missing")).toContainText(["2 tiros sin altura registrada"]);
  await expect(page.locator('.goal-marker[data-event-id="b2d43671-a3e6-4709-9c0c-646442c1074c"]')).toHaveAttribute("data-end-z", "4.5");
  await expect(page.locator('.goal-marker[data-event-id="867b8791-49c0-4d98-a976-c0b4cfc1cb5a"]')).toHaveAttribute("data-before-line", "true");
  await expect(page.locator(".filter-chip").last()).toHaveText("Sin penales");
  await expect(page.locator(".summary-table tbody tr").last()).toHaveText(/Kylian Mbappé410,22/);
  await expect(page.getByRole("heading", { name: "Tiros · Messi y Mbappé" })).toBeVisible();
  await page.screenshot({ path: `../../.impeccable/review/${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name === "desktop") {
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    await page.locator(".goal-section").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "../../.impeccable/review/desktop-goal.png", fullPage: true });
  }
  await page.reload();
  await expect(page.locator(".shot-marker")).toHaveCount(8);
  // Keyboard selection reaches the same exact event used by the conversational detail.
  await page.locator(".shot-marker").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".shot-detail")).toBeVisible();
  await expect(page.locator('.goal-marker[data-event-id="9615ffbc-b513-45e6-9ccc-015234483f95"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('.goal-marker[data-event-id="03fb2918-e1e7-4ec8-89ff-7bc5531e853d"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('.shot-marker[data-event-id="03fb2918-e1e7-4ec8-89ff-7bc5531e853d"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator(".shot-marker").first().focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Consultar este tiro en la conversación" }).click();
  await expect(page.locator(".agent-message").last()).toContainText("9615ffbc-b513-45e6-9ccc-015234483f95");
  // Restore first turn: subsequent comparison must include match penalties again.
  await page.locator(".result-button").first().click();
  await expect(page.locator(".history-notice")).toBeVisible();
  await expect(page.locator(".shot-marker")).toHaveCount(5);
  await ask(page, "Compáralo con Mbappé");
  await expect(page.locator(".shot-marker")).toHaveCount(11);
  await expect(page.locator(".shot-path")).toHaveCount(11);
  await expect(page.locator(".goal-marker")).toHaveCount(9);
  await expect(page.locator(".filter-chip").last()).toHaveText("Con penales de partido");
  await page.getByText("Fuente y evidencia", { exact: false }).click();
  await expect(page.getByRole("link", { name: /Ver eventos originales/ })).toHaveAttribute("href", /4b73468fc5b0f1950f9f66fada70ad3a4f9327cb.*3869685/);
  expect(errors).toEqual([]);
});

test("pending query and recoverable error keep the active pitch", async ({ page }, info) => {
  await page.goto("/analisis");
  await ask(page, "Tiros de Messi en la final");
  await page.route("**/api/conversations/*/turns", async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "No se pudo consultar Gold. Reintenta.", recoverable: true }) });
  });
  await page.getByRole("textbox").fill("Quita los penales");
  await page.getByRole("button", { name: "Enviar consulta" }).click();
  await expect(page.getByText("Consultando los eventos…")).toBeVisible();
  await expect(page.locator(".shot-marker")).toHaveCount(5);
  await expect(page.locator(".error-notice")).toContainText("No se pudo consultar Gold");
  await expect(page.locator(".shot-marker")).toHaveCount(5);
  await page.screenshot({ path: `../../.impeccable/review/${info.project.name}-error.png`, fullPage: true });
  await page.unroute("**/api/conversations/*/turns");
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.locator(".shot-marker")).toHaveCount(4);
  await expect(page.locator(".error-notice")).toHaveCount(0);
});

test("empty selection renders recovery guidance (synthetic response)", async ({ page }, info) => {
  await page.goto("/analisis");
  await page.route("**/api/conversations/*/turns", async route => {
    const response = await route.fetch();
    const result = await response.json();
    result.response.status = "empty";
    result.response.visualization.data.shots = [];
    result.response.visualization.data.summaries.forEach((s: Record<string, unknown>) => { s.shots = 0; s.goals = 0; s.xg = 0; });
    result.response.explanation = "No hay tiros con estos filtros.";
    result.response.evidence.event_ids = [];
    result.response.visualization.data.evidence.event_ids = [];
    if (result.response.evidence.shot_height_source) result.response.evidence.shot_height_source.event_ids_with_height = [];
    if (result.response.visualization.data.evidence.shot_height_source) result.response.visualization.data.evidence.shot_height_source.event_ids_with_height = [];
    await route.fulfill({ response, json: result });
  });
  await ask(page, "Tiros de Messi en la final");
  await expect(page.getByRole("heading", { name: "No hay tiros con estos filtros" })).toBeVisible();
  await expect(page.locator(".shot-marker")).toHaveCount(0);
  await page.screenshot({ path: `../../.impeccable/review/${info.project.name}-no-data.png`, fullPage: true });
});

test("a competing turn preserves the rejected message for review", async ({ page }) => {
  await page.goto("/analisis");
  await ask(page, "Tiros de Messi en la final");
  await page.route("**/api/conversations/*/turns", async route => {
    const body = route.request().postDataJSON();
    const competing = await page.request.post(route.request().url(), {
      data: { message: "Tiros de Mbappé en la final", base_turn_id: body.base_turn_id },
    });
    expect(competing.status()).toBe(201);
    await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ detail: "El contexto cambió. Revisa el resultado activo antes de continuar.", recoverable: true }) });
  });
  await page.getByRole("textbox").fill("Quita los penales");
  await page.getByRole("button", { name: "Enviar consulta" }).click();
  await expect(page.locator(".error-notice")).toContainText("El contexto cambió");
  await expect(page.getByRole("textbox")).toHaveValue("Quita los penales");
  await expect(page.getByRole("heading", { name: "Tiros · Mbappé", exact: true })).toBeVisible();
  await expect(page.locator(".shot-marker")).toHaveCount(6);
});

test("legacy results explicitly refresh destinations while keeping filters", async ({ page }) => {
  await page.goto("/analisis");
  await page.route("**/api/conversations/*/turns", async route => {
    const response = await route.fetch();
    const result = await response.json();
    delete result.response.visualization.data.endpoint_data_version;
    result.response.visualization.data.shots.forEach((s: Record<string, unknown>) => {
      delete s.end_x; delete s.end_y; delete s.end_z;
    });
    await route.fulfill({ response, json: result });
  }, { times: 1 });
  await ask(page, "Tiros de Messi en la final sin penales");
  await expect(page.locator(".shot-path")).toHaveCount(0);
  await expect(page.locator(".legacy-result")).toBeVisible();
  await page.getByRole("button", { name: "Actualizar con destinos y vista del arco" }).click();
  await expect(page.locator(".shot-path")).toHaveCount(4);
  await expect(page.locator(".goal-marker")).toHaveCount(4);
  await expect(page.locator(".filter-chip").last()).toHaveText("Sin penales");
  await expect(page.locator(".legacy-result")).toHaveCount(0);
});
