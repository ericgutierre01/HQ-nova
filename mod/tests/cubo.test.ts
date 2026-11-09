import { expect, test } from 'claude-code/testing'

import { cuboPick } from '../hooks/cubo.js'

const main = (mood: string, o: Record<string, unknown> = {}) => ({ kind: 'main', mood, ...o })

test('the cube shows the current chat, with its real pose and color', async () => {
  expect(cuboPick([])).toEqual({ mood: 'sleeping', palette: 'nova' })
  expect(cuboPick([main('working', { palette: 'naranja' }), main('reading', { principal: true, palette: 'morado' })]))
    .toEqual({ mood: 'reading', palette: 'morado' })
  expect(cuboPick([main('browsing', { principal: true })]).mood).toBe('browsing')
  expect(cuboPick([main('done', { principal: true })]).mood).toBe('success')
  expect(cuboPick([main('peeking', { principal: true })]).mood).toBe('waiting')
  expect(cuboPick([{ kind: 'helper', mood: 'error', principal: true }, main('sleeping', { open: true })]).mood).toBe('sleeping')
})

test('following all chats, the one that needs you wins, in its color', async () => {
  const list = [main('working', { principal: true, palette: 'nova' }), main('asking', { palette: 'rojo' }), main('watching')]
  expect(cuboPick(list, 'todos')).toEqual({ mood: 'asking', palette: 'rojo' })
  expect(cuboPick(list, 'actual')).toEqual({ mood: 'working', palette: 'nova' })
})
