import { useEffect, useRef, useState } from 'react'
import {
  EquipmentSlot,
  getItemDisplayName,
  getItemDefinition,
  type ItemImplicitModifier,
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
  getSynergyPartnerSkillIds,
  REMOVE_SKILL_UPGRADE_ID,
  REMOVE_SYNERGY_UPGRADE_ID,
  type LevelUpUpgradeChoice,
} from '../content/upgrades/Upgrades'
import {
  getSkillDefinition,
  type SkillId,
} from '../content/skills/Skills'
import {
  normalizeGearSetId,
  type GearSetId,
} from '../game-config/gear-sets'
import type { GearChoice } from '../game/equipment/GearChoices'
import type {
  EquippedItemSnapshot,
  GearSetHudSnapshot,
  GearModifierSnapshot,
  GameUiSnapshot,
} from '../game/ui/Snapshots'
import type { PendingChoiceFlow } from '../game/choices/ChoiceFlows'
import { GearSetFormation } from './GearSetFormation'
import { tooltipClassName } from './TooltipShell'
import { ImplicitModifierList } from './ImplicitModifierList'
import {
  formatKeybind,
  type GameKeybinds,
} from '../input/Keybinds'
import { KeywordText } from './KeywordTooltip'
import {
  getPlaystyleDefinition,
  type PlaystyleId,
} from '../content/playstyles/Playstyles'

interface LevelUpOverlayProps {
  flow: Readonly<PendingChoiceFlow>
  equipment: GameUiSnapshot['equipment']
  gearSets: GameUiSnapshot['gearSets']
  keybinds: GameKeybinds
  playstyleId: PlaystyleId
  ownedSkillIds: readonly SkillId[]
  onSelect: (choice: LevelUpUpgradeChoice | GearChoice) => void
  onSkip: () => void
}

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  [EquipmentSlot.Weapon]: 'Weapon',
  [EquipmentSlot.Helmet]: 'Helmet',
  [EquipmentSlot.Armor]: 'Armor',
  [EquipmentSlot.Boots]: 'Boots',
  [EquipmentSlot.Ring]: 'Ring',
  [EquipmentSlot.Amulet]: 'Amulet',
}

function formatModifier(modifier: GearModifierSnapshot): string {
  return formatGearModifier(modifier)
}

function formatDeltaModifier(modifier: GearModifierSnapshot): string {
  return formatGearModifier(modifier, {
    includeTier: false,
  })
}

function getProjectedGearSet(
  gearSets: GameUiSnapshot['gearSets'],
  itemSetId: GearSetId | undefined,
  equipped: EquippedItemSnapshot | undefined,
): { set: GearSetHudSnapshot; equippedPieces: number } | undefined {
  if (!itemSetId) {
    return undefined
  }
  const set = gearSets.find((candidate) => candidate.setId === itemSetId)
  if (!set) {
    return undefined
  }
  const equippedSetId = normalizeGearSetId(equipped?.setId)
  const equippedPieces = set.equippedPieces +
    (equippedSetId === itemSetId ? 0 : 1) -
    (equippedSetId && equippedSetId !== itemSetId ? 1 : 0)
  return { set, equippedPieces }
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
          <KeywordText
            text={delta ? formatDeltaModifier(modifier) : formatModifier(modifier)}
          />
        </li>
      ))}
    </ul>
  )
}

function rarityClass(rarity: Rarity): string {
  return `rarity-${rarity}`
}

function ChoiceKeyHint({ keybind }: { keybind: string | undefined }) {
  return keybind ? (
    <span className="choice-keybind-hint" aria-hidden="true">
      {formatKeybind(keybind)}
    </span>
  ) : null
}

function RarityBadge({
  rarity,
  label = 'Rarity',
  synergy = false,
}: {
  rarity: Rarity
  label?: string
  synergy?: boolean
}) {
  const visual = RARITY_VISUALS[rarity]
  return (
    <span
      className={`rarity-badge ${rarityClass(rarity)}${synergy ? ' synergy-rarity-badge' : ''}`}
      data-rarity={rarity}
      aria-label={`${label}: ${synergy ? 'Synergy, ' : ''}${visual.label}`}
    >
      <span aria-hidden="true">{visual.icon}</span> {visual.label}
    </span>
  )
}

function GearComparison({
  id,
  offeredName,
  offeredSlot,
  offeredImplicitModifiers,
  offeredModifiers,
  equipped,
  setFormation,
}: {
  id: string
  offeredName: string
  offeredSlot: EquipmentSlot
  offeredImplicitModifiers: readonly ItemImplicitModifier[]
  offeredModifiers: readonly GearModifierSnapshot[]
  equipped: EquippedItemSnapshot | undefined
  setFormation: { set: GearSetHudSnapshot; equippedPieces: number } | undefined
}) {
  const deltas = getModifierDeltas(
    offeredModifiers,
    equipped?.modifiers ?? [],
  )
  const emptySlot = !equipped

  return (
    <div id={id} className={tooltipClassName('gear-comparison')} role="tooltip">
      <strong>Full comparison</strong>
      <div className="comparison-columns">
        <section>
          <span className="comparison-heading">Offered</span>
          <strong>{offeredName}</strong>
          <ImplicitModifierList modifiers={offeredImplicitModifiers} />
          <ModifierList modifiers={offeredModifiers} />
        </section>
        <section>
          <span className="comparison-heading">Equipped in {SLOT_LABELS[offeredSlot]}</span>
          <strong>{equipped?.name ?? 'Empty slot'}</strong>
          <ImplicitModifierList modifiers={equipped?.implicitModifiers ?? []} />
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
      {setFormation ? (
        <GearSetFormation
          set={setFormation.set}
          equippedPieces={setFormation.equippedPieces}
        />
      ) : null}
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
  gearSets,
  keybind,
}: {
  choice: GearChoice
  index: number
  equipped: EquippedItemSnapshot | undefined
  onSelect: (choice: GearChoice) => void
  active: boolean
  setActive: (id: string | null) => void
  firstButtonRef: (element: HTMLButtonElement | null) => void
  gearSets: GameUiSnapshot['gearSets']
  keybind: string | undefined
}) {
  if (choice.type === 'gear-xp-blessing') {
    return (
      <div className="choice-card-wrap">
        <button
          ref={index === 0 ? firstButtonRef : undefined}
          className="upgrade-choice choice-card gear-xp-blessing-card"
          data-choice-type="gear-xp-blessing"
          type="button"
          aria-keyshortcuts={keybind}
          onClick={() => onSelect(choice)}
        >
          <ChoiceKeyHint keybind={keybind} />
          <span className="choice-card-header">
            <span className="upgrade-choice-name">Gear Salvage</span>
            <span className="gear-xp-blessing-badge">BLESSING</span>
          </span>
          <span className="upgrade-choice-value">
            All future gear drops become 10x XP
          </span>
          <span className="upgrade-choice-description">
            Convert late-game gear drops into experience for the rest of this dungeon.
          </span>
        </button>
      </div>
    )
  }

  if (choice.type === 'gear-rarity-floor') {
    const minimumRarity = RARITY_VISUALS[choice.minimumRarity]
    return (
      <div className="choice-card-wrap">
        <button
          ref={index === 0 ? firstButtonRef : undefined}
          className="upgrade-choice choice-card gear-rarity-floor-card"
          data-choice-type="gear-rarity-floor"
          type="button"
          aria-keyshortcuts={keybind}
          onClick={() => onSelect(choice)}
        >
          <ChoiceKeyHint keybind={keybind} />
          <span className="choice-card-header">
            <span className="upgrade-choice-name">Gear Fortune</span>
            <span className="gear-rarity-floor-badge">GOLDEN</span>
          </span>
          <span className="upgrade-choice-value">
            All gear dropped is at least {minimumRarity.label}
          </span>
          <span className="upgrade-choice-description">
            Raise the minimum rarity of all future gear drops.
          </span>
        </button>
      </div>
    )
  }

  const item = getItemDefinition(choice.itemId)
  const comparisonId = `gear-comparison-${choice.itemId}-${index}`
  const itemSetId = choice.setId ?? item.setId
  const itemName = getItemDisplayName(item, itemSetId)
  const setFormation = getProjectedGearSet(gearSets, itemSetId, equipped)

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
          aria-keyshortcuts={keybind}
          aria-describedby={active ? comparisonId : undefined}
          onClick={() => onSelect(choice)}
          onFocus={() => setActive(comparisonId)}
          onBlur={() => setActive(null)}
          onMouseEnter={() => setActive(comparisonId)}
          onMouseLeave={() => setActive(null)}
        >
          <ChoiceKeyHint keybind={keybind} />
          <span className="gear-upgrade-type">
            <span className="gear-upgrade-icon" aria-hidden="true">↗</span>
            UPGRADE EQUIPPED ITEM
          </span>
          <span className="choice-card-header">
            <span className="upgrade-choice-name">Upgrade: {itemName}</span>
            <RarityBadge rarity={choice.rarity} label="Item rarity" />
          </span>
          <span className="gear-slot">{SLOT_LABELS[choice.slot]} · {itemName}</span>
          <ImplicitModifierList modifiers={item.implicitModifiers ?? []} />
          <span className="gear-rarity-transition">
            <KeywordText
              text={currentModifier && upgradedModifier
                ? `${formatGearModifier(currentModifier)} → ${formatGearModifier(upgradedModifier)}`
                : `Improves one ${getGearModifierDefinition(choice.upgradedModifierId).label.toLowerCase()} roll by one tier.`}
            />
          </span>
          <span className="gear-net-heading">Upgrade gains</span>
          <ModifierList modifiers={gains} emptyLabel="No stat change" delta />
          <span className="upgrade-choice-description">
            Select to upgrade equipped item.
          </span>
        </button>
        {active ? (
          <GearComparison
            id={comparisonId}
            offeredName={itemName}
            offeredSlot={choice.slot}
            offeredImplicitModifiers={item.implicitModifiers ?? []}
            offeredModifiers={choice.upgradedModifiers}
            equipped={equipped}
            setFormation={setFormation}
          />
        ) : null}
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
        aria-keyshortcuts={keybind}
        aria-describedby={active ? comparisonId : undefined}
        onClick={() => onSelect(choice)}
        onFocus={() => setActive(comparisonId)}
        onBlur={() => setActive(null)}
        onMouseEnter={() => setActive(comparisonId)}
        onMouseLeave={() => setActive(null)}
      >
        <ChoiceKeyHint keybind={keybind} />
        <span className="choice-card-header">
          <span className="upgrade-choice-name">{itemName}</span>
          <RarityBadge rarity={choice.rarity} />
        </span>
        <span className="gear-slot">{SLOT_LABELS[choice.slot]}</span>
        <span className="gear-equipped-summary">
          Current: {equipped?.name ?? 'Empty slot'}
        </span>
        <ImplicitModifierList modifiers={item.implicitModifiers ?? []} />
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
          offeredName={itemName}
          offeredSlot={choice.slot}
          offeredImplicitModifiers={item.implicitModifiers ?? []}
          offeredModifiers={choice.modifiers}
          equipped={equipped}
          setFormation={setFormation}
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
  keybind,
  ownedSkillIds,
}: {
  choice: LevelUpUpgradeChoice
  index: number
  firstButtonRef: (element: HTMLButtonElement | null) => void
  onSelect: (choice: LevelUpUpgradeChoice) => void
  keybind: string | undefined
  ownedSkillIds: readonly SkillId[]
}) {
  const definition = getUpgradeDefinition(choice.upgradeId)
  const removedSkill = choice.upgradeId === REMOVE_SKILL_UPGRADE_ID
    ? getSkillDefinition(choice.skillId)
    : undefined
  const removedSynergy = choice.upgradeId === REMOVE_SYNERGY_UPGRADE_ID
    ? getUpgradeDefinition(choice.synergyId)
    : undefined
  const unlockedSkill = definition.skillAction === 'unlock' && definition.skillId
    ? getSkillDefinition(definition.skillId)
    : undefined
  const synergyPartnerSkills = unlockedSkill
    ? getSynergyPartnerSkillIds(unlockedSkill.id, ownedSkillIds)
      .map((skillId) => getSkillDefinition(skillId))
    : []
  const evolvedSkill = definition.branch && definition.skillId
    ? getSkillDefinition(definition.skillId)
    : undefined
  const synergySkillIds = definition.synergySkillIds ??
    removedSynergy?.synergySkillIds
  const synergySkills = synergySkillIds?.map((skillId) =>
    getSkillDefinition(skillId)
  )
  const isSynergy = synergySkillIds !== undefined
  const isRelease = removedSkill !== undefined || removedSynergy !== undefined
  const actionLabel = removedSkill
    ? 'Release'
    : removedSynergy
      ? 'Release synergy:'
      : isSynergy
        ? 'Synergy:'
        : definition.branch
          ? 'Evolve:'
          : definition.skillAction === 'unlock'
            ? 'Unlock skill'
            : 'Upgrade'
  const actionLabelClass = `upgrade-action-label-${
    isRelease
      ? 'release'
      : isSynergy
        ? 'synergy'
        : definition.branch
          ? 'evolve'
          : definition.skillAction === 'unlock'
            ? 'unlock'
            : 'upgrade'
  }`
  return (
    <div className="choice-card-wrap">
      <button
        ref={index === 0 ? firstButtonRef : undefined}
        className={`upgrade-choice choice-card ${rarityClass(choice.rarity)} ${
          isSynergy ? 'synergy-card' : ''
        } ${
          isRelease ? 'skill-removal-card' : ''
        }`}
        data-choice-type="upgrade"
        type="button"
        aria-keyshortcuts={keybind}
        onClick={() => onSelect(choice)}
      >
        <ChoiceKeyHint keybind={keybind} />
        <span className="choice-card-header">
          <span className="upgrade-choice-name">
            {removedSkill
              ? `Release ${removedSkill.name}`
              : removedSynergy
                ? `Release ${removedSynergy.name}`
                : definition.name}
          </span>
          <span className="choice-card-badges">
            {isSynergy ? (
              <span className="synergy-card-badge">SYNERGY</span>
            ) : null}
            <RarityBadge rarity={choice.rarity} synergy={isSynergy && !isRelease} />
          </span>
        </span>
        <span className={`upgrade-action-label ${actionLabelClass}`}>
          {actionLabel}
          {evolvedSkill ? (
            <span className="upgrade-action-evolved-skill">
              {' '}
              <span aria-hidden="true">{evolvedSkill.visual.icon}</span>{' '}
              {evolvedSkill.name}
            </span>
          ) : null}
        </span>
        {synergySkills ? (
          <span className="upgrade-synergy-pair">
            {synergySkills[0]?.name} + {synergySkills[1]?.name}
          </span>
        ) : null}
        {definition.evolutionTags && definition.evolutionTags.length > 0 ? (
          <span className="upgrade-skill-tags" aria-label="Evolution tags">
            <span className="upgrade-skill-tags-label">Tags</span>
            <span className="skill-tag-list upgrade-skill-tag-list" role="list">
              {definition.evolutionTags.map((tag) => (
                <span className="skill-tag" role="listitem" key={tag}>
                  <KeywordText text={tag} />
                </span>
              ))}
            </span>
          </span>
        ) : null}
        {unlockedSkill ? (
          <span className="upgrade-skill-tags" aria-label="Skill tags">
            <span className="upgrade-skill-tags-label">Tags</span>
            <span className="skill-tag-list upgrade-skill-tag-list" role="list">
              {unlockedSkill.tags.map((tag) => (
                <span className="skill-tag" role="listitem" key={tag}>
                  <KeywordText text={tag} />
                </span>
              ))}
            </span>
          </span>
        ) : null}
        {unlockedSkill && synergyPartnerSkills.length > 0 ? (
          <span className="upgrade-synergy-partners" aria-label="Synergies:">
            <span className="upgrade-skill-tags-label">Synergies:</span>{' '}
            {synergyPartnerSkills.map((skill, skillIndex) => (
              <span key={skill.id}>
                {skillIndex > 0 ? ', ' : ''}
                {skill.name}
              </span>
            ))}
          </span>
        ) : null}
        {!unlockedSkill ? (
          <span className="upgrade-choice-value">
            <KeywordText
              text={
                removedSkill
                  ? 'Lose all upgrades for this skill'
                  : removedSynergy
                    ? 'Free both skill links'
                    : definition.valueLabel
              }
            />
          </span>
        ) : null}
        <span className="upgrade-choice-description">
          <KeywordText
            text={removedSkill
              ? `Remove ${removedSkill.name} from your skill slots. It can be unlocked again later.`
              : removedSynergy
                ? `Remove ${removedSynergy.name} and make both skills eligible for another synergy.`
                : definition.description}
          />
        </span>
      </button>
    </div>
  )
}

export function LevelUpOverlay({
  flow,
  equipment,
  gearSets,
  keybinds,
  playstyleId,
  ownedSkillIds,
  onSelect,
  onSkip,
}: LevelUpOverlayProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const firstButtonRef = useRef<HTMLButtonElement>(null)
  const [activeComparison, setActiveComparison] = useState<string | null>(null)
  const isGearFlow = flow.type === 'gear-pickup'
  const playstyle = getPlaystyleDefinition(playstyleId)

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
        {!isGearFlow ? (
          <p className="skill-affinity-note">
            <strong>{playstyle.name} skill affinity:</strong>{' '}
            {playstyle.skillAffinity.description}
          </p>
        ) : null}
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
                  keybind={[
                    keybinds.choiceLeft,
                    keybinds.choiceMiddle,
                    keybinds.choiceRight,
                  ][index]}
                  ownedSkillIds={ownedSkillIds}
                  onSelect={(selected) => onSelect(selected)}
                />
              ))
            : flow.choices.map((choice, index) => (
                <GearCard
                  key={choice.type === 'gear-rarity-floor' ||
                    choice.type === 'gear-xp-blessing'
                    ? `${choice.type}-${index}`
                    : `${choice.type}-${choice.itemId}-${choice.slot}-${index}`}
                  choice={choice}
                  index={index}
                  equipped={choice.type === 'gear-rarity-floor' ||
                    choice.type === 'gear-xp-blessing'
                    ? undefined
                    : equipment[choice.slot]}
                  onSelect={(selected) => onSelect(selected)}
                  active={choice.type !== 'gear-rarity-floor' &&
                    choice.type !== 'gear-xp-blessing' &&
                    activeComparison === `gear-comparison-${choice.itemId}-${index}`}
                  setActive={setActiveComparison}
                  gearSets={gearSets}
                  keybind={[
                    keybinds.choiceLeft,
                    keybinds.choiceMiddle,
                    keybinds.choiceRight,
                  ][index]}
                  firstButtonRef={(element) => {
                    if (index === 0) {
                      firstButtonRef.current = element
                    }
                  }}
                />
              ))}
        </div>
        <button
          className="skip-choice-button"
          type="button"
          aria-keyshortcuts={keybinds.skipChoice}
          onClick={onSkip}
        >
          Skip
          <ChoiceKeyHint keybind={keybinds.skipChoice} />
        </button>
      </div>
    </section>
    </>
  )
}
