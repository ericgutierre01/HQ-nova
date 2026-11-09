import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = {
  plugin: 'nova-hq',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 12, bodyColumns: 120, scroll: { offset: 0, bodyRows: 6 }, view: {} },
} as const

// Lo que el motor dibuja por su cuenta en la banda: nada.
const engineDrawsNothing = ($: any, e: any) => {
  const { Box } = $.ui.resolve(e)
  return <Box />
}

const drawn = async (T: any) => {
  const ui = await T.ui.mount({ ...BAND, surface: 'desktop' })
  const tree = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return tree
}

test('Nova principal con sus colores y sin letrero en la pared de entrada', async (T, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 20, 15, 0, 0) })
  on('ui.render', engineDrawsNothing)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  await T.turn.start({ text: 'hola', turnId: 't1' })
  const tree = await drawn(T)
  expect(tree).toMatch('#6EE7B7') // degradado de la Nova original
  expect(tree).not.toMatch('HQ Nova IA')
})

test('PowerShell cuenta como terminal y un git push la pone a publicar', async (T, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 20, 15, 0, 0) })
  on('ui.render', engineDrawsNothing)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  let during = ''
  on('tool.call', async () => {
    during = await drawn(T)
    return { result: { ok: true } } as never
  })
  await T.turn.start({ text: 'sube los cambios', turnId: 't1' })
  await T.tool.call({ tool: 'PowerShell', tool_use_id: 'ps1', command: 'git push origin main', description: 'Push' } as never)
  expect(during).toMatch('shipping')
})

test('/nova skin y /nova escenario visten a Nova y cambian la vista de las ventanas', async (T, on) => {
  mock.clock(on, { now: new Date(2026, 9, 20, 15, 0, 0).getTime() })
  mock.store(on)
  on('ui.render', engineDrawsNothing)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  await T.turn.start({ text: 'hola', turnId: 't1' })
  const skin = await T.command.run({ command: 'nova', args: 'skin pava', origin: { kind: 'composer' } } as never)
  expect(JSON.stringify(skin)).toMatch('Pava jíbara')
  const esc = await T.command.run({ command: 'nova', args: 'escenario playa', origin: { kind: 'composer' } } as never)
  expect(JSON.stringify(esc)).toMatch('Playa')
  const tree = await drawn(T)
  expect(tree).toMatch('#E9C46A') // el ala de la pava
  expect(tree).toMatch('#FDE68A') // la arena de la playa en la ventana
})

test('una ayudante Explore entra en azul', async (T, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 20, 15, 0, 0) })
  on('ui.render', engineDrawsNothing)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('agent.list', () => ({ value: [{ id: 'sub1', description: 'Buscar facturas', type: 'Explore', status: 'running' as const }] }))
  await T.turn.start({ text: 'hola', turnId: 't1' })
  await T.turn.start({ text: 'busca', turnId: 't2', agentId: 'sub1' })
  const tree = await drawn(T)
  expect(tree).toMatch('#0EA5E9') // Nova azul
})

// Avisos: lo que llega al motor por $.audio.play y $.ui.notify.
const listen = (on: On) => {
  const heard = { sounds: [] as string[], notes: [] as string[] }
  on('audio.play', ($, e) => {
    heard.sounds.push(e.clip.asset ?? '')
    return { value: undefined }
  })
  on('ui.notify', ($, e) => {
    heard.notes.push(e.text)
    return { value: { isSent: true as const, channel: 'kitty' as const } }
  })
  on('classic.PermissionRequest', () => ({}))
  return heard
}

const SETTINGS_PANE = {
  plugin: 'nova-hq',
  component: 'Pane',
  requestId: 'nova-hq-settings',
  props: { title: 'Ajustes de Nova', isFocused: true, bodyColumns: 100, placement: 'inline', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

test('pedir permiso suena y notifica, como mucho una vez cada 20 s', async (T, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 20, 16, 0, 0) })
  const heard = listen(on)
  const ask = async (command: string) => {
    await T.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command } })
    await clock.settle()
  }
  await ask('git push origin main')
  expect(heard.sounds).toEqual(['hooks/sounds/permiso.wav'])
  expect(heard.notes).toEqual(['Nova necesita tu permiso · ejecutando git push origin main'])
  await clock.advance(5_000)
  await ask('npm publish')
  expect(heard.sounds).toHaveLength(1)
  expect(heard.notes).toHaveLength(1)
  await clock.advance(20_000)
  await ask('npm publish')
  expect(heard.sounds).toHaveLength(2)
  expect(heard.notes[1]).toMatch('npm publish')
})

test('los ajustes apagan el sonido y las notificaciones por separado', async (T, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 20, 17, 0, 0) })
  mock.store(on)
  const heard = listen(on)
  const ask = async () => {
    await T.classic.PermissionRequest({ tool_name: 'Edit', tool_input: { file_path: 'C:/obra/factura.ts' } })
    await clock.settle()
  }
  const ui = await T.ui.mount({ ...SETTINGS_PANE, surface: 'desktop' })
  await ui.press({ key: 'stab-extras' })
  await ui.press({ key: 'sound' })
  await ask()
  expect(heard.sounds).toEqual([])
  expect(heard.notes).toEqual(['Nova necesita tu permiso · editando C:/obra/factura.ts'])
  await ui.press({ key: 'sound' })
  await ui.press({ key: 'notify' })
  await clock.advance(20_000)
  await ask()
  expect(heard.sounds).toEqual(['hooks/sounds/permiso.wav'])
  expect(heard.notes).toHaveLength(1)
  await ui.unmount()
})

test('una ayudante que termina suena a entrega, sin notificación', async (T, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 20, 18, 0, 0) })
  const heard = listen(on)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [{ id: 'sub1', description: 'Buscar facturas', type: 'Explore', status: 'running' as const }] }))
  await T.turn.start({ text: 'busca', turnId: 't2', agentId: 'sub1' })
  await T.turn.complete({ answer: 'listo', durationMs: 1000, isAborted: false, turnId: 't2', agentId: 'sub1', reason: 'answer' })
  await clock.settle()
  expect(heard.sounds).toEqual(['hooks/sounds/entrega.wav'])
  expect(heard.notes).toEqual([])
})

test('/nova pantalla abre la pantalla grande en Mac con su escenario y skin', async (T, on) => {
  let argv: readonly string[] = []
  on('process.run', ($, e: any) => {
    argv = e.argv
    return { value: { exitCode: 0, stdout: 'ok', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  const r = await T.command.run({ command: 'nova', args: 'pantalla playa pava rotar', origin: { kind: 'composer' } } as never)
  expect(JSON.stringify(r)).toMatch('navegador')
  const line = argv.join(' ')
  expect(line).toMatch('pantalla/abrir-pantalla-mac.command escena playa skin pava rotar')
  await T.command.run({ command: 'nova', args: 'pantalla apagar', origin: { kind: 'composer' } } as never)
  expect(argv.at(-1)).toBe('apagar')
  const bad = await T.command.run({ command: 'nova', args: 'pantalla xyz', origin: { kind: 'composer' } } as never)
  expect(JSON.stringify(bad)).toMatch('No entendí')
})

test('la pestaña Cubo guarda la dirección, la prueba y devuelve el cubo a como estaba', async (T, on) => {
  const files: Record<string, string> = {}
  const calls: string[] = []
  on('env.get', () => ({ value: '/Users/yo' }) as never)
  on('fs.read', (_$, e: any) => (e.path in files ? { value: files[e.path] } : Promise.reject(new Error('no file'))) as never)
  on('fs.write', (_$, e: any) => { files[e.path] = e.text; return { value: undefined } as never })
  on('process.run', ($, e: any) => {
    const url = String(e.argv.at(-1))
    calls.push(url)
    const stdout = url.endsWith('v.json') ? '{"m":"HelloCubic-Lite","v":"V7.0.17"}'
      : url.includes('filelist') ? "<a>nv-abc123-trab.gif</a><a>foto.gif</a>" : 'OK'
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  const conf = '/Users/yo/.claude/nova-cubo.json'
  const ui = await T.ui.mount({ ...SETTINGS_PANE, surface: 'desktop' })
  await ui.press({ key: 'stab-cube' })
  await ui.input({ key: 'cubeIp', text: 'rm -rf /' })
  expect(files[conf]).toBeUndefined()
  await ui.input({ key: 'cubeIp', text: 'http://192.168.1.50/' })
  expect(JSON.parse(files[conf]!)).toEqual({ ip: '192.168.1.50' })
  expect(await ui.find({ type: 'Text', text: /Conectado: HelloCubic-Lite V7\.0\.17/ })).toBeDefined()
  files[conf] = JSON.stringify({ ip: '192.168.1.50', antes: { theme_list: { list: '1,1,0,1,0,0,0', sw_en: '1', sw_i: '60' }, album: { autoplay: 1, i_i: 15 } } })
  await ui.press({ key: 'cube-off' })
  expect(calls).toContain('http://192.168.1.50/set?theme_list=1,1,0,1,0,0,0&sw_en=1&theme_interval=60')
  expect(calls).toContain('http://192.168.1.50/set?i_i=15&autoplay=1')
  expect(calls).toContain('http://192.168.1.50/delete?file=%2Fimage%2Fnv-abc123-trab.gif')
  expect(calls.some(c => c.includes('foto.gif') && c.includes('delete'))).toBe(false)
  expect(files[conf]).toBe('{}')
})
