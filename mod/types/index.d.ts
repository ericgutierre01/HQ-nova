/** `peeking` is never stored: the band draws a waiting Claude that way while you type. */
export type PetMood =
  | 'working' | 'reading' | 'browsing' | 'answering' | 'thinking' | 'asking' | 'shipping' | 'tidying'
  | 'error' | 'success' | 'waiting' | 'peeking' | 'watching' | 'sleeping' | 'done'

export type Pet = {
  id: string
  name: string
  mood: PetMood
  task: string
  /** What it touches (a file, a command); pets with the same focus work together. */
  focus: string
  /** When the mood last changed (ms since epoch): the scene pops a pet whose mood just changed. */
  since?: number
  /** While working: `writing` the call (green screen) or `running` it (red screen). */
  phase?: 'writing' | 'running'
  /** Three or more edits in a row. */
  sweat?: boolean
  /** A command running for more than a few seconds. */
  coffee?: boolean
  /** Just sent a message to another agent. */
  mail?: boolean
  /** Walking in (a new subagent) or out (one that finished). */
  entering?: boolean
  leaving?: boolean
  /** Nova HQ: el color de la ayudante según su tipo (Explore azul, Plan violeta…). Nova principal usa el de los ajustes. */
  palette?: string
  /** Nova HQ: el tipo de subagente (Explore, Plan, general-purpose…). */
  agentType?: string
  /** The skill it is working with (from its Skill call until the turn ends). */
  skill?: string
  /** HQ Nova IA: la skin de esta Nova (clave de SKINS en scene.ts); sin ella, la de los ajustes. */
  skin?: string
}

/** Everything a person can tune; kept in the mod's store, so it holds across chats. */
export type PetSettings = {
  color: string
  size: number
  peek: boolean
  /** Two tall windows, one each side of the clock and logo. */
  window: boolean
  clock: boolean
  logo: boolean
  history: boolean
  progress: boolean
  stats: boolean
  /** Nova HQ: un sonido suave cuando Nova pide permiso y otro cuando una ayudante entrega. */
  sound: boolean
  /** Nova HQ: una notificación del sistema cuando Nova pide permiso. */
  notify: boolean
  /** Log the minutes Claude is open and Nova works (Tu día, Historial, the big screen's hours). */
  hours: boolean
  /** Let the big screen show a chat's conversation and send it messages as you. */
  remoteChat: boolean
  /** El cubo de cristal se ve en espejo: dibujar a Nova volteada para que ahí se lea bien. */
  cubeMirror: boolean
  /** Qué Nova enseña el cubo: la del chat actual, o la más importante de todos los chats. */
  cubeFollow: 'actual' | 'todos'
  /** Lo grande que sale Nova en el cubo. */
  cubeSize: 'chica' | 'mediana' | 'grande'
  /** El texto debajo de Nova en el cubo (Trabajando, Te necesita…). */
  cubeLabel: boolean
  /** Brillo del cubo, 1–255; 0 = no tocarlo. */
  cubeBrt: number
  /** HQ Nova IA: lo que llevan puesto todas las Novas (clave de SKINS en scene.ts). */
  skin: string
  /** HQ Nova IA: lo que se ve por las ventanas (clave de ESCENARIOS en office.ts). */
  scene: string
}

/** The company logo: an image (a data: URI) or, without one, a name on a plaque. */
/**
 * The company logo on the office wall: what shows is `mode` ('none', the name on a plaque, or
 * the image). Both the name and the image are kept, so switching back needs no re-entry.
 * Without a mode (older saves) the image wins, then the name.
 */
export type Logo = {
  mode?: 'none' | 'text' | 'image'
  image?: string
  text?: string
  file?: string
  /** The plaque's letters and background (CSS colors; 'none' background = no fill). */
  ink?: string
  paper?: string
}

/** Kinds of action the history strip draws, one icon each. */
export type Act = 'read' | 'edit' | 'cmd' | 'search' | 'web' | 'agent' | 'ask' | 'ship' | 'ok' | 'fail' | 'skill'

/** Where the task stands, from the plan's steps. */
export type Plan = { done: number; total: number }

/** The current (or last) turn: when it began and ended, files touched, commands run. */
export type Stats = { start?: number; end?: number; files: number; cmds: number }

/** The logo picker: the folder shown and the image picked in it. */
export type Browse = { dir: string; picked?: string }

declare module 'claude-code' {
  interface PluginState {
    'nova-hq': { pets: Pet[]; typing: boolean; aim: number; prefs: PetSettings; logo: Logo; history: Act[]; plan: Plan | null; stats: Stats; browse: Browse; infoTab: string; settingsTab: string; cubeMsg: string }
  }
}
