import type { BuildPlan } from '../game/builds/BuildPlans'
import { BuildPlannerPanel } from '../rendering/hud/BuildPlanner'

/**
 * The build plans, as a page of their own.
 *
 * The planner also sits on the run setup screen and behind the Build tab of a
 * run, but both are places a player passes through on the way to something
 * else. This is where plans are made at leisure: reached from the refuge,
 * with nothing to start and nothing ticking.
 */
export interface BuildPlansScreenProps {
  plans: readonly BuildPlan[]
  selectedPlanId: string | null
  writeError: string | null
  onSelectPlan: (planId: string | null) => void
  onSavePlan: (plan: BuildPlan) => void
  onDeletePlan: (planId: string) => void
  onBack: () => void
}

export function BuildPlansScreen({
  plans,
  selectedPlanId,
  writeError,
  onSelectPlan,
  onSavePlan,
  onDeletePlan,
  onBack,
}: BuildPlansScreenProps) {
  return (
    <section className="app-screen build-plans-screen" aria-labelledby="build-plans-title">
      <div className="app-screen-topbar">
        <button className="app-screen-back" type="button" onClick={onBack}>
          ← Back to the refuge
        </button>
      </div>
      <div className="app-screen-title">
        <p className="screen-kicker">The drawing board</p>
        <h2 id="build-plans-title">Build plans</h2>
        <p className="app-screen-lede">
          Plan the skills, upgrades, evolutions and synergies you are aiming for. The plan you
          follow marks its cards on every level-up, and a run can switch to another plan from
          its Build tab. Each skill holds one synergy at a time; the planner keeps to that.
        </p>
      </div>
      {writeError ? <p className="persistence-error" role="alert">{writeError}</p> : null}
      <div className="app-screen-frame build-plans-frame">
        <BuildPlannerPanel
          plans={plans}
          selectedPlanId={selectedPlanId}
          onSelectPlan={onSelectPlan}
          onSavePlan={onSavePlan}
          onDeletePlan={onDeletePlan}
          variant="setup"
        />
      </div>
    </section>
  )
}
