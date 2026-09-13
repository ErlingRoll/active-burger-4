import type { BossDefinitionId, BossSkillId } from '../../content/bosses/Bosses'
import type { WeaponArchetype } from '../../content/gear/Items'
import type { Rarity } from '../../content/rarity/Rarity'
import type { SkillId } from '../../content/skills/Skills'
import type { EnemyDefinitionId } from '../ids'
import type {
  GameState,
  HitVisualElement,
  TelegraphState,
} from '../state/GameState'
import type { RunPhase } from '../state/RunPhase'

/**
 * Things that happened inside the simulation that the outside world may want
 * to react to, such as the audio layer playing a cue.
 *
 * Events are plain data: no entity references, nothing the simulation reads
 * back. Emitting one never changes the run, so the deterministic scenario is
 * unaffected whether or not anybody is listening.
 */
export type ChoiceFlowKind = 'level-up' | 'gear-pickup' | 'abyss-modifier'
export type SkillResultKind =
  | 'chain-jump'
  | 'mine-detonate'
  | 'orb-burst'
  | 'sigil-detonate'
  | 'tether-snap'
  | 'summon'
export type StatusKind = 'burn' | 'chill' | 'freeze' | 'shock' | 'poison'
export type DamageTargetKind = 'enemy' | 'boss' | 'player'
export type PickupKind = 'xp' | 'gear' | 'healing-potion'

export type GameEvent =
  | { type: 'phase-changed'; from: RunPhase; to: RunPhase }
  | { type: 'choice-flow-opened'; flow: ChoiceFlowKind }
  | { type: 'choice-selected'; flow: ChoiceFlowKind; rarity?: Rarity }
  | { type: 'choice-rerolled' }
  | { type: 'choice-skipped' }
  | { type: 'choice-banished' }
  | { type: 'level-up'; level: number }
  | { type: 'pickup-collected'; kind: PickupKind }
  | {
      type: 'player-damaged'
      amount: number
      element: HitVisualElement
      critical: boolean
      damageOverTime: boolean
      /** Remaining HP as a fraction of max, after the damage landed. */
      hpFraction: number
    }
  | { type: 'player-healed'; amount: number; critical: boolean; sourceSkillId?: SkillId }
  | { type: 'shield-gained'; amount: number; sourceSkillId: SkillId }
  | { type: 'shield-absorbed'; amount: number; broke: boolean }
  | { type: 'shield-expired' }
  | { type: 'basic-attack-fired'; weapon: WeaponArchetype }
  | {
      type: 'enemy-hit'
      targetKind: 'enemy' | 'boss'
      sourceSkillId?: SkillId
      weapon?: WeaponArchetype
      element: HitVisualElement
      critical: boolean
      killingBlow: boolean
    }
  | { type: 'enemy-died'; definitionId: EnemyDefinitionId; elite: boolean }
  | { type: 'enemy-telegraph'; abilityId: TelegraphState['skillId'] }
  | { type: 'enemy-impact'; abilityId: TelegraphState['skillId']; hitPlayer: boolean }
  | { type: 'boss-spawned'; bossId: BossDefinitionId }
  | { type: 'boss-telegraph'; bossId: BossDefinitionId; skillId: BossSkillId }
  | { type: 'boss-impact'; bossId: BossDefinitionId; skillId: BossSkillId; hitPlayer: boolean }
  | { type: 'boss-died'; bossId: BossDefinitionId; final: boolean }
  | { type: 'skill-cast'; skillId: SkillId; resonant: boolean }
  | { type: 'skill-result'; skillId: SkillId; result: SkillResultKind }
  | { type: 'status-applied'; status: StatusKind; target: DamageTargetKind }
  | { type: 'stairs-spawned'; final: boolean }
  | { type: 'stairs-reached' }

export type GameEventType = GameEvent['type']

/**
 * Pending events are capped so a headless run that nobody drains (tests, the
 * performance harness) cannot grow without bound. Once full, the oldest half
 * is dropped: the newest events are the ones a listener that has only just
 * started caring about is interested in.
 */
export const MAX_PENDING_GAME_EVENTS = 1024

/*
 * The sink is keyed on the state object rather than stored on it. The state is
 * serialized verbatim into checkpoints and compared whole in tests; a queue of
 * transient events has no business in either. A restore keeps the state's
 * identity (it is assigned into, not replaced), so the sink follows it.
 */
const sinks = new WeakMap<object, GameEvent[]>()

/** Starts collecting events for a state. Emissions before this are dropped. */
export function createGameEventSink(state: Readonly<GameState>): void {
  if (!sinks.has(state)) {
    sinks.set(state, [])
  }
}

/**
 * Records an event for a state that has a sink. Hand-built states in tests
 * have none, and for them this is a no-op.
 */
export function emitGameEvent(state: Readonly<GameState>, event: GameEvent): void {
  const pending = sinks.get(state)
  if (!pending) {
    return
  }
  if (pending.length >= MAX_PENDING_GAME_EVENTS) {
    pending.splice(0, Math.floor(MAX_PENDING_GAME_EVENTS / 2))
  }
  pending.push(event)
}

/** Returns every event recorded since the last call and clears the queue. */
export function takeGameEvents(state: Readonly<GameState>): GameEvent[] {
  const pending = sinks.get(state)
  if (!pending || pending.length === 0) {
    return []
  }
  return pending.splice(0, pending.length)
}
