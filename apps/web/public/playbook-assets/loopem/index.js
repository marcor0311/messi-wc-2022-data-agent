import { t as createPicker } from "./picker-BpcY6Kxs.js";
//#region src/dom/scroll.ts
const scrollProgress = (top, height, viewport) => {
	const range = height - viewport;
	return range > 0 ? Math.min(Math.max(-top / range, 0), 1) : 0;
};
const linkToScroll = (picker, track, { from = 0, to = picker.getCount() - 1 } = {}) => {
	let frame = 0;
	picker.setInteractive(false);
	const sync = () => {
		frame = 0;
		const { top, height } = track.getBoundingClientRect();
		const progress = scrollProgress(top, height, window.innerHeight);
		picker.seek(from + progress * (to - from));
	};
	const request = () => {
		if (frame === 0) frame = requestAnimationFrame(sync);
	};
	addEventListener("scroll", request, { passive: true });
	addEventListener("resize", request);
	sync();
	return { destroy: () => {
		if (frame !== 0) cancelAnimationFrame(frame);
		removeEventListener("scroll", request);
		removeEventListener("resize", request);
	} };
};
//#endregion
export { createPicker, linkToScroll };
