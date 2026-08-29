import { describe, expect, it } from 'vitest'
import { createGearModifier } from '../../content/gear/ModifierPools'
import {
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  FIERY_TOUCH_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
} from '../../content/skills/Skills'
import { xpRequiredForNextLevel } from '../../content/progression/XpBalance'
import { createGame, FIXED_STEP_SECONDS } from '../Game'
import { equipItem, equipRolledItem } from '../equipment/EquipmentState'
import {
  GEAR_CHOICES_PER_PICKUP,
  generateGearChoices,
} from '../equipment/GearChoices'
import { createRunResultSnapshot, createUiSnapshot } from './Snapshots'

describe('UI snapshots', () => {
  it('normalizes special gear choice order when projecting pending flows', () => {
    const game = createGame({ seed: 407 })
    for (const itemId of [
      'iron-cleaver',
      'watchers-helm',
      'bastion-plate',
      'swiftstride-boots',
      'duelists-band',
      'giants-amulet',
    ] as const) {
      equipItem(game.state.player, itemId)
    }
    Object.values(game.state.player.equipment ?? {}).forEach((item) => {
      item.rarity = 'common'
    })
    const choices = generateGearChoices(game.state, GEAR_CHOICES_PER_PICKUP, {
      next: () => 0,
      int: (min: number) => min,
      chance: () => true,
      pick: <T>(items: readonly T[]) => items[0] as T,
    })
    const snapshot = createUiSnapshot(game.state, [{
      type: 'gear-pickup',
      pickupId: 1,
      choices: [choices[2]!, choices[1]!, choices[0]!],
    }])

    const projectedChoiceTypes = snapshot.pendingChoiceFlow?.type === 'gear-pickup'
      ? snapshot.pendingChoiceFlow.choices.map((choice) => choice.type)
      : []
    expect(projectedChoiceTypes).toEqual([
      'gear-rarity-floor',
      'upgrade-equipped-item',
      'gear',
    ])
  })

  it('projects only acquired skills with actual single-target DPS assumptions', () => {
    const game = createGame({ seed: 71 })
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: WHIRLWIND_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: CHAIN_LIGHTNING_SKILL_ID, level: 2, cooldownRemaining: 0 },
    ]
    game.state.run.selectedUpgradeIds.push(
      'basic-attack-level',
      'whirlwind-unlock',
    )

    const snapshot = createUiSnapshot(game.state)

    expect(snapshot.skillSlotCount).toBe(5)
    expect(snapshot.skills.map((skill) => skill.skillId)).toEqual([
      BASIC_ATTACK_SKILL_ID,
      WHIRLWIND_SKILL_ID,
      CHAIN_LIGHTNING_SKILL_ID,
    ])
    expect(snapshot.skills[0]?.name).toBe('Basic Attack')
    expect(snapshot.skills[0]?.castCount).toBe(0)
    expect(snapshot.skills[0]?.totalDamageDealt).toBe(0)
    expect(snapshot.skills[0]?.damage).toMatchObject({ physical: 14 })
    expect(snapshot.skills[0]?.damageTypes).toEqual(['physical'])
    expect(snapshot.skills[0]?.estimatedSingleTargetDps).toBeCloseTo(14.7)
    expect(snapshot.skills[1]?.estimatedSingleTargetDps).toBeCloseTo(3.36)
    expect(snapshot.skills[2]?.estimatedSingleTargetDps).toBeCloseTo(2.289)
    expect(snapshot.skills[0]?.attacksPerSecond).toBeCloseTo(1)
    expect(snapshot.skills[0]?.cooldownSeconds).toBeNull()
    expect(snapshot.skills[0]?.cooldownProgress).toBe(0)
    expect(snapshot.skills[1]?.cooldownSeconds).toBeCloseTo(2.5)
    expect(snapshot.skills[1]?.cooldownProgress).toBe(0)
    expect(snapshot.skills[1]?.attacksPerSecond).toBeNull()
    expect(snapshot.skills[2]?.cooldownSeconds).toBeCloseTo(3.5)
    expect(snapshot.skills[0]?.dpsAssumption).toContain('attack cadence')
    expect(snapshot.skills[1]?.dpsAssumption).toContain('Whirlwind range')
    expect(snapshot.skills[2]?.dpsAssumption).toContain('Primary target')

    const basicUpgrades = snapshot.skills[0]?.upgrades ?? []
    expect(basicUpgrades.find((upgrade) => upgrade.upgradeId === 'basic-attack-level'))
      .toMatchObject({ relevant: true, status: 'acquired' })
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.skills)).toBe(true)
  })

  it('projects active cooldown progress for skill feedback', () => {
    const game = createGame({ seed: 72 })
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0.5, castCount: 3 },
      { skillId: WHIRLWIND_SKILL_ID, level: 1, cooldownRemaining: 1.25, castCount: 7 },
    ]
    game.state.run.selectedUpgradeIds.push('whirlwind-unlock')

    const snapshot = createUiSnapshot(game.state)

    expect(snapshot.skills[0]?.cooldownProgress).toBeCloseTo(0.5)
    expect(snapshot.skills[1]?.cooldownProgress).toBeCloseTo(0.5)
    expect(snapshot.skills[0]?.castCount).toBe(3)
    expect(snapshot.skills[1]?.castCount).toBe(7)
  })

  it('projects cumulative skill damage into the HUD and run results', () => {
    const game = createGame({ seed: 74 })
    game.state.run.skillDamageDealt = {
      [BASIC_ATTACK_SKILL_ID]: 1_250,
      [WHIRLWIND_SKILL_ID]: 500,
    }

    const snapshot = createUiSnapshot(game.state)
    const result = createRunResultSnapshot(game.state)

    expect(snapshot.skills.find((skill) => skill.skillId === BASIC_ATTACK_SKILL_ID)
      ?.totalDamageDealt).toBe(1_250)
    expect(result.skillDamage).toEqual([
      { skillId: BASIC_ATTACK_SKILL_ID, name: 'Basic Attack', damage: 1_250 },
      { skillId: WHIRLWIND_SKILL_ID, name: 'Whirlwind', damage: 500 },
    ])
  })

  it('projects Fiery Touch trigger stats and skill-specific cooldown ranks', () => {
    const game = createGame({ seed: 73 })
    game.state.player.skills.push({
      skillId: FIERY_TOUCH_SKILL_ID,
      level: 2,
      cooldownRemaining: 0.9,
    })
    game.state.run.selectedUpgradeIds.push(
      'fiery-touch-cooldown-reduction',
      'fiery-touch-cooldown-reduction',
    )

    const fieryTouch = createUiSnapshot(game.state).skills.find(
      (skill) => skill.skillId === FIERY_TOUCH_SKILL_ID,
    )

    expect(fieryTouch).toMatchObject({
      name: 'Fiery Touch',
      tags: ['fire', 'area', 'trigger'],
      damage: expect.objectContaining({ fire: 15 }),
      cooldownSeconds: 1.8,
      cooldownProgress: 0.5,
      dpsAssumption: 'Triggers on direct player or summon hits, subject to its cooldown.',
    })
    expect(fieryTouch?.skillModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'skill-cooldown-reduction',
          value: '10%',
        }),
      ]),
    )
    expect(fieryTouch?.upgrades.find(
      (upgrade) => upgrade.upgradeId === 'fiery-touch-cooldown-reduction',
    )).toMatchObject({
      status: 'available',
      valueLabel: '+10% Fiery Touch cooldown reduction',
    })
  })

  it('shows the accumulated value for repeated skill upgrades', () => {
    const game = createGame({ seed: 94 })
    const basicAttack = game.state.player.skills.find(
      (skill) => skill.skillId === BASIC_ATTACK_SKILL_ID,
    )
    if (!basicAttack) {
      throw new Error('Expected Basic Attack to be equipped')
    }
    basicAttack.level = 3
    game.state.run.selectedUpgradeIds.push(
      'basic-attack-level',
      'basic-attack-level',
    )

    const upgrade = createUiSnapshot(game.state).skills
      .find((skill) => skill.skillId === BASIC_ATTACK_SKILL_ID)
      ?.upgrades.find((candidate) => candidate.upgradeId === 'basic-attack-level')

    expect(upgrade?.valueLabel).toBe('+20% Basic Attack damage')
  })

  it('shows the accumulated value for repeated Rapid Fire upgrades', () => {
    const game = createGame({ seed: 95 })
    game.state.run.selectedUpgradeIds.push(
      'attack-speed-boost',
      'attack-speed-boost',
      'attack-speed-boost',
    )

    const upgrade = createUiSnapshot(game.state).skills
      .find((skill) => skill.skillId === BASIC_ATTACK_SKILL_ID)
      ?.upgrades.find((candidate) => candidate.upgradeId === 'attack-speed-boost')

    expect(upgrade?.valueLabel).toBe('+0.6 attacks/sec')
  })

  it('shows Vitality healing and increased healing in the skill and Defence panels', () => {
    const game = createGame({ seed: 97 })
    game.state.player.skills.push({
      skillId: VITALITY_SKILL_ID,
      level: 2,
      cooldownRemaining: 0,
    })
    game.state.player.increasedHealing = 4

    const snapshot = createUiSnapshot(game.state)
    const vitality = snapshot.skills.find(
      (skill) => skill.skillId === VITALITY_SKILL_ID,
    )
    const defence = snapshot.characterStats.groups.find(
      (group) => group.id === 'defence',
    )

    expect(vitality?.healingPerCast).toBeCloseTo(4.16)
    expect(vitality?.estimatedSingleTargetDps).toBeNull()
    expect(vitality?.skillModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'healing-per-cast', value: '4.16' }),
        expect.objectContaining({ id: 'increased-healing', value: '4%' }),
      ]),
    )
    expect(defence?.stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'increased-healing',
          value: '+4%',
        }),
      ]),
    )
  })

  it('only shows Vitality modifiers that affect healing or its cooldown', () => {
    const game = createGame({ seed: 99 })
    game.state.player.skills = [{
      skillId: VITALITY_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    }]
    equipRolledItem(
      game.state.player,
      'starcaller-amulet',
      'legendary',
      [
        createGearModifier('starcaller-amulet', 'flat-lightning-damage', 2, 7),
        createGearModifier('starcaller-amulet', 'increased-elemental-damage', 3, 24),
        createGearModifier('starcaller-amulet', 'crit-chance', 4, 7),
        createGearModifier('starcaller-amulet', 'crit-multiplier', 4, 28),
        createGearModifier('starcaller-amulet', 'cooldown-reduction', 4, 10),
      ],
    )

    const vitality = createUiSnapshot(game.state).skills.find(
      (skill) => skill.skillId === VITALITY_SKILL_ID,
    )
    const modifierIds = vitality?.gearModifiers.map((modifier) => modifier.id) ?? []
    const skillModifierIds = vitality?.skillModifiers.map((modifier) => modifier.id) ?? []

    expect(modifierIds).toEqual(expect.arrayContaining([
      'crit-chance',
      'crit-multiplier',
    ]))
    expect(modifierIds).not.toEqual(expect.arrayContaining([
      'flat-lightning-damage',
      'increased-elemental-damage',
    ]))
    expect(skillModifierIds).toContain('cooldown-reduction')
    expect(vitality?.damageTypes).toEqual([])
    expect(vitality?.estimatedSingleTargetDps).toBeNull()
  })

  it('shows staff DoT and Raise Skeleton modifiers in skill snapshots', () => {
    const game = createGame({ seed: 98, playstyleId: 'necromancer' })
    equipRolledItem(
      game.state.player,
      'swiftstride-boots',
      'common',
      [createGearModifier('swiftstride-boots', 'dot-multiplier', 1, 20)],
    )

    const snapshot = createUiSnapshot(game.state)
    const basicAttack = snapshot.skills.find(
      (skill) => skill.skillId === BASIC_ATTACK_SKILL_ID,
    )
    const raiseSkeleton = snapshot.skills.find(
      (skill) => skill.skillId === RAISE_SKELETON_SKILL_ID,
    )
    const offence = snapshot.characterStats.groups.find(
      (group) => group.id === 'offence',
    )

    expect(basicAttack?.skillModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'dot-multiplier', value: '20%' }),
      ]),
    )
    expect(raiseSkeleton?.skillModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'summon-damage', value: '6' }),
        expect.objectContaining({ id: 'summon-max-hp', value: '10' }),
        expect.objectContaining({ id: 'summon-attack-speed', value: '1 atk/s' }),
        expect.objectContaining({ id: 'summon-max-count', value: '1' }),
      ]),
    )
    expect(raiseSkeleton?.damage).toMatchObject({
      physical: 6,
    })
    expect(raiseSkeleton?.estimatedSingleTargetDps).toBeCloseTo(6.3)
    expect(raiseSkeleton?.dpsAssumption).toBe(
      'One persistent skeleton attacks the nearest target in range once per second.',
    )
    expect(basicAttack?.icon).toBe('✦')
    expect(raiseSkeleton?.icon).toBe('☠')
    expect(basicAttack?.icon).not.toBe(raiseSkeleton?.icon)
    expect(offence?.stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'dot-multiplier', value: '20%' }),
      ]),
    )
  })

  it('does not show skill unlocks or unearned Whirlwind leech', () => {
    const game = createGame({ seed: 96 })
    const whirlwind = createUiSnapshot(game.state).skills
      .find((skill) => skill.skillId === WHIRLWIND_SKILL_ID)

    expect(whirlwind?.upgrades.map((upgrade) => upgrade.upgradeId)).not.toContain(
      'whirlwind-unlock',
    )
    expect(whirlwind?.upgrades.find(
      (upgrade) => upgrade.upgradeId === 'whirlwind-leech',
    )).toMatchObject({ status: 'available', valueLabel: '+2% Whirlwind leech' })
  })

  it('retains recent player combat events in a defeat result', () => {
    const game = createGame({ seed: 93 })
    game.state.run.phase = 'defeat'
    game.state.run.playerCombatLog = [{
      time: 12,
      kind: 'damage',
      amount: 24,
      damageType: 'fire',
      source: 'Inferno Warden: Fire Nova',
      resultingHp: 0,
    }]

    expect(createRunResultSnapshot(game.state).playerCombatLog).toEqual([
      {
        time: 12,
        kind: 'damage',
        amount: 24,
        damageType: 'fire',
        source: 'Inferno Warden: Fire Nova',
        resultingHp: 0,
      },
    ])
    expect(createRunResultSnapshot(game.state).skillDamage).toEqual([])
  })

  it('projects the active boss, telegraph, and autonomous Dodge state immutably', () => {
    const game = createGame({ seed: 72 })
    expect(game.startEncounter()).toBe(true)
    game.update(FIXED_STEP_SECONDS)

    const snapshot = createUiSnapshot(game.state)

    expect(snapshot.encounterStatus).toBe('active')
    expect(snapshot.boss).toMatchObject({
      name: 'Stone Golem',
      status: 'active',
      hp: 900,
      maxHp: 900,
      hpProgress: 1,
    })
    expect(snapshot.telegraphs).toHaveLength(1)
    expect(snapshot.dodge).toMatchObject({
      mode: 'autonomous',
      level: 1,
      reactionTime: 0.1,
      active: true,
      activeTelegraphCount: 1,
    })
    expect(Object.isFrozen(snapshot.boss)).toBe(true)
    expect(Object.isFrozen(snapshot.telegraphs)).toBe(true)
    expect(Object.isFrozen(snapshot.telegraphs[0]?.points)).toBe(true)
    expect(Object.isFrozen(snapshot.dodge)).toBe(true)
  })

  it('projects weapon-driven Basic Attack presentation and relevant gear modifiers', () => {
    const game = createGame({ seed: 78 })
    equipRolledItem(
      game.state.player,
      'swiftstride-boots',
      'epic',
      [
        createGearModifier('swiftstride-boots', 'movement-speed', 3, 11),
        createGearModifier('swiftstride-boots', 'attack-speed', 5, 6),
        createGearModifier('swiftstride-boots', 'attack-range', 4, 20),
        createGearModifier('swiftstride-boots', 'elemental-resistance', 5, 7),
      ],
    )
    equipRolledItem(
      game.state.player,
      'starcaller-amulet',
      'legendary',
      [
        createGearModifier('starcaller-amulet', 'flat-lightning-damage', 2, 7),
        createGearModifier('starcaller-amulet', 'increased-elemental-damage', 3, 24),
        createGearModifier('starcaller-amulet', 'crit-multiplier', 4, 28),
        createGearModifier('starcaller-amulet', 'attack-range', 3, 28),
        createGearModifier('starcaller-amulet', 'elemental-resistance', 4, 18),
      ],
    )
    equipRolledItem(
      game.state.player,
      'hunters-bow',
      'rare',
      [
        createGearModifier('hunters-bow', 'increased-projectile-damage', 4, 14),
        createGearModifier('hunters-bow', 'basic-attack-extra-projectiles', 4, 1),
        createGearModifier('hunters-bow', 'projectile-chains', 4, 2),
      ],
    )

    const snapshot = createUiSnapshot(game.state)

    expect(snapshot.skills[0]).toMatchObject({
      skillId: BASIC_ATTACK_SKILL_ID,
      name: 'Basic Attack',
      icon: '➶',
      tags: ['physical', 'projectile'],
    })
    expect(snapshot.skills[0]?.description).toContain('arrows')
    expect(snapshot.skills[0]?.gearModifiers.map((modifier) => modifier.id)).toEqual(
      expect.arrayContaining([
        'increased-projectile-damage',
        'projectile-chains',
      ]),
    )
    expect(snapshot.skills[0]?.skillModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'attack-range',
          value: '208',
        }),
        expect.objectContaining({
          id: 'basic-attack-extra-projectiles',
          value: '1',
        }),
      ]),
    )
    expect(snapshot.characterStats.groups.map((group) => group.id)).toEqual(
      expect.arrayContaining([
        'offence',
        'defence',
      ]),
    )
    expect(snapshot.characterStats.groups.find((group) => group.id === 'offence')?.stats)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'cooldown-reduction',
          value: '0%',
          appliesTo: 'Whirlwind, Chain Lightning, and Vitality; never Basic Attack.',
        }),
      ]))
    const offenceStatIds = snapshot.characterStats.groups
      .find((group) => group.id === 'offence')?.stats
      .map((stat) => stat.id) ?? []
    expect(offenceStatIds).not.toEqual(expect.arrayContaining([
      'attack-damage',
      'attack-speed',
      'attack-range',
      'whirlwind-leech',
      'basic-attack-extra-projectiles',
    ]))
    expect(snapshot.characterStats.groups.find((group) => group.id === 'offence')?.stats)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'flat-damage-lightning', value: '+7' }),
        expect.objectContaining({ id: 'increased-damage-elemental', value: '+24%' }),
        expect.objectContaining({ id: 'increased-damage-projectile', value: '+14%' }),
        expect.objectContaining({ id: 'projectile-chains', value: '2' }),
      ]))
    expect(snapshot.characterStats.groups.find((group) => group.id === 'defence')?.stats)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'resistance-lightning',
          value: '25%',
        }),
        expect.objectContaining({
          id: 'resistance-fire',
          value: '25%',
        }),
        expect.objectContaining({
          id: 'resistance-cold',
          value: '25%',
        }),
      ]))
    expect(Object.isFrozen(snapshot.characterStats)).toBe(true)
    expect(
      Object.isFrozen(snapshot.characterStats.groups[0]?.stats),
    ).toBe(true)
  })

  it('combines global and skill-specific modifiers for every acquired skill', () => {
    const game = createGame({ seed: 80 })
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: WHIRLWIND_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: CHAIN_LIGHTNING_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    equipRolledItem(
      game.state.player,
      'iron-cleaver',
      'legendary',
      [
        createGearModifier('iron-cleaver', 'attack-speed', 5, 4),
        createGearModifier('iron-cleaver', 'cooldown-reduction', 5, 4),
        createGearModifier('iron-cleaver', 'melee-leech', 5, 1),
        createGearModifier('iron-cleaver', 'increased-global-damage', 5, 5),
        createGearModifier('iron-cleaver', 'increased-physical-damage', 5, 8),
      ],
    )
    equipRolledItem(
      game.state.player,
      'swiftstride-boots',
      'legendary',
      [
        createGearModifier('swiftstride-boots', 'attack-range', 5, 10),
        createGearModifier('swiftstride-boots', 'area-of-effect', 5, 5),
      ],
    )

    const snapshot = createUiSnapshot(game.state)
    const basicAttack = snapshot.skills.find(
      (skill) => skill.skillId === BASIC_ATTACK_SKILL_ID,
    )
    const whirlwind = snapshot.skills.find(
      (skill) => skill.skillId === WHIRLWIND_SKILL_ID,
    )
    const chainLightning = snapshot.skills.find(
      (skill) => skill.skillId === CHAIN_LIGHTNING_SKILL_ID,
    )

    expect(basicAttack?.skillModifiers.map((modifier) => modifier.id)).toEqual(
      expect.arrayContaining([
        'attack-damage',
        'attack-speed',
        'attack-range',
        'melee-leech',
      ]),
    )
    expect(whirlwind?.skillModifiers.map((modifier) => modifier.id)).toEqual(
      expect.arrayContaining([
        'cooldown-reduction',
        'area-of-effect',
        'whirlwind-leech',
      ]),
    )
    expect(chainLightning?.skillModifiers.map((modifier) => modifier.id)).toEqual(
      expect.arrayContaining(['cooldown-reduction']),
    )
    expect(chainLightning?.skillModifiers.map((modifier) => modifier.id)).not.toContain(
      'area-of-effect',
    )

    for (const skill of snapshot.skills) {
      expect(skill.gearModifiers.map((modifier) => modifier.id)).toContain(
        'increased-global-damage',
      )
    }
  })

  it('uses equipped weapon variant tags for Basic Attack snapshots', () => {
    const game = createGame({ seed: 79 })
    equipRolledItem(
      game.state.player,
      'iron-cleaver',
      'common',
      [
        createGearModifier('iron-cleaver', 'melee-leech', 4, 2),
      ],
    )

    const snapshot = createUiSnapshot(game.state)

    expect(snapshot.skills[0]).toMatchObject({
      skillId: BASIC_ATTACK_SKILL_ID,
      icon: '🗡',
      tags: ['physical', 'melee', 'area'],
    })
    expect(snapshot.skills[0]?.description).toContain('melee arc')
  })

  it('projects the selected behavior profile and active intent immutably', () => {
    const game = createGame({ seed: 73 })
    game.setBehaviorProfile('cautious')
    game.state.player.behaviorController!.lastCandidate = {
      source: 'dodge',
      directionX: 1,
      directionY: 0,
      speed: 200,
      priority: 10,
    }

    const snapshot = createUiSnapshot(game.state)

    expect(snapshot.behavior).toMatchObject({
      profileId: 'cautious',
      profileName: 'Cautious',
      profileDescription: 'Kites earlier around packs and high-threat enemies, closing to attack range when needed.',
      activeIntent: {
        source: 'dodge',
        label: 'Dodge',
        directionX: 1,
        speed: 200,
      },
    })
    expect(Object.isFrozen(snapshot.behavior)).toBe(true)
    expect(Object.isFrozen(snapshot.behavior.activeIntent)).toBe(true)
  })

  it('projects floor, stairs, transition, pickups, and Inferno enrage state', () => {
    const game = createGame({ seed: 74 })
    game.spawnXpPickup({ x: 0, y: 0 }, 5)
    game.spawnStairs({ x: 0, y: 0 }, true)
    game.spawnBoss('inferno-warden', { x: 320, y: 0 })

    const snapshot = game.getUiSnapshot()

    expect(snapshot.floor).toBe(1)
    expect(snapshot.timeline[0]).toMatchObject({
      name: 'Stone Golem',
      status: 'upcoming',
    })
    expect(snapshot.pickups).toHaveLength(1)
    expect(snapshot.stairs).toMatchObject({
      isFinal: true,
      playerTouching: true,
      rewardsCollected: false,
    })
    expect(snapshot.boss).toMatchObject({
      name: 'Inferno Warden',
      isFinal: true,
      enrage: {
        elapsedSeconds: expect.any(Number),
        movementSpeedMultiplier: expect.any(Number),
        damageMultiplier: expect.any(Number),
        cooldownMultiplier: expect.any(Number),
      },
    })
    expect(Object.isFrozen(snapshot.timeline[0])).toBe(true)
    expect(Object.isFrozen(snapshot.stairs)).toBe(true)
    expect(Object.isFrozen(snapshot.pickups[0])).toBe(true)

    const transitionGame = createGame({ seed: 76 })
    transitionGame.spawnStairs({ x: 0, y: 0 })
    transitionGame.update(FIXED_STEP_SECONDS)
    const transitionSnapshot = transitionGame.getUiSnapshot()
    expect(transitionSnapshot.floorTransition).toMatchObject({
      fromFloor: 1,
      toFloor: 2,
      progress: 0,
    })
    expect(transitionSnapshot.phase).toBe('floor-transition')
  })

  it('projects queued choices without exposing mutable simulation arrays', () => {
    const game = createGame({ seed: 75 })
    game.spawnXpPickup({ x: 0, y: 0 }, xpRequiredForNextLevel(1))
    game.update(FIXED_STEP_SECONDS)

    const snapshot = game.getUiSnapshot()

    expect(snapshot.pendingChoiceCount).toBe(1)
    expect(snapshot.pendingChoiceFlow?.type).toBe('level-up')
    expect(Object.isFrozen(snapshot.pendingChoiceFlow)).toBe(true)
    expect(Object.isFrozen(snapshot.pendingChoiceFlow?.choices)).toBe(true)
  })
})
