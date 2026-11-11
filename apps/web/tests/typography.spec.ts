import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.skip(({ isMobile }) => !!isMobile, "Desktop typography audit includes its own zoom and 320px reflow cases.");

const spacing = `* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }`;

test("all narrative type is upright, readable and ends headings without periods", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".museum")).toHaveAttribute("data-reading", "false");
  const problems = await page.locator(".museum").evaluate(root => {
    const text = [...root.querySelectorAll<HTMLElement>("h1,h2,p,a,small,figcaption,summary")];
    return text.filter(element => {
      const style = getComputedStyle(element);
      return element.getClientRects().length > 0 && (style.fontStyle !== "normal" || parseFloat(style.fontSize) < 14);
    }).map(element => element.textContent);
  });
  expect(problems).toEqual([]);
  for (const title of await page.locator(".museum h1,.museum h2").allTextContents()) expect(title.trim()).not.toMatch(/\.$/);
});

test("WCAG contrast checks cover every photographic chapter and the analysis", async ({ page }) => {
  // Measure the readable final state, independently of an entrance's transient opacity.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const id of ["portada", "comienzos", "camiseta-10-2009", "brasil-2013", "maracana", "volver", "quito-2017", "rusia", "america", "wembley", "qatar", "bicampeones", "legado"]) {
    await page.locator(`#${id}`).evaluate(element => element.scrollIntoView({ behavior: "instant" }));
    const results = await new AxeBuilder({ page }).include(`#${id}`).withRules(["color-contrast"]).analyze();
    expect(results.violations, `${id}: ${JSON.stringify(results.violations.map(v => v.nodes))}`).toEqual([]);
  }
  await page.goto("/analisis");
  await expect(page.getByRole("button", { name: /Muéstrame los tiros/ })).toBeEnabled();
  await page.getByRole("button", { name: /Muéstrame los tiros/ }).click();
  await expect(page.locator(".shot-marker")).toHaveCount(5);
  const result = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  expect(result.violations).toEqual([]);
});

test("200% default text size and WCAG text spacing preserve the full story", async ({ page }) => {
  await page.goto("/");
  await page.addStyleTag({ content: `html { font-size: 200% !important; } ${spacing}` });
  await expect(page.locator(".museum")).toHaveAttribute("data-reading", "true");
  for (const id of ["portada", "comienzos", "camiseta-10-2009", "brasil-2013", "maracana", "volver", "quito-2017", "rusia", "america", "wembley", "qatar", "bicampeones", "legado"]) {
    const bounds = await page.locator(`#${id}`).evaluate(section => {
      const stage = section;
      const copy = section.querySelector<HTMLElement>(".scene-copy,.hero-copy,.finale-text")!;
      const a = stage.getBoundingClientRect(), b = copy.getBoundingClientRect();
      const overflow = [...copy.querySelectorAll("h1,h2,p,a")].some(text => {
        const range = document.createRange(); range.selectNodeContents(text);
        return [...range.getClientRects()].some(rect => rect.left < b.left - 1 || rect.right > b.right + 1);
      });
      return { clipped: b.top < a.top - 1 || b.bottom > a.bottom + 1, overflow };
    });
    expect(bounds, id).toEqual({ clipped: false, overflow: false });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("320 CSS pixel reflow preserves both routes with custom text spacing", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of ["/", "/analisis"]) {
    await page.goto(path);
    await page.addStyleTag({ content: spacing });
    if (path === "/") await expect(page.locator(".museum")).toHaveAttribute("data-reading", "true");
    if (path === "/analisis") await expect(page.getByRole("button", { name: /Muéstrame los tiros/ })).toBeEnabled();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: path }).toBe(true);
  }
});
