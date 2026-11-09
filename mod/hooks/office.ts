// The rest of the band beside the desks: the office wall (window, clock, plant, shelf, the
// company logo), a strip of recent actions, and the task's progress with a small scoreboard.
// Each is its own drawing, so the band redraws only the part that changed.

import type { Act, Logo, Plan, PetSettings, Stats } from '../types'
import { esc, SCENE_HEIGHT } from './scene'

export type { Act, Logo, Plan, PetSettings, Stats }

export const DEFAULTS: PetSettings = {
  color: 'nova', size: 60, peek: true,
  window: true, clock: true, logo: true,
  history: true, progress: true, stats: true,
  sound: true, notify: true, hours: true, remoteChat: true, cubeMirror: true, cubeFollow: 'actual', cubeSize: 'mediana', cubeLabel: true, cubeBrt: 0,
  skin: 'clasica', scene: 'oficina',
}

const svg = (w: number, size: number, body: string, style = '') => ({
  source: `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * size / SCENE_HEIGHT)}" height="${size}" viewBox="0 0 ${w} ${SCENE_HEIGHT}">` +
    (style ? `<style>${style}</style>` : '') + body + '</svg>',
  width: Math.round(w * size / SCENE_HEIGHT),
  height: size,
})

const OFFICE_STYLE = `
.cloud{animation:drift 30s linear infinite}
@keyframes drift{from{transform:translateX(-30px)}to{transform:translateX(30px)}}
.twinkle{animation:tw 2.5s ease-in-out infinite}.twinkle.b{animation-delay:1.2s}
@keyframes tw{50%{opacity:.2}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
`

/**
 * The sky through the window for a local time, in hours with minutes (19.5 = 19:30).
 * shortcut: fixed tropical times (sun up ~6:15, down ~18:15, as in the Caribbean); a
 * latitude-aware sunrise needs the person's location, which the mod does not know.
 */
export function sky(hour: number): { top: string; bottom: string; night: boolean } {
  if (hour >= 5.75 && hour < 7) return { top: '#FDBA74', bottom: '#FDE68A', night: false }
  if (hour >= 7 && hour < 17.75) return { top: '#60A5FA', bottom: '#BAE6FD', night: false }
  if (hour >= 17.75 && hour < 18.75) return { top: '#7C3AED', bottom: '#FB923C', night: false }
  return { top: '#0B1026', bottom: '#1E293B', night: true }
}

/** HQ Nova IA: lo que se ve por las ventanas de la banda (la pantalla grande usa los mismos nombres). */
export const ESCENARIOS: Record<string, { name: string }> = {
  oficina: { name: 'Oficina' },
  playa: { name: 'Playa' },
  espacio: { name: 'Espacio' },
  ciudad: { name: 'Ciudad' },
  bosque: { name: 'Bosque' },
  auto: { name: 'Cambia cada hora' },
}
const ROTACION = ['oficina', 'playa', 'bosque', 'ciudad', 'espacio']
/** El escenario de verdad: 'auto' va rotando con la hora. */
export const escenarioDe = (scene: string, now: Date) => (scene === 'auto' ? ROTACION[now.getHours() % ROTACION.length]! : scene)

type Sky = { top: string; bottom: string; night: boolean }

/** El cielo y lo que hay detrás del cristal de una ventana, según el escenario y la hora. */
function windowView(scene: string, k: Sky, x: number, T: number, W: number, H: number, id: string): Sky & { body: string } {
  const sun = k.night
    ? `<circle cx="${x + 31}" cy="${T + 18}" r="7" fill="#F8FAFC"/><circle cx="${x + 34}" cy="${T + 16}" r="6" fill="url(#skyg${id})"/>`
    : `<circle cx="${x + 31}" cy="${T + 18}" r="8" fill="#FDE047"/>`
  const stars = `<circle class="twinkle" cx="${x + 11}" cy="${T + 14}" r="1.1" fill="#fff"/><circle class="twinkle b" cx="${x + 18}" cy="${T + 46}" r="1" fill="#fff"/>` +
    `<circle class="twinkle" cx="${x + 36}" cy="${T + 60}" r=".9" fill="#fff"/><circle class="twinkle b" cx="${x + 9}" cy="${T + 70}" r=".8" fill="#fff"/>`
  const cloud = `<g class="cloud"><ellipse cx="${x + 16}" cy="${T + 50}" rx="9" ry="3.8" fill="#fff" opacity=".9"/><ellipse cx="${x + 21}" cy="${T + 47}" rx="6.5" ry="4.2" fill="#fff" opacity=".9"/></g>`
  if (scene === 'playa') {
    const sea = k.night ? '#1E3A8A' : '#0EA5E9'
    return {
      ...k,
      body: sun + (k.night ? stars : '') +
        `<rect x="${x}" y="${T + 54}" width="${W}" height="${H - 54}" fill="${sea}"/>` +
        `<path class="cloud" d="M${x - 4} ${T + 60}q4 -2 8 0t8 0t8 0t8 0t8 0t8 0" stroke="#fff" stroke-width="1" fill="none" opacity=".7"/>` +
        `<rect x="${x}" y="${T + 72}" width="${W}" height="${H - 72}" fill="#FDE68A"/>` +
        `<path d="M${x + 9} ${T + H}Q${x + 7} ${T + 60} ${x + 15} ${T + 40}" stroke="#92400E" stroke-width="2.6" fill="none"/>` +
        `<path d="M${x + 15} ${T + 40}q-10 -2 -14 6M${x + 15} ${T + 40}q10 -3 14 4M${x + 15} ${T + 40}q-2 -9 -9 -11M${x + 15} ${T + 40}q4 -9 12 -9" stroke="#16A34A" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    }
  }
  if (scene === 'espacio') {
    return {
      top: '#0B1026', bottom: '#312E81', night: true,
      body: stars + `<circle class="twinkle b" cx="${x + 40}" cy="${T + 36}" r=".9" fill="#fff"/><circle class="twinkle" cx="${x + 6}" cy="${T + 30}" r="1" fill="#fff"/>` +
        `<circle cx="${x + 26}" cy="${T + 34}" r="9" fill="#F472B6"/><circle cx="${x + 23}" cy="${T + 31}" r="3" fill="#FBCFE8" opacity=".6"/>` +
        `<ellipse cx="${x + 26}" cy="${T + 34}" rx="15" ry="3.5" fill="none" stroke="#FDE68A" stroke-width="1.6" transform="rotate(-18 ${x + 26} ${T + 34})"/>` +
        `<circle cx="${x + 12}" cy="${T + 66}" r="4" fill="#94A3B8"/><circle cx="${x + 11}" cy="${T + 65}" r="1" fill="#64748B"/>`,
    }
  }
  if (scene === 'ciudad') {
    const night = k.night
    const bld = night ? '#1F2937' : '#64748B'
    const lit = (bx: number, by: number) => `<rect class="twinkle${(bx + by) % 2 ? ' b' : ''}" x="${bx}" y="${by}" width="2" height="2.4" fill="#FDE047"/>`
    return {
      top: night ? '#1E1B4B' : k.top, bottom: night ? '#7C3AED' : k.bottom, night,
      body: sun + (night ? stars : cloud) +
        `<rect x="${x + 2}" y="${T + 46}" width="12" height="${H - 46}" fill="${bld}"/><rect x="${x + 16}" y="${T + 34}" width="11" height="${H - 34}" fill="${bld}"/>` +
        `<rect x="${x + 29}" y="${T + 52}" width="15" height="${H - 52}" fill="${bld}"/>` +
        (night ? [lit(x + 5, T + 52), lit(x + 9, T + 60), lit(x + 19, T + 40), lit(x + 23, T + 50), lit(x + 19, T + 64), lit(x + 33, T + 58), lit(x + 39, T + 70)].join('') : ''),
    }
  }
  if (scene === 'bosque') {
    const tree = (tx: number, ty: number, s: number, c: string) => `<path d="M${tx} ${ty - 14 * s}l${7 * s} ${14 * s}h${-14 * s}z" fill="${c}"/>`
    return {
      ...k,
      body: sun + (k.night ? stars : '') +
        `<path d="M${x} ${T + 58}Q${x + 14} ${T + 44} ${x + 28} ${T + 56}T${x + W} ${T + 52}V${T + H}H${x}Z" fill="${k.night ? '#14532D' : '#22C55E'}"/>` +
        tree(x + 10, T + 70, 1.4, '#15803D') + tree(x + 30, T + 74, 1.7, '#166534') + tree(x + 40, T + 68, 1.1, '#15803D') +
        `<path d="M${x} ${T + 72}Q${x + 23} ${T + 64} ${x + W} ${T + 72}V${T + H}H${x}Z" fill="${k.night ? '#052E16' : '#16A34A'}"/>` +
        `<ellipse class="cloud" cx="${x + 20}" cy="${T + 62}" rx="16" ry="3" fill="#fff" opacity=".35"/>`,
    }
  }
  return { ...k, body: sun + (k.night ? stars : cloud) }
}

// Wall pieces share one bottom line (WALL) and one gap (GAP); the plant stands on the desks' floor.
const WALL = 70, GAP = 18, INK = '#8a8f98'

/** The plaque's default look: gold letters on navy. */
export const PLAQUE = { ink: '#FBBF24', paper: '#1e293b' }

/** What the wall shows: the chosen mode when its content exists, else nothing. */
export function logoShown(logo: Logo): 'none' | 'text' | 'image' {
  const mode = logo.mode ?? (logo.image ? 'image' : logo.text ? 'text' : 'none')
  return mode === 'image' && logo.image ? 'image' : mode === 'text' && logo.text ? 'text' : 'none'
}

/** The office wall, laid out left to right with whatever is switched on. */
export function officeSvg(s: PetSettings, logo: Logo, now: Date): { source: string; width: number; height: number } | undefined {
  const parts: string[] = []
  // A tall window, the whole height of the band, so the sky frames the office.
  const drawWindow = (x: number, id: string): number => {
    const W = 46, T = 4, H = 84
    const k = windowView(escenarioDe(s.scene, now), sky(now.getHours() + now.getMinutes() / 60), x, T, W, H, id)
    const body = k.body
    parts.push(
      `<defs><linearGradient id="skyg${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.top}"/><stop offset="1" stop-color="${k.bottom}"/></linearGradient>` +
      `<clipPath id="win${id}"><rect x="${x}" y="${T}" width="${W}" height="${H}" rx="3"/></clipPath></defs>` +
      `<rect x="${x}" y="${T}" width="${W}" height="${H}" rx="3" fill="url(#skyg${id})"/><g clip-path="url(#win${id})">${body}</g>` +
      `<rect x="${x}" y="${T}" width="${W}" height="${H}" rx="3" fill="none" stroke="${INK}" stroke-width="3"/>` +
      `<path d="M${x + W / 2} ${T}v${H}M${x} ${T + H / 2}h${W}" stroke="${INK}" stroke-width="2"/>` +
      `<rect x="${x - 3}" y="${T + H}" width="${W + 6}" height="3" rx="1" fill="${INK}"/>`)
    return x + W + GAP
  }
  let x = 6
  if (s.window) x = drawWindow(x, 'a')
  // Column 2: the clock hangs above the company's logo or name.
  const shown = logoShown(logo)
  const hasLogo = s.logo && shown !== 'none'
  if (s.clock || hasLogo) {
    const plaque = shown === 'image' ? 40 : hasLogo ? Math.max(48, logo.text!.length * 9 + 22) : 0
    const w = Math.max(s.clock ? 30 : 0, plaque)
    if (s.clock) {
      const h = now.getHours() % 12, m = now.getMinutes(), c = x + w / 2, cy = hasLogo ? 19 : WALL - 17
      const hand = (deg: number, len: number, sw: number, col: string) => {
        const r = (deg - 90) * Math.PI / 180
        return `<path d="M${c} ${cy}l${(Math.cos(r) * len).toFixed(1)} ${(Math.sin(r) * len).toFixed(1)}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`
      }
      parts.push(
        `<circle cx="${c}" cy="${cy}" r="14" fill="#f8fafc" stroke="#475569" stroke-width="2.5"/>` +
        [0, 3, 6, 9].map(i => { const r = i * 30 * Math.PI / 180; return `<circle cx="${(c + Math.sin(r) * 10.5).toFixed(1)}" cy="${(cy - Math.cos(r) * 10.5).toFixed(1)}" r="1.1" fill="#475569"/>` }).join('') +
        hand(h * 30 + m / 2, 6.5, 2.4, '#1e293b') + hand(m * 6, 10, 1.6, '#334155') + `<circle cx="${c}" cy="${cy}" r="1.5" fill="#e11d48"/>`)
    }
    if (hasLogo) {
      // The company's name is the wall's centrepiece, so it gets the biggest type in the band.
      const lx = x + (w - plaque) / 2, top = s.clock ? 42 : WALL - 40
      parts.push(shown === 'image'
        ? `<rect x="${lx}" y="${top}" width="40" height="40" rx="4" fill="#fff" stroke="#cbd5e1" stroke-width="1.5"/>` +
          `<image href="${esc(logo.image!)}" x="${lx + 3}" y="${top + 3}" width="34" height="34" preserveAspectRatio="xMidYMid meet"/>`
        : `<rect x="${lx}" y="${top + 6}" width="${plaque}" height="28" rx="5" fill="${esc(logo.paper ?? PLAQUE.paper)}" stroke="${esc(logo.ink ?? PLAQUE.ink)}" stroke-width="1.5"/>` +
          `<text x="${lx + plaque / 2}" y="${top + 25}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="${esc(logo.ink ?? PLAQUE.ink)}">${esc(logo.text!)}</text>`)
    }
    x += w + GAP
  }
  // A second window closes the wall symmetrically.
  if (s.window) x = drawWindow(x, 'b')
  return parts.length ? svg(x - GAP + 6, s.size, parts.join(''), OFFICE_STYLE) : undefined
}

/** One small icon per recent action, oldest left, newest right. */
const ICONS: Record<Act, (cx: number) => string> = {
  read: cx => `<rect x="${cx - 5}" y="44" width="10" height="12" rx="1.5" fill="#60A5FA"/><path d="M${cx - 3} 48h6M${cx - 3} 51h6M${cx - 3} 54h4" stroke="#fff" stroke-width="1"/>`,
  edit: cx => `<path d="M${cx - 5} 56l1.5 -5l8 -8l3.5 3.5l-8 8z" fill="#FBBF24"/><path d="M${cx - 5} 56l1.5 -5l3.5 3.5z" fill="#92400e"/>`,
  cmd: cx => `<rect x="${cx - 6}" y="44" width="12" height="12" rx="2" fill="#1e293b"/><path d="M${cx - 3.5} 47.5l2.5 2.5l-2.5 2.5M${cx} 53h3.5" stroke="#3DDC84" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
  search: cx => `<circle cx="${cx - 1}" cy="49" r="4" fill="none" stroke="#a78bfa" stroke-width="2"/><path d="M${cx + 2} 52l3.5 3.5" stroke="#a78bfa" stroke-width="2.2" stroke-linecap="round"/>`,
  web: cx => `<circle cx="${cx}" cy="50" r="6" fill="none" stroke="#38BDF8" stroke-width="1.5"/><ellipse cx="${cx}" cy="50" rx="2.6" ry="6" fill="none" stroke="#38BDF8" stroke-width="1.2"/><path d="M${cx - 6} 50h12" stroke="#38BDF8" stroke-width="1.2"/>`,
  agent: cx => `<circle cx="${cx}" cy="51" r="5.5" fill="#2DD4BF"/><circle cx="${cx - 2}" cy="50.5" r="1" fill="#053B30"/><circle cx="${cx + 2}" cy="50.5" r="1" fill="#053B30"/>`,
  ask: cx => `<circle cx="${cx}" cy="50" r="6" fill="#F59E0B"/><path d="M${cx} 46.5v4" stroke="#3a2410" stroke-width="1.8" stroke-linecap="round"/><circle cx="${cx}" cy="53.3" r="1" fill="#3a2410"/>`,
  skill: cx => `<path d="M${cx - 5} 56l7 -7" stroke="#C084FC" stroke-width="2" stroke-linecap="round"/><path d="M${cx + 3} 42q.6 3.4 4 4q-3.4.6 -4 4q-.6 -3.4 -4 -4q3.4 -.6 4 -4z" fill="#C084FC"/>`,
  ship: cx => `<path d="M${cx} 43l4 6h-2.5v6h-3v-6h-2.5z" fill="#A78BFA"/>`,
  ok: cx => `<path d="M${cx - 5} 50l3.5 3.5l7 -7" stroke="#3DDC84" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  fail: cx => `<path d="M${cx - 4} 46l8 8m0 -8l-8 8" stroke="#FF6B6B" stroke-width="2.4" stroke-linecap="round"/>`,
}

const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` }

/**
 * The task's readout, one compact block stacked in three centred rows: the plan ("2/5" and a
 * segmented bar: green done, yellow current, faint to do), then time · files · commands, then the last actions as icons.
 * Rows that are off or empty drop out and the rest close up.
 */
export function readoutSvg(plan: Plan | undefined, stats: Stats | undefined, acts: readonly Act[], s: PetSettings, now: number): { source: string; width: number; height: number } | undefined {
  const rows: { h: number; w: number; draw: (y: number) => string }[] = []
  const text = (x: number, y: number, size: number, weight: number, t: string) =>
    `<text x="${x}" y="${y}" font-family="system-ui,sans-serif" font-size="${size}" font-weight="${weight}" fill="${INK}">${t}</text>`
  if (s.progress && plan && plan.total > 0) {
    // A progress bar split in one segment per step: green done, the current one pulsing yellow.
    const count = `${Math.min(plan.done, plan.total)}/${plan.total}`, bar = 150, gap = 3
    const seg = (bar - gap * (plan.total - 1)) / plan.total, x0 = count.length * 12 + 10
    rows.push({ h: 26, w: x0 + bar, draw: y => text(0, y + 20, 22, 700, count) + Array.from({ length: plan.total }, (_, i) => {
      const x = x0 + i * (seg + gap)
      // Only a running turn has a step in progress: once it ends, nothing pulses.
      const current = i === plan.done && !stats?.end
      const fill = i < plan.done ? '#3DDC84' : current ? '#FACC15' : INK
      return `<rect${current ? ' class="now"' : ''} x="${x.toFixed(1)}" y="${y + 8}" width="${seg.toFixed(1)}" height="10" rx="5" fill="${fill}" opacity="${i < plan.done || current ? 1 : 0.3}"/>`
    }).join('') })
  }
  if (s.stats && stats?.start !== undefined) {
    // Icons with bare numbers, not words: a clock (time), a pencil (files), a prompt (commands).
    const icon = {
      time: (x: number, y: number) => `<circle cx="${x + 7}" cy="${y + 9}" r="6.5" fill="none" stroke="${INK}" stroke-width="1.8"/><path d="M${x + 7} ${y + 5}v4.5l3 2" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
      files: (x: number, y: number) => `<path d="M${x + 2} ${y + 16}l1.5 -4.5l8 -8l3 3l-8 8z" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>`,
      cmds: (x: number, y: number) => `<rect x="${x}" y="${y + 2}" width="15" height="13" rx="2.5" fill="none" stroke="${INK}" stroke-width="1.7"/><path d="M${x + 3.5} ${y + 6}l3 2.5l-3 2.5M${x + 8} ${y + 11.5}h4" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    }
    const items: [keyof typeof icon, string][] = [['time', mmss((stats.end ?? now) - stats.start)], ['files', String(stats.files)], ['cmds', String(stats.cmds)]]
    let w = 0
    const placed = items.map(([k, label]) => { const x = w; w += 20 + label.length * 9 + 14; return { k, label, x } })
    rows.push({ h: 20, w: w - 14, draw: y => placed.map(({ k, label, x }) => icon[k](x, y) + text(x + 20, y + 15, 16, 600, label)).join('') })
  }
  if (s.history && acts.length > 0) {
    // Oldest left and faded, the newest slides in at the right.
    const icon = (a: Act, i: number) => `<g transform="translate(${i * 17 - 2} ${-37})">${ICONS[a](10)}</g>`
    rows.push({ h: 26, w: acts.length * 17, draw: y => `<g transform="translate(0 ${y})">` +
      acts.map((a, i) => `<g opacity="${(0.35 + 0.65 * (i + 1) / acts.length).toFixed(2)}">${icon(a, i)}</g>`).join('') +
      `<g class="newest">${icon(acts[acts.length - 1]!, acts.length - 1)}</g></g>` })
  }
  if (rows.length === 0) return undefined
  // Centred in the band's height, the rows a steady 6 apart.
  let y = Math.max(0, (SCENE_HEIGHT - rows.reduce((t, r) => t + r.h, 0) - 6 * (rows.length - 1)) / 2)
  // Every row centred on the block, so the readout reads as one centred column.
  const width = Math.ceil(Math.max(...rows.map(r => r.w))) + 2
  const body = rows.map(r => { const out = `<g transform="translate(${((width - r.w) / 2).toFixed(1)} 0)">${r.draw(y)}</g>`; y += r.h + 6; return out }).join('')
  return svg(width, s.size, body,
    '.now{animation:pulse 1.2s ease-in-out infinite}@keyframes pulse{50%{opacity:.3}}.newest{animation:in .5s ease-out}@keyframes in{from{transform:translateX(8px);opacity:0}}@media (prefers-reduced-motion:reduce){*{animation:none!important}}')
}

/** Your hours, oldest day on the left: a faint bar for time open, a green one for time working. */
export function historySvg(days: { label: string; openMin: number; workMin: number }[]): { source: string; width: number; height: number } {
  const W = 30, H = 110, top = Math.max(60, ...days.map(d => d.openMin))
  const bars = [...days].reverse().map((d, i) => {
    const x = 8 + i * W
    const h = (m: number) => Math.round((m / top) * H)
    const tag = d.label === 'Hoy' || d.label === 'Ayer' ? d.label : d.label.split(' ')[0]!.slice(0, 2) + ' ' + d.label.split(' ')[1]
    return `<rect x="${x}" y="${10 + H - h(d.openMin)}" width="20" height="${h(d.openMin)}" rx="3" fill="#94A3B8" opacity=".35"><title>${esc(d.label)}</title></rect>` +
      `<rect x="${x + 4}" y="${10 + H - h(d.workMin)}" width="12" height="${h(d.workMin)}" rx="2" fill="#10B981"/>` +
      `<text x="${x + 10}" y="${H + 26}" font-size="9" text-anchor="middle" fill="${INK}" font-family="system-ui">${esc(tag)}</text>`
  }).join('')
  const width = 16 + days.length * W
  return { source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${H + 34}" width="${width}" height="${H + 34}">${bars}</svg>`, width, height: H + 34 }
}
