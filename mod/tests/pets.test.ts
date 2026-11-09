import { describe as group, expect, mock, test } from 'claude-code/testing'

import { describe, groups, moodFor, withTyping } from '../hooks/register'
import { scene } from '../hooks/scene'
import type { Pet } from '../types'

const pet = (id: string, focus: string, mood: Pet['mood'] = 'working'): Pet =>
  ({ id, name: id, mood, task: 't', focus })

group('nova-hq', () => {
  test('same file means working together', async () => {
    const g = groups([pet('a', '/x.ts'), pet('b', '/x.ts'), pet('c', '/y.ts')])
    expect(g.map(x => x.map(p => p.id))).toEqual([['a', 'b'], ['c']])
  })

  test('idle pets never group', async () => {
    const g = groups([pet('a', '', 'thinking'), pet('b', '', 'thinking')])
    expect(g.length).toBe(2)
  })

  test('describes a file edit', async () => {
    const d = describe({ tool: 'Edit', tool_use_id: '1', file_path: '/src/a.ts', old_string: 'a', new_string: 'b' } as never)
    expect(d).toEqual({ task: 'editando /src/a.ts', focus: '/src/a.ts' })
  })

  test('scene draws a heart for a group and escapes the tooltip', async () => {
    const svg = scene([{ ...pet('a', '/x'), task: 'a<b>&c' }, pet('b', '/x'), pet('c', '', 'waiting')]).source
    expect(svg.includes('class="heart"')).toBe(true)
    expect(svg.includes('a<b>')).toBe(false)
    expect(svg.includes('a&lt;b&gt;&amp;c')).toBe(true)
  })
})

test('a draft in the prompt is recorded without breaking the hint line', async ($, on) => {
  const clock = mock.clock(on)
  // The engine's own hint line, beneath the plugin.
  on('ui.render', ($, e) => h($.ui.resolve(e).Text, {}, 'hint') as never)
  const hint = await $.ui.mount({ plugin: 'nova-hq', surface: 'desktop', component: 'PromptHint', props: { isDraft: true, isWorking: false, hint: '' } })
  await hint.unmount()
  await clock.advance(1) // the deferred write runs without the host refusing it
  await clock.advance(1000) // and calms down once the keys stop
})

test('typing excites only a waiting Claude', async () => {
  const list = [pet('main', '', 'waiting'), pet('a', '/x')]
  expect(withTyping(list, true).map(p => p.mood)).toEqual(['peeking', 'working'])
  expect(withTyping(list, false).map(p => p.mood)).toEqual(['waiting', 'working'])
})

test('screen is green while writing a call and red while it runs', async () => {
  const writing = scene([{ ...pet('a', 'w a'), phase: 'writing' }]).source
  const running = scene([{ ...pet('a', '/x'), phase: 'running' }]).source
  expect(writing.includes('#3DDC84')).toBe(true)
  expect(running.includes('#FF4D4D')).toBe(true)
})

test('answering draws the whiteboard, not the monitor', async () => {
  const svg = scene([pet('a', '', 'answering')]).source
  expect(svg.includes('class="draw"')).toBe(true)
  expect(svg.includes('class="line"')).toBe(false)
})

test('reading draws a book and groups readers of the same file', async () => {
  const svg = scene([pet('a', '/x', 'reading')]).source
  expect(svg.includes('class="page"')).toBe(true)
  expect(groups([pet('a', '/x', 'reading'), pet('b', '/x', 'reading')]).length).toBe(1)
})

test('each tool gets its pose', async () => {
  const call = (tool: string, extra: object = {}) => moodFor({ tool, tool_use_id: '1', ...extra } as never)
  expect(call('WebSearch', { query: 'x' })).toBe('browsing')
  expect(call('AskUserQuestion')).toBe('asking')
  expect(call('Bash', { command: 'git commit -m x' })).toBe('shipping')
  expect(call('Bash', { command: 'npm test' })).toBe('working')
  expect(call('Agent')).toBe('reading')
})

test('every mood and flag draws', async () => {
  const moods = ['working', 'reading', 'browsing', 'answering', 'thinking', 'asking', 'shipping', 'tidying',
    'error', 'success', 'waiting', 'peeking', 'watching', 'sleeping', 'done'] as const
  const svg = scene(moods.map((m, i) => ({ ...pet(`p${i}`, '', m), sweat: true, coffee: true, mail: true, entering: i === 0, leaving: i === 1 }))).source
  for (const m of moods) expect(svg.includes(`class="${m}"`)).toBe(true)
  for (const c of ['enter', 'leave', 'fly', 'steam', 'paper']) expect(svg.includes(c)).toBe(true)
})

test('thinking keeps the screen on, in yellow', async () => {
  expect(scene([pet('a', '', 'thinking')]).source.includes('#FACC15')).toBe(true)
})

test('only a sleeping pet has a dark screen', async () => {
  const lit = ['reading', 'browsing', 'answering', 'asking', 'shipping', 'tidying', 'error', 'success', 'waiting', 'peeking'] as const
  for (const m of lit) expect(scene([pet('a', '', m)]).source.includes('#111118')).toBe(false)
  expect(scene([pet('a', '', 'sleeping')]).source.includes('class="led"')).toBe(true)
})
