# Marketplace

## Purpose

A player market moves items between players. It never creates them. It is the
system most likely to make a small game feel like a living one, and it is also
the system most likely to break the rest of the economy, so it ships in two
stages rather than one.

This document supersedes the single "trading and marketplace" step in
[implementation_plan.md](implementation_plan.md). The ownership, binding, and
salvage rules in [artifacts.md](artifacts.md) still apply unchanged.

## Why a free player market does not go first

Three reasons specific to this game.

**The game plays itself.** An autoplay run loop combined with an idle Camp is
trivially farmable by a script or by a handful of alternate accounts. Without a
market, that farming produces items the farmer can only use. With a market, it
produces value the farmer can concentrate. Assume automation will be attempted,
because the entire premise of the game is that playing it is automatic.

**A thin market reads as a dead game.** Player listings need enough concurrent
sellers to keep the board full. An empty search result is a worse first
impression than no market at all.

**A market short-circuits the systems it touches.** If the best bait is
purchasable, fishing stops being a progression and becomes a price check. Every
listing category quietly removes a reason to play the system that produces it.

## Stage 1: the consignment shop

**Shipped.** The quartermaster is a screen on the refuge, reached from the hub
dock and the header. It sells from a short daily shelf and buys anything it has
a price band for. There is no player-to-player transfer.

- Selling pays a content-defined price per unit for that item definition. Per
  instance adjustment by rarity and roll quality is not implemented: the shop
  deals in supplies, which are the same whoever caught them, and fish keep the
  existing salvage route rather than gaining a second, differently-priced way
  to become Essence.
- The shop offers a daily rotating stock drawn from weighted pools, in limited
  quantities, so visiting has a reason and stock has scarcity. The shelf is
  rolled per player, seeded from the account and the date, so nobody loses a
  purchase to someone else's timing and nobody can reroll the day by
  refreshing.
- A band's `stock_weight` of zero means the shop buys the item but never sells
  it. Scrap is that case: a shop that sold scrap back would let a player
  launder Essence into materials and undo the reason to run a dungeon.
- Prices are bands rather than fixed numbers so that later stages can move them
  without a schema change.
- Everything the shop buys is destroyed. Everything it sells is created. The
  shop is a faucet and a sink, and both sides are tuned deliberately.

Stage 1 is worth shipping on its own merits. It gives unwanted items a floor
price, gives materials a purchase route when a player is short of one input,
and produces the price and volume data needed to tune stage 2. It carries no
duplication risk and offers no payoff to a bot beyond what farming already
gives.

## Stage 2: player listings

Open player-to-player listings only when all of these hold.

- Inventory grants, consumption, and binding have been reliable in production
  for a meaningful period.
- Consignment volume data exists for every tradeable category.
- Concurrent population is high enough that a listing board looks populated.

Then:

- Listings cover fish, roe, materials, bait, rods, and unbound artifacts.
- Equipping an artifact binds it, as [artifacts.md](artifacts.md) already
  requires. Bound items never return to the market.
- Champions, Essence itself, account unlocks, contract progress, and collection
  progress are never tradeable.
- A purchase is atomic. Concurrent attempts on one listing produce exactly one
  winner, and a failed transaction leaves both parties consistent.
- Every transfer writes an auditable record with both account IDs, the item
  instance ID, and the price.

## Currency

Listings are priced in Essence. Essence is still never gifted, granted, or
transferred outside a completed market transaction, and account unlocks remain
purchasable only with it.

Using the existing currency instead of inventing a trade currency is safe here
only because of the rule in [economy.md](economy.md) that Essence buys access
rather than power. A player who becomes wealthy through trade unlocks content
sooner. They do not become stronger in a run. If that rule is ever broken, and
Essence starts buying a combat statistic, this decision has to be revisited
before it is exploited.

The shop's sink is the spread. It buys below what it sells for, so a round trip
always loses, and the difference is destroyed rather than held. Stage two adds a
listing fee and a sale tax in the same spirit, because a listing board has no
spread of its own to take.

## Abuse controls

- Rate limits on listing creation, cancellation, and purchase.
- A minimum account age or a first-clear requirement before listing.
- Per-account daily caps on the total value sold, tuned from stage 1 data.
- Price-band guards that flag or block listings far outside observed prices, to
  make value transfer between colluding accounts visible.
- Alerting on the concentration of any single item definition in one account.

None of these stop a determined farmer. They make farming slower than playing,
which is the achievable goal.

## Design constraints

- The market creates no items and no Essence. Every listed item already exists
  with a unique instance ID.
- All ownership checks, transfers, and refunds are server-authoritative and
  atomic. The client never asserts ownership or price.
- Purchase, cancellation, and expiry are idempotent under retry.
- Expired listings return the item to the seller, never to the void.
- The market is never the best source of any item. Every tradeable item keeps a
  reachable non-market source.
- A player who never opens the market can still complete every system.
