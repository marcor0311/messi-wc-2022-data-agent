import type { Shot } from "./contracts";

export const hasEndpoint = (s: Shot) => Number.isFinite(s.end_x) && Number.isFinite(s.end_y);
export const hasHeight = (s: Shot) => hasEndpoint(s) && Number.isFinite(s.end_z) && s.end_z! >= 0;
export const beforeGoalLine = (s: Shot) => hasEndpoint(s) && s.end_x! < 120;

/** Shared bounds keep both players at exactly the same scale, including misses. */
export function pitchViewBox(shots: Shot[]) {
  const endpoints = shots.filter(hasEndpoint);
  const left = Math.min(-5, ...endpoints.map(s => s.end_x! - 3));
  const top = Math.min(-5, ...endpoints.map(s => s.end_y! - 3));
  const right = Math.max(125, ...endpoints.map(s => s.end_x! + 3));
  const bottom = Math.max(85, ...endpoints.map(s => s.end_y! + 3));
  return `${left} ${top} ${right - left} ${bottom - top}`;
}

export function goalBounds(shots: Shot[]) {
  const endpoints = shots.filter(hasHeight);
  return {
    left: Math.min(33, ...endpoints.map(s => s.end_y! - .8)),
    right: Math.max(47, ...endpoints.map(s => s.end_y! + .8)),
    height: Math.max(4, ...endpoints.map(s => s.end_z! + .7)),
  };
}
