import { r as AXIS, t as clamp } from "./math-CUR6Lwfw.js";
//#region src/layouts/coverflow.ts
const coverflow = ({ step = 92, spread = 75, depth = 80, angle = 58, reach = 6, perspective = 900 } = {}) => ({
	layout: (d) => {
		const turn = clamp(d, -1, 1);
		const distance = Math.abs(d);
		return {
			x: d * step + turn * spread,
			y: 0,
			z: -Math.min(distance, reach) * depth,
			rotate: 0,
			rotateY: -turn * angle,
			scale: 1,
			opacity: 1 - clamp((distance - reach + 2) / 2, 0, 1)
		};
	},
	spacing: step + spread,
	overscan: 4,
	perspective
});
//#endregion
//#region src/layouts/fan.ts
const fan = ({ angle = 7, pivot = 440, lift = 30, reach = 7 } = {}) => {
	const step = angle * Math.PI / 180;
	return {
		layout: (d) => {
			const turn = d * step;
			const distance = Math.abs(d);
			const centered = 1 / (1 + (d * 1.6) ** 2);
			return {
				x: pivot * Math.sin(turn),
				y: pivot * (1 - Math.cos(turn)) - lift * centered,
				z: -Math.min(distance, reach) * 6,
				rotate: d * angle,
				scale: 1,
				opacity: 1 - clamp(distance - reach + 1, 0, 1)
			};
		},
		spacing: pivot * step,
		overscan: 4
	};
};
//#endregion
//#region src/layouts/stack.ts
const stack = ({ slide = 140, offset = 34, depth = 50, shrink = .05, reach = 4, perspective = 900 } = {}) => ({
	layout: (d) => {
		const waiting = clamp(d, 0, reach);
		const leaving = Math.max(-d, 0);
		return {
			x: 0,
			y: waiting * offset - leaving * slide,
			z: (leaving - waiting) * depth,
			rotate: 0,
			scale: 1 - waiting * shrink,
			opacity: Math.min(1 - clamp(leaving, 0, 1), 1 - clamp(d - reach + 1, 0, 1))
		};
	},
	spacing: slide,
	overscan: 4,
	perspective,
	axis: AXIS.VERTICAL
});
//#endregion
//#region src/layouts/wheel.ts
const wheel = ({ spacing = 36, radius = 130, horizon = 88, perspective = 520 } = {}) => ({
	layout: (d) => {
		const angle = d * spacing / radius;
		const degrees = angle * 180 / Math.PI;
		return {
			x: 0,
			y: radius * Math.sin(angle),
			z: -radius * (1 - Math.cos(angle)),
			rotate: 0,
			rotateX: -degrees,
			scale: 1,
			opacity: Math.max(0, 1 - Math.abs(degrees) / horizon)
		};
	},
	spacing,
	overscan: 3,
	perspective,
	axis: AXIS.VERTICAL
});
//#endregion
export { coverflow, fan, stack, wheel };
