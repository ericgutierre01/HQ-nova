// Nova HQ: la pantalla aparte. Recibe la oficina por SSE (/events) y la anima con GSAP.
// Las Novas se dibujan con el mismo scene.ts de la banda (nova-hq), así se ven iguales.
import { scene, SKINS } from '/scene.js';
import { sky } from '/office-wall.js';
import { PALETTES, starSVG } from '/nova.js';

const { gsap, Flip } = window;
gsap.registerPlugin(Flip, window.MotionPathPlugin);

const q = s => document.querySelector(s);
const stage = q('#stage'), stationsEl = q('#stations'), linksEl = q('#links'), fx = q('#fx');
const track = q('#river-track'), emptyEl = q('#empty'), scenery = q('#scenery');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ── Skin y escenario elegidos: ?skin=pava&escena=playa&rotar=1 en la URL, si no lo último guardado ──
const ESCENAS = { oficina: 'Oficina', playa: 'Playa', espacio: 'Espacio', ciudad: 'Ciudad', bosque: 'Bosque' };
// De fábrica cambia de escenario solo cada 10 min; lo que elijas (URL, ⚙ o teclas) se recuerda en esta pantalla.
const prefs = { skin: 'clasica', scene: 'oficina', rotate: true };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('hq-prefs') || '{}')); } catch { /* sin almacenamiento: valores de fábrica */ }
const savePrefs = () => { try { localStorage.setItem('hq-prefs', JSON.stringify(prefs)); } catch { /* ignore */ } };
{
  const u = new URLSearchParams(location.search);
  if (SKINS[u.get('skin')]) prefs.skin = u.get('skin');
  if (ESCENAS[u.get('escena')]) prefs.scene = u.get('escena');
  if (u.has('rotar')) prefs.rotate = u.get('rotar') !== '0';
  if (u.has('skin') || u.has('escena') || u.has('rotar')) savePrefs();
}
if (!SKINS[prefs.skin]) prefs.skin = 'clasica';
if (!ESCENAS[prefs.scene]) prefs.scene = 'oficina';

// ── Escala: el escenario mide 1920×1080 y se ajusta a la pantalla ─────────
let scale = 1;
function fit() {
  scale = Math.min(innerWidth / 1920, innerHeight / 1080);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
addEventListener('resize', fit);
fit();

// ── Íconos ────────────────────────────────────────────────────────────────
const ICON = {
  read: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h4"/>',
  edit: '<path d="M4 20l1.5-5L16 4.5 19.5 8 9 18.5z"/><path d="M14 6.5l3.5 3.5"/>',
  terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M7.5 10l3 2.5-3 2.5M12.5 15.5h4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  web: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17"/>',
  agent: '<path class="fill" d="M12 2.5C12.9 9 15 11.1 21.5 12 15 12.9 12.9 15 12 21.5 11.1 15 9 12.9 2.5 12 9 11.1 11.1 9 12 2.5z"/>',
  skill: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>',
  ask: '<path d="M4 5h16v11H9l-5 4z"/><path d="M10 9a2 2 0 1 1 2.6 1.9c-.5.2-.6.6-.6 1.1M12 14.3v.2"/>',
  browser: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 9h18M6.5 6.8h.01M9 6.8h.01"/>',
  plan: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  tool: '<path d="M14.5 4.5a4 4 0 0 0-5 5L4 15l5 5 5.5-5.5a4 4 0 0 0 5-5l-2.6 2.6-3-3z"/>',
  think: '<path d="M6.5 12h.01M12 12h.01M17.5 12h.01" stroke-width="3.4"/>',
  talk: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8.5 10.5h7"/>',
  done: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  error: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.4v.2"/>',
  prompt: '<path d="M4 12l16-8-5.5 16-2.8-6.2z"/>',
  idle: '<path d="M5 9h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.3 2.3 0 0 1 0 4.6H16M8.5 3.5v2.5M11.5 3.5v2.5"/>',
  sleep: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.4 6.4 0 0 0 10 10z"/>',
  pencil: '<path d="M4 20l1.5-5L16 4.5 19.5 8 9 18.5z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
};
const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name] ?? ICON.tool}</svg>`;
const palette = name => PALETTES[name] ?? PALETTES.nova;
const novaDot = name => { const p = palette(name).stops; return `linear-gradient(135deg, ${p[0]}, ${p[1]} 45%, ${p[3]})`; };

// ── Una Nova (el dibujo de la banda) como imagen: sus animaciones CSS corren aisladas ──
const petKey = a => [a.mood, a.phase, a.coffee, a.sweat, a.entering, a.leaving, a.palette].join('|');
function petSrc(a, size, skin = prefs.skin) {
  const pet = {
    id: a.id, name: a.kind === 'main' ? 'Nova' : a.agentType, mood: a.mood, task: a.label, focus: '',
    phase: a.phase, sweat: a.sweat, coffee: a.coffee, entering: a.entering, leaving: a.leaving,
    // scene.ts solo viste con `avatar` a la mascota de id 'main': aquí cada una lleva su color en `palette`.
    palette: a.palette || 'nova',
  };
  const { source } = scene([pet], { size, now: Date.now(), skin });
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
}

const ago = ms => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

// ── Escritorios (uno por sesión) ─────────────────────────────────────────
const stations = new Map();  // id de la Nova principal → escritorio
const helpers = new Map();   // id de la ayudante → su lugar
const flights = new Set();   // ayudantes que acaban de recibir la estrella
let lastById = new Map();
let firstPaint = true;
const MAX_HELPERS = 6;

function createStation(a) {
  const el = document.createElement('div');
  el.className = 'station';
  el.dataset.flipId = a.id;
  el.innerHTML = `
    <div class="bubble"><span class="bi"></span><span class="bt"></span><span class="bs"></span><span class="ping"></span></div>
    <div class="crew"><div class="pet main"><img alt=""></div><div class="helpers"></div></div>
    <div class="plate"><div class="proj"></div><div class="ttl"></div><div class="cnt"></div><div class="uso"></div></div>
    <div class="steps"></div>`;
  const st = {
    id: a.id, el, bubble: el.querySelector('.bubble'), bi: el.querySelector('.bi'), bt: el.querySelector('.bt'), bs: el.querySelector('.bs'),
    img: el.querySelector('.pet.main img'), helpersEl: el.querySelector('.helpers'), proj: el.querySelector('.proj'),
    ttl: el.querySelector('.ttl'), cnt: el.querySelector('.cnt'), uso: el.querySelector('.uso'), steps: el.querySelector('.steps'),
    key: '', label: '', state: '', tools: -1, since: 0,
  };
  stationsEl.appendChild(el);
  stations.set(a.id, st);
  return st;
}

function updateStation(st, a) {
  const key = petKey(a);
  if (key !== st.key) {
    st.key = key;
    st.img.src = petSrc(a, 230);
    if (!firstPaint) gsap.fromTo(st.img, { scale: .94, y: 4 }, { scale: 1, y: 0, duration: .45, ease: 'back.out(3)', transformOrigin: '50% 100%' });
  }
  if (a.state !== st.state) {
    st.bubble.className = `bubble s-${a.state}`;
    st.bi.innerHTML = icon(a.icon);
    st.state = a.state;
  }
  if (a.label !== st.label) {
    st.label = a.label;
    st.bt.textContent = a.label;
    if (!firstPaint) gsap.fromTo(st.bt, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: 'power2.out' });
  }
  st.since = a.since;
  st.showTime = a.state === 'working' || a.state === 'thinking' || a.state === 'talking';
  st.proj.innerHTML = esc(a.project) + (a.worktree ? '<span class="wt">worktree</span>' : '') +
    (a.skill ? `<span class="sk" title="Trabajando con la skill ${esc(a.skill)}">${icon('skill')}${esc(a.skill)}</span>` : '') +
    (a.principal ? '<span class="pr" title="El chat donde escribiste por última vez">✎ Chat actual</span>' : '');
  st.el.classList.toggle('principal', !!a.principal);
  st.el.style.setProperty('--accent', palette(a.palette).stops[1]);
  st.ttl.textContent = a.title || 'Sesión de Claude';
  st.cnt.innerHTML = `<span>${icon('pencil')}${a.counts.edits}</span><span>${icon('terminal')}${a.counts.commands}</span><span>${icon('gear')}${a.counts.tools}</span>`;
  st.uso.innerHTML = a.uso
    ? `${icon('clock')}${esc(a.uso.start)}–${esc(a.uso.end)} · <b>${esc(a.uso.work)}</b> trabajando`
    : '';
  if (a.counts.tools !== st.tools) {
    const fresh = st.tools < 0 ? 0 : Math.min(a.steps.length, a.counts.tools - st.tools);
    st.tools = a.counts.tools;
    renderSteps(st.steps, a.steps, a.palette, fresh);
  }
}

function renderSteps(el, steps, pal, fresh) {
  const bg = palette(pal).stops[1];
  el.innerHTML = steps.map(s => `<div class="step${s.err ? ' err' : ''}" style="background:${bg}">${icon(s.icon)}</div>`).join('');
  if (fresh > 0 && !firstPaint) {
    const news = [...el.children].slice(-fresh);
    gsap.from(news, { x: 16, opacity: 0, scale: .6, duration: .4, stagger: .06, ease: 'back.out(2)' });
  }
}

function removeStation(id, st) {
  stations.delete(id);
  gsap.to(st.el, {
    opacity: 0, y: 30, scale: .9, duration: .6, ease: 'power2.in',
    onComplete: () => { const s = Flip.getState('.station'); st.el.remove(); Flip.from(s, { duration: .7, ease: 'power2.inOut' }); },
  });
}

function createHelper(a, st) {
  const el = document.createElement('div');
  el.className = 'pet helper';
  el.dataset.flipId = a.id;
  el.innerHTML = `<img alt=""><div class="tag"></div><div class="hl"></div>`;
  const he = { id: a.id, el, img: el.querySelector('img'), tag: el.querySelector('.tag'), hl: el.querySelector('.hl'), key: '', station: st.id, returned: false, isNew: true };
  st.helpersEl.appendChild(el);
  helpers.set(a.id, he);
  return he;
}

function updateHelper(he, a) {
  const key = petKey(a);
  if (key !== he.key) { he.key = key; he.img.src = petSrc(a, 136); }
  he.tag.textContent = a.agentType || 'Ayudante';
  he.tag.style.background = palette(a.palette).stops[1];
  he.hl.textContent = a.task ? `${a.task} · ${a.label}` : a.label;
  he.palette = a.palette;
  // Al terminar, la estrella vuelve a Nova (entrega su parte).
  if (a.leaving && !he.returned) {
    he.returned = true;
    const st = stations.get(he.station);
    if (st) flyStar(he.img, st.img, () => hop(st.img));
  }
}

function removeHelper(id, he) {
  helpers.delete(id);
  gsap.to(he.el, { opacity: 0, x: 40, scale: .7, duration: .5, ease: 'power2.in', onComplete: () => he.el.remove() });
}

function rootOf(a, byId) {
  let cur = a;
  for (let i = 0; cur && cur.kind === 'helper' && i < 6; i++) cur = byId.get(cur.parentId);
  return cur && cur.kind === 'main' ? cur.id : null;
}

function zoomFor(n) {
  return n <= 1 ? 1.45 : n === 2 ? 1.3 : n === 3 ? 1.18 : n === 4 ? 1 : n <= 6 ? .86 : n <= 9 ? .7 : .56;
}

// Empieza con el tamaño que toca por cantidad de sesiones y lo baja hasta que todo quepa en el piso.
function fitStations(start) {
  let z = start;
  stationsEl.style.setProperty('--z', z);
  for (let i = 0; i < 12 && z > .4 && stationsEl.scrollHeight > stationsEl.clientHeight + 2; i++) {
    z = Math.round((z - .05) * 100) / 100;
    stationsEl.style.setProperty('--z', z);
  }
}

let lastList = [];
function reconcile(list) {
  lastList = list;
  const byId = new Map(list.map(a => [a.id, a]));
  lastById = byId;
  const before = Flip.getState('.station, .pet.helper');
  const entered = [];

  for (const [id, st] of stations) if (!byId.has(id)) removeStation(id, st);
  for (const [id, he] of helpers) if (!byId.has(id) || !stations.has(rootOf(byId.get(id), byId))) removeHelper(id, he);

  const mains = list.filter(a => a.kind === 'main');
  for (const a of mains) {
    let st = stations.get(a.id);
    if (!st) { st = createStation(a); entered.push(st.el); }
    updateStation(st, a);
  }
  const perStation = new Map();
  for (const a of list.filter(x => x.kind === 'helper')) {
    const st = stations.get(rootOf(a, byId));
    if (!st) continue;
    const n = (perStation.get(st.id) ?? 0) + 1;
    perStation.set(st.id, n);
    if (n > MAX_HELPERS) continue;
    let he = helpers.get(a.id);
    if (!he) { he = createHelper(a, st); entered.push(he.el); }
    updateHelper(he, a);
  }
  for (const st of stations.values()) {
    const extra = (perStation.get(st.id) ?? 0) - MAX_HELPERS;
    let more = st.helpersEl.querySelector('.more');
    if (extra > 0) {
      if (!more) { more = document.createElement('div'); more.className = 'pet more'; st.helpersEl.appendChild(more); }
      more.textContent = `+${extra}`;
    } else more?.remove();
  }

  fitStations(zoomFor(mains.length));
  emptyEl.hidden = mains.length > 0;

  if (firstPaint) {
    firstPaint = false;
    gsap.from('.station', { opacity: 0, y: 40, duration: .8, stagger: .08, ease: 'power3.out' });
    return;
  }
  Flip.from(before, { targets: '.station, .pet.helper', duration: .7, ease: 'power2.inOut', nested: true, prune: true });
  for (const el of entered) enter(el);
}

function enter(el) {
  if (el.classList.contains('station')) {
    gsap.fromTo(el, { opacity: 0, y: 50, scale: .85 }, { opacity: 1, y: 0, scale: 1, duration: .9, ease: 'back.out(1.6)' });
    return;
  }
  const he = [...helpers.values()].find(h => h.el === el);
  const st = he && stations.get(he.station);
  gsap.set(el, { opacity: 0, scale: .4, transformOrigin: '50% 100%' });
  const pop = () => gsap.to(el, { opacity: 1, scale: 1, duration: .7, ease: 'back.out(2.2)' });
  // Nova le pasa su estrella a la ayudante: vuela, y la ayudante aparece donde cae.
  if (st && he && flights.delete(he.id)) flyStar(st.img, el, pop);
  else if (st) flyStar(st.img, el, pop);
  else pop();
}

// ── La estrella que viaja al delegar y al entregar ───────────────────────
function stageXY(el, fy = .5) {
  const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
  return { x: (r.left + r.width / 2 - s.left) / scale, y: (r.top + r.height * fy - s.top) / scale };
}

function flyStar(fromEl, toEl, done) {
  const a = stageXY(fromEl, .18), b = stageXY(toEl, .3);
  const star = document.createElement('div');
  star.className = 'flystar';
  star.innerHTML = starSVG(42);
  fx.appendChild(star);
  const S = 21;
  gsap.set(star, { x: a.x - S, y: a.y - S, scale: .3 });
  const mid = { x: (a.x + b.x) / 2 - S, y: Math.min(a.y, b.y) - 170 - S };
  const trail = setInterval(() => sparkle(star), 40);
  gsap.timeline({ onComplete: () => { clearInterval(trail); star.remove(); done?.(); } })
    .to(star, { scale: 1.2, duration: .25, ease: 'back.out(3)' })
    .to(star, { duration: 1, ease: 'power1.inOut', rotation: 540, motionPath: { path: [{ x: a.x - S, y: a.y - S }, mid, { x: b.x - S, y: b.y - S }], curviness: 1.3 } }, '<.05')
    .to(star, { scale: .2, opacity: 0, duration: .22, ease: 'power2.in' });
}

function sparkle(star) {
  const p = stageXY(star);
  const d = document.createElement('i');
  d.className = 'spk';
  fx.appendChild(d);
  gsap.fromTo(d, { x: p.x, y: p.y, scale: 1, opacity: .95 },
    { x: p.x + gsap.utils.random(-16, 16), y: p.y + gsap.utils.random(8, 30), scale: 0, opacity: 0, duration: .75, ease: 'power1.out', onComplete: () => d.remove() });
}

const hop = el => gsap.fromTo(el, { y: 0 }, { y: -22, duration: .22, yoyo: true, repeat: 3, ease: 'power1.out', transformOrigin: '50% 100%' });

// ── Líneas Nova ↔ ayudante (se recalculan cada cuadro, siguen las animaciones) ──
const linkPaths = new Map();
gsap.ticker.add(() => {
  const alive = new Set();
  for (const he of helpers.values()) {
    const st = stations.get(he.station);
    if (!st || he.returned) continue;
    alive.add(he.id);
    let path = linkPaths.get(he.id);
    if (!path) {
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      linksEl.appendChild(path);
      linkPaths.set(he.id, path);
    }
    const a = stageXY(st.img, .2), b = stageXY(he.img, .25);
    const cy = Math.min(a.y, b.y) - 70;
    path.setAttribute('d', `M${a.x} ${a.y} C${a.x} ${cy} ${b.x} ${cy} ${b.x} ${b.y}`);
    path.style.stroke = palette(he.palette).stops[1];
    path.style.opacity = getComputedStyle(he.el).opacity * .85;
  }
  for (const [id, path] of linkPaths) if (!alive.has(id)) { path.remove(); linkPaths.delete(id); }
});

// ── Río de actividad ────────────────────────────────────────────────────
function addChip(p) {
  const el = document.createElement('div');
  el.className = `chip k-${p.kind}${p.err ? ' err' : ''}`;
  el.innerHTML = `<span class="dot" style="background:${novaDot(p.palette)}"></span>${icon(p.err ? 'error' : p.icon)}<span class="cl">${esc(p.label)}</span><span class="cp">${esc(p.project)}</span>`;
  const state = Flip.getState(track.children);
  track.appendChild(el);
  while (track.children.length > 18) track.firstElementChild.remove();
  Flip.from(state, { duration: .5, ease: 'power2.out' });
  gsap.from(el, { x: 90, opacity: 0, duration: .6, ease: 'power3.out' });
}

function onPulse(p) {
  addChip(p);
  if (p.kind === 'delegate' && p.helperId) flights.add(p.helperId);
  const a = lastById.get(p.agentId);
  const st = stations.get(a?.kind === 'main' ? a.id : a ? rootOf(a, lastById) : p.agentId);
  if (st && (p.kind === 'tool' || p.kind === 'delegate')) {
    gsap.fromTo(st.bubble.querySelector('.ping'), { opacity: .9, scale: 1 }, { opacity: 0, scale: 1.12, duration: .7, ease: 'power2.out' });
  }
}

// ── Escenarios: lo que hay detrás de los escritorios ─────────────────────
// Números "al azar" pero fijos, para que el escenario no cambie en cada redibujo.
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function starsSVG(n, seed, maxY = 330) {
  const r = seeded(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `<circle class="${i % 3 ? '' : `sc-tw${i % 2 ? ' b' : ''}`}" cx="${(r() * 1920).toFixed(0)}" cy="${(r() * maxY).toFixed(0)}" r="${(0.6 + r() * 1.6).toFixed(1)}" fill="#fff" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
  }
  return out;
}
function sunSVG(x, y, night) {
  return night
    ? `<circle cx="${x}" cy="${y}" r="34" fill="#F1F5F9"/><circle cx="${x + 12}" cy="${y - 8}" r="30" fill="#0F172A" opacity=".55"/>`
    : `<circle cx="${x}" cy="${y}" r="60" fill="#FDE047" opacity=".25"/><circle cx="${x}" cy="${y}" r="40" fill="#FDE047"/>`;
}
function palmSVG(x, flip) {
  const s = flip ? -1 : 1;
  return `<g transform="translate(${x} 0) scale(${s} 1)"><path d="M0 330Q-12 230 40 130" stroke="#92400E" stroke-width="16" fill="none" stroke-linecap="round"/>` +
    `<g class="sc-sway">${['M40 130q-70 -18 -110 40', 'M40 130q70 -26 120 26', 'M40 130q-20 -70 -90 -80', 'M40 130q30 -72 110 -62', 'M40 130q4 -60 -10 -100']
      .map(d => `<path d="${d}" stroke="#16A34A" stroke-width="14" fill="none" stroke-linecap="round"/>`).join('')}` +
    `<circle cx="38" cy="140" r="9" fill="#7C2D12"/><circle cx="52" cy="136" r="8" fill="#7C2D12"/></g></g>`;
}
function sceneryBody(id, night) {
  if (id === 'playa') {
    const sea = night ? ['#1E3A8A', '#172554'] : ['#38BDF8', '#0369A1'];
    const wave = y => `<path class="sc-wave" d="M0 ${y}${'q30 -10 60 0t60 0'.repeat(18)}" stroke="#fff" stroke-width="3" fill="none" opacity=".5"/>`;
    return `<defs><linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sea[0]}"/><stop offset="1" stop-color="${sea[1]}"/></linearGradient></defs>` +
      (night ? starsSVG(70, 7, 200) : `<g class="sc-mist"><ellipse cx="420" cy="80" rx="90" ry="22" fill="#fff" opacity=".85"/><ellipse cx="480" cy="68" rx="60" ry="24" fill="#fff" opacity=".85"/><ellipse cx="1180" cy="120" rx="70" ry="16" fill="#fff" opacity=".7"/></g>`) +
      sunSVG(1560, 96, night) +
      `<path d="M0 232Q240 196 460 228T940 226V240H0Z" fill="${night ? '#14532D' : '#4ADE80'}" opacity=".7"/>` +
      `<rect x="0" y="230" width="1920" height="100" fill="url(#sea)"/>` + wave(258) + wave(286) + wave(312) +
      palmSVG(130, false) + palmSVG(1790, true);
  }
  if (id === 'espacio') {
    return `<defs><radialGradient id="pl" cx=".35" cy=".35"><stop offset="0" stop-color="#F9A8D4"/><stop offset="1" stop-color="#7C3AED"/></radialGradient></defs>` +
      starsSVG(170, 11) +
      `<ellipse cx="560" cy="150" rx="260" ry="60" fill="#7C3AED" opacity=".14"/>` +
      `<g><circle cx="1650" cy="130" r="74" fill="url(#pl)"/><ellipse cx="1650" cy="130" rx="128" ry="22" fill="none" stroke="#FDE68A" stroke-width="5" opacity=".85" transform="rotate(-16 1650 130)"/></g>` +
      `<circle cx="300" cy="86" r="26" fill="#CBD5E1"/><circle cx="292" cy="80" r="6" fill="#94A3B8"/><circle cx="308" cy="96" r="4" fill="#94A3B8"/>` +
      `<line class="sc-shoot" x1="1500" y1="40" x2="1580" y2="0" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
  }
  if (id === 'ciudad') {
    const r = seeded(23);
    let far = '', near = '', lights = '';
    for (let x = 0; x < 1920;) {
      const w = 60 + r() * 90, h = 90 + r() * 120;
      far += `<rect x="${x.toFixed(0)}" y="${(330 - h - 40).toFixed(0)}" width="${w.toFixed(0)}" height="${(h + 40).toFixed(0)}" fill="#4C1D95" opacity=".55"/>`;
      x += w + 6;
    }
    for (let x = -20; x < 1920;) {
      const w = 70 + r() * 110, h = 60 + r() * 140, top = 330 - h;
      near += `<rect x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="#1E1B4B"/>`;
      for (let wy = top + 14; wy < 318; wy += 22) for (let wx = x + 12; wx < x + w - 14; wx += 20) {
        if (r() < 0.38) lights += `<rect class="${r() < 0.3 ? `sc-tw${r() < .5 ? ' b' : ''}` : ''}" x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="9" height="11" fill="#FDE047" opacity=".85"/>`;
      }
      x += w + 8;
    }
    return starsSVG(40, 5, 120) + sunSVG(1640, 80, true) + far + near + lights;
  }
  if (id === 'bosque') {
    const tone = night ? ['#065F46', '#064E3B', '#022C22'] : ['#6EE7B7', '#34D399', '#059669'];
    const r = seeded(41);
    let trees = '';
    for (let x = 10; x < 1920; x += 70 + r() * 60) {
      const s = 0.8 + r() * 0.9, base = 330;
      trees += `<path d="M${x.toFixed(0)} ${(base - 120 * s).toFixed(0)}l${(44 * s).toFixed(0)} ${(120 * s).toFixed(0)}h${(-88 * s).toFixed(0)}z" fill="${night ? '#022C22' : '#047857'}"/>`;
    }
    return (night ? starsSVG(60, 3, 160) : '') + sunSVG(1500, 86, night) +
      `<path d="M0 210Q300 120 620 196T1260 170T1920 200V330H0Z" fill="${tone[0]}" opacity=".8"/>` +
      `<path d="M0 250Q360 190 760 240T1500 226T1920 246V330H0Z" fill="${tone[1]}"/>` + trees +
      `<g class="sc-mist"><ellipse cx="300" cy="250" rx="320" ry="26" fill="#fff" opacity=".35"/><ellipse cx="1300" cy="232" rx="380" ry="24" fill="#fff" opacity=".3"/></g>`;
  }
  return '';
}
function drawScenery() {
  for (const id of Object.keys(ESCENAS)) stage.classList.toggle(`escena-${id}`, prefs.scene === id);
  const night = stage.classList.contains('night');
  scenery.dataset.scene = prefs.scene;
  scenery.innerHTML = prefs.scene === 'oficina' ? '' :
    `<svg viewBox="0 0 1920 330" preserveAspectRatio="none" aria-hidden="true">${sceneryBody(prefs.scene, night)}</svg>`;
}

// Cambio con un fundido suave (a mano, o solo cada 10 min con "rotar").
function setScene(id) {
  if (!ESCENAS[id] || id === prefs.scene) return;
  gsap.to('#fade', { opacity: .9, duration: .5, ease: 'power1.in', onComplete: () => {
    prefs.scene = id;
    savePrefs();
    scenery.dataset.scene = '';
    tickClock();
    renderPrefs();
    gsap.to('#fade', { opacity: 0, duration: .9, ease: 'power1.out' });
  } });
}
function setSkin(id) {
  if (!SKINS[id] || id === prefs.skin) return;
  prefs.skin = id;
  savePrefs();
  for (const st of stations.values()) st.key = '';
  for (const he of helpers.values()) he.key = '';
  if (lastList.length) reconcile(lastList);
  q('#empty-nova img')?.setAttribute('src', petSrc({ id: 'main', kind: 'main', mood: 'sleeping', label: 'Durmiendo', palette: 'nova' }, 300));
  renderPrefs();
}
const nextOf = (keys, cur) => keys[(keys.indexOf(cur) + 1) % keys.length];
setInterval(() => { if (prefs.rotate) setScene(nextOf(Object.keys(ESCENAS), prefs.scene)); }, 10 * 60_000);

const prefsEl = q('#hq-prefs');
function renderPrefs() {
  q('#pref-skins').innerHTML = Object.entries(SKINS).map(([id, s]) =>
    `<button class="opt${prefs.skin === id ? ' on' : ''}" data-skin="${id}"><img alt="" src="${petSrc({ id: 'main', kind: 'main', mood: 'waiting', label: '', palette: 'nova' }, 44, id)}">${esc(s.name)}</button>`).join('');
  q('#pref-scenes').innerHTML = Object.entries(ESCENAS).map(([id, name]) =>
    `<button class="opt sc${prefs.scene === id ? ' on' : ''}" data-scene="${id}">${name}</button>`).join('') +
    `<button class="opt sc${prefs.rotate ? ' on' : ''}" data-rotate="1">${prefs.rotate ? '✓' : '○'} Cambiar solo cada 10 min</button>`;
}
prefsEl.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.skin) setSkin(b.dataset.skin);
  if (b.dataset.scene) setScene(b.dataset.scene);
  if (b.dataset.rotate) { prefs.rotate = !prefs.rotate; savePrefs(); renderPrefs(); }
});
q('#hq-gear').innerHTML = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/></svg>`;
q('#hq-gear').addEventListener('click', () => {
  prefsEl.hidden = !prefsEl.hidden;
  if (!prefsEl.hidden) { renderPrefs(); gsap.fromTo(prefsEl, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: 'power2.out' }); }
});
addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea')) return;
  if (e.key === 's' || e.key === 'S') setSkin(nextOf(Object.keys(SKINS), prefs.skin));
  if (e.key === 'e' || e.key === 'E') setScene(nextOf(Object.keys(ESCENAS), prefs.scene));
  if (e.key === 'Escape') prefsEl.hidden = true;
});

// ── Pared: reloj, cielo, fecha, totales ─────────────────────────────────
const ticks = q('#clock .ticks');
for (let i = 0; i < 12; i++) {
  const r = i * 30 * Math.PI / 180, l = i % 3 === 0 ? 8 : 4.5;
  ticks.insertAdjacentHTML('beforeend', `<line x1="${50 + Math.sin(r) * 40}" y1="${50 - Math.cos(r) * 40}" x2="${50 + Math.sin(r) * (40 - l)}" y2="${50 - Math.cos(r) * (40 - l)}"/>`);
}
q('#wm-star').innerHTML = starSVG(20);

function tickClock() {
  const d = new Date();
  const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
  q('#s-hand').style.transform = `rotate(${s * 6}deg)`;
  q('#m-hand').style.transform = `rotate(${m * 6}deg)`;
  q('#h-hand').style.transform = `rotate(${h * 30}deg)`;
  // Cielo con horario tropical (el mismo de la banda): amanecer ~6, atardecer ~18.
  const k = sky(d.getHours() + d.getMinutes() / 60);
  for (const w of document.querySelectorAll('.window')) { w.style.setProperty('--sky-top', k.top); w.style.setProperty('--sky-bottom', k.bottom); }
  // De noche (o en el espacio y la ciudad, que siempre son oscuros) las letras de la pared van claras.
  const dark = prefs.scene === 'espacio' || prefs.scene === 'ciudad' || k.night;
  if (dark !== stage.classList.contains('night') || !scenery.dataset.scene) {
    stage.classList.toggle('night', dark);
    drawScenery();
  }
  const date = d.toLocaleDateString('es-PR', { weekday: 'long', day: 'numeric', month: 'long' });
  q('#today').textContent = `${date[0].toUpperCase()}${date.slice(1)}`;
  for (const st of stations.values()) st.bs.textContent = st.showTime ? ago(Date.now() - st.since) : '';
}
tickClock();
setInterval(tickClock, 1000);

let claudeSkin = null;
function setStats(s) {
  // Tus horas, solo si las registras (/nova ajustes → Registrar mis horas).
  document.querySelectorAll('.stat.hours').forEach(el => { el.hidden = s.prefs?.hours === false; });
  // Sin horas, la fila minimizada deja a la vista cuántas Novas trabajan ahora.
  q('#st-working').parentElement.classList.toggle('keep', s.prefs?.hours === false);
  // La skin de /nova ajustes manda cuando cambia allá; la tecla S la cambia solo aquí hasta entonces.
  if (s.prefs?.skin && s.prefs.skin !== claudeSkin) { claudeSkin = s.prefs.skin; setSkin(s.prefs.skin); }
  const set = (id, v) => {
    const el = q(id), old = Number(el.textContent) || 0;
    if (old === v) return;
    const o = { n: old };
    gsap.to(o, { n: v, duration: .8, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.n); } });
  };
  set('#st-novas', s.novas ?? 0);
  set('#st-working', s.working ?? 0);
  set('#st-helpers', s.helpersNow ?? 0);
  set('#st-tools', s.tools ?? 0);
  set('#st-edits', s.edits ?? 0);
  set('#st-commands', s.commands ?? 0);
  // Tus horas de hoy (texto, sin animar): desde qué hora, abierto y trabajando.
  q('#st-open').textContent = s.uso?.today?.open ?? '0 min';
  q('#st-open-l').textContent = s.uso?.today ? `Con Claude hoy (desde ${s.uso.today.start})` : 'Con Claude hoy';
  q('#st-work').textContent = s.uso?.today?.work ?? '0 min';
  q('#st-work-l').textContent = s.uso?.week ? `Trabajando hoy · semana ${s.uso.week.work}` : 'Trabajando hoy';
}

// Nova durmiendo cuando la oficina está vacía.
q('#empty-nova').innerHTML = `<img alt="" src="${petSrc({ id: 'main', kind: 'main', mood: 'sleeping', label: 'Durmiendo', palette: 'nova' }, 300)}">`;

// ── Entrar a un escritorio: lo que tiene adentro ────────────────────────
const detail = q('#detail'), drawer = detail.querySelector('.drawer');
let openId = null, refresh = null, autoClose = null;
const clock = ms => new Date(ms).toLocaleTimeString('es-PR', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
const STATE_TONE = { working: '#ECFDF5', thinking: '#F5F3FF', talking: '#FFFBEB', error: '#FEF2F2', happy: '#ECFDF5', idle: '#F1F5F9', sleeping: '#EEF2FF' };

const hoursText = m => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`);
const dayRow = d => `<li class="day"><span class="tm">${esc(d.label)}</span><span class="tl">${esc(d.start)}–${esc(d.end)} · <b class="op">${esc(d.open)}</b> con Claude · <b>${esc(d.work)}</b> trabajando</span></li>`;

// ── Escribirle a un chat: el mensaje va al buzón de esa sesión y su Nova lo envía como tuyo ──
const chatEl = drawer.querySelector('.d-chat'), replyEl = drawer.querySelector('.d-reply');
const sendForm = drawer.querySelector('.d-send'), sendBox = sendForm.querySelector('textarea'), sentEl = drawer.querySelector('.d-sent');
const TOKEN = document.querySelector('meta[name="nova-token"]')?.content ?? '';
sendBox.addEventListener('keydown', e => {
  bumpAutoClose();
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendForm.requestSubmit(); }
});
sendForm.addEventListener('submit', async e => {
  e.preventDefault();
  const text = sendBox.value.trim();
  if (!text || !chatEl.dataset.session) return;
  sentEl.textContent = 'Enviando…';
  const r = await fetch('/api/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Nova-Token': TOKEN },
    body: JSON.stringify({ sessionId: chatEl.dataset.session, text }),
  }).then(x => x.json().then(j => ({ ok: x.ok, ...j }))).catch(() => ({ ok: false, error: 'no hay conexión con el servidor' }));
  if (!r.ok) { sentEl.textContent = `No se envió: ${r.error ?? 'error'}`; return; }
  sendBox.value = '';
  const s = chatEl.dataset.session;
  pending.set(s, [...(pending.get(s) ?? []), { text, at: Date.now() }]);
  loadDetail();
  sentEl.textContent = r.open
    ? 'Enviado. Nova lo escribe en el chat en unos segundos (si está trabajando, espera a que termine).'
    : 'Guardado. Ese chat no está abierto en Claude: se enviará cuando lo abras.';
});

// La conversación como un chat: tus mensajes a la derecha, Claude a la izquierda, y lo que enviaste
// desde aquí "en cola" hasta que aparece en el chat de verdad.
const pending = new Map(); // sessionId → [{ text, at }]
const md = t => esc(t).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
function renderChat(sessionId, chat) {
  const mine = (pending.get(sessionId) ?? []).filter(p => !chat.some(c => c.who === 'you' && c.at >= p.at - 60_000 && c.text.trim() === p.text));
  pending.set(sessionId, mine);
  const rows = chat.slice(-12).map(c => ({ ...c, queued: false })).concat(mine.map(p => ({ who: 'you', text: p.text, at: p.at, queued: true })));
  const key = JSON.stringify(rows.map(r => [r.who, r.at, r.text.length, r.queued]));
  if (replyEl.dataset.text === key) return;
  const atBottom = replyEl.scrollHeight - replyEl.scrollTop - replyEl.clientHeight < 40;
  replyEl.dataset.text = key;
  replyEl.innerHTML = rows.length
    ? rows.map(r => `<div class="msg ${r.who}${r.queued ? ' queued' : ''}"><div class="who">${r.who === 'you' ? 'Tú' : 'Claude'} · ${clock(r.at)}${r.queued ? ' · en cola' : ''}</div><div class="txt">${md(r.text)}</div></div>`).join('')
    : '<div class="d-empty">Todavía no hay mensajes en este chat.</div>';
  if (atBottom || rows.at(-1)?.queued) replyEl.scrollTop = replyEl.scrollHeight;
}

// Ir a ese chat en la app de Claude.
drawer.querySelector('.d-open').addEventListener('click', async () => {
  if (!chatEl.dataset.session) return;
  sentEl.textContent = 'Abriendo en Claude…';
  const r = await fetch('/api/open', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Nova-Token': TOKEN },
    body: JSON.stringify({ sessionId: chatEl.dataset.session }),
  }).then(x => x.json().then(j => ({ ok: x.ok, ...j }))).catch(() => ({ ok: false, error: 'no hay conexión con el servidor' }));
  sentEl.textContent = r.ok ? 'Abierto en Claude.' : `No se pudo abrir: ${r.error ?? 'error'}`;
});

/** Tus horas en general: el cajón de detalle con el resumen, las barras por día y la lista. */
async function loadHours() {
  chatEl.hidden = true;
  const r = await fetch('/api/uso').catch(() => null);
  if (!r?.ok) return closeDetail();
  const { days } = await r.json();
  const sum = (a, b, k) => days.slice(a, b).reduce((n, d) => n + d[k], 0);
  const img = drawer.querySelector('.d-nova');
  if (img.dataset.key !== 'uso') { img.dataset.key = 'uso'; img.src = petSrc({ id: 'main', kind: 'main', mood: 'waiting', palette: 'nova' }, 150); }
  drawer.querySelector('.d-proj').textContent = 'Tus horas con Claude';
  drawer.querySelector('.d-title').textContent = 'Todas tus sesiones juntas';
  const stateEl = drawer.querySelector('.d-state');
  stateEl.innerHTML = `${icon('clock')}Hoy ${esc(days[0]?.work ?? '—')} trabajando`;
  stateEl.style.background = '#FFFBEB'; stateEl.style.color = '#B45309';
  const kpi = (n, label) => `<div class="kpi ${label.startsWith('Con') ? 'op' : 'wk'}"><b>${n}</b><span>${label}</span></div>`;
  drawer.querySelector('.d-kpis').innerHTML =
    kpi(hoursText(sum(0, 7, 'openMin')), 'Con Claude esta semana') + kpi(hoursText(sum(0, 7, 'workMin')), 'Trabajando esta semana') +
    kpi(hoursText(sum(7, 14, 'workMin')), 'Trabajando la semana anterior') + kpi(hoursText(sum(0, 30, 'workMin')), 'Trabajando en 30 días');
  drawer.querySelector('.d-when').textContent = 'Verde: con Claude · naranja: trabajando';
  const used = days.filter(d => d.openMin > 0);
  drawer.querySelector('.d-timeline h3').textContent = 'Día por día';
  drawer.querySelector('.d-timeline ol').innerHTML = used.length ? used.map(dayRow).join('') : '<li class="d-empty">Aún no hay horas registradas.</li>';
  const top = Math.max(60, ...days.map(d => d.openMin));
  drawer.querySelector('.d-side').innerHTML = '<h3>Últimas dos semanas</h3><div class="d-bars">' + days.slice(0, 14).reverse().map(d =>
    `<div class="bar" title="${esc(d.label)}: ${esc(d.open)} · ${esc(d.work)} trabajando"><i style="height:${(d.openMin / top) * 100}%"></i><b style="height:${(d.workMin / top) * 100}%"></b><span>${esc(d.label.split(' ')[1] ?? d.label)}</span></div>`).join('') + '</div>';
}

const SIDE = drawer.querySelector('.d-side').innerHTML;
async function loadDetail() {
  if (!openId) return;
  if (openId === 'uso') return loadHours();
  if (!drawer.querySelector('.d-helpers')) drawer.querySelector('.d-side').innerHTML = SIDE;
  drawer.querySelector('.d-timeline h3').textContent = 'Línea de tiempo';
  const r = await fetch(`/api/session?id=${encodeURIComponent(openId)}`).catch(() => null);
  if (!r?.ok) return closeDetail();
  const d = await r.json();
  const pet = lastById.get(openId) ?? { id: openId, kind: 'main', mood: 'waiting', palette: 'nova' };
  const img = drawer.querySelector('.d-nova');
  const src = petSrc(pet, 150);
  if (img.dataset.key !== petKey(pet)) { img.dataset.key = petKey(pet); img.src = src; }
  drawer.querySelector('.d-proj').innerHTML = esc(d.project) + (d.worktree ? ' <span class="wt" style="font-size:16px;color:#64748B">· worktree</span>' : '');
  drawer.querySelector('.d-title').textContent = d.title || 'Sesión de Claude';
  const stateEl = drawer.querySelector('.d-state');
  stateEl.innerHTML = `${icon(d.icon)}${esc(d.label)}`;
  stateEl.style.background = STATE_TONE[d.state] ?? '#F1F5F9'; stateEl.style.color = '';
  const kpi = (n, label) => `<div class="kpi ${label.startsWith('Con') ? 'op' : 'wk'}"><b>${n}</b><span>${label}</span></div>`;
  drawer.querySelector('.d-kpis').innerHTML =
    kpi(d.counts.tools, 'Herramientas de Nova') + kpi(d.counts.edits, 'Ediciones') + kpi(d.counts.commands, 'Comandos') +
    kpi(d.counts.helpers, 'Ayudantes') + kpi(d.counts.helperTools, 'Herramientas de ayudantes');
  drawer.querySelector('.d-when').textContent =
    `Trabajando desde las ${clock(d.firstAt)} · última actividad hace ${ago(Date.now() - d.lastAt)}`;
  drawer.querySelector('.d-timeline ol').innerHTML = d.log.length
    ? d.log.map(s => {
        const c = palette(s.palette).stops[1];
        return `<li class="${s.err ? 'err' : ''}"><span class="tm">${clock(s.t)}</span><span class="ti" style="background:${c}">${icon(s.icon)}</span>` +
          `<span class="tl">${esc(s.label)}</span><span class="tb" style="background:${c}">${esc(s.by)}</span></li>`;
      }).join('')
    : '<li class="d-empty">Todavía no hay pasos en esta sesión.</li>';
  drawer.querySelector('.d-helpers').innerHTML = d.helpers.length
    ? d.helpers.map(h => `<div class="hrow"><span class="hd" style="background:${novaDot(h.palette)}"></span>` +
        `<div class="hm"><div class="hn">${esc(h.agentType)}</div><div class="ht">${esc(h.task || '—')} · ${h.tools} herramientas</div></div>` +
        `<span class="hs${h.active ? '' : ' done'}">${esc(h.active ? h.status : 'Terminó')}</span></div>`).join('')
    : '<div class="d-empty">Nova no ha delegado nada en esta sesión.</div>';
  chatEl.hidden = false;
  chatEl.dataset.session = d.sessionId || '';
  // Con "Chatear desde la pantalla grande" apagado en /nova ajustes: solo queda el botón para ir al chat.
  chatEl.classList.toggle('off', d.remoteChat === false);
  if (d.remoteChat !== false) renderChat(d.sessionId, d.chat ?? []);
  drawer.querySelector('.d-uso').innerHTML = d.uso?.length ? d.uso.map(dayRow).join('') : '<li class="d-empty">Sin horas registradas para esta sesión.</li>';
  drawer.querySelector('.d-files').innerHTML = d.files.length
    ? d.files.map(f => `<span>${esc(f)}</span>`).join('')
    : '<div class="d-empty">Sin archivos editados todavía.</div>';
}

function openDetail(id) {
  if (id !== openId) { sendBox.value = ''; sentEl.textContent = ''; replyEl.dataset.text = '\u0000'; }
  openId = id;
  detail.hidden = false;
  loadDetail();
  clearInterval(refresh);
  refresh = setInterval(loadDetail, 2000);
  gsap.fromTo(detail.querySelector('.backdrop'), { opacity: 0 }, { opacity: 1, duration: .3 });
  gsap.fromTo(drawer, { x: 1200 }, { x: 0, duration: .6, ease: 'power3.out' });
  bumpAutoClose();
}

function closeDetail() {
  if (!openId) return;
  openId = null;
  clearInterval(refresh);
  clearTimeout(autoClose);
  gsap.to(detail.querySelector('.backdrop'), { opacity: 0, duration: .3 });
  gsap.to(drawer, { x: 1200, duration: .45, ease: 'power3.in', onComplete: () => { detail.hidden = true; } });
}

// Es una pantalla de exhibición: si nadie la toca en 2 minutos, vuelve sola a la oficina.
function bumpAutoClose() {
  clearTimeout(autoClose);
  autoClose = setTimeout(closeDetail, 120_000);
}

stationsEl.addEventListener('click', e => {
  const el = e.target.closest('.station');
  const st = el && [...stations.values()].find(s => s.el === el);
  if (st) openDetail(st.id);
});
detail.querySelector('.backdrop').addEventListener('click', closeDetail);
detail.querySelector('.d-close').addEventListener('click', closeDetail);
drawer.addEventListener('pointermove', bumpAutoClose);
// Leer con la rueda o el trackpad también cuenta como estar usándolo.
drawer.addEventListener('wheel', bumpAutoClose, { passive: true });
addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });

// ── Conexión en vivo ────────────────────────────────────────────────────
const dot = q('#live-dot');
const es = new EventSource('/events');
es.addEventListener('open', () => dot.classList.remove('off'));
es.addEventListener('error', () => dot.classList.add('off'));
// ── Filtro de escritorios: todos, los activos (todo lo que no duerme) o los que duermen ──
const FILTERS = { all: 'Todos', active: 'Activos', sleeping: 'Durmiendo' };
let filter = 'all', rawList = [];
try { if (FILTERS[localStorage.getItem('hq-filter')]) filter = localStorage.getItem('hq-filter'); } catch { /* sin almacenamiento */ }
function filtered(list) {
  if (filter === 'all') return list;
  const byId = new Map(list.map(a => [a.id, a]));
  const keep = new Set(list.filter(a => a.kind === 'main' && (a.state === 'sleeping') === (filter === 'sleeping')).map(a => a.id));
  return list.filter(a => keep.has(a.kind === 'main' ? a.id : rootOf(a, byId)));
}
const filterEl = q('#hq-filter');
function renderFilter() {
  filterEl.innerHTML = Object.entries(FILTERS).map(([id, name]) =>
    `<button type="button" data-filter="${id}" class="${filter === id ? 'on' : ''}" aria-pressed="${filter === id}">${name}</button>`).join('');
}
filterEl.addEventListener('click', e => {
  const id = e.target.closest('[data-filter]')?.dataset.filter;
  if (!id || id === filter) return;
  filter = id;
  try { localStorage.setItem('hq-filter', id); } catch { /* ignore */ }
  renderFilter();
  reconcile(filtered(rawList));
});
renderFilter();

es.addEventListener('agents', e => { rawList = JSON.parse(e.data); reconcile(filtered(rawList)); });
es.addEventListener('stats', e => setStats(JSON.parse(e.data)));
es.addEventListener('pulse', e => onPulse(JSON.parse(e.data)));

// Pantalla oculta: GSAP en pausa (el navegador ya no pinta).
document.addEventListener('visibilitychange', () => (document.hidden ? gsap.globalTimeline.pause() : gsap.globalTimeline.resume()));

// Las casillas de horas abren tu historial.
document.querySelectorAll('.stat.hours').forEach(el => {
  el.addEventListener('click', () => openDetail('uso'));
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openDetail('uso'); });
});

// Minimizar las estadísticas: quedan siempre tus horas de hoy (con Claude y trabajando). Se recuerda en esta pantalla.
{
  const box = q('#stats'), btn = q('#stats-toggle');
  const apply = min => {
    box.classList.toggle('min', min);
    btn.textContent = min ? '+' : '−';
    btn.title = btn.ariaLabel = min ? 'Ver todas las estadísticas' : 'Minimizar estadísticas';
  };
  let min = false;
  try { min = localStorage.getItem('hq-stats-min') === '1'; } catch { /* sin almacenamiento */ }
  apply(min);
  btn.addEventListener('click', () => {
    min = !min;
    apply(min);
    try { localStorage.setItem('hq-stats-min', min ? '1' : '0'); } catch { /* ignore */ }
  });
}
