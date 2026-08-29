export type KeywordId =
  | 'poison'
  | 'frost'
  | 'chill'
  | 'freeze'
  | 'shatter'
  | 'shock'
  | 'overload'
  | 'cooldown-reduction'
  | 'duration'
  | 'damage-over-time'
  | 'stack'
  | 'leech'
  | 'critical-strike'
  | 'area-of-effect'
  | 'projectile-chain'
  | 'resistance'
  | 'physical-damage'
  | 'elemental-damage'
  | 'chaos-damage'

export interface KeywordDefinition {
  id: KeywordId
  label: string
  summary: string
  details: string
}

export const KEYWORD_DEFINITIONS: Readonly<Record<KeywordId, KeywordDefinition>> = {
  poison: {
    id: 'poison',
    label: 'Poison',
    summary: 'Damage over time applied by a hit.',
    details:
      'Each application creates a separate stack. Its damage and duration come from the source skill or modifier. Staff Poison lasts 4 seconds and deals 50% of the applying hit\'s physical and chaos damage per second.',
  },
  frost: {
    id: 'frost',
    label: 'Frost',
    summary: 'The status family that uses Chill and Freeze.',
    details:
      'Frost effects apply Chill stacks. Chill slows enemies, and reaching 3 stacks normally triggers Freeze.',
  },
  chill: {
    id: 'chill',
    label: 'Chill',
    summary: 'Frost stacks that slow enemies.',
    details:
      'Each Chill stack slows an enemy by 15%. Chill lasts up to 4 seconds and caps at 3 stacks. Reaching 3 stacks triggers Freeze.',
  },
  freeze: {
    id: 'freeze',
    label: 'Freeze',
    summary: 'Temporarily prevents an enemy from acting.',
    details:
      'The default Freeze duration is 1 second. Freeze consumes the target\'s Chill stacks, and control resistance can reduce its duration. A physical hit can Shatter a frozen enemy.',
  },
  shatter: {
    id: 'shatter',
    label: 'Shatter',
    summary: 'A physical hit that breaks Freeze for bonus damage.',
    details:
      'The first physical hit against a frozen enemy ends Freeze and deals 150% of that hit\'s damage.',
  },
  shock: {
    id: 'shock',
    label: 'Shock',
    summary: 'Lightning stacks that build toward Overload.',
    details:
      'Shock stacks last up to 4 seconds and cap at 3 stacks. Reaching 3 stacks triggers Overload and consumes the stacks.',
  },
  overload: {
    id: 'overload',
    label: 'Overload',
    summary: 'A Shock detonation.',
    details:
      'Overload deals 150% of the triggering hit\'s damage, then removes the target\'s Shock stacks.',
  },
  'cooldown-reduction': {
    id: 'cooldown-reduction',
    label: 'Cooldown reduction',
    summary: 'Makes skills ready again sooner.',
    details:
      'This percentage reduces a skill\'s cooldown. For example, 20% turns a 5-second cooldown into 4 seconds. Skill cooldowns cannot go below 0.1 seconds.',
  },
  duration: {
    id: 'duration',
    label: 'Duration',
    summary: 'How long an effect remains active.',
    details:
      'A duration is the time an active skill effect remains in the world before it expires.',
  },
  'damage-over-time': {
    id: 'damage-over-time',
    label: 'Damage over time',
    summary: 'Damage dealt gradually instead of in one hit.',
    details:
      'Damage over time effects tick during their duration. Poison is the current player-applied damage-over-time effect.',
  },
  stack: {
    id: 'stack',
    label: 'Stack',
    summary: 'One unit of a repeatable status effect.',
    details:
      'Stacks are added by repeated applications and are usually capped and timed. Reaching a stack threshold can trigger another effect, such as Freeze or Overload.',
  },
  leech: {
    id: 'leech',
    label: 'Leech',
    summary: 'Restores health from damage dealt.',
    details:
      'Leech restores health from actual damage dealt after enemy mitigation. Damage-over-time effects do not trigger melee leech.',
  },
  'critical-strike': {
    id: 'critical-strike',
    label: 'Critical strike',
    summary: 'A hit that deals multiplied damage.',
    details:
      'Critical chance controls how often a hit crits. Critical multiplier controls how much extra damage a critical strike deals.',
  },
  'area-of-effect': {
    id: 'area-of-effect',
    label: 'Area of effect',
    summary: 'Affects a region instead of one point.',
    details:
      'Area-of-effect bonuses increase the coverage of area-based skills. They do not automatically increase single-target damage.',
  },
  'projectile-chain': {
    id: 'projectile-chain',
    label: 'Projectile chain',
    summary: 'Lets a projectile hit additional targets.',
    details:
      'A chained projectile can continue from its initial target to additional enemies. It does not create extra hits when no valid target is nearby.',
  },
  resistance: {
    id: 'resistance',
    label: 'Resistance',
    summary: 'Reduces incoming damage of a matching type.',
    details:
      'Physical, elemental, and chaos resistance are separate defenses. A resistance only reduces damage in its matching category.',
  },
  'physical-damage': {
    id: 'physical-damage',
    label: 'Physical damage',
    summary: 'The weapon-like damage category.',
    details:
      'Physical damage is reduced by physical resistance and can be part of effects such as Poison\'s applying-hit calculation.',
  },
  'elemental-damage': {
    id: 'elemental-damage',
    label: 'Elemental damage',
    summary: 'Fire, lightning, and cold damage.',
    details:
      'Elemental damage is reduced by elemental resistance. Fire, lightning, and cold are individual damage types within this category.',
  },
  'chaos-damage': {
    id: 'chaos-damage',
    label: 'Chaos damage',
    summary: 'A distinct damage category.',
    details:
      'Chaos damage is reduced by chaos resistance and is separate from physical and elemental damage.',
  },
}

interface KeywordAlias {
  id: KeywordId
  text: string
}

const KEYWORD_ALIASES: readonly KeywordAlias[] = [
  { id: 'cooldown-reduction', text: 'cooldown reduction' },
  { id: 'damage-over-time', text: 'damage over time' },
  { id: 'area-of-effect', text: 'area of effect' },
  { id: 'critical-strike', text: 'critical strikes' },
  { id: 'critical-strike', text: 'critical strike' },
  { id: 'projectile-chain', text: 'projectile chains' },
  { id: 'projectile-chain', text: 'projectile chain' },
  { id: 'physical-damage', text: 'physical damage' },
  { id: 'elemental-damage', text: 'elemental damage' },
  { id: 'chaos-damage', text: 'chaos damage' },
  { id: 'poison', text: 'poison' },
  { id: 'poison', text: 'poisons' },
  { id: 'poison', text: 'poisoned' },
  { id: 'frost', text: 'frost' },
  { id: 'chill', text: 'chill' },
  { id: 'chill', text: 'chilled' },
  { id: 'freeze', text: 'freeze' },
  { id: 'freeze', text: 'freezes' },
  { id: 'freeze', text: 'frozen' },
  { id: 'shatter', text: 'shatter' },
  { id: 'shock', text: 'shock' },
  { id: 'shock', text: 'shocked' },
  { id: 'overload', text: 'overload' },
  { id: 'leech', text: 'leech' },
  { id: 'resistance', text: 'resistance' },
  { id: 'stack', text: 'stacks' },
  { id: 'stack', text: 'stack' },
  { id: 'damage-over-time', text: 'dot' },
  { id: 'area-of-effect', text: 'aoe' },
  { id: 'critical-strike', text: 'crit' },
]

export interface KeywordTextSegment {
  type: 'text' | 'keyword'
  value: string
  keywordId?: KeywordId
}

function isWordCharacter(value: string | undefined): boolean {
  return value !== undefined && /[a-z0-9]/i.test(value)
}

function matchesAt(text: string, index: number, alias: string): boolean {
  const end = index + alias.length
  if (text.slice(index, end).toLowerCase() !== alias) {
    return false
  }
  return !isWordCharacter(text[index - 1]) && !isWordCharacter(text[end])
}

export function splitKeywordText(text: string): readonly KeywordTextSegment[] {
  if (text.length === 0) {
    return []
  }

  const segments: KeywordTextSegment[] = []
  let textStart = 0
  let index = 0
  while (index < text.length) {
    const match = KEYWORD_ALIASES
      .filter((alias) => matchesAt(text, index, alias.text))
      .sort((left, right) => right.text.length - left.text.length)[0]
    if (!match) {
      index += 1
      continue
    }
    if (index > textStart) {
      segments.push({ type: 'text', value: text.slice(textStart, index) })
    }
    segments.push({
      type: 'keyword',
      value: text.slice(index, index + match.text.length),
      keywordId: match.id,
    })
    index += match.text.length
    textStart = index
  }
  if (textStart < text.length) {
    segments.push({ type: 'text', value: text.slice(textStart) })
  }
  return segments
}
