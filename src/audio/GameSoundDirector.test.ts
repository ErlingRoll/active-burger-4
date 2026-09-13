import { describe, expect, it } from 'vitest'
import type { GameEvent } from '../game/events/GameEvents'
import { createGameSoundDirector, DIRECTOR_COOLDOWNS_MS } from './GameSoundDirector'
import type { SoundCueId } from './SoundCues'
import type { PlayOptions } from './SoundEffectPlayer'

function director() {
  const played: Array<{ cueId: SoundCueId; options?: PlayOptions }> = []
  let time = 0
  const instance = createGameSoundDirector(
    { play(cueId, options) { played.push({ cueId, options }); return true } },
    () => time,
  )
  return {
    instance,
    played,
    cues: () => played.map((entry) => entry.cueId),
    advance: (ms: number) => { time += ms },
  }
}

const hit = (overrides: Partial<Extract<GameEvent, { type: 'enemy-hit' }>> = {}): GameEvent => ({
  type: 'enemy-hit',
  targetKind: 'enemy',
  element: 'physical',
  critical: false,
  killingBlow: false,
  ...overrides,
})

const death = (elite = false): GameEvent => ({ type: 'enemy-died', definitionId: 'slime', elite })

const hurt = (overrides: Partial<Extract<GameEvent, { type: 'player-damaged' }>> = {}): GameEvent => ({
  type: 'player-damaged',
  amount: 5,
  element: 'physical',
  critical: false,
  damageOverTime: false,
  hpFraction: 0.8,
  ...overrides,
})

describe('game sound director', () => {
  it('maps the run phases to their cues', () => {
    const { instance, cues } = director()

    instance.handle([
      { type: 'phase-changed', from: 'loading', to: 'playing' },
      { type: 'phase-changed', from: 'playing', to: 'paused' },
      { type: 'phase-changed', from: 'paused', to: 'playing' },
      { type: 'phase-changed', from: 'playing', to: 'floor-transition' },
      { type: 'phase-changed', from: 'floor-transition', to: 'playing' },
      { type: 'phase-changed', from: 'playing', to: 'defeat' },
    ])

    expect(cues()).toEqual([
      'run-start', 'pause', 'resume', 'floor-depart', 'floor-arrive', 'defeat',
    ])
  })

  it('plays victory once even when results follows in the same frame', () => {
    const { instance, cues } = director()

    instance.handle([
      { type: 'phase-changed', from: 'floor-transition', to: 'victory' },
      { type: 'phase-changed', from: 'victory', to: 'results' },
    ])

    expect(cues()).toEqual(['victory'])
  })

  it('collapses a frame of hits into one thud sized to the count', () => {
    const { instance, played } = director()

    instance.handle([hit()])
    instance.handle([hit(), hit(), hit()])
    instance.handle(Array.from({ length: 6 }, () => hit()))

    // The 60 ms hit cooldown swallows the second and third frames at time 0.
    expect(played.map((entry) => entry.cueId)).toEqual(['hit-light'])
  })

  it('sizes the thud once the cooldown has passed', () => {
    const { instance, played, advance } = director()

    instance.handle([hit(), hit(), hit()])
    advance(DIRECTOR_COOLDOWNS_MS.hit)
    instance.handle(Array.from({ length: 6 }, () => hit()))

    expect(played).toEqual([
      { cueId: 'hit-medium', options: { intensity: 3 / 8 } },
      { cueId: 'hit-heavy', options: { intensity: 6 / 8 } },
    ])
  })

  it('adds one crit accent per frame and a separate boss thud', () => {
    const { instance, cues } = director()

    instance.handle([
      hit({ critical: true }),
      hit({ critical: true }),
      hit({ targetKind: 'boss' }),
    ])

    expect(cues()).toEqual(['hit-medium', 'hit-boss', 'crit-accent'])
  })

  it('turns many deaths in one frame into one crunch, plus the elite stinger', () => {
    const { instance, played, advance } = director()

    instance.handle([death()])
    advance(DIRECTOR_COOLDOWNS_MS.death)
    instance.handle(Array.from({ length: 10 }, () => death()).concat(death(true)))

    expect(played.map((entry) => entry.cueId)).toEqual([
      'enemy-death', 'enemy-death-multi', 'elite-death',
    ])
  })

  it('rate-limits hurt cues per element and softens damage over time', () => {
    const { instance, cues, advance } = director()

    instance.handle([hurt(), hurt(), hurt({ element: 'fire' })])
    instance.handle([hurt({ damageOverTime: true }), hurt({ damageOverTime: true })])
    advance(DIRECTOR_COOLDOWNS_MS.hurtOverTime - 1)
    instance.handle([hurt({ damageOverTime: true })])
    advance(1)
    instance.handle([hurt({ damageOverTime: true })])

    expect(cues()).toEqual(['hurt-physical', 'hurt-fire', 'hurt-dot', 'hurt-dot'])
  })

  it('warns once when the player is low, no more than every two seconds', () => {
    const { instance, cues, advance } = director()

    instance.handle([hurt({ hpFraction: 0.2 })])
    advance(DIRECTOR_COOLDOWNS_MS.hurt)
    instance.handle([hurt({ hpFraction: 0.1 })])
    advance(DIRECTOR_COOLDOWNS_MS.lowHp)
    instance.handle([hurt({ hpFraction: 0.1 })])

    expect(cues().filter((cue) => cue === 'danger-low-hp')).toHaveLength(2)
  })

  it('keeps the new-floor heal quiet but plays other heals', () => {
    const { instance, cues } = director()

    instance.handle([
      { type: 'stairs-reached' },
      { type: 'player-healed', amount: 50, critical: false },
      { type: 'phase-changed', from: 'playing', to: 'floor-transition' },
    ])
    instance.handle([{ type: 'player-healed', amount: 5, critical: true }])

    expect(cues()).toEqual(['stairs-reached', 'floor-depart', 'heal-crit'])
  })

  it('prefers the shield breaking over it absorbing in the same frame', () => {
    const { instance, cues } = director()

    instance.handle([
      { type: 'shield-absorbed', amount: 3, broke: false },
      { type: 'shield-absorbed', amount: 3, broke: true },
    ])
    instance.handle([{ type: 'shield-expired' }])

    expect(cues()).toEqual(['shield-break', 'shield-break'])
  })

  it('raises the XP blip a semitone per quick pickup and resets after a pause', () => {
    const { instance, played, advance } = director()

    for (let index = 0; index < 4; index += 1) {
      instance.handle([{ type: 'pickup-collected', kind: 'xp' }])
      advance(DIRECTOR_COOLDOWNS_MS.xp)
    }
    advance(DIRECTOR_COOLDOWNS_MS.xpStreak)
    instance.handle([{ type: 'pickup-collected', kind: 'xp' }])

    expect(played.map((entry) => entry.options?.pitch)).toEqual([0, 1, 2, 3, 0])
  })

  it('caps skill casts per frame and holds whirlwind longer', () => {
    const { instance, cues, advance } = director()

    instance.handle([
      { type: 'skill-cast', skillId: 'whirlwind', resonant: false },
      { type: 'skill-cast', skillId: 'vitality', resonant: false },
      { type: 'skill-cast', skillId: 'glacial-orb', resonant: false },
      { type: 'skill-cast', skillId: 'cinder-mine', resonant: false },
    ])
    advance(DIRECTOR_COOLDOWNS_MS.cast)
    instance.handle([
      { type: 'skill-cast', skillId: 'whirlwind', resonant: false },
      { type: 'skill-cast', skillId: 'vitality', resonant: true },
    ])

    expect(cues()).toEqual([
      'cast-whirlwind', 'cast-vitality', 'cast-glacial-orb', 'cast-vitality',
    ])
  })

  it('plays one basic attack per weapon per frame', () => {
    const { instance, cues } = director()

    instance.handle([
      { type: 'basic-attack-fired', weapon: 'bow' },
      { type: 'basic-attack-fired', weapon: 'bow' },
      { type: 'basic-attack-fired', weapon: 'sword' },
    ])

    expect(cues()).toEqual(['attack-bow', 'attack-sword'])
  })

  it('maps boss events, deduplicating impacts per attack per frame', () => {
    const { instance, played } = director()

    instance.handle([
      { type: 'boss-spawned', bossId: 'stone-golem' },
      { type: 'boss-telegraph', bossId: 'stone-golem', skillId: 'ground-slam' },
      { type: 'boss-impact', bossId: 'stone-golem', skillId: 'ground-slam', hitPlayer: true },
      { type: 'boss-impact', bossId: 'stone-golem', skillId: 'ground-slam', hitPlayer: false },
      { type: 'boss-died', bossId: 'stone-golem', final: false },
    ])

    expect(played).toEqual([
      { cueId: 'boss-spawn', options: undefined },
      { cueId: 'boss-telegraph-slam', options: undefined },
      { cueId: 'boss-impact', options: { intensity: 1 } },
      { cueId: 'boss-death', options: undefined },
    ])
  })

  it('plays statuses on enemies but only poison on the player', () => {
    const { instance, cues } = director()

    instance.handle([
      { type: 'status-applied', status: 'burn', target: 'enemy' },
      { type: 'status-applied', status: 'burn', target: 'enemy' },
      { type: 'status-applied', status: 'freeze', target: 'boss' },
      { type: 'status-applied', status: 'poison', target: 'player' },
      { type: 'status-applied', status: 'poison', target: 'player' },
    ])

    expect(cues()).toEqual(['status-burn', 'status-freeze', 'status-poison'])
  })

  it('maps choices, pickups, skill results and stairs directly', () => {
    const { instance, cues } = director()

    instance.handle([
      { type: 'level-up', level: 2 },
      { type: 'choice-flow-opened', flow: 'level-up' },
      { type: 'choice-rerolled' },
      { type: 'choice-banished' },
      { type: 'choice-selected', flow: 'level-up' },
      { type: 'choice-skipped' },
      { type: 'pickup-collected', kind: 'gear' },
      { type: 'pickup-collected', kind: 'healing-potion' },
      { type: 'skill-result', skillId: 'cinder-mine', result: 'mine-detonate' },
      { type: 'skill-result', skillId: 'chain-lightning', result: 'chain-jump' },
      { type: 'skill-result', skillId: 'chain-lightning', result: 'chain-jump' },
      { type: 'stairs-spawned', final: true },
      { type: 'enemy-telegraph', abilityId: 'archer-shot' },
      { type: 'enemy-impact', abilityId: 'brute-shockwave', hitPlayer: true },
    ])

    expect(cues()).toEqual([
      'level-up', 'choice-reroll', 'choice-banish', 'choice-select',
      'choice-skip', 'pickup-gear', 'pickup-potion', 'mine-detonate', 'chain-jump',
      'stairs-appear', 'enemy-telegraph', 'enemy-impact',
    ])
  })

  it('forgets its timers on reset', () => {
    const { instance, cues } = director()

    instance.handle([hit()])
    instance.reset()
    instance.handle([hit()])

    expect(cues()).toEqual(['hit-light', 'hit-light'])
  })
})
