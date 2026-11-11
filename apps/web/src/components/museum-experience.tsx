"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Picker = {
  seek(offset: number): void;
  scrollTo(index: number, options?: { animate: boolean }): void;
  destroy(): void;
  on(event: "move", callback: (event: { offset: number }) => void, options?: { immediate: boolean }): void;
  on(event: "settle", callback: () => void): void;
};
type PickerFactory = (host: HTMLElement, options: Record<string, unknown>) => Picker;

/** Keep the full server-rendered narrative as the reading and no-JS fallback. */
export default function MuseumExperience({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const story = element.querySelector<HTMLElement>(".horizontal-story")!;
    const host = element.querySelector<HTMLElement>(".museum-coverflow")!;
    const panels = [...element.querySelectorAll<HTMLElement>("[data-gallery-panel]")];
    const sections = [...element.querySelectorAll<HTMLElement>("[data-chapter]")];
    const heading = element.querySelector<HTMLElement>("h1")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let picker: Picker | undefined;
    let disposed = false;
    let active = 0;
    let position = 0;
    let destination = 0;
    let frame = 0;
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;
    let navigation: ReturnType<typeof import("gsap").gsap.to> | undefined;
    let rebuild: (() => void) | undefined;
    let go: ((index: number, animate: boolean) => void) | undefined;
    const bound = (index: number) => Math.max(0, Math.min(panels.length - 1, index));

    const update = () => {
      frame = 0;
      const inGallery = story.getBoundingClientRect().top <= innerHeight * .5;
      element.dataset.phase = inGallery ? "gallery" : "hero";
      const current = picker ? (inGallery ? panels[active] : sections[0])
        : sections.findLast(section => section.getBoundingClientRect().top <= innerHeight * .5);
      if (current) element.dataset.currentChapter = current.id;
    };
    const select = (offset: number) => {
      position = offset;
      // Clamp captions as well as items when a drag rubber-bands past an edge.
      active = bound(Math.round(offset));
      panels.forEach((panel, index) => {
        panel.dataset.active = String(index === active);
        panel.inert = index !== active;
        panel.setAttribute("aria-hidden", String(index !== active));
      });
      update();
    };
    const interrupt = () => {
      navigation?.kill();
      navigation = undefined;
      clearTimeout(wheelTimer);
    };
    const clear = () => {
      interrupt();
      picker?.destroy();
      picker = undefined;
      go = undefined;
      delete element.dataset.enhanced;
      story.classList.remove("is-coverflow");
      panels.forEach(panel => {
        panel.inert = false;
        panel.removeAttribute("aria-hidden");
        delete panel.dataset.active;
      });
    };
    const navigate = (target: HTMLElement, focus = false) => {
      const index = panels.indexOf(target);
      if (picker && index >= 0) {
        story.scrollIntoView({ behavior: "instant", block: "start" });
        go?.(index, false);
      } else target.scrollIntoView({ behavior: "instant", block: "start" });
      if (focus) target.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
      update();
    };
    const restoreHash = () => {
      let id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
      const target = document.getElementById(id || "portada");
      if (target && element.contains(target)) navigate(target);
    };
    const advance = (step: number, animate: boolean) => {
      const index = bound(Math.round(navigation ? destination : position) + step);
      if (location.hash !== `#${panels[index].id}`) history.pushState(null, "", `#${panels[index].id}`);
      go?.(index, animate);
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>("a");
      if (!anchor || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(anchor.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
      let id;
      try { id = decodeURIComponent(url.hash.slice(1)); } catch { return; }
      const section = document.getElementById(id);
      if (!section || !element.contains(section)) return;
      event.preventDefault();
      if (location.hash !== url.hash) history.pushState(null, "", url.hash);
      navigate(section, event.detail === 0);
    };
    const onWheel = (event: WheelEvent) => {
      if (!picker) return;
      if (event.ctrlKey) { event.stopImmediatePropagation(); return; }
      const horizontal = Math.abs(event.deltaX) >= Math.abs(event.deltaY);
      if (horizontal && host.contains(event.target as Node)) { interrupt(); return; }
      const delta = horizontal ? event.deltaX : event.deltaY;
      if (!delta) return;
      interrupt();
      if (!horizontal && (position <= 0 && delta < 0 || position >= panels.length - 1 && delta > 0)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
      const width = Math.min(innerWidth * .46, innerWidth >= 1700 ? 850 : 740);
      picker.seek(bound(position + delta * factor / (width * 192 / 220)));
      wheelTimer = setTimeout(() => picker?.scrollTo(bound(Math.round(position))), 120);
    };
    const onKey = (event: KeyboardEvent) => {
      if (!picker || element.dataset.phase !== "gallery" || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input,textarea,select,[contenteditable=true]")) return;
      const step = ({ ArrowLeft: -1, ArrowRight: 1, PageUp: -5, PageDown: 5 } as Record<string, number>)[event.key];
      if (step === undefined && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (step !== undefined) advance(step, false);
      else go?.(event.key === "Home" ? 0 : panels.length - 1, false);
    };
    const onPointerDown = () => interrupt();
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    const checkLayout = () => {
      const type = getComputedStyle(heading);
      const reading = innerWidth < 1000 || innerHeight < 740
        || parseFloat(getComputedStyle(document.documentElement).fontSize) > 20
        || parseFloat(type.lineHeight) / parseFloat(type.fontSize) > 1.35
        || parseFloat(type.letterSpacing) / parseFloat(type.fontSize) > .08;
      const value = String(reading);
      if (element.dataset.reading !== value) {
        element.dataset.reading = value;
        rebuild?.();
      }
    };
    const onResize = () => { checkLayout(); rebuild?.(); update(); };
    const observer = new ResizeObserver(checkLayout);
    observer.observe(heading);
    checkLayout();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize, { passive: true });
    addEventListener("hashchange", restoreHash);
    addEventListener("popstate", restoreHash);
    element.addEventListener("click", onClick);
    story.addEventListener("wheel", onWheel, { passive: false, capture: true });
    host.addEventListener("pointerdown", onPointerDown, { capture: true });
    document.addEventListener("keydown", onKey, { capture: true });
    update();

    void Promise.all([
      import("gsap"),
      import("../../public/playbook-assets/loopem/index.js"),
      import("../../public/playbook-assets/loopem/layouts.js"),
    ]).then(([{ gsap }, loopem, { coverflow }]) => {
      if (disposed) return;
      const createPicker = loopem.createPicker as unknown as PickerFactory;
      rebuild = () => {
        const inGallery = element.dataset.phase === "gallery";
        if (!picker && inGallery) {
          const current = panels.findIndex(panel => panel.id === element.dataset.currentChapter);
          if (current >= 0) active = current;
        }
        clear();
        if (reduced.matches || element.dataset.reading === "true") {
          if (inGallery) panels[active].scrollIntoView({ behavior: "instant" });
          update();
          return;
        }
        story.classList.add("is-coverflow");
        const width = host.clientWidth * .62;
        const scale = width / 220;
        const preset = coverflow({ step: 100 * scale, spread: 80 * scale, depth: 86 * scale, angle: 56, reach: 5, perspective: 900 * scale });
        picker = createPicker(host, {
          ...preset,
          layout: (distance: number) => ({ ...preset.layout(distance), opacity: 1 }),
          items: panels,
          loop: "clamp", initialIndex: active, fade: 0, stiffness: 13, friction: .026,
          renderItem(panel: HTMLElement) {
            const figure = document.createElement("figure");
            figure.className = "coverflow-photo";
            const original = panel.querySelector<HTMLImageElement>(".scene-image img");
            const label = `${panel.dataset.year}. ${panel.querySelector("h2")!.textContent}`;
            figure.setAttribute("aria-label", label);
            const fallback = () => {
              const message = document.createElement("div");
              message.className = "photo-fallback";
              message.setAttribute("role", "img");
              message.setAttribute("aria-label", label);
              message.textContent = "La fotografía no está disponible. La historia continúa.";
              figure.replaceChildren(message);
            };
            if (!original) { fallback(); return figure; }
            const image = document.createElement("img");
            image.alt = original.alt;
            image.draggable = false;
            image.decoding = "async";
            image.sizes = "62vw";
            image.srcset = original.srcset;
            image.src = original.src;
            image.addEventListener("error", fallback, { once: true });
            figure.append(image);
            return figure;
          },
        });
        picker.on("move", ({ offset }) => select(offset), { immediate: true });
        picker.on("settle", () => {
          if (element.dataset.phase === "gallery" && location.hash !== `#${panels[active].id}`) {
            history.replaceState(null, "", `#${panels[active].id}`);
          }
        });
        go = (index, animate) => {
          interrupt();
          destination = bound(index);
          if (!animate) { picker!.scrollTo(destination, { animate: false }); return; }
          const motion = { offset: position };
          picker!.seek(position);
          navigation = gsap.to(motion, {
            offset: destination, duration: .28, ease: "power3.out",
            onUpdate: () => picker!.seek(motion.offset),
            onComplete: () => { navigation = undefined; picker!.scrollTo(destination, { animate: false }); },
          });
        };
        element.dataset.enhanced = "true";
        if (inGallery) story.scrollIntoView({ behavior: "instant" });
        update();
      };
      reduced.addEventListener("change", rebuild);
      rebuild();
      restoreHash();
      void document.fonts.ready.then(() => {
        if (!disposed) {
          checkLayout();
          restoreHash();
        }
      });
    }).catch(() => { clear(); update(); });

    return () => {
      disposed = true;
      observer.disconnect();
      if (rebuild) reduced.removeEventListener("change", rebuild);
      clear();
      cancelAnimationFrame(frame);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      removeEventListener("hashchange", restoreHash);
      removeEventListener("popstate", restoreHash);
      element.removeEventListener("click", onClick);
      story.removeEventListener("wheel", onWheel, { capture: true });
      host.removeEventListener("pointerdown", onPointerDown, { capture: true });
      document.removeEventListener("keydown", onKey, { capture: true });
    };
  }, []);

  return <div ref={root} className="museum">{children}</div>;
}
