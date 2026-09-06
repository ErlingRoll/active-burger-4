import {
  LANCERS_CHARGE_MAX_MOMENTUM_STACKS,
  LANCERS_CHARGE_MOMENTUM_DECAY_SECONDS,
  LANCERS_CHARGE_MOMENTUM_PERCENT_PER_STACK,
  LANCERS_CHARGE_VANGUARD_MOMENTUM_PERCENT_PER_STACK,
  RAISE_SKELETON_ROTTING_BONES_POISON_DURATION_SECONDS,
  RAISE_SKELETON_ROTTING_BONES_POISON_PHYSICAL_CHAOS_RATIO,
} from '../../game-config/skills'

export type KeywordId =
  | 'poison'
  | 'burning'
  | 'frost'
  | 'chill'
  | 'freeze'
  | 'shatter'
  | 'shock'
  | 'overload'
  | 'momentum'
  | 'resonance'
  | 'attunement'
  | 'skill-affinity'
  | 'primed'
  | 'synergy-charge'
  | 'healing'
  | 'shield'
  | 'damage-reduction'
  | 'cooldown'
  | 'cooldown-reduction'
  | 'duration'
  | 'damage-over-time'
  | 'stack'
  | 'leech'
  | 'critical-strike'
  | 'area-of-effect'
  | 'projectile-chain'
  | 'primary-target'
  | 'resistance'
  | 'physical-damage'
  | 'elemental-damage'
  | 'chaos-damage'
  | 'ruin-sigil'
  | 'echo'
  | 'wire'
  | 'tension'
  | 'blood-debt'
  | 'convergence'
  | 'prism-burst'
  | 'triggerable'

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
      `Each application creates a separate stack of Chaos damage over time. Base Poison damage per second is (the applying hit's pre-mitigation Physical damage + Chaos damage) × the application's Poison ratio. Each source defines that ratio and duration; Rotting Bones is the current player source, at ${Math.round(RAISE_SKELETON_ROTTING_BONES_POISON_PHYSICAL_CHAOS_RATIO * 100)}% for ${RAISE_SKELETON_ROTTING_BONES_POISON_DURATION_SECONDS} seconds. For player-owned Poison, each tick is base Poison damage × (1 + DoT multiplier / 100).`,
  },
  burning: {
    id: 'burning',
    label: 'Burning',
    summary: 'A fire damage-over-time stack.',
    details:
      'Each application creates a separate stack that deals Fire damage per second based on the applying hit\'s Fire damage. For player-owned Burning, each tick is base Burning damage × (1 + DoT multiplier / 100), including Burning created by Cinder Mine or a Prismatic Ruin.',
  },
  frost: {
    id: 'frost',
    label: 'Frost',
    summary: 'The status family that uses Chill and Freeze.',
    details:
      'Frost effects apply Chill stacks. Total Chill slow is stacks × 15%, capped at 3 stacks (45%); reaching 3 stacks normally triggers Freeze.',
  },
  chill: {
    id: 'chill',
    label: 'Chill',
    summary: 'Frost stacks that slow enemies.',
    details:
      'Each Chill stack slows an enemy by 15%, so total slow is stacks × 15%. Chill lasts up to 4 seconds and caps at 3 stacks (45% slow). Reaching 3 stacks triggers Freeze.',
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
    summary: 'A physical hit that breaks Freeze for 150% damage.',
    details:
      'The first physical hit against a frozen enemy ends Freeze and deals 150% of that hit\'s damage.',
  },
  shock: {
    id: 'shock',
    label: 'Shock',
    summary: 'Lightning stacks that build toward Overload.',
    details:
      'Shock stacks last up to 4 seconds and cap at 3 stacks. Reaching 3 stacks triggers Overload for triggering hit damage × 1.5, then consumes the stacks.',
  },
  overload: {
    id: 'overload',
    label: 'Overload',
    summary: 'A Shock detonation.',
    details:
      'Overload deals 150% of the triggering hit\'s damage, then removes the target\'s Shock stacks.',
  },
  momentum: {
    id: 'momentum',
    label: 'Momentum',
    summary: 'Stacks that empower Lancer\'s Charge.',
    details:
      `Each Lancer's Charge grants one stack after it resolves. Total increased damage is stacks × ${LANCERS_CHARGE_MOMENTUM_PERCENT_PER_STACK}% (${LANCERS_CHARGE_VANGUARD_MOMENTUM_PERCENT_PER_STACK}% with Vanguard), up to ${LANCERS_CHARGE_MAX_MOMENTUM_STACKS * LANCERS_CHARGE_MOMENTUM_PERCENT_PER_STACK}% (${LANCERS_CHARGE_MAX_MOMENTUM_STACKS * LANCERS_CHARGE_VANGUARD_MOMENTUM_PERCENT_PER_STACK}% with Vanguard) at ${LANCERS_CHARGE_MAX_MOMENTUM_STACKS} stacks. Any new stack refreshes its ${LANCERS_CHARGE_MOMENTUM_DECAY_SECONDS}-second timer; all stacks are lost when that timer expires.`,
  },
  resonance: {
    id: 'resonance',
    label: 'Resonance',
    summary: 'A charged skill effect created by Basic Attacks.',
    details:
      'Successful Basic Attacks charge each skill independently. Skills with a golden border will proc Resonance on their next cast.',
  },
  attunement: {
    id: 'attunement',
    label: 'Attunement',
    summary: 'Converts part of Basic Attack damage into skill damage.',
    details:
      'Attunement adds ceil(final pre-critical Basic Attack component × Attunement / 100) to skills and summons for each damage type. Each component keeps its type and rounds up independently.',
  },
  'skill-affinity': {
    id: 'skill-affinity',
    label: 'Skill affinity',
    summary: 'A class preference that increases the chance of matching skill unlocks.',
    details:
      'Each class has a set of affinity tags. An eligible skill unlock that matches at least one tag receives 3× the normal selection weight; other skill unlocks receive normal weight. Affinity affects skill unlock choices, not stat upgrades, gear, or starting skills.',
  },
  primed: {
    id: 'primed',
    label: 'Primed',
    summary: 'A stored effect waiting for a matching skill.',
    details:
      'A primed skill effect is consumed by the next matching cast or hit. Primed effects are normally created by another skill in the Synergy pair.',
  },
  'synergy-charge': {
    id: 'synergy-charge',
    label: 'Synergy Charge',
    summary: 'Healing stored for a future Vitality cast.',
    details:
      'Lifebound Pact stores half of Soul Tether healing, up to 20 HP. The next Vitality cast consumes the stored charge as bonus healing.',
  },
  healing: {
    id: 'healing',
    label: 'Healing',
    summary: 'Restores HP without exceeding the missing amount.',
    details:
      'Final healing is min(missing HP, requested healing × (1 + increased healing / 100) × critical multiplier). The critical multiplier is 1 unless the healing roll is critical.',
  },
  shield: {
    id: 'shield',
    label: 'Shield',
    summary: 'An absorb barrier that prevents incoming damage.',
    details:
      'A shield absorbs each post-mitigation damage component before HP is lost: absorbed damage = min(component damage, remaining shield); remaining HP damage = component damage - absorbed damage. Synergies can repair, refresh, or consume part of an active Aegis Pulse shield.',
  },
  'damage-reduction': {
    id: 'damage-reduction',
    label: 'Damage reduction',
    summary: 'Lowers all damage taken before resistance.',
    details:
      'Active player damage-reduction sources add together. Each incoming component is multiplied by 1 - min(75%, total damage reduction) / 100 before its matching resistance is applied.',
  },
  cooldown: {
    id: 'cooldown',
    label: 'Cooldown',
    summary: 'The time before a skill can be used again.',
    details:
      'A skill cannot be cast while its cooldown is above zero. Cooldown reductions and priming effects make the next cast available sooner.',
  },
  'cooldown-reduction': {
    id: 'cooldown-reduction',
    label: 'Cooldown reduction',
    summary: 'Makes skills ready again sooner.',
    details:
      'Effective cooldown is max(0.1 seconds, base cooldown × (1 - cooldown reduction / 100)). For example, 20% turns a 5-second cooldown into 4 seconds.',
  },
  triggerable: {
    id: 'triggerable',
    label: 'Triggerable',
    summary: 'Can be replayed by a copying trigger.',
    details:
      'Triggerable skills may be focused by Critical Spellstrike and are eligible for Mirrorcast. Replays use the focused skill’s normal behavior without consuming its cooldown, cast count, or Resonance.',
  },
  duration: {
    id: 'duration',
    label: 'Duration',
    summary: 'How long an effect remains active.',
    details:
      'A duration is the time an active skill effect remains in the world before it expires. A capped extension sets new remaining duration to min(maximum duration, remaining duration + extension).',
  },
  'damage-over-time': {
    id: 'damage-over-time',
    label: 'Damage over time',
    summary: 'Damage dealt gradually instead of in one hit.',
    details:
      'Damage over time effects tick during their duration. Player-owned Poison, Burning, and Soul Tether ticks use base periodic damage × (1 + DoT multiplier / 100) once when each event resolves. DoT multiplier does not affect enemy damage.',
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
      'Leech starts as actual post-mitigation hit damage × leech percentage. It then receives increased healing and is capped at missing HP; current melee leech does not roll a healing critical strike. Damage-over-time effects do not trigger melee leech.',
  },
  'critical-strike': {
    id: 'critical-strike',
    label: 'Critical strike',
    summary: 'A hit that deals multiplied damage.',
    details:
      'A critical hit deals hit damage × critical multiplier / 100. Critical chance is capped at 100%; each point above 100 adds 0.5 percentage points to the critical multiplier. Average hit factor is 1 + chance / 100 × (multiplier / 100 - 1).',
  },
  'area-of-effect': {
    id: 'area-of-effect',
    label: 'Area of effect',
    summary: 'Affects a region instead of one point.',
    details:
      'Area-of-effect bonuses scale an area value as base area × (1 + area of effect / 100). They increase coverage of area-based skills, not their single-target damage.',
  },
  'projectile-chain': {
    id: 'projectile-chain',
    label: 'Projectile chain',
    summary: 'Lets a projectile hit additional targets.',
    details:
      'A chained projectile can continue from its initial target to additional enemies. It does not create extra hits when no valid target is nearby.',
  },
  'primary-target': {
    id: 'primary-target',
    label: 'Primary target',
    summary: 'The enemy selected when a projectile is created.',
    details:
      'The primary target is the first intended target of a projectile. Targets reached by projectile chains or later retargeting are secondary targets, so effects that mention the primary target apply only when the projectile hits its initially selected enemy.',
  },
  resistance: {
    id: 'resistance',
    label: 'Resistance',
    summary: 'Reduces incoming damage of a matching type.',
    details:
      'Final component damage is base damage × (1 - effective resistance / 100), where effective resistance is capped at 75%. Lightning, Fire, and Cold use elemental resistance plus their matching individual resistance; Physical and Chaos use their own pools.',
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
  'ruin-sigil': {
    id: 'ruin-sigil',
    label: 'Ruin Sigil',
    summary: 'A chaos brand that charges and detonates.',
    details:
      'A Ruin Sigil gains at most one charge for each distinct damage source category that hits the marked enemy: Basic Attack, skill, summon, and damage over time. At 3 charges it detonates for chaos damage based on the capped damage dealt while the enemy was marked.',
  },
  echo: {
    id: 'echo',
    label: 'Echo',
    summary: 'A delayed copy of a skill cast.',
    details:
      'Mirrorcast arms an Echo that copies your next mirrorable non-Basic skill cast after a short delay at 50% effectiveness. After unlocking it, open an eligible skill tooltip and choose Focus Echo to make Mirrorcast wait for that skill; choose Clear Echo Focus to return to automatic capture. Summon-only skills are not consumed by the Echo. The copy never resets the original cooldown and can never copy Mirrorcast itself, so Echoes never nest.',
  },
  wire: {
    id: 'wire',
    label: 'Wire',
    summary: 'A persistent line that damages crossings.',
    details:
      'A Razorwire connects two anchors. An enemy that crosses the Wire takes physical damage and is briefly Chilled, limited by a short per-enemy crossing cooldown so standing on it deals no per-tick damage.',
  },
  tension: {
    id: 'tension',
    label: 'Tension',
    summary: 'Guillotine Line stacks that snap at a cap.',
    details:
      'The Guillotine Line builds one Tension stack on a target each time it crosses the Wire. When Tension reaches its cap the Wire snaps for a heavy physical burst and the target\'s Tension resets.',
  },
  'blood-debt': {
    id: 'blood-debt',
    label: 'Blood Debt',
    summary: 'Stored power spent by your next skill.',
    details:
      'Blood Rite sacrifices current HP to store Blood Debt. Your next skill consumes it for a bounded bonus: damage skills gain chaos, healing skills restore sacrificed health, shields gain shield, and utility skills gain duration. Open an eligible skill tooltip and choose Focus Debt to make Blood Debt wait for that skill, or Clear Debt Focus to return to automatic capture. Blood Debt expires if unused.',
  },
  convergence: {
    id: 'convergence',
    label: 'Convergence',
    summary: 'All three Prism elements on one target.',
    details:
      'Chromatic Convergence tracks Prism elements on each enemy within a short window. When Fire, Cold, and Lightning all land on the same target it triggers a Prism Burst for 140% total shard damage and clears the tracked elements.',
  },
  'prism-burst': {
    id: 'prism-burst',
    label: 'Prism Burst',
    summary: 'A three-element detonation from Chromatic Convergence.',
    details:
      'When Fire, Cold, and Lightning from Prism Halo hit the same enemy within the convergence window, Prism Burst deals total shard damage × 1.4, split equally into Fire, Cold, and Lightning components. It uses the triggering shard\'s critical-strike profile, clears that enemy\'s Convergence progress, and does not apply another elemental status.',
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
  { id: 'primary-target', text: 'primary targets' },
  { id: 'primary-target', text: 'primary target' },
  { id: 'physical-damage', text: 'physical damage' },
  { id: 'elemental-damage', text: 'elemental damage' },
  { id: 'chaos-damage', text: 'chaos damage' },
  { id: 'poison', text: 'poison' },
  { id: 'poison', text: 'poisons' },
  { id: 'poison', text: 'poisoned' },
  { id: 'burning', text: 'burning' },
  { id: 'burning', text: 'burns' },
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
  { id: 'momentum', text: 'momentum' },
  { id: 'resonance', text: 'resonance' },
  { id: 'attunement', text: 'attunement' },
  { id: 'skill-affinity', text: 'skill affinities' },
  { id: 'skill-affinity', text: 'skill affinity' },
  { id: 'skill-affinity', text: 'affinities' },
  { id: 'skill-affinity', text: 'affinity' },
  { id: 'primed', text: 'prime' },
  { id: 'primed', text: 'primes' },
  { id: 'primed', text: 'primed' },
  { id: 'synergy-charge', text: 'synergy charge' },
  { id: 'healing', text: 'healing' },
  { id: 'shield', text: 'shield' },
  { id: 'shield', text: 'shielded' },
  { id: 'damage-reduction', text: 'damage reduction' },
  { id: 'cooldown', text: 'cooldown' },
  { id: 'leech', text: 'leech' },
  { id: 'resistance', text: 'resistance' },
  { id: 'stack', text: 'stacks' },
  { id: 'stack', text: 'stack' },
  { id: 'ruin-sigil', text: 'ruin sigil' },
  { id: 'ruin-sigil', text: 'ruin sigils' },
  { id: 'ruin-sigil', text: 'sigil' },
  { id: 'ruin-sigil', text: 'sigils' },
  { id: 'echo', text: 'echo' },
  { id: 'echo', text: 'echoes' },
  { id: 'wire', text: 'wire' },
  { id: 'wire', text: 'wires' },
  { id: 'tension', text: 'tension' },
  { id: 'blood-debt', text: 'blood debt' },
  { id: 'convergence', text: 'convergence' },
  { id: 'prism-burst', text: 'prism burst' },
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
