"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createCaptionMotion } from "./museum-caption-motion";

type Picker = {
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
    const photoProposal = !!element.closest(".museum-photo-proposal");
    let picker: Picker | undefined;
    let disposed = false;
    let active = 0;
    let position = 0;
    let destination = 0;
    let frame = 0;
    let wheelTarget: number | undefined;
    let navigating = false;
    let instantNavigation = false;
    let textAnimations: Animation[] = [];
    let finishText = () => {};
    let captions: ReturnType<typeof createCaptionMotion> | undefined;
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;
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
    const showCaption = (next: number, animate = false) => {
      if (element.dataset.enhanced && active === next) return;
      finishText();
      const previous = active;
      active = next;
      panels.forEach((panel, index) => {
        panel.dataset.active = String(index === active);
        panel.inert = index !== active;
        panel.setAttribute("aria-hidden", String(index !== active));
      });
      captions?.set(next, animate);
      if (animate && !reduced.matches && previous !== next) {
        const old = panels[previous];
        old.dataset.exiting = "true";
        const selector = ".score-location,.score-team,.score-context,.award-board";
        const outgoing = [...old.querySelectorAll<HTMLElement>(selector)];
        const incoming = [...panels[next].querySelectorAll<HTMLElement>(selector)];
        const oldHeading = old.querySelector<HTMLElement>(".scene-heading")!;
        const newHeading = panels[next].querySelector<HTMLElement>(".scene-heading")!;
        // Never blend two different passages on top of each other. The whole
        // title/summary leaves first, then the next passage enters in place.
        textAnimations = [
          oldHeading.animate({ opacity: [1, 0] }, { duration: 120, easing: "linear", fill: "forwards" }),
          newHeading.animate({ opacity: [0, 1] }, {
            delay: 120, duration: 180, easing: "cubic-bezier(.23,1,.32,1)", fill: "backwards",
          }),
          ...outgoing.map(node => node.animate({ opacity: [1, 0] }, { duration: 180, easing: "linear", fill: "forwards" })),
          ...incoming.map(node => node.animate({ opacity: [0, 1] }, { duration: 180, easing: "linear" })),
        ];
        const animations = textAnimations;
        const cleanup = () => {
          delete old.dataset.exiting;
          animations.forEach(animation => animation.cancel());
          if (textAnimations === animations) textAnimations = [];
        };
        finishText = cleanup;
        void Promise.all(animations.map(animation => animation.finished)).then(cleanup).catch(() => {});
      }
      update();
    };
    const select = (offset: number) => {
      position = offset;
      if (!navigating && wheelTarget === undefined) destination = offset;
      // Keep the reading block still while photos pass. Commit one final chapter.
    };
    const interrupt = () => {
      navigating = false;
      destination = position;
      wheelTarget = undefined;
      clearTimeout(wheelTimer);
    };
    const clear = () => {
      interrupt();
      finishText();
      captions?.destroy();
      captions = undefined;
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
    const navigate = (target: HTMLElement, focus = false, animate = false) => {
      const index = panels.indexOf(target);
      if (picker && index >= 0) {
        story.scrollIntoView({ behavior: "instant", block: "start" });
        go?.(index, animate);
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
      const index = bound(Math.round(destination) + step);
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
      navigate(section, event.detail === 0, event.detail !== 0);
    };
    const onWheel = (event: WheelEvent) => {
      if (!picker) return;
      if (event.ctrlKey) { event.stopImmediatePropagation(); return; }
      const horizontal = Math.abs(event.deltaX) >= Math.abs(event.deltaY);
      const delta = horizontal ? event.deltaX : event.deltaY;
      if (!delta) return;
      // Let the document scroll out of either end after the last snap finishes.
      if (!horizontal && !host.classList.contains("loopem-moving")
        && (position <= 0 && delta < 0 || position >= panels.length - 1 && delta > 0)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
      const width = Math.min(innerWidth * .46, innerWidth >= 1700 ? 850 : 740);
      wheelTarget = bound((wheelTarget ?? position) + delta * factor / (width * 192 / 220));
      destination = wheelTarget;
      navigating = true;
      // Retarget the native spring; seek() would teleport and zero its velocity.
      picker.scrollTo(wheelTarget);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        destination = bound(Math.round(wheelTarget ?? position));
        wheelTarget = undefined;
        picker?.scrollTo(destination);
      }, 120);
    };
    const onKey = (event: KeyboardEvent) => {
      if (!picker || element.dataset.phase !== "gallery" || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input,textarea,select,[contenteditable=true]")) return;
      const step = ({ ArrowLeft: -1, ArrowRight: 1, PageUp: -5, PageDown: 5 } as Record<string, number>)[event.key];
      if (step === undefined && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (step !== undefined) advance(step, true);
      else go?.(event.key === "Home" ? 0 : panels.length - 1, true);
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
      import("../../public/playbook-assets/loopem/index.js"),
      import("../../public/playbook-assets/loopem/layouts.js"),
    ]).then(([loopem, { coverflow }]) => {
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
        const preset = coverflow({ step: 108 * scale, spread: 84 * scale, depth: 86 * scale, angle: 56, reach: 5, perspective: 900 * scale });
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
            if (photoProposal) {
              const caption = document.createElement("figcaption");
              const place = document.createElement("span");
              place.textContent = `${panel.dataset.year} · ${panel.dataset.place}`;
              const number = document.createElement("span");
              number.textContent = `${String(panels.indexOf(panel) + 1).padStart(2, "0")} / ${panels.length}`;
              caption.append(place, number);
              figure.append(caption);
            }
            return figure;
          },
        });
        picker.on("move", ({ offset }) => select(offset), { immediate: true });
        picker.on("settle", () => {
          showCaption(bound(Math.round(position)), !instantNavigation);
          navigating = false;
          if (wheelTarget === undefined) destination = position;
          if (element.dataset.phase === "gallery" && location.hash !== `#${panels[active].id}`) {
            history.replaceState(null, "", `#${panels[active].id}`);
          }
        });
        go = (index, animate) => {
          interrupt();
          destination = bound(index);
          navigating = animate;
          instantNavigation = !animate;
          picker!.scrollTo(destination, { animate });
          instantNavigation = false;
        };
        showCaption(active);
        captions = createCaptionMotion(element.querySelector<HTMLElement>(".museum-world")!, panels, position);
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
          captions?.measure();
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
