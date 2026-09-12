# Held-page navigation

## Context

Every navigation in the application shell blanked the page twice before the
destination was usable. `navigateToScreen` in `App.tsx` pushed history and set
the screen synchronously, so the previous screen unmounted on the next render.
The route's Suspense fallback ("The shop is loading…") took its place while the
chunk downloaded, on the first visit to each screen per session. The real
screen then mounted in `loadState: 'loading'`, rendered a second placeholder
("Loading inventory…"), and only then began its fetch. Music and the shell's
background class were keyed on the screen, so the hub's playlist stopped and
the fishing sky appeared while the page was still a grey panel. A first visit
to the shop was hub, grey panel, empty shop, shop: the player asked for one
thing and watched three pages.

## Decision

**A navigation is a request, not a state change.** `app/useScreenNavigator.ts`
keeps two pieces of state: the committed screen, which is what renders, plays
music and dresses the shell, and the pending request. The committed screen
advances only when the destination can paint completely, meaning its chunk has
arrived and its first fetch has settled, the two fetched in parallel. History
is written at that commit, not at the click, which is what makes a superseded
or cancelled navigation possible; Back and Forward go through the same
navigator with history left alone. A request still pending after ten seconds
is committed regardless and falls back to the screen's own loading states,
which is the old behaviour, reached only when the network is genuinely
struggling. A loader that rejects commits too, with the error attached, so the
screen shows its own error panel rather than the hub showing nothing.

**Input is frozen and the page is dimmed while a destination loads.** The
shell gets `inert`, which takes the pointer and the keyboard away from the
held page, and a veil dims it. Nothing is visible for the first 150 ms: a warm
chunk with cached data lands inside that, and a veil that flashed on every
click would read as a page that stutters. Past 150 ms the veil, a thin ember
line under the header and the pressed control's glow appear together. The
header is excluded from the dim and from the dissolve, so it reads as a fixed
frame the page changes inside. The plan this came from proposed keeping the
held page interactive with a latest-wins rule; the frozen page was chosen
instead as the simpler thing to explain, and the navigator keeps latest-wins
underneath for the navigations the player does not start, such as a popstate
or the active-run route guard.

**Screens declare what they wait on.** `app/screenDefinitions.ts` is the
registry: a label, the chunk, and for the screens with a first fetch, a
loader. Loaders (`shop/loadShopScreen.ts` and the like) live beside their
screen, import service types only, and never the screen component, because a
static import there would pull the screen back into the entry chunk and
silently defeat the route split, the same failure ADR 0011 forbids for feature
barrels. An architecture test enforces it. A loader's result reaches the screen
as `initialData`, and the screen starts in `loadState: 'ready'` and skips its
mount-time fetch; `ui/useSeededLoad.ts` decides that from the service identity
rather than a flag, so StrictMode's double-run of effects does not fetch twice.
A screen rendered without `initialData` behaves exactly as before, which is
what the timeout path and every direct render in a test rely on. The Essence
store and the two admin dashboards are gated on state `App` already owns, and
`App` runs those fetches itself before committing.

**Chunks are shared, and warmed before they are asked for.**
`app/lazyScreens.ts` no longer uses `React.lazy`, which starts its own import
on first render and suspends even when the module is already cached, costing
exactly the flash this decision removes. Each screen module holds one import
promise, tagged with the status fields React's `use()` reads, so a screen whose
chunk has landed renders synchronously and one whose chunk is still in flight
suspends into the same `LazyScreen` fallback as before. Chunks are warmed on
intent (hover, focus and pointer-down on hub tiles and header links), on idle
once the hub has painted (run preparation, Champions, inventory, the routes the
hub sends players to most), and the renderer chunk is warmed when run
preparation mounts. Warming costs bandwidth only; data is never fetched ahead
of a click.

**The swap is a view transition.** `app/screenTransition.ts` wraps the commit
in `document.startViewTransition` with `flushSync`, and
`styles/screen-transitions.css` draws a 240 ms cross-dissolve on the easing the
fishing cast already uses. Entering the dungeon is the one heavier transition,
because it is a threshold rather than a menu: the preparation screen goes down
through near-black over 420 ms and the floor is revealed over 300 ms, with the
darkness standing in for the ember line. Where the API is missing the swap is
an instant cut. Under `prefers-reduced-motion` every transition is a 120 ms
opacity fade, the pressed tile is lit rather than pulsing, and the ember line
stands still; the timing rules are unchanged.

## Consequences

The "X is loading…" panel and the screens' own first-load placeholders are
gone from normal use. Music and background switch with the picture. A second
visit to a screen usually settles inside the 150 ms window and reads as an
instant cut with a dissolve.

Adding a screen now means an entry in `app/screenDefinitions.ts` as well as
`app/routing.ts`, and if the screen has a first fetch, a loader beside it and
an `initialData` prop. A screen with no loader gets the chunk hold alone,
which is still the larger half of the improvement.

The held page is unresponsive for as long as the destination takes to load,
which on a slow network is the price of never showing a half-page; the ten
second timeout is the bound on that price and is one constant. The results
screen and the hub are resident and take the standard dissolve; the hub's
presence, leaderboard and camp panels keep refreshing in place, because they
are live widgets and never the reason the page appeared. The boot sequence
(the "Loading saved run settings…" panel and the sign-in gate) is unchanged
and could be routed through the same commit later.
