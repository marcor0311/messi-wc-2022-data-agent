import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { createPicker } from "../../public/playbook-assets/loopem/index.js";
import { coverflow } from "../../public/playbook-assets/loopem/layouts.js";
import { createCaptionMotion } from "./museum-caption-motion";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

/** Scroll position is the sole source of truth. No vertical wheel interception. */
export function createMuseumController(root: HTMLElement, initialChapter?: string) {
  const story = root.querySelector<HTMLElement>(".horizontal-story")!;
  const host = root.querySelector<HTMLElement>(".museum-coverflow")!;
  const world = root.querySelector<HTMLElement>(".museum-world")!;
  const panels = [...root.querySelectorAll<HTMLElement>("[data-gallery-panel]")];
  const proposal = !!root.closest(".museum-photo-proposal");
  const last = panels.length - 1;
  const step = Math.round(Math.min(innerWidth * .46, innerWidth >= 1700 ? 850 : 740) * 192 / 220);
  const clamp = (index: number) => Math.max(0, Math.min(last, index));
  let active = -1;
  let position = -1;
  let instant = false;
  let navigation: gsap.core.Tween | undefined;
  let textMotion: gsap.core.Timeline | undefined;
  let finishText = () => {};
  const visual = { offset: 0 };
  let drawn = -1;
  let captions: ReturnType<typeof createCaptionMotion> | undefined;
  let trigger!: ScrollTrigger;

  story.classList.add("is-coverflow");
  panels.forEach(panel => { panel.inert = true; panel.setAttribute("aria-hidden", "true"); });
  const scale = host.clientWidth * .62 / 220;
  const preset = coverflow({ step: 108 * scale, spread: 84 * scale, depth: 86 * scale, angle: 56, reach: 5, perspective: 900 * scale });
  const makePicker = createPicker as unknown as (host: HTMLElement, options: Record<string, unknown>) => { seek(offset: number): void; destroy(): void };
  const picker = makePicker(host, {
    ...preset, overscan: 1, interactive: false,
    layout: (distance: number) => ({ ...preset.layout(distance), opacity: 1 }),
    items: panels, loop: "clamp", fade: 0,
    renderItem(panel: HTMLElement) {
      const figure = document.createElement("figure");
      figure.className = "coverflow-photo";
      const original = panel.querySelector<HTMLImageElement>(".scene-image img")!;
      const image = document.createElement("img");
      image.alt = original.alt;
      image.draggable = false;
      image.decoding = "async";
      image.sizes = "62vw";
      image.srcset = original.srcset;
      image.src = original.src;
      image.addEventListener("error", () => {
        const fallback = document.createElement("div");
        fallback.className = "photo-fallback";
        fallback.setAttribute("role", "img");
        fallback.setAttribute("aria-label", original.alt);
        fallback.textContent = "La fotografía no está disponible. La historia continúa.";
        figure.replaceChildren(fallback);
      }, { once: true });
      figure.append(image);
      if (proposal) {
        const label = document.createElement("figcaption");
        const place = document.createElement("span");
        place.textContent = `${panel.dataset.year} · ${panel.dataset.place}`;
        const number = document.createElement("span");
        number.textContent = `${String(panels.indexOf(panel) + 1).padStart(2, "0")} / ${panels.length}`;
        label.append(place, number);
        figure.append(label);
      }
      return figure;
    },
  });
  // Loopem removes widget roles when its input driver is disabled. This gallery
  // exposes native scroll plus keyboard controls rather than listbox selection.
  host.setAttribute("role", "group");
  const remember = gsap.delayedCall(.2, () => {
    if (trigger && trigger.scroll() >= trigger.start) history.replaceState(null, "", `#${panels[active].id}`);
  }).pause();
  const showCaption = (next: number, animate: boolean) => {
    if (next === active) return;
    textMotion?.kill();
    finishText();
    const previous = panels[active];
    if (previous) {
      delete previous.dataset.active;
      previous.inert = true;
      previous.setAttribute("aria-hidden", "true");
    }
    active = next;
    const panel = panels[next];
    panel.dataset.active = "true";
    panel.inert = false;
    panel.setAttribute("aria-hidden", "false");
    root.dataset.currentChapter = root.dataset.phase === "hero" ? "portada" : panel.id;
    captions?.set(next, animate);
    if (animate && previous) {
      previous.dataset.exiting = "true";
      const oldHeading = previous.querySelector<HTMLElement>(".scene-heading")!;
      const newHeading = panel.querySelector<HTMLElement>(".scene-heading")!;
      const metadata = ".score-location,.score-team,.score-context,.award-board";
      const outgoing = [...previous.querySelectorAll<HTMLElement>(metadata)];
      const incoming = [...panel.querySelectorAll<HTMLElement>(metadata)];
      finishText = () => {
        delete previous.dataset.exiting;
        gsap.set([oldHeading, newHeading, ...outgoing, ...incoming], { clearProps: "opacity" });
      };
      textMotion = gsap.timeline({ onComplete: finishText })
        .to(oldHeading, { opacity: 0, duration: .12, ease: "none" }, 0)
        .fromTo(newHeading, { opacity: 0 }, { opacity: 1, duration: .18, ease: "power3.out" }, .12)
        .to(outgoing, { opacity: 0, duration: .18, ease: "none" }, 0)
        .fromTo(incoming, { opacity: 0 }, { opacity: 1, duration: .18, ease: "none" }, 0);
    }
    remember.restart(true);
  };
  const commitAtRest = () => {
    if (!trigger || navigation?.isActive()) return;
    const index = clamp(Math.round(visual.offset));
    if (Math.abs(visual.offset - index) < .002 && Math.abs(position - index) < .002) showCaption(index, true);
  };
  const draw = () => {
    if (Math.abs(visual.offset - drawn) < .00001) return;
    drawn = visual.offset;
    picker.seek(drawn);
  };
  // One GSAP ticker follows the native position. New input retargets the live
  // presentation value; no React renders, layout reads or wheel locks per frame.
  const follow = gsap.quickTo(visual, "offset", {
    duration: .28, ease: "power3.out", onUpdate: draw, onComplete: commitAtRest,
  });
  const render = (self: ScrollTrigger) => {
    const next = self.progress * last;
    if (Math.abs(next - position) > .00001) {
      position = next;
      if (instant) {
        follow.tween.pause();
        visual.offset = next;
        draw();
        showCaption(clamp(Math.round(next)), false);
      } else follow(next);
    }
    const phase = self.scroll() < self.start ? "hero" : self.scroll() > self.end ? "return" : "gallery";
    if (root.dataset.phase !== phase) root.dataset.phase = phase;
    const chapter = phase === "hero" ? "portada" : panels[active]?.id;
    if (chapter && root.dataset.currentChapter !== chapter) root.dataset.currentChapter = chapter;
  };
  const context = gsap.context(() => {
    trigger = ScrollTrigger.create({
      id: "museum-story", trigger: story, start: "top top", pin: true,
      end: () => `+=${step * last}`, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: render,
    });
  }, root);
  showCaption(0, false);
  captions = createCaptionMotion(world, panels, 0);
  root.dataset.enhanced = "true";
  root.dataset.scrollDriver = "gsap";
  const cancelNavigation = () => { navigation?.kill(); navigation = undefined; };
  const go = (index: number, animate = false) => {
    cancelNavigation();
    const y = trigger.start + clamp(index) * step;
    if (animate) navigation = gsap.to(window, { scrollTo: { y, autoKill: true }, duration: .4, ease: "power3.out", overwrite: "auto" });
    else {
      instant = true;
      window.scrollTo({ top: y, behavior: "instant" });
      ScrollTrigger.update();
      follow.tween.pause();
      visual.offset = clamp(index);
      draw();
      showCaption(clamp(index), false);
      render(trigger);
      instant = false;
    }
  };
  const snapAtRest = () => {
    if (navigation?.isActive() || drag) return;
    const y = trigger.scroll();
    if (y < trigger.start || y > trigger.end) return;
    const target = trigger.start + clamp(Math.round((y - trigger.start) / step)) * step;
    if (Math.abs(target - y) <= 1) { commitAtRest(); return; }
    // Wait for GSAP's native scrollEnd signal, including trackpad inertia. The
    // centering tween is killed by fresh wheel input and never gates either exit.
    navigation = gsap.to(window, {
      scrollTo: { y: target, autoKill: true }, duration: .28, ease: "power3.out",
      onComplete: () => { navigation = undefined; commitAtRest(); },
    });
  };
  const restoreHash = () => {
    let id: string;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const index = panels.findIndex(panel => panel.id === id);
    if (index >= 0) go(index);
    else if (id === "portada") { cancelNavigation(); document.getElementById(id)?.scrollIntoView({ behavior: "instant" }); }
  };
  const onClick = (event: MouseEvent) => {
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a") : null;
    if (!anchor || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
    let id: string;
    try { id = decodeURIComponent(url.hash.slice(1)); } catch { return; }
    const index = panels.findIndex(panel => panel.id === id);
    if (index < 0 && id !== "portada") return;
    event.preventDefault();
    history.pushState(null, "", url.hash);
    if (index >= 0) go(index, event.detail !== 0);
    else restoreHash();
    if (event.detail === 0 && index >= 0) panels[index].querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  };
  const onKey = (event: KeyboardEvent) => {
    if (trigger.scroll() < trigger.start - 1 || trigger.scroll() > trigger.end + 1 || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.target instanceof Element && event.target.closest("a,button,input,textarea,select,[contenteditable=true]")) return;
    const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!direction && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? last : clamp(Math.round(position) + direction);
    history.pushState(null, "", `#${panels[next].id}`);
    go(next);
  };
  let drag: { id: number; x: number; scroll: number; moved: boolean; key: number } | undefined;
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    cancelNavigation();
    const slot = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-loopem-key]") : null;
    drag = { id: event.pointerId, x: event.clientX, scroll: window.scrollY, moved: false, key: Number(slot?.dataset.loopemKey) };
    host.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    const distance = drag.x - event.clientX;
    if (Math.abs(distance) > 10) drag.moved = true;
    if (drag.moved) window.scrollTo({ top: Math.max(trigger.start, Math.min(trigger.end, drag.scroll + distance)), behavior: "instant" });
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (event.type !== "pointercancel" && !drag.moved && Number.isFinite(drag.key)) go(drag.key, true);
    drag = undefined;
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
  };
  const onHorizontalWheel = (event: WheelEvent) => {
    if (event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    cancelNavigation();
    window.scrollBy({ top: event.deltaX * (event.deltaMode === 1 ? 16 : 1), behavior: "instant" });
  };
  const onNativeScroll = () => {
    // ScrollTrigger progress is clamped at 0/1, so onUpdate no longer fires
    // while the native page travels beyond the pin. Track only those regions,
    // using cached boundaries and scrollY rather than measuring the document.
    if (trigger.progress !== 0 && trigger.progress !== 1) return;
    const phase = window.scrollY < trigger.start ? "hero" : window.scrollY > trigger.end ? "return" : "gallery";
    if (root.dataset.phase !== phase) root.dataset.phase = phase;
    if (phase === "hero") root.dataset.currentChapter = "portada";
  };
  root.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  window.addEventListener("wheel", cancelNavigation, { passive: true });
  window.addEventListener("scroll", onNativeScroll, { passive: true });
  window.addEventListener("hashchange", restoreHash);
  window.addEventListener("popstate", restoreHash);
  ScrollTrigger.addEventListener("scrollEnd", snapAtRest);
  host.addEventListener("wheel", onHorizontalWheel, { passive: false });
  host.addEventListener("pointerdown", onPointerDown);
  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerup", onPointerUp);
  host.addEventListener("pointercancel", onPointerUp);
  ScrollTrigger.refresh();
  const restored = panels.findIndex(panel => panel.id === initialChapter);
  if (restored >= 0) go(restored);
  else if (initialChapter === "portada") window.scrollTo({ top: 0, behavior: "instant" });
  else if (initialChapter === "museum-return") {
    go(last);
    document.getElementById(initialChapter)?.scrollIntoView({ block: "end", behavior: "instant" });
  }
  else restoreHash();
  render(trigger);
  return { destroy() {
    cancelNavigation();
    remember.kill();
    textMotion?.kill();
    finishText();
    follow.tween.kill();
    context.revert();
    captions?.destroy();
    picker.destroy();
    story.classList.remove("is-coverflow");
    delete root.dataset.enhanced;
    delete root.dataset.scrollDriver;
    panels.forEach(panel => {
      panel.inert = false;
      panel.removeAttribute("aria-hidden");
      delete panel.dataset.active;
      gsap.set(panel.querySelectorAll(".scene-heading,.match-score,.chapter-award"), { clearProps: "opacity" });
    });
    root.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("wheel", cancelNavigation);
    window.removeEventListener("scroll", onNativeScroll);
    window.removeEventListener("hashchange", restoreHash);
    window.removeEventListener("popstate", restoreHash);
    ScrollTrigger.removeEventListener("scrollEnd", snapAtRest);
    host.removeEventListener("wheel", onHorizontalWheel);
    host.removeEventListener("pointerdown", onPointerDown);
    host.removeEventListener("pointermove", onPointerMove);
    host.removeEventListener("pointerup", onPointerUp);
    host.removeEventListener("pointercancel", onPointerUp);
  } };
}
