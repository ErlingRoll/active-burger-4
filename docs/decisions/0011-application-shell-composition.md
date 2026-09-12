# Application shell composition

## Context

`App.tsx` had grown to 3,426 lines around an 1,861-line `App()` component. It
constructed all eleven services in eleven near-identical `useMemo` blocks, each
re-reading the same environment variables and re-deriving the same Supabase
client accessor, and then prop-drilled the results: `GameDashboard` took
twenty-one props. It also held the routing table, every formatting helper, and
five screen components. None of it could be tested or read independently, and
the production build was a single 1,550 kB chunk, so a visitor at the sign-in
gate downloaded the admin tools, the wiki, and the whole renderer first.

## Decision

**Services are built once, behind context.** `services/AppServices.ts` creates
every service with a shared `handle()` helper, and `ServicesProvider` puts the
result on context. A service that cannot be constructed is `null` with its
reason attached rather than a throw, because a missing Supabase configuration
must still render a page that explains itself. Screens read what they need from
`useServices()` instead of receiving it as props.

**The shell is split by responsibility.** `app/routing.ts` owns the screen
union, the path table, and the music each screen plays, so the three cannot
drift apart. `app/appState.ts` owns the state shapes App shares with its
screens. `app/runFormatting.ts` owns the pure presentation helpers, which take
an explicit `now` where they read the clock. `app/screens/` holds the five
screen components. `App.tsx` is the orchestrator only.

**Routes are code-split.** `app/lazyScreens.ts` loads each screen on first use,
and `app/LazyScreen.tsx` gives every one a loading state and its own error
boundary. This has a rule attached: a feature barrel must not re-export a screen
component, because a static re-export anywhere pulls the module back into the
entry chunk and silently defeats the split. Vite reports this as
INEFFECTIVE_DYNAMIC_IMPORT; `fishing/index.ts`, `loot/index.ts`, and
`characters/index.ts` carry a comment saying so.

**Render errors are caught.** The application ships no telemetry by design, so
an uncaught render error previously produced a white page and no record of what
happened. `ui/ErrorBoundary.tsx` wraps the app at the root, the dungeon run
separately, and each lazy route, so a failure names itself, logs its component
stack, and offers a retry that re-mounts the subtree.

## Consequences

Adding a service is one entry rather than a copy of the boilerplate, and adding
a screen means registering it in `app/routing.ts` and `app/lazyScreens.ts` and
keeping it out of its feature barrel. The entry chunk fell from 1,550 kB to
636 kB, or 423 kB to 180 kB gzipped.

Extracting the routing table surfaced a bug the chain-of-comparisons form had
hidden: `/champions` had a path and a screen but no branch, so reloading on the
Champions screen resolved back to the dashboard. The lookup is now derived from
the path table itself.

## Addendum, 2026-09-13: the state moved out too

The screens had left `App.tsx`, but their state had not: by the Camp and the
contracts it held thirty-three pieces of state and fifty callbacks in one
component, and every feature added to it. The state now lives beside the
screens in `app/hooks/`, one hook per domain, each owning its state, its
effects and its actions and taking the few cross-domain values it needs as
parameters:

- `useAppNavigation`: the screen and `navigateToScreen`.
- `useAuthenticationState` and `useAuthenticationActions`: who is signed in,
  and the sign-in and sign-out actions. The two are split because signing out
  resets every other domain, so the actions are composed after the domains
  that need the account.
- `useAccountNickname`: the nickname and its first-sign-in prompt.
- `useLocalPersistence`: the IndexedDB settings and profile, and every write.
- `useMetaProgression` and `useEssencePurchases`: the wallet, its reloads,
  and the store's purchases.
- `useDungeonRun`: the run from the refuge to the results and back, including
  the run configuration, the checkpoints, the terminal save, the reward and
  the Champion a victory pays.
- `useAdminModeration`: the bug-report and nickname-moderation routes.

`App.tsx` composes them, holds routing's two effects, bug reports and the
sign-out reset that calls each domain's `reset()`, and renders the screen.
The move changed no behaviour: every callback kept its dependency list, the
effect count is the same ten, and the full suite held.
