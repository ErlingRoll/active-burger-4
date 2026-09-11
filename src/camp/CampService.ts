import { getSupabaseClient, type AuthEnvironment } from '../auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isCampBuildingId } from '../content/camp/CampBuildings'
import { isCampJobId } from '../content/camp/CampJobs'
import type { CampLabourSheet } from '../content/camp/CampLabour'
import type {
  CampAssignment,
  CampBuildingState,
  CampClaimResult,
  CampCureResult,
  CampGutResult,
  CampPayment,
  CampReforgeResult,
  CampService,
  CampState,
  CampUpgradeResult,
} from './CampTypes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value))
}

const SHEET_FIGURES = [
  'strength', 'tempo', 'staminaHours', 'load', 'bonusChance', 'fit', 'haste', 'output',
] as const

function isLabourSheet(value: unknown): value is CampLabourSheet {
  return isRecord(value) &&
    SHEET_FIGURES.every((figure) => isFiniteNumber(value[figure])) &&
    isRecord(value.inputs)
}

function invalidResponse(message: string): Error {
  return new Error(`The Camp returned an invalid response: ${message}`)
}

function assertOperationId(operationId: string): void {
  if (!isNonEmptyString(operationId)) {
    throw new Error('A non-empty Camp operation ID is required.')
  }
}

function readBuilding(value: unknown): CampBuildingState {
  if (!isRecord(value) || !isCampBuildingId(value.building_id) || !isCount(value.level)) {
    throw invalidResponse('expected a building row')
  }
  return { buildingId: value.building_id, level: value.level }
}

function readAssignment(value: unknown): CampAssignment {
  if (!isRecord(value) ||
    !isNonEmptyString(value.champion_id) ||
    !isCampJobId(value.job_id) ||
    !isLabourSheet(value.sheet) ||
    !isTimestamp(value.assigned_at) ||
    !isTimestamp(value.accrued_from) ||
    !isFiniteNumber(value.rate_per_hour) ||
    !isFiniteNumber(value.cap_hours) ||
    !isCount(value.pending_units)) {
    throw invalidResponse('expected an assignment row')
  }
  return {
    championId: value.champion_id,
    jobId: value.job_id,
    sheet: value.sheet,
    assignedAt: value.assigned_at,
    accruedFrom: value.accrued_from,
    ratePerHour: value.rate_per_hour,
    capHours: value.cap_hours,
    pendingUnits: value.pending_units,
  }
}

function readState(value: unknown, receivedAt: number): CampState {
  if (!isRecord(value) ||
    !isTimestamp(value.server_time) ||
    !isFiniteNumber(value.storehouse_cap_hours) ||
    !Array.isArray(value.buildings) ||
    !Array.isArray(value.assignments) ||
    !Array.isArray(value.champions)) {
    throw invalidResponse('expected a Camp state')
  }
  const championFloors: Record<string, number | null> = {}
  for (const entry of value.champions) {
    if (!isRecord(entry) || !isNonEmptyString(entry.champion_id) ||
      (entry.source_floor !== null && !isCount(entry.source_floor))) {
      throw invalidResponse('expected a Champion floor row')
    }
    championFloors[entry.champion_id] = entry.source_floor as number | null
  }
  return {
    serverTime: value.server_time,
    receivedAt,
    storehouseCapHours: value.storehouse_cap_hours,
    buildings: value.buildings.map(readBuilding),
    assignments: value.assignments.map(readAssignment),
    championFloors,
  }
}

function readPayment(value: unknown): CampPayment {
  if (!isRecord(value) ||
    !isNonEmptyString(value.champion_id) ||
    !isCampJobId(value.job_id) ||
    !(value.definition_id === null || value.definition_id === undefined || isNonEmptyString(value.definition_id)) ||
    !isCount(value.units) ||
    !isCount(value.bonus_units)) {
    throw invalidResponse('expected a payment row')
  }
  const effect = value.effect === 'exhaustion-relief' ? 'exhaustion-relief' : 'item'
  const definitionId = isNonEmptyString(value.definition_id) ? value.definition_id : null
  if (effect === 'item' && definitionId === null) {
    throw invalidResponse('expected an item payment to name its item')
  }
  return {
    championId: value.champion_id,
    jobId: value.job_id,
    effect,
    definitionId,
    units: value.units,
    bonusUnits: value.bonus_units,
  }
}

function assertFishInstanceId(fishInstanceId: string): void {
  if (!isNonEmptyString(fishInstanceId)) {
    throw new Error('A fish instance ID is required.')
  }
}

function readClaim(value: unknown, receivedAt: number): CampClaimResult {
  if (!isRecord(value) || !Array.isArray(value.paid) || typeof value.was_processed !== 'boolean') {
    throw invalidResponse('expected a claim result')
  }
  return {
    paid: value.paid.map(readPayment),
    wasProcessed: value.was_processed,
    state: readState(value.state, receivedAt),
  }
}

/**
 * The Camp, as the browser sees it.
 *
 * Every call returns the whole Camp state, read fresh by the server after the
 * change, so the panel never has to reconcile a local guess with what the
 * server did. Operation ids make assign, unassign and claim safe to retry.
 */
export function createCampService(
  environment: AuthEnvironment,
  resolveClient?: () => SupabaseClient | undefined,
): CampService {
  const defaultClient = getSupabaseClient(environment)
  const getClient = (): SupabaseClient => resolveClient?.() ?? defaultClient

  async function call(name: string, params: Record<string, unknown>): Promise<unknown> {
    const response = await getClient().rpc(name, params)
    if (response.error) {
      throw response.error
    }
    return response.data
  }

  return {
    async loadState(): Promise<CampState> {
      return readState(await call('get_camp_state', {}), Date.now())
    },

    async assignChampion(operationId, championId, jobId): Promise<CampState> {
      assertOperationId(operationId)
      if (!isNonEmptyString(championId)) {
        throw new Error('A Champion ID is required.')
      }
      const data = await call('assign_champion_to_camp_job', {
        p_operation_id: operationId,
        p_champion_id: championId,
        p_job_id: jobId,
      })
      return readState(data, Date.now())
    },

    async unassignChampion(operationId, championId): Promise<CampClaimResult> {
      assertOperationId(operationId)
      if (!isNonEmptyString(championId)) {
        throw new Error('A Champion ID is required.')
      }
      const data = await call('unassign_champion_from_camp', {
        p_operation_id: operationId,
        p_champion_id: championId,
      })
      return readClaim(data, Date.now())
    },

    async claimProduction(operationId): Promise<CampClaimResult> {
      assertOperationId(operationId)
      const data = await call('claim_camp_production', { p_operation_id: operationId })
      return readClaim(data, Date.now())
    },

    async upgradeBuilding(operationId, buildingId): Promise<CampUpgradeResult> {
      assertOperationId(operationId)
      const data = await call('upgrade_camp_building', {
        p_operation_id: operationId,
        p_building_id: buildingId,
      })
      if (!isRecord(data) || typeof data.was_processed !== 'boolean') {
        throw invalidResponse('expected an upgrade result')
      }
      return { wasProcessed: data.was_processed, state: readState(data.state, Date.now()) }
    },

    async gutFish(operationId, fishInstanceId): Promise<CampGutResult> {
      assertOperationId(operationId)
      assertFishInstanceId(fishInstanceId)
      const data = await call('gut_fish_at_smokehouse', {
        p_operation_id: operationId,
        p_fish_instance_id: fishInstanceId,
      })
      const row: unknown = Array.isArray(data) ? data[0] : undefined
      if (!isRecord(row) || !isNonEmptyString(row.definition_id) ||
        !isCount(row.roe_granted) || typeof row.was_processed !== 'boolean') {
        throw invalidResponse('expected one gutted fish row')
      }
      return { definitionId: row.definition_id, roeGranted: row.roe_granted, wasProcessed: row.was_processed }
    },

    async cureFish(operationId, fishInstanceId): Promise<CampCureResult> {
      assertOperationId(operationId)
      assertFishInstanceId(fishInstanceId)
      const data = await call('cure_fish_at_smokehouse', {
        p_operation_id: operationId,
        p_fish_instance_id: fishInstanceId,
      })
      const row: unknown = Array.isArray(data) ? data[0] : undefined
      if (!isRecord(row) || !isNonEmptyString(row.definition_id) ||
        !isNonEmptyString(row.enchantment_id) || !isCount(row.roe_spent) ||
        typeof row.was_processed !== 'boolean') {
        throw invalidResponse('expected one cured fish row')
      }
      return {
        definitionId: row.definition_id,
        enchantmentId: row.enchantment_id,
        roeSpent: row.roe_spent,
        wasProcessed: row.was_processed,
      }
    },

    async reforgeArtifact(operationId, artifactInstanceId): Promise<CampReforgeResult> {
      assertOperationId(operationId)
      if (!isNonEmptyString(artifactInstanceId)) {
        throw new Error('An artifact instance ID is required.')
      }
      const data = await call('reforge_artifact', {
        p_operation_id: operationId,
        p_artifact_instance_id: artifactInstanceId,
      })
      const row: unknown = Array.isArray(data) ? data[0] : undefined
      if (!isRecord(row) || !isNonEmptyString(row.definition_id) || !isRecord(row.metadata) ||
        !isCount(row.scrap_spent) || !isCount(row.shards_spent) || typeof row.was_processed !== 'boolean') {
        throw invalidResponse('expected one reforged artifact row')
      }
      return {
        definitionId: row.definition_id,
        metadata: row.metadata,
        scrapSpent: row.scrap_spent,
        shardsSpent: row.shards_spent,
        wasProcessed: row.was_processed,
      }
    },

    async advanceClock(hours): Promise<CampState> {
      if (!Number.isFinite(hours) || hours <= 0) {
        throw new Error('The Camp clock can only be advanced by a positive number of hours.')
      }
      return readState(await call('advance_camp_clock', { p_hours: hours }), Date.now())
    },
  }
}
