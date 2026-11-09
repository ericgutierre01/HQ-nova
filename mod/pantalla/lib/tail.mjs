// Lee en vivo los transcripts de Claude Code (~/.claude/projects) sin tocarlos:
//   <proyecto>/<sessionId>.jsonl                          → la Nova de esa sesión
//   <proyecto>/<sessionId>/subagents/agent-<id>.jsonl      → una ayudante (+ agent-<id>.meta.json)
// Solo lee bytes nuevos (offset por archivo). fs.watch recursivo + sondeo de respaldo.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const WINDOW_MS = 12 * 60 * 60_000;      // al arrancar: archivos tocados en las últimas 12 h
const REPLAY_BYTES = 8 * 1024 * 1024;    // de cada uno, como máximo sus últimos 8 MB
const POLL_MS = 2_000;
const DISCOVER_MS = 10_000;

const readJson = async p => {
  try { return JSON.parse(await fsp.readFile(p, 'utf8')); } catch { return null; }
};

export class Tailer {
  /**
   * @param {string} root  carpeta projects de Claude
   * @param {(line: object, ctx: object) => void} onLine
   */
  constructor(root, onLine, { log = () => {} } = {}) {
    this.root = root;
    this.onLine = onLine;
    this.log = log;
    this.files = new Map(); // ruta → { offset, partial (Buffer), ctx, mtimeMs, busy, again }
    this.startedAt = Date.now();
    this.timers = [];
  }

  classify(full) {
    const rel = path.relative(this.root, full).split(path.sep);
    if (rel.length === 2 && rel[1].endsWith('.jsonl')) {
      return { kind: 'main', sessionId: rel[1].slice(0, -6), projectDir: rel[0] };
    }
    if (rel.length === 4 && rel[2] === 'subagents' && /^agent-.+\.jsonl$/.test(rel[3])) {
      return { kind: 'helper', sessionId: rel[1], agentId: rel[3].slice(6, -6), metaPath: full.slice(0, -6) + '.meta.json', projectDir: rel[0] };
    }
    return null;
  }

  async start() {
    const found = await this.discover({ initial: true });
    // Primero las principales y después las ayudantes, en orden de modificación.
    found.sort((a, b) => (a.ctx.kind === b.ctx.kind ? a.mtimeMs - b.mtimeMs : a.ctx.kind === 'main' ? -1 : 1));
    for (const f of found) await this.track(f.full, f.ctx, f.size, f.mtimeMs, { replay: true });
    this.log(`leyendo ${this.files.size} transcripts recientes`);

    try {
      this.watcher = fs.watch(this.root, { recursive: true }, (_ev, name) => {
        if (!name || !String(name).endsWith('.jsonl')) return;
        const full = path.join(this.root, String(name));
        if (this.files.has(full)) this.read(full);
        else this.maybeTrack(full);
      });
      this.watcher.on('error', e => this.log('fs.watch: ' + e.message));
    } catch (e) {
      this.log('fs.watch no disponible, solo sondeo: ' + e.message);
    }
    this.timers.push(setInterval(() => this.poll(), POLL_MS));
    this.timers.push(setInterval(() => this.discover().then(list => list.forEach(f => this.maybeTrack(f.full))), DISCOVER_MS));
  }

  stop() {
    this.watcher?.close();
    this.timers.forEach(clearInterval);
  }

  /** Recorre projects buscando transcripts recientes (solo readdir + stat de lo nuevo). */
  async discover({ initial = false } = {}) {
    const out = [];
    const cutoff = Date.now() - WINDOW_MS;
    let projects = [];
    try { projects = await fsp.readdir(this.root, { withFileTypes: true }); } catch { return out; }
    for (const p of projects) {
      if (!p.isDirectory()) continue;
      const dir = path.join(this.root, p.name);
      let entries = [];
      try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
        const full = path.join(dir, e.name);
        if (!initial && this.files.has(full)) continue;
        let st;
        try { st = await fsp.stat(full); } catch { continue; }
        if (st.mtimeMs < cutoff) continue;
        out.push({ full, ctx: this.classify(full), size: st.size, mtimeMs: st.mtimeMs });
        // Sus ayudantes
        const subDir = path.join(dir, e.name.slice(0, -6), 'subagents');
        let subs = [];
        try { subs = await fsp.readdir(subDir); } catch { continue; }
        for (const s of subs) {
          if (!/^agent-.+\.jsonl$/.test(s)) continue;
          const sf = path.join(subDir, s);
          if (!initial && this.files.has(sf)) continue;
          let sst;
          try { sst = await fsp.stat(sf); } catch { continue; }
          if (sst.mtimeMs < cutoff) continue;
          out.push({ full: sf, ctx: this.classify(sf), size: sst.size, mtimeMs: sst.mtimeMs });
        }
      }
    }
    return out.filter(f => f.ctx);
  }

  async maybeTrack(full) {
    if (this.files.has(full)) return;
    const ctx = this.classify(full);
    if (!ctx) return;
    let st;
    try { st = await fsp.stat(full); } catch { return; }
    if (this.files.has(full)) return;
    // Un archivo creado después de arrancar es actividad nueva: se lee en vivo desde el principio.
    // Uno viejo que vuelve a moverse (sesión reanudada) se pone al día en silencio y luego en vivo.
    const fresh = (st.birthtimeMs || st.ctimeMs) >= this.startedAt - 1000;
    await this.track(full, ctx, st.size, st.mtimeMs, { replay: !fresh });
  }

  async track(full, ctx, size, mtimeMs, { replay }) {
    const f = { offset: 0, partial: Buffer.alloc(0), ctx: { ...ctx }, mtimeMs, busy: false, again: false };
    this.files.set(full, f);
    if (ctx.kind === 'helper') f.ctx.meta = await readJson(ctx.metaPath);
    if (ctx.kind === 'main') {
      const t = await readJson(path.join(path.dirname(full), ctx.sessionId, 'custom-title.json'));
      if (t?.customTitle) this.onLine({ type: 'custom-title', customTitle: t.customTitle }, { ...f.ctx, live: false });
    }
    if (replay) {
      const start = Math.max(0, size - REPLAY_BYTES);
      await this.readRange(full, f, start, size, false, start > 0);
    }
    if (!replay) await this.read(full);
  }

  async poll() {
    for (const [full, f] of this.files) {
      let st;
      try { st = await fsp.stat(full); } catch { this.files.delete(full); continue; }
      if (st.size !== f.offset) this.read(full);
    }
  }

  async read(full) {
    const f = this.files.get(full);
    if (!f) return;
    if (f.busy) { f.again = true; return; }
    f.busy = true;
    try {
      do {
        f.again = false;
        let st;
        try { st = await fsp.stat(full); } catch { return; }
        if (st.size < f.offset) { f.offset = 0; f.partial = Buffer.alloc(0); } // truncado o reescrito
        if (st.size > f.offset) {
          if (f.ctx.kind === 'helper' && !f.ctx.meta) f.ctx.meta = await readJson(f.ctx.metaPath);
          await this.readRange(full, f, f.offset, st.size, true, false);
        }
      } while (f.again);
    } finally {
      f.busy = false;
    }
  }

  async readRange(full, f, start, end, live, skipFirstPartial) {
    const fh = await fsp.open(full, 'r');
    try {
      const len = end - start;
      const buf = Buffer.alloc(len);
      let got = 0;
      while (got < len) {
        const { bytesRead } = await fh.read(buf, got, len - got, start + got);
        if (!bytesRead) break;
        got += bytesRead;
      }
      f.offset = start + got;
      // El resto sin salto de línea se guarda en bytes (no partir un carácter UTF-8 a la mitad).
      const all = f.partial.length ? Buffer.concat([f.partial, buf.subarray(0, got)]) : buf.subarray(0, got);
      const cut = all.lastIndexOf(0x0a);
      f.partial = Buffer.from(all.subarray(cut + 1));
      const lines = cut < 0 ? [] : all.subarray(0, cut).toString('utf8').split('\n');
      if (skipFirstPartial) lines.shift();
      const ctx = { ...f.ctx, live };
      for (const ln of lines) {
        if (!ln.trim()) continue;
        let d;
        try { d = JSON.parse(ln); } catch { continue; }
        try { this.onLine(d, ctx); } catch (e) { this.log('línea ignorada: ' + e.message); }
      }
    } finally {
      await fh.close();
    }
  }
}
