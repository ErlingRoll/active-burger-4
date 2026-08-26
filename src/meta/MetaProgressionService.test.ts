import { describe, expect, it } from 'vitest'
import {
  getDungeonMaxFloorContractId,
  type MetaUnlockDefinition,
} from './MetaProgressionService'

function unlock(payload: Record<string, unknown>): MetaUnlockDefinition {
  return {
    id: 'test-unlock',
    category: 'dungeon-max-floor',
    cost: 100,
    requiresUnlockId: null,
    isStarter: false,
    payload,
  }
}

describe('maximum-floor unlock mappings', () => {
  it('reads the current maximum-floor contract payload', () => {
    expect(getDungeonMaxFloorContractId(unlock({
      maxFloorContractId: 'default-dungeon-20-floor',
    }))).toBe('default-dungeon-20-floor')
  })

  it('migrates legacy time-length payloads during the server migration rollout', () => {
    expect(getDungeonMaxFloorContractId(unlock({
      contractId: 'default-dungeon-15-minute',
    }))).toBe('default-dungeon-20-floor')
  })
})
