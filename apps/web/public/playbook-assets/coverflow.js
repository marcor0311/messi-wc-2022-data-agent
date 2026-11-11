import { createPicker } from './loopem/index.js';
import { coverflow } from './loopem/layouts.js';

const host = document.getElementById('coverflow');
const status = document.getElementById('load-status');
const previous = document.getElementById('previous');
const next = document.getElementById('next');
const play = document.getElementById('play');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let picker;
let active = 6;
let position = active;
let playing = false;
let playbackTimer;
let wheelTimer;
let navigation;
let navigationTarget;
let chapters;
let size;
let resizeFrame;

function stopPlayback() {
  playing = false;
  clearTimeout(playbackTimer);
  play.setAttribute('aria-pressed', 'false');
  play.firstChild.textContent = 'Ver en movimiento ';
}

function schedulePlayback() {
  clearTimeout(playbackTimer);
  if (!playing || reduced.matches || document.hidden || host.matches(':hover') || host.classList.contains('loopem-moving')) return;
  playbackTimer = setTimeout(() => picker.next(), 2200);
}

function interruptNavigation() {
  navigation?.kill();
  navigation = null;
  clearTimeout(wheelTimer);
}

function go(index, animate = true) {
  clearTimeout(playbackTimer);
  interruptNavigation();
  // The same shortest wrap as Loopem.scrollTo(), driven by GSAP for buttons.
  const count = chapters.length;
  const target = Math.round((position - index) / count) * count + index;
  navigationTarget = target;
  if (!animate || reduced.matches || !window.gsap) {
    picker.scrollTo(target, { animate: false });
    return;
  }
  const motion = { offset: position };
  // Stop any native coast before GSAP takes ownership of the same offset.
  picker.seek(position);
  navigation = gsap.to(motion, {
    offset: target,
    duration: .28,
    ease: 'power3.out',
    onUpdate: () => picker.seek(motion.offset),
    onComplete: () => {
      navigation = null;
      picker.scrollTo(target, { animate: false });
    },
  });
}

function showChapter(index) {
  active = index;
  const item = chapters[index];
  document.getElementById('year').textContent = item.year.split(' / ')[0];
  const title = document.getElementById('chapter-title');
  title.replaceChildren();
  item.title.split('\n').forEach((line, i) => {
    if (i) title.append(document.createElement('br'));
    title.append(document.createTextNode(line));
  });
  document.getElementById('place').textContent = item.date;
  document.getElementById('story').textContent = item.body;
  const score = document.getElementById('score');
  score.replaceChildren();
  if (item.match) {
    const match = item.match;
    const line = document.createElement('div');
    line.className = 'score-line';
    const home = document.createElement('span'); home.textContent = 'Argentina';
    const result = document.createElement('strong'); result.textContent = `${match.goals[0]} — ${match.goals[1]}`;
    const away = document.createElement('span'); away.textContent = match.opponent;
    line.append(home, result, away);
    const details = document.createElement('div'); details.className = 'score-details';
    const competition = document.createElement('span'); competition.textContent = match.competition;
    details.append(competition);
    if (match.penalties) {
      const penalties = document.createElement('span'); penalties.className = 'penalties';
      penalties.textContent = `Penales ${match.penalties[0]} — ${match.penalties[1]}`;
      details.append(penalties);
    }
    score.append(line, details);
  }
  document.getElementById('photo-position').innerHTML = `${String(index + 1).padStart(2, '0')} <span>/ ${chapters.length}</span>`;
  document.querySelectorAll('.timeline button').forEach((button, i) => {
    if (i === index) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
    button.dataset.past = String(i < index);
  });
}

function mount() {
  interruptNavigation();
  picker?.destroy();
  const photoSize = Math.min(innerWidth * .46, innerWidth >= 1700 ? 850 : 740);
  size = photoSize;
  // Exact demo geometry, scaled from its 220px-wide cards to our photographs.
  const scale = photoSize / 220;
  const preset = coverflow({ step: 108 * scale, spread: 84 * scale, depth: 86 * scale, angle: 56, reach: 5, perspective: 900 * scale });
  // Depth provides occlusion. Never dissolve one photograph through another.
  const geometry = preset.layout;
  picker = createPicker(host, {
    ...preset,
    layout: distance => ({ ...geometry(distance), opacity: 1 }),
    items: chapters,
    loop: 'wrap',
    initialIndex: active,
    minOpacity: 1,
    fade: 0,
    stiffness: 13,
    friction: .026,
    renderItem(item) {
      const figure = document.createElement('figure'); figure.className = 'photo';
      figure.setAttribute('aria-label', `${item.year.replace(' / ', ', ')}. ${item.title.replace('\n', '. ')}`);
      const image = document.createElement('img');
      image.src = item.image;
      image.alt = item.alt;
      image.draggable = false;
      image.decoding = 'async';
      image.addEventListener('error', () => {
        const error = document.createElement('span'); error.className = 'image-error'; error.textContent = item.alt;
        figure.replaceChildren(error);
      }, { once: true });
      figure.append(image);
      return figure;
    },
  });
  picker.on('change', ({ index }) => showChapter(index), { immediate: true });
  picker.on('move', ({ offset }) => {
    position = offset;
    clearTimeout(playbackTimer);
  }, { immediate: true });
  picker.on('settle', schedulePlayback);
  if (reduced.matches) host.setAttribute('aria-description', 'Movimiento reducido. Usa los botones de años o las flechas.');
  else host.removeAttribute('aria-description');
  status.hidden = true;
}

async function start() {
  const response = await fetch('./playbook-assets/coverflow-chapters.json');
  if (!response.ok) throw new Error('No se pudo cargar el recorrido');
  chapters = await response.json();
  const timeline = document.getElementById('timeline');
  chapters.forEach((item, index) => {
    const button = document.createElement('button'); button.type = 'button';
    button.setAttribute('aria-label', `${item.year.replace(' / ', ', ')}. ${item.date.split(' — ')[1]}`);
    const dot = document.createElement('span'); dot.className = 'dot'; dot.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.textContent = item.year.split(' / ')[0];
    if (item.year.includes('/')) { const month = document.createElement('span'); month.className = 'month'; month.textContent = item.year.split(' / ')[1]; label.append(month); }
    button.append(dot, label);
    button.addEventListener('click', event => go(index, event.detail !== 0));
    timeline.append(button);
  });
  mount();
  previous.addEventListener('click', event => go(Math.round(navigation ? navigationTarget : position) - 1, event.detail !== 0));
  next.addEventListener('click', event => go(Math.round(navigation ? navigationTarget : position) + 1, event.detail !== 0));
  // Leave horizontal wheel/trackpad handling to Loopem. Map a vertical mouse
  // wheel onto the same continuous offset, then snap once the gesture ends.
  host.addEventListener('wheel', event => {
    if (event.ctrlKey) {
      event.stopImmediatePropagation();
      return;
    }
    clearTimeout(playbackTimer);
    interruptNavigation();
    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY) || !event.deltaY) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    picker.seek(position + event.deltaY * factor / (size * 192 / 220));
    wheelTimer = setTimeout(() => {
      picker.scrollTo(Math.round(position), { animate: !reduced.matches });
    }, 120);
  }, { passive: false, capture: true });
  host.addEventListener('pointerdown', () => {
    clearTimeout(playbackTimer);
    interruptNavigation();
  }, { capture: true });
  host.addEventListener('pointerenter', () => clearTimeout(playbackTimer));
  host.addEventListener('pointerleave', schedulePlayback);
  host.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? chapters.length - 1 : active + ({ ArrowLeft: -1, ArrowRight: 1, PageUp: -5, PageDown: 5 }[event.key]);
      go(index, false);
    }
  }, { capture: true });
  play.addEventListener('click', () => {
    if (playing) return stopPlayback();
    if (reduced.matches) return;
    interruptNavigation();
    playing = true;
    play.setAttribute('aria-pressed', 'true');
    play.firstChild.textContent = 'Detener recorrido ';
    schedulePlayback();
  });
  document.addEventListener('visibilitychange', schedulePlayback);
  const updateMotion = () => {
    stopPlayback();
    mount();
    play.disabled = reduced.matches;
  };
  play.disabled = reduced.matches;
  reduced.addEventListener('change', updateMotion);
  addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const nextSize = Math.min(innerWidth * .46, innerWidth >= 1700 ? 850 : 740);
      if (size !== nextSize) { stopPlayback(); mount(); }
    });
  });
}

start().catch(() => { status.hidden = false; status.textContent = 'No se pudo cargar la propuesta. Recarga la página para volver a intentarlo.'; });
