import { test, expect } from "@playwright/test";

test.skip(({ isMobile }) => !!isMobile, "The museum is desktop only.");

for (const input of ["keyboard", "vertical wheel", "horizontal wheel"]) {
  test(`${input} travels through intermediate positions instead of cutting`, async ({ page }) => {
    await page.goto("/#comienzos");
    await expect(page.locator(".museum")).toHaveAttribute("data-enhanced", "true");
    const samples = await page.evaluate(async input => {
      const host = document.querySelector<HTMLElement>(".museum-coverflow")!;
      const photo = host.querySelector<HTMLElement>('[data-loopem-key="0"]')!;
      const x = () => Number(photo.style.transform.match(/translate3d\(([-\d.]+)px/)![1]);
      const before = x();
      if (input === "keyboard") document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      else host.dispatchEvent(new WheelEvent("wheel", { deltaY: input === "vertical wheel" ? 350 : 0, deltaX: input === "horizontal wheel" ? 350 : 0, bubbles: true, cancelable: true }));
      const immediate = x();
      const frames: number[] = [];
      const end = performance.now() + 600;
      while (performance.now() < end) {
        await new Promise(requestAnimationFrame);
        frames.push(x());
      }
      return { before, immediate, frames };
    }, input);
    expect(samples.immediate, "the input must retarget motion without teleporting").toBe(samples.before);
    expect(new Set(samples.frames).size).toBeGreaterThan(8);
    expect(samples.frames.some(x => x < samples.before - 10)).toBe(true);
    await expect(page.locator(".museum-coverflow")).not.toHaveClass(/loopem-moving/);
    await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter", "alemania-2006");
  });
}

test("rapid navigation can reverse an unfinished spring and retains the requested destination", async ({ page }) => {
  await page.goto("/#comienzos");
  const museum = page.locator(".museum");
  await expect(museum).toHaveAttribute("data-enhanced", "true");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(80);
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".museum-coverflow")).not.toHaveClass(/loopem-moving/);
  await expect(museum).toHaveAttribute("data-current-chapter", "comienzos");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".museum-coverflow")).not.toHaveClass(/loopem-moving/);
  await expect(museum).toHaveAttribute("data-current-chapter", "alemania-2006");
});

test("only year and score digits roll; text stays still until the final card settles", async ({ page }) => {
  await page.goto("/#comienzos");
  await expect(page.locator(".museum-caption-motion")).toHaveCount(1);
  await expect(page.locator('.caption-window')).toHaveCount(6);
  const result = await page.evaluate(async () => {
    const layer = document.querySelector<HTMLElement>(".museum-caption-motion")!;
    const transforms = new Set<string>();
    const failures: string[] = [];
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    const start = performance.now();
    while (performance.now() - start < 1600) {
      for (const cell of layer.querySelectorAll<HTMLElement>(".caption-cell")) {
        if (getComputedStyle(cell).opacity !== "1") failures.push("faded number");
      }
      for (const field of ["year-0", "year-1", "year-2"]) {
        const cell = layer.querySelector<HTMLElement>(`[data-caption-field="${field}"] .caption-cell`)!;
        if (cell.style.transform !== "translate3d(0px, 0%, 0px)") failures.push("unchanged digit moved");
      }
      const title = document.querySelector<HTMLElement>('#comienzos .scene-heading')!;
      if (getComputedStyle(title).transform !== "none") failures.push("moving reading text");
      if (performance.now() - start < 200 && getComputedStyle(title).opacity !== "1") failures.push("text changed during travel");
      transforms.add(layer.querySelector<HTMLElement>('[data-caption-field="year-3"] .caption-cell')!.style.transform);
      await new Promise(requestAnimationFrame);
    }
    return { transforms: [...transforms], failures };
  });
  expect(result.failures).toEqual([]);
  expect(result.transforms.length).toBeGreaterThan(8);
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter", "alemania-2006");
  await expect(page.locator('#alemania-2006 h2')).toBeVisible();
  await expect(page.locator('[data-exiting]')).toHaveCount(0);
});

test("same-year navigation keeps all year digits still and awards preserve their accessible text", async ({ page }) => {
  await page.goto("/#wembley");
  await expect(page.locator(".museum-caption-motion")).toHaveCount(1);
  const years = () => page.locator('.caption-window[data-caption-field^="year-"] .caption-cell').evaluateAll(cells =>
    cells.map(cell => ({ text: cell.textContent, transform: (cell as HTMLElement).style.transform }))
  );
  const before = await years();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".museum-coverflow")).not.toHaveClass(/loopem-moving/);
  expect(await years()).toEqual(before);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter", "balon-oro-2023");
  await expect(page.locator('#balon-oro-2023 .award-count')).toBeVisible();
  await expect(page.locator('#balon-oro-2023 .award-count')).toHaveText("8");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter", "bicampeones");
  await expect.poll(() => page.locator('[data-caption-field="score-0"]').textContent()).toBe("1");
  await expect.poll(() => page.locator('[data-caption-field="score-1"]').textContent()).toBe("0");
  expect(await page.locator('.museum-caption-motion [id]').count()).toBe(0);
});

for (const viewport of [{ width: 1440, height: 800 }, { width: 1440, height: 1000 }, { width: 1920, height: 1080 }]) {
test(`title and summary transition without overlapping at ${viewport.width}×${viewport.height}`, async ({ page }) => {
  await page.setViewportSize(viewport);
  await page.goto("/#comienzos");
  await expect(page.locator(".museum")).toHaveAttribute("data-enhanced", "true");
  const result = await page.evaluate(async () => {
    const museum = document.querySelector<HTMLElement>(".museum")!;
    const old = document.querySelector<HTMLElement>('#comienzos .scene-heading')!;
    const next = document.querySelector<HTMLElement>('#alemania-2006 .scene-heading')!;
    const committed = new Promise<void>(resolve => {
      const observer = new MutationObserver(() => {
        if (museum.dataset.currentChapter === "alemania-2006") { observer.disconnect(); resolve(); }
      });
      observer.observe(museum, { attributes: true, attributeFilter: ["data-current-chapter"] });
    });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await committed;
    const failures: string[] = [];
    let sawExit = false, sawEntrance = false;
    const end = performance.now() + 400;
    while (performance.now() < end) {
      const before = getComputedStyle(old), after = getComputedStyle(next);
      const oldOpacity = before.visibility === "visible" ? Number(before.opacity) : 0;
      const newOpacity = after.visibility === "visible" ? Number(after.opacity) : 0;
      if (oldOpacity > .001 && newOpacity > .001) failures.push("overlapping passages");
      if (before.transform !== "none" || after.transform !== "none") failures.push("moving reading text");
      sawExit ||= oldOpacity > .01 && oldOpacity < .99;
      sawEntrance ||= newOpacity > .01 && newOpacity < .99;
      await new Promise(requestAnimationFrame);
    }
    return { failures, sawExit, sawEntrance };
  });
  expect(result).toEqual({ failures: [], sawExit: true, sawEntrance: true });
  await expect(page.locator('#alemania-2006 .scene-heading')).toHaveCSS("opacity", "1");
  await expect(page.locator('[data-exiting]')).toHaveCount(0);
});

}

test("keyboard skip links move focus directly to the readable chapter", async ({ page }) => {
  await page.goto("/#qatar");
  await expect(page.locator(".museum")).toHaveAttribute("data-enhanced", "true");
  await page.evaluate(() => { location.hash = "portada"; });
  await page.locator('.museum-skip').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('#comienzos h2')).toBeFocused();
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter", "comienzos");
});

for (const viewport of [{ width: 1440, height: 800 }, { width: 1440, height: 1000 }, { width: 1920, height: 1080 }]) {
  test(`all year and score glyphs remain uncut at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#comienzos");
    await expect(page.locator(".museum-caption-motion")).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    const ids = await page.locator('[data-gallery-panel]').evaluateAll(panels => panels.map(panel => panel.id));
    for (const id of ids) {
      await page.evaluate(id => { location.hash = id; }, id);
      await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter", id);
      const box = (await page.locator('.museum-world').boundingBox())!;
      // Exclude the divider at the fractional viewport boundary; compare all
      // numeric ink without locator screenshots scrolling that edge into view.
      const clip = { x: box.x, y: Math.ceil(box.y) + 2, width: box.width, height: Math.floor(box.height) - 4 };
      const masked = await page.screenshot({ clip });
      await page.locator('.caption-window').evaluateAll(windows => windows.forEach(window => (window as HTMLElement).style.overflow = "visible"));
      const complete = await page.screenshot({ clip });
      expect(masked.equals(complete), `${id}: numeric ink must be identical with and without clipping`).toBe(true);
      await page.locator('.caption-window').evaluateAll(windows => windows.forEach(window => (window as HTMLElement).style.removeProperty("overflow")));
    }
  });
}

for (const viewport of [{ width: 1440, height: 800 }, { width: 1440, height: 1000 }, { width: 1920, height: 1080 }]) {
  test(`the photo proposal keeps the original photographic crop at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#qatar");
    await expect(page.locator(".museum")).toHaveAttribute("data-enhanced", "true");
    const original = await page.locator("[data-loopem-centered] .coverflow-photo img").boundingBox();
    await page.goto("/museo-propuesta#qatar");
    await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter", "qatar");
    const photo = page.locator("[data-loopem-centered] .coverflow-photo");
    await expect.poll(() => photo.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(photo.locator("figcaption")).toHaveText("2022 · Lusail18 / 23");
    await expect(photo.locator("img")).toHaveCSS("object-fit", "cover");
    expect(await photo.locator("img").boundingBox()).toEqual(original);
    const bounds = await photo.boundingBox();
    const copy = await page.locator("#qatar .scene-copy").boundingBox();
    expect(bounds!.y).toBeGreaterThan(0);
    expect(bounds!.y + bounds!.height).toBeLessThan(copy!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/private/tmp/museum-photo-proposal-${viewport.width}x${viewport.height}.png` });
  });
}
