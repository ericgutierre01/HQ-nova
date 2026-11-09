// Tus horas con Claude: qué minutos de cada día estuvo Claude abierto (`on`) y cuáles Nova
// trabajando (`work`), como minutos del día. Un conjunto, así varios chats abiertos cuentan una vez.
// Lo usan el mod (banda y ⓘ) y la pantalla grande (pantalla/server.mjs), por eso es JS sin tipos.

const KEEP_DAYS = 31;
const SESSION_DAYS = 7;

/** 'YYYY-MM-DD' en tu hora local. */
export const dayKey = t => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const add = (list, m) => (list.includes(m) ? list : [...list, m]);

/** El registro con el minuto `t` marcado como abierto (y trabajando); null si no cambia nada. */
export function mark(log, t, working) {
  const key = dayKey(t);
  const d = new Date(t);
  const m = d.getHours() * 60 + d.getMinutes();
  const day = log[key] ?? { on: [], work: [] };
  const next = { on: add(day.on, m), work: working ? add(day.work, m) : day.work };
  if (next.on === day.on && next.work === day.work) return null;
  const keys = Object.keys(log).filter(k => k !== key).sort().slice(-(KEEP_DAYS - 1));
  return Object.fromEntries([...keys.map(k => [k, log[k]]), [key, next]]);
}

/** El archivo compartido con la pantalla grande: el total y cada sesión (las de los últimos 7 días). */
export function markFile(file, sessionId, general, t, working) {
  const since = dayKey(t - SESSION_DAYS * 86_400_000);
  const sessions = Object.fromEntries(Object.entries(file?.sessions ?? {}).filter(([, log]) => Object.keys(log).some(k => k >= since)));
  sessions[sessionId] = mark(sessions[sessionId] ?? {}, t, working) ?? sessions[sessionId];
  return { general, sessions };
}

const hm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
/** 125 → '2 h 05 min'. */
export const hours = mins => (mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`);

/** Un día en palabras: primer y último minuto, tiempo abierto, tiempo trabajando. */
export function daySummary(day) {
  if (!day || day.on.length === 0) return undefined;
  return { start: hm(Math.min(...day.on)), end: hm(Math.max(...day.on)), open: hours(day.on.length), work: hours(day.work.length) };
}

/** Minutos abierto y trabajando en los 7 días que terminan en `t`. */
export function weekTotals(log, t) {
  let open = 0, work = 0;
  for (let i = 0; i < 7; i++) {
    const day = log[dayKey(t - i * 86_400_000)];
    open += day?.on.length ?? 0;
    work += day?.work.length ?? 0;
  }
  return { open: hours(open), work: hours(work) };
}

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Los últimos `days` días que terminan en `t`, el más reciente primero; los días sin uso salen en 0. */
export function history(log, t, days = 14) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const at = t - i * 86_400_000;
    const d = new Date(at);
    const day = log[dayKey(at)];
    const s = daySummary(day);
    out.push({
      key: dayKey(at),
      label: i === 0 ? 'Hoy' : i === 1 ? 'Ayer' : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`,
      start: s?.start ?? '', end: s?.end ?? '',
      openMin: day?.on.length ?? 0, workMin: day?.work.length ?? 0,
      open: s?.open ?? '—', work: s?.work ?? '—',
    });
  }
  return out;
}

// ── Qué color lleva la Nova de cada sesión abierta (la misma regla en el chat y en la pantalla grande) ──
const LIVE_MS = 3 * 60_000;
// Las otras sesiones: ninguno de los colores de las ayudantes por tipo (azul, violeta, ámbar).
const OTHER_SESSIONS = ['naranja', 'morado', 'rojo', 'dorado', 'rosa', 'nova'];

const isLive = (r, now) => now - r.seen < LIVE_MS;

/**
 * El registro de sesiones con esta marcada como viva ahora; las que llevan un día sin latir se olvidan.
 * Cada sesión se queda con su color (`slot`: 'main' = el de tu Nova de ajustes, o un color) mientras siga abierta,
 * y al abrirse toma uno que no lleve ninguna otra abierta: abrir o cerrar un chat no le cambia el color a los demás.
 * `on` es cuándo se abrió esta vez: si dos chats eligieron el mismo color a la vez, cede el que se abrió después.
 */
export function touchSession(reg, id, now, main = 'nova') {
  const kept = Object.fromEntries(Object.entries(reg ?? {}).filter(([, r]) => now - r.seen < 86_400_000));
  const mine = kept[id];
  const on = mine && isLive(mine, now) ? (mine.on ?? mine.first) : now;
  const others = Object.entries(kept).filter(([k, r]) => k !== id && isLive(r, now)).map(([k, r]) => ({ k, ...r }));
  const yields = slot => others.some(o => o.slot === slot && ((o.on ?? o.first) < on || ((o.on ?? o.first) === on && o.k < id)));
  let slot = mine?.slot && !yields(mine.slot) ? mine.slot : undefined;
  if (!slot) {
    const taken = new Set(others.map(o => o.slot));
    const choices = ['main', ...OTHER_SESSIONS.filter(c => c !== main)];
    // Un chat abierto de antes de que hubiera colores guardados: se queda con el que tenía (el de su puesto por antigüedad).
    const was = mine && isLive(mine, now) && !mine.slot
      ? choices[Object.entries(kept).filter(([, r]) => isLive(r, now)).sort((a, b) => a[1].first - b[1].first).findIndex(([k]) => k === id) % choices.length]
      : undefined;
    slot = was && !taken.has(was) ? was : choices.find(c => !taken.has(c)) ?? choices[others.length % choices.length];
  }
  kept[id] = { first: mine?.first ?? now, on, seen: now, slot };
  return kept;
}

/** Las sesiones abiertas (latieron hace menos de 3 min), por orden de apertura: un chat que reabres va al final. */
export const liveSessions = (reg, now) =>
  Object.entries(reg ?? {}).filter(([, r]) => isLive(r, now)).sort((a, b) => (a[1].on ?? a[1].first) - (b[1].on ?? b[1].first)).map(([id]) => id);

/** El color de la Nova de una sesión del registro (undefined si no está). */
// shortcut: si cambias tu color de ajustes a uno que ya lleva otro chat, los dos se ven iguales hasta que uno se cierre.
export const slotColor = (reg, id, main) => { const s = reg?.[id]?.slot; return s === 'main' ? main : s; };

/** El color de la sesión número `i` (0 = la primera abierta, que lleva tu Nova de ajustes). */
export function sessionColor(i, main) {
  if (i <= 0) return main;
  const others = OTHER_SESSIONS.filter(c => c !== main);
  return others[(i - 1) % others.length];
}
