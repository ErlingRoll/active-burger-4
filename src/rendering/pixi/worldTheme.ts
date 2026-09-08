/**
 * Palettes for the arena the simulation is drawn into.
 *
 * The two run modes have distinct visual identities documented in
 * `docs/GRAPHICS_GUIDELINES.md`; keeping the palettes here rather than inline in
 * the renderer means a theme is one object to read and to add to.
 */
export interface WorldTheme {
  canvas: string
  ground: string
  grid: string
  boundaryOuter: string
  boundaryMiddle: string
  boundaryInner: string
  boundaryDash: string
  boundaryCorner: string
  boundaryCore: string
}

export const DUNGEON_WORLD_THEME: WorldTheme = {
  canvas: '#11151d',
  ground: '#1d252d',
  grid: '#35404a',
  boundaryOuter: '#26313a',
  boundaryMiddle: '#52616a',
  boundaryInner: '#b8c7c7',
  boundaryDash: '#dce8e5',
  boundaryCorner: '#1a2027',
  boundaryCore: '#94a3b8',
}

export const ABYSS_WORLD_THEME: WorldTheme = {
  canvas: '#100718',
  ground: '#211135',
  grid: '#3c2056',
  boundaryOuter: '#3b1264',
  boundaryMiddle: '#6b21a8',
  boundaryInner: '#d8b4fe',
  boundaryDash: '#f0abfc',
  boundaryCorner: '#2e1065',
  boundaryCore: '#e879f9',
}

export interface GroundCoverage {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export const ALLY_HP_BAR_COLORS = {
  background: '#14532d',
  fill: '#22c55e',
  outline: '#dcfce7',
} as const

export const ENEMY_HP_BAR_COLORS = {
  background: '#450a0a',
  fill: '#ef4444',
  outline: '#fee2e2',
} as const

export type HealthBarColors =
  | typeof ALLY_HP_BAR_COLORS
  | typeof ENEMY_HP_BAR_COLORS
