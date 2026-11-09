import { expect, test } from 'claude-code/testing'

import { DEFAULTS, officeSvg, readoutSvg, sky } from '../hooks/office'
import { actFor, planFrom } from '../hooks/register'

test('the plan follows update_plan and TodoWrite', async () => {
  const items = [{ status: 'completed' }, { status: 'in_progress' }, { status: 'pending' }]
  const p = planFrom('mcp__ccd_turn__update_plan', { items }, null)
  expect(p).toEqual({ total: 3, done: 1 })
  expect(planFrom('mcp__ccd_turn__update_plan', { advance: true }, p!)).toEqual({ total: 3, done: 2 })
  expect(planFrom('TodoWrite', { todos: items }, null)).toEqual({ total: 3, done: 1 })
  expect(planFrom('Read', {}, p!)).toBe(undefined)
})

test('each tool leaves its icon', async () => {
  expect(actFor('Edit', '')).toBe('edit')
  expect(actFor('Bash', 'git push')).toBe('ship')
  expect(actFor('Bash', 'npm test')).toBe('ok')
  expect(actFor('mcp__x__y', '')).toBe(undefined)
})

test('the office draws only what is switched on, the logo as image or plaque', async () => {
  const noon = new Date(2026, 0, 1, 12, 0)
  const all = officeSvg(DEFAULTS, { text: 'WMSPos' }, noon)!.source
  expect(all).toContain('WMSPos')
  expect(all).toContain('#FDE047') // the sun at noon
  expect(all.split('clip-path=').length).toBe(3) // two windows
  const night = officeSvg(DEFAULTS, {}, new Date(2026, 0, 1, 23, 0))!.source
  expect(night).toContain('twinkle')
  const img = officeSvg(DEFAULTS, { image: 'data:image/png;base64,AAAA' }, noon)!.source
  expect(img).toContain('<image href="data:image/png;base64,AAAA"')
  const off = { ...DEFAULTS, window: false, clock: false, logo: false }
  expect(officeSvg(off, { text: 'x' }, noon)).toBe(undefined)
  expect(sky(7).night).toBe(false)
  expect(sky(19.5).night).toBe(true) // 19:30 is already night
  expect(sky(18.25).night).toBe(false) // 18:15, dusk
})

test('the readout stacks plan, scoreboard and history, and hides when empty', async () => {
  expect(readoutSvg(undefined, { files: 0, cmds: 0 }, [], DEFAULTS, 0)).toBe(undefined)
  const r = readoutSvg({ done: 2, total: 5 }, { start: 0, end: 65_000, files: 3, cmds: 4 }, ['read', 'edit', 'fail'], DEFAULTS, 0)!.source
  expect(r).toContain('2/5')
  expect(r).toContain('1m 05s')
  expect(r).not.toContain('archivos') // icons, not words
  expect(r).toContain('#FF6B6B') // the failed action
  expect(readoutSvg(undefined, { files: 0, cmds: 0 }, ['read'], { ...DEFAULTS, history: false }, 0)).toBe(undefined)
})

test('wrap_up completes the bar, and nothing pulses once the turn ends', async () => {
  const four = { total: 5, done: 4 }
  expect(planFrom('mcp__ccd_turn__wrap_up', { recap: 'x' }, four)).toEqual({ total: 5, done: 5 })
  const running = readoutSvg(four, { start: 1, files: 0, cmds: 0 }, [], DEFAULTS, 2)!.source
  const ended = readoutSvg(four, { start: 1, end: 2, files: 0, cmds: 0 }, [], DEFAULTS, 2)!.source
  expect(running.includes('class="now"')).toBe(true)
  expect(ended.includes('class="now"')).toBe(false)
  expect(readoutSvg({ total: 5, done: 5 }, { start: 1, files: 0, cmds: 0 }, [], DEFAULTS, 2)!.source.includes('#FACC15')).toBe(false)
})
