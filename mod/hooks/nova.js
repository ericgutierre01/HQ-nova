// Nova — la mascota de IA de WMSPos (bolita tornasol con estrella dorada). Única fuente de Nova para HQ Nova IA:
// la importan el mod (banda dentro de Claude) y la pantalla aparte (server.mjs la sirve como /nova.js).
// Funciones puras que devuelven texto SVG: sin DOM, sin Node.

const INK = '#053B30';
const STAR_GOLD = '#FBBF24';
const BODY = 'M50 26 C70 26 82 40 82 58 C82 75 68 87 50 87 C32 87 18 75 18 58 C18 40 30 26 50 26 Z';

// Nova original = agente principal. Las demás = ayudantes.
export const PALETTES = {
  nova:    { name: 'Nova',    stops: ['#6EE7B7', '#10B981', '#2DD4BF', '#38BDF8'], ink: INK,       shadow: '#065F46', glow: '#D1FAE5' },
  azul:    { name: 'Azul',    stops: ['#BAE6FD', '#0EA5E9', '#3B82F6', '#6366F1'], ink: '#0B1F4D', shadow: '#1E3A8A', glow: '#DBEAFE' },
  violeta: { name: 'Violeta', stops: ['#DDD6FE', '#8B5CF6', '#A78BFA', '#F0ABFC'], ink: '#2E1065', shadow: '#4C1D95', glow: '#EDE9FE' },
  ambar:   { name: 'Ámbar',   stops: ['#FDE68A', '#F59E0B', '#FBBF24', '#FB923C'], ink: '#451A03', shadow: '#78350F', glow: '#FEF3C7' },
  coral:   { name: 'Coral',   stops: ['#FECDD3', '#F43F5E', '#FB7185', '#FDBA74'], ink: '#4C0519', shadow: '#881337', glow: '#FFE4E6' },
  rosa:    { name: 'Rosa',    stops: ['#FBCFE8', '#EC4899', '#F472B6', '#A855F7'], ink: '#500724', shadow: '#831843', glow: '#FCE7F3' },
  lima:    { name: 'Lima',    stops: ['#D9F99D', '#84CC16', '#A3E635', '#2DD4BF'], ink: '#1A2E05', shadow: '#365314', glow: '#ECFCCB' },
  // Colores de las demás sesiones en la pantalla grande (los mismos de LOOKS en scene.ts).
  naranja: { name: 'Naranja', stops: ['#FED7AA', '#F97316', '#FB923C', '#F43F5E'], ink: '#431407', shadow: '#7C2D12', glow: '#FFEDD5' },
  morado:  { name: 'Morado',  stops: ['#E9D5FF', '#A855F7', '#8B5CF6', '#6366F1'], ink: '#3B0764', shadow: '#581C87', glow: '#F3E8FF' },
  dorado:  { name: 'Dorado',  stops: ['#FEF08A', '#EAB308', '#F59E0B', '#F97316'], ink: '#422006', shadow: '#713F12', glow: '#FEF9C3' },
  rojo:    { name: 'Rojo',    stops: ['#FECACA', '#EF4444', '#F43F5E', '#DB2777'], ink: '#450A0A', shadow: '#7F1D1D', glow: '#FEE2E2' },
};

const BY_TYPE = { Explore: 'azul', Plan: 'violeta', 'general-purpose': 'ambar' };
const ROTATION = ['coral', 'rosa', 'lima', 'azul', 'violeta', 'ambar'];

/** Color de una ayudante: fijo por tipo conocido, si no rota según una semilla (su id). */
export function paletteFor(agentType, seed = '') {
  if (BY_TYPE[agentType]) return BY_TYPE[agentType];
  let h = 0;
  for (const ch of String(agentType || '') + String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ROTATION[h % ROTATION.length];
}

export const STATES = ['idle', 'thinking', 'working', 'talking', 'happy', 'sleeping', 'walking', 'error'];

export const STATE_LABEL = {
  idle: 'En pausa', thinking: 'Pensando', working: 'Trabajando', talking: 'Respondiendo',
  happy: 'Terminó', sleeping: 'Durmiendo', walking: 'Caminando', error: 'Tropezó',
};

export function star(cx, cy, r) {
  const k = r * 0.2;
  return `M${cx} ${cy - r} C${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy} C${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r} C${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy} C${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r} Z`;
}

// Animaciones: las originales de globals.css (.nova-*) + las de las poses nuevas.
// Van una sola vez por documento (en la página) o dentro de cada <svg> suelto (style: true).
export const NOVA_CSS = `
.nova-live .nova-body{animation:nova-float 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.nova-live .nova-shadow{animation:nova-shadow 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.nova-live .nova-blink{animation:nova-blink 4.2s infinite;transform-box:fill-box;transform-origin:center}
.nova-live .nova-spark{animation:nova-twinkle 2.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.nova-live .nova-orbit{animation:nova-spin 1.3s linear infinite;transform-box:view-box;transform-origin:50px 56px}
.nova-live.nova-happy .nova-body{animation:nova-hop .55s ease-out 3,nova-float 3s ease-in-out 1.65s infinite}
.nova-live.nova-working .nova-body{animation:nova-type .34s ease-in-out infinite alternate}
.nova-live.nova-working .nova-glow{animation:nova-glow 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.nova-live .nova-bit{animation:nova-bit 1.5s ease-out infinite;transform-box:fill-box;transform-origin:center;opacity:0}
.nova-live .nova-bit.b2{animation-delay:.5s}.nova-live .nova-bit.b3{animation-delay:1s}
.nova-live .nova-talk-open{animation:nova-talk .38s steps(1) infinite}
.nova-live .nova-talk-shut{animation:nova-talk .38s steps(1) -.19s infinite}
.nova-live .nova-dot{animation:nova-dot 1.1s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.nova-live .nova-dot.d2{animation-delay:.15s}.nova-live .nova-dot.d3{animation-delay:.3s}
.nova-live.nova-sleeping .nova-body{animation:nova-breathe 4.6s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
.nova-live.nova-sleeping .nova-shadow{animation:nova-shadow 4.6s ease-in-out infinite}
.nova-live .nova-z{animation:nova-z 3.6s ease-out infinite;opacity:0;transform-box:fill-box;transform-origin:center}
.nova-live .nova-z.z2{animation-delay:1.2s}.nova-live .nova-z.z3{animation-delay:2.4s}
.nova-live.nova-walking .nova-body{animation:nova-walk .46s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 100%}
.nova-live.nova-walking .nova-shadow{animation:nova-shadow .46s ease-in-out infinite alternate}
.nova-live .nova-alert{animation:nova-alert .9s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes nova-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes nova-shadow{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.82)}}
@keyframes nova-blink{0%,90%,100%{transform:scaleY(1)}94%{transform:scaleY(.1)}}
@keyframes nova-twinkle{0%,100%{transform:scale(.85) rotate(0)}50%{transform:scale(1.15) rotate(20deg)}}
@keyframes nova-spin{to{transform:rotate(360deg)}}
@keyframes nova-hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-9px)}}
@keyframes nova-type{from{transform:translateY(0)}to{transform:translateY(-1.4px)}}
@keyframes nova-glow{0%,100%{opacity:.45}50%{opacity:.8}}
@keyframes nova-bit{0%{opacity:0;transform:translateY(0) scale(.6)}25%{opacity:1}100%{opacity:0;transform:translateY(-22px) scale(1)}}
@keyframes nova-talk{0%{opacity:1}50%{opacity:0}}
@keyframes nova-dot{0%,60%,100%{transform:translateY(0);opacity:.55}30%{transform:translateY(-2.5px);opacity:1}}
@keyframes nova-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.03,.97)}}
@keyframes nova-z{0%{opacity:0;transform:translate(0,0) scale(.6)}20%{opacity:.9}100%{opacity:0;transform:translate(10px,-22px) scale(1.15)}}
@keyframes nova-walk{from{transform:translateY(0) rotate(-4deg)}to{transform:translateY(-5px) rotate(4deg)}}
@keyframes nova-alert{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
@media (prefers-reduced-motion:reduce){.nova-live *{animation:none!important}}
`;

let uid = 0;

function gradient(id, p, spinSeconds) {
  const [a, b, c, d] = p.stops;
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".4" stop-color="${b}"/><stop offset=".72" stop-color="${c}"/><stop offset="1" stop-color="${d}"/><animateTransform attributeName="gradientTransform" type="rotate" values="0 .5 .5;360 .5 .5" dur="${spinSeconds}s" repeatCount="indefinite"/></linearGradient>`;
}

function eyes(ink, look, ry = 5.8, pupilDy = 0) {
  return `<g transform="${look}"><g class="nova-blink"><ellipse cx="40" cy="55" rx="4.3" ry="${ry}" fill="${ink}"/><ellipse cx="60" cy="55" rx="4.3" ry="${ry}" fill="${ink}"/><circle cx="41.4" cy="${53 + pupilDy}" r="1.4" fill="#fff"/><circle cx="61.4" cy="${53 + pupilDy}" r="1.4" fill="#fff"/></g></g>`;
}

function face(state, ink) {
  switch (state) {
    case 'happy':
      return `<path d="M35.5 56 Q40 50 44.5 56" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><path d="M55.5 56 Q60 50 64.5 56" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><path d="M43 63 Q50 71.5 57 63 Z" fill="${ink}"/>`;
    case 'thinking':
      return eyes(ink, 'translate(3 -3)') + `<circle cx="51" cy="65.5" r="2" fill="${ink}"/>`;
    case 'error':
      return eyes(ink, 'translate(0 2)') + `<path d="M43.5 66 Q46.75 63 50 66 T56.5 66" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'working':
      return eyes(ink, 'translate(0 2.5)', 5, 3.2) + `<path d="M46 64.2 Q50 65.8 54 64.2" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'talking':
      return eyes(ink, '') + `<ellipse class="nova-talk-open" cx="50" cy="65" rx="4.2" ry="3.4" fill="${ink}"/><path class="nova-talk-shut" d="M45 63.5 Q50 67.5 55 63.5" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`;
    case 'sleeping':
      return `<path d="M35.5 55.5 Q40 59.5 44.5 55.5" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/><path d="M55.5 55.5 Q60 59.5 64.5 55.5" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="50" cy="65.5" rx="1.9" ry="1.5" fill="${ink}"/>`;
    case 'walking':
      return eyes(ink, 'translate(2 0)') + `<path d="M45 63 Q50 68 55 63" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`;
    default:
      return eyes(ink, '') + `<path d="M45 63 Q50 68 55 63" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
}

function extrasBehind(state, p) {
  if (state === 'working') return `<ellipse class="nova-glow" cx="50" cy="70" rx="24" ry="12" fill="${p.glow}" opacity=".6"/>`;
  return '';
}

function extrasFront(state, p) {
  const ink = p.ink;
  switch (state) {
    case 'thinking':
      return `<g class="nova-orbit"><circle cx="50" cy="13" r="3.2" fill="${p.stops[1]}"/><circle cx="86" cy="40" r="2.6" fill="${p.stops[3]}"/><circle cx="14" cy="40" r="2.2" fill="${p.stops[2]}"/></g>`;
    case 'working':
      // Laptop vista por detrás (la tapa hacia nosotros) + "bits" que suben mientras teclea.
      return `<g><rect x="29" y="68" width="42" height="21" rx="3" fill="#EEF2F7" stroke="#94A3B8" stroke-width="1.2"/><path d="${star(50, 78.5, 3.6)}" fill="${STAR_GOLD}" opacity=".9"/><path d="M23 89 H77 L74 92.5 H26 Z" fill="#CBD5E1"/></g><rect class="nova-bit b1" x="21" y="70" width="3.4" height="3.4" rx="1" fill="${p.stops[1]}"/><rect class="nova-bit b2" x="75" y="67" width="3" height="3" rx="1" fill="${p.stops[3]}"/><rect class="nova-bit b3" x="17" y="62" width="2.6" height="2.6" rx=".8" fill="${p.stops[2]}"/>`;
    case 'talking':
      return `<g><rect x="2" y="3" width="31" height="17" rx="8.5" fill="#fff" stroke="#E5E7EB" stroke-width="1"/><path d="M21 19.4 L29 27 L26.5 19.4 Z" fill="#fff"/><circle class="nova-dot d1" cx="10.5" cy="11.5" r="2" fill="${p.stops[1]}"/><circle class="nova-dot d2" cx="17.5" cy="11.5" r="2" fill="${p.stops[1]}"/><circle class="nova-dot d3" cx="24.5" cy="11.5" r="2" fill="${p.stops[1]}"/></g>`;
    case 'sleeping':
      return `<g font-family="DM Sans, system-ui, sans-serif" font-weight="700" fill="${ink}"><text class="nova-z z1" x="72" y="36" font-size="9">z</text><text class="nova-z z2" x="72" y="36" font-size="11">z</text><text class="nova-z z3" x="72" y="36" font-size="8">z</text></g>`;
    case 'error':
      return `<g class="nova-alert"><circle cx="83" cy="32" r="7" fill="#EF4444"/><rect x="82" y="27" width="2" height="6.5" rx="1" fill="#fff"/><circle cx="83" cy="36.3" r="1.2" fill="#fff"/></g>`;
    default:
      return '';
  }
}

/**
 * Nova como texto SVG.
 * @param {string} state  idle | thinking | working | talking | happy | sleeping | walking | error
 * @param {object} [o]
 * @param {string} [o.palette='nova']  clave de PALETTES
 * @param {boolean} [o.cheeks=true]
 * @param {boolean} [o.style=false]    incrustar NOVA_CSS (para un <svg> suelto o el Svg de la app)
 * @param {boolean} [o.animated=true]
 * @param {number} [o.x] @param {number} [o.y] @param {number} [o.size]  para anidarla dentro de una escena SVG
 * @param {string} [o.idPrefix='nv']
 */
export function novaSVG(state = 'idle', o = {}) {
  const st = STATES.includes(state) ? state : 'idle';
  const p = PALETTES[o.palette] || PALETTES.nova;
  const id = `${o.idPrefix || 'nv'}${uid++}`;
  const cheeks = o.cheeks !== false
    ? `<ellipse cx="32.5" cy="63.5" rx="5" ry="3" fill="#F472B6" opacity=".45"/><ellipse cx="67.5" cy="63.5" rx="5" ry="3" fill="#F472B6" opacity=".45"/>`
    : '';
  const sparkOpacity = st === 'sleeping' ? ' opacity=".5"' : '';
  const sparkClass = st === 'sleeping' ? '' : ' class="nova-spark"';
  const tilt = st === 'error' ? 'rotate(-8 50 60)' : '';
  const box = o.size != null
    ? `x="${o.x ?? 0}" y="${o.y ?? 0}" width="${o.size}" height="${o.size}"`
    : `width="100%" height="100%"`;
  const cls = `nova${o.animated === false ? '' : ' nova-live'} nova-${st}`;
  const style = o.style ? `<style>${NOVA_CSS}</style>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ${box} class="${cls}" overflow="visible" aria-hidden="true">${style}<defs>${gradient(id, p, st === 'sleeping' ? 18 : 9)}</defs><ellipse class="nova-shadow" cx="50" cy="93" rx="21" ry="3.5" fill="${p.shadow}" opacity=".16"/>${extrasBehind(st, p)}<g transform="${tilt}"><g class="nova-body"><path d="${BODY}" fill="url(#${id})"/><ellipse cx="37" cy="39" rx="9" ry="4.6" fill="#fff" opacity=".38" transform="rotate(-28 37 39)"/>${cheeks}${face(st, p.ink)}<path${sparkClass} d="${star(63, 17, 10)}" fill="${STAR_GOLD}"${sparkOpacity}/></g></g>${extrasFront(st, p)}</svg>`;
}

/** La estrella dorada sola (la que Nova le pasa a su ayudante al delegar). */
export function starSVG(size = 24) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${star(12, 12, 11)}" fill="${STAR_GOLD}"/></svg>`;
}
