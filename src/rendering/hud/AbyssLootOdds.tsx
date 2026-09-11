import type { GameUiSnapshot } from '../../game'
import { RARITIES, RARITY_VISUALS } from '../../content/rarity/Rarity'
import { getAbyssLootBoxRarityChances } from '../../loot/LootBoxes'
import { LootBoxIcon } from '../../loot/LootBoxIcon'

/**
 * What the floor is worth, read before it is finished.
 *
 * Every completed Abyss floor pays one loot box, and the box's rarity is drawn
 * from a curve that steepens with the floor. The curve was only knowable from
 * the box that arrived, so the decision the mode is built on — push one floor
 * deeper or take the boxes already banked — was made blind. The odds for the
 * floor in play sit in the top-right corner beside the run controls, one chest
 * per rarity with its chance, so the trade is visible while it is being made.
 *
 * The danger score is not a factor: it moves the roll, not the bands, so the
 * panel is a function of the floor number alone and reads the same for the
 * whole floor. Every 10th floor promises at least an epic box, and the panel
 * says so the same way: the three lesser chests drop to nothing and dim.
 */
function formatLootBoxChance(chance: number): string {
  const percent = chance * 100
  if (percent === 0 || percent >= 10) {
    return `${Math.round(percent)}%`
  }
  // Below ten percent a whole number would round the deep-floor legendary
  // chance to zero, and a chance shown as zero is worse than none at all.
  return `${percent.toFixed(percent >= 1 ? 1 : 2)}%`
}

export function AbyssLootOddsPanel({ snapshot }: { snapshot: GameUiSnapshot }) {
  if (snapshot.modeId !== 'infinite-abyss') {
    return null
  }
  const chances = getAbyssLootBoxRarityChances(snapshot.floor)
  return (
    <section
      className="abyss-loot-odds hud-panel"
      aria-label={`Floor ${snapshot.floor} loot box odds`}
    >
      <span className="abyss-loot-odds-heading">
        Floor {snapshot.floor} box
      </span>
      <ul className="abyss-loot-odds-list">
        {RARITIES.map((rarity) => {
          const label = RARITY_VISUALS[rarity].label
          const chance = formatLootBoxChance(chances[rarity])
          return (
            <li
              className="abyss-loot-odds-item"
              data-rarity={rarity}
              data-impossible={chances[rarity] === 0 ? 'true' : undefined}
              key={rarity}
              title={`${label} loot box: ${chance}`}
            >
              <span className="abyss-loot-odds-icon">
                <LootBoxIcon rarity={rarity} />
              </span>
              <span className="abyss-loot-odds-chance">
                <span className="visually-hidden">{label} </span>
                {chance}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
