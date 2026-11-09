// Etiquetas cortas en español para cada herramienta, SIN contenido: nunca texto de mensajes,
// prompts, comandos completos ni resultados. Solo el nombre del archivo (sin ruta) o la
// descripción corta que Claude le pone a cada comando. La usan el mod y la pantalla aparte.

const base = p => String(p || '').split(/[\\/]/).filter(Boolean).pop() || '';
const cut = (s, n = 48) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
const looksLikeId = s => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) || /^[0-9a-f-]{20,}$/i.test(s);

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']);
const COMMAND_TOOLS = new Set(['Bash', 'PowerShell']);

export const isEdit = name => EDIT_TOOLS.has(name);
export const isCommand = name => COMMAND_TOOLS.has(name);
export const isDelegation = name => name === 'Agent' || name === 'Task';

/** @returns {{ label: string, icon: string }} icon ∈ read|edit|terminal|search|web|agent|skill|ask|browser|plan|tool */
export function describeTool(name, input = {}) {
  const i = input || {};
  switch (name) {
    case 'Read': return { label: `Leyendo ${base(i.file_path)}`, icon: 'read' };
    case 'Edit':
    case 'MultiEdit': return { label: `Editando ${base(i.file_path)}`, icon: 'edit' };
    case 'Write': return { label: `Escribiendo ${base(i.file_path)}`, icon: 'edit' };
    case 'NotebookEdit': return { label: `Editando ${base(i.notebook_path)}`, icon: 'edit' };
    case 'Bash':
    case 'PowerShell': return { label: i.description ? cut(i.description) : 'Ejecutando un comando', icon: 'terminal' };
    case 'Grep': return { label: 'Buscando en el código', icon: 'search' };
    case 'Glob': return { label: 'Buscando archivos', icon: 'search' };
    case 'WebSearch': return { label: 'Buscando en la web', icon: 'web' };
    case 'WebFetch': return { label: 'Leyendo una página web', icon: 'web' };
    case 'Agent':
    case 'Task': return { label: `Delegando a ${i.subagent_type || 'una ayudante'}`, icon: 'agent' };
    case 'Skill': return { label: `Usando la skill ${cut(i.skill, 28)}`, icon: 'skill' };
    case 'AskUserQuestion': return { label: 'Te hizo una pregunta', icon: 'ask' };
    case 'ExitPlanMode': return { label: 'Esperando que apruebes el plan', icon: 'plan' };
    case 'EnterPlanMode': return { label: 'Planificando', icon: 'plan' };
    case 'TodoWrite':
    case 'TaskCreate':
    case 'TaskUpdate': return { label: 'Organizando tareas', icon: 'plan' };
    case 'ToolSearch': return { label: 'Cargando herramientas', icon: 'tool' };
    case 'Artifact': return { label: 'Publicando una página', icon: 'web' };
    case 'Workflow': return { label: 'Orquestando agentes', icon: 'agent' };
    case 'SendMessage': return { label: 'Hablando con otro agente', icon: 'agent' };
    case 'SubagentHandback': return { label: 'Entregando su parte', icon: 'agent' };
    case 'Monitor':
    case 'ScheduleWakeup': return { label: 'Esperando un proceso', icon: 'tool' };
  }
  if (name.startsWith('mcp__')) {
    const [, server = '', tool = ''] = name.split('__');
    if (/browser|chrome/i.test(server)) return { label: 'Navegando', icon: 'browser' };
    if (/computer-use/i.test(server)) return { label: 'Usando la PC', icon: 'browser' };
    if (/ccd_|session/i.test(server)) return { label: 'Manejando sesiones', icon: 'tool' };
    if (looksLikeId(server)) return { label: `Usando un conector (${cut(tool, 20)})`, icon: 'tool' };
    return { label: `Usando ${cut(server, 24)}`, icon: 'tool' };
  }
  return { label: `Usando ${cut(name, 28)}`, icon: 'tool' };
}

export { cut };
