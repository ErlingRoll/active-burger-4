import type { GameEvent } from '../game/events/GameEvents'
import type { RunPhase } from '../game/state/RunPhase'
import { BOSS_TELEGRAPH_CUES, HURT_CUES, SKILL_CAST_CUES, type SoundCueId } from './SoundCues'
import type { PlayOptions } from './SoundEffectPlayer'

/**
 * Turns what happened in the simulation into cues, one frame at a time.
 *
 * A frame's events arrive together, so the director can look at the whole
 * batch: fifty enemies dying at once becomes one big crunch rather than fifty
 * pops, a floor's worth of hits becomes one thud sized to the count, and the
 * moments that matter (the player being hurt, a boss winding up) always get
 * through. Timers roll across frames so dense combat stays readable.
 */

export interface SoundSink {
  play(cueId: SoundCueId, options?: PlayOptions): boolean
}

export interface GameSoundDirector {
  handle(events: readonly GameEvent[]): void
  reset(): void
}

/** Cooldowns in milliseconds, all in one place so the mix is easy to tune. */
export const DIRECTOR_COOLDOWNS_MS = {
  hurt: 120,
  hurtOverTime: 700,
  lowHp: 2000,
  heal: 300,
  shieldGain: 200,
  shieldAbsorb: 150,
  basicAttack: 80,
  hit: 60,
  hitBoss: 120,
  crit: 150,
  death: 90,
  eliteDeath: 300,
  cast: 120,
  castWhirlwind: 600,
  chainJump: 90,
  mine: 100,
  orb: 150,
  sigil: 150,
  tether: 200,
  summon: 200,
  status: 250,
  freeze: 150,
  playerPoison: 2000,
  enemyTelegraph: 400,
  enemyImpact: 250,
  xp: 50,
  xpStreak: 400,
} as const

export const LOW_HP_FRACTION = 0.25
export const MAX_CAST_CUES_PER_FRAME = 3
export const XP_STREAK_MAX_SEMITONES = 12

function defaultNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function phaseCue(from: RunPhase, to: RunPhase): SoundCueId | undefined {
  if (to === 'paused') {
    return 'pause'
  }
  if (from === 'paused' && to !== 'defeat') {
    return 'resume'
  }
  switch (to) {
    case 'playing':
      return from === 'loading'
        ? 'run-start'
        : from === 'floor-transition' ? 'floor-arrive' : undefined
    case 'floor-transition':
      return 'floor-depart'
    case 'victory':
      return 'victory'
    case 'defeat':
      return 'defeat'
    default:
      return undefined
  }
}

const SKILL_RESULT_CUES = {
  'chain-jump': ['chain-jump', DIRECTOR_COOLDOWNS_MS.chainJump],
  'mine-detonate': ['mine-detonate', DIRECTOR_COOLDOWNS_MS.mine],
  'orb-burst': ['orb-burst', DIRECTOR_COOLDOWNS_MS.orb],
  'sigil-detonate': ['sigil-detonate', DIRECTOR_COOLDOWNS_MS.sigil],
  'tether-snap': ['tether-snap', DIRECTOR_COOLDOWNS_MS.tether],
  summon: ['summon', DIRECTOR_COOLDOWNS_MS.summon],
} as const satisfies Record<string, readonly [SoundCueId, number]>

const STATUS_CUES = {
  burn: 'status-burn',
  chill: 'status-chill',
  freeze: 'status-freeze',
  shock: 'status-shock',
  poison: 'status-poison',
} as const satisfies Record<string, SoundCueId>

const ATTACK_CUES = {
  sword: 'attack-sword',
  bow: 'attack-bow',
  wand: 'attack-wand',
  staff: 'attack-staff',
} as const satisfies Record<string, SoundCueId>

export function createGameSoundDirector(
  sink: SoundSink,
  now: () => number = defaultNow,
): GameSoundDirector {
  const lastAt = new Map<string, number>()
  let xpStreak = 0

  /** True, and stamps the key, when at least `ms` has passed since the key last fired. */
  const cooled = (key: string, ms: number, time: number): boolean => {
    const last = lastAt.get(key)
    if (last !== undefined && time - last < ms) {
      return false
    }
    lastAt.set(key, time)
    return true
  }

  const handle = (events: readonly GameEvent[]): void => {
    if (events.length === 0) {
      return
    }
    const time = now()
    const enteringFloor = events.some(
      (event) => event.type === 'phase-changed' && event.to === 'floor-transition',
    )
    let victoryPlayed = false
    let enemyHits = 0
    let bossHits = 0
    let critSeen = false
    let deaths = 0
    let eliteDied = false
    let shieldBroke = false
    let shieldAbsorbed = false
    let castCues = 0
    const weaponsFired = new Set<string>()
    const bossImpacts = new Set<string>()

    for (const event of events) {
      switch (event.type) {
        case 'phase-changed': {
          const cue = phaseCue(event.from, event.to)
          if (cue === 'victory') {
            if (!victoryPlayed) {
              victoryPlayed = true
              sink.play(cue)
            }
          } else if (cue) {
            sink.play(cue)
          }
          break
        }
        case 'choice-flow-opened':
          // Silent: a level-up, a gear pickup or the floor arrival has just
          // sounded, and the choice that follows is the same moment.
          break
        case 'choice-selected':
          sink.play('choice-select')
          break
        case 'choice-rerolled':
          sink.play('choice-reroll')
          break
        case 'choice-skipped':
          sink.play('choice-skip')
          break
        case 'choice-banished':
          sink.play('choice-banish')
          break
        case 'level-up':
          sink.play('level-up')
          break
        case 'pickup-collected':
          if (event.kind === 'xp') {
            const lastXp = lastAt.get('xp')
            xpStreak = lastXp !== undefined && time - lastXp < DIRECTOR_COOLDOWNS_MS.xpStreak
              ? Math.min(XP_STREAK_MAX_SEMITONES, xpStreak + 1)
              : 0
            if (cooled('xp', DIRECTOR_COOLDOWNS_MS.xp, time)) {
              sink.play('pickup-xp', { pitch: xpStreak })
            }
          } else {
            sink.play(event.kind === 'gear' ? 'pickup-gear' : 'pickup-potion')
          }
          break
        case 'player-damaged':
          if (event.damageOverTime) {
            if (cooled('hurt-dot', DIRECTOR_COOLDOWNS_MS.hurtOverTime, time)) {
              sink.play('hurt-dot')
            }
            break
          }
          if (cooled(`hurt:${event.element}`, DIRECTOR_COOLDOWNS_MS.hurt, time)) {
            sink.play(HURT_CUES[event.element], { intensity: event.critical ? 1 : 0.5 })
          }
          if (
            event.hpFraction < LOW_HP_FRACTION &&
            cooled('low-hp', DIRECTOR_COOLDOWNS_MS.lowHp, time)
          ) {
            sink.play('danger-low-hp')
          }
          break
        case 'player-healed':
          // Arriving on a new floor restores the player as a matter of course;
          // that is the floor's cue, not a healing one.
          if (!enteringFloor && cooled('heal', DIRECTOR_COOLDOWNS_MS.heal, time)) {
            sink.play(event.critical ? 'heal-crit' : 'heal')
          }
          break
        case 'shield-gained':
          if (cooled('shield-gain', DIRECTOR_COOLDOWNS_MS.shieldGain, time)) {
            sink.play('shield-gain')
          }
          break
        case 'shield-absorbed':
          shieldAbsorbed = true
          shieldBroke ||= event.broke
          break
        case 'shield-expired':
          sink.play('shield-break', { intensity: 0 })
          break
        case 'basic-attack-fired':
          if (
            !weaponsFired.has(event.weapon) &&
            cooled(`attack:${event.weapon}`, DIRECTOR_COOLDOWNS_MS.basicAttack, time)
          ) {
            weaponsFired.add(event.weapon)
            sink.play(ATTACK_CUES[event.weapon])
          }
          break
        case 'enemy-hit':
          if (event.targetKind === 'boss') {
            bossHits += 1
          } else {
            enemyHits += 1
          }
          critSeen ||= event.critical
          break
        case 'enemy-died':
          deaths += 1
          eliteDied ||= event.elite
          break
        case 'enemy-telegraph':
          if (cooled('enemy-telegraph', DIRECTOR_COOLDOWNS_MS.enemyTelegraph, time)) {
            sink.play('enemy-telegraph')
          }
          break
        case 'enemy-impact':
          if (cooled('enemy-impact', DIRECTOR_COOLDOWNS_MS.enemyImpact, time)) {
            sink.play('enemy-impact', { intensity: event.hitPlayer ? 1 : 0.4 })
          }
          break
        case 'boss-spawned':
          sink.play('boss-spawn')
          break
        case 'boss-telegraph':
          sink.play(BOSS_TELEGRAPH_CUES[event.skillId])
          break
        case 'boss-impact':
          if (!bossImpacts.has(event.skillId)) {
            bossImpacts.add(event.skillId)
            sink.play('boss-impact', { intensity: event.hitPlayer ? 1 : 0.5 })
          }
          break
        case 'boss-died':
          sink.play('boss-death')
          break
        case 'skill-cast': {
          const cooldown = event.skillId === 'whirlwind'
            ? DIRECTOR_COOLDOWNS_MS.castWhirlwind
            : DIRECTOR_COOLDOWNS_MS.cast
          if (
            castCues < MAX_CAST_CUES_PER_FRAME &&
            cooled(`cast:${event.skillId}`, cooldown, time)
          ) {
            castCues += 1
            sink.play(SKILL_CAST_CUES[event.skillId], { intensity: event.resonant ? 1 : 0.5 })
          }
          break
        }
        case 'skill-result': {
          const [cue, cooldown] = SKILL_RESULT_CUES[event.result]
          if (cooled(`result:${event.result}`, cooldown, time)) {
            sink.play(cue)
          }
          break
        }
        case 'status-applied':
          if (event.target === 'player') {
            if (
              event.status === 'poison' &&
              cooled('status:player-poison', DIRECTOR_COOLDOWNS_MS.playerPoison, time)
            ) {
              sink.play('status-poison')
            }
            break
          }
          if (cooled(
            `status:${event.status}`,
            event.status === 'freeze' ? DIRECTOR_COOLDOWNS_MS.freeze : DIRECTOR_COOLDOWNS_MS.status,
            time,
          )) {
            sink.play(STATUS_CUES[event.status])
          }
          break
        case 'stairs-spawned':
          sink.play('stairs-appear')
          break
        case 'stairs-reached':
          sink.play('stairs-reached')
          break
        default:
          break
      }
    }

    // The batch-wide cues, sized to what the frame added up to.
    if (shieldBroke) {
      sink.play('shield-break')
    } else if (shieldAbsorbed && cooled('shield-absorb', DIRECTOR_COOLDOWNS_MS.shieldAbsorb, time)) {
      sink.play('shield-absorb')
    }
    if (enemyHits > 0 && cooled('hit', DIRECTOR_COOLDOWNS_MS.hit, time)) {
      const cue = enemyHits === 1 ? 'hit-light' : enemyHits <= 4 ? 'hit-medium' : 'hit-heavy'
      sink.play(cue, { intensity: Math.min(1, enemyHits / 8) })
    }
    if (bossHits > 0 && cooled('hit-boss', DIRECTOR_COOLDOWNS_MS.hitBoss, time)) {
      sink.play('hit-boss', { intensity: Math.min(1, bossHits / 4) })
    }
    if (critSeen && cooled('crit', DIRECTOR_COOLDOWNS_MS.crit, time)) {
      sink.play('crit-accent')
    }
    if (deaths > 0 && cooled('death', DIRECTOR_COOLDOWNS_MS.death, time)) {
      if (deaths >= 4) {
        sink.play('enemy-death-multi', { intensity: Math.min(1, deaths / 12) })
      } else {
        sink.play('enemy-death', { intensity: deaths === 1 ? 0.4 : 0.8 })
      }
    }
    if (eliteDied && cooled('elite-death', DIRECTOR_COOLDOWNS_MS.eliteDeath, time)) {
      sink.play('elite-death')
    }
  }

  return {
    handle,
    reset() {
      lastAt.clear()
      xpStreak = 0
    },
  }
}
