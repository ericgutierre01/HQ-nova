// Tipos de nova.js (el mismo archivo lo usa la pantalla aparte como /nova.js).
export type NovaPalette = { name: string; stops: [string, string, string, string]; ink: string; shadow: string; glow: string }
export declare const PALETTES: Record<string, NovaPalette>
export declare const STATES: string[]
export declare const STATE_LABEL: Record<string, string>
export declare const NOVA_CSS: string
export declare function paletteFor(agentType: string, seed?: string): string
export declare function star(cx: number, cy: number, r: number): string
export declare function novaSVG(
  state?: string,
  o?: { palette?: string; cheeks?: boolean; style?: boolean; animated?: boolean; x?: number; y?: number; size?: number; idPrefix?: string },
): string
export declare function starSVG(size?: number): string
