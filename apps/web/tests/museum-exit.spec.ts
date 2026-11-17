import { test, expect } from "@playwright/test";

test.skip(({ isMobile }) => !!isMobile, "The museum is desktop only.");
const viewports = [{ width: 1440, height: 800 }, { width: 1440, height: 1000 }, { width: 1920, height: 1080 }];

for (const viewport of viewports) {
  for (const speed of ["slow", "fast"]) {
    test(`${speed} native scrolling enters and reverses the pinned museum at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.locator(".museum")).toHaveAttribute("data-scroll-driver", "gsap");
      await page.mouse.move(viewport.width / 2, viewport.height * .85);
      if (speed === "fast") await page.mouse.wheel(20, viewport.height * 5);
      else for (let i = 0; i < Math.ceil(viewport.height / 80) + 2; i++) {
        await page.mouse.wheel(0, 80);
        await page.waitForTimeout(25);
      }
      const story = page.locator(".horizontal-story");
      await expect.poll(() => story.evaluate(node => Math.abs(node.getBoundingClientRect().top))).toBeLessThan(1);
      await expect(page.locator('[data-active="true"] h2')).toBeInViewport({ ratio: 1 });
      await expect(page.locator('[data-active="true"] .scene-summary')).toBeInViewport({ ratio: 1 });
      await expect(page.locator(".museum-return-link")).not.toBeInViewport();
      const y = await page.evaluate(() => scrollY);
      await page.mouse.wheel(0, 350);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y + 300);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).not.toBe("hidden");
      await page.mouse.wheel(0, -viewport.height * 10);
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      await expect(page.getByRole("heading", { name: "El peso de la gloria" })).toBeInViewport({ ratio: 1 });
    });
  }

  test(`native scroll passes the last photo, reaches the link and returns at ${viewport.width}×${viewport.height}`, async ({ page, browserName }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#legado");
    const museum = page.locator(".museum");
    await expect(museum).toHaveAttribute("data-current-chapter", "legado");
    const step = await page.locator(".pin-spacer").evaluate(spacer => {
      const frame = spacer.querySelector<HTMLElement>(".horizontal-story")!;
      return (spacer.getBoundingClientRect().height - frame.getBoundingClientRect().height) / 22;
    });
    const initialY = await page.evaluate(() => scrollY);
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.wheel(0, step);
    await expect(museum).toHaveAttribute("data-current-chapter", "fin-de-una-era");
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(initialY + step, 0);
    await expect(page.locator("#fin-de-una-era h2")).toBeInViewport({ ratio: 1 });
    await expect(page.locator("#fin-de-una-era .scene-summary")).toBeInViewport({ ratio: 1 });
    await page.mouse.wheel(12, 240);
    const link = page.getByRole("link", { name: "Regresar al Mundial 2022", exact: true });
    await expect(link).toBeInViewport({ ratio: 1 });
    await expect(link).not.toBeFocused();
    await page.mouse.move(viewport.width / 2, 50);
    await page.mouse.wheel(0, -240);
    await expect.poll(() => page.locator(".horizontal-story").evaluate(node => Math.abs(node.getBoundingClientRect().top))).toBeLessThan(1);
    await expect(page.locator("#fin-de-una-era h2")).toBeInViewport({ ratio: 1 });
    await page.mouse.wheel(0, -step);
    await expect(museum).toHaveAttribute("data-current-chapter", "legado");
    await page.locator(".museum-coverflow").focus();
    await page.keyboard.press("End");
    await expect(museum).toHaveAttribute("data-current-chapter", "fin-de-una-era");
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    await expect(link).toBeFocused();
    await expect(link).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/analisis$/);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).not.toBe("hidden");
  });
}

test("continuous wheel input can exit in either direction without an idle gate", async ({ page }) => {
  await page.goto("/#legado");
  await expect(page.locator(".museum")).toHaveAttribute("data-scroll-driver", "gsap");
  await page.mouse.move(720, 400);
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(4, 100);
    await page.waitForTimeout(16);
  }
  await expect(page.locator(".museum-return-link")).toBeInViewport({ ratio: 1 });
  for (let i = 0; i < 45; i++) {
    await page.mouse.wheel(0, -350);
    await page.waitForTimeout(16);
  }
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});

test("native vertical keyboard controls leave both ends", async ({ page }) => {
  await page.goto("/#fin-de-una-era");
  await expect(page.locator(".museum")).toHaveAttribute("data-scroll-driver", "gsap");
  await page.keyboard.press("PageDown");
  await expect(page.locator(".museum-return-link")).toBeInViewport({ ratio: 1 });
  await page.evaluate(() => { location.hash = "comienzos"; });
  await expect(page.locator(".museum")).toHaveAttribute("data-current-chapter", "comienzos");
  await page.keyboard.press("PageUp");
  await expect(page.getByRole("heading", { name: "El peso de la gloria" })).toBeInViewport({ ratio: 1 });
});

test("vertical input is not cancelled or chased and photo layers stay bounded", async ({ page }) => {
  await page.goto("/#maracana");
  await expect(page.locator(".museum")).toHaveAttribute("data-scroll-driver", "gsap");
  expect(await page.locator(".museum-coverflow").evaluate(host => host.dispatchEvent(new WheelEvent("wheel", { deltaY: 80, bubbles: true, cancelable: true })))).toBe(true);
  await page.evaluate(() => {
    const original = window.scrollTo.bind(window);
    let lastInput = -Infinity;
    window.addEventListener("wheel", () => { lastInput = performance.now(); }, { passive: true });
    (window as unknown as { museumScrollCorrections: number }).museumScrollCorrections = 0;
    window.scrollTo = ((...args: Parameters<typeof window.scrollTo>) => {
      // Centering after scrollEnd is allowed; chasing an ongoing wheel gesture is not.
      if (performance.now() - lastInput < 100) (window as unknown as { museumScrollCorrections: number }).museumScrollCorrections++;
      original(...args);
    }) as typeof window.scrollTo;
  });
  await page.mouse.move(720, 400);
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, i < 20 ? 80 : -80);
    await page.waitForTimeout(16);
    expect(await page.locator(".coverflow-photo").count()).toBeLessThanOrEqual(5);
  }
  expect(await page.evaluate(() => (window as unknown as { museumScrollCorrections: number }).museumScrollCorrections)).toBe(0);
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
});

test("reading modes remove the pin and leave all chapters accessible", async ({ page }) => {
  await page.goto("/#qatar");
  await expect(page.locator(".museum")).toHaveAttribute("data-scroll-driver", "gsap");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await expect(page.locator('#qatar h2')).toBeInViewport();
  await expect(page.locator('[data-gallery-panel][inert]')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await page.addStyleTag({ content: "html { font-size: 150%; }" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".museum")).toHaveAttribute("data-reading", "true");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  const link = page.locator(".museum-return-link");
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeInViewport({ ratio: 1 });
});

test("resizing preserves the cover, selected chapter and footer instead of jumping regions", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".museum")).toHaveAttribute("data-scroll-driver", "gsap");
  const resize = async (width: number, height: number) => {
    const rebuilt = page.evaluate(() => new Promise<void>(resolve => {
      const previous = document.querySelector('.pin-spacer')!;
      const observer = new MutationObserver(() => {
        if (!previous.isConnected && document.querySelector('.pin-spacer')) {
          observer.disconnect(); resolve();
        }
      });
      observer.observe(document.querySelector('.museum')!, { childList: true, subtree: true });
    }));
    await page.setViewportSize({ width, height });
    await rebuilt;
    await expect(page.locator('.pin-spacer')).toHaveCount(1);
  };
  await resize(1440, 800);
  await expect(page.getByRole('heading', { name: 'El peso de la gloria' })).toBeInViewport({ ratio: 1 });
  await page.evaluate(() => { location.hash = 'qatar'; });
  await expect(page.locator('.museum')).toHaveAttribute('data-current-chapter', 'qatar');
  await resize(1920, 1080);
  await expect(page.locator('#qatar h2')).toBeInViewport({ ratio: 1 });
  await page.keyboard.press('End');
  await expect(page.locator('.museum')).toHaveAttribute('data-current-chapter', 'fin-de-una-era');
  await expect(page.locator('.museum-coverflow')).not.toHaveClass(/loopem-moving/);
  await expect(page.locator('#fin-de-una-era h2')).toBeInViewport({ ratio: 1 });
  await page.mouse.wheel(0, 650);
  await expect(page.locator('.museum-return-link')).toBeInViewport({ ratio: 1 });
  await resize(1440, 1000);
  await expect(page.locator('.museum-return-link')).toBeInViewport({ ratio: 1 });
});
