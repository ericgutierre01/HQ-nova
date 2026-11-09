import { expect, test } from 'claude-code/testing'

import { dayKey, daySummary, history, hours, liveSessions, mark, markFile, sessionColor, slotColor, touchSession, weekTotals } from '../hooks/usage.js'

const at = (h: number, m: number, day = 21) => new Date(2026, 9, day, h, m, 30).getTime()

test('minutes open and working add up per day, and two chats count once', async () => {
  let log = mark({}, at(8, 12), false)!
  log = mark(log, at(9, 0), true)!
  expect(mark(log, at(9, 0), true)).toBe(null) // the same minute from another chat
  log = mark(log, at(19, 40), false)!
  expect(daySummary(log[dayKey(at(12, 0))])).toEqual({ start: '8:12', end: '19:40', open: '3 min', work: '1 min' })
  expect(weekTotals(mark(log, at(10, 0, 20), true)!, at(12, 0))).toEqual({ open: '4 min', work: '2 min' })
})

test('hours read well and old days are dropped', async () => {
  expect(hours(125)).toBe('2 h 05 min')
  let log = {}
  for (let d = 1; d <= 40; d++) log = mark(log, new Date(2026, 0, d, 10, 0).getTime(), false)!
  expect(Object.keys(log).length).toBe(31)
})

test('the shared file keeps each chat apart and forgets chats idle for a week', async () => {
  const general = mark({}, at(9, 0), true)!
  let file = markFile(undefined, 'a', general, at(9, 0), true)
  file = markFile(file, 'b', general, at(9, 1), false)
  expect(daySummary(file.sessions.a![dayKey(at(9, 0))])!.work).toBe('1 min')
  expect(daySummary(file.sessions.b![dayKey(at(9, 0))])!.work).toBe('0 min')
  const later = markFile(file, 'c', general, at(9, 0, 30), false)
  expect(Object.keys(later.sessions)).toEqual(['c'])
})

test('history lists recent days, newest first, with empty days at zero', async () => {
  let log = mark({}, at(8, 0), true)!
  log = mark(log, at(9, 30, 19), false)!
  const days = history(log, at(12, 0), 7)
  expect(days.map(d => d.label).slice(0, 3)).toEqual(['Hoy', 'Ayer', 'lunes 19 oct'])
  expect([days[0]!.workMin, days[1]!.openMin, days[2]!.openMin, days[2]!.start]).toEqual([1, 0, 1, '9:30'])
})

test('opening or reopening a chat never changes the color of the others', async () => {
  const min = 60_000
  let reg = touchSession({}, 'old', 0, 'nova')       // un chat de esta mañana, que luego se cierra
  reg = touchSession(reg, 'a', 10 * min, 'nova')
  reg = touchSession(reg, 'b', 11 * min, 'nova')
  const colors = (r: typeof reg) => ['a', 'b', 'old'].map(id => slotColor(r, id, 'nova'))
  expect(colors(reg).slice(0, 2)).toEqual(['nova', 'naranja'])
  reg = touchSession(reg, 'a', 12 * min, 'nova')
  reg = touchSession(reg, 'old', 12 * min, 'nova')  // reabres el chat viejo: toma un color libre
  reg = touchSession(reg, 'b', 12 * min, 'nova')
  expect(colors(reg)).toEqual(['nova', 'naranja', 'morado'])
  expect(liveSessions(reg, 12 * min)).toEqual(['a', 'b', 'old']) // y su escritorio va al final
  reg = touchSession(reg, 'b', 20 * min, 'nova')    // se cierra a: b no cambia de color
  expect(slotColor(reg, 'b', 'nova')).toBe('naranja')
  reg = touchSession(reg, 'c', 20 * min, 'nova')    // uno nuevo toma el que quedó libre
  expect(slotColor(reg, 'c', 'nova')).toBe('nova')
})

test('chats open from before keep the color they had', async () => {
  const reg = { a: { first: 1, seen: 5 }, b: { first: 2, seen: 5 }, c: { first: 3, seen: 5 } }
  expect(touchSession(reg, 'c', 6, 'nova').c!.slot).toBe('morado') // era el tercero: morado
})

test('two chats that picked the same color at once: the later one moves', async () => {
  const reg = { a: { first: 1, on: 1, seen: 1, slot: 'naranja' }, b: { first: 2, on: 2, seen: 2, slot: 'naranja' } }
  expect(touchSession(reg, 'b', 3, 'nova').b!.slot).toBe('main')
  expect(touchSession(reg, 'a', 3, 'nova').a!.slot).toBe('naranja')
})

test('open chats keep their order and color; a closed one drops out', async () => {
  let reg = touchSession({}, 'a', 1_000)
  reg = touchSession(reg, 'b', 2_000)
  reg = touchSession(reg, 'a', 60_000) // a beats again: still the first
  expect(liveSessions(reg, 61_000)).toEqual(['a', 'b'])
  expect([0, 1, 2].map(i => sessionColor(i, 'naranja'))).toEqual(['naranja', 'morado', 'rojo'])
  expect(liveSessions(reg, 2_000 + 3 * 60_000 + 1)).toEqual(['a']) // b stopped beating 3 min ago
})
