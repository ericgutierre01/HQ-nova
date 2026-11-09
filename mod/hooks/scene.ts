import type { Pet } from '../types'
import { PALETTES as NOVA_PALETTES } from './nova.js'

// The animated SVG scene the desktop and mobile surfaces draw: one station
// (monitor + pets) per group of pets; a group of 2+ works on the same thing.

export const SCENE_HEIGHT = 100

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] ?? c)

/** Stable per id, so a pet keeps its look and rhythm when others come and go. */
export const hash = (id: string): number => {
  let h = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  // Mix the bits (murmur3 finalizer): short ids differ only in low bits, and looks are read from high ones.
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

const STYLE = `
.b,.eyes,.arm,.conf,.z,.heart,.line,.spark,.pu,.wander,.head,.wave,.scribble,.page,.move,.scratch,.puff,.drip,.pump,.launch,.sweep,.paper,.paper2,.steam,.fly,.tscope,.tele,.fresh,.spin,.squash,.rise2,.saver{transform-box:fill-box}
.b,.eyes,.pu,.wander{animation-delay:var(--d,0s)!important}
.pu{animation:look 5s ease-in-out infinite}
@keyframes look{0%,25%,100%{transform:translate(0,0)}35%,55%{transform:translate(-2px,0)}65%,85%{transform:translate(2px,-1px)}}
.working .pu{animation:none;transform:translate(2px,-.5px)}
.answering .pu{animation:none;transform:translate(1px,-2px)}
.reading .pu{animation:scan 1.4s ease-in-out infinite}
@keyframes scan{0%,100%{transform:translate(-1.5px,1.5px)}50%{transform:translate(1.5px,1.5px)}}
.reading .head{transform:translateY(1px) rotate(-3deg)}
.page{transform-origin:0 50%;animation:flip 4s ease-in-out infinite;animation-delay:var(--d,0s)}
@keyframes flip{0%,70%{transform:scaleX(1);opacity:1}85%{transform:scaleX(-1);opacity:1}86%,100%{transform:scaleX(-1);opacity:0}}
.scribble{transform-origin:0 100%;animation:scribble .28s ease-in-out infinite alternate}
@keyframes scribble{from{transform:translate(-2px,1px) rotate(-6deg)}to{transform:translate(3px,-1px) rotate(5deg)}}
.answering .b{animation:shift 1.2s ease-in-out infinite}
.draw{stroke-dasharray:70;stroke-dashoffset:70;animation:draw 3s linear infinite}
@keyframes draw{0%{stroke-dashoffset:70}55%,100%{stroke-dashoffset:0}}
.head{transform-origin:50% 100%}
.working .head{animation:nod 1.8s ease-in-out infinite;animation-delay:var(--d,0s)}
@keyframes nod{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
.thinking .head{animation:tilt 3s ease-in-out infinite}
@keyframes tilt{0%,100%{transform:rotate(0)}50%{transform:rotate(-8deg)}}
.thinking .wander,.done .wander{animation:wander 7s ease-in-out infinite}
@keyframes wander{0%,100%{transform:translateX(-3px)}50%{transform:translateX(3px)}}
.b{transform-origin:50% 100%}
.working .b{animation:bob .45s ease-in-out infinite alternate}
.b{animation:breathe 3.2s ease-in-out infinite}
.thinking .b{animation:sway 2.4s ease-in-out infinite}
.waiting .b{animation:shift 4s ease-in-out infinite}
@keyframes shift{0%,100%{transform:translateX(-1px)}50%{transform:translateX(1px) scale(1.01,.99)}}
.wave{transform-origin:0 0;animation:wave 6s ease-in-out infinite;animation-delay:var(--d,0s)}
@keyframes wave{0%,78%,100%{transform:rotate(0)}82%,90%{transform:rotate(-150deg)}86%,94%{transform:rotate(-125deg)}}
.peeking .b{animation:none;transform:translateY(2px)}
/* Reads along as you type, left to right, once (READ_MS in register.tsx), then holds at the end. */
.tscope{transform-origin:60% 0;animation:tscope 8s linear both}
@keyframes tscope{from{transform:rotate(-16deg)}to{transform:rotate(16deg)}}
.tele{animation:tele 1.1s ease-in-out infinite alternate}
@keyframes tele{from{transform:translateY(-2px)}to{transform:translateY(2px)}}
@keyframes rise{0%{opacity:0;transform:translateY(0) scale(.5)}20%{opacity:1}100%{opacity:0;transform:translateY(-22px) scale(1.1)}}
.done .b{animation:jump .9s ease-in-out infinite}
@keyframes bob{to{transform:translateY(-1.5px)}}
@keyframes sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
@keyframes breathe{50%{transform:scale(1.02,.97)}}
@keyframes jump{0%,100%{transform:translateY(0)}40%{transform:translateY(-14px) scale(1.05,.95)}}
.eyes{transform-origin:center;animation:blink var(--bd,4s) infinite}
@keyframes blink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
.arm{animation:tap .22s ease-in-out infinite alternate}.arm.r{animation-delay:.11s}
@keyframes tap{to{transform:translateY(-3px)}}
.dot{animation:dot 1.2s infinite}.d2{animation-delay:.2s}.d3{animation-delay:.4s}
@keyframes dot{0%,100%{opacity:.15}50%{opacity:1}}
.z{opacity:0;animation:z 3s linear infinite}.z2{animation-delay:1s}.z3{animation-delay:2s}
@keyframes z{0%{opacity:0;transform:translate(0,0) scale(.6)}25%{opacity:1}100%{opacity:0;transform:translate(16px,-30px) scale(1.3)}}
.conf{animation:conf 1.4s ease-out infinite}
@keyframes conf{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--dx),-46px) rotate(540deg);opacity:0}}
.line{transform-origin:left;animation:type 1.6s steps(10) infinite}
@keyframes type{0%{transform:scaleX(0)}70%,100%{transform:scaleX(1)}}
.heart{transform-origin:center;animation:beat .8s ease-in-out infinite}
@keyframes beat{50%{transform:scale(1.35)}}
.spark{transform-origin:center;animation:spark 1.1s ease-in-out infinite}
@keyframes spark{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1)}}
.glow{animation:glow 1.5s ease-in-out infinite alternate}
@keyframes glow{to{opacity:.55}}
.enter{animation:enter 1.3s ease-out both}
@keyframes enter{0%{transform:translateX(-50px);opacity:0}25%{opacity:1}100%{transform:translateX(0)}}
.enter .b{animation:bob .18s ease-in-out infinite alternate}
.leave{animation:leave 1.3s ease-in both}
@keyframes leave{0%{transform:translateX(0)}75%{opacity:1}100%{transform:translateX(55px);opacity:0}}
.leave .b{animation:bob .18s ease-in-out infinite alternate}
.paper{animation:hand 1.1s ease-out both}
@keyframes hand{0%{transform:translate(-55px,-6px) rotate(-30deg)}100%{transform:translate(0,0) rotate(0)}}
.error .b{animation:shake .5s ease-in-out infinite}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-1.5px)}75%{transform:translateX(1.5px)}}
.scratch{transform-origin:0 100%;animation:scratch .25s ease-in-out infinite alternate}
@keyframes scratch{from{transform:rotate(-8deg)}to{transform:rotate(8deg)}}
.puff{transform-origin:center;animation:puff 1.6s ease-in-out infinite}
@keyframes puff{0%,100%{transform:scale(.9);opacity:.85}50%{transform:scale(1.1);opacity:1}}
.drip{animation:drip 1.4s ease-in infinite}
@keyframes drip{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(9px);opacity:0}}
.success .b{animation:dance .5s ease-in-out infinite}
@keyframes dance{0%,100%{transform:rotate(-7deg) translateY(0)}50%{transform:rotate(7deg) translateY(-4px)}}
.pump{transform-origin:0 100%;animation:pump .25s ease-in-out infinite alternate}
@keyframes pump{from{transform:translateY(2px)}to{transform:translateY(-3px)}}
.asking .b{animation:bob .6s ease-in-out infinite alternate}
.asking .pu{animation:none}
.browsing .b{animation:sway 1.8s ease-in-out infinite}
.shipping .pu{animation:none;transform:translate(0,-2px)}
.launch{animation:launch 1.6s ease-in infinite}
@keyframes launch{0%{transform:translateY(0);opacity:1}80%{opacity:1}100%{transform:translateY(-14px);opacity:0}}
.sweep{transform-origin:50% 0;animation:sweepit .55s ease-in-out infinite alternate}
@keyframes sweepit{from{transform:rotate(-18deg)}to{transform:rotate(18deg)}}
.tidying .paper2{animation:rise 1.2s ease-out infinite}
.watching .b{transform-origin:50% 100%;animation:lounge 5s ease-in-out infinite}
@keyframes lounge{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(-3deg) scale(1.01,.99)}}
.watching .pu{animation:none;transform:translate(2.2px,-.5px)}
.munch{animation:munch 1.8s ease-in-out infinite}
@keyframes munch{0%,55%,100%{transform:translate(0,0)}70%,85%{transform:translate(-2px,-9px)}}
.film{animation:film 2.4s steps(1) infinite}
@keyframes film{0%{fill:#3a6fd8}25%{fill:#e76f51}50%{fill:#2a9d8f}75%{fill:#9b5de5}}
.film2{animation:film 3.1s steps(1) infinite reverse}
.sleeping .head{transform:rotate(14deg)}
.sleeping .b{animation:breathe 3s ease-in-out infinite}
.steam{animation:steam 2s ease-out infinite}
@keyframes steam{0%{transform:translateY(0);opacity:0}30%{opacity:.8}100%{transform:translateY(-8px);opacity:0}}
.fly{animation:fly 1.5s ease-in-out infinite}
@keyframes fly{0%{transform:translate(0,0) rotate(0);opacity:0}15%{opacity:1}100%{transform:translate(20px,-26px) rotate(15deg);opacity:0}}
.fresh{transform-origin:50% 100%;animation:pop .3s cubic-bezier(.25,1,.5,1)}
@keyframes pop{from{transform:translateY(-3px) scale(.9,1.1)}}
.scroll{animation:scroll 4s linear infinite}
@keyframes scroll{to{transform:translateY(-12.8px)}}
.spin{transform-origin:center;animation:spinx 1.6s linear infinite}
@keyframes spinx{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.1)}}
.draw2{stroke-dasharray:24;stroke-dashoffset:24;animation:draw2 3s linear infinite}
@keyframes draw2{0%{stroke-dashoffset:24}55%,100%{stroke-dashoffset:0}}
.blinkfast{animation:blinkfast .9s steps(1) infinite}
@keyframes blinkfast{50%{opacity:.15}}
.rise2{animation:rise2 1.2s ease-in-out infinite}
@keyframes rise2{0%{transform:translateY(2px);opacity:.4}60%,100%{transform:translateY(-1px);opacity:1}}
.squash{transform-origin:center;animation:squash 2.4s ease-in-out infinite}
@keyframes squash{0%,15%{transform:scaleY(1)}70%,100%{transform:scaleY(.3)}}
.tick{stroke-dasharray:16;stroke-dashoffset:16;animation:tick 2s ease-out infinite}
@keyframes tick{0%{stroke-dashoffset:16}40%,100%{stroke-dashoffset:0}}
.saver{animation:saver 7s linear infinite}
@keyframes saver{0%,100%{transform:translate(-4px,-6px)}25%{transform:translate(4px,-1px)}50%{transform:translate(-2px,5px)}75%{transform:translate(5px,3px)}}
.caret{animation:blinkfast 1s steps(1) infinite}
.led{animation:glow 1.6s ease-in-out infinite alternate}
@media (prefers-color-scheme:light){.bub{stroke:#c9c4d6;stroke-width:.8}.z{stroke:#6b5b95}.steam{stroke:#9a948a}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.z{opacity:1}.z2{transform:translate(6px,-10px)}.z3{transform:translate(12px,-20px)}.draw{stroke-dashoffset:0}.draw2,.tick{stroke-dashoffset:0}.line{transform:none}}
`

// Everyone is a Nova (the WMSPos assistant, src/wmspos-web/.../NovaAvatar.tsx): an iridescent
// little ball with a golden 4-point star, floating over the desk. Each palette is its gradient.
export const LOOKS = {
  color: {
    nova: ['#6EE7B7', '#10B981', '#2DD4BF', '#38BDF8'],
    naranja: ['#FED7AA', '#F97316', '#FB923C', '#F43F5E'],
    morado: ['#E9D5FF', '#A855F7', '#8B5CF6', '#6366F1'],
    rosa: ['#FBCFE8', '#EC4899', '#F472B6', '#A855F7'],
    azul: ['#BAE6FD', '#0EA5E9', '#3B82F6', '#6366F1'],
    dorado: ['#FEF08A', '#EAB308', '#F59E0B', '#F97316'],
    rojo: ['#FECACA', '#EF4444', '#F43F5E', '#DB2777'],
    // Nova HQ: los colores de las ayudantes por tipo (los mismos de nova.js y la pantalla grande).
    violeta: NOVA_PALETTES.violeta!.stops,
    ambar: NOVA_PALETTES.ambar!.stops,
    coral: NOVA_PALETTES.coral!.stops,
    lima: NOVA_PALETTES.lima!.stops,
  } as Record<string, readonly string[]>,
}
const PALETTES = Object.values(LOOKS.color)
/** Claude's palette by name; subagents get one from their id. */
export type Avatar = { color?: string }
// Nova's body (viewBox 100, centre 50,58) scaled by .6 and centred on the face: eyes at y -19.
const BODY = 'M0 -36.2C12 -36.2 19.2 -27.8 19.2 -17C19.2 -6.8 10.8 0.4 0 0.4C-10.8 0.4 -19.2 -6.8 -19.2 -17C-19.2 -27.8 -12 -36.2 0 -36.2Z'
/** Nova's star: four points with curved sides. */
const novaStar = (cx: number, cy: number, r: number) => {
  const k = r * 0.2
  return `M${cx} ${cy - r}C${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy}C${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r}` +
    `C${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy}C${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r}Z`
}
const ink = '#2b2240'

/**
 * HQ Nova IA: skins (lo que lleva puesto cada Nova). Se dibujan dentro de la cabeza, así se
 * mueven con ella; `star: false` quita la estrella de Nova cuando el sombrero la taparía.
 */
export const SKINS: Record<string, { name: string; star: boolean; svg: string }> = {
  clasica: { name: 'Clásica', star: true, svg: '' },
  pava: {
    name: 'Pava jíbara', star: false,
    svg: '<ellipse cx="0" cy="-31" rx="21" ry="4.2" fill="#E9C46A" stroke="#C89B3C" stroke-width=".8"/>' +
      '<path d="M-11 -31Q-11 -44 0 -44Q11 -44 11 -31Z" fill="#F2D483" stroke="#C89B3C" stroke-width=".8"/>' +
      '<path d="M-8 -38.5h16M-9.5 -41.5h19" stroke="#C89B3C" stroke-width=".5" opacity=".7"/>' +
      '<rect x="-11" y="-34.6" width="22" height="3" fill="#B45309"/>',
  },
  gorra: {
    name: 'Gorra', star: false,
    svg: '<path d="M-18 -26Q-18 -42 0 -42Q18 -42 18 -26Z" fill="#1F2937"/>' +
      '<path d="M8 -27Q20 -28.5 26 -24Q18 -22.5 8 -24Z" fill="#111827"/>' +
      `<path d="${novaStar(0, -33, 3.4)}" fill="#FBBF24"/><circle cx="0" cy="-42" r="1.6" fill="#374151"/>`,
  },
  audifonos: {
    name: 'Audífonos', star: true,
    svg: '<path d="M-19 -20Q-20 -46 0 -46Q20 -46 19 -20" stroke="#334155" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<rect x="-23.5" y="-26" width="7" height="12" rx="3.2" fill="#EF4444"/><rect x="16.5" y="-26" width="7" height="12" rx="3.2" fill="#EF4444"/>',
  },
  lentes: {
    name: 'Lentes de sol', star: true,
    svg: '<rect x="-11.5" y="-23.6" width="10" height="7" rx="2.8" fill="#111827"/><rect x="1.5" y="-23.6" width="10" height="7" rx="2.8" fill="#111827"/>' +
      '<path d="M-1.5 -21.2h3" stroke="#111827" stroke-width="1.6"/><path d="M-9.5 -22l2.5 0M3.5 -22l2.5 0" stroke="#fff" stroke-width=".9" opacity=".55" stroke-linecap="round"/>',
  },
  corona: {
    name: 'Corona', star: false,
    svg: '<path d="M-10 -33.5L-10 -42L-5 -37.5L0 -45.5L5 -37.5L10 -42L10 -33.5Z" fill="#FBBF24" stroke="#D97706" stroke-width=".8" stroke-linejoin="round"/>' +
      '<circle cx="0" cy="-37" r="1.5" fill="#EF4444"/><circle cx="-6" cy="-36" r="1.1" fill="#3B82F6"/><circle cx="6" cy="-36" r="1.1" fill="#10B981"/>',
  },
  mago: {
    name: 'Mago', star: false,
    svg: '<path d="M-14 -31L3 -60L14 -31Z" fill="#4C1D95"/><ellipse cx="0" cy="-31" rx="17" ry="3.6" fill="#5B21B6"/>' +
      `<path d="${novaStar(1, -42, 2.8)}" fill="#FBBF24"/><path d="${novaStar(5, -51, 1.8)}" fill="#FDE68A"/>`,
  },
  navidad: {
    name: 'Navidad', star: false,
    svg: '<path d="M-15 -30Q-5 -53 12 -47L16 -30Z" fill="#DC2626"/><rect x="-17" y="-33.5" width="34" height="5.5" rx="2.7" fill="#fff"/>' +
      '<circle cx="13" cy="-48" r="3.6" fill="#fff"/>',
  },
}
// A 4-point sparkle; paths stay crisp at 60px where a ✦ glyph turns to mush.
const star = (x: number, y: number, r: number, delay = 0) =>
  `<g transform="translate(${x} ${y}) scale(${r})"><path class="spark" d="M0 -1Q0 0 1 0Q0 0 0 1Q0 0 -1 0Q0 0 0 -1Z" fill="#FFE66D"${delay ? ` style="animation-delay:${delay}s"` : ''}/></g>`

/** A little Nova; at the desk typing when working. */
function petSvg(p: Pet, x: number, y: number, now: number, avatar: Avatar = {}, skinId = 'clasica'): string {
  const h = hash(p.id)
  const outfit = SKINS[p.skin ?? skinId] ?? SKINS.clasica!
  const stops = (avatar.color !== undefined ? LOOKS.color[avatar.color] : undefined) ?? (p.palette !== undefined ? LOOKS.color[p.palette] : undefined) ?? PALETTES[h % PALETTES.length]!
  // Little arms in the body's deep tone, hands in its light one.
  const color = stops[1]!
  const skin = stops[0]!
  const grad = `nova${h}`
  const arm = (d: string, hx: number, hy: number, cls = '') =>
    `<g class="${cls}"><path d="${d}" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${hx}" cy="${hy}" r="2.8" fill="${skin}"/></g>`
  const rest = arm('M-10 -6L-12 10', -12, 11)
  const arms = {
    working: arm('M-10 -6L-12 4L-6 6', -6, 6, 'arm') + arm('M10 -6L12 4L6 6', 6, 6, 'arm r'),
    thinking: rest + arm('M10 -6L12 2L4 -10', 4, -11),
    reading: arm('M-10 -6L-14 -1L-11 0', -11, 0) + arm('M10 -6L14 -1L11 0', 11, 0) +
      '<g transform="translate(0 -5)"><path d="M0 -1Q-7 -4 -13 -1L-13 12Q-7 9 0 12Z" fill="#7a4fbf"/><path d="M0 -1Q7 -4 13 -1L13 12Q7 9 0 12Z" fill="#7a4fbf"/>' +
      '<path d="M0 0Q-6 -2.5 -11.5 0L-11.5 10.5Q-6 8.5 0 10.5Z" fill="#fffdf6"/><path d="M0 0Q6 -2.5 11.5 0L11.5 10.5Q6 8.5 0 10.5Z" fill="#fffdf6"/>' +
      '<path d="M-10 3h7M-10 5.5h8M-10 8h6M3 3h7M3 5.5h6M3 8h7" stroke="#b9b3a3" stroke-width=".8"/>' +
      '<path class="page" d="M0 0Q6 -2.5 11.5 0L11.5 10.5Q6 8.5 0 10.5Z" fill="#f3efe2" stroke="#d8d2c0" stroke-width=".5"/>' +
      `<circle cx="-11" cy="6" r="2.8" fill="${skin}"/><circle cx="11" cy="6" r="2.8" fill="${skin}"/></g>`,
    answering: rest +
      `<g class="scribble">${arm('M10 -6L17 -18L15 -31', 15, -32)}<rect x="13.5" y="-38" width="3" height="6" rx="1" fill="#e63946"/></g>`,
    waiting: rest + arm('M10 -6L12 10', 12, 11, 'wave'),
    peeking: '',
    done: arm('M-10 -6L-17 -20', -17, -22) + arm('M10 -6L17 -20', 17, -22),
    browsing: arm('M-10 -6L-12 -4L-6 -16', -6, -17) + arm('M10 -6L12 -4L6 -16', 6, -17) +
      '<rect x="-9" y="-24" width="7" height="8" rx="2" fill="#333"/><rect x="2" y="-24" width="7" height="8" rx="2" fill="#333"/>' +
      '<rect x="-2" y="-22" width="4" height="3" fill="#333"/><circle cx="-5.5" cy="-24" r="2.6" fill="#7FC8F8" opacity=".85"/><circle cx="5.5" cy="-24" r="2.6" fill="#7FC8F8" opacity=".85"/>',
    asking: rest + arm('M10 -6L13 -20L13 -33', 13, -34),
    shipping: arm('M-10 -6L-14 -22L-6 -36', -6, -37) + arm('M10 -6L14 -22L6 -36', 6, -37) +
      '<g transform="translate(0 -14)"><g class="launch"><path d="M0 -40l4 7v8h-8v-8z" fill="#e8ecff"/><circle cx="0" cy="-31" r="1.8" fill="#4CC9F0"/>' +
      '<path d="M-4 -27l-3 4h3zM4 -27l3 4h-3z" fill="#e63946"/><path d="M-2.5 -25q2.5 7 5 0z" fill="#FFD166"/></g></g>',
    tidying: arm('M-10 -6L-4 -2', -4, -2) + arm('M10 -6L4 -8', 4, -8),
    error: rest + `<g class="scratch">${arm('M10 -6L16 -16L9 -27', 9, -28)}</g>`,
    success: rest + `<g class="pump">${arm('M10 -6L14 -20L14 -28', 14, -29)}</g>`,
    // Distracted: one hand in the popcorn bucket, the other bringing some to the mouth.
    watching: arm('M-10 -6L-14 2L-16 3', -16, 3) + `<g class="munch">${arm('M10 -6L11 1L6 -2', 6, -2)}</g>`,
    sleeping: rest + arm('M10 -6L12 10', 12, 11),
  }[p.mood]
  const closed = `<path d="M-6 -20q2 1.6 4 0M2 -20q2 1.6 4 0" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
  const eyes =
    p.mood === 'peeking'
      ? `<path d="M-6 -20q2 -1.4 4 0" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
      : p.mood === 'sleeping'
      ? closed
      : p.mood === 'error'
        ? `<path d="M-5.5 -21.5l3 3m0 -3l-3 3M2.5 -21.5l3 3m0 -3l-3 3" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`
      : p.mood === 'success' || p.mood === 'done'
        ? `<path d="M-6 -19q2 -2.4 4 0M2 -19q2 -2.4 4 0" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
        : `<g class="eyes"><g class="pu"><ellipse cx="-6" cy="-19" rx="2.6" ry="3.5" fill="${ink}"/><ellipse cx="6" cy="-19" rx="2.6" ry="3.5" fill="${ink}"/>` +
          `<circle cx="-5.2" cy="-20.2" r=".85" fill="#fff"/><circle cx="6.8" cy="-20.2" r=".85" fill="#fff"/></g></g>`
  const flat = `<path d="M-2 -14h4" stroke="${ink}" stroke-width="1.4" stroke-linecap="round"/>`
  const small = `<path d="M-2 -14q2 1.5 4 0" stroke="${ink}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
  const wide = `<path d="M-3 -15q3 2.5 6 0" stroke="${ink}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
  const mouth = {
    working: flat,
    thinking: `<circle cx="2" cy="-14" r="1.3" fill="${ink}"/>`,
    reading: `<circle cx="0" cy="-14" r="1.1" fill="${ink}"/>`,
    answering: small,
    waiting: wide,
    peeking: `<path d="M-2 -14q2.5 1.2 4.5 -.8" stroke="${ink}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
    done: `<path d="M-4 -15q4 5 8 0z" fill="${ink}"/>`,
    browsing: small,
    asking: wide,
    shipping: `<ellipse cx="0" cy="-14" rx="2" ry="2.4" fill="${ink}"/>`,
    tidying: flat,
    error: `<path d="M-4 -13q1 -2 2 0t2 0t2 0t2 0" stroke="${ink}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
    success: `<path d="M-4.5 -16q4.5 7 9 0z" fill="${ink}"/>`,
    watching: `<path d="M-2.5 -15q2.5 2.5 5 0" stroke="${ink}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
    sleeping: `<ellipse cx="1" cy="-14" rx="1.6" ry="1" fill="${ink}"/>`,
  }[p.mood]
  // Everyone is at the office: the desk is always there, the keyboard on it. The monitor
  // stands at the side, turned toward them, so both its screen and their face show; the
  // screen always says something about the mood, and is dark only while they sleep.
  const lines = (c: readonly string[]) =>
    [0, 1, 2].map(k => `<rect class="line" x="-6" y="${-7 + k * 5}" width="${12 * [0.8, 0.55, 0.7][k]!}" height="2.4" rx="1.2" fill="${c[k]}" style="animation-delay:${k * 0.5}s"/>`).join('')
  const check = (c: string) => `<path class="tick" d="M-5 -1l3.5 3.5l7 -7" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  const green = ['#3DDC84', '#9BF0BE', '#2FB86B'], red = ['#FF6B6B', '#FFA3A3', '#E03E3E']
  const screens: Record<Pet['mood'], { bg: string; edge: string; glow?: string; body: string }> = {
    // Green while a call is written, red while it runs.
    working: p.phase === 'writing'
      ? { bg: '#0d3320', edge: '#2e8b57', glow: '#3DDC84', body: lines(green) }
      : { bg: '#3a1212', edge: '#a83232', glow: '#FF4D4D', body: lines(red) },
    // Yellow between steps: on, waiting for the next move.
    thinking: { bg: '#3a3010', edge: '#a8862b', glow: '#FACC15', body: lines(['#FACC15', '#FDE68A', '#EAB308']) },
    // The file being read, scrolling up.
    reading: {
      bg: '#0f2340', edge: '#3b6fb0', glow: '#60A5FA',
      body: `<g clip-path="url(#scr${h})"><g class="scroll">${[0, 1, 2, 3, 4, 5, 6, 7].map(k => `<rect x="-6.5" y="${-8 + k * 3.2}" width="${[11, 7, 9, 5, 10, 8, 6, 11][k]}" height="1.4" rx=".7" fill="#93C5FD" opacity="${k % 3 ? 0.6 : 0.95}"/>`).join('')}</g></g>`,
    },
    // A browser: an address bar and a spinning globe.
    browsing: {
      bg: '#0b1e33', edge: '#0ea5e9', glow: '#38BDF8',
      body: '<rect x="-7.5" y="-9.5" width="15" height="2.6" rx="1.3" fill="#334155"/><circle cx="-5.8" cy="-8.2" r=".7" fill="#38BDF8"/>' +
        '<circle cx="0" cy="1.5" r="4.6" fill="none" stroke="#38BDF8" stroke-width="1.1"/><ellipse class="spin" cx="0" cy="1.5" rx="2" ry="4.6" fill="none" stroke="#38BDF8" stroke-width="1"/>' +
        '<path d="M-4.6 1.5h9.2" stroke="#38BDF8" stroke-width="1"/>',
    },
    // The answer, as on the whiteboard: notes being written.
    answering: {
      bg: '#f4f4ef', edge: '#8a8f98',
      body: [['M-6 -6q3 -2 6 0t6 0', '#1d3557', 0], ['M-6 -1q2.5 -1.5 5 0t5 0t2 0', '#1d3557', 0.8], ['M-6 4q3 -2 6 0', '#e63946', 1.6]]
        .map(([d, c, t]) => `<path class="draw2" d="${d}" stroke="${c}" stroke-width="1.4" fill="none" stroke-linecap="round" style="animation-delay:${t}s"/>`).join(''),
    },
    // A dialog with a blinking "!": it needs you.
    asking: {
      bg: '#3a2410', edge: '#d97706', glow: '#F59E0B',
      body: '<rect x="-6" y="-7" width="12" height="11" rx="1.6" fill="#F59E0B"/><g class="blinkfast"><path d="M0 -4.5v4.2" stroke="#3a2410" stroke-width="2" stroke-linecap="round"/><circle cx="0" cy="2" r="1.1" fill="#3a2410"/></g>',
    },
    // Uploading: an arrow up over a filling bar.
    shipping: {
      bg: '#24123f', edge: '#8b5cf6', glow: '#A78BFA',
      body: '<path class="rise2" d="M0 -8l4 4h-2.5v4h-3v-4h-2.5z" fill="#C4B5FD"/><rect x="-6.5" y="3" width="13" height="2.6" rx="1.3" fill="#3b2a5c"/>' +
        '<rect class="line" x="-6.5" y="3" width="13" height="2.6" rx="1.3" fill="#A78BFA" style="animation-duration:2s"/>',
    },
    // The conversation being compacted: lines squeezed together.
    tidying: {
      bg: '#1e2530', edge: '#64748b', glow: '#94A3B8',
      body: `<g class="squash">${[0, 1, 2, 3].map(k => `<rect x="-6" y="${-8 + k * 4.5}" width="12" height="1.8" rx=".9" fill="#CBD5E1"/>`).join('')}</g>`,
    },
    error: {
      bg: '#3a1212', edge: '#a83232', glow: '#FF4D4D',
      body: '<path class="blinkfast" d="M-4 -5l8 8m0 -8l-8 8" stroke="#FF6B6B" stroke-width="2.6" stroke-linecap="round"/>',
    },
    success: { bg: '#0d3320', edge: '#2e8b57', glow: '#3DDC84', body: check('#3DDC84') },
    done: { bg: '#0d3320', edge: '#2e8b57', glow: '#3DDC84', body: check('#3DDC84') },
    // A dim screensaver: Nova's star drifting around.
    waiting: { bg: '#141428', edge: '#3d3a66', body: `<path class="saver" d="${novaStar(0, 0, 2.6)}" fill="#FBBF24" opacity=".75"/>` },
    // Your text, as you type it: a line and a blinking caret.
    peeking: {
      bg: '#16161f', edge: '#3d3a66',
      body: '<rect class="line" x="-6.5" y="-1.5" width="8" height="2" rx="1" fill="#9aa0bd" style="animation-duration:2.4s"/><rect class="caret" x="2.5" y="-3" width="1.4" height="5" fill="#e8ecff"/>',
    },
    watching: {
      bg: '#1b1b25', edge: '#3d3a66', glow: '#7FC8F8',
      body: '<rect class="film" x="-7.5" y="-9.5" width="15" height="10" rx="1"/><rect class="film2" x="-7.5" y="0.5" width="15" height="5" rx="1"/>' +
        '<circle cx="2" cy="-5" r="1.6" fill="#fff" opacity=".85"/><path d="M2 -3.4v3" stroke="#fff" stroke-opacity=".85" stroke-width="1.2"/>' +
        '<rect x="-7.5" y="6.5" width="15" height="1" fill="#fff" opacity=".2"/><rect class="line" x="-7.5" y="6.5" width="9" height="1" fill="#e63946" style="animation-duration:20s"/>',
    },
    // Asleep: the screen dark, only the standby light breathing.
    sleeping: { bg: '#111118', edge: '#3d3a66', body: '<circle class="led" cx="6.5" cy="7" r=".9" fill="#F59E0B"/>' },
  }
  const scr = screens[p.mood]
  const screen =
    '<rect x="21" y="6.5" width="10" height="3" rx="1" fill="#3d3a66"/><rect x="25" y="-2" width="2" height="9" fill="#3d3a66"/>' +
    '<g transform="translate(26 -12) skewY(-14) scale(.9 1)">' +
    `<clipPath id="scr${h}"><rect x="-8.2" y="-10.2" width="16.4" height="18.4" rx="1.4"/></clipPath>` +
    (scr.glow ? `<rect class="glow" x="-11" y="-13" width="22" height="24" rx="3" fill="${scr.glow}" opacity=".25"/>` : '') +
    `<rect x="-9" y="-11" width="18" height="20" rx="2" fill="${scr.bg}" stroke="${scr.edge}" stroke-width="1.6"/>` +
    scr.body +
    '</g>'
  const desk =
    '<rect x="-24" y="9" width="58" height="5" rx="2" fill="#7a5a43"/><rect x="-20" y="14" width="3" height="9" fill="#5c4332"/><rect x="27" y="14" width="3" height="9" fill="#5c4332"/>' +
    screen +
    '<rect x="-13" y="5.5" width="26" height="4" rx="1.5" fill="#cfd3e6"/><path d="M-11 7.5h22" stroke="#9aa0bd" stroke-width="1" stroke-dasharray="1.5 1"/>'
  const extra = {
    working:
      star(-26, -27, 4.5) + star(25, -32.5, 3.5, 0.5),
    thinking:
      '<circle class="bub" cx="13" cy="-31" r="2" fill="#fff" opacity=".8"/><circle class="bub" cx="17" cy="-37" r="3" fill="#fff" opacity=".85"/>' +
      '<ellipse class="bub" cx="25" cy="-45" rx="14" ry="9" fill="#fff"/>' +
      '<circle class="dot" cx="19" cy="-45" r="2" fill="#6b5b95"/><circle class="dot d2" cx="25" cy="-45" r="2" fill="#6b5b95"/><circle class="dot d3" cx="31" cy="-45" r="2" fill="#6b5b95"/>',
    reading: '',
    answering: '',
    waiting: '',
    // A telescope at one eye, pointed down over the desk at what you type, sweeping side to side.
    peeking:
      '<g class="tscope">' +
      `<path d="M-10 -6L-6 2L1 0" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M10 -6L12 6L8 10" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      '<rect x="1.5" y="-23" width="5" height="4" rx="1" fill="#3b2f1e"/>' +
      '<rect x="1" y="-19" width="6" height="11" rx="1.5" fill="#b8860b"/>' +
      '<g class="tele"><rect x="-0.5" y="-9" width="9" height="10" rx="1.5" fill="#d4a017"/><rect x="-0.5" y="-9" width="9" height="2" fill="#8b6508"/>' +
      '<path d="M-3 1h14l2 13h-18z" fill="#e8b923"/><rect x="-3" y="1" width="14" height="2" fill="#8b6508"/>' +
      '<ellipse cx="4" cy="14" rx="9" ry="3" fill="#bfe6ff" stroke="#8b6508" stroke-width="1.2"/><path d="M-1 13q3 -2 7 -2" stroke="#fff" stroke-width="1.1" fill="none"/></g>' +
      `<circle cx="1" cy="0" r="2.8" fill="${skin}"/><circle cx="8" cy="10" r="2.8" fill="${skin}"/>` +
      '</g>',
    done: ['#FF6B6B', '#FFD166', '#06D6A0', '#4CC9F0', '#F72585', '#B5179E']
      .map((c, k) => `<rect class="conf" x="${-12 + k * 5}" y="-30" width="3.5" height="6" rx="1" fill="${c}" style="--dx:${(k - 2.5) * 12}px;animation-delay:${k * 0.12}s"/>`)
      .join(''),
    browsing: '',
    asking:
      '<circle class="bub" cx="24" cy="-34" r="7" fill="#fff"/><path d="M19 -29l-3 4l6 -2z" fill="#fff"/>' +
      '<g class="spark" style="animation-duration:1.6s"><path d="M21.6 -36.4q0 -2.6 2.4 -2.6t2.4 2.4q0 1.8 -2.4 2.4v1.4" stroke="#7a4fbf" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="-29.8" r="1.2" fill="#7a4fbf"/></g>',
    shipping: '',
    tidying:
      '<g class="sweep"><path d="M0 -12L0 3" stroke="#8b5a2b" stroke-width="2"/><path d="M-6 3h12l2 6h-16z" fill="#d4a017"/></g>' +
      '<rect class="paper2 bub" x="14" y="2" width="5" height="6" fill="#fff" opacity=".9"/><rect class="paper2 bub" x="-20" y="3" width="5" height="6" fill="#fff" opacity=".9" style="animation-delay:.6s"/>',
    error:
      '<g class="puff"><ellipse cx="-12" cy="-40" rx="7" ry="5" fill="#8e8e9a"/><ellipse cx="-5" cy="-43" rx="7" ry="6" fill="#8e8e9a"/><ellipse cx="2" cy="-40" rx="6" ry="5" fill="#8e8e9a"/></g>' +
      '<path class="drip" d="M-12 -26q-2 3 0 4.5q2 -1.5 0 -4.5z" fill="#7FC8F8"/>',
    success:
      star(-22, -31, 4.5) + star(23.5, -41, 4, 0.4),
    // A striped popcorn bucket on the desk.
    watching:
      '<g transform="translate(-17 1)"><path d="M-4.5 0h9l-1.2 8h-6.6z" fill="#fff"/><path d="M-2.6 0l.5 8M0 0v8M2.6 0l-.5 8" stroke="#e63946" stroke-width="1.3"/>' +
      '<circle cx="-2.5" cy="-.6" r="1.8" fill="#fff3c4"/><circle cx="0.5" cy="-1.4" r="2" fill="#fff3c4"/><circle cx="3" cy="-.5" r="1.7" fill="#fff3c4"/></g>',
    sleeping:
      ([['z', 5], ['z z2', 6], ['z z3', 7.5]] as const).map(([c, s]) =>
        `<path class="${c}" d="M12 ${-30 - s}h${s}l-${s} ${s}h${s}" stroke="#cfd8ff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join(''),
  }[p.mood]
  // Extras that ride on any mood.
  const flags =
    (p.sweat ? '<path class="drip" d="M12 -27q-2 3 0 4.5q2 -1.5 0 -4.5z" fill="#7FC8F8"/>' : '') +
    (p.coffee
      ? '<g transform="translate(-19 1)"><rect x="-3" y="0" width="6" height="8" rx="1.5" fill="#f4f4ef"/><path d="M3 2q3 0 3 2.5t-3 2.5" stroke="#f4f4ef" stroke-width="1.3" fill="none"/>' +
        '<rect x="-2" y="1" width="4" height="2" fill="#6f4e37"/>' +
        '<path class="steam" d="M-1 -1q-1.5 -2 0 -4" stroke="#ddd" stroke-width="1" fill="none"/><path class="steam" style="animation-delay:.7s" d="M1.5 -1q1.5 -2 0 -4" stroke="#ddd" stroke-width="1" fill="none"/></g>'
      : '') +
    // A magic wand with a sparkle by the head while it works with a skill.
    (p.skill ? '<g transform="translate(-27 -22)"><path d="M0 12l10 -10" stroke="#4C1D95" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M0 12l10 -10" stroke="#E9D5FF" stroke-width="2.2" stroke-linecap="round"/>' +
      `<path d="${novaStar(11, 1, 6)}" fill="#F0ABFC" stroke="#7E22CE" stroke-width=".8"/>${star(2, -6, 2.4, 0.4)}</g>` : '') +
    (p.mail ? '<g class="fly"><rect class="bub" x="8" y="-10" width="10" height="7" rx="1" fill="#fff"/><path d="M8 -10l5 4l5 -4" stroke="#7a4fbf" stroke-width="1" fill="none"/></g>' : '') +
    (p.entering ? '<g class="paper"><rect class="bub" x="-4" y="-2" width="8" height="10" rx="1" fill="#fff"/><path d="M-2 1h4M-2 3.5h4M-2 6h3" stroke="#aaa" stroke-width=".7"/></g>' : '')

  const move = `move${p.entering ? ' enter' : ''}${p.leaving ? ' leave' : ''}`
  // The pop sits on its own wrapper so the mood's .b animation resumes after it.
  const fresh = p.since !== undefined && now - p.since < 600
  return (
    `<g transform="translate(${x} ${y})" class="${p.mood}" style="--d:${-(h % 37) / 10}s;--bd:${4 + (h >>> 16) % 4}s"><title>${esc(`${p.name}: ${p.task}`)}</title>` +
    `<g class="${move}"><g class="wander">` +
    `<ellipse cx="0" cy="23" rx="16" ry="3" fill="#000" opacity=".18"/>` +
    `<g${fresh ? ' class="fresh"' : ''}><g class="b">` +
    `<defs><linearGradient id="${grad}" x1="0" y1="0" x2="1" y2="1">${stops.map((c, i) => `<stop offset="${[0, 0.4, 0.72, 1][i]}" stop-color="${c}"/>`).join('')}` +
    `<animateTransform attributeName="gradientTransform" type="rotate" values="0 .5 .5;360 .5 .5" dur="9s" repeatCount="indefinite"/></linearGradient></defs>` +
    `<g class="head"><path d="${BODY}" fill="url(#${grad})"/>` +
    `<ellipse cx="-7.8" cy="-28.6" rx="5.4" ry="2.8" fill="#fff" opacity=".38" transform="rotate(-28 -7.8 -28.6)"/>` +
    `<ellipse cx="-10.5" cy="-13.7" rx="3" ry="1.8" fill="#F472B6" opacity=".45"/><ellipse cx="10.5" cy="-13.7" rx="3" ry="1.8" fill="#F472B6" opacity=".45"/>` +
    eyes + mouth + (outfit.star ? `<path d="${novaStar(7.8, -41.6, 6)}" fill="#FBBF24"/>` : '') + outfit.svg + '</g>' +
    arms +
    `</g></g></g></g>${desk}<g class="${move}"><g class="wander">${extra}${flags}</g></g></g>`
  )
}

function stationSvg(group: Pet[], x: number, w: number, now: number, avatar: Avatar, skin = 'clasica'): string {
  const lead = group[0]
  if (!lead) return ''
  const mw = w - 24
  // The whiteboard hangs on the wall behind, for writing the answer.
  const board =
    lead.mood === 'answering'
      ? `<rect x="${x + 12}" y="4" width="${mw}" height="30" rx="3" fill="#f4f4ef" stroke="#8a8f98" stroke-width="2.5"/>` +
        `<rect x="${x + 16}" y="34" width="${mw - 8}" height="2.5" rx="1" fill="#8a8f98"/>` +
        [
          { d: `M${x + 18} 12q6 -4 12 0t12 0t12 0`, c: '#1d3557', delay: 0 },
          { d: `M${x + 18} 20q5 -3 10 0t10 0t10 0t8 0`, c: '#1d3557', delay: 0.8 },
          { d: `M${x + 18} 28q6 -4 12 0t12 0`, c: '#e63946', delay: 1.6 },
        ].map(l => `<path class="draw" d="${l.d}" stroke="${l.c}" stroke-width="2" fill="none" stroke-linecap="round" style="animation-delay:${l.delay}s"/>`).join('')
      : ''
  const step = w / group.length
  const pets = group.map((p, i) => petSvg(p, x + step * (i + 0.5), 70, now, p.id === 'main' ? avatar : {}, skin)).join('')
  const hearts = group.slice(1).map((_, i) =>
    `<g transform="translate(${x + step * (i + 1)} 50)"><path class="heart" d="M0 4C-6 -2 -8 -6 -4 -8C-2 -9 0 -7 0 -5C0 -7 2 -9 4 -8C8 -6 6 -2 0 4Z" fill="#F72585"/></g>`).join('')
  return board + pets + hearts
}

/** Busy pets grouped by focus: a group of two or more works together. */
export const groups = (list: Pet[]): Pet[][] => {
  const by = new Map<string, Pet[]>()
  for (const p of list) {
    // No focus, nothing shared: an empty focus never puts two pets together.
    const k = (p.mood === 'working' || p.mood === 'reading') && p.focus ? p.focus : `solo ${p.id}`
    by.set(k, [...(by.get(k) ?? []), p])
  }
  return [...by.values()]
}

/** The SVG and the CSS-pixel size to draw it at (the surface would stretch it otherwise). */
// `avatar` dresses the main pet (id 'main', Claude); subagents keep the look their id picks.
// `skin` (HQ Nova IA) viste a todas con la misma skin, salvo la que traiga la suya en `p.skin`.
export function scene(list: Pet[], opts: { size?: number; now?: number; avatar?: Avatar; skin?: string } = {}): { source: string; width: number; height: number } {
  const { size = 60, now = Date.now(), avatar = {}, skin = 'clasica' } = opts
  let x = 4
  const parts: string[] = []
  for (const g of groups(list)) {
    const w = Math.max(84, 66 * g.length + 18)
    parts.push(stationSvg(g, x, w, now, avatar, skin))
    x += w + 4
  }
  const width = x
  const px = { width: Math.round(width * size / SCENE_HEIGHT), height: size }
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px.width}" height="${px.height}" viewBox="0 0 ${width} ${SCENE_HEIGHT}">` +
    `<style>${STYLE}</style>` +
    parts.join('') +
    `</svg>`
  return { source, ...px }
}
