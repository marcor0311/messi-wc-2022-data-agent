import { a as LAYOUT, i as BEND, n as wrapIndex, o as LOOP_MODE, r as AXIS, s as SELECT_MODE, t as clamp } from "./math-CUR6Lwfw.js";
//#region src/core/gesture.ts
const VELOCITY_WINDOW_MS = 80;
const RUBBER_LIMIT = 1.4;
const createVelocityTracker = () => {
	let samples = [];
	return {
		sample: (position, time) => {
			samples.push({
				position,
				time
			});
			samples = samples.filter((s) => time - s.time <= VELOCITY_WINDOW_MS);
		},
		velocity: (position, time) => {
			if (samples.length === 0) return 0;
			const reference = samples.find((s) => time - s.time <= VELOCITY_WINDOW_MS) ?? samples[samples.length - 1];
			const elapsed = time - reference.time;
			if (elapsed <= 0) return 0;
			return (position - reference.position) / elapsed * 1e3;
		},
		reset: () => {
			samples = [];
		}
	};
};
const rubberBand = (overshoot, limit = RUBBER_LIMIT) => overshoot * limit / (limit + Math.abs(overshoot));
const constrainOffset = ({ offset, count, loop }) => {
	if (loop === LOOP_MODE.WRAP || count === 0) return offset;
	const last = count - 1;
	if (offset < 0) return rubberBand(offset);
	if (offset > last) return last + rubberBand(offset - last);
	return offset;
};
const DEFAULT_RADIUS = 360;
const DEFAULT_FALLOFF = 1;
const createLineLayout = ({ spacing = 72, axis = AXIS.HORIZONTAL, minScale = 1, minOpacity = 1, falloff = DEFAULT_FALLOFF } = {}) => {
	return (d) => ({
		...onAxis(d * spacing, 0, axis),
		rotate: 0,
		scale: rampTo(minScale, d, falloff),
		opacity: rampTo(minOpacity, d, falloff),
		z: -Math.abs(d)
	});
};
const createArcLayout = ({ spacing = 72, radius = DEFAULT_RADIUS, axis = AXIS.HORIZONTAL, bend, tilt = false, minScale = 1, minOpacity = 1, falloff = DEFAULT_FALLOFF } = {}) => {
	if (radius === 0) throw new Error("createArcLayout: radius must not be 0. Use createLineLayout for a straight track, or a large radius for a gentle curve.");
	const reach = Math.abs(radius);
	const anglePerItem = spacing / reach;
	const side = bendSign(bend, axis);
	return (d) => {
		const angle = d * anglePerItem;
		return {
			...onAxis(reach * Math.sin(angle), side * reach * (1 - Math.cos(angle)), axis),
			rotate: tilt ? side * angle * 180 / Math.PI : 0,
			scale: rampTo(minScale, d, falloff),
			opacity: rampTo(minOpacity, d, falloff),
			z: -Math.abs(d)
		};
	};
};
const onAxis = (along, across, axis) => axis === AXIS.HORIZONTAL ? {
	x: along,
	y: across
} : {
	x: across,
	y: along
};
const FLIPPED = {
	[AXIS.HORIZONTAL]: BEND.UP,
	[AXIS.VERTICAL]: BEND.LEFT
};
const bendSign = (bend, axis) => bend === FLIPPED[axis] ? -1 : 1;
const rampTo = (target, d, falloff) => {
	if (target === 1 || falloff <= 0) return 1;
	return 1 + (target - 1) * Math.min(Math.abs(d) / falloff, 1);
};
//#endregion
//#region src/core/physics.ts
const SETTLE_OFFSET = .002;
const SETTLE_VELOCITY = .02;
const MIN_FRICTION = 1e-6;
const MAX_FRICTION = .999;
const stepSpring = ({ motion, target, stiffness, dt }) => {
	const displacement = motion.offset - target;
	const slope = motion.velocity + stiffness * displacement;
	const decay = Math.exp(-stiffness * dt);
	const carried = displacement + slope * dt;
	return {
		offset: target + carried * decay,
		velocity: (slope - stiffness * carried) * decay
	};
};
const isSettled = (motion, target) => Math.abs(motion.offset - target) < SETTLE_OFFSET && Math.abs(motion.velocity) < SETTLE_VELOCITY;
const stiffnessFor = (friction) => -Math.log(clamp(friction, MIN_FRICTION, MAX_FRICTION));
//#endregion
//#region src/core/track.ts
const visibleSlots = ({ offset, count, radius, loop }) => {
	if (count <= 0 || radius < 0) return [];
	const slots = [];
	const first = Math.ceil(offset - radius);
	const last = Math.floor(offset + radius);
	for (let key = first; key <= last; key++) {
		if (loop === LOOP_MODE.CLAMP && (key < 0 || key >= count)) continue;
		slots.push({
			key,
			index: wrapIndex(key, count),
			d: key - offset
		});
	}
	return slots;
};
const activeIndexAt = (offset, count) => wrapIndex(Math.round(offset), count);
const projectRest = ({ offset, velocity, friction }) => {
	if (velocity === 0 || friction <= 0 || friction >= 1) return offset;
	return offset + velocity / -Math.log(friction);
};
const snapTarget = ({ offset, velocity, friction, count, loop }) => {
	const target = Math.round(projectRest({
		offset,
		velocity,
		friction
	}));
	return loop === LOOP_MODE.CLAMP ? clamp(target, 0, count - 1) : target;
};
//#endregion
//#region src/dom/autoplay.ts
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const createAutoplay = ({ interval, onAdvance }) => {
	let timer = null;
	const pause = () => {
		if (timer === null) return;
		clearTimeout(timer);
		timer = null;
	};
	return {
		play: () => {
			pause();
			timer = setTimeout(() => {
				timer = null;
				onAdvance();
			}, interval);
		},
		pause
	};
};
const prefersReducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
//#endregion
//#region src/dom/input.ts
const DRAG_THRESHOLD = 4;
const WHEEL_IDLE_MS = 120;
const LINE_HEIGHT = 16;
const PAGE_HEIGHT = 400;
const PAGE_STEP = 5;
const SLOT_SELECTOR = ".loopem-slot";
const createInput = ({ container, axis, step, onDragStart, onDragMove, onDragEnd, onWheel, onWheelEnd, onNudge, onJump, onPick, onCommit }) => {
	const velocity = createVelocityTracker();
	let pointerId = null;
	let origin = 0;
	let originAcross = 0;
	let dragging = false;
	let lastPosition = 0;
	let lastTime = 0;
	let pressedKey = NaN;
	let wheelTimer = null;
	const along = (event) => axis === AXIS.HORIZONTAL ? event.clientX : event.clientY;
	const across = (event) => axis === AXIS.HORIZONTAL ? event.clientY : event.clientX;
	const onPointerDown = (event) => {
		if (pointerId !== null || !event.isPrimary) return;
		pointerId = event.pointerId;
		origin = along(event);
		originAcross = across(event);
		lastPosition = origin;
		lastTime = event.timeStamp;
		dragging = false;
		pressedKey = slotKeyUnder(event.target);
		velocity.reset();
		velocity.sample(origin, event.timeStamp);
		container.setPointerCapture(event.pointerId);
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		window.addEventListener("blur", onAbort);
	};
	const stopWatching = (id) => {
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("pointercancel", onPointerCancel);
		window.removeEventListener("blur", onAbort);
		pointerId = null;
		if (container.hasPointerCapture(id)) container.releasePointerCapture(id);
	};
	const onAbort = () => {
		if (pointerId === null) return;
		const wasDragging = dragging;
		stopWatching(pointerId);
		dragging = false;
		if (wasDragging) onDragEnd(-velocity.velocity(lastPosition, lastTime) / step());
	};
	const onPointerMove = (event) => {
		if (event.pointerId !== pointerId) return;
		const traveled = along(event) - origin;
		lastPosition = along(event);
		lastTime = event.timeStamp;
		velocity.sample(lastPosition, event.timeStamp);
		if (!dragging) {
			const sideways = across(event) - originAcross;
			if (Math.max(Math.abs(traveled), Math.abs(sideways)) < DRAG_THRESHOLD) return;
			if (event.pointerType !== "mouse" && Math.abs(sideways) > Math.abs(traveled)) {
				stopWatching(pointerId);
				return;
			}
			dragging = true;
			onDragStart();
		}
		onDragMove(-traveled / step());
	};
	const onPointerUp = (event) => {
		if (event.pointerId !== pointerId) return;
		const wasDragging = dragging;
		stopWatching(event.pointerId);
		dragging = false;
		if (!wasDragging) {
			if (Number.isFinite(pressedKey)) onPick(pressedKey);
			return;
		}
		onDragEnd(-velocity.velocity(along(event), event.timeStamp) / step());
	};
	const onPointerCancel = (event) => {
		if (event.pointerId !== pointerId) return;
		const wasDragging = dragging;
		stopWatching(event.pointerId);
		dragging = false;
		if (wasDragging) onDragEnd(0);
	};
	const onWheelEvent = (event) => {
		const raw = axis === AXIS.HORIZONTAL ? event.deltaX : event.deltaY;
		if (raw === 0) return;
		event.preventDefault();
		onWheel(raw * wheelScale(event.deltaMode) / step());
		if (wheelTimer) clearTimeout(wheelTimer);
		wheelTimer = setTimeout(() => {
			wheelTimer = null;
			onWheelEnd();
		}, WHEEL_IDLE_MS);
	};
	const BACK = axis === AXIS.HORIZONTAL ? "ArrowLeft" : "ArrowUp";
	const FORWARD = axis === AXIS.HORIZONTAL ? "ArrowRight" : "ArrowDown";
	const onKeyDown = (event) => {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		switch (event.key) {
			case BACK:
				onNudge(-1);
				break;
			case FORWARD:
				onNudge(1);
				break;
			case "PageUp":
				onNudge(-5);
				break;
			case "PageDown":
				onNudge(PAGE_STEP);
				break;
			case "Home":
				onJump("first");
				break;
			case "End":
				onJump("last");
				break;
			case "Enter":
			case " ":
				onCommit();
				break;
			default: return;
		}
		event.preventDefault();
	};
	const onDragStartEvent = (event) => event.preventDefault();
	container.addEventListener("pointerdown", onPointerDown);
	container.addEventListener("lostpointercapture", onAbort);
	container.addEventListener("dragstart", onDragStartEvent);
	container.addEventListener("wheel", onWheelEvent, { passive: false });
	container.addEventListener("keydown", onKeyDown);
	return { destroy: () => {
		if (wheelTimer) clearTimeout(wheelTimer);
		if (pointerId !== null) stopWatching(pointerId);
		container.removeEventListener("pointerdown", onPointerDown);
		container.removeEventListener("lostpointercapture", onAbort);
		container.removeEventListener("dragstart", onDragStartEvent);
		container.removeEventListener("wheel", onWheelEvent);
		container.removeEventListener("keydown", onKeyDown);
	} };
};
const slotKeyUnder = (target) => {
	if (!(target instanceof Element)) return NaN;
	const slot = target.closest(SLOT_SELECTOR);
	return slot instanceof HTMLElement ? Number(slot.dataset.loopemKey) : NaN;
};
const wheelScale = (deltaMode) => {
	if (deltaMode === WheelEvent.DOM_DELTA_LINE) return LINE_HEIGHT;
	if (deltaMode === WheelEvent.DOM_DELTA_PAGE) return PAGE_HEIGHT;
	return 1;
};
//#endregion
//#region src/dom/renderer.ts
const SLOT_CLASS = "loopem-slot";
const POSITION_STEPS = 100;
const UNIT_STEPS = 1e3;
const Z_BASE = 1e3;
const createRenderer = ({ track, renderSlot, activeId, onMountedChange }) => {
	const live = /* @__PURE__ */ new Map();
	const idle = [];
	let interactive = true;
	const pooled = Boolean(renderSlot);
	const acquire = () => {
		const recycled = pooled ? idle.pop() : void 0;
		if (recycled) return recycled;
		const element = document.createElement("div");
		element.className = SLOT_CLASS;
		return {
			element,
			index: -1,
			transform: "",
			opacity: "",
			zIndex: "",
			centered: false,
			selected: false
		};
	};
	const release = (view) => {
		markCentered(view, false);
		markSelected(view, false);
		view.element.remove();
		if (!pooled) return;
		view.element.replaceChildren();
		idle.push(view);
	};
	const bind = (view, slot) => {
		view.index = slot.index;
		view.element.dataset.loopemKey = String(slot.key);
		if (interactive) {
			view.element.setAttribute("role", "option");
			view.element.setAttribute("aria-selected", String(view.selected));
		}
		if (renderSlot) view.element.replaceChildren(renderSlot(slot.index));
		track.appendChild(view.element);
	};
	const markCentered = (view, centered) => {
		if (centered === view.centered) return;
		view.centered = centered;
		if (centered) {
			view.element.id = activeId;
			view.element.dataset.loopemCentered = "";
		} else {
			view.element.removeAttribute("id");
			delete view.element.dataset.loopemCentered;
		}
	};
	const markSelected = (view, selected) => {
		if (selected === view.selected) return;
		view.selected = selected;
		if (interactive) view.element.setAttribute("aria-selected", String(selected));
	};
	const place = (view, slot, layout) => {
		const placement = layout(slot.d);
		const transform = toTransform(placement);
		if (transform !== view.transform) {
			view.element.style.transform = transform;
			view.transform = transform;
		}
		const opacity = String(round(placement.opacity, UNIT_STEPS));
		if (opacity !== view.opacity) {
			view.element.style.setProperty("--loopem-fade", opacity);
			view.opacity = opacity;
		}
		const zIndex = String(Math.max(0, Math.round(Z_BASE + placement.z)));
		if (zIndex !== view.zIndex) {
			view.element.style.zIndex = zIndex;
			view.zIndex = zIndex;
		}
	};
	return {
		setInteractive: (next) => {
			if (next === interactive) return;
			interactive = next;
			for (const view of live.values()) {
				if (next) {
					view.element.setAttribute("role", "option");
					view.element.setAttribute("aria-selected", String(view.selected));
					continue;
				}
				view.element.removeAttribute("role");
				view.element.removeAttribute("aria-selected");
			}
		},
		update: ({ slots, layout, centeredKey, selectedIndex }) => {
			let changed = false;
			for (const slot of slots) {
				let view = live.get(slot.key);
				if (!view) {
					view = acquire();
					bind(view, slot);
					live.set(slot.key, view);
					changed = true;
				}
				place(view, slot, layout);
				markCentered(view, slot.key === centeredKey);
				markSelected(view, slot.index === selectedIndex);
			}
			if (live.size !== slots.length) {
				const first = slots[0]?.key ?? 0;
				const last = slots[slots.length - 1]?.key ?? -1;
				for (const [key, view] of live) if (key < first || key > last) {
					release(view);
					live.delete(key);
					changed = true;
				}
			}
			if (changed) onMountedChange?.();
		},
		mounted: () => [...live].map(([key, view]) => ({
			key,
			index: view.index,
			element: view.element
		})),
		refresh: () => {
			for (const view of live.values()) release(view);
			live.clear();
		},
		destroy: () => {
			for (const view of live.values()) view.element.remove();
			live.clear();
			idle.length = 0;
		}
	};
};
const toTransform = (placement) => {
	const x = round(placement.x, POSITION_STEPS);
	const y = round(placement.y, POSITION_STEPS);
	const z = round(placement.z, POSITION_STEPS);
	const rotate = round(placement.rotate, UNIT_STEPS);
	return `translate3d(${x}px, ${y}px, ${z}px) rotateX(${round(placement.rotateX ?? 0, UNIT_STEPS)}deg) rotateY(${round(placement.rotateY ?? 0, UNIT_STEPS)}deg) rotate(${rotate}deg) scale(${round(placement.scale, UNIT_STEPS)}) translate(-50%, -50%)`;
};
const round = (value, steps) => Math.round(value * steps) / steps;
//#endregion
//#region src/dom/styles.css?raw
var styles_default = "/* ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– */\n/*  Loopem — structural only. Every color, size, and font is the consumer's. */\n/* ––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– */\n\n/* Zero specificity, so a plain class of your own wins. This sheet is injected\n   when a picker mounts — after yours — and a bare `.loopem` would otherwise\n   beat `.my-rail { position: absolute }` on source order alone. */\n:where(.loopem) {\n  position: relative;\n  overflow: hidden;\n}\n\n/* Claiming the gesture is what dragging costs, so only a track that can be\n   dragged pays it. A driven one leaves the touch to the page it sits in.\n   `touch-action` is set per axis from script: a horizontal track keeps\n   `pan-y` so a thumb can still scroll the page over it. */\n.loopem-interactive {\n  -webkit-user-select: none;\n  user-select: none;\n}\n\n/* A zero-sized origin at the middle of the container. Slots are placed as\n   offsets from it, so the layout's 0 is the center by construction, and the\n   vanishing point of `perspective` lands there too. */\n.loopem-track {\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  width: 0;\n  height: 0;\n}\n\n/* The transform ends in translate(-50%, -50%) to sit the item on its point, so\n   the origin has to be the corner. Leaving it at the default 50% 50% would\n   apply that same half-size shift twice over, turning every rotation about a\n   point half a card away — invisible in 2D, but it skews one side against the\n   other once perspective is involved. */\n.loopem-slot {\n  position: absolute;\n  top: 0;\n  left: 0;\n  /* `--loopem-fade` is written per frame from the layout. Set\n     `--loopem-opacity` in your own CSS to override it for a slot. */\n  opacity: var(--loopem-opacity, var(--loopem-fade, 1));\n  transform-origin: 0 0;\n}\n\n.loopem-moving .loopem-slot {\n  will-change: transform;\n}\n";
//#endregion
//#region src/dom/styles.ts
const MARKER = "data-loopem-styles";
const injectStyles = () => {
	if (typeof document === "undefined") return;
	if (document.querySelector(`[${MARKER}]`)) return;
	const style = document.createElement("style");
	style.setAttribute(MARKER, "");
	style.textContent = styles_default;
	document.head.appendChild(style);
};
//#endregion
//#region src/dom/ticker.ts
const MAX_FRAME_SECONDS = .064;
const createTicker = ({ onFrame }) => {
	let handle = null;
	let previous = 0;
	const frame = (now) => {
		const dt = Math.min((now - previous) / 1e3, MAX_FRAME_SECONDS);
		previous = now;
		handle = onFrame(dt) ? requestAnimationFrame(frame) : null;
	};
	return {
		start: () => {
			if (handle !== null) return;
			previous = performance.now();
			handle = requestAnimationFrame(frame);
		},
		stop: () => {
			if (handle === null) return;
			cancelAnimationFrame(handle);
			handle = null;
		},
		isRunning: () => handle !== null
	};
};
//#endregion
//#region src/dom/picker.ts
const CONTAINER_CLASS = "loopem";
const TRACK_CLASS = "loopem-track";
const MOVING_CLASS = "loopem-moving";
const INTERACTIVE_CLASS = "loopem-interactive";
const DEFAULT_STIFFNESS = 12;
const DEFAULT_FRICTION = .02;
const DEFAULT_OVERSCAN = 2;
const SEEK_IDLE_MS = 120;
const DEFAULT_PERSPECTIVE = 1200;
const HANDOFF_ITEMS = 1;
let instances = 0;
const createPicker = (container, { items: initialItems, renderItem, layout: layoutOption = LAYOUT.LINE, spacing, radius, bend, tilt, axis = AXIS.HORIZONTAL, loop = LOOP_MODE.WRAP, minScale, minOpacity, falloff, overscan = DEFAULT_OVERSCAN, stiffness = DEFAULT_STIFFNESS, friction = DEFAULT_FRICTION, perspective = DEFAULT_PERSPECTIVE, fade = 0, select: selectMode = SELECT_MODE.AUTO, initialIndex = 0, autoplay: autoplayInterval, interactive: initialInteractive = true }) => {
	injectStyles();
	const layout = resolveLayout();
	const activeId = `loopem-active-${++instances}`;
	const coastStiffness = stiffnessFor(friction);
	const listeners = {
		change: /* @__PURE__ */ new Set(),
		settle: /* @__PURE__ */ new Set(),
		select: /* @__PURE__ */ new Set(),
		move: /* @__PURE__ */ new Set(),
		slots: /* @__PURE__ */ new Set()
	};
	const snapshots = {
		change: () => ({
			index: activeIndex,
			item: items[activeIndex]
		}),
		settle: () => ({
			index: activeIndex,
			item: items[activeIndex]
		}),
		select: () => ({
			index: selectedIndex,
			item: items[selectedIndex]
		}),
		move: () => ({ offset: motion.offset }),
		slots: () => ({ slots: renderer.mounted() })
	};
	let items = initialItems;
	let count = items.length;
	let motion = {
		offset: initialIndex,
		velocity: 0
	};
	let target = initialIndex;
	let springStiffness = stiffness;
	let activeIndex = activeIndexAt(initialIndex, count);
	let selectedIndex = activeIndex;
	let visibleRadius = overscan;
	let dragOrigin = 0;
	let coasting = false;
	let seekTimer = null;
	const holds = /* @__PURE__ */ new Set();
	const ownsFocus = !container.hasAttribute("tabindex");
	container.classList.add(CONTAINER_CLASS);
	if (fade > 0) {
		const mask = `linear-gradient(${axis === AXIS.HORIZONTAL ? "90deg" : "180deg"}, transparent, #000 ${fade}px, #000 calc(100% - ${fade}px), transparent)`;
		container.style.maskImage = mask;
		container.style.setProperty("-webkit-mask-image", mask);
	}
	const track = document.createElement("div");
	track.className = TRACK_CLASS;
	track.style.perspective = perspective > 0 ? `${perspective}px` : "none";
	container.appendChild(track);
	const renderer = createRenderer({
		track,
		activeId,
		renderSlot: renderItem ? (slotIndex) => renderItem(items[slotIndex], slotIndex) : void 0,
		onMountedChange: () => emit("slots", { slots: renderer.mounted() })
	});
	const ticker = createTicker({ onFrame: (dt) => {
		if (coasting && Math.abs(motion.offset - target) < HANDOFF_ITEMS) {
			coasting = false;
			springStiffness = stiffness;
		}
		motion = stepSpring({
			motion,
			target,
			stiffness: springStiffness,
			dt
		});
		if (!isSettled(motion, target)) {
			draw();
			return true;
		}
		motion = {
			offset: target,
			velocity: 0
		};
		draw();
		settle();
		return false;
	} });
	const inputParams = {
		container,
		axis,
		step: () => spacing ?? 72,
		onDragStart: () => {
			ticker.stop();
			hold("motion");
			dragOrigin = motion.offset;
			container.classList.add(MOVING_CLASS);
		},
		onDragMove: (delta) => {
			motion = {
				offset: constrain(dragOrigin + delta),
				velocity: 0
			};
			draw();
		},
		onDragEnd: (velocity) => {
			motion = {
				...motion,
				velocity
			};
			coasting = true;
			moveTo(snapTarget({
				offset: motion.offset,
				velocity,
				friction,
				count,
				loop
			}), coastStiffness);
		},
		onWheel: (delta) => {
			ticker.stop();
			container.classList.add(MOVING_CLASS);
			motion = {
				offset: constrain(motion.offset + delta),
				velocity: 0
			};
			draw();
		},
		onWheelEnd: () => moveTo(bounded(Math.round(motion.offset)), stiffness),
		onNudge: nudge,
		onJump: (edge) => moveTo(offsetFor(edge === "first" ? 0 : count - 1), stiffness),
		onPick: (key) => {
			moveTo(bounded(key), stiffness);
			choose(wrapIndex(key, count));
		},
		onCommit: () => choose(activeIndex)
	};
	let input = null;
	function setInteractive(next) {
		container.classList.toggle(INTERACTIVE_CLASS, next);
		renderer.setInteractive(next);
		container.style.touchAction = next ? axis === AXIS.HORIZONTAL ? "pan-y" : "pan-x" : "";
		if (next) {
			input ??= createInput(inputParams);
			container.setAttribute("role", "listbox");
			container.setAttribute("aria-orientation", axis);
			container.setAttribute("aria-activedescendant", activeId);
			if (ownsFocus) container.tabIndex = 0;
			return;
		}
		input?.destroy();
		input = null;
		container.removeAttribute("role");
		container.removeAttribute("aria-orientation");
		container.removeAttribute("aria-activedescendant");
		if (ownsFocus) container.removeAttribute("tabindex");
	}
	setInteractive(initialInteractive);
	const autoplay = autoplayInterval && !prefersReducedMotion() ? createAutoplay({
		interval: autoplayInterval,
		onAdvance: advance
	}) : null;
	const onPointerEnter = () => hold("hover");
	const onPointerLeave = () => release("hover");
	const onVisibility = () => document.hidden ? hold("hidden") : release("hidden");
	if (autoplay) {
		container.addEventListener("pointerenter", onPointerEnter);
		container.addEventListener("pointerleave", onPointerLeave);
		document.addEventListener("visibilitychange", onVisibility);
	}
	const observer = new ResizeObserver(() => {
		measure();
		draw();
	});
	observer.observe(container);
	measure();
	draw();
	autoplay?.play();
	function resolveLayout() {
		if (typeof layoutOption === "function") return layoutOption;
		const shared = {
			spacing,
			axis,
			minScale,
			minOpacity,
			falloff
		};
		return layoutOption === LAYOUT.ARC ? createArcLayout({
			...shared,
			radius,
			bend,
			tilt
		}) : createLineLayout(shared);
	}
	function measure() {
		const extent = axis === AXIS.HORIZONTAL ? container.clientWidth : container.clientHeight;
		const step = spacing ?? 72;
		visibleRadius = Math.ceil(extent / 2 / step) + overscan;
	}
	function draw() {
		renderer.update({
			slots: visibleSlots({
				offset: motion.offset,
				count,
				radius: visibleRadius,
				loop
			}),
			layout,
			centeredKey: Math.round(motion.offset),
			selectedIndex
		});
		syncActive();
		emit("move", { offset: motion.offset });
	}
	function syncActive() {
		if (count === 0) return;
		const next = activeIndexAt(motion.offset, count);
		if (next === activeIndex) return;
		activeIndex = next;
		emit("change", {
			index: next,
			item: items[next]
		});
	}
	function settle() {
		container.classList.remove(MOVING_CLASS);
		release("motion");
		if (count === 0) return;
		emit("settle", {
			index: activeIndex,
			item: items[activeIndex]
		});
		if (selectMode === SELECT_MODE.AUTO) choose(activeIndex);
	}
	function choose(index) {
		if (count === 0 || index === selectedIndex) return;
		selectedIndex = index;
		draw();
		emit("select", {
			index,
			item: items[index]
		});
	}
	function nudge(by) {
		moveTo(bounded(Math.round(target) + by), stiffness);
	}
	function moveTo(nextTarget, nextStiffness) {
		if (count === 0) return;
		hold("motion");
		if (nextStiffness !== coastStiffness) coasting = false;
		target = nextTarget;
		springStiffness = nextStiffness;
		container.classList.add(MOVING_CLASS);
		ticker.start();
	}
	function hold(reason) {
		holds.add(reason);
		autoplay?.pause();
	}
	function release(reason) {
		holds.delete(reason);
		if (holds.size === 0) autoplay?.play();
	}
	function advance() {
		const next = bounded(Math.round(target) + 1);
		if (next === Math.round(target)) return;
		moveTo(next, stiffness);
	}
	function emit(event, payload) {
		for (const listener of listeners[event]) listener(payload);
	}
	const constrain = (offset) => constrainOffset({
		offset,
		count,
		loop
	});
	const bounded = (offset) => loop === LOOP_MODE.CLAMP ? clamp(offset, 0, count - 1) : offset;
	function offsetFor(wanted) {
		if (loop === LOOP_MODE.CLAMP) return clamp(wanted, 0, count - 1);
		return Math.round((motion.offset - wanted) / count) * count + wanted;
	}
	function goTo(wanted, animate) {
		if (animate) {
			moveTo(offsetFor(wanted), stiffness);
			return;
		}
		ticker.stop();
		coasting = false;
		target = offsetFor(wanted);
		motion = {
			offset: target,
			velocity: 0
		};
		draw();
		settle();
	}
	return {
		getActiveIndex: () => activeIndex,
		getActiveItem: () => items[activeIndex],
		getSelectedIndex: () => selectedIndex,
		getSelectedItem: () => items[selectedIndex],
		getSlots: () => renderer.mounted(),
		getCount: () => count,
		select: (index, { animate = true } = {}) => {
			if (count === 0) return;
			const wanted = wrapIndex(index, count);
			goTo(wanted, animate);
			choose(wanted);
		},
		seek: (offset) => {
			ticker.stop();
			coasting = false;
			hold("seek");
			motion = {
				offset: constrain(offset),
				velocity: 0
			};
			target = motion.offset;
			container.classList.add(MOVING_CLASS);
			if (seekTimer) clearTimeout(seekTimer);
			seekTimer = setTimeout(() => {
				seekTimer = null;
				container.classList.remove(MOVING_CLASS);
			}, SEEK_IDLE_MS);
			draw();
		},
		setInteractive,
		next: () => nudge(1),
		previous: () => nudge(-1),
		scrollTo: (wanted, { animate = true } = {}) => {
			if (count === 0) return;
			goTo(wanted, animate);
		},
		update: (nextItems) => {
			items = nextItems;
			count = items.length;
			const wanted = count === 0 ? 0 : clamp(activeIndex, 0, count - 1);
			ticker.stop();
			coasting = false;
			motion = {
				offset: wanted,
				velocity: 0
			};
			target = wanted;
			activeIndex = activeIndexAt(wanted, count);
			selectedIndex = activeIndex;
			renderer.refresh();
			measure();
			draw();
		},
		play: () => {
			holds.clear();
			autoplay?.play();
		},
		pause: () => hold("manual"),
		on: (event, listener, options) => {
			const registered = listeners[event];
			registered.add(listener);
			if (options?.immediate && count > 0) listener(snapshots[event]());
			return () => {
				registered.delete(listener);
			};
		},
		destroy: () => {
			ticker.stop();
			autoplay?.pause();
			if (seekTimer) clearTimeout(seekTimer);
			container.removeEventListener("pointerenter", onPointerEnter);
			container.removeEventListener("pointerleave", onPointerLeave);
			document.removeEventListener("visibilitychange", onVisibility);
			input?.destroy();
			observer.disconnect();
			renderer.destroy();
			listeners.change.clear();
			listeners.settle.clear();
			listeners.move.clear();
			track.remove();
			container.classList.remove(CONTAINER_CLASS, MOVING_CLASS, INTERACTIVE_CLASS);
			container.style.removeProperty("mask-image");
			container.removeAttribute("role");
			container.removeAttribute("aria-orientation");
			container.removeAttribute("aria-activedescendant");
			if (ownsFocus) container.removeAttribute("tabindex");
		}
	};
};
//#endregion
export { createPicker as t };
