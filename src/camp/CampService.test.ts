import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createCampService } from './CampService'

const SHEET = {
  strength: 1.1, tempo: 1.2, staminaHours: 8, load: 1, bonusChance: 0.05, fit: 1.05, haste: 1, output: 1.26,
  inputs: {
    level: 20, floor: 20, attackSpeedPercent: 40, maxHpFlat: 0, increasedDamagePercent: 0,
    critChancePercent: 5, movementSpeedPercent: 0, setRarityWeight: 0, tagLevelWeight: 5,
  },
}

const STATE = {
  server_time: '2026-09-11T12:00:00+00:00',
  storehouse_cap_hours: 8,
  buildings: [
    { building_id: 'storehouse', level: 1 },
    { building_id: 'woodline', level: 1 },
    { building_id: 'quarry', level: 1 },
  ],
  assignments: [{
    champion_id: 'champion-1',
    job_id: 'woodline-timber',
    sheet: SHEET,
    assigned_at: '2026-09-11T10:00:00+00:00',
    accrued_from: '2026-09-11T10:00:00+00:00',
    rate_per_hour: 5.04,
    cap_hours: 8,
    pending_units: 10,
  }],
  champions: [
    { champion_id: 'champion-1', source_floor: 20 },
    { champion_id: 'champion-2', source_floor: null },
  ],
}

function fakeClient(rpc: (name: string, params: Record<string, unknown>) => unknown): SupabaseClient {
  return {
    rpc: vi.fn(async (name: string, params: Record<string, unknown>) => ({
      data: rpc(name, params),
      error: null,
    })),
  } as unknown as SupabaseClient
}

function createService(client: SupabaseClient) {
  return createCampService(
    { supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'test-key' },
    () => client,
  )
}

describe('camp service', () => {
  it('maps the Camp state and stamps when it arrived', async () => {
    const service = createService(fakeClient(() => STATE))
    const before = Date.now()
    const state = await service.loadState()

    expect(state.serverTime).toBe(STATE.server_time)
    expect(state.receivedAt).toBeGreaterThanOrEqual(before)
    expect(state.storehouseCapHours).toBe(8)
    expect(state.buildings).toEqual([
      { buildingId: 'storehouse', level: 1 },
      { buildingId: 'woodline', level: 1 },
      { buildingId: 'quarry', level: 1 },
    ])
    expect(state.assignments).toEqual([{
      championId: 'champion-1',
      jobId: 'woodline-timber',
      sheet: SHEET,
      assignedAt: '2026-09-11T10:00:00+00:00',
      accruedFrom: '2026-09-11T10:00:00+00:00',
      ratePerHour: 5.04,
      capHours: 8,
      pendingUnits: 10,
    }])
    expect(state.championFloors).toEqual({ 'champion-1': 20, 'champion-2': null })
  })

  it('sends exactly the Champion and the job when assigning', async () => {
    const client = fakeClient(() => STATE)
    const service = createService(client)

    await service.assignChampion('op-1', 'champion-1', 'woodline-timber')

    expect(client.rpc).toHaveBeenCalledWith('assign_champion_to_camp_job', {
      p_operation_id: 'op-1',
      p_champion_id: 'champion-1',
      p_job_id: 'woodline-timber',
    })
  })

  it('maps what an unassignment paid', async () => {
    const client = fakeClient(() => ({
      paid: [{
        champion_id: 'champion-1', job_id: 'woodline-timber', definition_id: 'timber', units: 10, bonus_units: 3,
      }],
      was_processed: true,
      state: { ...STATE, assignments: [] },
    }))
    const service = createService(client)

    const result = await service.unassignChampion('op-2', 'champion-1')

    expect(client.rpc).toHaveBeenCalledWith('unassign_champion_from_camp', {
      p_operation_id: 'op-2',
      p_champion_id: 'champion-1',
    })
    expect(result.wasProcessed).toBe(true)
    expect(result.paid).toEqual([{
      championId: 'champion-1', jobId: 'woodline-timber', definitionId: 'timber', units: 10, bonusUnits: 3,
    }])
    expect(result.state.assignments).toEqual([])
  })

  it('claims under the operation id it was given', async () => {
    const client = fakeClient(() => ({ paid: [], was_processed: false, state: STATE }))
    const service = createService(client)

    const result = await service.claimProduction('op-3')

    expect(client.rpc).toHaveBeenCalledWith('claim_camp_production', { p_operation_id: 'op-3' })
    expect(result.wasProcessed).toBe(false)
  })

  it('upgrades a building by name and reads the state back', async () => {
    const client = fakeClient(() => ({ was_processed: true, state: STATE }))
    const service = createService(client)

    const result = await service.upgradeBuilding('op-4', 'storehouse')

    expect(client.rpc).toHaveBeenCalledWith('upgrade_camp_building', {
      p_operation_id: 'op-4',
      p_building_id: 'storehouse',
    })
    expect(result.wasProcessed).toBe(true)
    expect(result.state.storehouseCapHours).toBe(8)
  })

  it('advances the clock by hours for a development build', async () => {
    const client = fakeClient(() => STATE)
    const service = createService(client)

    await service.advanceClock(8)

    expect(client.rpc).toHaveBeenCalledWith('advance_camp_clock', { p_hours: 8 })
    await expect(service.advanceClock(0)).rejects.toThrow('positive number of hours')
  })

  it('refuses an empty operation id before calling the server', async () => {
    const client = fakeClient(() => STATE)
    const service = createService(client)

    await expect(service.claimProduction(' ')).rejects.toThrow('operation ID')
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('rejects a state whose assignment carries no sheet', async () => {
    const service = createService(fakeClient(() => ({
      ...STATE,
      assignments: [{ ...STATE.assignments[0], sheet: { tempo: 1 } }],
    })))

    await expect(service.loadState()).rejects.toThrow('invalid response')
  })
})
