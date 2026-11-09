// Saneo de la pantalla aparte: las etiquetas vienen de mod/hooks/labels.js (la misma fuente que el mod).
export { describeTool, isCommand, isDelegation, isEdit } from '../../hooks/labels.js';
import { cut } from '../../hooks/labels.js';

/**
 * Nombre del proyecto a partir del cwd. Un worktree de Claude (…\.claude\worktrees\x) cuenta como su repo.
 * Claude se mueve por subcarpetas (…/MiProyecto/Web/src), así que se sube hasta la carpeta donde empezó
 * la sesión: la que da nombre a su carpeta de transcripts (`projectDir`, la ruta con todo lo raro como '-').
 * `rooted` dice si se encontró esa carpeta; si no, el nombre es provisional.
 */
export function projectName(cwd, projectDir = '') {
  const parts = String(cwd || '').split(/[\\/]/).filter(Boolean);
  const wt = parts.findIndex((p, k) => p === '.claude' && parts[k + 1] === 'worktrees');
  if (wt > 0) return { project: parts[wt - 1], worktree: true, rooted: true };
  for (let n = parts.length; n > 0 && projectDir; n--) {
    if (('/' + parts.slice(0, n).join('/')).replace(/[^a-zA-Z0-9]/g, '-') === projectDir) return { project: parts[n - 1], worktree: false, rooted: true };
  }
  return { project: parts.pop() || 'Claude', worktree: false, rooted: false };
}

/** La descripción corta de la tarea de una ayudante (la escribe Claude al delegar). */
export const taskTitle = s => cut(s, 56);
export const sessionTitle = s => cut(s, 60);
