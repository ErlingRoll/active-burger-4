import type { DivineGambaEffect, DivineGambaMachineConfig, DivineGambaPocket } from './sim/types.ts'

/**
 * The Divine Gamba as content: the pocket tables, the parts and modifiers on
 * the Shardwright's shelf, and the fold that turns an installed set of them
 * into the machine the simulation runs.
 *
 * Every value here is mirrored in supabase/migrations/*_add_divine_gamba.sql,
 * and tests/divineGambaRegistry.test.ts holds the two together: the seed rows
 * are parsed out of the migration and compared with these tables, and the
 * fixture set the migration asserts against `divine_gamba_resolve_machine`
 * is the set `resolveDivineGambaMachine` is asserted against here.
 *
 * The numbers were tuned against the simulation, not against a formula. The
 * two house rules that hold them, that the return to player is below one and
 * that a single play profits less than half the time, are asserted for every
 * loadout by tests/divineGambaOdds.test.ts.
 */

export const DIVINE_GAMBA_BASE_BALL_PRICE = 20

/**
 * Relative weights by rarity, in tenths of a percent: a legendary box is one
 * in a thousand, and the rest share the other 999.
 */
export const DIVINE_GAMBA_BOX_RARITY_WEIGHTS: Readonly<Record<string, number>> = {
  common: 550,
  uncommon: 300,
  rare: 120,
  epic: 29,
  legendary: 1,
}

/**
 * The pocket tables, by row count.
 *
 * Only the outer pockets pay above the ball price, and together they hold
 * under a third of landings, which is what makes a single ball a losing bet
 * more often than not. The outermost two always carry a box as well as their
 * payout; a ball that reaches one is the rarest thing the machine does.
 */
export const DIVINE_GAMBA_POCKET_TABLES: Readonly<Record<number, readonly DivineGambaPocket[]>> = {
  8: [
    { multiplierPercent: 1000, boxChanceBasisPoints: 10000 },
    { multiplierPercent: 300, boxChanceBasisPoints: 0 },
    { multiplierPercent: 120, boxChanceBasisPoints: 0 },
    { multiplierPercent: 60, boxChanceBasisPoints: 0 },
    { multiplierPercent: 30, boxChanceBasisPoints: 0 },
    { multiplierPercent: 60, boxChanceBasisPoints: 0 },
    { multiplierPercent: 120, boxChanceBasisPoints: 0 },
    { multiplierPercent: 300, boxChanceBasisPoints: 0 },
    { multiplierPercent: 1000, boxChanceBasisPoints: 10000 },
  ],
  10: [
    { multiplierPercent: 3000, boxChanceBasisPoints: 10000 },
    { multiplierPercent: 600, boxChanceBasisPoints: 0 },
    { multiplierPercent: 200, boxChanceBasisPoints: 0 },
    { multiplierPercent: 100, boxChanceBasisPoints: 0 },
    { multiplierPercent: 50, boxChanceBasisPoints: 0 },
    { multiplierPercent: 30, boxChanceBasisPoints: 0 },
    { multiplierPercent: 50, boxChanceBasisPoints: 0 },
    { multiplierPercent: 100, boxChanceBasisPoints: 0 },
    { multiplierPercent: 200, boxChanceBasisPoints: 0 },
    { multiplierPercent: 600, boxChanceBasisPoints: 0 },
    { multiplierPercent: 3000, boxChanceBasisPoints: 10000 },
  ],
}

export const DIVINE_GAMBA_BASE_ROWS = 8

/**
 * What a part does to the machine, as the server stores it.
 *
 * The physics effects pass straight through to the simulation. The rest are
 * folded into the machine config by `resolveDivineGambaMachine` and by its
 * SQL twin.
 */
export type DivineGambaPartEffect =
  | DivineGambaEffect
  | { kind: 'multiplier-scale'; percent: number }
  /** The pockets just inside the jackpots can hold a box too, at this chance. */
  | { kind: 'box-chance-inner'; basisPoints: number }
  /** Scales every rarity weight above common, so a box is rarer more often. */
  | { kind: 'rarity-shift'; percent: number }
  | { kind: 'stake-tier'; stake: number }
  | { kind: 'board-rows'; rows: number }

export type DivineGambaPartKind = 'part' | 'modifier'

export interface DivineGambaPartDefinition {
  id: string
  kind: DivineGambaPartKind
  name: string
  description: string
  essenceCost: number
  shardCost: number
  /** Added to the ball price while the modifier is on. Zero for a part. */
  pricePercent: number
  requiresPartId: string | null
  sortOrder: number
  effect: DivineGambaPartEffect
}

/**
 * The Shardwright's shelf.
 *
 * A part is installed for good; a modifier is owned and switched on per play.
 * A modifier that raises the expected return carries a surcharge sized so
 * that the house rules still hold with it on, which the odds test checks.
 */
export const DIVINE_GAMBA_PART_DEFINITIONS: Readonly<Record<string, DivineGambaPartDefinition>> = {
  'brass-rails': {
    id: 'brass-rails',
    kind: 'part',
    name: 'Brass rails',
    description: 'Polished rails along every pocket. Each pays five percent more.',
    essenceCost: 600,
    shardCost: 10,
    pricePercent: 0,
    requiresPartId: null,
    sortOrder: 0,
    effect: { kind: 'multiplier-scale', percent: 105 },
  },
  'jackpot-pocket': {
    id: 'jackpot-pocket',
    kind: 'part',
    name: 'Lined pockets',
    description: 'A rift lining in the pockets beside the jackpots. One ball in four that lands there brings a box.',
    essenceCost: 800,
    shardCost: 16,
    pricePercent: 0,
    requiresPartId: null,
    sortOrder: 1,
    effect: { kind: 'box-chance-inner', basisPoints: 2500 },
  },
  'high-stakes-2': {
    id: 'high-stakes-2',
    kind: 'part',
    name: 'Double stake',
    description: 'Unlocks balls at twice the price, paying twice as much.',
    essenceCost: 400,
    shardCost: 8,
    pricePercent: 0,
    requiresPartId: null,
    sortOrder: 2,
    effect: { kind: 'stake-tier', stake: 2 },
  },
  'high-stakes-5': {
    id: 'high-stakes-5',
    kind: 'part',
    name: 'Quintuple stake',
    description: 'Unlocks balls at five times the price, paying five times as much.',
    essenceCost: 1500,
    shardCost: 24,
    pricePercent: 0,
    requiresPartId: 'high-stakes-2',
    sortOrder: 3,
    effect: { kind: 'stake-tier', stake: 5 },
  },
  'tall-frame': {
    id: 'tall-frame',
    kind: 'part',
    name: 'Tall frame',
    description: 'Two more rows of pegs and eleven pockets. The outer ones pay thirty times the ball.',
    essenceCost: 2000,
    shardCost: 40,
    pricePercent: 0,
    requiresPartId: 'brass-rails',
    sortOrder: 4,
    effect: { kind: 'board-rows', rows: 10 },
  },
  'steady-hand': {
    id: 'steady-hand',
    kind: 'modifier',
    name: 'Leaden shot',
    description: 'Heavier balls that fall straighter. Fewer big wins, fewer big losses.',
    essenceCost: 300,
    shardCost: 6,
    pricePercent: 0,
    requiresPartId: null,
    sortOrder: 10,
    effect: { kind: 'gravity', percent: 160 },
  },
  'rift-magnet': {
    id: 'rift-magnet',
    kind: 'modifier',
    name: 'Rift magnet',
    description: 'Pulls every ball outward on every bounce. The outer pockets come closer, and each ball costs a third more.',
    essenceCost: 900,
    shardCost: 18,
    pricePercent: 35,
    requiresPartId: null,
    sortOrder: 11,
    effect: { kind: 'scatter', strengthBasisPoints: 600 },
  },
  splitter: {
    id: 'splitter',
    kind: 'modifier',
    name: 'Splitter',
    description: 'One ball in four becomes two at the third row. Each ball costs three tenths more.',
    essenceCost: 1200,
    shardCost: 20,
    pricePercent: 30,
    requiresPartId: 'brass-rails',
    sortOrder: 12,
    effect: { kind: 'split', chanceBasisPoints: 2500, row: 3 },
  },
  'lucky-lining': {
    id: 'lucky-lining',
    kind: 'modifier',
    name: 'Lucky lining',
    description: 'Every box that falls is half again as likely to be uncommon or better. Each ball costs a tenth more.',
    essenceCost: 700,
    shardCost: 14,
    pricePercent: 10,
    requiresPartId: 'jackpot-pocket',
    sortOrder: 13,
    effect: { kind: 'rarity-shift', percent: 150 },
  },
}

export const ALL_DIVINE_GAMBA_PART_DEFINITIONS: readonly DivineGambaPartDefinition[] =
  Object.values(DIVINE_GAMBA_PART_DEFINITIONS).sort((left, right) => left.sortOrder - right.sortOrder)

export function getDivineGambaPartDefinition(id: string): DivineGambaPartDefinition | undefined {
  return DIVINE_GAMBA_PART_DEFINITIONS[id]
}

export function isDivineGambaPartId(id: string): boolean {
  return Object.hasOwn(DIVINE_GAMBA_PART_DEFINITIONS, id)
}

/** The machine the simulation runs, plus the stakes the installed parts allow. */
export interface DivineGambaResolvedMachine extends DivineGambaMachineConfig {
  allowedStakes: number[]
}

/**
 * Folds the installed parts and the enabled modifiers into one machine.
 *
 * The SQL twin is `divine_gamba_resolve_machine`. Parts are applied in sort
 * order, then modifiers in sort order; a modifier that is not owned, or an
 * id that is not a definition, is ignored here and refused by the server.
 * The pocket table is the one for the final row count; an inner box chance
 * rewrites the pocket just inside each jackpot after that, and a rarity
 * shift scales every weight above common.
 */
export function resolveDivineGambaMachine(
  ownedPartIds: readonly string[],
  enabledModifierIds: readonly string[],
): DivineGambaResolvedMachine {
  const owned = new Set(ownedPartIds)
  const enabled = new Set(enabledModifierIds)
  const applied = ALL_DIVINE_GAMBA_PART_DEFINITIONS.filter((definition) =>
    owned.has(definition.id) && (definition.kind === 'part' || enabled.has(definition.id)),
  )
  let rows = DIVINE_GAMBA_BASE_ROWS
  let multiplierScalePercent = 100
  const boxChanceScalePercent = 100
  let innerBoxBasisPoints: number | null = null
  let rarityShiftPercent = 100
  let pricePercent = 100
  const allowedStakes = [1]
  const effects: DivineGambaEffect[] = []
  for (const definition of applied) {
    pricePercent += definition.pricePercent
    const effect = definition.effect
    switch (effect.kind) {
      case 'multiplier-scale':
        multiplierScalePercent = Math.floor(multiplierScalePercent * effect.percent / 100)
        break
      case 'box-chance-inner':
        innerBoxBasisPoints = effect.basisPoints
        break
      case 'rarity-shift':
        rarityShiftPercent = Math.floor(rarityShiftPercent * effect.percent / 100)
        break
      case 'stake-tier':
        if (!allowedStakes.includes(effect.stake)) {
          allowedStakes.push(effect.stake)
        }
        break
      case 'board-rows':
        rows = effect.rows
        break
      default:
        effects.push(effect)
    }
  }
  const table = DIVINE_GAMBA_POCKET_TABLES[rows] ?? DIVINE_GAMBA_POCKET_TABLES[DIVINE_GAMBA_BASE_ROWS] ?? []
  const pockets = table.map((pocket, index) => ({
    multiplierPercent: pocket.multiplierPercent,
    boxChanceBasisPoints: innerBoxBasisPoints !== null && (index === 1 || index === table.length - 2)
      ? innerBoxBasisPoints
      : pocket.boxChanceBasisPoints,
  }))
  const boxRarityWeights = Object.fromEntries(
    Object.entries(DIVINE_GAMBA_BOX_RARITY_WEIGHTS).map(([rarity, weight]) =>
      [rarity, rarity === 'common' ? weight : Math.floor(weight * rarityShiftPercent / 100)]),
  )
  allowedStakes.sort((left, right) => left - right)
  return {
    rows,
    pockets,
    multiplierScalePercent,
    boxChanceScalePercent,
    boxRarityWeights,
    pricePercent,
    effects,
    allowedStakes,
  }
}

/** The Essence the pockets pay against: the base price times the stake. */
export function getDivineGambaStakePrice(stake: number): number {
  return DIVINE_GAMBA_BASE_BALL_PRICE * stake
}

/**
 * What a ball costs: the stake price plus the enabled modifiers' surcharge.
 *
 * The pockets still pay against the stake price, so the surcharge is pure
 * house edge, which is what lets a modifier raise the expected return of the
 * physics without raising the return to the player.
 */
export function getDivineGambaBallPrice(machine: { pricePercent: number }, stake: number): number {
  return Math.floor(getDivineGambaStakePrice(stake) * machine.pricePercent / 100)
}

export const DIVINE_GAMBA_MAX_BALLS = 20
