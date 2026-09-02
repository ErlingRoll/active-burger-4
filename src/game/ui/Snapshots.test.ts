import { describe, expect, it } from 'vitest'
import { createGearModifier } from '../../content/gear/ModifierPools'
import {
  BASIC_ATTACK_SKILL_ID,
  AEGIS_PULSE_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  CINDER_MINE_SKILL_ID,
  FIERY_TOUCH_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
  RALLYING_BANNER_SKILL_ID,
  SOUL_TETHER_SKILL_ID,
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
import { Rarity } from '../../content/rarity/Rarity'
import { createRunResultSnapshot, createUiSnapshot } from './Snapshots'
import {
  SOUL_TETHER_DURATION_SECONDS,
} from '../../game-config/skills'
import { getDerivedPlayerStats } from '../stats/DerivedStats'

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
      item.rarity = Rarity.Common
    })
    equipRolledItem(game.state.player, 'iron-cleaver', Rarity.Common, [
      createGearModifier('iron-cleaver', 'melee-leech', 4, 2),
    ])
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
    expect(snapshot.skills[0]?.resonanceReady).toBe(false)
    expect(snapshot.skills[0]?.totalDamageDealt).toBe(0)
    expect(snapshot.skills[0]?.damage).toMatchObject({ physical: 14 })
    expect(snapshot.skills[0]?.damageTypes).toEqual(['physical'])
    expect(snapshot.skills[0]?.estimatedSingleTargetDps).toBeCloseTo(14.7)
    expect(snapshot.skills[1]?.estimatedSingleTargetDps).toBeCloseTo(6.72)
    expect(snapshot.skills[2]?.estimatedSingleTargetDps).toBeCloseTo(5.852)
    expect(snapshot.skills[1]?.attunementDamage).toMatchObject({ physical: 8 })
    expect(snapshot.skills[1]?.attunementDamageTypes).toEqual(['physical'])
    expect(snapshot.skills[0]?.attacksPerSecond).toBeCloseTo(1)
    expect(snapshot.skills[0]?.cooldownSeconds).toBeNull()
    expect(snapshot.skills[0]?.cooldownProgress).toBe(0)
    expect(snapshot.skills[1]?.cooldownSeconds).toBeCloseTo(2.5)
    expect(snapshot.skills[1]?.cooldownProgress).toBe(0)
    expect(snapshot.skills[1]?.attacksPerSecond).toBeNull()
    expect(snapshot.skills[2]?.cooldownSeconds).toBeCloseTo(3)
    expect(snapshot.skills[0]?.dpsAssumption).toContain('attack cadence')
    expect(snapshot.skills[1]?.dpsAssumption).toContain('Whirlwind range')
    expect(snapshot.skills[2]?.dpsAssumption).toContain('Primary target')
    expect(snapshot.skills[2]?.skillModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'chain-lightning-chains',
          label: 'Chains',
          value: '5',
        }),
      ]),
    )

    const basicUpgrades = snapshot.skills[0]?.upgrades ?? []
    expect(basicUpgrades.find((upgrade) => upgrade.upgradeId === 'basic-attack-level'))
      .toMatchObject({
        relevant: true,
        status: 'acquired',
        choiceType: 'upgrade',
        upgradeType: 'level',
      })
    expect(snapshot.skills[1]?.upgrades.find(
      (upgrade) => upgrade.upgradeId === 'whirlwind-frost',
    )).toMatchObject({
      evolutionTags: ['chill', 'freeze'],
    })
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.skills)).toBe(true)
  })

  it('projects resonance readiness independently for each skill', () => {
    const game = createGame({ seed: 73 })
    const resonanceRequirement = game.state.player.resonance ?? 5
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
      {
        skillId: WHIRLWIND_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
        resonanceAttackCount: resonanceRequirement,
      },
      { skillId: CHAIN_LIGHTNING_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]

    const skills = createUiSnapshot(game.state).skills

    expect(skills.find((skill) => skill.skillId === BASIC_ATTACK_SKILL_ID)?.resonanceReady)
      .toBe(false)
    expect(skills.find((skill) => skill.skillId === WHIRLWIND_SKILL_ID)?.resonanceReady)
      .toBe(true)
    expect(skills.find((skill) => skill.skillId === CHAIN_LIGHTNING_SKILL_ID)?.resonanceReady)
      .toBe(false)
  })

  it('includes Chain Lightning chain bonuses in the skill modifier summary', () => {
    const game = createGame({ seed: 72 })
    const resonanceRequirement = game.state.player.resonance ?? 5
    game.state.player.skills = [{
      skillId: CHAIN_LIGHTNING_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
      resonanceAttackCount: resonanceRequirement,
    }]
    game.state.player.chainLightningChainBonus = 2
    game.state.player.chainLightningBonusTargets = 2

    expect(createUiSnapshot(game.state).skills[0]?.skillModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'chain-lightning-chains',
          value: '10',
        }),
      ]),
    )
  })

  it('projects Rallying Banner healing and active defensive values', () => {
    const game = createGame({ seed: 75 })
    game.state.player.skills = [{
      skillId: RALLYING_BANNER_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    }]
    game.state.run.selectedUpgradeIds.push('rallying-banner-bulwark')

    const rallyingBanner = createUiSnapshot(game.state).skills[0]
    expect(rallyingBanner?.description).toContain('every second')
    expect(rallyingBanner?.healingPerCast).toBe(4)
    expect(rallyingBanner?.dpsAssumption).toBe(
      'Heals immediately, then heals the player and living summons in the banner every second while active.',
    )
    expect(rallyingBanner?.skillModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'duration', value: '10 sec' }),
        expect.objectContaining({ id: 'damage-reduction', value: '25%' }),
      ]),
    )
  })

  it('projects evolution-specific healing, shielding, and active cooldown values', () => {
    const game = createGame({ seed: 76 })
    game.state.player.skills = [
      { skillId: VITALITY_SKILL_ID, level: 2, cooldownRemaining: 0 },
      { skillId: AEGIS_PULSE_SKILL_ID, level: 2, cooldownRemaining: 0 },
      { skillId: WHIRLWIND_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    game.state.player.hp = 30
    game.state.player.maxHp = 100
    game.state.player.vitalityMaxHpHealingPercent = 3
    game.state.player.vitalityLowHpHealingMultiplier = 2
    game.state.player.rallyingBannerRemaining = 5
    game.state.player.rallyingBannerCooldownReductionPercent = 12
    game.state.run.selectedUpgradeIds.push('aegis-pulse-bulwark')

    const skills = createUiSnapshot(game.state).skills
    const vitality = skills.find((skill) => skill.skillId === VITALITY_SKILL_ID)
    const aegis = skills.find((skill) => skill.skillId === AEGIS_PULSE_SKILL_ID)
    const whirlwind = skills.find((skill) => skill.skillId === WHIRLWIND_SKILL_ID)

    expect(vitality?.healingPerCast).toBeCloseTo(28)
    expect(vitality?.skillModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'healing-per-cast', value: '28' }),
      ]),
    )
    expect(aegis).toMatchObject({
      shieldPerCast: 32,
      shieldDurationSeconds: 6,
    })
    expect(aegis?.upgrades.find(
      (upgrade) => upgrade.upgradeId === 'aegis-pulse-bulwark',
    )).toMatchObject({
      valueLabel: '+12 shield, +2s duration',
      description: 'Aegis Pulse adds 12 shield and 2 seconds to each shield.',
      evolution: 'aegis-pulse-bulwark',
    })
    expect(whirlwind?.cooldownSeconds).toBeCloseTo(2.2)
  })

  it('projects synergy metadata and acquired status independently of evolutions', () => {
    const game = createGame({ seed: 77 })
    game.state.player.skills = [
      { skillId: BASIC_ATTACK_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: WHIRLWIND_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]

    const available = createUiSnapshot(game.state)
    expect(available.skills[0]?.upgrades.find(
      (upgrade) => upgrade.upgradeId === 'synergy-basic-attack-whirlwind',
    )).toMatchObject({
      status: 'available',
      synergySkillIds: [BASIC_ATTACK_SKILL_ID, WHIRLWIND_SKILL_ID],
    })
    expect(available.skills[0]?.upgrades.find(
      (upgrade) => upgrade.upgradeId === 'synergy-basic-attack-whirlwind',
    )).not.toHaveProperty('evolution')

    game.state.run.selectedUpgradeIds.push('synergy-basic-attack-whirlwind')
    const acquired = createUiSnapshot(game.state)
    expect(acquired.skills[1]?.upgrades.find(
      (upgrade) => upgrade.upgradeId === 'synergy-basic-attack-whirlwind',
    )).toMatchObject({
      status: 'acquired',
      synergySkillIds: [BASIC_ATTACK_SKILL_ID, WHIRLWIND_SKILL_ID],
    })
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
    game.state.player.skills.push({
      skillId: VITALITY_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    })
    game.state.run.skillDamageDealt = {
      [BASIC_ATTACK_SKILL_ID]: 1_250,
      [WHIRLWIND_SKILL_ID]: 500,
    }
    game.state.run.skillHealingDone = {
      [VITALITY_SKILL_ID]: 750,
      [WHIRLWIND_SKILL_ID]: 125,
    }

    const snapshot = createUiSnapshot(game.state)
    const result = createRunResultSnapshot(game.state)

    expect(snapshot.skills.find((skill) => skill.skillId === BASIC_ATTACK_SKILL_ID)
      ?.totalDamageDealt).toBe(1_250)
    expect(snapshot.skills.find((skill) => skill.skillId === VITALITY_SKILL_ID)
      ?.totalHealingDone).toBe(750)
    expect(result.skillDamage).toEqual([
      { skillId: BASIC_ATTACK_SKILL_ID, name: 'Basic Attack', damage: 1_250 },
      { skillId: WHIRLWIND_SKILL_ID, name: 'Whirlwind', damage: 500 },
    ])
    expect(result.skillHealing).toEqual([
      { skillId: WHIRLWIND_SKILL_ID, name: 'Whirlwind', healing: 125 },
      { skillId: VITALITY_SKILL_ID, name: 'Vitality', healing: 750 },
    ])
  })

  it('estimates current Essence from level, kills, and world modifiers', () => {
    const game = createGame({
      seed: 75,
      worldModifierIds: ['swarming'],
    })
    game.state.player.level = 4
    game.state.run.killCount = 25

    expect(createUiSnapshot(game.state).estimatedEssence).toBe(6)

    game.state.run.killCount = 30
    expect(createUiSnapshot(game.state).estimatedEssence).toBe(7)
  })

  it('projects the shortened normal-floor duration', () => {
    const game = createGame({
      seed: 76,
      worldModifierIds: ['shorter-minute'],
    })

    expect(createUiSnapshot(game.state)).toMatchObject({
      floorElapsedTime: 0,
      floorProgress: 0,
      floorDurationSeconds: 45,
    })
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
      damage: expect.objectContaining({ fire: 10.8, physical: 8 }),
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

  it('shows the selected Basic Attack damage conversion evolution', () => {
    const game = createGame({ seed: 95 })
    game.state.run.selectedUpgradeIds.push('basic-attack-lightning-attunement')

    const upgrade = createUiSnapshot(game.state).skills
      .find((skill) => skill.skillId === BASIC_ATTACK_SKILL_ID)
      ?.upgrades.find((candidate) =>
        candidate.upgradeId === 'basic-attack-lightning-attunement'
      )

    expect(upgrade?.valueLabel).toBe('Convert 70% physical to Lightning')
    expect(upgrade?.status).toBe('acquired')
  })

  it('projects current Attunement bonuses by positive damage type', () => {
    const game = createGame({ seed: 72 })
    const defaultAttunement = createUiSnapshot(game.state).characterStats.groups
      .find((group) => group.id === 'offence')
      ?.stats.find((stat) => stat.id === 'attunement')

    expect(defaultAttunement?.damageBonuses).toEqual([
      { damageType: 'physical', label: 'Physical', value: '+8' },
    ])

    equipRolledItem(
      game.state.player,
      'starcaller-amulet',
      Rarity.Legendary,
      [
        createGearModifier('starcaller-amulet', 'flat-lightning-damage', 2, 7),
        createGearModifier('starcaller-amulet', 'increased-elemental-damage', 3, 24),
      ],
    )

    const elementalAttunement = createUiSnapshot(game.state).characterStats.groups
      .find((group) => group.id === 'offence')
      ?.stats.find((stat) => stat.id === 'attunement')

    expect(elementalAttunement?.damageBonuses).toEqual([
      { damageType: 'physical', label: 'Physical', value: '+8' },
      { damageType: 'lightning', label: 'Lightning', value: '+5' },
    ])
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

    expect(vitality?.healingPerCast).toBeCloseTo(11.44)
    expect(vitality?.description).toContain('each living minion')
    expect(vitality?.dpsAssumption).toBe(
      'Restores health to you and each living minion automatically every cooldown.',
    )
    expect(vitality?.estimatedSingleTargetDps).toBeNull()
    expect(vitality?.skillModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'healing-per-cast', value: '11.44' }),
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
      Rarity.Legendary,
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

  it('only shows Chill on hit for skills that can produce direct hits', () => {
    const game = createGame({ seed: 100 })
    game.state.player.skills = [
      { skillId: VITALITY_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: SOUL_TETHER_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: CINDER_MINE_SKILL_ID, level: 1, cooldownRemaining: 0 },
    ]
    equipRolledItem(
      game.state.player,
      'starcaller-amulet',
      Rarity.Legendary,
      [createGearModifier('starcaller-amulet', 'frost-application', 4, 1)],
    )

    const skills = createUiSnapshot(game.state).skills
    const vitality = skills.find((skill) => skill.skillId === VITALITY_SKILL_ID)
    const soulTether = skills.find((skill) => skill.skillId === SOUL_TETHER_SKILL_ID)
    const cinderMine = skills.find((skill) => skill.skillId === CINDER_MINE_SKILL_ID)

    expect(vitality?.skillModifiers.map((modifier) => modifier.id)).not.toContain(
      'frost-on-hit',
    )
    expect(soulTether?.skillModifiers.map((modifier) => modifier.id)).not.toContain(
      'frost-on-hit',
    )
    expect(cinderMine?.skillModifiers.map((modifier) => modifier.id)).toContain(
      'frost-on-hit',
    )
    expect(soulTether).toBeDefined()
    if (!soulTether) {
      return
    }
    const playerStats = getDerivedPlayerStats(game.state.player)
    expect(soulTether.estimatedSingleTargetDps).toBeCloseTo(
      soulTether.damage.chaos *
        (1 + playerStats.dotMultiplier / 100) *
        SOUL_TETHER_DURATION_SECONDS /
        (soulTether.cooldownSeconds ?? 1),
    )
    expect(soulTether.damageTypes).toEqual(['chaos'])
    expect(soulTether.dpsAssumption).toContain('Chaos damage only')
  })

  it('shows staff DoT and Raise Skeleton modifiers in skill snapshots', () => {
    const game = createGame({ seed: 98, characterClassId: 'necromancer' })
    equipRolledItem(
      game.state.player,
      'swiftstride-boots',
      Rarity.Common,
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
        expect.objectContaining({ id: 'summon-damage', value: '12' }),
        expect.objectContaining({ id: 'summon-max-hp', value: '30' }),
        expect.objectContaining({ id: 'summon-attack-speed', value: '1 atk/s' }),
        expect.objectContaining({ id: 'summon-max-count', value: '1' }),
      ]),
    )
    expect(raiseSkeleton?.damage).toMatchObject({
      physical: 12,
    })
    expect(raiseSkeleton?.estimatedSingleTargetDps).toBeCloseTo(12.6)
    expect(raiseSkeleton?.dpsAssumption).toBe(
      'One persistent skeleton attacks the nearest target in range once per second.',
    )
    expect(basicAttack?.icon).toBe('✣')
    expect(raiseSkeleton?.icon).toBe('☠')
    expect(basicAttack?.icon).not.toBe(raiseSkeleton?.icon)
    expect(offence?.stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'dot-multiplier', value: '20%' }),
      ]),
    )
  })

  it('estimates Soul Tether using Chaos-only DoT damage and the DoT multiplier', () => {
    const game = createGame({ seed: 20260901 })
    game.state.player.skills = [{
      skillId: SOUL_TETHER_SKILL_ID,
      level: 1,
      cooldownRemaining: 0,
    }]
    equipRolledItem(
      game.state.player,
      'swiftstride-boots',
      Rarity.Common,
      [createGearModifier('swiftstride-boots', 'dot-multiplier', 1, 20)],
    )

    const soulTether = createUiSnapshot(game.state).skills[0]!

    expect(soulTether.damageTypes).toEqual(['chaos'])
    expect(soulTether.attunementDamageTypes).toEqual([])
    expect(soulTether.estimatedSingleTargetDps).toBeCloseTo(
      soulTether.damage.chaos *
        1.2 *
        SOUL_TETHER_DURATION_SECONDS /
        (soulTether.cooldownSeconds ?? 1),
    )
    expect(soulTether.dpsAssumption).toContain('Chaos damage only')
  })

  it('projects Raise Skeleton evolution metadata and Grave Legion cadence', () => {
    const game = createGame({ seed: 99, characterClassId: 'necromancer' })
    game.state.run.selectedUpgradeIds.push('raise-skeleton-legion')

    const raiseSkeleton = createUiSnapshot(game.state).skills.find(
      (skill) => skill.skillId === RAISE_SKELETON_SKILL_ID,
    )

    expect(raiseSkeleton?.skillModifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'summon-attack-speed', value: '1.05 atk/s' }),
      ]),
    )
    expect(raiseSkeleton?.upgrades.find(
      (upgrade) => upgrade.upgradeId === 'raise-skeleton-legion',
    )).toMatchObject({
      status: 'acquired',
      evolution: 'raise-skeleton-legion',
      valueLabel: '+5% attack speed, +3% per additional skeleton (max +14%)',
    })
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
      Rarity.Epic,
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
      Rarity.Legendary,
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
      Rarity.Rare,
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
    expect(snapshot.skills[0]?.description).toContain('100% increased damage')
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
        expect.objectContaining({
          id: 'primary-target-damage',
          value: '+100%',
        }),
      ]),
    )
    expect(snapshot.equipment.weapon?.implicitModifiers).toEqual([
      {
        id: 'bow-precision',
        label: 'Precision',
        description: '+100% Basic Attack damage against the primary target.',
      },
    ])
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
          id: 'resistance-elemental',
          value: '25%',
          uncappedValue: '25%',
          sources: expect.arrayContaining([
            expect.objectContaining({ label: 'Base', value: '0%' }),
            expect.objectContaining({ value: '+7%' }),
            expect.objectContaining({ value: '+18%' }),
          ]),
        }),
      ]))
    const defenceStatIds = snapshot.characterStats.groups
      .find((group) => group.id === 'defence')?.stats
      .map((stat) => stat.id) ?? []
    expect(defenceStatIds).not.toEqual(expect.arrayContaining([
      'resistance-lightning',
      'resistance-fire',
      'resistance-cold',
    ]))
    expect(Object.isFrozen(snapshot.characterStats)).toBe(true)
    expect(
      Object.isFrozen(snapshot.characterStats.groups[0]?.stats),
    ).toBe(true)
  })

  it('shows Giant set resistance bonuses as defence sources', () => {
    const game = createGame({ seed: 81 })
    equipItem(game.state.player, 'iron-cleaver')
    equipItem(game.state.player, 'watchers-helm')

    const physical = createUiSnapshot(game.state).characterStats.groups
      .find((group) => group.id === 'defence')
      ?.stats.find((stat) => stat.id === 'resistance-physical')

    expect(physical).toMatchObject({
      value: '15%',
      uncappedValue: '15%',
      sources: expect.arrayContaining([
        expect.objectContaining({ label: "Giant's Set", value: '+15%' }),
      ]),
    })
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
      Rarity.Legendary,
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
      Rarity.Legendary,
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
      Rarity.Common,
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
    game.setFreeMovementEnabled(false)
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
      freeMode: false,
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

  it('projects Free movement state and its manual intent', () => {
    const game = createGame({ seed: 75 })
    game.setFreeMovementEnabled(true)
    game.setFreeMovementDirection(1, -1)
    game.update(1 / 60)

    const snapshot = game.getUiSnapshot()

    expect(snapshot.behavior).toMatchObject({
      freeMode: true,
      activeIntent: {
        source: 'free',
        label: 'Free movement',
        directionX: 1,
        directionY: -1,
      },
    })
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
