export const DEFAULT_DUNGEON_LENGTH_CONTRACT_ID = 'default-dungeon-15-minute'
export const DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID = 'default-dungeon-20-floor'

export const LEGACY_DUNGEON_MAX_FLOOR_CONTRACT_ID_MAP = {
  'default-dungeon-10-minute': DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
  'default-dungeon-15-minute': DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
  'default-dungeon-20-minute': 'default-dungeon-50-floor',
} as const
