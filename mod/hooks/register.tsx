// Nova HQ: basado en nova-hq 0.8.0 (el mod de tu compañero), con colores por tipo de agente,
// letrero HQ Nova IA de entrada, PowerShell contado como terminal y rutas de Windows para el logo.
import { atom, read, update } from 'claude-code'
import type { BoxProps, ElementConstructor, EngineInterface, Register, TextProps, Timer, ToolCallInput } from 'claude-code'

import type { Act, Browse, Logo, Pet, PetMood, Plan, PetSettings, Stats } from '../types'
import { DEFAULTS, historySvg, logoShown, officeSvg, PLAQUE, readoutSvg, ESCENARIOS } from './office'
import { groups, hash, LOOKS, scene, SKINS } from './scene'
import { paletteFor } from './nova.js'
import { dayKey, daySummary, history as dayHistory, hours, mark, markFile, touchSession, weekTotals } from './usage.js'
import type { Sessions, Usage, UsageFile } from './usage.js'

export { groups }

const PANE = 'nova-hq'
const INFO = 'nova-hq-info'
const SETTINGS = 'nova-hq-settings'
const PICKER = 'nova-hq-picker'
const MAIN = 'main'
const pets = atom({ plugin: 'nova-hq', key: 'pets' } as const, [])
const typing = atom({ plugin: 'nova-hq', key: 'typing' } as const, false)
// Where the cursor is in the draft, 0 (start) to 1 (far right): the terminal's telescope aims there.
const aim = atom({ plugin: 'nova-hq', key: 'aim' } as const, 0)
// Every setting, and the logo: kept in the mod's own store (across chats), mirrored here so a change redraws at once.
const settings = atom<'nova-hq', 'prefs'>({ plugin: 'nova-hq', key: 'prefs' }, DEFAULTS)
// Sin placa en la pared de entrada; el nombre queda guardado por si se vuelve a poner (/nova logo HQ Nova IA).
const DEFAULT_LOGO: Logo = {}
const logo = atom<'nova-hq', 'logo'>({ plugin: 'nova-hq', key: 'logo' }, DEFAULT_LOGO)
// The last actions, oldest first, for the history strip.
const history = atom<'nova-hq', 'history'>({ plugin: 'nova-hq', key: 'history' }, [])
// The task's plan as it last stood, and the turn's scoreboard.
const plan = atom<'nova-hq', 'plan'>({ plugin: 'nova-hq', key: 'plan' }, null)
const stats = atom<'nova-hq', 'stats'>({ plugin: 'nova-hq', key: 'stats' }, { files: 0, cmds: 0 })
const HISTORY = 10
const browse = atom<'nova-hq', 'browse'>({ plugin: 'nova-hq', key: 'browse' }, { dir: '' })
// Which tab of the ⓘ window is open.
const infoTab = atom<'nova-hq', 'infoTab'>({ plugin: 'nova-hq', key: 'infoTab' }, 'now')
const settingsTab = atom<'nova-hq', 'settingsTab'>({ plugin: 'nova-hq', key: 'settingsTab' }, 'nova')
// Lo último que dijo el cubo al probarlo o devolverlo (se ve en ⚙ Ajustes → Cubo).
const cubeMsg = atom<'nova-hq', 'cubeMsg'>({ plugin: 'nova-hq', key: 'cubeMsg' }, '')

const ANIMALS = ['🐱', '🐶', '🐰', '🦊', '🐼', '🐸', '🐨', '🐯', '🐹', '🐵']
const FACES: Record<PetMood, string> = {
  working: '(•̀ᴗ•́)و ⌨',
  thinking: '(・_・?) …',
  reading: '(・ω・)📖',
  answering: '(•̀ᴗ•́)✍',
  waiting: '(・‿・)',
  peeking: '(¬‿¬)🔍',
  done: '(＾▽＾) ✓',
  browsing: '(⌐■_■)🔭',
  asking: '(・ω・)ノ?',
  shipping: '(ง •̀_•́)ง🚀',
  tidying: '(•̀ᴗ•́)🧹',
  error: '(>_<)💢',
  success: '(ﾉ´ヮ`)ﾉ*:・ﾟ✧',
  watching: '(・ω・)🍿',
  sleeping: '(－_－) zzZ',
}

// Reading, or waiting on someone else's answer (a subagent): the book pose.
const READING_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead', 'Agent', 'Task', 'TaskOutput'])
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
// En Windows Claude usa PowerShell tanto como Bash: los dos cuentan como terminal.
const SHELL_TOOLS = new Set(['Bash', 'PowerShell'])
const isShell = (tool: string) => SHELL_TOOLS.has(tool)
const TEST_CMD = /\b(test|tests|jest|vitest|pytest|mocha|rspec|phpunit)\b/
const SHIP_CMD = /\bgit\s+(commit|push)\b/
const FLASH_MS = 2200
const COFFEE_MS = 5000
// Idle Claude: gets distracted with a movie after 2 min, falls asleep after 10.
const STRETCH_MS = 2 * 60_000
const SLEEP_MS = 10 * 60_000

/** The pose a tool call gets while it runs. */
export function moodFor(e: ToolCallInput): PetMood {
  const tool = String(e.tool)
  const cmd = String((e as unknown as Record<string, unknown>).command ?? '')
  if (tool === 'WebSearch' || tool === 'WebFetch') return 'browsing'
  if (tool === 'AskUserQuestion') return 'asking'
  if (isShell(tool) && SHIP_CMD.test(cmd)) return 'shipping'
  if (READING_TOOLS.has(tool)) return 'reading'
  return 'working'
}

const short = (s: string, n = 40) => (s.length > n ? '…' + s.slice(-(n - 1)) : s)

/** Human task text and the focus key that decides if two agents work together. */
export const describe = (e: ToolCallInput): { task: string; focus: string } => {
  const a = e as unknown as Record<string, unknown>
  const str = (k: string) => (typeof a[k] === 'string' ? (a[k] as string) : undefined)
  const file = str('file_path') ?? str('notebook_path')
  const tool = String(e.tool)
  if (file) {
    const verb = tool === 'Read' ? 'leyendo' : 'editando'
    return { task: `${verb} ${short(file)}`, focus: file }
  }
  if (isShell(tool)) {
    const cmd = str('command') ?? ''
    return { task: `ejecutando ${short(cmd)}`, focus: `$ ${cmd}` }
  }
  if (tool === 'Grep' || tool === 'Glob') {
    const q = str('pattern') ?? ''
    return { task: `buscando ${short(q)}`, focus: `? ${q} ${str('path') ?? ''}` }
  }
  if (tool === 'Agent') return { task: `delegando: ${str('description') ?? ''}`, focus: `agent ${e.tool_use_id}` }
  if (tool === 'Skill') return { task: `usando la skill ${short(str('skill') ?? '')}`, focus: `skill ${e.tool_use_id}` }
  if (tool === 'WebFetch' || tool === 'WebSearch') {
    const q = str('url') ?? str('query') ?? ''
    return { task: `navegando ${short(q)}`, focus: `web ${q}` }
  }
  return { task: `usando ${tool}`, focus: `${tool} ${e.tool_use_id}` }
}

/** A patch on one pet; a new mood stamps `since`. */
const apply = (p: Pet, patch: Partial<Pet>, now: number): Pet =>
  ({ ...p, ...patch, ...(patch.mood !== undefined && patch.mood !== p.mood ? { since: now } : {}) })

/**
 * Patches a pet that is there (and passes `when`). An unknown id, a refused guard or a
 * patch that changes nothing returns the same list, which `change` then never writes.
 */
function setPet(id: string, patch: Partial<Pet>, now: number, when: (p: Pet) => boolean = () => true) {
  return (list: Pet[]): Pet[] => {
    let hit = false
    const out = list.map(p => {
      if (p.id !== id || !when(p) || !Object.entries(patch).some(([k, v]) => p[k as keyof Pet] !== v)) return p
      hit = true
      return apply(p, patch, now)
    })
    return hit ? out : list
  }
}

function addPet(id: string, name: string, now: number, extra: Partial<Pet> = {}) {
  return (list: Pet[]): Pet[] =>
    list.some(p => p.id === id) ? list : [...list, { id, name, mood: 'thinking', task: 'pensando', focus: '', since: now, ...extra }]
}

/** Every redraw reloads the band and restarts its animations: write only what changed. */
async function change($: EngineInterface, fn: (list: Pet[]) => Pet[]) {
  const list = await read($, pets)
  // The write re-applies fn to the value current then, so a concurrent change is never lost.
  if (fn(list) !== list) await update($, pets, fn)
}

const WAITING = { mood: 'waiting', task: 'esperando una tarea' } as const
// Poses that make no sense after a reload: whoever was celebrating or peeking is just waiting.
const SETTLE = new Set<PetMood>(['success', 'error', 'done', 'peeking'])
// Claude with nothing to do: the poses typing wakes into a peek.
const IDLE = new Set<PetMood>(['waiting', 'watching', 'sleeping'])

export const register: Register = (on, options) => {
  // The old /config options seed the store once, so a size set before the store existed is kept.
  const seed: Partial<PetSettings> = {
    ...(typeof options.size === 'number' && Number.isFinite(options.size) ? { size: Math.min(200, Math.max(20, options.size)) } : {}),
    ...(options.peek === false ? { peek: false } : {}),
  }

  // Fires again on every reload: tidy what is there instead of starting over.
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'nova', description: 'Nova: /nova pantalla · /nova ajustes · /nova skin <clasica|pava|gorra|…> · /nova escenario <oficina|playa|espacio|ciudad|bosque|auto> · /nova color <nova|naranja|…> · /nova tamaño <20-200> · /nova telescopio si|no · /nova logo <ruta|texto|quitar>' })
    // The old name keeps working for whoever learned it.
    await $.command.register({ name: 'pets', description: 'Igual que /nova (nombre anterior)' })
    // shortcut: if the list is empty right after a reload, running subagents vanish until their next turn; fine until it bites.
    const [now, agents] = await Promise.all([$.clock.now(), $.agent.list().catch(() => [])])
    const known = new Set(agents.map(a => a.id))
    await change($, list => {
      const dirty = (p: Pet) => p.coffee || p.mail || p.entering || p.leaving || p.sweat || p.skill || SETTLE.has(p.mood)
      const kept = list.filter(p => p.id === MAIN || known.has(p.id))
      const clean = kept.some(dirty)
        ? kept.map(p => (dirty(p) ? apply({ ...p, coffee: false, mail: false, entering: false, leaving: false, sweat: false, skill: undefined }, SETTLE.has(p.mood) ? WAITING : {}, now) : p))
        : kept
      // Claude is there from the start, so the band never waits for a first message.
      if (!clean.some(p => p.id === MAIN)) return [{ id: MAIN, name: 'Nova', ...WAITING, focus: '', since: now }, ...clean]
      return clean.length === list.length && clean === kept ? list : clean
    })
    // A reload mid-turn forgets the module's flag: a busy Claude means a turn is running.
    const main = (await read($, pets)).find(p => p.id === MAIN)
    inTurn = main !== undefined && !IDLE.has(main.mood)
    await setTyping($, false)
    const [kept, oldColor, savedLogo] = await Promise.all(['settings', 'color', 'logo'].map(k => $.store.get(k).catch(() => undefined)))
    const loaded: PetSettings = { ...DEFAULTS, ...seed, ...(typeof oldColor === 'string' && oldColor in LOOKS.color ? { color: oldColor } : {}), ...(kept && typeof kept === 'object' ? kept as Partial<PetSettings> : {}) }
    await update($, settings, () => loaded)
    void sharePrefs($, loaded)
    void serverForCube($).catch(() => undefined)
    if (savedLogo && typeof savedLogo === 'object') await update($, logo, () => savedLogo as Logo)
    idleTimers($)
    // The clock on the wall and the turn's timer tick: redraw every few seconds while either shows.
    ticker?.cancel()
    let minute = -1
    void logMinute($)
    ticker = $.clock.every(5000, () => {
      void logMinute($)
      void checkInbox($).catch(() => undefined)
      void read($, settings).then(s => {
        const m = new Date().getMinutes()
        if ((s.stats && inTurn) || (s.clock && m !== minute)) { minute = m; $.ui.invalidate('ui.render') }
      }).catch(() => undefined)
    })
    // A reload with nothing to tidy writes no state, so the band would keep the old module's drawing.
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // Its own command, so the settings never mix with the system's /config (they live there as nova-hq.*).
  on('command.run', { command: ['nova', 'pets'] }, async ($, e) => {
    const [what = '', value = ''] = e.args.trim().toLowerCase().split(/\s+/)
    const now = await read($, settings)
    if (what === 'tamaño' || what === 'tamano' || what === 'size') {
      const px = Number(value)
      if (!Number.isFinite(px) || px < 20 || px > 200) return { text: `Uso: /nova tamaño <20-200> (en píxeles; ahora ${now.size})` }
      await setSettings($, { size: px })
      return { text: `Tamaño de las Novas: ${px} px.` }
    }
    if (what === 'telescopio' || what === 'peek') {
      const enabled = YES.includes(value)
      if (!enabled && !NO.includes(value)) return { text: `Uso: /nova telescopio si|no (ahora ${now.peek ? 'si' : 'no'})` }
      await setSettings($, { peek: enabled })
      return { text: `Telescopio al escribir: ${enabled ? 'activado' : 'desactivado'}.` }
    }
    if (what === 'color') {
      const name = Object.keys(LOOKS.color).find(n => plain(n) === plain(value))
      if (!name) return { text: `Uso: /nova color ${Object.keys(LOOKS.color).join('|')} (ahora ${now.color})` }
      await setSettings($, { color: name })
      return { text: `Nova ahora es ${name}.` }
    }
    if (what === 'pantalla' || what === 'web' || what === 'screen') {
      return { text: await pantalla($, e.args.trim().toLowerCase().split(/\s+/).slice(1)) }
    }
    if (what === 'skin' || what === 'ropa') {
      const id = Object.keys(SKINS).find(k => plain(k) === plain(value) || plain(SKINS[k]!.name.toLowerCase()).startsWith(plain(value)))
      if (!value || !id) return { text: `Uso: /nova skin ${Object.keys(SKINS).join('|')} (ahora ${now.skin})` }
      await setSettings($, { skin: id })
      return { text: `Skin de las Novas: ${SKINS[id]!.name}.` }
    }
    if (what === 'escenario' || what === 'escena' || what === 'scene') {
      const id = Object.keys(ESCENARIOS).find(k => plain(k) === plain(value) || plain(ESCENARIOS[k]!.name.toLowerCase()).startsWith(plain(value)))
      if (!value || !id) return { text: `Uso: /nova escenario ${Object.keys(ESCENARIOS).join('|')} (ahora ${now.scene})` }
      await setSettings($, { scene: id })
      return { text: `Escenario: ${ESCENARIOS[id]!.name}.` }
    }
    if (what === 'logo') {
      // The original casing and spaces: a path or a company name.
      const arg = e.args.trim().slice(e.args.trim().split(/\s+/)[0]!.length).trim()
      if (arg === '' ) return { text: 'Uso: /nova logo <ruta a una imagen | nombre de la empresa | quitar>' }
      return { text: await setLogo($, arg) }
    }
    if (what === 'avatar' || what === 'ajustes' || what === 'config' || what === 'configuracion' || what === 'configuración') {
      await openSettings($)
      return { text: 'Ajustes de Nova abiertos.' }
    }
    await $.ui.open({ id: PANE, title: 'Nova' })
    return { text: 'Vista grande de Nova abierta. Todo se cambia en /nova ajustes.' }
  })

  on('turn.start', async ($, e, next) => {
    const id = e.agentId ?? MAIN
    const now = await $.clock.now()
    if (id === MAIN) {
      inTurn = true
      cancel('stretch')
      cancel('sleep')
      await setTyping($, false)
      touched.clear()
      await update($, stats, () => ({ start: now, files: 0, cmds: 0 }))
      await update($, plan, () => null)
    }
    edits.set(id, 0)
    if (!(await read($, pets)).some(p => p.id === id)) {
      // Engine forks (compaction, memory) carry agentIds the list does not know: no pet for them.
      const info = id === MAIN ? undefined : (await $.agent.list().catch(() => [])).find(a => a.id === id)
      if (id === MAIN) await change($, addPet(id, 'Nova', now))
      else if (info) {
        // A new subagent walks in, handed its task on a sheet of paper.
        await change($, addPet(id, info.name ?? info.description ?? info.type ?? 'Agente', now, { entering: true, agentType: info.type, palette: paletteFor(info.type ?? '', id) }))
        later($, `enter:${id}`, 1300, t => change($, setPet(id, { entering: false }, t)))
      }
    }
    // Back for another turn before walking out: it stays.
    cancel(`leave:${id}`)
    cancel(`gone:${id}`)
    await change($, setPet(id, { mood: 'thinking', task: 'pensando', focus: '', leaving: false }, now))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId ?? MAIN
    const now = await $.clock.now()
    const tool = String(e.tool)
    const args = e as unknown as Record<string, unknown>
    const cmd = String(args.command ?? '')
    const nextPlan = planFrom(tool, args, await read($, plan))
    if (nextPlan !== undefined) await update($, plan, () => nextPlan)
    if (isShell(tool) || EDIT_TOOLS.has(tool)) {
      if (EDIT_TOOLS.has(tool)) touched.add(String(args.file_path ?? args.notebook_path ?? ''))
      await update($, stats, st => ({ ...st, files: touched.size, cmds: st.cmds + (isShell(tool) ? 1 : 0) }))
    }
    const streak = EDIT_TOOLS.has(tool) ? (edits.get(id) ?? 0) + 1 : READING_TOOLS.has(tool) ? (edits.get(id) ?? 0) : 0
    edits.set(id, streak)
    await change($, setPet(id, { mood: moodFor(e), phase: 'running', sweat: streak >= 3, ...describe(e), ...(tool === 'SendMessage' ? { mail: true } : {}), ...(tool === 'Skill' ? { skill: String(args.skill ?? '') } : {}) }, now))
    // Counted only past the last await that can throw: the .catch replay never decrements.
    const running = (calls.get(id) ?? 0) + 1
    calls.set(id, running)
    if (tool === 'SendMessage') later($, `mail:${id}`, 1500, t => change($, setPet(id, { mail: false }, t)))
    // Still running after a while: time for a coffee (not while asking you something).
    if (running === 1) {
      later($, `coffee:${id}`, COFFEE_MS, t => change($, setPet(id, { coffee: true }, t, p => p.mood !== 'asking')))
    }
    let left = 0
    // A call that throws still stops counting.
    const ran = await next(e).finally(() => {
      left = Math.max(0, (calls.get(id) ?? 1) - 1)
      calls.set(id, left)
      if (left === 0) cancel(`coffee:${id}`)
    })
    const at = await $.clock.now()
    const end = { focus: '', ...(left === 0 ? { coffee: false } : {}) }
    const failed = 'deny' in ran ? ran.deny !== undefined : ran.isError === true
    const act = failed ? 'fail' : actFor(tool, cmd)
    if (act) await update($, history, h => [...h, act].slice(-HISTORY))
    const after = { mood: 'thinking' as const, task: 'pensando', ...end }
    if (failed) flash($, id, { mood: 'error', task: 'algo falló', ...end }, after, at)
    else if (isShell(tool) && TEST_CMD.test(cmd)) flash($, id, { mood: 'success', task: 'los tests pasan', ...end }, after, at)
    else await change($, setPet(id, after, at))
    return ran
  }).catch(($, e, next) => next(e)) // observer only: never block a tool call

  // Writing is work too: a tool call at the desk (green screen, until it runs),
  // the answer at the whiteboard.
  on('turn.step', async function* ($, e, next) {
    const id = e.agentId ?? MAIN
    let block = -1
    for await (const chunk of next(e)) {
      if (chunk.kind === 'tool') {
        await change($, setPet(id, { mood: 'working', phase: 'writing', task: `preparando ${chunk.name}`, focus: `writing ${id}` }, await $.clock.now()))
      } else if (chunk.kind === 'text' && chunk.index !== block) {
        block = chunk.index // once per text block, not per piece
        await change($, setPet(id, { mood: 'answering', task: 'escribiendo la respuesta', focus: '' }, await $.clock.now()))
      }
      yield chunk
    }
  })

  // A permission dialog is up: hand raised, looking at you. next(e) is only the hooks
  // beneath, not your answer, so the pose stays until the tool call ends.
  // shortcut: an approved tool keeps the asking pose while it runs; needs a 'permission answered' event.
  on('classic.PermissionRequest', async ($, e, next) => {
    const id = (e as { agent_id?: string }).agent_id ?? MAIN
    const now = await $.clock.now()
    await change($, setPet(id, { mood: 'asking', task: 'esperando tu permiso', focus: '', coffee: false }, now))
    // El aviso no espera: el diálogo de permiso sale sin retraso.
    const { task } = describe({ ...(e.tool_input as object), tool: e.tool_name, tool_use_id: '' } as unknown as ToolCallInput)
    void alertAsk($, task, now).catch(() => undefined)
    return next(e)
  }).catch(($, e, next) => next(e)) // observer only

  on('classic.PreCompact', async ($, e, next) => {
    await change($, setPet(MAIN, { mood: 'tidying', task: 'ordenando la conversación', focus: '' }, await $.clock.now()))
    return next(e)
  }).catch(($, e, next) => next(e)) // observer only

  on('classic.PostCompact', async ($, e, next) => {
    await change($, setPet(MAIN, inTurn ? { mood: 'thinking', task: 'pensando' } : WAITING, await $.clock.now()))
    return next(e)
  }).catch(($, e, next) => next(e)) // observer only

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    const now = await $.clock.now()
    if (e.agentId === undefined) {
      inTurn = false
      await update($, stats, st => ({ ...st, end: now }))
      const end = { focus: '', sweat: false, coffee: false, skill: undefined }
      // A little dance for a finished task, a grimace for a failed one, nothing for an interrupted one.
      if (e.reason === 'aborted') await change($, setPet(MAIN, { ...WAITING, ...end }, now))
      else flash($, MAIN, e.reason === 'answer' ? { mood: 'success', task: 'tarea terminada', ...end } : { mood: 'error', task: 'algo falló', ...end }, WAITING, now)
      idleTimers($)
    } else {
      const id = e.agentId
      edits.delete(id)
      calls.delete(id)
      // Una ayudante entrega su trabajo: un sonido suave (no para los forks del motor, que no tienen Nova).
      if ((await read($, pets)).some(p => p.id === id)) void chime($, 'entrega').catch(() => undefined)
      // Celebrates, waves goodbye walking out, then is gone (unless it came back meanwhile).
      await change($, setPet(id, { mood: 'done', task: 'terminó', focus: '', sweat: false, coffee: false, skill: undefined }, now))
      later($, `leave:${id}`, 2500, t => change($, setPet(id, { leaving: true }, t)))
      later($, `gone:${id}`, 3800, () => change($, list => (list.some(p => p.id === id && p.leaving) ? list.filter(p => p.id !== id) : list)))
    }
    return ran
  })

  // The terminal reports every edit with the cursor: Claude peeks while keys come in
  // (CALM_MS after the last) and aims the telescope at the cursor.
  on('prompt.edit', async ($, e, next) => {
    const ran = await next(e)
    if (!(await read($, settings)).peek) return ran
    const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    if (text.trim() === '') void setTyping($, false).catch(() => undefined)
    else void poke($, CALM_MS, (e.start + e.inputText.length) / AIM_COLUMNS).catch(() => undefined)
    return ran
  })

  // The desktop only says whether the box holds a draft, never its keys: there the telescope
  // reads along left to right for READ_MS from the first key, and stops when the box empties.
  // shortcut: it follows time, not your text; needs a desktop keystroke event to truly follow.
  // Drawing is pure: the writes wait until this draw is over.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.surface !== 'terminal' && (await read($, settings)).peek) {
      if (e.props.isDraft && !e.props.isWorking) {
        if (!(await read($, typing))) later($, 'poke', 0, () => poke($, READ_MS))
      } else later($, 'poke', 0, () => { cancel('calm'); return setTyping($, false) })
    }
    return next(e)
  })

  // Always-on band above the prompt: the animated scene where SVG draws, text lines elsewhere.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = withTyping(await read($, pets), await read($, typing))
    // The app's own box (a survey, the next-step question) takes this spot: yield to it. Drawing anyway
    // was tried; the desktop app shows nothing of ours while its box is up, so there is nothing to gain.
    if (e.props.hasSurvey || list.length === 0) return next(e)
    const aimAt = await read($, aim)
    const set = await read($, settings)
    const els = $.ui.resolve(e)
    if (e.surface !== 'terminal' && 'Svg' in els) {
      const { Svg, Button } = els
      // One drawing per desk, keyed by who sits there: a change redraws only that desk, so
      // the others keep animating. Drawn as images, not sandboxed frames: an image swaps
      // without the blank frame a reloading iframe shows. The ⓘ beside them opens the details.
      // No background of its own: around the pets the band's own color shows, in either theme.
      // Two groups pushed to the edges: the office scene on the left, the task's readout on the right.
      const [office, ...hud] = extras(Svg, els.Box, set, await read($, logo), await read($, history), await read($, plan), await read($, stats))
      const look = { size: set.size, avatar: { color: myColor(set) }, skin: set.skin }
      // One drawing per desk, so a change redraws only that desk...
      const apart = groups(list).map(g => {
        const { source, width, height } = scene(g, look)
        return (
          <els.Box key={`desk-${g.map(p => p.id).join('+')}`}>
            <Svg source={source} width={width} height={height} alt={altText(g)} />
          </els.Box>
        )
      })
      const band = (desks: unknown, center: unknown) => (
        <els.Box flexDirection="row" justifyContent="space-between" alignItems="center" width="100%">
          {/* Three equal thirds, so the office sits in the true centre whatever the sides hold. */}
          <els.Box key="scene" flexDirection="row" gap="md" width="33%">{desks as never}</els.Box>
          <els.Box key="office" flexDirection="row" justifyContent="center" width="34%">{center as never}</els.Box>
          {/* The readout, with the ⓘ in the band's top-right corner. */}
          <els.Box key="hud" flexDirection="row" justifyContent="flex-end" alignItems="flex-start" gap="sm" width="33%">
            {hud}
            <Button key="info" label="ⓘ" plain dimColor onPress={() => void $.ui.open({ id: INFO, title: 'Tu equipo de Novas', focus: true, closeOnEscape: true, rows: 34 })} />
          </els.Box>
        </els.Box>
      )
      // ...but each desk repeats the scene's styles (~13k characters), and the app refuses a band past
      // 100k serialized: the whole band would vanish. Many desks at once share one drawing instead,
      // and if even that is too big (a large logo), the office makes room.
      const fits = (tree: unknown) => JSON.stringify(tree).length < BAND_BUDGET
      const first = band(apart, office)
      if (fits(first)) return first
      const all = scene(list, look)
      const together = <els.Box key="desks"><Svg source={all.source} width={all.width} height={all.height} alt={altText(list)} /></els.Box>
      const second = band(together, office)
      return fits(second) ? second : band(together, null)
    }
    return textView(els, list, aimAt)
  })

  // The ⓘ window, three tabs: who is doing what now (and the task's progress), a guide to
  // everything the band shows, and the commands. Teaches the mod while it reports.
  on('ui.render', { component: 'Pane', requestId: INFO }, async ($, e) => {
    const [list, tab, set, steps, score, acts] = await Promise.all([read($, pets), read($, infoTab), read($, settings), read($, plan), read($, stats), read($, history)])
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const now = await $.clock.now()
    const svgs = e.surface !== 'terminal' && 'Svg' in els
    const tabs = (
      <Box flexDirection="row" gap="xs" marginBottom={1}>
        {INFO_TABS.map(([id, label]) => (
          <Button key={`tab-${id}`} label={label} variant={tab === id ? 'primary' : 'secondary'} onPress={() => void update($, infoTab, () => id).catch(() => undefined)} />
        ))}
      </Box>
    )
    const md = (text: string) => ('Markdown' in els ? <els.Markdown text={text} /> : <Text>{text}</Text>)
    let body
    if (tab === 'guide') body = md(GUIDE)
    else if (tab === 'commands') body = md(COMMANDS)
    else if (tab === 'hours' && !set.hours) body = <Text dimColor>El registro de horas está apagado. Actívalo en ⚙ Ajustes → Horas y pantalla grande.</Text>
    else if (tab === 'hours') {
      const log = ((await $.store.get('uso').catch(() => undefined)) ?? {}) as Usage
      const days = dayHistory(log, now, 31)
      const sum = (from: number, to: number, k: 'openMin' | 'workMin') => days.slice(from, to).reduce((n, d) => n + d[k], 0)
      const chart = historySvg(days.slice(0, 14))
      body = (
        <Box flexDirection="column" gap="sm">
          <Text bold>Tus horas</Text>
          <Text>Esta semana: <Text bold>{hours(sum(0, 7, 'openMin'))}</Text> abierto · <Text bold color="success">{hours(sum(0, 7, 'workMin'))}</Text> trabajando</Text>
          <Text dimColor>Semana anterior: {hours(sum(7, 14, 'openMin'))} abierto · {hours(sum(7, 14, 'workMin'))} trabajando</Text>
          <Text dimColor>Últimos 30 días: {hours(sum(0, 30, 'openMin'))} abierto · {hours(sum(0, 30, 'workMin'))} trabajando</Text>
          {svgs ? <els.Svg source={chart.source} width={chart.width} height={chart.height} alt="Horas por día de las últimas dos semanas" /> : null}
          <Text dimColor>Gris: Claude abierto · verde: Nova trabajando</Text>
          <Text bold>Día por día</Text>
          {days.filter(d => d.openMin > 0).map(d => (
            <Text key={`day-${d.key}`}><Text bold>{d.label}</Text>  <Text dimColor>{d.start}–{d.end}</Text>  ·  {d.open} abierto  ·  <Text color="success">{d.work}</Text> trabajando</Text>
          ))}
          {days.every(d => d.openMin === 0) ? <Text dimColor>Aún no hay horas registradas.</Text> : null}
        </Box>
      )
    }
    else {
      const readout = readoutSvg(steps ?? undefined, score, acts, { ...set, size: 70 }, now)
      const log = ((await $.store.get('uso').catch(() => undefined)) ?? {}) as Usage
      const today = daySummary(log[dayKey(now)])
      const yesterday = daySummary(log[dayKey(now - 86_400_000)])
      const week = weekTotals(log, now)
      body = (
        <Box flexDirection="column" gap="sm">
          <Text bold>Ahora mismo</Text>
          {list.map(p => (
            <Box key={`who-${p.id}`} flexDirection="row" gap="sm" alignItems="center">
              {svgs ? <els.Svg source={scene([p], { size: 56, avatar: p.id === MAIN ? { color: myColor(set) } : {}, skin: set.skin }).source} width={52} height={56} alt={p.name} /> : <Text>{ANIMALS[hash(p.id) % ANIMALS.length]}</Text>}
              <Box flexDirection="column">
                <Text><Text bold>{p.name}</Text>{p.id === MAIN ? <Text dimColor>  · tu agente principal</Text> : <Text dimColor>  · subagente</Text>}</Text>
                <Text color={MOOD_COLOR[p.mood]}>{MOOD_ICON[p.mood]} {LABELS[p.mood][0]!.toUpperCase() + LABELS[p.mood].slice(1)}{p.since ? <Text dimColor>  · desde hace {ago(now - p.since)}</Text> : null}</Text>
                {p.task && p.task !== LABELS[p.mood] ? <Text dimColor>{p.task}</Text> : null}
                {p.skill ? <Text color="claude">🪄 Trabajando con la skill <Text bold>{p.skill}</Text></Text> : null}
              </Box>
            </Box>
          ))}
          {set.hours ? (
            <Box flexDirection="column" gap="sm">
              <Text bold>Tu día</Text>
              {today
                ? <Text>Empezaste a las <Text bold>{today.start}</Text> · último uso <Text bold>{today.end}</Text> · <Text bold>{today.open}</Text> con Claude abierto · <Text bold color="success">{today.work}</Text> trabajando</Text>
                : <Text dimColor>Aún no hay registro de hoy.</Text>}
              {yesterday ? <Text dimColor>Ayer: {yesterday.start} a {yesterday.end} · {yesterday.open} abierto · {yesterday.work} trabajando</Text> : null}
              <Text dimColor>Últimos 7 días: {week.open} abierto · {week.work} trabajando</Text>
            </Box>
          ) : null}
          <Text bold>Esta tarea</Text>
          {readout && svgs
            ? <els.Svg source={readout.source} width={readout.width} height={readout.height} alt="Progreso y actividad" />
            : <Text dimColor>Aún no hay una tarea en curso. Cuando trabaje, aquí verás los pasos, el tiempo y las últimas acciones.</Text>}
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        {tabs}
        {body}
        <Box flexDirection="row" gap="sm" marginTop={1}>
          <Button key="close" label="Cerrar" role="dismiss" variant="primary" autoFocus onPress={() => void $.ui.close({ id: INFO })} />
          <Button key="settings" label="⚙ Ajustes" onPress={() => void $.ui.close({ id: INFO }).then(() => openSettings($))} />
          <Button key="screen" label="🖥 Pantalla grande" onPress={() => void pantalla($, []).then(say => $.ui.toast(say)).catch(() => undefined)} />
        </Box>
      </Box>
    )
  })

  // The settings: a live preview on top, then one section per area. Every control is a
  // button that shows its state (filled when on), and every change is stored and shown at once.
  on('ui.render', { component: 'Pane', requestId: SETTINGS }, async ($, e) => {
    const set = await read($, settings)
    const brand = await read($, logo)
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const save = (patch: Partial<PetSettings>) => () => void setSettings($, patch).catch(() => undefined)
    // A chip: filled when on, a press flips it.
    const chip = (key: keyof PetSettings, label: string) => (
      <Button key={key} label={`${set[key] ? '✓' : '○'} ${label}`} variant={set[key] ? 'primary' : 'secondary'} onPress={save({ [key]: !set[key] })} />
    )
    const claude: Pet = { id: MAIN, name: 'Nova', mood: 'waiting', task: '', focus: '' }
    const office = officeSvg({ ...set, size: 90 }, brand, new Date())
    // The logo section answers "what is on the wall now?" before anything else.
    const mode = brand.mode ?? logoShown(brand)
    const shown = logoShown(brand)
    const fileName = brand.file?.split('/').pop()
    const wallNow = shown === 'image' ? `✓ En la pared ahora: tu imagen${fileName ? ` (${fileName})` : ''}`
      : shown === 'text' ? `✓ En la pared ahora: la placa «${brand.text}»`
      : mode === 'text' ? '○ Aún no hay nombre: escríbelo abajo y pulsa Guardar.'
      : mode === 'image' ? '○ Aún no hay imagen: elige una con el botón de abajo.'
      : '○ La pared no muestra ningún logo.'
    const setMode = (m: 'none' | 'text' | 'image') => () => void saveLogo($, { ...brand, mode: m }).catch(() => undefined)
    // A row of color chips for the plaque's letters or background, plus a custom #hex.
    const plaqueStyle = (part: 'ink' | 'paper', label: string, choices: [string, string][]) => {
      const current = brand[part] ?? PLAQUE[part]
      const known = choices.some(([, c]) => c.toLowerCase() === current.toLowerCase())
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" flexWrap="wrap" gap="xs">
            <Text dimColor>{label}</Text>
            {choices.map(([name, c]) => (
              <Button key={`${part}-${name}`} label={name} variant={c.toLowerCase() === current.toLowerCase() ? 'primary' : 'secondary'}
                onPress={() => void saveLogo($, { ...brand, [part]: c }).catch(() => undefined)} />
            ))}
          </Box>
          {'Input' in els
            ? <els.Input key={`${part}-hex`} label={`${label}: color propio`} placeholder="#1e293b" value={known ? '' : current} submitLabel="Aplicar"
                onSubmit={v => void (HEX.test(v.trim()) ? saveLogo($, { ...brand, [part]: v.trim() }) : Promise.resolve()).catch(() => undefined)} />
            : null}
        </Box>
      )
    }
    // One option: its name, a line saying what it does, then its buttons.
    const row = (title: string, hint: string, controls: unknown) => (
      <Box flexDirection="column" key={`row-${title}`}>
        <Text bold>{title}</Text>
        <Text dimColor>{hint}</Text>
        <Box flexDirection="row" flexWrap="wrap" gap="xs" marginTop={1}>{controls as never}</Box>
      </Box>
    )
    const pick = <T extends string | number>(key: keyof PetSettings, choices: [T, string][]) =>
      choices.map(([value, label]) => (
        <Button key={`${String(key)}-${value}`} label={label} variant={set[key] === value ? 'primary' : 'secondary'} onPress={save({ [key]: value } as Partial<PetSettings>)} />
      ))
    const tab = await read($, settingsTab)
    const tabs = (
      <Box flexDirection="row" flexWrap="wrap" gap="xs" marginBottom={1}>
        {SETTINGS_TABS.map(([id, label]) => (
          <Button key={`stab-${id}`} label={label} variant={tab === id ? 'primary' : 'secondary'} onPress={() => void update($, settingsTab, () => id).catch(() => undefined)} />
        ))}
      </Box>
    )
    const svgs = e.surface !== 'terminal' && 'Svg' in els
    let body
    if (tab === 'office') {
      body = (
        <Box flexDirection="column" gap="md">
          {svgs && office ? <els.Svg source={office.source} alt="La oficina" /> : null}
          {row('Qué se ve en la pared', 'Las piezas de la oficina, en el centro de la franja.', [chip('window', 'Ventanas'), chip('clock', 'Reloj')])}
          {row('Vista por las ventanas', 'El paisaje detrás del cristal; el cielo sigue tu hora.', pick('scene', Object.entries(ESCENARIOS).map(([id, s]) => [id, s.name] as [string, string])))}
          <Box flexDirection="column">
            <Text bold>Logo de la empresa</Text>
            <Text dimColor>Una placa con el nombre o tu imagen, debajo del reloj.</Text>
            <Box flexDirection="row" gap="xs" marginTop={1}>
              {([['none', 'Sin logo'], ['text', 'Nombre'], ['image', 'Imagen']] as const).map(([m, label]) => (
                <Button key={`logo-${m}`} label={`${mode === m ? '●' : '○'} ${label}`} variant={mode === m ? 'primary' : 'secondary'} onPress={setMode(m)} />
              ))}
            </Box>
            <Text color={shown === 'none' ? 'subtle' : 'success'}>{wallNow}</Text>
          </Box>
          {mode === 'text' && 'Input' in els
            ? <els.Input key="logoText" label="Nombre de la empresa" placeholder="p. ej. Mi Empresa" value={brand.text}
                submitLabel={brand.text ? 'Guardar cambio' : 'Guardar'}
                onSubmit={v => void (v.trim() ? setLogo($, v) : Promise.resolve('')).catch(() => undefined)} />
            : null}
          {mode === 'text' ? plaqueStyle('ink', 'Letras', INKS) : null}
          {mode === 'text' ? plaqueStyle('paper', 'Fondo', PAPERS) : null}
          {mode === 'image'
            ? <Box flexDirection="row" gap="xs">
                <Button key="pick" label={brand.image ? '🖼  Cambiar imagen…' : '🖼  Elegir imagen…'} variant="primary" onPress={() => void openPicker($).catch(() => undefined)} />
              </Box>
            : null}
        </Box>
      )
    } else if (tab === 'band') {
      body = (
        <Box flexDirection="column" gap="md">
          {row('Tamaño de la franja', 'Lo alto que se dibuja todo encima del cuadro de texto.', pick('size', SIZES.map(([label, px]) => [px, label] as [number, string])))}
          {row('A la derecha', 'Lo que se ve de la tarea en curso.', [chip('progress', 'Barra de progreso'), chip('stats', 'Tiempo, archivos y comandos'), chip('history', 'Últimas acciones')])}
          {row('Mientras escribes', 'Nova te espía con un telescopio mientras escribes un mensaje.', [chip('peek', 'Telescopio')])}
        </Box>
      )
    } else if (tab === 'cube') {
      const cube = await cubeConf($)
      const msg = await read($, cubeMsg)
      body = (
        <Box flexDirection="column" gap="md">
          <Text dimColor>Un cubo GeekMagic (HelloCubic-Lite) en tu red enseña a Nova mientras Claude está abierto. Cada cambio se ve en el cubo en unos segundos.</Text>
          <Box flexDirection="column">
            <Text bold>Dirección del cubo</Text>
            <Text dimColor>La que sale en la pantalla del cubo al encenderlo (p. ej. 192.168.1.50).</Text>
            {'Input' in els
              ? <els.Input key="cubeIp" label="Dirección" placeholder="192.168.1.50" value={cube.ip ?? ''} submitLabel={cube.ip ? 'Guardar y probar' : 'Conectar'}
                  onSubmit={v => void saveCubeIp($, v).catch(() => undefined)} />
              : null}
            <Text color={!cube.ip ? 'subtle' : msg.startsWith('✓') ? 'success' : msg ? 'error' : 'subtle'}>
              {!cube.ip ? '○ Sin cubo: escribe su dirección arriba.' : msg || `Cubo en ${cube.ip}. Pulsa Probar para ver si responde.`}
            </Text>
            {cube.ip
              ? <Box flexDirection="row" gap="xs" marginTop={1}>
                  <Button key="cube-test" label="🔌 Probar" onPress={() => void probeCube($, cube.ip!).catch(() => undefined)} />
                  <Button key="cube-off" label="↩ Devolver el cubo a como estaba" onPress={() => void restoreCube($).catch(() => undefined)} />
                </Box>
              : null}
          </Box>
          {row('Qué Nova enseña', 'La del chat donde escribiste por última vez, o la de todos: si un chat te necesita, eso gana.', pick('cubeFollow', [['actual', 'Chat actual'], ['todos', 'Lo más importante de todos']]))}
          {row('Tamaño de Nova', 'Lo grande que sale en la pantalla del cubo.', pick('cubeSize', [['chica', 'Pequeña'], ['mediana', 'Mediana'], ['grande', 'Grande']]))}
          {row('Texto', 'Debajo de Nova: Trabajando, Te necesita, ¡Listo!…', [chip('cubeLabel', 'Mostrar el texto')])}
          {row('Brillo', 'El de la pantalla del cubo.', pick('cubeBrt', [[0, 'Como esté'], [30, 'Bajo'], [120, 'Medio'], [255, 'Alto']]))}
          {row('Voltear', 'El cristal del cubo se ve en espejo: con esto, Nova sale volteada para que ahí se vea normal.', [chip('cubeMirror', 'Voltear para el cubo')])}
        </Box>
      )
    } else if (tab === 'extras') {
      body = (
        <Box flexDirection="column" gap="md">
          {row('Avisos', 'Cuando Nova necesita tu permiso o una ayudante entrega su trabajo.', [chip('sound', 'Sonido'), chip('notify', 'Notificación')])}
          {row('Tus horas', 'Anota cuándo empiezas, cuándo cierras Claude y cuánto trabaja Nova. Se guarda solo en tu Mac (ⓘ → Ahora e Historial).', [chip('hours', 'Registrar mis horas')])}
          {row('Pantalla grande', 'Ver la conversación de cada chat en la pantalla grande y escribirle desde ahí (/nova pantalla).', [chip('remoteChat', 'Chatear desde la pantalla grande')])}
        </Box>
      )
    } else {
      body = (
        <Box flexDirection="column" gap="md">
          {svgs ? <els.Svg source={scene([claude], { size: 90, avatar: { color: set.color }, skin: set.skin }).source} alt="Tu Nova" /> : null}
          {row('Color', 'El de tu Nova en tu primer chat; los demás chats abiertos llevan otro color.',
            Object.keys(LOOKS.color).map(c => (
              <Button key={`color-${c}`} label={`${COLOR_DOT[c] ?? '●'} ${c === 'nova' ? 'Nova' : c[0]!.toUpperCase() + c.slice(1)}`}
                variant={set.color === c ? 'primary' : 'secondary'} onPress={save({ color: c })} />
            )))}
          {row('Qué lleva puesto', 'Lo visten todas las Novas, en el chat y en la pantalla grande.', pick('skin', Object.entries(SKINS).map(([id, s]) => [id, s.name] as [string, string])))}
        </Box>
      )
    }
    return (
      <Box flexDirection="column" gap="sm">
        {tabs}
        {body}
        <Box flexDirection="row" gap="sm" marginTop={1}>
          <Button key="done" label="Listo" role="dismiss" variant="primary" autoFocus onPress={() => void $.ui.close({ id: SETTINGS })} />
          <Button key="reset" label="Restablecer todo" onPress={save({ ...DEFAULTS })} />
        </Box>
      </Box>
    )
  })

  // The logo picker: quick places, the folder's subfolders and images, a preview of the one
  // picked, and "Usar como logo". Built from buttons: the plugin API has no native file dialog.
  on('ui.render', { component: 'Pane', requestId: PICKER }, async ($, e) => {
    const { dir, picked } = await read($, browse)
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const home = await homeDir($)
    const go = (to: string) => () => void update($, browse, () => ({ dir: to })).catch(() => undefined)
    const entries = await $.fs.list(dir).catch(() => [])
    const shown = entries
      .filter(f => !f.name.startsWith('.') && (f.kind === 'dir' || IMAGE_EXT.test(f.name)))
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1))
    const folders = shown.filter(f => f.kind === 'dir').slice(0, 40)
    const images = shown.filter(f => f.kind !== 'dir').slice(0, 40)
    const pickedEntry = images.find(f => `${dir}/${f.name}` === picked)
    const tooBig = pickedEntry !== undefined && pickedEntry.size > LOGO_BYTES
    let thumb: string | undefined
    if (picked && !tooBig && e.surface !== 'terminal' && 'Svg' in els) {
      const ext = IMAGE_EXT.exec(picked)?.[1]?.toLowerCase() ?? 'png'
      const bytes = await $.fs.read(picked, { as: 'bytes' }).catch(() => undefined)
      if (bytes) thumb = `data:${MIME[ext]};base64,${bytes.base64}`
    }
    const parent = dir.replace(/\/[^/]+\/?$/, '') || '/'
    const pretty = dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir
    return (
      <Box flexDirection="column" gap="sm">
        <Box flexDirection="row" flexWrap="wrap" gap="xs">
          {PLACES.map(([label, sub]) => (
            <Button key={`place-${label}`} label={label} variant={dir === `${home}${sub}` ? 'primary' : 'secondary'} onPress={go(`${home}${sub}`)} />
          ))}
          <Button key="place-project" label="📂 Proyecto" onPress={() => void $.session.root().then(r => update($, browse, () => ({ dir: slashes(r) }))).catch(() => undefined)} />
        </Box>
        <Box flexDirection="row" gap="xs">
          <Button key="up" label="⬆ Subir" plain dimColor onPress={go(parent)} />
          <Text dimColor>{pretty}</Text>
        </Box>
        <Box flexDirection="row" gap="md">
          <Box flexDirection="column" flexGrow={1}>
            {folders.length + images.length === 0 ? <Text dimColor>No hay imágenes aquí (PNG, JPG, SVG o WebP).</Text> : null}
            {folders.map(f => <Button key={`dir-${f.name}`} label={`📁 ${f.name}`} plain onPress={go(`${dir}/${f.name}`)} />)}
            {images.map(f => (
              <Button key={`img-${f.name}`} label={`🖼  ${f.name}  ·  ${kb(f.size)}`} plain dimColor={`${dir}/${f.name}` !== picked}
                onPress={() => void update($, browse, b => ({ ...b, picked: `${dir}/${f.name}` })).catch(() => undefined)} />
            ))}
          </Box>
          <Box flexDirection="column" gap="sm" width={30}>
            {thumb && 'Svg' in els
              ? <els.Svg source={`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120"><rect width="160" height="120" rx="10" fill="#fff"/><image href="${thumb}" x="8" y="8" width="144" height="104" preserveAspectRatio="xMidYMid meet"/></svg>`} width={160} height={120} alt="Vista previa del logo" />
              : <Text dimColor>{picked ? (tooBig ? 'Esta imagen pesa más de 40 KB: elige una más ligera.' : 'Vista previa no disponible.') : 'Elige una imagen para verla aquí.'}</Text>}
            <Button key="use" label="Usar como logo" variant="primary"
              onPress={() => void (picked && !tooBig ? setLogo($, picked).then(() => $.ui.close({ id: PICKER })) : Promise.resolve()).catch(() => undefined)} />
            <Button key="cancel" label="Cancelar" role="dismiss" onPress={() => void $.ui.close({ id: PICKER })} />
          </Box>
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const list = await read($, pets)
    const prefsNow = await read($, settings)
    const avatar = { color: myColor(prefsNow) }
    const els = $.ui.resolve(e)
    if (list.length === 0) return <els.Text dimColor>Nadie despierto todavía.</els.Text>
    if (e.surface !== 'terminal' && 'Svg' in els) {
      const { Svg } = els
      // No size props: the scene stretches to the pane's width.
      return <Svg source={scene(list, { avatar, skin: prefsNow.skin }).source} alt={altText(list)} />
    }
    return textView(els, list)
  })
}

const LABELS: Record<PetMood, string> = {
  working: 'trabajando', reading: 'leyendo', browsing: 'buscando en la web', answering: 'escribiendo la respuesta',
  thinking: 'pensando', asking: 'esperando tu permiso', shipping: 'publicando', tidying: 'ordenando',
  error: 'algo falló', success: '¡lo logró!', waiting: 'esperando una tarea', peeking: 'espiando lo que escribes',
  watching: 'viendo una peli', sleeping: 'dormido', done: 'terminó',
}

// The app refuses a drawn tree past 100,000 serialized characters; keep a margin.
const BAND_BUDGET = 90_000
const SETTINGS_TABS: [string, string][] = [['nova', '🎨 Tu Nova'], ['office', '🏢 Oficina'], ['band', '📏 Franja'], ['extras', '🔔 Avisos y extras'], ['cube', '🧊 Cubo']]
const INFO_TABS: [string, string][] = [['now', '👀 Ahora'], ['hours', '📅 Historial'], ['guide', '📖 Guía'], ['commands', '⌨ Comandos']]
const MOOD_ICON: Record<PetMood, string> = {
  working: '⌨', reading: '📖', browsing: '🔭', answering: '✍', thinking: '💭', asking: '✋', shipping: '🚀', tidying: '🧹',
  error: '✕', success: '✓', waiting: '·', peeking: '🔭', watching: '🍿', sleeping: '💤', done: '✓',
}
const MOOD_COLOR: Record<PetMood, string> = {
  working: 'success', reading: 'suggestion', browsing: 'suggestion', answering: 'claude', thinking: 'warning', asking: 'permission',
  shipping: 'merged', tidying: 'subtle', error: 'error', success: 'success', waiting: 'subtle', peeking: 'claude', watching: 'subtle', sleeping: 'subtle', done: 'success',
}

const GUIDE = `**Qué es esto.** Cada bolita es un agente trabajando para ti: Nova, tu agente principal, con el color de tus ajustes en tu primer chat abierto y otro color en cada chat más que abras a la vez, y una ayudante de color por cada tarea que delega (Explore azul, Plan violeta, general-purpose ámbar). Se mueven según lo que hacen *de verdad*, en tiempo real.

**Qué hacen y qué muestra su pantalla**

| Estado | Pantalla | Qué significa |
|---|---|---|
| 💭 Pensando | 🟡 amarilla | Decide el siguiente paso |
| ⌨ Escribiendo un comando | 🟢 verde | Prepara una edición o un comando |
| ⌨ Ejecutando | 🔴 roja | El comando está corriendo (☕ si tarda más de 5 s) |
| 📖 Leyendo | 🔵 documento | Lee archivos o busca en el código |
| 🔭 En la web | 🌐 navegador | Busca o abre una página |
| ✍ Respondiendo | 📝 apuntes | Te escribe la respuesta (pizarra en la pared) |
| ✋ Esperando permiso | ⚠ aviso | Necesita que apruebes algo |
| 🚀 Publicando | ⬆ subida | git commit / push |
| 🧹 Ordenando | ▤ compresión | La conversación se está compactando |
| ✓ Lo logró / ✕ Algo falló | ✓ / ✕ | Resultado de la última acción |
| · Esperando | ⭐ salvapantallas | Listo para tu siguiente tarea |
| 🔭 Espiando | ▍ cursor | Lee lo que escribes (telescopio) |
| 🍿 Viendo una peli | 🎬 película | Lleva 2 min sin tareas |
| 💤 Durmiendo | LED ámbar | Lleva 10 min sin tareas |

**Detalles.** 🪄 varita: está trabajando con una skill (en la pantalla grande sale su nombre junto al proyecto, y en *Ahora* cuál es) · ☕ café: un comando lleva más de 5 s · 💦 sudor: 3 o más ediciones seguidas · ✉ sobre: le escribió a otro agente.

**Trabajando juntos.** Si dos agentes tocan el mismo archivo aparecen lado a lado con un ❤ entre ellos. Un subagente nuevo **entra caminando** con su hoja de tarea y, al terminar, celebra y **se va**.

**La oficina** (en el centro) es decoración viva: las dos ventanas siguen tu hora (amanecer, día, atardecer, noche) y muestran el **escenario** que elijas (oficina, playa, espacio, ciudad, bosque, o uno distinto cada hora). El reloj marca la hora real, y la placa o imagen es el logo de tu empresa (la placa con los colores de letra y fondo que quieras).

**Skins.** Todas las Novas pueden llevar lo mismo puesto: pava jíbara, gorra, audífonos, lentes de sol, corona, mago o navidad (\`/nova skin\`).

**Avisos.** Un sonido suave y una notificación cuando Nova necesita tu permiso (como mucho uno cada 20 s), y otro sonido cuando una ayudante entrega su trabajo. Se apagan por separado en *⚙ Ajustes → Avisos*.

**La pantalla grande** (\`/nova pantalla\`) abre en tu navegador una oficina con **todas tus sesiones de Claude a la vez**, cada una en su escritorio, la primera con tu Nova de *⚙ Ajustes* y las demás con otro color cada una, el mismo que lleva la Nova en el chat de esa sesión (cada chat conserva su color mientras está abierto: abrir o cerrar otro no se lo cambia) («✎ Chat actual» marca el chat donde escribiste por última vez), con sus ayudantes y el resumen del día. Arrástrala a tu otro monitor y ponla a pantalla completa (⌃⌘F). Abajo a la izquierda eliges qué escritorios ver: **Todos**, **Activos** (todos los que no están durmiendo) o **Durmiendo**. Ahí la tecla **S** cambia la skin, la **E** el escenario, y el **⚙** de abajo a la izquierda abre los dos menús; toca un escritorio para ver su historial, la conversación reciente como en un chat (tus mensajes y los de Claude), un botón **Abrir en Claude** que te lleva a ese chat, y un cuadro para **escribirle a ese chat** (Nova lo envía como si lo hubieras escrito tú; si está trabajando, espera a que termine). Solo muestra nombres de archivo y descripciones cortas, nunca el contenido de tus chats, y solo se abre desde tu Mac. Necesita Node.js.

**El cubo de la mesa** (GeekMagic HelloCubic-Lite): mientras Claude está abierto, el cubo enseña a Nova (al abrir Claude, Nova arranca sola el servidor de la pantalla grande, sin abrir el navegador) con su color, su ropa y la misma pose que en la pantalla grande: *Te necesita* (te hizo una pregunta), *Algo falló*, *Trabajando*, *Publicando*, *Navegando*, *Leyendo*, *Respondiendo*, *Pensando…*, *¡Listo!*, *Esperando*, *Viendo una peli* o *Durmiendo*. Si no tienes ningún chat de Claude abierto (o el servidor se apaga), el cubo enseña a tu Nova intentando enchufar su ordenador a la pared (chispa incluida): *Conectando con Claude…*; al abrir Claude vuelve sola. Todo se configura en *⚙ Ajustes → 🧊 Cubo*: la dirección del cubo (con **Probar**), qué Nova enseña (la del chat actual o la más importante de todos), su tamaño, el texto, el brillo y **voltear** (el cristal se ve en espejo, así que Nova se dibuja volteada para que ahí se vea normal). Cada dibujo se hace con Chrome la primera vez que hace falta (unos segundos) y se queda guardado en el cubo; si se llena, quita los que llevan más tiempo sin usarse, nunca tus fotos. La primera vez deja el cubo en el álbum de fotos sin rotar; **↩ Devolver el cubo a como estaba** le pone otra vez su rotación y borra los dibujos de Nova.

**A la derecha**, la tarea en curso:
- **2/5 ▬▬▬▭▭** — barra de pasos de la lista de tareas: verde hecho, amarillo en curso, tenue pendiente.
- **🕒 1m 23s  ✎ 3  ▭ 5** — reloj: tiempo trabajando · lápiz: archivos tocados · terminal: comandos ejecutados.
- **Iconos** — las últimas acciones: 📄 leer · 🔍 buscar · ✎ editar · ›_ comando · 🌐 web · ✓ test que pasa · ✕ fallo.

**Tu día** (pestaña *Ahora*, y día por día en *📅 Historial*): a qué hora empezaste, tu último uso (cuándo cerraste Claude), cuántas horas tuviste Claude abierto y cuántas estuvo Nova trabajando, también ayer y en los últimos 7 días. La pantalla grande muestra lo mismo: arriba tu total de hoy (tócalo para ver tu historial día por día) y, en cada escritorio, las horas de esa sesión (tócalo para verlas por día). Se guarda en tu Mac, minuto a minuto; varios chats abiertos a la vez cuentan una sola vez.

**Opcional.** Registrar tus horas y chatear desde la pantalla grande se pueden apagar en *⚙ Ajustes → Horas y pantalla grande*.

**Personaliza** todo en *⚙ Ajustes*: color de tu Nova, skin, escenario, tamaño, qué piezas de la oficina se ven, tu logo, qué información mostrar y los avisos.`

const COMMANDS = `| Escribe | Para |
|---|---|
| \`/nova pantalla\` | Abrir la pantalla grande con todas tus sesiones (en tu navegador) |
| \`/nova pantalla playa pava rotar\` | Abrirla con un escenario y una skin, rotando escenarios cada 10 min |
| \`/nova pantalla apagar\` | Apagar el servidor de la pantalla grande |
| \`/nova skin pava\` | Skins: clasica, pava, gorra, audifonos, lentes, corona, mago, navidad |
| \`/nova escenario playa\` | Vista por las ventanas: oficina, playa, espacio, ciudad, bosque, auto |
| \`/nova ajustes\` | Abrir los ajustes (también \`/nova config\` o \`/nova avatar\`) |
| \`/nova color naranja\` | Cambiar el color de tu Nova: nova, naranja, morado, rosa, azul, dorado, rojo, violeta, ambar, coral, lima |
| \`/nova tamaño 80\` | Alto de la franja en píxeles (20–200) |
| \`/nova telescopio no\` | Que no espíe mientras escribes (\`si\` para volver) |
| \`/nova logo Mi Empresa\` | Poner el nombre de tu empresa en una placa |
| \`/nova logo ~/Desktop/logo.png\` | Poner tu logo (PNG, JPG, SVG o WebP de hasta ~40 KB) |
| \`/nova logo quitar\` | Quitar el logo |
| \`/nova\` | Abrir la vista grande de las Novas (al lado del chat) |

\`/pets\` sigue funcionando igual que \`/nova\` (es su nombre anterior).

**Consejo:** el logo también se elige con el explorador de *⚙ Ajustes → Elegir imagen…*, sin escribir rutas.`

/**
 * La pantalla grande (HQ Nova IA, de Kevyn): un servidor local que lee tus chats y una página
 * con todas tus sesiones. pantalla/abrir-pantalla-mac.command lo arranca si hace falta y la abre.
 * Palabras: apagar | un escenario | una skin | rotar.
 */
async function pantalla($: EngineInterface, words: string[]): Promise<string> {
  const root = $.plugin.root.replace(/[\\/]+$/, '')
  const windows = /^[a-zA-Z]:[\\/]/.test(root) || root.includes('\\')
  const args: string[] = []
  let say = windows ? 'Pantalla grande abierta en tu 2º monitor (Alt+F4 la cierra).' : 'Pantalla grande abierta en tu navegador. Arrástrala a tu otro monitor y ponla a pantalla completa (⌃⌘F).'
  for (const raw of words) {
    const w = plain(raw)
    if (!w) continue
    if (w === 'apagar' || w === 'cerrar') { args.length = 0; args.push('apagar'); say = 'Servidor de la pantalla grande apagado. Cierra su pestaña del navegador.'; break }
    else if (w === 'rotar') args.push('rotar')
    else if (ESCENARIOS[w] && w !== 'auto') args.push('escena', w)
    else if (SKINS[w]) args.push('skin', w)
    else return `No entendí «${raw}». Uso: /nova pantalla [${Object.keys(ESCENARIOS).filter(k => k !== 'auto').join('|')}] [${Object.keys(SKINS).join('|')}] [rotar] · /nova pantalla apagar`
  }
  try {
    const r = await runScreen($, args)
    if (r.exitCode !== 0) return `No pude abrir la pantalla grande: ${(r.stdout + r.stderr).trim().split('\n').slice(-2).join(' ') || `código ${r.exitCode}`}`
    return say
  } catch {
    return 'No pude abrir la pantalla grande: falta la carpeta pantalla dentro del mod.'
  }
}

/** El lanzador de la pantalla grande: abrir-pantalla-mac.command, o en Windows abrir-pantalla.ps1 (de Kevyn) con sus opciones. */
function runScreen($: EngineInterface, args: string[]) {
  const root = $.plugin.root.replace(/[\\/]+$/, '')
  const windows = /^[a-zA-Z]:[\\/]/.test(root) || root.includes('\\')
  const flag: Record<string, string> = { apagar: '-Apagar', rotar: '-Rotar', escena: '-Escena', skin: '-Skin', servidor: '-SinPantalla' }
  const cmd = windows
    ? ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `${root}\\pantalla\\abrir-pantalla.ps1`, ...args.map(a => flag[a] ?? a)]
    : ['/bin/zsh', `${root}/pantalla/abrir-pantalla-mac.command`, ...args]
  return $.process.run(cmd, { cwd: `${root}/pantalla`, timeoutMs: 30_000 })
}

/** Con un cubo configurado, el servidor de la pantalla grande arranca solo, sin abrir el navegador: es quien le dice al cubo qué enseñar. */
async function serverForCube($: EngineInterface) {
  if ((await cubeConf($)).ip) await runScreen($, ['servidor'])
}

const ago = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.round(ms / 60_000)} min`)

// Accents optional when typing: "castano" finds "castaño".
const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const YES = ['si', 'sí', 'on', 'true', '1']
const NO = ['no', 'off', 'false', '0']

/** Changes some settings: remembered for every chat, shown now. */
async function setSettings($: EngineInterface, patch: Partial<PetSettings>) {
  const next = await update($, settings, s => ({ ...s, ...patch }))
  await $.store.set('settings', next)
  await sharePrefs($, next)
}

/** Your Nova's color and skin, for the big screen: every main Nova there looks like yours here. */
async function sharePrefs($: EngineInterface, s: PetSettings) {
  await $.fs.write(`${await homeDir($)}/.claude/nova-prefs.json`, JSON.stringify({ color: s.color, skin: s.skin, hours: s.hours, remoteChat: s.remoteChat, cubeMirror: s.cubeMirror, cubeFollow: s.cubeFollow, cubeSize: s.cubeSize, cubeLabel: s.cubeLabel, cubeBrt: s.cubeBrt })).catch(() => undefined)
}

/**
 * El cubo de la mesa: su dirección vive en ~/.claude/nova-cubo.json, junto a cómo estaba antes de que
 * Nova lo usara («antes», lo guarda la pantalla grande). La pantalla grande lee ese archivo cada segundo.
 */
type CubeConf = { ip?: string; antes?: { theme_list: { list: string; sw_en: string; sw_i: string }; album: { autoplay: number; i_i: number } } }
const cubeFile = async ($: EngineInterface) => `${await homeDir($)}/.claude/nova-cubo.json`
async function cubeConf($: EngineInterface): Promise<CubeConf> {
  try { return JSON.parse(await $.fs.read(await cubeFile($))) as CubeConf } catch { return {} }
}
const cubeGet = async ($: EngineInterface, ip: string, p: string) => {
  const r = await $.process.run(['curl', '-sf', '--max-time', '4', `http://${ip}/${p}`], { timeoutMs: 8000 })
  if (r.exitCode !== 0) throw new Error(`no responde en ${ip}`)
  return r.stdout
}
async function probeCube($: EngineInterface, ip: string) {
  let msg
  try {
    const v = JSON.parse(await cubeGet($, ip, 'v.json')) as { m?: string; v?: string }
    msg = `✓ Conectado: ${v.m ?? 'cubo'} ${v.v ?? ''}`.trim()
  } catch { msg = `✗ El cubo no responde en ${ip}. ¿Está encendido y en tu misma red Wi-Fi?` }
  await update($, cubeMsg, () => msg)
}
async function saveCubeIp($: EngineInterface, raw: string) {
  const ip = raw.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  // Solo una dirección o un nombre de la red: va dentro de una URL y de un comando.
  if (!/^[\w.-]+(:\d{1,5})?$/.test(ip)) return void (await update($, cubeMsg, () => `✗ «${raw.trim()}» no parece una dirección (p. ej. 192.168.1.50).`))
  const conf = await cubeConf($)
  // Otro cubo: lo de «antes» era del anterior.
  await $.fs.write(await cubeFile($), JSON.stringify(conf.ip === ip ? conf : { ip }, null, 2))
  await probeCube($, ip)
  void serverForCube($).catch(() => undefined)
}
/** Le devuelve al cubo su rotación de temas y de fotos, borra los dibujos de Nova y deja de usarlo. */
async function restoreCube($: EngineInterface) {
  const { ip, antes } = await cubeConf($)
  if (!ip) return
  try {
    if (antes) {
      await cubeGet($, ip, `set?theme_list=${antes.theme_list.list}&sw_en=${antes.theme_list.sw_en}&theme_interval=${antes.theme_list.sw_i}`)
      await cubeGet($, ip, `set?i_i=${antes.album.i_i}&autoplay=${antes.album.autoplay}`)
    }
    const files = [...(await cubeGet($, ip, 'filelist?dir=/image/')).matchAll(/>(nv-[\w-]+\.gif)</g)].map(m => m[1]!)
    for (const f of files) await cubeGet($, ip, `delete?file=${encodeURIComponent('/image/' + f)}`).catch(() => undefined)
    await $.fs.write(await cubeFile($), '{}')
    await update($, cubeMsg, () => '')
    $.ui.toast('El cubo volvió a como estaba y Nova ya no lo usa.')
  } catch {
    await update($, cubeMsg, () => `✗ El cubo no responde en ${ip}: enciéndelo y vuelve a intentarlo.`)
  }
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', gif: 'image/gif' }
// shortcut: the whole band drawing must stay under the Svg's 131072 characters; bigger logos are refused, not resized.
const LOGO_MAX = 60_000

/** A logo from a path to an image, a company name, or "quitar"; returns what to tell the person. */
async function setLogo($: EngineInterface, arg: string): Promise<string> {
  const v = arg.trim().replace(/^["']|["']$/g, '')
  const prev = await read($, logo)
  if (['quitar', 'ninguno', 'none', ''].includes(plain(v.toLowerCase()))) {
    await saveLogo($, { ...prev, mode: 'none' })
    return 'Logo quitado de la pared (se guarda por si lo vuelves a poner).'
  }
  const ext = /\.([a-z0-9]+)$/i.exec(v)?.[1]?.toLowerCase()
  let next: Logo
  if (ext && MIME[ext] && (v.startsWith('/') || v.startsWith('~') || v.startsWith('.') || WIN_PATH.test(v))) {
    const path = slashes(v.startsWith('~') ? v.replace('~', await homeDir($)) : v)
    const bytes = await $.fs.read(path, { as: 'bytes' }).catch(() => undefined)
    if (!bytes) return `No pude leer ${v}.`
    const uri = `data:${MIME[ext]};base64,${bytes.base64}`
    if (uri.length > LOGO_MAX) return `El logo pesa demasiado (${Math.round(uri.length / 1024)} KB); usa una imagen de menos de ~40 KB.`
    next = { ...prev, image: uri, file: path, mode: 'image' }
  } else {
    next = { ...prev, text: v.slice(0, 24), mode: 'text' }
  }
  await saveLogo($, next)
  return next.mode === 'image' ? 'Logo de la empresa puesto en la pared.' : `Placa de la empresa: ${next.text}.`
}

async function saveLogo($: EngineInterface, next: Logo) {
  await update($, logo, () => next)
  await $.store.set('logo', next)
}

// The plaque's color chips: colored dots stand in for swatches (a button can't be painted).
const INKS: [string, string][] = [['🟡 Dorado', '#FBBF24'], ['⚪ Blanco', '#FFFFFF'], ['⚫ Negro', '#111827'], ['🔵 Azul', '#3B82F6'], ['🟢 Verde', '#10B981'], ['🔴 Rojo', '#EF4444'], ['🟣 Morado', '#A78BFA'], ['🟠 Naranja', '#F97316']]
const PAPERS: [string, string][] = [['🔷 Marino', '#1e293b'], ['⚫ Negro', '#111827'], ['⚪ Blanco', '#FFFFFF'], ['🔵 Azul', '#1D4ED8'], ['🟢 Verde', '#065F46'], ['🔴 Rojo', '#991B1B'], ['🟣 Morado', '#5B21B6'], ['◻ Sin fondo', 'none']]
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

const IMAGE_EXT = /\.(png|jpe?g|svg|webp|gif)$/i
// Windows: una ruta con letra de unidad, y todo con / para que las cuentas de carpetas sirvan igual.
const WIN_PATH = /^[a-zA-Z]:[\\/]/
const slashes = (p: string) => p.replace(/\\/g, '/')
async function homeDir($: EngineInterface): Promise<string> {
  const home = (await $.env.get('HOME').catch(() => undefined)) ?? (await $.env.get('USERPROFILE').catch(() => undefined))
  return slashes(home ?? '/')
}
// ~40 KB of image is ~55 KB as base64: the band's drawing stays under its 131072-character cap.
const LOGO_BYTES = 40_000
const kb = (n: number) => (n < 1024 ? `${n} B` : `${Math.round(n / 1024)} KB`)
const PLACES: [string, string][] = [['🖥 Escritorio', '/Desktop'], ['⬇ Descargas', '/Downloads'], ['🏞 Imágenes', '/Pictures'], ['📄 Documentos', '/Documents']]
const SIZES: [string, number][] = [['S', 40], ['M', 60], ['L', 80], ['XL', 100]]
const COLOR_DOT: Record<string, string> = { nova: '🟢', naranja: '🟠', morado: '🟣', rosa: '🩷', azul: '🔵', dorado: '🟡', rojo: '🔴' }

async function openPicker($: EngineInterface) {
  // Start where the last logo came from, else the Desktop.
  const home = await homeDir($)
  const last = (await read($, logo)).file
  await update($, browse, b => ({ dir: b.dir || (last ? last.replace(/\/[^/]+$/, '') : `${home}/Desktop`) }))
  await $.ui.open({ id: PICKER, title: 'Elegir el logo de tu empresa', focus: true, closeOnEscape: true, rows: 28 })
}

function openSettings($: EngineInterface) {
  return $.ui.open({ id: SETTINGS, title: 'Ajustes de Nova', focus: true, closeOnEscape: true, rows: 30 })
}

/** The office wall, the history strip and the progress, each its own drawing, beside the desks. */
function extras(Svg: ElementConstructor<{ source: string; alt: string; width?: number; height?: number }>, Box: ElementConstructor<BoxProps>,
  set: PetSettings, brand: Logo, acts: Act[], steps: Plan | null, score: Stats) {
  const now = Date.now()
  const parts = [
    ['office', officeSvg(set, brand, new Date(now)), 'La oficina'],
    ['readout', readoutSvg(steps ?? undefined, score, acts, set, now), 'Progreso y actividad'],
  ] as const
  return parts.map(([key, d, alt]) => (d ? <Box key={key}><Svg source={d.source} width={d.width} height={d.height} alt={alt} /></Box> : null))
}

/** The history icon a tool call leaves. */
export function actFor(tool: string, cmd: string): Act | undefined {
  if (tool === 'Read' || tool === 'NotebookRead') return 'read'
  if (EDIT_TOOLS.has(tool)) return 'edit'
  if (tool === 'Grep' || tool === 'Glob' || tool === 'LS') return 'search'
  if (tool === 'WebFetch' || tool === 'WebSearch') return 'web'
  if (tool === 'Agent' || tool === 'Task') return 'agent'
  if (tool === 'Skill') return 'skill'
  if (tool === 'AskUserQuestion') return 'ask'
  if (isShell(tool)) return SHIP_CMD.test(cmd) ? 'ship' : TEST_CMD.test(cmd) ? 'ok' : 'cmd'
  return undefined
}

/** The plan after a call to a task-list tool (this app's update_plan, the CLI's TodoWrite); undefined for any other. */
export function planFrom(tool: string, args: Record<string, unknown>, prev: Plan | null): Plan | null | undefined {
  type Item = { status?: string }
  if (tool === 'TodoWrite' && Array.isArray(args.todos)) {
    const todos = args.todos as Item[]
    return { total: todos.length, done: todos.filter(t => t.status === 'completed').length }
  }
  // This app's wrap_up closes the turn and checks off the whole list.
  if (tool.endsWith('wrap_up')) return prev ? { ...prev, done: prev.total } : undefined
  if (!tool.endsWith('update_plan')) return undefined
  if (Array.isArray(args.items)) {
    const items = args.items as Item[]
    return { total: items.length, done: items.filter(t => t.status === 'completed').length }
  }
  if (!prev) return undefined
  if (args.advance === true) return { ...prev, done: Math.min(prev.total, prev.done + 1) }
  if (Array.isArray(args.done)) return { ...prev, done: Math.min(prev.total, Math.max(prev.done, ...(args.done as number[]))) }
  return undefined
}

// Avisos: cuando Nova pide permiso, un sonido suave y una notificación, como mucho una vez cada ALERT_MS.
const ALERT_MS = 20_000
const SOUNDS = { permiso: 'hooks/sounds/permiso.wav', entrega: 'hooks/sounds/entrega.wav' } as const
let lastAsk = -Infinity

/** Un sonido del mod, si el sonido está activado. */
async function chime($: EngineInterface, which: keyof typeof SOUNDS) {
  if ((await read($, settings)).sound) await $.audio.play({ asset: SOUNDS[which] })
}

/** Nova pide permiso: suena y avisa, salvo que ya lo hiciera hace menos de ALERT_MS. */
async function alertAsk($: EngineInterface, task: string, now: number) {
  // Marcado antes de esperar nada, para que dos permisos a la vez avisen una sola vez;
  // abs: un reloj atrasado de golpe no deja los avisos mudos.
  if (Math.abs(now - lastAsk) < ALERT_MS) return
  lastAsk = now
  const set = await read($, settings)
  const text = `Nova necesita tu permiso · ${task}`
  await Promise.all([
    set.sound ? $.audio.play({ asset: SOUNDS.permiso }).catch(() => undefined) : undefined,
    set.notify
      ? $.ui.notify(text, { title: 'HQ Nova IA' }).then(sent => {
          // Sin terminal que notifique (la app de escritorio): un aviso dentro de la app.
          if (!sent.isSent && (sent.reason === 'no-surface' || sent.reason === 'no-channel')) $.ui.toast(text)
        }).catch(() => undefined)
      : undefined,
  ])
}

let ticker: Timer | undefined
const touched = new Set<string>()

const CALM_MS = 700
let inTurn = false

let lastLogged = ''
/** Marks this minute in your hours log (store 'uso'): Claude open, and working while a turn runs. */
async function logMinute($: EngineInterface) {
  const t = await $.clock.now()
  const stamp = `${Math.floor(t / 60_000)}:${inTurn}`
  if (stamp === lastLogged) return
  lastLogged = stamp
  // shortcut: read-then-write, so two chats in the same second can drop one minute; fine for hours.
  const id = await $.session.id().catch(() => undefined)
  if (!id) return
  if ((await read($, settings)).hours) {
    const log = ((await $.store.get('uso').catch(() => undefined)) ?? {}) as Usage
    const next = mark(log, t, inTurn)
    if (next) await $.store.set('uso', next).catch(() => undefined)
    // The big screen reads the same hours, overall and per chat, from a file beside Claude's own.
    const path = `${await homeDir($)}/.claude/nova-uso.json`
    const file = await $.fs.read(path).then(text => JSON.parse(String(text)) as UsageFile).catch(() => undefined)
    await $.fs.write(path, JSON.stringify(markFile(file, id, next ?? log, t, inTurn))).catch(() => undefined)
  }
  // This chat's color: picked once when it opens (one no other open chat wears) and kept, as on the big screen.
  // shortcut: read-then-write like the hours file; two chats picking at once sort it out on the next beat.
  const regPath = `${await homeDir($)}/.claude/nova-sesiones.json`
  const main = (await read($, settings)).color
  const reg = touchSession(await $.fs.read(regPath).then(text => JSON.parse(String(text)) as Sessions).catch(() => undefined), id, t, main)
  await $.fs.write(regPath, JSON.stringify(reg)).catch(() => undefined)
  const slot = reg[id]?.slot ?? 'main'
  if (slot !== sessionSlot) { sessionSlot = slot; $.ui.invalidate('ui.render') }
}

/**
 * Messages you wrote to this chat from the big screen: the screen leaves them in ~/.claude/nova-inbox/<session>.json
 * and this chat sends them as if you had typed them (they wait for the turn in progress, like a typed prompt).
 */
async function checkInbox($: EngineInterface) {
  if (!(await read($, settings)).remoteChat) return
  const id = await $.session.id().catch(() => undefined)
  if (!id) return
  const path = `${await homeDir($)}/.claude/nova-inbox/${id}.json`
  const queue = await $.fs.read(path).then(text => JSON.parse(String(text)) as unknown).catch(() => undefined)
  if (!Array.isArray(queue) || queue.length === 0) return
  // Emptied first, so a slow send is never sent twice.
  await $.fs.write(path, '[]')
  for (const m of queue) {
    const text = typeof m?.text === 'string' ? m.text.trim().slice(0, 4000) : ''
    if (text) await $.prompt.submit({ text, asUser: true })
  }
}

/** This chat's color slot among the open ones: 'main' wears your Nova's color from the settings. */
let sessionSlot = 'main'
const myColor = (s: PetSettings) => (sessionSlot === 'main' ? s.color : sessionSlot)
const edits = new Map<string, number>()
// Tool calls running per agent: the coffee waits for the first and ends with the last.
const calls = new Map<string, number>()
const timers = new Map<string, Timer>()

/** Runs fn(now) after ms; scheduling a key again replaces its pending timer. */
function later($: EngineInterface, key: string, ms: number, fn: (now: number) => unknown) {
  timers.get(key)?.cancel()
  timers.set(key, $.clock.after(ms, () => {
    timers.delete(key)
    void $.clock.now().then(fn).catch(() => undefined)
  }))
}

function cancel(key: string) {
  timers.get(key)?.cancel()
  timers.delete(key)
}

/** A pose for FLASH_MS, then `after`, unless something else moved the pet meanwhile. */
function flash($: EngineInterface, id: string, patch: Partial<Pet>, after: Partial<Pet>, now: number) {
  void change($, setPet(id, patch, now)).catch(() => undefined)
  later($, `flash:${id}`, FLASH_MS, t => change($, setPet(id, after, t, p => p.mood === patch.mood)))
}

/** While Claude waits: a movie after a while, sleep after longer. */
function idleTimers($: EngineInterface) {
  const tire = (mood: PetMood, task: string) => (now: number) => change($, setPet(MAIN, { mood, task }, now, p => IDLE.has(p.mood)))
  later($, 'stretch', STRETCH_MS, tire('watching', 'viendo una peli'))
  later($, 'sleep', SLEEP_MS, tire('sleeping', 'dormido'))
}

const READ_MS = 8000 // matches the .tscope sweep in scene.ts
// A cursor this many characters in reads as the far right of the box.
const AIM_COLUMNS = 60
const LANE = 20

/** A keystroke: peeking now, back to waiting `calmMs` after the last one; `at` aims the telescope. */
async function poke($: EngineInterface, calmMs: number, at?: number) {
  await setTyping($, true)
  if (at !== undefined) {
    // Rounded to the lane's steps, so most keys move nothing and write nothing.
    const step = Math.round(Math.min(1, Math.max(0, at)) * LANE) / LANE
    if ((await read($, aim)) !== step) await update($, aim, () => step)
  }
  // Typing pulls Claude back from the movie or from sleep, and restarts the idle clock.
  await change($, setPet(MAIN, WAITING, await $.clock.now(), p => IDLE.has(p.mood)))
  if (!inTurn) idleTimers($)
  later($, 'calm', calmMs, () => setTyping($, false))
}

/** Writes only on a change, so a redraw never triggers another. */
async function setTyping($: EngineInterface, value: boolean) {
  if ((await read($, typing)) !== value) await update($, typing, () => value)
}

export function withTyping(list: Pet[], isTyping: boolean): Pet[] {
  return isTyping ? list.map(p => (p.id === MAIN && IDLE.has(p.mood) ? { ...p, mood: 'peeking' as const } : p)) : list
}

function altText(list: Pet[]): string {
  return list.map(p => `${p.name}: ${p.task}${p.skill ? ` (skill ${p.skill})` : ''}`).join('; ')
}

// Terminal fallback (no Svg there): one line per pet or group.
function textView({ Box, Text }: { Box: ElementConstructor<BoxProps>; Text: ElementConstructor<TextProps> }, list: Pet[], aimAt = 0) {
  const animal = (p: Pet) => ANIMALS[hash(p.id) % ANIMALS.length]
  // Peeking: the telescope rides a lane, at the cursor's place in the draft.
  const lane = () => { const n = Math.round(aimAt * LANE); return '·'.repeat(n) + '🔭' + '·'.repeat(LANE - n) }
  const lines = groups(list).flatMap(g =>
    g.length > 1
      ? [{ text: `${g.map(animal).join('')} ${FACES.working} 🤝 ${g.map(p => p.name).join(' + ')}: ${g[0]?.task}`, isOn: true }]
      : g.map(p => ({ text: p.mood === 'peeking' ? `${animal(p)} (¬‿¬) ${p.name} ${lane()}` : `${animal(p)} ${FACES[p.mood]} ${p.name} · ${p.task}`, isOn: p.mood === 'working' })),
  )
  return (
    <Box flexDirection="column">
      {lines.map(l => (
        <Text color={l.isOn ? 'green' : undefined} dimColor={!l.isOn}>{l.text}</Text>
      ))}
    </Box>
  )
}
