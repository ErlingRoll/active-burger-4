import { describe, expect, it } from 'vitest'
import type { ArtifactMetadata } from '../../content/artifacts/Artifacts'
import { createGame, FIXED_STEP_SECONDS, Game } from '../Game'
import type { RunPreparationSnapshot } from '../RunModes'
import {
  EMPTY_ARTIFACT_RUN_EFFECTS,
  getPlayerArtifactEffects,
  getPlayerEliteDamagePercent,
  resolveArtifactRunEffects,
} from './ArtifactRunEffects'

function artifact(
  baseId: ArtifactMetadata['baseId'],
  implicit: ArtifactMetadata['implicit'],
  modifiers: ArtifactMetadata['modifiers'] = [],
): ArtifactMetadata {
  return { baseId, rarity: 'rare', implicit, modifiers }
}

function preparation(...artifacts: ArtifactMetadata[]): RunPreparationSnapshot {
  return {
    version: 1,
    items: [],
    artifacts: artifacts.map((entry, index) => ({
      itemInstanceId: `artifact-${index}`,
      definitionId: `artifact-${entry.baseId}`,
      quantity: 1,
      artifact: entry,
    })),
  }
}

const RELIQUARY = artifact('ember-reliquary', { id: 'corpse-detonation', tier: 5, value: 25 })
const COMPASS = artifact('cartographers-compass', { id: 'charted-choices', tier: 1, value: 10 })

describe('resolveArtifactRunEffects', () => {
  it('sums every line across the loadout and reads the implicits', () => {
    const effects = resolveArtifactRunEffects([
      artifact('wayfarers-anklet', { id: 'momentum', tier: 2, value: 15 }, [
        { id: 'max-hp', tier: 1, value: 18 },
        { id: 'elite-damage', tier: 3, value: 12 },
      ]),
      artifact('gluttons-kettle', { id: 'hearty-meal', tier: 5, value: 10 }, [
        { id: 'max-hp', tier: 5, value: 4 },
        { id: 'floor-shield', tier: 2, value: 35 },
        { id: 'crit-chance', tier: 4, value: 3 },
      ]),
    ])
    expect(effects).toMatchObject({
      maxHpPercent: 22,
      eliteDamagePercent: 12,
      floorShieldPercent: 35,
      critChance: 3,
      momentumPercent: 15,
      heartyMealPercent: 10,
      chartedChoices: false,
    })
  })

  it('is empty for a player carrying nothing', () => {
    expect(getPlayerArtifactEffects({ artifacts: undefined })).toBe(EMPTY_ARTIFACT_RUN_EFFECTS)
    expect(getPlayerArtifactEffects({ artifacts: [] })).toBe(EMPTY_ARTIFACT_RUN_EFFECTS)
    expect(getPlayerEliteDamagePercent({ artifacts: [], preparationEliteDamagePercent: 7 })).toBe(7)
  })
})

describe('artifacts in a run', () => {
  it('raise maximum HP like a gear line would', () => {
    const plain = createGame({ seed: 400 })
    const carried = createGame({
      seed: 400,
      preparation: preparation(artifact('ember-reliquary', RELIQUARY.implicit, [
        { id: 'max-hp', tier: 1, value: 18 },
      ])),
    })
    expect(carried.state.player.maxHp).toBeCloseTo(plain.state.player.maxHp * 1.18, 5)
    expect(carried.state.player.hp).toBe(carried.state.player.maxHp)
  })

  it('open the run behind a Bulwark shield worth the rolled share of max HP', () => {
    const game = createGame({
      seed: 401,
      preparation: preparation(artifact('ember-reliquary', RELIQUARY.implicit, [
        { id: 'floor-shield', tier: 3, value: 25 },
      ])),
    })
    expect(game.state.player.artifactShieldAmount)
      .toBe(Math.round(game.state.player.maxHp * 0.25))
  })

  it('lay a fourth card on the table for the Cartographer', () => {
    const plain = createGame({ seed: 402, startingLevel: 2 })
    expect(plain.getPendingChoiceFlows()[0]?.choices).toHaveLength(3)

    const charted = createGame({ seed: 402, startingLevel: 2, preparation: preparation(COMPASS) })
    const flow = charted.getPendingChoiceFlows()[0]
    const choices = flow?.type === 'level-up' ? flow.choices : []
    expect(choices).toHaveLength(4)
    expect(new Set(choices.map((choice) => choice.upgradeId)).size).toBe(4)
  })

  it('detonate a corpse into its neighbour on the tick after the kill', () => {
    const game = createGame({ seed: 403, preparation: preparation(RELIQUARY) })
    const player = game.state.player
    // Far enough away that the player's own attacks never reach either.
    game.state.enemies.push(
      {
        id: 900, definitionId: 'slime', x: player.x + 600, y: player.y, radius: 18,
        hp: 0, maxHp: 200, speed: 0, contactDamage: 0, xpReward: 0, targetId: player.id,
      },
      {
        id: 901, definitionId: 'slime', x: player.x + 640, y: player.y, radius: 18,
        hp: 5000, maxHp: 5000, speed: 0, contactDamage: 0, xpReward: 0, targetId: player.id,
      },
    )
    game.update(FIXED_STEP_SECONDS)
    const neighbour = () => game.state.enemies.find((enemy) => enemy.id === 901)
    expect(game.state.enemies.some((enemy) => enemy.id === 900)).toBe(false)
    expect(neighbour()?.hp).toBe(5000)
    game.update(FIXED_STEP_SECONDS)
    const afterBlast = neighbour()?.hp ?? 0
    expect(afterBlast).toBeLessThan(5000)
    expect(afterBlast).toBeGreaterThanOrEqual(5000 - 50 - 1)
  })

  it('keep the loadout across a checkpoint, read from the run config', () => {
    const game = createGame({ seed: 404, preparation: preparation(RELIQUARY, COMPASS) })
    const restored = Game.restoreFromCheckpoint(game.createCheckpoint())
    expect(restored.state.player.artifacts?.map((entry) => entry.baseId))
      .toEqual(['ember-reliquary', 'cartographers-compass'])
    expect(getPlayerArtifactEffects(restored.state.player).corpseDetonationPercent).toBe(25)
  })

  it('draw the same offer as ever when nothing is carried', () => {
    const first = createGame({ seed: 405, startingLevel: 3 })
    const second = createGame({ seed: 405, startingLevel: 3, preparation: preparation() })
    expect(second.getPendingChoiceFlows()[0]?.choices)
      .toEqual(first.getPendingChoiceFlows()[0]?.choices)
  })
})
