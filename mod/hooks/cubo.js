// Qué Nova enseña el cubo de la mesa (lo usa pantalla/lib/cubo.mjs). Aparte para poder probarlo.

/** Las poses de Nova que puede enseñar el cubo, con su texto: las mismas que la pantalla grande. */
export const CUBE_MOODS = {
  asking: 'Te necesita', error: 'Algo falló', working: 'Trabajando', shipping: 'Publicando', browsing: 'Navegando',
  reading: 'Leyendo', answering: 'Respondiendo', thinking: 'Pensando…', success: '¡Listo!', waiting: 'Esperando',
  watching: 'Viendo una peli', sleeping: 'Durmiendo',
};
// En ese orden manda «lo más importante de todos»: si un chat te necesita, gana a que otro trabaje.
const ORDER = Object.keys(CUBE_MOODS);
const moodOf = a => (a.mood === 'done' ? 'success' : a.mood in CUBE_MOODS ? a.mood : 'waiting');

/**
 * 'actual': la Nova del chat actual (el «✎ Chat actual» de la pantalla grande).
 * 'todos': la de lo más importante entre todos tus chats.
 */
export function cuboPick(list, follow = 'actual') {
  const mains = list.filter(a => a.kind === 'main');
  const a = follow === 'todos'
    ? [...mains].sort((x, y) => ORDER.indexOf(moodOf(x)) - ORDER.indexOf(moodOf(y)))[0]
    : mains.find(m => m.principal) ?? mains.find(m => m.open) ?? mains[0];
  return a ? { mood: moodOf(a), palette: a.palette || 'nova' } : { mood: 'sleeping', palette: 'nova' };
}
