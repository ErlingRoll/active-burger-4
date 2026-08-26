import { useEffect, useRef, useState } from 'react'
import {
  getItemDefinition,
  type EquipmentSlot,
  type ItemDefinition,
} from '../content/gear/Items'
import {
} from '../game/equipment/EquipmentState'
import {
  RARITY_VISUALS,
  type Rarity,
} from '../content/rarity/Rarity'
import type { StatKey } from '../content/stats/Stats'
import {
  getUpgradeDefinition,
  type UpgradeChoice,
} from '../content/upgrades/Upgrades'
import type { GearChoice } from '../game/equipment/GearChoices'
import type {
  EquippedItemSnapshot,
  GearModifierSnapshot,
  GameUiSnapshot,
} from '../game/ui/Snapshots'
import type { PendingChoiceFlow } from '../game/choices/ChoiceFlows'

interface LevelUpOverlayProps {
  flow: Readonly<PendingChoiceFlow>
  equipment: GameUiSnapshot['equipment']
  onSelect: (choice: UpgradeChoice | GearChoice) => void
}

const STAT_LABELS: Record<StatKey, string> = {
  maxHp: 'Max HP',
  movementSpeed: 'Movement speed',
  attackDamage: 'Attack damage',
  attackSpeed: 'Attack speed',
  attackRange: 'Attack range',
}

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  helmet: 'Helmet',
  armor: 'Armor',
  boots: 'Boots',
  ring: 'Ring',
  amulet: 'Amulet',
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString()
  }
  return value.toFixed(1)
}

function formatModifierValue(modifier: Pick<GearModifierSnapshot, 'operation' | 'value'>): string {
  if (modifier.operation === 'multiply') {
    return `${formatNumber((modifier.value - 1) * 100)}%`
  }
  return formatNumber(modifier.value)
}

function formatModifier(modifier: GearModifierSnapshot): string {
  return `+${formatModifierValue(modifier)} ${STAT_LABELS[modifier.stat]}`
}

function formatDeltaModifier(modifier: GearModifierSnapshot): string {
  const negative =
    modifier.operation === 'multiply' ? modifier.value < 1 : modifier.value < 0
  const magnitude =
    modifier.operation === 'multiply'
      ? Math.abs((modifier.value - 1) * 100)
      : Math.abs(modifier.value)
  return `${negative ? '-' : '+'}${formatNumber(magnitude)}${
    modifier.operation === 'multiply' ? '%' : ''
  } ${STAT_LABELS[modifier.stat]}`
}

function getModifierTotal(
  modifiers: readonly GearModifierSnapshot[],
  stat: StatKey,
  operation: GearModifierSnapshot['operation'],
): number {
  if (operation === 'add') {
    return modifiers
      .filter((modifier) => modifier.stat === stat && modifier.operation === operation)
      .reduce((total, modifier) => total + modifier.value, 0)
  }

  return modifiers
    .filter((modifier) => modifier.stat === stat && modifier.operation === operation)
    .reduce((total, modifier) => total * modifier.value, 1)
}

interface StatDelta {
  stat: StatKey
  operation: GearModifierSnapshot['operation']
  value: number
}

function getStatDeltas(
  offered: readonly GearModifierSnapshot[],
  equipped: readonly GearModifierSnapshot[],
): StatDelta[] {
  const deltas: StatDelta[] = []
  const operations: readonly GearModifierSnapshot['operation'][] = ['add', 'multiply']
  const stats: readonly StatKey[] = [
    'maxHp',
    'movementSpeed',
    'attackDamage',
    'attackSpeed',
    'attackRange',
  ]

  for (const stat of stats) {
    for (const operation of operations) {
      const hasOffered = offered.some(
        (modifier) => modifier.stat === stat && modifier.operation === operation,
      )
      const hasEquipped = equipped.some(
        (modifier) => modifier.stat === stat && modifier.operation === operation,
      )
      if (!hasOffered && !hasEquipped) {
        continue
      }

      const offeredTotal = getModifierTotal(offered, stat, operation)
      const equippedTotal = getModifierTotal(equipped, stat, operation)
      const value = offeredTotal - equippedTotal
      if (Math.abs(value) > 0.0001) {
        deltas.push({ stat, operation, value })
      }
    }
  }
  return deltas
}

function modifierFromDelta(delta: StatDelta): GearModifierSnapshot {
  return {
    stat: delta.stat,
    operation: delta.operation,
    value: delta.operation === 'multiply' ? 1 + delta.value : delta.value,
    sourceId: 'comparison',
  }
}

function ModifierList({
  modifiers,
  emptyLabel = 'No modifiers',
  delta = false,
}: {
  modifiers: readonly GearModifierSnapshot[]
  emptyLabel?: string
  delta?: boolean
}) {
  if (modifiers.length === 0) {
    return <span className="modifier-empty">{emptyLabel}</span>
  }
  return (
    <ul className={`modifier-list${delta ? ' modifier-delta' : ''}`}>
      {modifiers.map((modifier, index) => (
        <li
          className={
            delta &&
            (modifier.operation === 'multiply'
              ? modifier.value < 1
              : modifier.value < 0)
              ? 'modifier-lost'
              : undefined
          }
          key={`${modifier.stat}-${modifier.operation}-${modifier.sourceId}-${index}`}
        >
          {delta ? formatDeltaModifier(modifier) : formatModifier(modifier)}
        </li>
      ))}
    </ul>
  )
}

function rarityClass(rarity: Rarity): string {
  return `rarity-${rarity}`
}

function RarityBadge({ rarity, label = 'Rarity' }: { rarity: Rarity; label?: string }) {
  const visual = RARITY_VISUALS[rarity]
  return (
    <span
      className={`rarity-badge ${rarityClass(rarity)}`}
      data-rarity={rarity}
      aria-label={`${label}: ${visual.label}`}
    >
      <span aria-hidden="true">{visual.icon}</span> {visual.label}
    </span>
  )
}

function GearComparison({
  id,
  offered,
  equipped,
}: {
  id: string
  offered: ItemDefinition
  equipped: EquippedItemSnapshot | undefined
}) {
  const deltas = getStatDeltas(
    offered.modifiers,
    equipped?.modifiers ?? [],
  ).map(modifierFromDelta)
  const emptySlot = !equipped

  return (
    <div id={id} className="gear-comparison" role="tooltip">
      <strong>Full comparison</strong>
      <div className="comparison-columns">
        <section>
          <span className="comparison-heading">Offered</span>
          <strong>{offered.name}</strong>
          <ModifierList modifiers={offered.modifiers} />
        </section>
        <section>
          <span className="comparison-heading">Equipped in {SLOT_LABELS[offered.slot]}</span>
          <strong>{equipped?.name ?? 'Empty slot'}</strong>
          <ModifierList modifiers={equipped?.modifiers ?? []} />
        </section>
      </div>
      <section className="comparison-net">
        <span className="comparison-heading">
          {emptySlot ? 'Gain' : 'Net change'}
        </span>
        <ModifierList
          modifiers={deltas}
          emptyLabel="No stat change"
          delta
        />
      </section>
    </div>
  )
}

function GearCard({
  choice,
  index,
  equipped,
  onSelect,
  active,
  setActive,
  firstButtonRef,
}: {
  choice: GearChoice
  index: number
  equipped: EquippedItemSnapshot | undefined
  onSelect: (choice: GearChoice) => void
  active: boolean
  setActive: (id: string | null) => void
  firstButtonRef: (element: HTMLButtonElement | null) => void
}) {
  const item = getItemDefinition(choice.itemId)
  const comparisonId = `gear-comparison-${choice.itemId}-${index}`

  if (choice.type === 'upgrade-equipped-item') {
    const currentModifiers = equipped?.modifiers ?? item.modifiers
    const gains = getStatDeltas(
      choice.upgradedModifiers,
      currentModifiers,
    ).map(modifierFromDelta)
    return (
      <div className="choice-card-wrap">
        <button
          ref={index === 0 ? firstButtonRef : undefined}
          className={`upgrade-choice choice-card ${rarityClass(choice.rarity)}`}
          data-choice-type="gear-upgrade"
          type="button"
          onClick={() => onSelect(choice)}
        >
          <span className="choice-card-header">
            <span className="upgrade-choice-name">{item.name}</span>
            <RarityBadge rarity={choice.rarity} label="Choice rarity" />
          </span>
          <span className="gear-slot">{SLOT_LABELS[choice.slot]} · Upgrade equipped item</span>
          <span className="gear-rarity-transition">
            <span>
              Current rarity: <RarityBadge rarity={choice.fromRarity} label="Current rarity" />
            </span>
            <span aria-hidden="true">→</span>
            <span>
              Upgraded rarity: <RarityBadge rarity={choice.upgradedRarity} label="Upgraded rarity" />
            </span>
          </span>
          <span className="gear-upgrade-improvement">
            This offer's improvement is already determined.
          </span>
          <span className="gear-stats-heading">Current stats</span>
          <ModifierList modifiers={currentModifiers} />
          <span className="gear-net-heading">Upgrade gains</span>
          <ModifierList modifiers={gains} emptyLabel="No stat change" delta />
          <span className="upgrade-choice-description">
            Select to equip the upgrade immediately.
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="choice-card-wrap">
      <button
        ref={index === 0 ? firstButtonRef : undefined}
        className={`upgrade-choice choice-card ${rarityClass(choice.rarity)}`}
        data-choice-type="gear"
        type="button"
        aria-describedby={active ? comparisonId : undefined}
        onClick={() => onSelect(choice)}
        onFocus={() => setActive(comparisonId)}
        onBlur={() => setActive(null)}
        onMouseEnter={() => setActive(comparisonId)}
        onMouseLeave={() => setActive(null)}
      >
        <span className="choice-card-header">
          <span className="upgrade-choice-name">{item.name}</span>
          <RarityBadge rarity={choice.rarity} />
        </span>
        <span className="gear-slot">{SLOT_LABELS[choice.slot]}</span>
        <span className="gear-equipped-summary">
          Current: {equipped?.name ?? 'Empty slot'}
        </span>
        {equipped ? (
          <>
            <span className="gear-stats-heading">Item modifiers</span>
            <ModifierList modifiers={item.modifiers} />
            <span className="gear-net-heading">Net change</span>
            <ModifierList
              modifiers={getStatDeltas(item.modifiers, equipped.modifiers).map(modifierFromDelta)}
              emptyLabel="No stat change"
              delta
            />
          </>
        ) : (
          <>
            <span className="gear-net-heading">Gains</span>
            <ModifierList
              modifiers={item.modifiers}
              emptyLabel="No modifiers"
              delta
            />
          </>
        )}
        <span className="upgrade-choice-description">
          Select to equip immediately.
        </span>
      </button>
      {active ? (
        <GearComparison
          id={comparisonId}
          offered={item}
          equipped={equipped}
        />
      ) : null}
    </div>
  )
}

function UpgradeCard({
  choice,
  index,
  firstButtonRef,
  onSelect,
}: {
  choice: UpgradeChoice
  index: number
  firstButtonRef: (element: HTMLButtonElement | null) => void
  onSelect: (choice: UpgradeChoice) => void
}) {
  const definition = getUpgradeDefinition(choice.upgradeId)
  return (
    <div className="choice-card-wrap">
      <button
        ref={index === 0 ? firstButtonRef : undefined}
        className={`upgrade-choice choice-card ${rarityClass(choice.rarity)}`}
        data-choice-type="upgrade"
        type="button"
        onClick={() => onSelect(choice)}
      >
        <span className="choice-card-header">
          <span className="upgrade-choice-name">{definition.name}</span>
          <RarityBadge rarity={choice.rarity} />
        </span>
        <span className="upgrade-choice-value">{definition.valueLabel}</span>
        <span className="upgrade-choice-description">{definition.description}</span>
      </button>
    </div>
  )
}

export function LevelUpOverlay({
  flow,
  equipment,
  onSelect,
}: LevelUpOverlayProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const firstButtonRef = useRef<HTMLButtonElement>(null)
  const [activeComparison, setActiveComparison] = useState<string | null>(null)
  const isGearFlow = flow.type === 'gear-pickup'

  useEffect(() => {
    if (isGearFlow) {
      dialogRef.current?.focus()
    } else {
      firstButtonRef.current?.focus()
    }
  }, [flow, isGearFlow])

  return (
    <section
      ref={dialogRef}
      className={`level-up-overlay ${isGearFlow ? 'gear-pickup-overlay' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="choice-dialog-title"
      tabIndex={-1}
    >
      <div className="level-up-panel">
        <p className="level-up-kicker">
          {isGearFlow ? 'Gear found' : 'Upgrade available'}
        </p>
        <h2 id="choice-dialog-title">
          {isGearFlow ? 'Choose your gear' : `Level ${flow.level}`}
        </h2>
        <p className="level-up-instructions">
          {isGearFlow
            ? 'Choose one item. It equips immediately and replaces gear in the same slot.'
            : 'Choose one upgrade to continue the run.'}
        </p>
        <div className="upgrade-choice-list">
          {flow.type === 'level-up'
            ? flow.choices.map((choice, index) => (
                <UpgradeCard
                  key={choice.upgradeId}
                  choice={choice}
                  index={index}
                  firstButtonRef={(element) => {
                    if (index === 0) {
                      firstButtonRef.current = element
                    }
                  }}
                  onSelect={(selected) => onSelect(selected)}
                />
              ))
            : flow.choices.map((choice, index) => (
                <GearCard
                  key={`${choice.type}-${choice.itemId}-${choice.slot}-${index}`}
                  choice={choice}
                  index={index}
                  equipped={equipment[choice.slot]}
                  onSelect={(selected) => onSelect(selected)}
                  active={activeComparison === `gear-comparison-${choice.itemId}-${index}`}
                  setActive={setActiveComparison}
                  firstButtonRef={(element) => {
                    if (index === 0) {
                      firstButtonRef.current = element
                    }
                  }}
                />
              ))}
        </div>
      </div>
    </section>
  )
}
