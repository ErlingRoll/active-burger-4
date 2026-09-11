import { CAMP_BUILDING_DEFINITIONS } from '../content/camp/CampBuildings'
import { getCampJobDefinition } from '../content/camp/CampJobs'
import type { CampBuildingId, CampJobId } from '../content/camp/CampTypes'
import type { CampLabourSheet } from '../content/camp/CampLabour'

/**
 * The Camp as the browser sees it.
 *
 * Everything here is read back from the server. The client names a Champion
 * and a job and nothing else; the sheet, the rate, the cap and the pending
 * count are the server's, and the clock the panel counts up from is the
 * server's too.
 */

export interface CampBuildingState {
  buildingId: CampBuildingId
  level: number
}

export interface CampAssignment {
  championId: string
  jobId: CampJobId
  /** The labour sheet snapshotted when the Champion was assigned. */
  sheet: CampLabourSheet
  assignedAt: string
  /** The moment unclaimed production is measured from, in server time. */
  accruedFrom: string
  /** Units per hour this assignment pays, with the building's multiplier applied. */
  ratePerHour: number
  /** The lesser of the sheet's stamina and the Storehouse cap. */
  capHours: number
  /** Whole units pending as of `serverTime`. */
  pendingUnits: number
}

export interface CampState {
  /** The server's clock when this state was read. */
  serverTime: string
  /** The client's clock when this state arrived, for counting up from `serverTime`. */
  receivedAt: number
  storehouseCapHours: number
  buildings: readonly CampBuildingState[]
  assignments: readonly CampAssignment[]
  /**
   * The floor count of the run that won each Champion on the roster, or null
   * for one made by the development tools. The picker previews a sheet with
   * the same input the server will use.
   */
  championFloors: Readonly<Record<string, number | null>>
}

export interface CampPayment {
  championId: string
  jobId: CampJobId
  definitionId: string
  units: number
  /** Extra units a critical claim paid on top. */
  bonusUnits: number
}

export interface CampClaimResult {
  paid: readonly CampPayment[]
  /** False when the operation had already landed and this call only read its result. */
  wasProcessed: boolean
  state: CampState
}

export interface CampService {
  loadState(): Promise<CampState>
  /** Sends a Champion to a job; a Champion already working elsewhere is settled and moved. */
  assignChampion(operationId: string, championId: string, jobId: CampJobId): Promise<CampState>
  /** Brings a Champion home, paying what it produced. */
  unassignChampion(operationId: string, championId: string): Promise<CampClaimResult>
  /** Pays out every job at once. */
  claimProduction(operationId: string): Promise<CampClaimResult>
  /** Buys a building's next level with the materials the level costs. */
  upgradeBuilding(operationId: string, buildingId: CampBuildingId): Promise<CampUpgradeResult>
  /**
   * Moves every assignment's clock back by this many hours, so a claim pays
   * as if that long had passed. Administrators only; the server refuses
   * anyone else. A development tool, not a feature.
   */
  advanceClock(hours: number): Promise<CampState>
}

export interface CampUpgradeResult {
  /** False when the operation had already landed and this call only read the state. */
  wasProcessed: boolean
  state: CampState
}

/** Where a working Champion is: "Working · Woodline", or null when it is at the fire. */
export function formatCampWork(assignment: CampAssignment | undefined): string | null {
  const job = assignment ? getCampJobDefinition(assignment.jobId) : undefined
  return job ? `Working · ${CAMP_BUILDING_DEFINITIONS[job.buildingId].name}` : null
}

/** The assignment a Champion holds, if it is working. */
export function getCampAssignment(
  state: CampState | null,
  championId: string,
): CampAssignment | undefined {
  return state?.assignments.find((assignment) => assignment.championId === championId)
}
