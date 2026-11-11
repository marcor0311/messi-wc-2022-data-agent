//#region src/core/constants.ts
const LAYOUT = {
	LINE: "line",
	ARC: "arc"
};
const AXIS = {
	HORIZONTAL: "horizontal",
	VERTICAL: "vertical"
};
const LOOP_MODE = {
	WRAP: "wrap",
	CLAMP: "clamp"
};
const SELECT_MODE = {
	AUTO: "auto",
	MANUAL: "manual"
};
const BEND = {
	DOWN: "down",
	UP: "up",
	RIGHT: "right",
	LEFT: "left"
};
//#endregion
//#region src/core/math.ts
const clamp = (value, min, max) => {
	if (value < min) return min;
	if (value > max) return max;
	return value;
};
const wrapIndex = (index, count) => {
	if (count <= 0) return 0;
	return (index % count + count) % count;
};
//#endregion
export { LAYOUT as a, BEND as i, wrapIndex as n, LOOP_MODE as o, AXIS as r, SELECT_MODE as s, clamp as t };
