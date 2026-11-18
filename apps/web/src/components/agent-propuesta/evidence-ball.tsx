'use client';
import { useEffect, useRef, useState } from 'react';
import { MESSI_GOALS, MESSI_SHOTS, MESSI_XG } from './messi-shots';

/* Panel vacío: un balón de partículas (los datos) que, al hacer clic, se deshace en los 32 puntos
   de remate de Messi, dispara cada tiro real en perspectiva y vuelve a ser balón.
   Canvas 2D sin dependencias; el bucle vive fuera de React (sin renderizados por fotograma). */

const fmt = (n: number) => n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const C = { ink: '#0f2a44', muted: '#4a5f74', accent: '#1f5389', light: '#8fb0d1', line: '#b3c8dd' };
const hash = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* Esfera de Fibonacci con los 12 pentágonos del balón (vértices de un icosaedro). */
const N = MESSI_SHOTS.length * 50;
const PHI = (1 + Math.sqrt(5)) / 2;
const ICO = [[0,1,PHI],[0,-1,PHI],[0,1,-PHI],[0,-1,-PHI],[1,PHI,0],[-1,PHI,0],[1,-PHI,0],[-1,-PHI,0],[PHI,0,1],[-PHI,0,1],[PHI,0,-1],[-PHI,0,-1]]
  .map(v => { const l = Math.hypot(v[0], v[1], v[2]); return v.map(c => c / l); });
const SPHERE = Array.from({ length: N }, (_, i) => {
  const y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
  const p = [Math.cos(th) * r, y, Math.sin(th) * r];
  const near = Math.max(...ICO.map(v => v[0] * p[0] + v[1] * p[1] + v[2] * p[2]));
  return { p, dark: near > Math.cos(.36) };
});

/* Trayectorias: origen y destino reales; la altura no viene en los datos y se estiliza de forma determinista. */
type Flight = { x: number; y: number; X1: number; Y1: number; Z1: number; arcH: number; xg: number; out: string; dur: number; kicked: boolean };
const FLIGHTS: Flight[] = MESSI_SHOTS.map(([x, y, ex, ey, xg, out, pen], i) => {
  const h = hash(i), inMouth = ey >= 36 && ey <= 44;
  let X1 = ex, Y1 = ey, Z1 = .4 + h * 1.4, arcH = .3 + h * 1.2;
  if (out === 'G') { X1 = 121.6; Z1 = pen ? .3 + h * 1.6 : .2 + h * 2.1; arcH = .2 + h * .6; }
  if (out === 'O') { X1 = 123; Z1 = inMouth ? 3.1 + h * .7 : .6 + h * 1.6; arcH = .6 + h; }
  if (out === 'W') { X1 = ex + 1.5; Z1 = 1 + h * 1.5; arcH = 1 + h; }
  if (out === 'B') { Z1 = .2; arcH = .2; }
  return { x, y, X1, Y1, Z1, arcH, xg, out, dur: .32 + Math.hypot(X1 - x, Y1 - y) * .02, kicked: false };
});
const flightAt = (s: Flight, u: number): [number, number, number] => {
  const e = 1 - Math.pow(1 - u, 1.7);
  return [s.x + (s.X1 - s.x) * e, s.y + (s.Y1 - s.y) * e, s.Z1 * e + s.arcH * 4 * u * (1 - u)];
};
const GAP = .55, SEQ = MESSI_SHOTS.length * GAP + 1.2;
const H_BALL = 3.4, H_SPLIT = 1.6, H_LOOP = H_BALL + H_SPLIT + SEQ + 2.4;

type Engine = { play: () => void; setMap: (m: boolean) => void; destroy: () => void };

function createEngine(canvas: HTMLCanvasElement, onIdle: () => void): Engine {
  const ctx = canvas.getContext('2d')!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const font = getComputedStyle(canvas).fontFamily;
  let W = 0, H = 0, f = 300, hz = 26, R = 96, ds = 1, t = 0, last = 0, raf = 0;
  let visible = true, playAt: number | null = null, staticMap = false;
  let netKick = { t: -9, y: 40, z: 1 };
  const mouse = { x: -999, y: -999 };
  const cam = { x: 84, y: 40, z: 9 };
  FLIGHTS.forEach(s => { s.kicked = false; });

  const project = (X: number, Y: number, Z: number) => {
    const d = X - cam.x;
    return d < .6 ? null : { x: W / 2 + f * (Y - cam.y) / d, y: hz + f * (cam.z - Z) / d, s: f / d };
  };
  const line = (pts: number[][], color: string, width = 1, alpha = 1) => {
    ctx.beginPath(); let on = false;
    for (const [X, Y, Z = 0] of pts) { const p = project(X, Y, Z); if (!p) { on = false; continue; } if (on) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); on = true; }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha; ctx.stroke(); ctx.globalAlpha = 1;
  };

  function drawPitch(alpha: number) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha;
    for (let x = 83, k = 0; x < 120; x += 5.5, k++) {
      const a = project(x, -20, 0), b = project(Math.min(x + 5.5, 120), -20, 0);
      if (!a || !b) continue;
      ctx.fillStyle = k % 2 ? 'rgba(220,234,248,.55)' : 'rgba(220,234,248,.22)';
      ctx.fillRect(0, b.y, W, a.y - b.y);
    }
    // Sin bordes de tarjeta: el césped se desvanece hacia los lados y hacia abajo.
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'destination-out';
    const fade = (x0: number, y0: number, x1: number, y1: number) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); return g; };
    const e = Math.min(160, W * .18);
    ctx.fillStyle = fade(0, 0, e, 0); ctx.fillRect(0, 0, e, H);
    ctx.fillStyle = fade(W, 0, W - e, 0); ctx.fillRect(W - e, 0, e, H);
    ctx.fillStyle = fade(0, H, 0, H - e); ctx.fillRect(0, H - e, W, e);
    ctx.restore();
    const la = .9 * alpha;
    line([[120, -30], [120, 110]], C.line, 1.2, la);
    line([[102, 18], [120, 18]], C.line, 1.2, la); line([[102, 62], [120, 62]], C.line, 1.2, la); line([[102, 18], [102, 62]], C.line, 1.2, la);
    line([[114, 30], [120, 30]], C.line, 1.2, la); line([[114, 50], [120, 50]], C.line, 1.2, la); line([[114, 30], [114, 50]], C.line, 1.2, la);
    line(Array.from({ length: 41 }, (_, i) => { const a = Math.PI - .927 + 1.854 * i / 40; return [108 + Math.cos(a) * 10, 40 + Math.sin(a) * 10]; }), C.line, 1.2, la);
    const spot = project(108, 40, 0);
    if (spot) { ctx.globalAlpha = la; ctx.fillStyle = C.line; ctx.beginPath(); ctx.arc(spot.x, spot.y, 1.6, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    const kick = Math.max(0, 1 - (t - netKick.t) / .7);
    const bulge = (y: number, z: number) => kick * 1.4 * Math.max(0, 1 - Math.hypot(y - netKick.y, (z - netKick.z) * 1.6) / 3);
    for (let y = 36; y <= 44.01; y += 1) line([[120, y, 2.67], [122 + bulge(y, 2.2), y, 2.2], [122 + bulge(y, .6), y, 0]], C.line, .8, .7 * alpha);
    for (let z = 0; z <= 2.21; z += .55) line(Array.from({ length: 9 }, (_, i) => [122 + bulge(36 + i, z), 36 + i, z]), C.line, .8, .7 * alpha);
    line([[120, 36, 0], [120, 36, 2.67], [120, 44, 2.67], [120, 44, 0]], C.ink, 2.2, alpha);
  }

  /* local < 0 en modo estático: todos los tiros ya ejecutados. */
  function drawShots(local: number, live: boolean) {
    let fired = 0, goals = 0, xg = 0;
    FLIGHTS.forEach(s => {
      const u = live ? (local - FLIGHTS.indexOf(s) * GAP) / s.dur : 2;
      const o = project(s.x, s.y, 0); if (!o) return;
      if (u < 0) { s.kicked = false; return; }
      fired++; xg += s.xg; if (s.out === 'G' && u >= 1) goals++;
      if (u >= 1) {
        ctx.beginPath(); ctx.arc(o.x, o.y, Math.max(1.6, Math.sqrt(s.xg) * 5.2 * o.s / 14), 0, 7);
        ctx.fillStyle = s.out === 'G' ? C.accent : 'rgba(143,176,209,.55)'; ctx.fill();
        line(Array.from({ length: 16 }, (_, k) => flightAt(s, k / 15)), s.out === 'G' ? C.accent : C.light, 1, s.out === 'G' ? .45 : .25);
      }
      if (live && u < 1.25) {
        const k = Math.min(1, u);
        line(Array.from({ length: 10 }, (_, j) => flightAt(s, Math.max(0, k - .22 + .22 * j / 9))), s.out === 'G' ? C.accent : C.ink, 1.6, .35 * (1.25 - u) / 1.25 + .1);
        const [X, Y, Z] = flightAt(s, k), sh = project(X, Y, 0), b = project(X, Y, Z);
        if (sh && b) {
          const br = Math.max(2.4, .3 * b.s);
          ctx.globalAlpha = .18; ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, br * 1.1, br * .4, 0, 0, 7); ctx.fill();
          ctx.globalAlpha = u > 1 ? Math.max(0, 1 - (u - 1) * 4) : 1;
          ctx.fillStyle = '#fff'; ctx.strokeStyle = s.out === 'G' ? C.accent : C.ink; ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.arc(b.x, b.y, br, 0, 7); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
        }
        if (s.out === 'G' && u >= 1 && !s.kicked) { s.kicked = true; netKick = { t, y: s.Y1, z: s.Z1 }; }
      }
    });
    return { fired, goals, xg };
  }
  function drawCounter(st: { fired: number; goals: number; xg: number }, alpha: number) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.textBaseline = 'top';
    ctx.font = `600 12px ${font}`; ctx.fillStyle = C.muted;
    ctx.fillText(`Remate ${Math.max(1, st.fired)} de ${MESSI_SHOTS.length}`, 16, 14);
    ctx.font = `700 12px ${font}`; ctx.fillStyle = C.accent;
    ctx.fillText(`${st.goals} ${st.goals === 1 ? 'gol' : 'goles'}`, 16, 31);
    ctx.fillText(`xG ${fmt(st.xg)}`, 16, 48);
    ctx.restore();
  }

  /* Partículas: filas de datos que fluyen y se ensamblan; 50 por remate. */
  const parts = Array.from({ length: N }, (_, i) => ({ x: 0, y: 0, lane: i % 7, sp: .4 + hash(i + 9) * .9, off: hash(i + 3), rate: 3 + hash(i + 17) * 5, shot: i % MESSI_SHOTS.length, jx: hash(i + 5) - .5, jy: hash(i + 7) - .5, lag: hash(i + 31) * .35 }));
  const fieldPos = (p: typeof parts[number], time: number) => [((p.off * (W + 80) + time * 40 * p.sp) % (W + 80)) - 40, H * (.3 + p.lane * .07) + Math.sin(time * 1.3 + p.off * 9) * 3];
  const spherePos = (i: number, time: number) => {
    const [x, y, z] = SPHERE[i].p, a = time * .45, b = .38;
    const x1 = x * Math.cos(a) + z * Math.sin(a), z1 = -x * Math.sin(a) + z * Math.cos(a);
    const y2 = y * Math.cos(b) - z1 * Math.sin(b), z2 = y * Math.sin(b) + z1 * Math.cos(b), s = 1 / (1 - z2 * .18);
    return [W / 2 + x1 * R * s, H / 2 + y2 * R * s, z2];
  };
  const step = (p: typeof parts[number], tx: number, ty: number, dt: number, rate = p.rate) => {
    const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
    if (d < 60 && d > .01) { const k = (60 - d) / 60 * 26; tx += dx / d * k; ty += dy / d * k; }
    const e = 1 - Math.exp(-dt * rate); p.x += (tx - p.x) * e; p.y += (ty - p.y) * e;
  };
  const dot = (p: { x: number; y: number }, z: number, dark: boolean, alpha = 1, size = 1) => {
    const depth = (z + 1) / 2, front = z > -.05, ink = dark && front;
    ctx.globalAlpha = alpha * (ink ? .25 + .75 * depth : front ? .3 + .5 * depth : .08 + .25 * depth);
    ctx.fillStyle = ink ? C.ink : C.light;
    ctx.beginPath(); ctx.arc(p.x, p.y, ds * size * (ink ? 1.9 : 1.3) * (.7 + .4 * depth), 0, 7); ctx.fill();
  };
  parts.forEach(p => { [p.x, p.y] = fieldPos(p, 0); });

  function scene(dt: number) {
    let lt = Math.min(t, H_BALL - .01);
    if (playAt !== null) { lt = H_BALL + (t - playAt); if (lt >= H_LOOP) { playAt = null; lt = H_BALL - .01; onIdle(); } }
    const pitchA = lt < H_BALL ? 0 : lt < H_BALL + H_SPLIT ? (lt - H_BALL) / H_SPLIT : lt > H_LOOP - 1.2 ? (H_LOOP - lt) / 1.2 : 1;
    drawPitch(pitchA);
    const local = lt - H_BALL - H_SPLIT;
    let st = { fired: 0, goals: 0, xg: 0 };
    if (local > -H_SPLIT && lt < H_LOOP - 1.2) st = drawShots(local, true);
    if (pitchA > 0) drawCounter(st, pitchA);
    const regroup = lt > H_LOOP - 1.4;
    const order = parts.map((_, i) => [i, spherePos(i, t)] as const).sort((a, b) => a[1][2] - b[1][2]);
    for (const [i, s] of order) {
      const p = parts[i], fl = FLIGHTS[p.shot];
      let tx: number, ty: number, z = s[2], dark: boolean | 'goal' = SPHERE[i].dark, a = 1, rate = p.rate;
      if (lt < H_BALL || regroup) {
        if (regroup || lt > .5 + p.off * 1.3) { tx = s[0]; ty = s[1]; } else { [tx, ty] = fieldPos(p, t); z = -.4; dark = false; }
      } else {
        const u = (local - p.shot * GAP) / fl.dur;
        if (u < 0) { // nube en su punto de remate, más amplia cuanto mayor el xG
          const o = project(fl.x, fl.y, 0)!, spread = 4 + Math.sqrt(fl.xg) * 22;
          tx = o.x + p.jx * spread; ty = o.y + p.jy * spread * .45;
        } else { // estela del balón; se desvanece al terminar el tiro
          const [X, Y, Z] = flightAt(fl, Math.min(1, Math.max(0, u - p.lag))), b = project(X, Y, Z)!;
          tx = b.x + p.jx * 3; ty = b.y + p.jy * 3; rate = 16;
          a = u > 1 + p.lag ? Math.max(0, .8 - (u - 1 - p.lag) * 1.6) : .85;
        }
        z = .3; dark = fl.out === 'G' ? 'goal' : false;
      }
      step(p, tx, ty, dt, rate);
      if (a <= 0) continue;
      if (dark === 'goal') { ctx.globalAlpha = a; ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, 7); ctx.fill(); }
      else dot(p, z, dark, a, lt < H_BALL || regroup ? 1 : .8);
    }
    ctx.globalAlpha = 1;
  }

  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(H * .42, W * .36, 280); ds = Math.max(1, Math.pow(R / 96, .4)); // puntos más grandes en balones grandes
    // Encaja el área en alto y en ancho; los remates más lejanos (x < 97) entran desde abajo.
    f = Math.min((H * .9 - 14) * (97 - cam.x) / cam.z, (W / 2 - 24) * 20 / 16);
    const top = f * (cam.z - 4) / 36, bottom = f * cam.z / (97 - cam.x);
    hz = Math.min(H / 2 - (top + bottom) / 2, H - 14 - bottom);
  }
  function frame(now: number) {
    const dt = Math.min(.05, (now - last) / 1000 || 0); last = now; t += dt;
    ctx.clearRect(0, 0, W, H); scene(dt);
    raf = visible ? requestAnimationFrame(frame) : 0;
  }
  function still() { // movimiento reducido: un cuadro legible
    cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, W, H);
    if (staticMap) { drawPitch(1); drawShots(-1, false); drawCounter({ fired: MESSI_SHOTS.length, goals: MESSI_GOALS, xg: MESSI_XG }, 1); return; }
    const order = parts.map((_, i) => [i, spherePos(i, t || 1.2)] as const).sort((a, b) => a[1][2] - b[1][2]);
    for (const [i, s] of order) { parts[i].x = s[0]; parts[i].y = s[1]; dot(parts[i], s[2], SPHERE[i].dark); }
    ctx.globalAlpha = 1;
  }
  function start() {
    cancelAnimationFrame(raf); raf = 0;
    if (reduce.matches) { still(); return; }
    if (visible) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  const stage = canvas.parentElement!;
  const move = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
  const leave = () => { mouse.x = mouse.y = -999; };
  const onVisibility = () => { visible = !document.hidden; if (visible && !raf) start(); };
  stage.addEventListener('pointermove', move); stage.addEventListener('pointerleave', leave);
  document.addEventListener('visibilitychange', onVisibility);
  reduce.addEventListener('change', start);
  const ro = new ResizeObserver(() => { resize(); if (!raf) start(); }); ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; if (visible && !raf) start(); }); io.observe(canvas);
  resize(); start();

  return {
    play() { if (playAt === null) playAt = t; },
    setMap(m) { staticMap = m; still(); },
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', onVisibility); reduce.removeEventListener('change', start);
    },
  };
}

export default function EvidenceBall() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const [playing, setPlaying] = useState(false);
  const [still, setStill] = useState(false);
  const [map, setMap] = useState(false);

  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(mq.matches);
    sync(); mq.addEventListener('change', sync);
    engine.current = createEngine(canvas.current!, () => setPlaying(false));
    return () => { mq.removeEventListener('change', sync); engine.current?.destroy(); engine.current = null; };
  }, []);

  const label = still ? (map ? 'Volver al balón' : `Ver los ${MESSI_SHOTS.length} remates de Messi`)
    : playing ? `Mostrando los ${MESSI_SHOTS.length} remates de Messi` : `Ver los ${MESSI_SHOTS.length} remates de Messi`;
  const activate = () => {
    if (still) { setMap(!map); engine.current?.setMap(!map); return; }
    if (playing) return;
    setPlaying(true); engine.current?.play();
  };

  return <div className="ap-ball">
    <canvas ref={canvas} aria-hidden="true" />
    <button type="button" className="ap-ball-hit" aria-label={label} aria-disabled={!still && playing} onClick={activate} />
  </div>;
}
