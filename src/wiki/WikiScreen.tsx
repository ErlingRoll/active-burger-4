import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import heroImage from '../assets/hero.png'
import {
  ALL_ITEM_DEFINITIONS,
  EQUIPMENT_SLOTS,
  WEAPON_ARCHETYPES,
} from '../content/gear/Items'
import { GEAR_MODIFIER_DEFINITIONS, GEAR_MODIFIER_TIERS } from '../content/gear/ModifierPools'
import { KEYWORD_DEFINITIONS } from '../content/glossary/Keywords'
import {
  getEffectiveSkillCooldown,
  getSkillHealing,
  getSkillShieldAmount,
  SKILL_DEFINITIONS,
} from '../content/skills/Skills'
import type { SkillDefinition } from '../content/skills/Skills'
import { RARITIES, RARITY_VISUALS, RARITY_WEIGHTS } from '../content/rarity/Rarity'
import {
  DAMAGE_TYPES,
  getAverageCriticalStrikeFactor,
  mitigateDamageValues,
  RESISTANCE_CAP,
} from '../content/stats/Damage'
import {
  ATTUNEMENT_DESCRIPTION,
  evaluateDerivedStats,
  RESONANCE_DESCRIPTION,
} from '../content/stats/Stats'
import {
  getStartingLevelForRank,
  STARTING_LEVEL_MAX_RANK,
} from '../content/progression/StartingLevel'
import { getXpMultiplierForLevel, XP_MULTIPLIER_MAX_LEVEL } from '../content/progression/XpMultiplier'
import { DEFAULT_DUNGEON_CONFIG, getFloorDifficultyProfile } from '../content/dungeons/Dungeons'
import { ENEMY_ABILITY_DEFINITIONS, ENEMY_DEFINITIONS } from '../content/enemies/Enemies'
import { ELITE_MODIFIER_DEFINITIONS } from '../content/enemies/EliteModifiers'
import type { EliteModifierDefinition } from '../content/enemies/EliteModifiers'
import { SPAWN_BALANCE, calculateThreatPerSecond } from '../content/spawning/SpawnBalance'
import { WORLD_MODIFIER_DEFINITIONS } from '../content/modifiers/WorldModifiers'
import { BEHAVIOR_PROFILE_DEFINITIONS } from '../content/behaviors/BehaviorProfiles'
import {
  DEFAULT_GAME_KEYBINDS,
  formatKeybind,
  FREE_MOVEMENT_KEYS,
  FREE_MOVEMENT_TOGGLE_KEY,
  KEYBIND_DEFINITIONS,
} from '../input/Keybinds'
import { calculateEssenceReward } from '../meta/EssenceRewards'
import { ALL_GEAR_SET_DEFINITIONS } from '../game-config/gear-sets'
import { GEAR_DROP_CHANCE_BALANCE, GEAR_XP_BLESSING_CHANCE, GEAR_XP_BLESSING_MULTIPLIER } from '../game-config/gear'
import { CHARACTER_CLASS_DEFINITIONS } from '../game-config/classes'
import { INITIAL_UPGRADES } from '../game-config/skill-upgrades'
import { SYNERGY_OFFER_CHANCE, SYNERGY_UPGRADES } from '../game-config/synergies'
import { SkillIcon } from '../rendering/SkillIcon'
import { KeywordTerm, KeywordText } from '../rendering/KeywordTooltip'
import {
  createFloorScalingChartPoints,
  createXpChartPoints,
  formatWikiPercentage,
  getEliteModifierWikiDescription,
  type WikiChartPoint,
} from './wikiData'

interface WikiScreenProps {
  appVersion?: string
  onReturnToApp: () => void
}

interface WikiSection {
  id: string
  title: string
  summary: string
}

const WIKI_SECTIONS: readonly WikiSection[] = [
  { id: 'getting-started', title: 'Getting started', summary: 'Run loop, controls, and behavior profiles.' },
  { id: 'classes', title: 'Classes', summary: 'Starting stats, equipment, skills, and affinities.' },
  { id: 'combat', title: 'Combat and stats', summary: 'Damage, resistance, crits, healing, and core resources.' },
  { id: 'skills', title: 'Skills and evolves', summary: 'Every skill, level scaling, branches, and Resonance.' },
  { id: 'synergies', title: 'Synergies', summary: 'Epic pair upgrades and their requirements.' },
  { id: 'gear', title: 'Gear and upgrades', summary: 'Items, rarities, modifiers, sets, and drops.' },
  { id: 'progression', title: 'Progression', summary: 'Experience, essence, and meta progression.' },
  { id: 'floors', title: 'Floors and encounters', summary: 'Dungeon contracts, scaling, threat, and bosses.' },
  { id: 'enemies', title: 'Enemies and elites', summary: 'Enemy stats, abilities, behaviors, and modifiers.' },
  { id: 'world-modifiers', title: 'World modifiers', summary: 'Difficulty contracts and their rewards.' },
  { id: 'glossary', title: 'Glossary', summary: 'Definitions for highlighted game terminology.' },
]
const SKILLS: readonly SkillDefinition[] = Object.values(SKILL_DEFINITIONS)
const ELITE_MODIFIERS: readonly EliteModifierDefinition[] = Object.values(
  ELITE_MODIFIER_DEFINITIONS,
)
const XP_CHART_POINTS = createXpChartPoints()
const FLOOR_SCALING_CHART_POINTS = createFloorScalingChartPoints()

function titleCase(value: string): string {
  return value.replace(/(?:^|[- ])\w/g, (character) => character.toUpperCase())
}

function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value)
}

function toSearchText(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

function linePoints(points: readonly WikiChartPoint[], width: number, height: number): string {
  const maximum = Math.max(...points.map((point) => point.value), 1)
  return points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
    const y = height - (point.value / maximum) * height
    return `${x},${y}`
  }).join(' ')
}

function SourceChart({ label, points, suffix = '' }: { label: string; points: readonly WikiChartPoint[]; suffix?: string }) {
  const width = 620
  const height = 180
  return (
    <figure className="wiki-chart">
      <figcaption>{label}</figcaption>
      <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height + 32}`}>
        <title>{label}</title>
        <path className="wiki-chart-grid" d={`M0 ${height / 2}H${width} M0 ${height}H${width}`} />
        <polyline className="wiki-chart-line" points={linePoints(points, width, height)} />
        {points.map((point, index) => {
          const maximum = Math.max(...points.map((item) => item.value), 1)
          const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
          const y = height - (point.value / maximum) * height
          return (
            <g key={point.label}>
              <circle className="wiki-chart-point" cx={x} cy={y} r="4" />
              <text className="wiki-chart-label" x={x} y={height + 20} textAnchor="middle">
                {point.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="wiki-chart-values" aria-label={`${label} data`}>
        {points.map((point) => (
          <span key={point.label}><strong>{point.label}</strong> {formatNumber(point.value)}{suffix}</span>
        ))}
      </div>
    </figure>
  )
}

function WikiSectionHeading({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <header className="wiki-section-heading">
      <p className="screen-kicker">Game reference</p>
      <h2 id={`heading-${id}`} tabIndex={-1}>{title}</h2>
      <p>{children}</p>
      <a className="wiki-anchor" href={`#${id}`} aria-label={`Link to ${title}`}>#</a>
    </header>
  )
}

function WikiTable({
  columns,
  rows,
}: {
  columns: readonly string[]
  rows: readonly React.ReactNode[][]
}) {
  return (
    <div className="wiki-table-wrap">
      <table className="wiki-table">
        <thead>
          <tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

export function WikiScreen({ appVersion, onReturnToApp }: WikiScreenProps) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!normalizedQuery) {
      return []
    }
    const indexed = [
      ...WIKI_SECTIONS.map((section) => ({ id: section.id, label: section.title, text: `${section.title} ${section.summary}` })),
      ...SKILLS.map((skill) => ({ id: `skill-${skill.id}`, label: skill.name, text: `${skill.name} ${skill.description} ${skill.tags.join(' ')}` })),
      ...INITIAL_UPGRADES.map((upgrade) => ({ id: `upgrade-${upgrade.id}`, label: upgrade.name, text: `${upgrade.name} ${upgrade.description} ${upgrade.valueLabel}` })),
      ...Object.values(ENEMY_DEFINITIONS).map((enemy) => ({ id: `enemy-${enemy.id}`, label: enemy.name, text: `${enemy.name} ${enemy.behavior.kind}` })),
      ...Object.values(KEYWORD_DEFINITIONS).map((definition) => ({ id: `glossary-${definition.id}`, label: definition.label, text: `${definition.label} ${definition.summary} ${definition.details}` })),
    ]
    return indexed.filter((entry) => toSearchText(entry.text).includes(normalizedQuery)).slice(0, 12)
  }, [normalizedQuery])

  useEffect(() => {
    const scrollToHash = () => {
      const id = window.location.hash.slice(1)
      if (id) {
        document.getElementById(id)?.scrollIntoView({ block: 'start' })
      }
    }
    scrollToHash()
    window.addEventListener('hashchange', scrollToHash)
    return () => window.removeEventListener('hashchange', scrollToHash)
  }, [])

  const levelOneHealing = SKILLS.filter((skill) => skill.baseHealing !== undefined)
  const levelOneShields = SKILLS.filter((skill) => skill.shieldBaseAmount !== undefined)
  const damageExample = mitigateDamageValues({ fire: 100 }, { elemental: 25, fire: 10 })
  const critExample = getAverageCriticalStrikeFactor({ chance: 25, multiplier: 200 })
  const essenceExample = calculateEssenceReward(20, 100, 1.2, true)

  return (
    <section className="wiki-screen" aria-labelledby="wiki-title">
      <header className="wiki-hero">
        <div className="wiki-hero-copy">
          <p className="screen-kicker">Active Burger field manual</p>
          <h1 id="wiki-title">The Burger Codex</h1>
          <p>
            A live reference for the systems, choices, and dangers in Active Burger.
            Values are calculated from the same content definitions used by the game.
          </p>
          <div className="wiki-hero-actions">
            <a className="primary-action" href="#getting-started">Start reading</a>
            <button className="secondary-action" type="button" onClick={onReturnToApp}>Return to game</button>
          </div>
          <p className="wiki-source-note">
            Build {appVersion ?? 'development'} · source-derived values · hover highlighted terms for definitions
          </p>
        </div>
        <img className="wiki-hero-art" src={heroImage} alt="Active Burger hero artwork" />
      </header>

      <div className="wiki-search">
        <label htmlFor="wiki-search">Search the codex</label>
        <input
          id="wiki-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Skills, enemies, effects, upgrades..."
        />
        {normalizedQuery ? (
          <div className="wiki-search-results" role="status">
            <span>{results.length} matching entries</span>
            {results.map((result) => <a key={`${result.id}-${result.label}`} href={`#${result.id}`}>{result.label}</a>)}
          </div>
        ) : null}
      </div>

      <div className="wiki-layout">
        <nav className="wiki-toc" aria-label="Wiki contents">
          <p>Contents</p>
          {WIKI_SECTIONS.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
        </nav>

        <div className="wiki-content">
          <article id="getting-started" className="wiki-article">
            <WikiSectionHeading id="getting-started" title="Getting started">
              Survive normal floors, make a choice when prompted, and clear the encounter floor at the end of the contract.
            </WikiSectionHeading>
            <div className="wiki-card-grid">
              <section className="wiki-card">
                <h3>Run loop</h3>
                <ol>
                  <li>Choose a class, dungeon contract, and optional world modifiers.</li>
                  <li>Fight through timed normal floors; experience, gear, and level choices strengthen the run.</li>
                  <li>Complete boss encounters, then receive essence based on run performance and modifiers.</li>
                </ol>
              </section>
              <section className="wiki-card">
                <h3>Controls</h3>
                <p><kbd>{formatKeybind(FREE_MOVEMENT_TOGGLE_KEY)}</kbd> toggles free movement; <kbd>{FREE_MOVEMENT_KEYS.join(' / ').toUpperCase()}</kbd> moves while enabled.</p>
                <WikiTable columns={['Action', 'Default key']} rows={KEYBIND_DEFINITIONS.map((definition) => [
                  definition.label,
                  <kbd key={definition.id}>{formatKeybind(DEFAULT_GAME_KEYBINDS[definition.id])}</kbd>,
                ])} />
              </section>
            </div>
            <div className="wiki-card-grid">
              {Object.values(BEHAVIOR_PROFILE_DEFINITIONS).map((profile) => (
                <section className="wiki-card" key={profile.id}>
                  <h3>{profile.name}</h3>
                  <p>{profile.description}</p>
                  <p className="wiki-stat-line">Threat radius <strong>{profile.thresholds.threatRadius}</strong> · Kite at <strong>{formatNumber(profile.thresholds.kiteThreatScore)}</strong></p>
                </section>
              ))}
            </div>
          </article>

          <article id="classes" className="wiki-article">
            <WikiSectionHeading id="classes" title="Classes">
              Each class defines its starting stats, weapon, skills, visual identity, and more-likely skill affinity.
            </WikiSectionHeading>
            <div className="wiki-card-grid">
              {Object.values(CHARACTER_CLASS_DEFINITIONS).map((characterClass) => (
                <section className="wiki-card wiki-character-class-card" key={characterClass.id} style={{ '--wiki-accent': `#${characterClass.visual.fillColor.toString(16).padStart(6, '0')}` } as CSSProperties}>
                  <h3>{characterClass.name}</h3>
                  <p>{characterClass.description}</p>
                  <p className="wiki-stat-line">HP <strong>{characterClass.baseStats.maxHp}</strong> · Move <strong>{characterClass.baseStats.movementSpeed}</strong> · Attack <strong>{characterClass.baseStats.attackDamage}</strong></p>
                  <p className="wiki-stat-line">Starts with <a href={`#item-${characterClass.startingWeaponItemId}`}>{ALL_ITEM_DEFINITIONS.find((item) => item.id === characterClass.startingWeaponItemId)?.name}</a></p>
                  <p>{characterClass.startingSkillIds.map((skillId) => <a className="wiki-inline-link" key={skillId} href={`#skill-${skillId}`}>{SKILL_DEFINITIONS[skillId].name}</a>)}</p>
                  <p className="wiki-muted">{characterClass.skillAffinity.description}</p>
                </section>
              ))}
            </div>
          </article>

          <article id="combat" className="wiki-article">
            <WikiSectionHeading id="combat" title="Combat, damage, and stats">
              Damage components retain their type through increases, critical strikes, resistance, and effects.
            </WikiSectionHeading>
            <div className="wiki-card-grid">
              <section className="wiki-card">
                <h3>Damage types</h3>
                <p>{DAMAGE_TYPES.map((type) => <a className="wiki-tag" href={`#glossary-${type}`} key={type}>{titleCase(type)}</a>)}</p>
                <p>Elemental is the shared resistance pool for lightning, fire, and cold. Physical and chaos use their own pools.</p>
              </section>
              <section className="wiki-card">
                <h3>Damage order</h3>
                <p className="wiki-formula">base + flat → increased % → critical hit → resistance mitigation</p>
                <p>For a component, increases use <code>base × (1 + applicable increase / 100)</code>. Resistance is capped at {RESISTANCE_CAP}%.</p>
              </section>
              <section className="wiki-card">
                <h3>Calculated examples</h3>
                <p>100 fire against 25% elemental + 10% fire resistance: <strong>{formatNumber(damageExample.fire)} final fire damage</strong>.</p>
                <p>25% chance and 200% multiplier: <strong>{formatNumber(critExample, 3)}× average crit factor</strong>.</p>
              </section>
            </div>
            <div className="wiki-card-grid">
              <section className="wiki-card">
                <h3>Resonance</h3>
                <p><KeywordText text={RESONANCE_DESCRIPTION} glossaryHref={(keywordId) => `#glossary-${keywordId}`} /></p>
              </section>
              <section className="wiki-card">
                <h3>Attunement</h3>
                <p><KeywordText text={ATTUNEMENT_DESCRIPTION} glossaryHref={(keywordId) => `#glossary-${keywordId}`} /></p>
              </section>
              <section className="wiki-card">
                <h3>Derived stats</h3>
                <p className="wiki-formula">(base + all additive modifiers) × all multiplicative modifiers</p>
                <p>Example: 100 base HP with +20 then ×1.1 evaluates to <strong>{evaluateDerivedStats({ maxHp: 100, movementSpeed: 0, attackDamage: 0, attackSpeed: 0, attackRange: 0 }, [{ stat: 'maxHp', operation: 'add', value: 20, sourceId: 'wiki' }, { stat: 'maxHp', operation: 'multiply', value: 1.1, sourceId: 'wiki' }]).maxHp}</strong>.</p>
              </section>
            </div>
          </article>

          <article id="skills" className="wiki-article">
            <WikiSectionHeading id="skills" title="Skills, upgrades, and evolves">
              Skills are live definitions. Level upgrades and named branches below are the currently authored upgrade pool.
            </WikiSectionHeading>
            <div className="wiki-skill-grid">
              {SKILLS.map((skill) => {
                const upgrades = INITIAL_UPGRADES.filter((upgrade) => upgrade.skillId === skill.id)
                return (
                  <section id={`skill-${skill.id}`} className="wiki-card wiki-skill-card" key={skill.id} style={{ '--wiki-accent': skill.visual.primaryColor } as CSSProperties}>
                    <header>
                      <SkillIcon skillId={skill.id} size={34} />
                      <div><h3>{skill.name}</h3><p>{skill.kind} · {skill.tags.join(' · ')}</p></div>
                    </header>
                    <p><KeywordText text={skill.description} glossaryHref={(keywordId) => `#glossary-${keywordId}`} /></p>
                    <div className="wiki-stat-line">
                      <span>Cooldown <strong>{formatNumber(skill.cooldown)}s</strong></span>
                      <span>At 20% CDR <strong>{formatNumber(getEffectiveSkillCooldown(skill.cooldown, 20))}s</strong></span>
                      {skill.radius ? <span>Radius <strong>{skill.radius}</strong></span> : null}
                      {skill.maxTargets ? <span>Targets <strong>{skill.maxTargets}</strong></span> : null}
                    </div>
                    {skill.baseHealing !== undefined ? <p>Healing at level 1 / 5: <strong>{getSkillHealing(skill, 1)} / {getSkillHealing(skill, 5)}</strong></p> : null}
                    {skill.shieldBaseAmount !== undefined ? <p>Shield at level 1 / 5: <strong>{getSkillShieldAmount(skill, 1)} / {getSkillShieldAmount(skill, 5)}</strong></p> : null}
                    <p className="wiki-muted">Base damage: {Object.entries(skill.baseDamage).filter(([, value]) => value !== undefined).map(([type, value]) => `${formatNumber(value ?? 0)} ${type}`).join(' · ') || 'none'}</p>
                    {skill.resonanceEffect ? <p><strong>Resonance — {skill.resonanceEffect.name}:</strong> <KeywordText text={skill.resonanceEffect.description} glossaryHref={(keywordId) => `#glossary-${keywordId}`} /></p> : null}
                    {upgrades.length > 0 ? <details><summary>Upgrades and branches ({upgrades.length})</summary><ul>{upgrades.map((upgrade) => <li id={`upgrade-${upgrade.id}`} key={upgrade.id}><strong>{upgrade.name}</strong>{upgrade.branch ? ' · Evolve' : ''}: <KeywordText text={upgrade.description} glossaryHref={(keywordId) => `#glossary-${keywordId}`} /> <em>{upgrade.valueLabel}</em></li>)}</ul></details> : null}
                  </section>
                )
              })}
            </div>
            {levelOneHealing.length > 0 || levelOneShields.length > 0 ? <p className="wiki-note">Healing and shield examples use the actual level formula: <code>base + per-level × (level − 1)</code>, clamped to zero.</p> : null}
          </article>

          <article id="synergies" className="wiki-article">
            <WikiSectionHeading id="synergies" title="Synergies">
              Eligible owned skill pairs can be offered as epic synergies; the configured offer chance is {formatWikiPercentage(SYNERGY_OFFER_CHANCE)}.
            </WikiSectionHeading>
            <div className="wiki-card-grid">
              {SYNERGY_UPGRADES.map((synergy) => (
                <section id={`upgrade-${synergy.id}`} className="wiki-card" key={synergy.id}>
                  <p className="screen-kicker">Epic pair</p>
                  <h3>{synergy.name}</h3>
                  <p>{synergy.synergySkillIds.map((skillId) => <a className="wiki-inline-link" key={skillId} href={`#skill-${skillId}`}>{SKILL_DEFINITIONS[skillId].name}</a>)}</p>
                  <p><KeywordText text={synergy.description} glossaryHref={(keywordId) => `#glossary-${keywordId}`} /></p>
                  <p className="wiki-muted"><KeywordText text={synergy.valueLabel} glossaryHref={(keywordId) => `#glossary-${keywordId}`} /></p>
                </section>
              ))}
            </div>
          </article>

          <article id="gear" className="wiki-article">
            <WikiSectionHeading id="gear" title="Gear and upgrades">
              Equipment adds modifiers; rarity determines how many modifiers the generated item receives.
            </WikiSectionHeading>
            <div className="wiki-card-grid">
              <section className="wiki-card">
                <h3>Rarity and rolls</h3>
                <WikiTable columns={['Rarity', 'Weight', 'Modifier count']} rows={RARITIES.map((rarity) => [
                  <span key={rarity} style={{ color: RARITY_VISUALS[rarity].color }}>{RARITY_VISUALS[rarity].label}</span>,
                  RARITY_WEIGHTS[rarity],
                  Object.values(GEAR_MODIFIER_DEFINITIONS).length > 0 ? ({ common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 }[rarity]) : '',
                ])} />
              </section>
              <section className="wiki-card">
                <h3>Drops</h3>
                <p>Gear-drop chance uses a floor taper from <strong>{GEAR_DROP_CHANCE_BALANCE.floorTaper.startMultiplier}×</strong> on floor {GEAR_DROP_CHANCE_BALANCE.floorTaper.startFloor} to <strong>{GEAR_DROP_CHANCE_BALANCE.floorTaper.endMultiplier}×</strong> on floor {GEAR_DROP_CHANCE_BALANCE.floorTaper.endFloor}.</p>
                <p>Once all gear is at least rare, the one-per-dungeon blessing has a <strong>{formatWikiPercentage(GEAR_XP_BLESSING_CHANCE)}</strong> chance and converts gear drops into XP worth <strong>{GEAR_XP_BLESSING_MULTIPLIER}×</strong> mob XP.</p>
              </section>
              <section className="wiki-card">
                <h3>Slots and weapons</h3>
                <p>{EQUIPMENT_SLOTS.map((slot) => <span className="wiki-tag" key={slot}>{titleCase(slot)}</span>)}</p>
                <p>{WEAPON_ARCHETYPES.map((archetype) => <span className="wiki-tag" key={archetype}>{titleCase(archetype)}</span>)}</p>
              </section>
            </div>
            <h3 className="wiki-subheading">Items</h3>
            <WikiTable columns={['Item', 'Slot', 'Weapon']} rows={ALL_ITEM_DEFINITIONS.map((item) => [
              <span id={`item-${item.id}`} key={item.id}>{item.name}</span>,
              titleCase(item.slot),
              item.weaponArchetype ? titleCase(item.weaponArchetype) : '—',
            ])} />
            <h3 className="wiki-subheading">Modifier tiers</h3>
            <WikiTable columns={['Modifier', ...GEAR_MODIFIER_TIERS.map((tier) => `T${tier}`)]} rows={Object.values(GEAR_MODIFIER_DEFINITIONS).map((modifier) => [
              modifier.label,
              ...GEAR_MODIFIER_TIERS.map((tier) => `${modifier.tiers[tier].min}–${modifier.tiers[tier].max}${modifier.valueType === 'percent' ? '%' : ''}`),
            ])} />
            <div className="wiki-card-grid">
              {ALL_GEAR_SET_DEFINITIONS.map((set) => <section className="wiki-card" key={set.id}><h3>{set.name} set</h3><p>{set.bonuses.map((bonus) => `${bonus.requiredPieces} pieces: ${bonus.label}`).join(' · ')}</p></section>)}
            </div>
          </article>

          <article id="progression" className="wiki-article">
            <WikiSectionHeading id="progression" title="Progression and rewards">
              Experience and essence progression are calculated from deterministic helpers; charts show selected exact samples.
            </WikiSectionHeading>
            <SourceChart label="Cumulative XP needed to reach each selected level" points={XP_CHART_POINTS} />
            <div className="wiki-card-grid">
              <section className="wiki-card">
                <h3>XP formula</h3>
                <p>Level 2 requires 12 XP, then the per-level requirement grows by 1.16 and is rounded before adding to cumulative XP.</p>
                <p>XP multiplier reaches +{formatWikiPercentage(getXpMultiplierForLevel(XP_MULTIPLIER_MAX_LEVEL) - 1)} at level {XP_MULTIPLIER_MAX_LEVEL}.</p>
              </section>
              <section className="wiki-card">
                <h3>Starting level</h3>
                <p>Meta rank 0–{STARTING_LEVEL_MAX_RANK} starts at levels {Array.from({ length: STARTING_LEVEL_MAX_RANK + 1 }, (_, rank) => getStartingLevelForRank(rank)).join(', ')}.</p>
              </section>
              <section className="wiki-card">
                <h3>Essence reward</h3>
                <p className="wiki-formula">floor((level + floor(kills / 10)) × modifier multiplier × victory multiplier)</p>
                <p>At level 20 with 100 kills, 1.2× modifiers, and a victory: <strong>{essenceExample.projectedReward} essence</strong>.</p>
              </section>
            </div>
          </article>

          <article id="floors" className="wiki-article">
            <WikiSectionHeading id="floors" title="Floors, encounters, and scaling">
              The First Depths starts with {DEFAULT_DUNGEON_CONFIG.defaultMaxFloor} normal floors of {DEFAULT_DUNGEON_CONFIG.floorDurationSeconds} seconds each before its final encounter.
            </WikiSectionHeading>
            <SourceChart label="Ordinary enemy HP multiplier by selected floor" points={FLOOR_SCALING_CHART_POINTS} suffix="×" />
            <div className="wiki-card-grid">
              <section className="wiki-card">
                <h3>Scaling formula</h3>
                <p>Ordinary enemy scaling adds {formatWikiPercentage(DEFAULT_DUNGEON_CONFIG.ordinaryEnemyStatScalingPerFloor)} per floor before floor 5, {18}% thereafter, then applies the configured tiny exponential factor.</p>
              </section>
              <section className="wiki-card">
                <h3>Threat</h3>
                <p className="wiki-formula">base threat/sec + threat growth/min × elapsed minutes</p>
                <p>At 120 seconds: <strong>{formatNumber(calculateThreatPerSecond(120))} threat/sec</strong>. Elites begin at {SPAWN_BALANCE.eliteStartTimeSeconds}s with a {formatWikiPercentage(SPAWN_BALANCE.eliteChance)} base chance.</p>
              </section>
              <section className="wiki-card">
                <h3>Contracts</h3>
                <p>{DEFAULT_DUNGEON_CONFIG.maximumFloorContracts.map((contract) => `${contract.maxFloor} floors`).join(' · ')}</p>
              </section>
            </div>
            <h3 className="wiki-subheading">Difficulty profile samples</h3>
            <WikiTable columns={['Floor', 'HP', 'Contact damage', 'Threat', 'Elite modifier maximum']} rows={[1, 5, 10, 20, 50, 100].map((floor) => {
              const profile = getFloorDifficultyProfile(floor)
              return [floor, `${formatNumber(profile.ordinaryEnemyHpMultiplier)}×`, `${formatNumber(profile.ordinaryEnemyContactDamageMultiplier)}×`, `${formatNumber(profile.spawnThreatMultiplier)}×`, profile.maxEliteModifierCount]
            })} />
          </article>

          <article id="enemies" className="wiki-article">
            <WikiSectionHeading id="enemies" title="Enemies, abilities, and elites">
              Enemy definitions provide their base combat values; floor scaling, modifiers, and encounters apply afterward.
            </WikiSectionHeading>
            <WikiTable columns={['Enemy', 'HP', 'Speed', 'Contact', 'XP', 'Gear', 'Behavior']} rows={Object.values(ENEMY_DEFINITIONS).map((enemy) => [
              <strong id={`enemy-${enemy.id}`} key={enemy.id}>{enemy.name}</strong>,
              enemy.maxHp,
              enemy.speed,
              enemy.contactDamage,
              enemy.xpReward,
              formatWikiPercentage(enemy.gearDropChance),
              enemy.behavior.kind,
            ])} />
            <h3 className="wiki-subheading">Enemy abilities</h3>
            <WikiTable columns={['Ability', 'Owner', 'Type', 'Damage', 'Cooldown', 'Telegraph']} rows={Object.values(ENEMY_ABILITY_DEFINITIONS).map((ability) => [
              ability.name,
              <a key={ability.id} href={`#enemy-${ability.enemyDefinitionId}`}>{ENEMY_DEFINITIONS[ability.enemyDefinitionId]?.name ?? ability.enemyDefinitionId}</a>,
              ability.kind,
              `${ability.damage} ${ability.damageType}`,
              `${ability.cooldown}s`,
              `${ability.telegraphDuration}s`,
            ])} />
            <h3 className="wiki-subheading">Elite modifiers</h3>
            <div className="wiki-card-grid">
              {ELITE_MODIFIERS.map((modifier) => (
                <section className="wiki-card" key={modifier.id} style={{ '--wiki-accent': modifier.markerColor } as CSSProperties}>
                  <h3>{modifier.name}</h3>
                  <p className="wiki-stat-line">HP <strong>{modifier.maxHpMultiplier}×</strong> · Speed <strong>{modifier.speedMultiplier}×</strong> · XP <strong>{modifier.xpRewardMultiplier}×</strong></p>
                  <p>{getEliteModifierWikiDescription(modifier)}</p>
                </section>
              ))}
            </div>
          </article>

          <article id="world-modifiers" className="wiki-article">
            <WikiSectionHeading id="world-modifiers" title="World modifiers">
              World modifiers raise difficulty and add their reward contributions linearly above a 1× base.
            </WikiSectionHeading>
            <WikiTable columns={['Modifier', 'Difficulty', 'Essence multiplier', 'Effect']} rows={Object.values(WORLD_MODIFIER_DEFINITIONS).map((modifier) => [
              modifier.name,
              modifier.difficulty,
              `${modifier.essenceRewardMultiplier}×`,
              modifier.description,
            ])} />
          </article>

          <article id="glossary" className="wiki-article">
            <WikiSectionHeading id="glossary" title="Glossary">
              Highlighted terms throughout the codex reveal these definitions on hover or keyboard focus.
            </WikiSectionHeading>
            <div className="wiki-glossary">
              {Object.values(KEYWORD_DEFINITIONS).map((definition) => (
                <section id={`glossary-${definition.id}`} className="wiki-card" key={definition.id}>
                  <h3><KeywordTerm keywordId={definition.id} value={definition.label} glossaryHref={`#glossary-${definition.id}`} /></h3>
                  <p>{definition.summary}</p>
                  <p className="wiki-muted">{definition.details}</p>
                  <a href="#combat">See combat reference</a>
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
