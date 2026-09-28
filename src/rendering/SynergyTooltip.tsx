import { getSkillDefinition } from '../content/skills/Skills'
import type { SynergyUpgradeDefinition } from '../content/upgrades/Upgrades'
import { HoverTerm, KeywordText } from './KeywordTooltip'

/**
 * A synergy partner's name on a level-up card, with the synergy behind it.
 *
 * The card says Glacial Orb has a synergy with Chain Lightning; this says
 * what that synergy does, without the player leaving the choice to look it
 * up. Same dotted underline as a glossary term, so the affordance is one the
 * player has already learned.
 */
export function SynergyTerm({
  name,
  synergies,
}: {
  name: string
  synergies: readonly SynergyUpgradeDefinition[]
}) {
  if (synergies.length === 0) {
    return <>{name}</>
  }
  return (
    <HoverTerm
      value={name}
      className="synergy-term"
      popoverClassName="synergy-tooltip"
      ariaLabel={`${name}: ${synergies.map((synergy) => synergy.name).join(', ')}`}
    >
      {synergies.map((synergy) => (
        <span className="synergy-tooltip-entry" key={synergy.id}>
          <strong>{synergy.name}</strong>
          <span className="synergy-tooltip-pair">
            {synergy.synergySkillIds.map((skillId) => getSkillDefinition(skillId).name).join(' + ')}
          </span>
          <span><KeywordText text={synergy.description} /></span>
          <span className="synergy-tooltip-value">{synergy.valueLabel}</span>
        </span>
      ))}
    </HoverTerm>
  )
}
