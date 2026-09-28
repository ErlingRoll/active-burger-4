import { KEYWORD_DEFINITIONS, type KeywordId } from '../glossary/Keywords'
import {
  getSkillDefinition,
  SKILL_DEFINITIONS,
  type SkillId,
} from './Skills'

/**
 * The status synergies between skills, derived rather than written.
 *
 * A skill says which enemy statuses it `applies` and which it `consumes`; a
 * pair of skills works together when one applies what the other consumes.
 * Glacial Orb applies Freeze and every physical skill consumes it through
 * Shatter, so Glacial Orb "works with" Whirlwind without a synergy card and
 * without a sentence in either description. This module is the one place that
 * pairing is computed, so the level-up card, the skill tooltip, the build
 * planner and the wiki cannot disagree about it.
 */

export interface SkillStatusPartner {
  readonly skillId: SkillId
  /** The statuses this partner consumes that the skill applies. */
  readonly setsUp: readonly KeywordId[]
  /** The statuses this partner applies that the skill consumes. */
  readonly benefitsFrom: readonly KeywordId[]
}

export interface SkillStatusInteractions {
  readonly applies: readonly KeywordId[]
  readonly consumes: readonly KeywordId[]
}

export function getSkillStatusInteractions(skillId: SkillId): SkillStatusInteractions {
  const definition = getSkillDefinition(skillId)
  return {
    applies: definition.applies ?? [],
    consumes: definition.consumes ?? [],
  }
}

function intersect(
  left: readonly KeywordId[],
  right: readonly KeywordId[],
): KeywordId[] {
  return left.filter((keyword) => right.includes(keyword))
}

/**
 * The skills whose statuses interlock with this one, in definition order. The
 * `interactions` argument lets a caller substitute what the skill applies right
 * now: a Basic Attack with a staff equipped poisons, and the tooltip knows that
 * where the definition cannot.
 */
export function getSkillStatusPartners(
  skillId: SkillId,
  interactions: SkillStatusInteractions = getSkillStatusInteractions(skillId),
): SkillStatusPartner[] {
  return Object.values(SKILL_DEFINITIONS).flatMap((entry) => {
    if (entry.id === skillId) {
      return []
    }
    // The catalog is `as const`, so its union lacks the optional fields; the
    // accessor returns the widened definition.
    const candidate = getSkillDefinition(entry.id)
    const setsUp = intersect(interactions.applies, candidate.consumes ?? [])
    const benefitsFrom = intersect(interactions.consumes, candidate.applies ?? [])
    if (setsUp.length === 0 && benefitsFrom.length === 0) {
      return []
    }
    return [{ skillId: candidate.id, setsUp, benefitsFrom }]
  })
}

export function formatKeywordLabels(keywords: readonly KeywordId[]): string {
  return keywords.map((keyword) => KEYWORD_DEFINITIONS[keyword].label).join(', ')
}

/** One line for a partner: "sets up Freeze" or "shatters Freeze from". */
export function describeSkillStatusPartner(partner: SkillStatusPartner): string {
  const parts: string[] = []
  if (partner.setsUp.length > 0) {
    parts.push(`sets up ${formatKeywordLabels(partner.setsUp)}`)
  }
  if (partner.benefitsFrom.length > 0) {
    parts.push(`benefits from its ${formatKeywordLabels(partner.benefitsFrom)}`)
  }
  return parts.join(' and ')
}
