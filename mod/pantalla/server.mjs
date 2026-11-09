// Nova HQ — servidor local de la pantalla aparte.
// Lee los transcripts de Claude Code, arma la oficina y la emite por SSE a la página.
// Solo escucha en 127.0.0.1 y solo emite actividad (nunca contenido).
import http from 'node:http';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { Office } from './lib/state.mjs';
import { Tailer } from './lib/tail.mjs';
import { startCubo } from './lib/cubo.mjs';
import { dayKey, daySummary, history, liveSessions, weekTotals } from '../hooks/usage.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.NOVA_HQ_PORT || 4747);
const HOST = '127.0.0.1';
const ROOT = process.env.CLAUDE_PROJECTS_DIR || path.join(os.homedir(), '.claude', 'projects');
const log = m => console.log(`[nova-hq ${new Date().toLocaleTimeString('es-PR')}] ${m}`);

const clients = new Set();
const send = (res, type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
const broadcast = (type, data) => { for (const res of clients) send(res, type, data); };

const office = new Office({ emit: broadcast });

// Tus horas (las escribe el mod de Nova minuto a minuto): el total y cada sesión.
const USO = path.join(os.homedir(), '.claude', 'nova-uso.json');
let uso = { general: {}, sessions: {} };
// Tu Nova (color y skin de /nova ajustes, los escribe el mod): todas las Novas principales se ven como la tuya.
const PREFS = path.join(os.homedir(), '.claude', 'nova-prefs.json');
let prefs = {};
const SESIONES = path.join(os.homedir(), '.claude', 'nova-sesiones.json');
const readUso = async () => {
  try { uso = JSON.parse(await fsp.readFile(USO, 'utf8')); } catch { /* aún sin registro */ }
  try { prefs = JSON.parse(await fsp.readFile(PREFS, 'utf8')); } catch { /* aún sin ajustes */ }
  if (typeof prefs.color === 'string') office.mainPalette = prefs.color;
  try {
    office.sessions = JSON.parse(await fsp.readFile(SESIONES, 'utf8'));
    office.sessionOrder = liveSessions(office.sessions, Date.now());
  } catch { office.sessions = {}; office.sessionOrder = []; }
};
// Lo que apagaste en /nova ajustes (de fábrica, todo encendido).
const hoursOn = () => prefs.hours !== false;
const chatOn = () => prefs.remoteChat !== false;
const withUso = view => {
  if (!hoursOn()) return view;
  const today = dayKey(Date.now());
  return view.map(a => (a.kind === 'main' ? { ...a, uso: daySummary(uso.sessions?.[a.sessionId]?.[today]) } : a));
};
const usoSummary = () => {
  if (!hoursOn()) return null;
  const now = Date.now();
  return { today: daySummary(uso.general?.[dayKey(now)]), week: weekTotals(uso.general ?? {}, now) };
};
const view = () => withUso(office.view());
const summary = v => ({ ...office.summary(v), uso: usoSummary(), prefs: { skin: prefs.skin, hours: hoursOn(), remoteChat: chatOn() } });
const tailer = new Tailer(ROOT, (d, ctx) => office.ingest(d, ctx), { log });

// Cada segundo: lo que cambió (por tiempo o por líneas nuevas) se manda como 'agents' + 'stats'.
let lastAgents = '';
let lastStats = '';
setInterval(async () => {
  await readUso();
  const v = view();
  const a = JSON.stringify(v);
  if (a !== lastAgents) { lastAgents = a; broadcast('agents', v); }
  const s = JSON.stringify(summary(v));
  if (s !== lastStats) { lastStats = s; broadcast('stats', JSON.parse(s)); }
}, 1000).unref?.();
setInterval(() => office.prune(), 10 * 60_000).unref?.();
const cuboBye = startCubo(() => office.view(), () => prefs, () => office.sessionOrder.length > 0, `http://127.0.0.1:${PORT}/`, log);
// Al apagarse (/nova pantalla apagar, o al apagar el Mac): el cubo se queda con Nova buscando a Claude.
for (const sig of ['SIGTERM', 'SIGINT']) // SIGHUP no: el servidor corre con nohup y debe sobrevivir a la terminal que lo arrancó
  process.on(sig, () => Promise.race([cuboBye(), new Promise(r => setTimeout(r, 3000))]).finally(() => process.exit(0)));
// Mantiene viva la conexión SSE a través de proxies/antivirus.
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 20_000).unref?.();

const STATIC = {
  '/': ['public/index.html', 'text/html; charset=utf-8'],
  '/index.html': ['public/index.html', 'text/html; charset=utf-8'],
  '/poses': ['public/poses.html', 'text/html; charset=utf-8'],
  '/hq.css': ['public/hq.css', 'text/css; charset=utf-8'],
  '/hq.js': ['public/hq.js', 'text/javascript; charset=utf-8'],
  '/nova.js': ['../hooks/nova.js', 'text/javascript; charset=utf-8'],
  '/vendor/gsap.min.js': ['node_modules/gsap/dist/gsap.min.js', 'text/javascript; charset=utf-8'],
  '/vendor/Flip.min.js': ['node_modules/gsap/dist/Flip.min.js', 'text/javascript; charset=utf-8'],
  '/vendor/MotionPathPlugin.min.js': ['node_modules/gsap/dist/MotionPathPlugin.min.js', 'text/javascript; charset=utf-8'],
};

// El dibujo de las Novas es el mismo de la banda (mod/hooks/scene.ts y office.ts, de nova-hq):
// se sirve tal cual, quitándole los tipos de TypeScript al vuelo.
const TS_MODULES = {
  '/scene.js': '../hooks/scene.ts',
  '/scene': '../hooks/scene.ts',
  '/office-wall.js': '../hooks/office.ts',
};
process.removeAllListeners('warning'); // stripTypeScriptTypes avisa que es experimental en cada uso

// Escribirle a un chat desde la pantalla: el mensaje queda en un buzón por sesión (~/.claude/nova-inbox/<id>.json)
// y la Nova de ese chat lo envía como si lo hubieras escrito tú. Solo con la clave que lleva esta página:
// otra web abierta en tu navegador no puede leerla, y sin ella el servidor no acepta nada.
const TOKEN = crypto.randomBytes(24).toString('hex');
const INBOX = path.join(os.homedir(), '.claude', 'nova-inbox');
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
async function readBody(req, max = 16_384) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > max) throw new Error('demasiado largo'); }
  return body;
}
async function sendToChat(req, res) {
  const reply = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  if (req.method !== 'POST') return reply(405, { error: 'solo POST' });
  if (req.headers['x-nova-token'] !== TOKEN) return reply(403, { error: 'clave incorrecta' });
  if (!chatOn()) return reply(403, { error: 'chatear desde la pantalla está apagado en /nova ajustes' });
  let msg;
  try { msg = JSON.parse(await readBody(req)); } catch { return reply(400, { error: 'mensaje inválido' }); }
  const sessionId = String(msg?.sessionId || ''), text = String(msg?.text || '').trim();
  if (!SESSION_ID.test(sessionId) || !office.agents.has(`s:${sessionId}`)) return reply(404, { error: 'no conozco ese chat' });
  if (!text || text.length > 4000) return reply(400, { error: 'el mensaje debe tener entre 1 y 4000 caracteres' });
  await fsp.mkdir(INBOX, { recursive: true });
  const file = path.join(INBOX, `${sessionId}.json`);
  let queue = [];
  try { queue = JSON.parse(await fsp.readFile(file, 'utf8')); } catch { /* buzón vacío */ }
  if (!Array.isArray(queue)) queue = [];
  queue.push({ text, at: Date.now() });
  await fsp.writeFile(file, JSON.stringify(queue));
  log(`mensaje para ${sessionId.slice(0, 8)} (${text.length} caracteres)`);
  reply(200, { ok: true, open: office.sessionOrder.includes(sessionId) });
}

// Abrir un chat en la app de Claude: la app guarda, por cada sesión suya (local_…), el id del chat (cliSessionId)
// en claude-code-sessions/*/*/local_*.json, y abre una con claude://code/continue?session=local_….
const APP_DIR = process.platform === 'win32'
  ? path.join(process.env.APPDATA || '', 'Claude')
  : path.join(os.homedir(), 'Library', 'Application Support', 'Claude');
const LOCAL_ID = /^local_[A-Za-z0-9-]{1,64}$/;
async function appSessionFor(sessionId) {
  const root = path.join(APP_DIR, 'claude-code-sessions');
  for (const a of await fsp.readdir(root).catch(() => [])) {
    for (const b of await fsp.readdir(path.join(root, a)).catch(() => [])) {
      for (const f of await fsp.readdir(path.join(root, a, b)).catch(() => [])) {
        if (!f.startsWith('local_') || !f.endsWith('.json')) continue;
        try {
          const s = JSON.parse(await fsp.readFile(path.join(root, a, b, f), 'utf8'));
          if (s.cliSessionId === sessionId && LOCAL_ID.test(s.sessionId)) return s.sessionId;
        } catch { /* una sesión a medio escribir: la siguiente */ }
      }
    }
  }
  return null;
}
async function openInClaude(req, res) {
  const reply = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  if (req.method !== 'POST') return reply(405, { error: 'solo POST' });
  if (req.headers['x-nova-token'] !== TOKEN) return reply(403, { error: 'clave incorrecta' });
  let msg;
  try { msg = JSON.parse(await readBody(req)); } catch { return reply(400, { error: 'mensaje inválido' }); }
  const sessionId = String(msg?.sessionId || '');
  if (!SESSION_ID.test(sessionId)) return reply(400, { error: 'chat inválido' });
  const local = await appSessionFor(sessionId);
  if (!local) return reply(404, { error: 'ese chat no está en la app de Claude (quizá se abrió en la terminal)' });
  const link = `claude://code/continue?session=${local}`;
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', link]] : ['open', [link]];
  execFile(cmd, args, err => (err ? reply(500, { error: 'no pude abrir Claude' }) : reply(200, { ok: true })));
}

const server = http.createServer(async (req, res) => {
  // Solo esta PC: rechaza cualquier Host que no sea el propio (evita DNS rebinding).
  const host = String(req.headers.host || '');
  if (host !== `${HOST}:${PORT}` && host !== `localhost:${PORT}`) {
    res.writeHead(403).end('solo local');
    return;
  }
  const url = new URL(req.url, `http://${host}`);

  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    const v = view();
    send(res, 'agents', v);
    send(res, 'stats', summary(v));
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/api/session') {
    const found = office.detail(url.searchParams.get('id') || '');
    const d = found && { ...found, remoteChat: chatOn(), chat: chatOn() ? found.chat : [], lastReply: chatOn() ? found.lastReply : null, uso: !hoursOn() ? [] : history(uso.sessions?.[found.sessionId ?? String(url.searchParams.get('id')).replace(/^s:/, '')] ?? {}, Date.now(), 14).filter(x => x.openMin > 0) };
    res.writeHead(d ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(d ?? { error: 'no existe' }));
    return;
  }
  if (url.pathname === '/api/open') return openInClaude(req, res).catch(() => { if (!res.headersSent) res.writeHead(500).end(); });
  if (url.pathname === '/api/send') return sendToChat(req, res).catch(() => { if (!res.headersSent) res.writeHead(500).end(); });
  if (url.pathname === '/api/uso') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ days: hoursOn() ? history(uso.general ?? {}, Date.now(), 31) : [], off: !hoursOn() }));
    return;
  }
  if (url.pathname === '/api/state') {
    const v = view();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ agents: v, stats: summary(v) }, null, 2));
    return;
  }
  const ts = TS_MODULES[url.pathname];
  if (ts) {
    try {
      const code = stripTypeScriptTypes(await fsp.readFile(path.join(HERE, ts), 'utf8'), { mode: 'strip' });
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(code);
    } catch (e) {
      res.writeHead(500).end('no se pudo preparar ' + ts);
      log(`error preparando ${ts}: ${e.message}`);
    }
    return;
  }
  const hit = STATIC[url.pathname];
  if (!hit) { res.writeHead(404).end('no existe'); return; }
  try {
    let body = await fsp.readFile(path.join(HERE, hit[0]));
    if (hit[0] === 'public/index.html') body = String(body).replace('</head>', `<meta name="nova-token" content="${TOKEN}">\n</head>`);
    res.writeHead(200, { 'Content-Type': hit[1], 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404).end('no existe');
  }
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') { log(`el puerto ${PORT} ya está en uso: Nova HQ ya está corriendo`); process.exit(0); }
  throw e;
});

await readUso();
await tailer.start();
server.listen(PORT, HOST, () => log(`Nova HQ en http://${HOST}:${PORT}  (leyendo ${ROOT})`));
