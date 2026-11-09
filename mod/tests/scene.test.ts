import { expect, test } from 'claude-code/testing'
import { scene, hash } from '../hooks/scene'
import type { Pet, PetMood } from '../types'

const pet = (id: string, mood: PetMood = 'waiting', extra: Partial<Pet> = {}): Pet =>
  ({ id, name: id, mood, task: 't', focus: '', ...extra })

// The body fill of the only pet in the scene.
// The pet's gradient stops: the look its id picks.
const body = (svg: string) => svg.match(/<linearGradient id="nova\d+"[^>]*>(.*?)<animateTransform/)![1]!

test('a pet keeps its look whatever its place in the list', () => {
  const a = pet('alpha'), b = pet('beta')
  const first = scene([a, b]).source, second = scene([b, a]).source
  const alone = body(scene([a]).source)
  expect(first.includes(alone)).toBe(true)
  expect(second.includes(alone)).toBe(true)
})

test('a pet whose mood just changed pops', () => {
  const now = 1_000_000
  expect(scene([pet('a', 'working', { since: now - 100 })], { now }).source).toContain('class="fresh"')
  expect(scene([pet('a', 'working', { since: now - 2000 })], { now }).source.includes('class="fresh"')).toBe(false)
})

test('size sets the drawn height and scales the width', () => {
  const list = [pet('a'), pet('b', 'thinking')]
  const small = scene(list, { size: 30 }), big = scene(list, { size: 60 })
  expect(small.height).toBe(30)
  expect(Math.abs(small.width * 2 - big.width) <= 1).toBe(true)
})

test('no text glyphs and a reduced-motion fallback', () => {
  const moods: PetMood[] = ['working', 'reading', 'browsing', 'answering', 'thinking', 'asking', 'shipping', 'tidying',
    'error', 'success', 'waiting', 'peeking', 'watching', 'sleeping', 'done']
  const svg = scene(moods.map((m, i) => pet(`p${i}`, m, { mail: true, sweat: true, coffee: true }))).source
  expect(svg.includes('<text')).toBe(false)
  expect(svg).toContain('prefers-reduced-motion')
})

test('light theme gives white details an outline and pale ones a darker ink', async () => {
  const svg = scene([{ id: 'a', name: 'a', mood: 'thinking', task: '', focus: '' }]).source
  expect(svg).toContain('prefers-color-scheme:light')
  expect(svg).toContain('class="bub"')
})

test('a color dresses Claude only, in a Nova gradient with its star', async () => {
  const pets = [{ id: 'main', name: 'Claude', mood: 'waiting', task: '', focus: '' }, { id: 'sub', name: 's', mood: 'waiting', task: '', focus: '' }] as const
  const dressed = scene([...pets], { avatar: { color: 'naranja' } }).source
  expect(dressed).toContain('stop-color="#F97316"')
  expect(dressed).toContain('fill="#FBBF24"') // the star
  expect(scene([pets[1]], { avatar: { color: 'naranja' } }).source).toBe(scene([pets[1]]).source)
})
