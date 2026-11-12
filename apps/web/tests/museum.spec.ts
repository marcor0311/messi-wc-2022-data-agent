import { test, expect, type Page } from "@playwright/test";

test.skip(({ isMobile }) => !!isMobile, "The landing storytelling is desktop only.");

const ids = ["comienzos", "alemania-2006", "copa-2007", "beijing-2008", "camiseta-10-2009", "sudafrica-2010", "copa-2011", "brasil-2012", "brasil-2013", "maracana", "copa-2015", "volver", "quito-2017", "rusia", "copa-2019", "america", "wembley", "qatar", "balon-oro-2023", "bicampeones", "eliminatorias-2025", "legado", "fin-de-una-era"];
const desktopViewports = [{ width: 1440, height: 800 }, { width: 1440, height: 1000 }, { width: 1920, height: 1080 }];

async function moment(page: Page, id: string) {
  await page.evaluate(id => { location.hash = id; }, id);
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter", id);
  await expect(page.locator(`#${id} h2`)).toBeInViewport();
  await expect.poll(() => page.locator(`#${id} .scene-copy`).evaluate(el => Number(getComputedStyle(el).opacity))).toBeGreaterThan(.99);
}

test("the triangular brand stays on the cover and redundant navigation is absent", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".museum")).toHaveAttribute("data-enhanced", "true");
  await expect(page.getByRole("heading", { name: "El peso de la gloria" })).toBeInViewport();
  await expect.poll(() => page.locator('.hero-photo img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator(".museum-index,.museum-analysis-link,.gallery-heading,.museum-position,.timeline-hint,.museum-arrows")).toHaveCount(0);
  await expect(page.locator(".horizontal-story button,.coverflow-controls,.coverflow-navigation")).toHaveCount(0);
  expect(await page.locator(".museum-stars svg").evaluateAll(stars => {
    const [top,left,right] = stars.map(star => star.getBoundingClientRect());
    return top.top < left.top && left.top === right.top && top.left > left.left && top.left < right.left;
  })).toBe(true);
  await page.getByRole("link", { name: "Recorrer la historia", exact: true }).click();
  await expect(page.locator(".museum")).toHaveAttribute("data-phase", "gallery");
  await expect(page.locator(".museum-header")).not.toBeInViewport();
});

for (const viewport of desktopViewports) {
test(`all twenty-three captions keep the same slots and typography at ${viewport.width}×${viewport.height}`, async ({ page }) => {
  await page.setViewportSize(viewport);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/#comienzos");
  await expect(page.locator(".museum")).toHaveAttribute("data-enhanced", "true");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".memory-scene img")).toHaveCount(ids.length);
  await expect(page.locator(".match-score")).toHaveCount(ids.length - 1);
  await expect(page.locator(".chapter-award")).toHaveCount(1);
  await expect(page.locator("#balon-oro-2023 .chapter-award")).toHaveAttribute("aria-label", "8 Balones de Oro de Lionel Messi");
  await expect(page.locator("#balon-oro-2023 .award-count")).toHaveText("8");
  await expect(page.locator("#balon-oro-2023 .award-label")).toHaveText("Balones de Oro");
  await expect(page.locator("#balon-oro-2023 .score-board")).toHaveCount(0);
  await expect(page.locator("#copa-2007 .match-score")).toHaveAttribute("aria-label", "Final de la Copa América: Argentina 0, Brasil 3");
  await expect(page.locator("#copa-2007 .score-location")).toHaveText("Maracaibo, Venezuela");
  await expect(page.locator("#comienzos .match-score")).toHaveAttribute("aria-label", "Amistoso internacional: Argentina 2, Hungría 1");
  await expect(page.locator("#comienzos .score-location")).toHaveText("Budapest, Hungría");
  await expect(page.locator("#comienzos .score-dismissal")).toHaveText("Messi 64′");
  await expect(page.locator("#comienzos .score-dismissal").getByRole("img", { name: "Tarjeta roja" })).toBeVisible();
  await expect(page.locator("#fin-de-una-era .match-score")).toHaveAttribute("aria-label", "Amistoso internacional: Argentina 3, Benín 0");
  await expect(page.locator("#fin-de-una-era .score-location")).toHaveText("Buenos Aires, Argentina");
  await expect(page.locator(".scene-story,.scene-date,.scene-note")).toHaveCount(0);
  const slots = (id: string, sharedOnly = false) => page.locator(`#${id}`).evaluate((panel, sharedOnly) =>
    [...panel.querySelectorAll<HTMLElement>(sharedOnly ? ".scene-copy,.scene-year,.scene-heading,h2,.scene-summary,.match-score,.chapter-award,.score-location,.score-context,.score-competition" : ".scene-copy,.scene-year,.scene-heading,h2,.scene-summary,.match-score,.score-location,.score-board,.score-team,.score-result,.score-result strong,.score-context,.score-competition")].map(element => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { x: box.x, y: box.y, width: box.width, height: box.height, fontSize: style.fontSize, transform: style.transform };
    }), sharedOnly
  );
  const referenceSlots = await slots(ids[0]);
  const referenceSharedSlots = await slots(ids[0], true);
  for (const id of ids) {
    await moment(page,id);
    await expect.poll(() => page.locator('.museum-coverflow [data-loopem-centered] img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const bounds = await page.locator(`#${id}`).evaluate(panel => {
      const rect = (selector: string) => panel.querySelector(selector)!.getBoundingClientRect();
      const photo = document.querySelector('.museum-coverflow [data-loopem-centered]')!.getBoundingClientRect(), copy = rect(".scene-copy"), year = rect(".scene-year"), phrase = rect("h2"), summary = rect(".scene-summary"), location = rect(".score-location");
      const score = panel.querySelector(".score-board,.award-board")?.getBoundingClientRect();
      const texts = [...panel.querySelectorAll(".scene-year,.scene-heading,.match-score,.chapter-award,.score-location")].map(element => element.getBoundingClientRect());
      return {
        overlap: photo.left < copy.right && photo.right > copy.left && photo.top < copy.bottom && photo.bottom > copy.top,
        clipped: copy.left < 0 || copy.right > innerWidth || copy.top < 0 || copy.bottom > innerHeight || texts.some(text => text.bottom > innerHeight || text.right > copy.right + 1),
        ordered: year.right <= phrase.left && phrase.bottom <= summary.top && (!score || location.bottom <= score.top),
        topAligned: Math.max(year.top, phrase.top, location.top) - Math.min(year.top, phrase.top, location.top) < 1,
        sharedFooter: Math.abs(summary.top - rect(".score-context").top) < 1,
        nativeYear: !panel.querySelector('.scene-year svg') && getComputedStyle(panel.querySelector('.scene-year')!).fontVariantNumeric.includes("tabular-nums"),
        wholeTeamNames: [...panel.querySelectorAll('.score-team')].every(team => {
          const text = team.firstChild!;
          const range = document.createRange();
          return [...(text.textContent || "").matchAll(/\S+/g)].every(word => {
            range.setStart(text, word.index!);
            range.setEnd(text, word.index! + word[0].length);
            return range.getClientRects().length === 1;
          });
        }),
      };
    });
    expect(bounds,id).toEqual({overlap:false,clipped:false,ordered:true,topAligned:true,sharedFooter:true,nativeYear:true,wholeTeamNames:true});
    if (id === "balon-oro-2023") {
      expect(await slots(id, true), "the award shares the year, narrative, location and footer tracks").toEqual(referenceSharedSlots);
    } else expect(await slots(id), `${id}: no slot changes size or position between chapters`).toEqual(referenceSlots);
  }
  await moment(page,"qatar");
  await expect(page.locator("#qatar .match-score")).toHaveAttribute("aria-label","Final del Mundial: Argentina 3, Francia 3. Penales: Argentina 4, Francia 2");
  expect(errors).toEqual([]);
});
}

test("the timeline is removed entirely and both 2022 moments remain accessible", async ({ page }) => {
  await page.goto("/#wembley");
  await expect(page.locator(".museum")).toHaveAttribute("data-enhanced", "true");
  await expect(page.locator(".museum-timeline,.timeline-track,.timeline-dot,[data-chapter-link]")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Línea de tiempo" })).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter","qatar");
  await expect(page.locator('#qatar .scene-year-label')).toHaveText("2022");
});

test("scrolling travels rightward through the story and keyboard navigation is reversible", async ({ page }) => {
  await page.goto("/#comienzos");
  await expect(page.locator(".museum")).toHaveAttribute("data-enhanced", "true");
  const photo = page.locator('.museum-coverflow .loopem-slot[data-loopem-key="0"]');
  const initial = await photo.evaluate(element => element.getBoundingClientRect().left);
  await page.mouse.wheel(0,350);
  await expect.poll(() => photo.evaluate(element => element.getBoundingClientRect().left)).toBeLessThan(initial - 20);
  await expect(page.locator('.museum-coverflow')).not.toHaveClass(/loopem-moving/);
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter","alemania-2006");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter","copa-2007");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter","beijing-2008");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter","camiseta-10-2009");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter","sudafrica-2010");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter","camiseta-10-2009");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter","beijing-2008");
  await expect.poll(() => page.locator("#beijing-2008 .scene-copy").evaluate(el => Number(getComputedStyle(el).opacity))).toBeGreaterThan(.99);
});

test("direct URLs, history and keyboard controls preserve the story position", async ({ page }) => {
  await page.goto("/#qatar");
  await expect(page.locator(".museum")).toHaveAttribute("data-enhanced", "true");
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter","qatar");
  await page.getByRole("listbox", { name: "Recorrido fotográfico de Messi" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("listbox", { name: "Recorrido fotográfico de Messi" })).toBeFocused();
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter","wembley");
  await page.goBack();
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter","qatar");
});

test("reduced motion preserves the entire narrative and can change at runtime", async ({ page }) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/#qatar");
  await expect(page.locator("#qatar h2")).toBeInViewport();
  await expect(page.locator(".horizontal-story")).not.toHaveClass(/is-coverflow/);
  await expect(page.locator(".museum-caption-motion")).toHaveCount(0);
  await page.emulateMedia({reducedMotion:"no-preference"});
  await expect(page.locator(".museum")).toHaveAttribute("data-enhanced","true");
  await expect(page.locator(".museum-caption-motion")).toHaveCount(1);
  await expect(page.locator("#qatar h2")).toBeInViewport();
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(page.locator('[data-gallery-panel][inert]')).toHaveCount(0);
  await expect(page.locator(".museum-caption-motion")).toHaveCount(0);
});

test("the story remains readable without JavaScript or photography", async ({ browser, page }) => {
  const context = await browser.newContext({javaScriptEnabled:false,viewport:{width:1440,height:1000},baseURL:test.info().project.use.baseURL});
  const document = await context.newPage();
  await document.goto("/");
  await expect(document.locator(".memory-scene")).toHaveCount(ids.length);
  await expect(document.getByRole("heading",{name:"El peso de la gloria"})).toBeVisible();
  await context.close();
  await page.route("**/_next/image?*",route=>route.abort());
  await page.goto("/");
  await expect(page.locator(".hero-photo .photo-fallback")).toBeVisible();
  await page.getByRole("link",{name:"Recorrer la historia",exact:true}).click();
  await expect(page.locator("#comienzos h2")).toBeInViewport();
});

for (const viewport of desktopViewports) {
  test(`coverflow stays opaque and stops at both ends at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#maracana");
    const museum = page.locator(".museum");
    const host = page.locator(".museum-coverflow");
    await expect(museum).toHaveAttribute("data-enhanced", "true");
    await expect(museum).toHaveAttribute("data-current-chapter", "maracana");
    await expect.poll(() => host.locator('[data-loopem-centered] img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: `/private/tmp/landing-coverflow-${viewport.width}x${viewport.height}.png` });
    const opacity = page.evaluate(async () => {
      const failures: string[] = [];
      const end = performance.now() + 400;
      while (performance.now() < end) {
        for (const node of document.querySelectorAll('.museum-coverflow .loopem-slot,.coverflow-photo,.coverflow-photo img')) {
          if (getComputedStyle(node).opacity !== "1") failures.push(node.className);
        }
        await new Promise(requestAnimationFrame);
      }
      return failures;
    });
    await host.focus();
    await page.keyboard.press("ArrowRight");
    expect(await opacity).toEqual([]);
    await expect(museum).toHaveAttribute("data-current-chapter", "copa-2015");
    const bounds = await host.boundingBox();
    const x = bounds!.x + bounds!.width / 2, y = bounds!.y + bounds!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 650);
    await expect(museum).toHaveAttribute("data-current-chapter", "volver");
    await expect(host).not.toHaveClass(/loopem-moving/);
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(x - i * 55, y);
      await page.waitForTimeout(25);
    }
    await page.mouse.up();
    await expect(host).not.toHaveClass(/loopem-moving/);
    await expect(museum).not.toHaveAttribute("data-current-chapter", "volver");
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowLeft");
    await expect(museum).toHaveAttribute("data-current-chapter", "comienzos");
    // Rubber-banding at the first card must never show the last caption.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 650, y, { steps: 12 });
    await expect(museum).toHaveAttribute("data-current-chapter", "comienzos");
    await page.mouse.up();
    await expect(host).not.toHaveClass(/loopem-moving/);
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowRight");
    await expect(museum).toHaveAttribute("data-current-chapter", "fin-de-una-era");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 650, y, { steps: 12 });
    await expect(museum).toHaveAttribute("data-current-chapter", "fin-de-una-era");
    await page.mouse.up();
    await expect(host).not.toHaveClass(/loopem-moving/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
