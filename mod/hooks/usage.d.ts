// Tipos de usage.js (el mismo archivo lo usa la pantalla grande).
export type Day = { on: number[]; work: number[] }
export type Usage = Record<string, Day>
export type UsageFile = { general: Usage; sessions: Record<string, Usage> }
export type DaySummary = { start: string; end: string; open: string; work: string }
export declare function dayKey(t: number): string
export declare function mark(log: Usage, t: number, working: boolean): Usage | null
export declare function markFile(file: Partial<UsageFile> | undefined, sessionId: string, general: Usage, t: number, working: boolean): UsageFile
export declare function hours(mins: number): string
export declare function daySummary(day: Day | undefined): DaySummary | undefined
export declare function weekTotals(log: Usage, t: number): { open: string; work: string }
export type HistoryDay = { key: string; label: string; start: string; end: string; openMin: number; workMin: number; open: string; work: string }
export declare function history(log: Usage, t: number, days?: number): HistoryDay[]
export type Sessions = Record<string, { first: number; seen: number; on?: number; slot?: string }>
export declare function touchSession(reg: Sessions | undefined, id: string, now: number, main?: string): Sessions
export declare function slotColor(reg: Sessions | undefined, id: string, main: string): string | undefined
export declare function liveSessions(reg: Sessions | undefined, now: number): string[]
export declare function sessionColor(i: number, main: string): string
