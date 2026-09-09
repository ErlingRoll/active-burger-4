import {
  type GameUiSnapshot,
} from '../../game'
import {
  EQUIPMENT_SLOTS,
} from '../../content/gear/Items'
import {
  formatGearModifier,
} from '../../content/gear/ModifierPools'
import { RARITY_VISUALS } from '../../content/rarity/Rarity'
import { GearSetFormation } from '../GearSetFormation'
import { ImplicitModifierList } from '../ImplicitModifierList'
import { KeywordText } from '../KeywordTooltip'
import {
  closeAllTooltips,
  tooltipClassName,
} from '../TooltipShell'
import type { HudTooltips } from './useHudTooltips'
import { HUD_SLOT_LABELS } from './formatting'

/**
 * The two reference panels the run can be inspected through.
 *
 * Neither is moment-to-moment information: a player consults the loadout and
 * the stat sheet between decisions, not between frames. They used to be pinned
 * to the arena's left edge, where together they covered a quarter of the
 * screen and, on a small viewport, the enemies as well. They now live in the
 * HUD inspector, which is why each is exported as a panel of its own rather
 * than as one block.
 */

export interface LoadoutPanelProps {
  snapshot: GameUiSnapshot
  tooltips: HudTooltips
}

export function LoadoutPanel({ snapshot, tooltips }: LoadoutPanelProps) {
  const {
    activeKey: activeLoadoutSlot,
    setActiveKey: setActiveLoadoutSlot,
    anchorRef: loadoutTooltipAnchorRef,
    tooltipRef: loadoutTooltipRef,
    style: loadoutTooltipStyle,
  } = tooltips.loadout
  const { cancelClose: cancelTooltipClose, scheduleClose: scheduleTooltipClose } = tooltips

  return (
    <section className="equipped-loadout" aria-labelledby="equipped-loadout-title">
      <h3 id="equipped-loadout-title" className="hud-panel-heading">Loadout</h3>
      <ul className="loadout-list">
        {EQUIPMENT_SLOTS.map((slot) => {
          const item = snapshot.equipment[slot]
          const itemSet = item?.setId
            ? snapshot.gearSets.find((set) => set.setId === item.setId)
            : undefined
          const tooltipId = `loadout-tooltip-${slot}`
          const isActive = activeLoadoutSlot === slot
          return (
            <li className="loadout-entry" key={slot}>
              <button
                className={`loadout-item${item ? ` rarity-${item.rarity}` : ''}`}
                data-slot={slot}
                type="button"
                ref={isActive ? loadoutTooltipAnchorRef : undefined}
                aria-label={
                  item
                    ? `${HUD_SLOT_LABELS[slot]}: ${item.name}`
                    : `${HUD_SLOT_LABELS[slot]} slot empty`
                }
                aria-describedby={isActive ? tooltipId : undefined}
                onFocus={() => {
                  cancelTooltipClose()
                  closeAllTooltips()
                  setActiveLoadoutSlot(slot)
                }}
                onBlur={() => scheduleTooltipClose(() => setActiveLoadoutSlot(null))}
                onMouseEnter={() => {
                  cancelTooltipClose()
                  closeAllTooltips()
                  setActiveLoadoutSlot(slot)
                }}
                onMouseLeave={() => scheduleTooltipClose(() => setActiveLoadoutSlot(null))}
              >
                <span className="loadout-slot">{HUD_SLOT_LABELS[slot]}</span>
                {item ? (
                  <>
                    <strong>{item.name}</strong>
                    <span
                      className="loadout-rarity"
                      data-rarity={item.rarity}
                    >
                      {RARITY_VISUALS[item.rarity].icon} {RARITY_VISUALS[item.rarity].label}
                    </span>
                  </>
                ) : (
                  <span className="loadout-empty">Empty</span>
                )}
              </button>
              {isActive ? (
                <div
                  className={tooltipClassName('loadout-tooltip')}
                  id={tooltipId}
                  role="tooltip"
                  ref={isActive ? loadoutTooltipRef : undefined}
                  style={loadoutTooltipStyle}
                  onMouseEnter={cancelTooltipClose}
                  onMouseLeave={() => scheduleTooltipClose(() => setActiveLoadoutSlot(null))}
                  onFocus={cancelTooltipClose}
                  onBlur={() => scheduleTooltipClose(() => setActiveLoadoutSlot(null))}
                >
                  <strong>{HUD_SLOT_LABELS[slot]}</strong>
                  {item ? (
                    <>
                      <p>
                        {RARITY_VISUALS[item.rarity].label} {item.name}
                      </p>
                      <ImplicitModifierList modifiers={item.implicitModifiers} />
                      <ul>
                        {item.modifiers.map((modifier, index) => (
                          <li key={`${modifier.sourceId}-${modifier.id}-${index}`}>
                            {formatGearModifier(modifier)}
                          </li>
                        ))}
                      </ul>
                      {itemSet ? <GearSetFormation set={itemSet} /> : null}
                    </>
                  ) : (
                    <p>Empty slot</p>
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export interface CharacterStatsPanelProps {
  snapshot: GameUiSnapshot
  tooltips: HudTooltips
}

export function CharacterStatsPanel({ snapshot, tooltips }: CharacterStatsPanelProps) {
  const {
    activeKey: activeCharacterStatId,
    setActiveKey: setActiveCharacterStatId,
    anchorRef: characterStatTooltipAnchorRef,
    tooltipRef: characterStatTooltipRef,
    style: characterStatTooltipStyle,
  } = tooltips.characterStat
  const { cancelClose: cancelTooltipClose, scheduleClose: scheduleTooltipClose } = tooltips

  return (
    <section className="character-stats" aria-labelledby="character-stats-title">
      <h3 id="character-stats-title" className="hud-panel-heading">Character Stats</h3>
      <div className="character-stat-groups">
        {snapshot.characterStats.groups.map((group) => (
          <section
            className="character-stat-group"
            aria-labelledby={`character-stat-group-${group.id}`}
            key={group.id}
          >
            <h4 id={`character-stat-group-${group.id}`}>{group.title}</h4>
            <ul className="character-stat-list">
              {group.stats.map((stat) => {
                const tooltipId = `character-stat-tooltip-${stat.id}`
                const isActive = activeCharacterStatId === stat.id
                return (
                  <li className="character-stat-entry" key={stat.id}>
                    <button
                      className="character-stat-button"
                      type="button"
                      ref={isActive ? characterStatTooltipAnchorRef : undefined}
                      aria-label={`${stat.label}: ${stat.value}`}
                      aria-describedby={isActive ? tooltipId : undefined}
                      onFocus={() => {
                        cancelTooltipClose()
                        closeAllTooltips()
                        setActiveCharacterStatId(stat.id)
                      }}
                      onBlur={() => scheduleTooltipClose(() => setActiveCharacterStatId(null))}
                      onMouseEnter={() => {
                        cancelTooltipClose()
                        closeAllTooltips()
                        setActiveCharacterStatId(stat.id)
                      }}
                      onMouseLeave={() => scheduleTooltipClose(() => setActiveCharacterStatId(null))}
                    >
                      <span className="character-stat-label">{stat.label}</span>
                      <span className="character-stat-value">
                        <strong>{stat.value}</strong>
                        {stat.uncappedValue !== undefined ? (
                          <span className="character-stat-uncapped">
                            ({stat.uncappedValue})
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {isActive ? (
                      <div
                        className={tooltipClassName('character-stat-tooltip')}
                        id={tooltipId}
                        role="tooltip"
                        ref={isActive ? characterStatTooltipRef : undefined}
                        style={characterStatTooltipStyle}
                        onMouseEnter={cancelTooltipClose}
                        onMouseLeave={() => scheduleTooltipClose(() => setActiveCharacterStatId(null))}
                        onFocus={cancelTooltipClose}
                        onBlur={() => scheduleTooltipClose(() => setActiveCharacterStatId(null))}
                      >
                        <strong>{stat.label}</strong>
                        <p className="character-stat-tooltip-value">
                          Current value: {stat.value}
                        </p>
                        {stat.uncappedValue !== undefined ? (
                          <p className="character-stat-tooltip-uncapped">
                            Uncapped total: {stat.uncappedValue}
                          </p>
                        ) : null}
                        <p><KeywordText text={stat.description} /></p>
                        {stat.damageBonuses !== undefined ? (
                          <section
                            className="attunement-bonus-panel"
                            aria-label="Current Attunement bonus by damage type"
                          >
                            <div className="attunement-bonus-heading">
                              <span>Attunement bonus</span>
                              <small>from Basic Attack</small>
                            </div>
                            <ul className="attunement-bonus-list">
                              {stat.damageBonuses.map((bonus) => (
                                <li
                                  className="attunement-bonus"
                                  data-damage-type={bonus.damageType}
                                  key={bonus.damageType}
                                >
                                  <span className="attunement-bonus-type">
                                    <span className="attunement-bonus-orb" aria-hidden="true" />
                                    {bonus.label}
                                  </span>
                                  <strong>{bonus.value}</strong>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ) : null}
                        <p className="character-stat-tooltip-applies">
                          <span>Applies to:</span> <KeywordText text={stat.appliesTo} />
                        </p>
                        {stat.sources !== undefined ? (
                          <div className="character-stat-tooltip-sources">
                            <p>Sources</p>
                            <ul>
                              {stat.sources.map((source, index) => (
                                <li key={`${source.label}-${index}`}>
                                  <span>{source.label}</span>
                                  <strong>{source.value}</strong>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
}
