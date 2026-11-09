// Tipos de labels.js (la misma fuente la usa la pantalla aparte).
export type ToolIcon = 'read' | 'edit' | 'terminal' | 'search' | 'web' | 'agent' | 'skill' | 'ask' | 'browser' | 'plan' | 'tool'
export declare function describeTool(name: string, input?: unknown): { label: string; icon: ToolIcon }
export declare function isEdit(name: string): boolean
export declare function isCommand(name: string): boolean
export declare function isDelegation(name: string): boolean
export declare function cut(s: unknown, n?: number): string
