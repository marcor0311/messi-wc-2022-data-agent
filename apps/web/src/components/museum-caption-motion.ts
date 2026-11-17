import { gsap } from "gsap";

type Digit = { value: string; source: HTMLElement | null };
type Field = { window: HTMLElement; values: Digit[]; digit?: number; cells: HTMLElement[]; changed: boolean };
type Typography = { size: number; properties: [string, string][] };

/** Cached numeric ink; measurement happens on setup/resize, never on scroll. */
export function createCaptionMotion(world: HTMLElement, panels: HTMLElement[], initialIndex: number) {
  const layer = document.createElement("div");
  layer.className = "museum-caption-motion";
  layer.setAttribute("aria-hidden", "true");
  layer.inert = true;
  const styles = new Map<HTMLElement, Typography>();
  const typeProperties = ["font-family", "font-size", "font-weight", "font-style", "font-variant-numeric", "line-height", "letter-spacing", "color", "text-box-trim", "text-box-edge"];
  let fields: Field[] = [];
  let current = initialIndex;
  let target = initialIndex;
  let motion: gsap.core.Tween | undefined;
  const state = { progress: 1 };
  const glyph = (entry: Digit, digit?: number) => {
    const cell = document.createElement("div");
    cell.className = "caption-cell";
    cell.dataset.value = entry.value;
    if (!entry.source) return cell;
    const node = entry.source.cloneNode(true) as HTMLElement;
    for (const child of [node, ...node.querySelectorAll<HTMLElement>("*")]) {
      child.removeAttribute("id");
      child.removeAttribute("tabindex");
    }
    if (digit !== undefined) node.querySelector(".scene-year-label")!.textContent = entry.value;
    const style = styles.get(entry.source)!;
    for (const [property, value] of style.properties) node.style.setProperty(property, value);
    Object.assign(node.style, {
      position: "absolute", inset: "auto", left: `${style.size * .08}px`, top: `${style.size * .10}px`,
      display: "block", margin: "0", width: "max-content", height: "auto",
    });
    cell.append(node);
    return cell;
  };
  const render = (from: number, to: number) => {
    for (const field of fields) {
      const before = field.values[from], after = field.values[to];
      field.changed = before.value !== after.value;
      field.cells = [glyph(before, field.digit)];
      if (field.changed) field.cells.push(glyph(after, field.digit));
      field.window.replaceChildren(...field.cells);
    }
  };
  const draw = () => {
    const direction = target >= current ? 1 : -1;
    for (const field of fields) {
      field.cells[0].style.transform = `translate3d(0,${field.changed ? -state.progress * direction * 100 : 0}%,0)`;
      if (field.changed) field.cells[1].style.transform = `translate3d(0,${(1 - state.progress) * direction * 100}%,0)`;
    }
  };
  const set = (index: number, animate: boolean) => {
    if (index === target) return;
    motion?.kill();
    current = animate ? target : index;
    target = index;
    state.progress = animate ? 0 : 1;
    render(current, target);
    draw();
    if (animate) motion = gsap.to(state, {
      progress: 1, duration: .35, ease: "power3.out", onUpdate: draw,
      onComplete: () => { current = target; render(current, current); draw(); },
    });
  };
  const measure = () => {
    motion?.kill();
    current = target;
    state.progress = 1;
    // All typography and geometry reads precede changes to the visual layer.
    styles.clear();
    for (const panel of panels) {
      for (const source of panel.querySelectorAll<HTMLElement>(".scene-year,.score-result strong")) {
        const style = getComputedStyle(source);
        styles.set(source, { size: parseFloat(style.fontSize), properties: typeProperties.map(property => [property, style.getPropertyValue(property)]) });
      }
    }
    const origin = world.getBoundingClientRect();
    const specs: { name: string; values: Digit[]; digit?: number; left: number; top: number; width: number; height: number }[] = [];
    const read = (name: string, values: Digit[], digit?: number) => {
      const source = values.find(entry => entry.source)!.source!;
      const rect = source.getBoundingClientRect();
      const size = styles.get(source)!.size;
      let x = rect.x, width = rect.width;
      if (digit !== undefined) {
        const label = source.querySelector(".scene-year-label")!;
        const range = document.createRange();
        range.setStart(label.firstChild!, digit);
        range.setEnd(label.firstChild!, digit + 1);
        const character = range.getBoundingClientRect();
        x = character.x;
        width = character.width;
      }
      specs.push({ name, values, digit, left: x - origin.x - size * .08,
        top: rect.y - origin.y - size * .10, width: width + size * .16, height: rect.height + size * .20 });
    };
    for (let digit = 0; digit < 4; digit++) read(`year-${digit}`, panels.map(panel => {
      const source = panel.querySelector<HTMLElement>(".scene-year")!;
      return { source, value: source.textContent!.trim()[digit] };
    }), digit);
    for (let digit = 0; digit < 2; digit++) read(`score-${digit}`, panels.map(panel => {
      const source = panel.querySelectorAll<HTMLElement>(".score-result strong")[digit] ?? null;
      return { source, value: source?.textContent ?? "" };
    }));
    layer.replaceChildren();
    fields = specs.map(spec => {
      const window = document.createElement("div");
      window.className = "caption-window";
      window.dataset.captionField = spec.name;
      Object.assign(window.style, { left: `${spec.left}px`, top: `${spec.top}px`, width: `${spec.width}px`, height: `${spec.height}px` });
      layer.append(window);
      return { window, values: spec.values, digit: spec.digit, cells: [], changed: false };
    });
    render(current, current);
    draw();
  };
  measure();
  world.append(layer);
  world.dataset.numberMotion = "true";
  return { set, measure, destroy: () => { motion?.kill(); delete world.dataset.numberMotion; layer.remove(); styles.clear(); } };
}
