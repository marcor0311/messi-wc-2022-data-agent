"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Static chapters stay on the server; only the animation lifecycle hydrates. */
export default function MuseumExperience({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current!;
    const heading = element.querySelector<HTMLElement>("h1")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout>;
    let controller: { destroy(): void } | undefined;
    let layoutKey = "";
    const currentChapter = () => element.dataset.enhanced
        ? element.dataset.phase === "gallery" ? element.dataset.currentChapter
          : element.dataset.phase === "return" ? "museum-return" : "portada"
        : [...element.querySelectorAll<HTMLElement>("[data-gallery-panel]")]
          .findLast(panel => panel.getBoundingClientRect().top <= innerHeight * .5)?.id;
    const rebuild = async (savedChapter?: string) => {
      const type = getComputedStyle(heading);
      const rootSize = getComputedStyle(document.documentElement).fontSize;
      const reading = innerWidth < 1000 || innerHeight < 740
        || parseFloat(rootSize) > 20
        || parseFloat(type.lineHeight) / parseFloat(type.fontSize) > 1.35
        || parseFloat(type.letterSpacing) / parseFloat(type.fontSize) > .08;
      const key = [innerWidth, innerHeight, rootSize, type.fontSize, type.lineHeight, type.letterSpacing, reading, reduced.matches].join(":");
      // ResizeObserver and window resize can report the same change separately.
      if (key === layoutKey) return;
      layoutKey = key;
      const revision = ++generation;
      const chapter = savedChapter ?? currentChapter();
      controller?.destroy();
      controller = undefined;
      element.dataset.reading = String(reading);
      if (reading || reduced.matches) {
        if (chapter) document.getElementById(chapter)?.scrollIntoView({ behavior: "instant" });
        return;
      }
      try {
        const [{ createMuseumController }] = await Promise.all([
          import("./museum-scroll-controller"), document.fonts.ready,
        ]);
        if (!disposed && revision === generation) controller = createMuseumController(element, chapter);
      } catch {
        layoutKey = "";
        // The server-rendered document remains readable if enhancement fails.
      }
    };
    let pending = false;
    let savedChapter: string | undefined;
    const schedule = () => {
      // Capture before ScrollTrigger refreshes its pin after a viewport change.
      if (!pending) savedChapter = currentChapter();
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(() => { pending = false; void rebuild(savedChapter); }, 200);
    };
    const onError = (event: Event) => {
      if (event.target instanceof HTMLImageElement) {
        const photo = event.target.closest<HTMLElement>(".museum-photo");
        if (photo) photo.dataset.failed = "true";
      }
    };
    element.addEventListener("error", onError, true);
    element.querySelectorAll<HTMLImageElement>(".museum-photo img").forEach(image => {
      if (image.complete && image.naturalWidth === 0) image.closest<HTMLElement>(".museum-photo")!.dataset.failed = "true";
    });
    window.addEventListener("resize", schedule, { passive: true });
    reduced.addEventListener("change", schedule);
    let headingSize = "";
    const observer = new ResizeObserver(([entry]) => {
      const size = `${entry.contentRect.width}:${entry.contentRect.height}`;
      if (headingSize && size !== headingSize) schedule();
      headingSize = size;
    });
    observer.observe(heading);
    void rebuild();
    return () => {
      disposed = true;
      ++generation;
      clearTimeout(timer);
      observer.disconnect();
      controller?.destroy();
      element.removeEventListener("error", onError, true);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
    };
  }, []);
  return <div ref={root} className="museum">{children}</div>;
}
