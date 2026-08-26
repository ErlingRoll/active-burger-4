import { useEffect, useRef, useState } from 'react'
import {
  getItemDefinition,
  type EquipmentSlot,
} from '../content/gear/Items'
import {
  formatGearModifier,
  getGearModifierDefinition,
  sortGearModifiers,
} from '../content/gear/ModifierPools'
import {
  RARITY_VISUALS,
  type Rarity,
} from '../content/rarity/Rarity'
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

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  helmet: 'Helmet',
  armor: 'Armor',
  boots: 'Boots',
  ring: 'Ring',
  amulet: 'Amulet',
}

function formatModifier(modifier: GearModifierSnapshot): string {
  return formatGearModifier(modifier)
}

function formatDeltaModifier(modifier: GearModifierSnapshot): string {
  return formatGearModifier(modifier, {
    includeTier: false,
  })
}

function getModifierDeltas(
  offered: readonly GearModifierSnapshot[],
  equipped: readonly GearModifierSnapshot[],
): GearModifierSnapshot[] {
  const equippedById = new Map(
    equipped.map((modifier) => [modifier.id, modifier] as const),
  )
  const offeredById = new Map(
    offered.map((modifier) => [modifier.id, modifier] as const),
  )
  return sortGearModifiers(
    [...new Set([
      ...offered.map((modifier) => modifier.id),
      ...equipped.map((modifier) => modifier.id),
    ])].flatMap((modifierId) => {
      const offeredModifier = offeredById.get(modifierId)
      const equippedModifier = equippedById.get(modifierId)
      const value = (offeredModifier?.value ?? 0) - (equippedModifier?.value ?? 0)
      if (Math.abs(value) <= 0.0001) {
        return []
      }
      return [{
        id: modifierId,
        tier: offeredModifier?.tier ?? equippedModifier?.tier ?? 5,
        value,
        sourceId: 'comparison',
      }]
    }),
  )
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
            modifier.value < 0
              ? 'modifier-lost'
              : undefined
          }
          key={`${modifier.id}-${modifier.sourceId}-${index}`}
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
  offeredName,
  offeredSlot,
  offeredModifiers,
  equipped,
}: {
  id: string
  offeredName: string
  offeredSlot: EquipmentSlot
  offeredModifiers: readonly GearModifierSnapshot[]
  equipped: EquippedItemSnapshot | undefined
}) {
  const deltas = getModifierDeltas(
    offeredModifiers,
    equipped?.modifiers ?? [],
  )
  const emptySlot = !equipped

  return (
    <div id={id} className="gear-comparison" role="tooltip">
      <strong>Full comparison</strong>
      <div className="comparison-columns">
        <section>
          <span className="comparison-heading">Offered</span>
          <strong>{offeredName}</strong>
          <ModifierList modifiers={offeredModifiers} />
        </section>
        <section>
          <span className="comparison-heading">Equipped in {SLOT_LABELS[offeredSlot]}</span>
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
    const gains = getModifierDeltas(
      choice.upgradedModifiers,
      currentModifiers,
    )
    const currentModifier = currentModifiers.find(
      (modifier) => modifier.id === choice.upgradedModifierId,
    )
    const upgradedModifier = choice.upgradedModifiers.find(
      (modifier) => modifier.id === choice.upgradedModifierId,
    )
    return (
      <div className="choice-card-wrap">
        <button
          ref={index === 0 ? firstButtonRef : undefined}
          className={`upgrade-choice choice-card gear-upgrade-card ${rarityClass(choice.rarity)}`}
          data-choice-type="gear-upgrade"
          type="button"
          onClick={() => onSelect(choice)}
        >
          <span className="gear-upgrade-type">
            <span className="gear-upgrade-icon" aria-hidden="true">↗</span>
            UPGRADE EQUIPPED ITEM
          </span>
          <span className="choice-card-header">
            <span className="upgrade-choice-name">Upgrade: {item.name}</span>
            <RarityBadge rarity={choice.rarity} label="Item rarity" />
          </span>
          <span className="gear-slot">{SLOT_LABELS[choice.slot]} · {item.name}</span>
          <span className="gear-rarity-transition">
            {currentModifier && upgradedModifier
              ? `${formatGearModifier(currentModifier)} → ${formatGearModifier(upgradedModifier)}`
              : `Improves one ${getGearModifierDefinition(choice.upgradedModifierId).label.toLowerCase()} roll by one tier.`}
          </span>
          <span className="gear-net-heading">Upgrade gains</span>
          <ModifierList modifiers={gains} emptyLabel="No stat change" delta />
          <span className="upgrade-choice-description">
            Select to upgrade equipped item.
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
            <ModifierList modifiers={choice.modifiers} />
            <span className="gear-net-heading">Net change</span>
            <ModifierList
              modifiers={getModifierDeltas(choice.modifiers, equipped.modifiers)}
              emptyLabel="No stat change"
              delta
            />
          </>
        ) : (
          <>
            <span className="gear-net-heading">Gains</span>
            <ModifierList
              modifiers={choice.modifiers}
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
          offeredName={item.name}
          offeredSlot={choice.slot}
          offeredModifiers={choice.modifiers}
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
    <>
      <div className="level-up-overlay" aria-hidden="true" />
    <section
      ref={dialogRef}
      className={`level-up-dialog ${isGearFlow ? 'gear-pickup-overlay' : ''}`}
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
    </>
  )
}
