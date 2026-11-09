// La oficina: estado de cada Nova (sesión principal) y de cada ayudante (subagente),
// alimentado línea por línea con los transcripts de Claude Code.
import { describeTool, isCommand, isDelegation, isEdit, projectName, sessionTitle, taskTitle } from './sanitize.mjs';
import { paletteFor } from '../../hooks/nova.js';
import { sessionColor, slotColor } from '../../hooks/usage.js';

const MIN = 60_000;
export const TIMING = {
  happyMs: 5_000,          // "¡Listo!" después de terminar un turno
  errorMs: 6_000,          // cara de "tropecé" después de un error
  activeMs: 2 * MIN,       // pensando/respondiendo sin líneas nuevas → en pausa
  sleepMs: 10 * MIN,       // en pausa → durmiendo
  goneMs: 2 * 60 * MIN,    // durmiendo → se va de la oficina
  staleToolMs: 30 * MIN,   // una herramienta "pendiente" más vieja que esto no cuenta
  helperLingerMs: 3_800,   // la ayudante celebra (2.5 s), sale caminando y se va (como en la banda)
  helperLeaveMs: 2_500,
  enterMs: 1_300,          // la ayudante entra caminando con su hoja
  flashMs: 2_200,          // "¡lo logró!" cuando pasan los tests
  coffeeMs: 5_000,         // un comando que tarda: café
  watchMs: 2 * MIN,        // en pausa → viendo una peli
  helperIdleMs: 15 * MIN,  // ayudante sin actividad → se va
  helperNoShowMs: 20_000,  // delegación que nunca abrió su transcript
};
const STEPS = 12;
const WAITING_ICONS = new Set(['ask', 'plan']);
// Las mismas poses que la banda (mod/hooks/register.tsx, de nova-hq): mood por herramienta.
const READING_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead', 'Agent', 'Task', 'TaskOutput']);
const TEST_CMD = /\b(test|tests|jest|vitest|pytest|mocha|rspec|phpunit)\b/;
const SHIP_CMD = /\bgit\s+(commit|push)\b/;
function moodFor(name, input) {
  const cmd = String(input?.command ?? '');
  if (name === 'WebSearch' || name === 'WebFetch' || /^mcp__.*(browser|chrome)/i.test(name)) return 'browsing';
  if (name === 'AskUserQuestion' || name === 'ExitPlanMode') return 'asking';
  if (isCommand(name) && SHIP_CMD.test(cmd)) return 'shipping';
  if (READING_TOOLS.has(name)) return 'reading';
  return 'working';
}
const VIEW_MOOD = { thinking: 'thinking', talking: 'answering', error: 'error', sleeping: 'sleeping' };

const fileName = p => String(p || '').split(/[\\/]/).filter(Boolean).pop() || '';
const LOG_MAX = 80;
const dayKey = ms => new Date(ms).toLocaleDateString('en-CA');
const blankStats = () => ({ tools: 0, edits: 0, commands: 0, helpers: 0, errors: 0 });

export class Office {
  constructor({ emit = () => {}, now = () => Date.now() } = {}) {
    this.emit = emit;         // (type, payload) — pulsos en vivo hacia la pantalla
    this.now = now;
    this.agents = new Map();  // id → registro interno
    this.helperKey = new Map(); // agentId del archivo del subagente → id de la ayudante
    this.delegations = new Map(); // toolUseId de la llamada Agent → id de la ayudante
    this.day = dayKey(now());
    this.stats = blankStats();
    this.mainPalette = 'nova'; // el color de tu Nova en /nova ajustes
    this.sessionOrder = [];    // las sesiones abiertas en Claude, por orden de apertura (las anota el mod)
    this.sessions = {};        // el registro entero: de ahí sale el color que eligió cada sesión
  }

  // ── registros ────────────────────────────────────────────────────────────
  #blank(id, kind, sessionId) {
    return {
      id, kind, sessionId, parentId: null, project: '', worktree: false, title: '',
      agentType: '', task: '', palette: kind === 'main' ? this.mainPalette : paletteFor('', id), background: null,
      pending: new Map(), last: { kind: 'none', at: 0 }, lastAt: 0, firstAt: 0,
      steps: [], counts: { tools: 0, edits: 0, commands: 0 },
      hasFile: kind === 'main', endTurnAt: 0, parentResultAt: 0, delegatedAt: 0,
      editStreak: 0, flash: null,
      log: [], files: [], // solo la principal: lo que pasó en la sesión (para el panel de detalle)
    };
  }

  main(sessionId) {
    const id = `s:${sessionId}`;
    let a = this.agents.get(id);
    if (!a) this.agents.set(id, (a = this.#blank(id, 'main', sessionId)));
    return a;
  }

  /** La ayudante nace cuando su Nova delega (llamada Agent) y se identifica por ese toolUseId. */
  #helperForDelegation(toolUseId, parent, input, t) {
    const id = `h:${toolUseId}`;
    let h = this.agents.get(id);
    if (!h) this.agents.set(id, (h = this.#blank(id, 'helper', parent.sessionId)));
    h.parentId = parent.id;
    h.project = parent.project;
    h.agentType = input?.subagent_type || h.agentType || 'general-purpose';
    h.task = taskTitle(input?.description || h.task);
    h.palette = paletteFor(h.agentType, toolUseId);
    h.background = input?.run_in_background === true ? true : h.background;
    h.delegatedAt = h.delegatedAt || t;
    h.firstAt = h.firstAt || t;
    h.lastAt = Math.max(h.lastAt, t);
    this.delegations.set(toolUseId, id);
    return h;
  }

  /** El archivo de un subagente: lo enlaza con su delegación usando su .meta.json. */
  helper(agentId, sessionId, meta) {
    let id = this.helperKey.get(agentId);
    if (!id) {
      id = meta?.toolUseId ? `h:${meta.toolUseId}` : `a:${agentId}`;
      this.helperKey.set(agentId, id);
    }
    let h = this.agents.get(id);
    if (!h) this.agents.set(id, (h = this.#blank(id, 'helper', sessionId)));
    h.hasFile = true;
    if (!h.parentId) h.parentId = this.main(sessionId).id;
    if (meta) {
      if (meta.agentType) h.agentType = meta.agentType;
      if (meta.description && !h.task) h.task = taskTitle(meta.description);
      if (meta.requestShape) h.background = meta.requestShape === 'background';
      h.palette = paletteFor(h.agentType, meta.toolUseId || agentId);
    }
    return h;
  }

  setSessionTitle(sessionId, title) {
    if (title) this.main(sessionId).title = sessionTitle(title);
  }

  // ── ingestión ────────────────────────────────────────────────────────────
  /**
   * @param {object} d       una línea del transcript ya parseada
   * @param {object} ctx     { sessionId, agentId?, meta?, live: boolean }
   */
  ingest(d, ctx) {
    const t = Date.parse(d.timestamp) || this.now();
    const a = ctx.agentId ? this.helper(ctx.agentId, ctx.sessionId, ctx.meta) : this.main(ctx.sessionId);
    const live = !!ctx.live;
    // Sesiones que lanza un programa y no tú (p. ej. la revisión de seguridad automática, entrypoint sdk-py):
    // no son chats tuyos, así que no tienen escritorio ni cuentan en las estadísticas.
    if (d.entrypoint) a.auto = /^sdk/.test(d.entrypoint);
    if (a.auto || (a.kind === 'helper' && this.agents.get(a.parentId)?.auto)) return;

    if (d.type === 'custom-title') return this.setSessionTitle(ctx.sessionId, d.customTitle);
    if (d.type === 'agent-name') {
      const m = this.main(ctx.sessionId);
      if (!m.title) m.title = sessionTitle(d.agentName);
      return;
    }
    if (d.cwd && !a.rooted) Object.assign(a, projectName(d.cwd, ctx.projectDir));
    if (a.kind === 'helper' && !a.project) a.project = this.agents.get(a.parentId)?.project || '';

    if (d.type === 'assistant') {
      const msg = d.message || {};
      const blocks = Array.isArray(msg.content) ? msg.content : [];
      const ended = msg.stop_reason === 'end_turn' || msg.stop_reason === 'stop_sequence';
      for (const b of blocks) {
        if (b.type === 'thinking' || b.type === 'redacted_thinking') this.#touch(a, 'thinking', t);
        else if (b.type === 'text') {
          // La última respuesta de Claude: solo para el detalle de su escritorio (donde le puedes contestar), nunca en la oficina.
          if (a.kind === 'main' && String(b.text || '').trim()) {
            a.lastReply = { text: String(b.text).slice(0, 8000), at: t };
            this.#say(a, 'claude', String(b.text), t);
          }
          this.#touch(a, ended ? 'done' : 'talking', t);
          if (ended) {
            a.endTurnAt = t;
            a.skill = null;
            if (live) this.emit('pulse', this.#pulse(a, 'done', a.kind === 'helper' ? 'Entregó su parte' : '¡Listo!', 'done', t));
          }
        } else if (b.type === 'tool_use') {
          // La skill con la que trabaja, hasta que termine el turno.
          if (b.name === 'Skill' && b.input?.skill) a.skill = String(b.input.skill).slice(0, 40);
          this.#toolUse(a, b, t, live);
          // La app de escritorio cierra el turno con wrap_up: con una pregunta, no llega texto después.
          if (String(b.name).endsWith('wrap_up') && b.input?.ask) a.endsWith = b.id;
        }
      }
      return;
    }

    if (d.type === 'user') {
      const c = d.message?.content;
      // Un comando como /reload-plugins (y su salida) no es un mensaje tuyo: Nova no se pone a pensar.
      if (typeof c === 'string' && /^<(command-|local-command)/.test(c)) return;
      if (typeof c === 'string') {
        // Aviso de que una ayudante en segundo plano terminó: solo se lee su id, nada del texto.
        const done = a.kind === 'main' && c.startsWith('<task-notification>') ? /<task-id>([\w-]+)<\/task-id>/.exec(c)?.[1] : null;
        if (done) {
          const h = this.agents.get(this.helperKey.get(done));
          if (h && !h.endTurnAt) {
            h.endTurnAt = t;
            if (live) this.emit('pulse', { ...this.#pulse(a, 'agent', `${h.agentType || 'Ayudante'} entregó su parte`, 'return', t), helperId: h.id });
          }
          this.#touch(a, 'thinking', t);
          return;
        }
        if (!d.isMeta && a.kind === 'main') {
          a.skill = null; // un mensaje nuevo empieza otro turno
          this.#say(a, 'you', c, t);
          this.#touch(a, 'prompt', t);
          a.lastPromptAt = Math.max(a.lastPromptAt || 0, t);
          if (live) this.emit('pulse', this.#pulse(a, 'prompt', 'Recibió un mensaje', 'prompt', t));
        } else this.#touch(a, 'thinking', t);
        return;
      }
      if (!Array.isArray(c)) return;
      for (const b of c) {
        if (b.type === 'tool_result') {
          this.#toolResult(a, b, t, live);
          if (b.tool_use_id === a.endsWith) { a.endsWith = null; a.endTurnAt = t; a.skill = null; this.#touch(a, 'done', t); }
        }
        else if (b.type === 'text' && !d.isMeta && a.kind === 'main') {
          this.#say(a, 'you', String(b.text || ''), t);
          this.#touch(a, 'prompt', t);
          a.lastPromptAt = Math.max(a.lastPromptAt || 0, t);
        }
      }
      return;
    }

    if (d.type === 'system' && d.subtype === 'api_error') {
      this.#touch(a, 'error', t);
      if (live) this.emit('pulse', this.#pulse(a, 'error', 'Error de la API', 'error', t, true));
    }
  }

  /** La conversación reciente de un chat, para el detalle de su escritorio: tus mensajes y las respuestas de Claude. */
  #say(a, who, text, t) {
    text = text.trim();
    if (!text || text.startsWith('<')) return; // avisos del sistema (<task-notification>, <system-reminder>…)
    a.chat ??= [];
    const last = a.chat.at(-1);
    // Varios trozos seguidos de Claude en el mismo turno son una sola respuesta.
    if (last && last.who === who && who === 'claude') { last.text = (last.text + '\n\n' + text).slice(-8000); last.at = t; }
    else a.chat.push({ who, text: text.slice(0, 8000), at: t });
    if (a.chat.length > 30) a.chat.splice(0, a.chat.length - 30);
  }

  #touch(a, kind, t) {
    if (t >= a.last.at) a.last = { kind, at: t };
    a.lastAt = Math.max(a.lastAt, t);
    a.firstAt = a.firstAt || t;
  }

  #toolUse(a, b, t, live) {
    const { label, icon } = describeTool(b.name, b.input);
    // Una ayudante que entrega su informe con SubagentHandback ya terminó.
    if (a.kind === 'helper' && b.name === 'SubagentHandback' && !a.endTurnAt) {
      a.endTurnAt = t;
      if (live) this.emit('pulse', this.#pulse(a, 'done', 'Entregó su parte', 'done', t));
    }
    // El comando solo se mira aquí (¿tests? ¿git push?); nunca sale del servidor.
    const isTest = isCommand(b.name) && TEST_CMD.test(String(b.input?.command ?? ''));
    a.pending.set(b.id, { name: b.name, label, icon, t, mood: moodFor(b.name, b.input), isTest });
    a.editStreak = isEdit(b.name) ? a.editStreak + 1 : READING_TOOLS.has(b.name) ? a.editStreak : 0;
    const root = this.main(a.sessionId);
    root.log.push({ id: b.id, t, icon, label, by: a.kind === 'main' ? 'Nova' : (a.agentType || 'Ayudante'), palette: a.palette, err: false });
    if (root.log.length > LOG_MAX) root.log.shift();
    if (isEdit(b.name)) {
      const f = fileName(b.input?.file_path || b.input?.notebook_path);
      if (f) root.files = [f, ...root.files.filter(x => x !== f)].slice(0, 40);
    }
    a.steps.push({ icon, err: false, id: b.id });
    if (a.steps.length > STEPS) a.steps.shift();
    a.counts.tools++;
    if (isEdit(b.name)) a.counts.edits++;
    if (isCommand(b.name)) a.counts.commands++;
    this.#touch(a, 'tool', t);

    const today = dayKey(t) === this.day;
    if (today) {
      this.stats.tools++;
      if (isEdit(b.name)) this.stats.edits++;
      if (isCommand(b.name)) this.stats.commands++;
    }
    if (isDelegation(b.name)) {
      const h = this.#helperForDelegation(b.id, a, b.input, t);
      if (today) this.stats.helpers++;
      if (live) this.emit('pulse', { ...this.#pulse(a, 'agent', label, 'delegate', t), helperId: h.id });
      return;
    }
    if (live) this.emit('pulse', this.#pulse(a, icon, label, 'tool', t));
  }

  #toolResult(a, b, t, live) {
    const p = a.pending.get(b.tool_use_id);
    a.pending.delete(b.tool_use_id);
    const err = b.is_error === true;
    if (p?.isTest && !err) a.flash = { mood: 'success', label: 'Los tests pasan', until: t + TIMING.flashMs };
    if (err) {
      const entry = this.main(a.sessionId).log.find(x => x.id === b.tool_use_id);
      if (entry) entry.err = true;
      const s = a.steps.find(x => x.id === b.tool_use_id);
      if (s) s.err = true;
      if (dayKey(t) === this.day) this.stats.errors++;
    }
    this.#touch(a, err ? 'error' : 'result', t);
    const hid = this.delegations.get(b.tool_use_id);
    if (hid) {
      const h = this.agents.get(hid);
      if (h) h.parentResultAt = t;
      if (live && h && h.background !== true) this.emit('pulse', { ...this.#pulse(a, 'agent', `${h.agentType} entregó su parte`, 'return', t), helperId: hid });
    }
    if (live && err && p) this.emit('pulse', this.#pulse(a, p.icon, p.label, 'error', t, true));
  }

  #pulse(a, icon, label, kind, t, err = false) {
    return { agentId: a.id, sessionId: a.sessionId, palette: a.palette, project: a.project, icon, label, kind, err, t };
  }

  // ── vista pública (lo único que sale hacia la pantalla) ─────────────────
  #derive(a, now) {
    const idleFor = now - a.lastAt;
    if (a.kind === 'helper') {
      const doneAt = a.endTurnAt || (a.parentResultAt && a.background !== true ? a.parentResultAt : 0);
      if (doneAt) {
        if (now - doneAt > TIMING.helperLingerMs) return null;
        const leaving = now - doneAt > TIMING.helperLeaveMs;
        return { state: 'happy', mood: 'done', leaving, label: 'Entregó su parte', icon: 'done', since: doneAt };
      }
      if (!a.hasFile && a.parentResultAt && now - a.parentResultAt > TIMING.helperNoShowMs) return null;
      if (idleFor > TIMING.helperIdleMs) return null;
    } else if (idleFor > TIMING.goneMs) return null;

    let latest = null;
    for (const p of a.pending.values()) if (now - p.t < TIMING.staleToolMs && (!latest || p.t >= latest.t)) latest = p;
    if (latest) {
      const waiting = WAITING_ICONS.has(latest.icon);
      const coffee = !waiting && now - latest.t > TIMING.coffeeMs;
      return { state: waiting ? 'talking' : 'working', mood: latest.mood, phase: 'running', coffee, label: latest.label, icon: latest.icon, since: latest.t };
    }
    if (a.flash && now < a.flash.until) return { state: 'happy', mood: a.flash.mood, label: a.flash.label, icon: 'done', since: a.flash.until - TIMING.flashMs };
    const k = a.last.kind, ago = now - a.last.at;
    if (k === 'done' && ago < TIMING.happyMs) return { state: 'happy', mood: 'success', label: '¡Listo!', icon: 'done', since: a.last.at };
    if (k === 'error' && ago < TIMING.errorMs) return { state: 'error', label: 'Algo falló, reintentando', icon: 'error', since: a.last.at };
    if ((k === 'thinking' || k === 'prompt' || k === 'result' || k === 'tool' || k === 'error') && ago < TIMING.activeMs)
      return { state: 'thinking', label: 'Pensando…', icon: 'think', since: a.last.at };
    if (k === 'talking' && ago < TIMING.activeMs) return { state: 'talking', label: 'Respondiendo', icon: 'talk', since: a.last.at };
    if (idleFor > TIMING.sleepMs) return { state: 'sleeping', label: 'Durmiendo', icon: 'sleep', since: a.lastAt };
    if (idleFor > TIMING.watchMs) return { state: 'idle', mood: 'watching', label: 'Viendo una peli', icon: 'idle', since: a.lastAt };
    return { state: 'idle', mood: 'waiting', label: k === 'done' ? 'Esperando tu mensaje' : 'En pausa', icon: 'idle', since: a.lastAt };
  }

  /** Lista de agentes visibles, cada uno con solo datos de actividad. */
  view() {
    const now = this.now();
    if (dayKey(now) !== this.day) { this.day = dayKey(now); this.stats = blankStats(); }
    const out = [];
    // La principal (★) es la sesión donde escribiste por última vez.
    let principal = null;
    for (const a of this.agents.values()) {
      if (a.kind !== 'main' || !a.lastAt || now - a.lastAt > TIMING.goneMs) continue;
      const k = a.lastPromptAt || 0;
      if (!principal || k > principal.k || (k === principal.k && a.lastAt > principal.a.lastAt)) principal = { a, k };
    }
    for (const a of this.agents.values()) {
      if (!a.lastAt) continue;
      const d = this.#derive(a, now);
      if (!d) continue;
      if (a.kind === 'helper' && a.parentId && !this.agents.get(a.parentId)?.lastAt) continue;
      out.push({
        id: a.id, kind: a.kind, sessionId: a.sessionId, parentId: a.parentId,
        project: a.project || 'Claude', worktree: a.worktree, title: a.title,
        agentType: a.agentType, task: a.task, palette: a.palette, principal: a === principal?.a,
        skill: d.state === 'idle' || d.state === 'sleeping' ? null : a.skill ?? null,
        open: a.kind === 'main' && this.sessionOrder.includes(a.sessionId), // abierto ahora en Claude (lo anota su Nova)
        state: d.state, label: d.label, icon: d.icon, since: d.since,
        // La pose del dibujo compartido con la banda (scene.ts): mood + adornos.
        mood: d.mood ?? VIEW_MOOD[d.state] ?? 'waiting', phase: d.phase,
        coffee: !!d.coffee, sweat: a.editStreak >= 3 && d.state === 'working',
        entering: a.kind === 'helper' && now - (a.delegatedAt || a.firstAt) < TIMING.enterMs, leaving: !!d.leaving,
        firstAt: a.firstAt, lastAt: a.lastAt,
        steps: a.steps.map(s => ({ icon: s.icon, err: s.err })),
        counts: { ...a.counts },
      });
    }
    // Las principales primero por antigüedad (escritorios estables), las ayudantes después.
    // El mismo color que la Nova del chat de esa sesión: el que eligió al abrirse (lo anota su Nova en el registro).
    // Las que el mod no anota (cerradas) llevan otro color cada una, después.
    const order = this.sessionOrder;
    const place = v => { const i = order.indexOf(v.sessionId); return i < 0 ? Infinity : i; };
    out.sort((x, y) => (x.kind !== y.kind ? (x.kind === 'main' ? -1 : 1) : x.kind === 'main' ? place(x) - place(y) || x.firstAt - y.firstAt : x.firstAt - y.firstAt));
    let extra = order.length;
    for (const v of out) {
      if (v.kind !== 'main') continue;
      const i = order.indexOf(v.sessionId);
      v.palette = slotColor(this.sessions, v.sessionId, this.mainPalette) ?? sessionColor(i < 0 ? extra++ : i, this.mainPalette);
      this.agents.get(v.id).palette = v.palette;
    }
    return out;
  }

  /** Lo que tiene adentro un escritorio: línea de tiempo, ayudantes y archivos (solo actividad). */
  detail(id) {
    const m = this.agents.get(id);
    if (!m || m.kind !== 'main') return null;
    const view = this.view();
    const me = view.find(v => v.id === id);
    const helpers = [...this.agents.values()]
      .filter(h => h.kind === 'helper' && h.sessionId === m.sessionId && h.lastAt)
      .sort((x, y) => x.firstAt - y.firstAt)
      .map(h => {
        const v = view.find(x => x.id === h.id);
        const doneAt = h.endTurnAt || (h.background !== true ? h.parentResultAt : 0);
        return {
          agentType: h.agentType || 'Ayudante', task: h.task, palette: h.palette,
          status: v && !doneAt ? v.label : 'Terminó', active: !!v && !doneAt,
          startedAt: h.firstAt, doneAt, tools: h.counts.tools,
        };
      });
    const helperTools = helpers.reduce((n, h) => n + h.tools, 0);
    return {
      id, project: m.project || 'Claude', worktree: m.worktree, title: m.title,
      state: me?.state ?? 'idle', label: me?.label ?? 'Fuera de la oficina', icon: me?.icon ?? 'idle', since: me?.since ?? m.lastAt,
      firstAt: m.firstAt, lastAt: m.lastAt,
      counts: { ...m.counts, helperTools, helpers: helpers.length },
      log: m.log.slice(-60).reverse().map(({ id: _id, ...rest }) => rest),
      files: m.files,
      helpers: helpers.slice(-20).reverse(),
      sessionId: m.sessionId, lastReply: m.lastReply ?? null, chat: m.chat ?? [],
    };
  }

  summary(view = this.view()) {
    const mains = view.filter(a => a.kind === 'main');
    return {
      ...this.stats,
      novas: mains.length,
      working: mains.filter(a => a.state !== 'idle' && a.state !== 'sleeping').length,
      helpersNow: view.length - mains.length,
      day: this.day,
    };
  }

  /** Olvida registros viejos para que la memoria no crezca con los días. */
  prune() {
    const now = this.now();
    for (const [id, a] of this.agents) {
      if (now - a.lastAt > TIMING.goneMs * 2 && (a.kind === 'helper' || now - a.lastAt > 24 * 60 * MIN)) this.agents.delete(id);
    }
  }
}
