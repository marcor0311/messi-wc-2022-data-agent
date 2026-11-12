type Digit = { value: string; source: HTMLElement | null };
type Field = { window: HTMLElement; values: Digit[]; digit?: number; cells: HTMLElement[]; changed: boolean };

/** Only numeric ink is enhanced; the original chapter remains the accessible source. */
export function createCaptionMotion(world: HTMLElement, panels: HTMLElement[], initialIndex: number) {
  const layer = document.createElement("div");
  layer.className = "museum-caption-motion";
  layer.setAttribute("aria-hidden", "true");
  layer.inert = true;
  let fields: Field[] = [];
  let current = initialIndex;
  let target = initialIndex;
  let pending: number | undefined;
  let frame = 0;
  let last = 0;
  let progress = 1;
  let velocity = 0;
  const typeProperties = ["font-family", "font-size", "font-weight", "font-style", "font-variant-numeric", "line-height", "letter-spacing", "color", "text-box-trim", "text-box-edge"];

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
    const style = getComputedStyle(entry.source);
    for (const property of typeProperties) node.style.setProperty(property, style.getPropertyValue(property));
    const size = parseFloat(style.fontSize);
    Object.assign(node.style, {
      position: "absolute", inset: "auto", left: `${size * .08}px`, top: `${size * .10}px`,
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
      field.cells[0].style.transform = `translate3d(0,${field.changed ? -progress * direction * 100 : 0}%,0)`;
      if (field.changed) field.cells[1].style.transform = `translate3d(0,${(1 - progress) * direction * 100}%,0)`;
    }
  };
  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, .064);
    last = now;
    const displacement = progress - 1, slope = velocity + 18 * displacement, decay = Math.exp(-18 * dt);
    progress = 1 + (displacement + slope * dt) * decay;
    velocity = (slope - 18 * (displacement + slope * dt)) * decay;
    if (Math.abs(progress - 1) < .0005 && Math.abs(velocity) < .005) {
      current = target;
      frame = 0;
      progress = 1;
      render(current, current);
      draw();
      if (pending !== undefined) { const next = pending; pending = undefined; set(next, true); }
      return;
    }
    draw();
    frame = requestAnimationFrame(tick);
  };
  const set = (index: number, animate: boolean) => {
    if (index === target && pending === undefined) return;
    if (frame && animate) { pending = index; return; }
    cancelAnimationFrame(frame);
    frame = 0;
    pending = undefined;
    if (!animate) current = index;
    target = index;
    progress = animate ? 0 : 1;
    velocity = 0;
    render(current, target);
    draw();
    if (animate) { last = performance.now(); frame = requestAnimationFrame(tick); }
  };
  const measure = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    pending = undefined;
    current = target;
    layer.replaceChildren();
    fields = [];
    const origin = world.getBoundingClientRect();
    const add = (name: string, values: Digit[], digit?: number) => {
      const source = values.find(entry => entry.source)!.source!;
      const rect = source.getBoundingClientRect();
      const size = parseFloat(getComputedStyle(source).fontSize);
      let x = rect.x, width = rect.width;
      if (digit !== undefined) {
        // Measure each advance; equal quarters cut glyphs with negative tracking.
        const label = source.querySelector(".scene-year-label")!;
        const range = document.createRange();
        range.setStart(label.firstChild!, digit);
        range.setEnd(label.firstChild!, digit + 1);
        const character = range.getBoundingClientRect();
        x = character.x;
        width = character.width;
      }
      const window = document.createElement("div");
      window.className = "caption-window";
      window.dataset.captionField = name;
      Object.assign(window.style, {
        left: `${x - origin.x - size * .08}px`, top: `${rect.y - origin.y - size * .10}px`,
        width: `${width + size * .16}px`, height: `${rect.height + size * .20}px`,
      });
      layer.append(window);
      fields.push({ window, values, digit, cells: [], changed: false });
    };
    for (let digit = 0; digit < 4; digit++) add(`year-${digit}`, panels.map(panel => {
      const source = panel.querySelector<HTMLElement>(".scene-year")!;
      return { source, value: source.textContent!.trim()[digit] };
    }), digit);
    for (let digit = 0; digit < 2; digit++) add(`score-${digit}`, panels.map(panel => {
      const source = panel.querySelectorAll<HTMLElement>(".score-result strong")[digit] ?? null;
      return { source, value: source?.textContent ?? "" };
    }));
    render(current, current);
    draw();
  };

  measure();
  world.append(layer);
  world.dataset.numberMotion = "true";
  return { set, measure, destroy: () => {
    cancelAnimationFrame(frame);
    delete world.dataset.numberMotion;
    layer.remove();
  } };
}
