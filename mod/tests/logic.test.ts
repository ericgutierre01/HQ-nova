import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const SUB = [{ id: 'sub1', description: 'x', type: 'Explore', status: 'running' }]

// The engine beneath the plugin: a clock, the agent list, and the events the plugin passes on.
function world(on: On, agents: object[] = SUB) {
  const clock = mock.clock(on)
  mock.store(on)
  on('agent.list', () => ({ value: agents }) as never)
  on('session.start', () => ({ cwd: '/tmp' }) as never)
  on('command.register', () => ({ value: { command: 'nova' } }) as never)
  on('turn.start', () => ({ turnId: 't' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('ui.render', ($, e) => h($.ui.resolve(e).Text, {}, 'nothing') as never)
  return clock
}

// The band's drawings (one per desk) as JSON: moods show as class=\"<mood>\", the alts as `name: task`.
async function band($: Engine): Promise<string> {
  const ui = await $.ui.mount({ plugin: 'nova-hq', surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false } as never })
  const svgs = JSON.stringify(await ui.findAll({ type: 'Svg' }))
  await ui.unmount()
  return svgs
}

// The pets as the alts list them, `name: task` each, desk after desk.
const pets = async ($: Engine): Promise<string[]> =>
  (JSON.parse(await band($)) as { props?: { alt?: string } }[])
    .flatMap(s => (s.props?.alt ? s.props.alt.split('; ') : []))
    .filter(a => a.includes(': ')) // the desks; the office, history and progress drawings are named plainly
const has = (svg: string, mood: string) => svg.includes(`class=\\"${mood}\\"`)
const start = ($: Engine) => $.session.start({ cwd: '/tmp', surface: 'desktop' } as never)

describe('nova-hq logic', () => {
  test('with many helpers at once the band stays under the size limit of the app', async ($, on) => {
    const subs = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, description: `ayudante ${i}`, type: 'Explore', status: 'running' }))
    world(on, subs)
    await start($)
    for (const a of subs) await $.turn.start({ text: '', turnId: a.id, agentId: a.id } as never)
    const ui = await $.ui.mount({ plugin: 'nova-hq', surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false } as never })
    const tree = JSON.stringify(await ui.drawn())
    await ui.unmount()
    expect(tree.length).toBeLessThan(100_000)
    for (let i = 0; i < 7; i++) expect(tree).toContain(`ayudante ${i}`)
  })

  test('a skill shows its wand until the turn ends', async ($, on) => {
    world(on)
    on('tool.call', () => ({ result: 'ok', text: 'ok' }) as never)
    await start($)
    await $.turn.start({ text: '', turnId: 't1' } as never)
    await $.tool.call({ tool: 'Skill', tool_use_id: 'k1', skill: 'frontend-design' } as never).catch(() => undefined)
    expect(await band($)).toContain('skill frontend-design')
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
    expect(await band($)).not.toContain('skill frontend-design')
  })

  test('a message left from the big screen is sent once, as yours', async ($, on) => {
    const clock = world(on)
    const files: Record<string, string> = { '/home/.claude/nova-inbox/abc.json': JSON.stringify([{ text: 'hola Nova', at: 1 }]) }
    const sent: unknown[] = []
    on('env.get', () => ({ value: '/home' }) as never)
    on('session.id', () => ({ value: 'abc' }) as never)
    on('fs.read', (_$, e: any) => (e.path in files ? { value: files[e.path] } : Promise.reject(new Error('no file'))) as never)
    on('fs.write', (_$, e: any) => { files[e.path] = e.text; return { value: undefined } as never })
    on('prompt.submit', (_$, e: any) => { sent.push({ text: e.text, asUser: e.asUser ?? e.origin?.asUser }); return { text: e.text } as never })
    await start($)
    await clock.advance(5000)
    await clock.advance(5000)
    expect(sent).toEqual([{ text: 'hola Nova', asUser: true }])
    expect(files['/home/.claude/nova-inbox/abc.json']).toBe('[]')
  })

  test('with a cube set up, opening Claude starts the big screen server without a browser', async ($, on) => {
    const clock = world(on)
    const files: Record<string, string> = {}
    const runs: string[] = []
    on('env.get', () => ({ value: '/home' }) as never)
    on('fs.read', (_$, e: any) => (e.path in files ? { value: files[e.path] } : Promise.reject(new Error('no file'))) as never)
    on('fs.write', (_$, e: any) => { files[e.path] = e.text; return { value: undefined } as never })
    on('process.run', (_$, e: any) => { runs.push(e.argv.join(' ')); return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } as never })
    await start($)
    await clock.settle()
    expect(runs).toEqual([]) // sin cubo, nada
    files['/home/.claude/nova-cubo.json'] = JSON.stringify({ ip: '192.168.1.50' })
    await start($)
    await clock.settle()
    expect(runs.length).toBe(1)
    expect(runs[0]).toMatch(/abrir-pantalla-mac\.command servidor$/)
  })

  test('a plan advanced, wrapped up and answered ends full and still', async ($, on) => {
    world(on)
    on('tool.call', () => ({ result: 'ok', text: 'ok' }) as never)
    await start($)
    await $.turn.start({ text: '', turnId: 't1' } as never)
    const call = (tool: string, args: object) => $.tool.call({ tool, tool_use_id: tool, ...args } as never).catch(() => undefined)
    await call('mcp__ccd_turn__update_plan', { items: [{ content: 'a', status: 'in_progress' }, { content: 'b', status: 'pending' }, { content: 'c', status: 'pending' }], scope: 'continuation' })
    await call('mcp__ccd_turn__update_plan', { advance: true })
    await call('mcp__ccd_turn__update_plan', { advance: true })
    await call('mcp__ccd_turn__wrap_up', { recap: 'x' })
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
    const svg = await band($)
    expect(svg).toContain('3/3')
    expect(svg.includes('class=\\\"now\\\"')).toBe(false)
  })

  test('an engine fork with an unknown agentId gets no pet', async ($, on) => {
    world(on)
    on('tool.call', () => ({ result: 'ok', text: 'ok' }) as never)
    await start($)
    await $.turn.start({ text: '', turnId: 't1', agentId: 'fork1' } as never)
    await $.tool.call({ tool: 'Read', file_path: '/x', agentId: 'fork1' } as never).catch(() => undefined)
    expect(await pets($)).toEqual(['Nova: esperando una tarea'])
  })

  test('a subagent back within 4 s is not removed', async ($, on) => {
    const clock = world(on)
    await $.turn.start({ text: '', turnId: 't1', agentId: 'sub1' } as never)
    expect(await pets($)).toContain('x: pensando')
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'sub1' } as never)
    await clock.advance(2000)
    await $.turn.start({ text: '', turnId: 't2', agentId: 'sub1' } as never)
    await clock.advance(5000)
    expect(await pets($)).toContain('x: pensando')
  })

  test('a finished subagent walks out after a while', async ($, on) => {
    const clock = world(on)
    await start($)
    await $.turn.start({ text: '', turnId: 't1', agentId: 'sub1' } as never)
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'sub1' } as never)
    await clock.advance(5000)
    expect(await pets($)).toEqual(['Nova: esperando una tarea'])
  })

  test('an aborted main turn does not celebrate', async ($, on) => {
    world(on)
    await $.turn.start({ text: '', turnId: 't1' } as never)
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'aborted' } as never)
    const svg = await band($)
    expect(has(svg, 'success')).toBe(false)
    expect(has(svg, 'waiting')).toBe(true)
  })

  test('an answered main turn celebrates, then waits', async ($, on) => {
    const clock = world(on)
    await $.turn.start({ text: '', turnId: 't1' } as never)
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
    expect(has(await band($), 'success')).toBe(true)
    await clock.advance(3000)
    expect(has(await band($), 'waiting')).toBe(true)
  })

  test('turn.complete for an unknown subagent adds nothing', async ($, on) => {
    world(on)
    await start($)
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'sub1' } as never)
    expect(await pets($)).toEqual(['Nova: esperando una tarea'])
  })

  test('session.start twice keeps a known subagent and one Claude', async ($, on) => {
    world(on)
    await start($)
    await $.turn.start({ text: '', turnId: 't1', agentId: 'sub1' } as never)
    await start($)
    expect(await pets($)).toEqual(['Nova: esperando una tarea', 'x: pensando'])
  })

  test('session.start drops a subagent the list no longer knows', async ($, on) => {
    const agents = [...SUB]
    world(on, agents)
    await start($)
    await $.turn.start({ text: '', turnId: 't1', agentId: 'sub1' } as never)
    agents.length = 0
    await start($)
    expect(await pets($)).toEqual(['Nova: esperando una tarea'])
  })

  const draft = async ($: Engine) => {
    const hint = await $.ui.mount({ plugin: 'nova-hq', surface: 'desktop', component: 'PromptHint', props: { isDraft: true, isWorking: false, hint: '' } })
    await hint.unmount()
  }

  test('with peek off, typing never peeks', { options: { peek: false } }, async ($, on) => {
    const clock = world(on)
    await start($)
    await draft($)
    await clock.advance(1)
    expect(has(await band($), 'peeking')).toBe(false)
  })

  test('on the desktop a draft reads along for 8 s, then calms down', async ($, on) => {
    const clock = world(on)
    await start($)
    await draft($)
    await clock.advance(1)
    expect(has(await band($), 'peeking')).toBe(true)
    await clock.advance(5000)
    expect(has(await band($), 'peeking')).toBe(true)
    await clock.advance(4000)
    expect(has(await band($), 'peeking')).toBe(false)
  })

  test('coffee after 5 s of a running call, gone when it ends', async ($, on) => {
    const clock = world(on)
    let finish = () => {}
    on('tool.call', () => new Promise(r => { finish = () => r({ result: 'ok', text: 'ok' }) }) as never)
    await start($)
    const call = $.tool.call({ tool: 'Bash', command: 'sleep 9' } as never).catch(() => undefined)
    await clock.advance(1)
    expect(has(await band($), 'steam')).toBe(false)
    await clock.advance(5000)
    expect(has(await band($), 'steam')).toBe(true)
    finish()
    await call
    expect(has(await band($), 'steam')).toBe(false)
  })

  // Moved from pets.test.ts: they need the engine world (clock, session start) the new setPet relies on.
  test('terminal pane shows text', async ($, on) => {
    world(on)
    await start($)
    const ui = await $.ui.mount({ plugin: 'nova-hq', surface: 'terminal', component: 'Pane', props: { title: 'Mascotas', isFocused: true, bodyColumns: 40 } as never, requestId: 'nova-hq' })
    expect(await ui.find({ type: 'Text', text: /Nova/ })).toBeDefined()
    await ui.unmount()
  })

  test('a failing tool call shows the error pose', async ($, on) => {
    world(on)
    on('tool.call', () => ({ result: 'boom', text: 'boom', isError: true }) as never)
    await start($)
    await $.tool.call({ tool: 'Read', file_path: '/nope' } as never).catch(() => undefined)
    expect(has(await band($), 'error')).toBe(true)
  })

  test('/pets tamaño resizes the band at once, and rejects nonsense', async ($, on) => {
    world(on)
    await start($)
    const bad = await $.command.run({ command: 'nova', args: 'tamaño 999' } as never)
    const ok = await $.command.run({ command: 'nova', args: 'tamaño 90' } as never)
    expect(JSON.stringify(bad)).toContain('Uso')
    expect(JSON.stringify(ok)).toContain('90 px')
    expect(await band($)).toContain('"height":90')
  })


  test('the ⓘ beside the band opens a modal saying what each pet is doing', async ($, on) => {
    world(on)
    const opened: unknown[] = []
    on('ui.open', (_$, e) => (opened.push(e), { value: { isPlaced: true } }) as never)
    let argv: readonly string[] = []
    on('process.run', (_$, e: any) => (argv = e.argv, { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }) as never)
    await start($)
    const ui = await $.ui.mount({ plugin: 'nova-hq', surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false } as never })
    await ui.press({ key: 'info' })
    await ui.unmount()
    expect(JSON.stringify(opened)).toContain('nova-hq-info')
    const modal = await $.ui.mount({ plugin: 'nova-hq', surface: 'desktop', component: 'Pane', props: { title: 'x', isFocused: true, bodyColumns: 60 } as never, requestId: 'nova-hq-info' })
    expect(await modal.find({ type: 'Text', text: /Esperando una tarea/ })).toBeDefined()
    expect(await modal.find({ type: 'Text', text: /Tu día/ })).toBeDefined()
    // The guide and the commands tabs teach the mod.
    await modal.press({ key: 'tab-hours' })
    expect(await modal.find({ type: 'Text', text: /Tus horas/ })).toBeDefined()
    await modal.press({ key: 'tab-guide' })
    expect(await modal.find({ type: 'Markdown', text: /Pensando/ })).toBeDefined()
    await modal.press({ key: 'tab-commands' })
    expect(await modal.find({ type: 'Markdown', text: /nova ajustes/ })).toBeDefined()
    // Its button opens the big screen, the same as /nova pantalla.
    await modal.press({ key: 'screen' })
    expect(argv.join(' ')).toContain('abrir-pantalla-mac.command')
    await modal.unmount()
  })

  test('/pets color repaints Claude at once and rejects unknown colors', async ($, on) => {
    world(on)
    await start($)
    await $.command.run({ command: 'nova', args: 'color naranja' } as never)
    expect(await band($)).toContain('#F97316')
    const bad = await $.command.run({ command: 'nova', args: 'color fucsia' } as never)
    expect(JSON.stringify(bad)).toContain('nova')
  })



  test('the avatar editor previews a pick at once and the band follows', async ($, on) => {
    world(on)
    const opened: unknown[] = []
    on('ui.open', (_$, e) => (opened.push(e.id), { value: { isPlaced: true } }) as never)
    await start($)
    await $.command.run({ command: 'nova', args: 'avatar' } as never)
    expect(opened).toEqual(['nova-hq-settings'])
    const ui = await $.ui.mount({ plugin: 'nova-hq', surface: 'desktop', component: 'Pane', props: { title: 'x', isFocused: true, bodyColumns: 60 } as never, requestId: 'nova-hq-settings' })
    await ui.press({ key: 'color-morado' })
    expect(JSON.stringify(await ui.find({ type: 'Svg' }))).toContain('#A855F7')
    await ui.unmount()
    expect(await band($)).toContain('#A855F7')
  })


  test('in the terminal the telescope follows the cursor and calms after the keys stop', async ($, on) => {
    const clock = world(on)
    on('prompt.edit', (_$, e) => ({ text: e.text, cursor: e.cursor }) as never)
    await start($)
    const lane = async () => {
      const ui = await $.ui.mount({ plugin: 'nova-hq', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false } as never })
      const t = (await ui.find({ type: 'Text', text: /🔭/ }))?.text ?? ''
      await ui.unmount()
      return t
    }
    // The kit raises prompt.edit though its typings don't list it.
    const edit = ($.prompt as unknown as { edit: (e: object) => Promise<unknown> }).edit
    await edit({ origin: 'person', text: '', cursor: 0, start: 0, end: 0, inputText: 'a' } as never)
    await clock.advance(1) // let the unawaited writes land
    const near = await lane()
    const long = 'x'.repeat(45)
    await edit({ origin: 'person', text: long, cursor: 45, start: 45, end: 45, inputText: 'y' } as never)
    await clock.advance(1)
    const far = await lane()
    expect(near.indexOf('🔭')).toBeLessThan(far.indexOf('🔭'))
    await clock.advance(1000)
    expect(await lane()).toBe('')
  })

  test('/pets logo with a name puts a plaque on the office wall', async ($, on) => {
    world(on)
    await start($)
    const r = await $.command.run({ command: 'nova', args: 'logo Mi Empresa' } as never)
    expect(JSON.stringify(r)).toContain('Mi Empresa')
    expect(await band($)).toContain('Mi Empresa')
  })

  test('a tool call lands in the history strip', async ($, on) => {
    world(on)
    on('tool.call', () => ({ result: 'ok', text: 'ok' }) as never)
    await start($)
    await $.tool.call({ tool: 'Read', file_path: '/x' } as never).catch(() => undefined)
    expect(await band($)).toContain('Progreso y actividad')
  })

  test('picking a logo: browse, preview, use, and it hangs on the office wall', async ($, on) => {
    world(on)
    mock.env(on, { HOME: '/home/u' })
    const opened: unknown[] = []
    on('ui.open', (_$, e) => (opened.push(e.id), { value: { isPlaced: true } }) as never)
    on('ui.close', () => ({ value: undefined }) as never)
    on('fs.list', () => ({ value: [{ name: 'Fotos', kind: 'dir', size: 0, mtimeMs: 0 }, { name: 'logo.png', kind: 'file', size: 900, mtimeMs: 0 }, { name: 'notas.txt', kind: 'file', size: 9, mtimeMs: 0 }] }) as never)
    on('fs.read', () => ({ value: { base64: 'AAAA' } }) as never)
    await start($)
    const settingsUi = await $.ui.mount({ plugin: 'nova-hq', surface: 'desktop', component: 'Pane', props: { title: 'x', isFocused: true, bodyColumns: 80 } as never, requestId: 'nova-hq-settings' })
    await settingsUi.press({ key: 'stab-office' })
    await settingsUi.press({ key: 'logo-image' }) // the Imagen choice shows the picker button
    await settingsUi.press({ key: 'pick' })
    await settingsUi.unmount()
    expect(opened).toContain('nova-hq-picker')
    const picker = await $.ui.mount({ plugin: 'nova-hq', surface: 'desktop', component: 'Pane', props: { title: 'x', isFocused: true, bodyColumns: 80 } as never, requestId: 'nova-hq-picker' })
    expect(await picker.find({ key: 'img-notas.txt' })).toBe(undefined) // only images
    await picker.press({ key: 'img-logo.png' })
    expect(await picker.find({ type: 'Svg' })).toBeDefined() // the preview
    await picker.press({ key: 'use' })
    await picker.unmount()
    expect(await band($)).toContain('data:image/png;base64,AAAA')
  })

  test('switching logo mode keeps the name, and the wall follows the choice', async ($, on) => {
    world(on)
    await start($)
    await $.command.run({ command: 'nova', args: 'logo Mi Empresa' } as never)
    const ui = await $.ui.mount({ plugin: 'nova-hq', surface: 'desktop', component: 'Pane', props: { title: 'x', isFocused: true, bodyColumns: 80 } as never, requestId: 'nova-hq-settings' })
    await ui.press({ key: 'stab-office' })
    expect(await ui.find({ type: 'Text', text: /En la pared ahora: la placa/ })).toBeDefined()
    await ui.press({ key: 'logo-none' })
    expect(await band($)).not.toContain('Mi Empresa')
    await ui.press({ key: 'logo-text' })
    expect(await band($)).toContain('Mi Empresa') // kept, no re-typing
    await ui.unmount()
  })

  test('the plaque takes the chosen letter and background colors', async ($, on) => {
    world(on)
    await start($)
    await $.command.run({ command: 'nova', args: 'logo Mi Empresa' } as never)
    const ui = await $.ui.mount({ plugin: 'nova-hq', surface: 'desktop', component: 'Pane', props: { title: 'x', isFocused: true, bodyColumns: 80 } as never, requestId: 'nova-hq-settings' })
    await ui.press({ key: 'stab-office' })
    await ui.press({ key: 'ink-⚪ Blanco' })
    await ui.press({ key: 'paper-🔵 Azul' })
    await ui.input({ key: 'paper-hex', text: '#123456' })
    await ui.unmount()
    const svg = await band($)
    expect(svg).toContain('#FFFFFF')
    expect(svg).toContain('#123456')
  })

  test('/nova is the command, and the old /pets still answers', async ($, on) => {
    world(on)
    await start($)
    const old = await $.command.run({ command: 'pets', args: 'tamaño 999' } as never)
    expect(JSON.stringify(old)).toContain('/nova tamaño')
  })
})
