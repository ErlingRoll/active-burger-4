import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONTRACT,
  DUNGEON_MAX_FLOOR_CONTRACTS,
  errorMessage,
  formatChampionExhaustion,
  formatRevivalReduction,
  isChampionExhausted,
  isMaxFloorContractUnlocked,
  parseGameCheckpoint,
} from './runFormatting'
import type { ChampionSnapshot } from '../characters'
import type { BasicProfileDto } from '../persistence'

const NOW = Date.parse('2026-09-08T12:00:00.000Z')

function champion(exhaustionUntil: string | null): ChampionSnapshot {
  return {
    championId: 'champion-1',
    name: 'Mira',
    sourceRunId: 'run-1',
    contentVersion: 'test',
    build: {
      schemaVersion: 1,
      classId: 'knight',
      skills: [],
      selectedUpgradeIds: [],
      equipment: {},
      behaviorProfileId: 'balanced',
    },
    exhaustionUntil,
    archived: false,
    createdAt: '2026-09-08T00:00:00.000Z',
  }
}

describe('errorMessage', () => {
  it('prefers an Error message', () => {
    expect(errorMessage(new Error('Boom'))).toBe('Boom')
  })

  it('accepts an error-shaped object, as Supabase returns', () => {
    expect(errorMessage({ message: 'Row not found' })).toBe('Row not found')
  })

  it('falls back for a value carrying no message', () => {
    expect(errorMessage('a bare string')).toBe('Unable to access local persistence.')
    expect(errorMessage(null)).toBe('Unable to access local persistence.')
  })
})

describe('champion exhaustion', () => {
  it('treats a future timestamp as exhausted and a past one as available', () => {
    expect(isChampionExhausted(champion('2026-09-08T13:00:00.000Z'), NOW)).toBe(true)
    expect(isChampionExhausted(champion('2026-09-08T11:00:00.000Z'), NOW)).toBe(false)
    expect(isChampionExhausted(champion(null), NOW)).toBe(false)
  })

  it('formats the remaining time, rounding minutes up', () => {
    expect(formatChampionExhaustion('2026-09-08T14:30:00.000Z', NOW)).toBe('2h 30m remaining')
    expect(formatChampionExhaustion('2026-09-08T12:00:30.000Z', NOW)).toBe('0h 1m remaining')
    // A second short of a day is a day, not twenty-three hours and sixty minutes.
    expect(formatChampionExhaustion('2026-09-09T11:59:59.000Z', NOW)).toBe('24h 0m remaining')
  })

  it('reports availability for an elapsed, absent, or unparseable timestamp', () => {
    expect(formatChampionExhaustion('2026-09-08T11:00:00.000Z', NOW)).toBe('Available')
    expect(formatChampionExhaustion(null, NOW)).toBe('Available')
    expect(formatChampionExhaustion('not a date', NOW)).toBe('Available')
  })
})

describe('formatRevivalReduction', () => {
  it('omits the hours component below an hour', () => {
    expect(formatRevivalReduction(600)).toBe('10m')
    expect(formatRevivalReduction(5_400)).toBe('1h 30m')
  })
})

describe('parseGameCheckpoint', () => {
  it('rejects a checkpoint that is not valid rather than restoring it', () => {
    expect(() => parseGameCheckpoint({ nonsense: true }))
      .toThrowError(/invalid or unsupported/)
    expect(() => parseGameCheckpoint(null)).toThrowError(/invalid or unsupported/)
  })
})

describe('dungeon max floor contracts', () => {
  const profile = (unlockedDungeonMaxFloorIds: string[]): BasicProfileDto => ({
    unlockedDungeonMaxFloorIds,
  } as BasicProfileDto)

  it('always includes the default contract first', () => {
    expect(DUNGEON_MAX_FLOOR_CONTRACTS[0]).toBe(DEFAULT_CONTRACT)
  })

  it('treats the default contract as unlocked for everyone', () => {
    expect(isMaxFloorContractUnlocked(profile([]), DEFAULT_CONTRACT.id)).toBe(true)
  })

  it('unlocks a contract by its own id or by the id that grants it', () => {
    expect(isMaxFloorContractUnlocked(profile(['deep-delve']), 'deep-delve')).toBe(true)
    expect(isMaxFloorContractUnlocked(profile(['grant-id']), 'deep-delve', 'grant-id')).toBe(true)
    expect(isMaxFloorContractUnlocked(profile([]), 'deep-delve', 'grant-id')).toBe(false)
  })
})
