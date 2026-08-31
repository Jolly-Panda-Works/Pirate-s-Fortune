# MVP Prompt Progress

وضعیت اجرای Promptهای [`../prompts/`](../prompts/README.md). هر ردیف بعد از
تکمیل و سبز شدن تست‌های مربوطه به‌روزرسانی می‌شود.

| Prompt | فاز | وضعیت | نسخه |
|---|---|---|---|
| 001 — Data Architecture | 1 | ✅ Done — 60 card model generated + validated (`tests/unit/deck-model.test.js`, 9/9 pass) | 0.5.0 |
| 002 — Game State | 2 | ✅ Done — `gameState.js` + `cardManager.js` implemented (`tests/unit/game-state.test.js` 9/9, `tests/unit/card-manager.test.js` 8/8 pass) | 0.6.0 |
| 003 — Deck System | 3 | ✅ Done — `deckManager.js` implemented (`tests/unit/deck-manager.test.js` 15/15 pass) | 0.7.0 |
| 004 — Turn System | 4 | ✅ Done — `turnManager.js` state machine implemented (`tests/integration/full-loop-stub.test.js` 9/9 pass) | 0.8.0 |
| 005 — Push-Your-Luck Core | 5 | ✅ Done — `gameManager.js` implemented; `turnManager.js` PLAYER_DECISION now externally drivable (`tests/integration/explore-vs-return.test.js` 8/8, `tests/integration/full-loop-stub.test.js` 9/9 pass) | 0.9.0 |
| 006 — Duplicate / Shipwreck | 6 | ✅ Done — `burnManager.js` implemented; `turnManager.js` CHECK_DUPLICATE/SHIPWRECK wired to it (`tests/integration/shipwreck.test.js` 4/4 pass, full suite 62/62) | 0.10.0 |
| 007 — Collection | 7 | ✅ Done — `collectManager.js` implemented; `turnManager.js` RETURN_TO_SHIP delegates to it (`tests/unit/collect-manager.test.js` 5/5, full suite 67/67) | 0.11.0 |
| 008 — Scoring | 8 | ✅ Done — `scoreManager.js` implemented; `turnManager.js` SCORING wired to it (`tests/unit/score-manager.test.js` 9/9, full suite 76/76) | 0.12.0 |
| 009 — Ability Framework | 9 | ✅ Done — `abilityManager.js` + `abilityResolver.js` implemented; `turnManager.js` RESOLVE_ABILITY wired (`tests/unit/ability-resolver.test.js` 10/10, full suite 86/86) | 0.13.0 |
| 010 — Single-Resolution Abilities | 10a | ⏳ Not started | — |
| 010b — Chain Abilities | 10b | ⏳ Not started | — |
| 011 — Full Ability Chain Integration Tests | 11 | ⏳ Not started | — |
| 012 — UI (Board Rendering) | 12 | ⏳ Not started | — |
| 013 — Card Interaction | 13 | ⏳ Not started | — |
| 014 — Modal System | 14 | ⏳ Not started | — |
| 015 — AI | 19 | ⏳ Not started | — |
| 016 — Localization | 15 | ⏳ Not started | — |
| 017 — Responsive / Landscape UI | 16 | ⏳ Not started | — |
| 018 — Animations | 17 | ⏳ Not started | — |
| 019 — Audio | 18 | ⏳ Not started | — |
| 020 — Save System | 20 | ⏳ Not started | — |
| 021 — Polish | 21 | ⏳ Not started | — |
| 022 — Testing (Regression Suite) | 22 | ⏳ Not started | — |
| 023 — Web Release | 23 | ⏳ Not started | — |

## Notes on Prompt 009

- `js/abilityManager.js`: a bare `Map`-backed registry, deliberately with
  no `gameState.js` dependency — same "pure helper layer" posture as
  `cardManager.js`/`scoreManager.js`. `registerAbility()` throws on a
  duplicate key rather than silently overwriting, since a collision is
  almost certainly a copy-paste bug in a future ability module, not
  intentional. `getAbility(null | undefined)` explicitly returns `null`
  (not throwing, not warning) since a null ability key is a fully
  legitimate, common case — every Gold Coin, forever.
- `js/abilityResolver.js`: `resolveAbility(cardDefinition, context)` seeds
  a local `queue` array with one `buildContext()`-normalized entry and
  drains it with a plain `while (queue.length > 0)` loop — nothing calls
  `resolveAbility` from inside `resolveAbility`, anywhere, so the
  "no recursion" rule (GDD §13, rule 10) is a structural property of the
  code, not a convention. The `enqueue` closure handlers receive as their
  second argument pushes onto that exact same array, which is what lets a
  future chain ability (Sea Serpent generating another Sea Serpent,
  Prompt 010b) extend resolution without the resolver ever recursing.
  `source` on an `AbilityContext` is a card DEFINITION (not a
  `CardInstance`) specifically so `abilityResolver.js` never needs to
  import `cardManager.js`/know about `defId` — resolving `defId ->
  definition` stays the caller's job (currently `turnManager.js`, via
  `cardManager.getDefinition()`), keeping `abilityResolver.js` a pure
  orchestration layer over `abilityManager.js`'s registry.
- `js/turnManager.js`: `resolveAbility()` (the `RESOLVE_ABILITY` state
  step, previously a Prompt 004-era stub noted in Prompt 006) now looks up
  `expeditionCard`'s definition via `cardManager.getDefinition()` (reusing
  `gameCardDefinitions`, the same module-private snapshot
  `burnManager.isDuplicate()` and `collectManager.returnToShip()` already
  rely on) and calls `abilityResolver.resolveAbility()` with `reason:
  'reveal'` — matching GDD §12.1's documented reason values. No concrete
  ability handler modules exist yet (`js/abilities/*.js` arrive in Prompt
  010/010b), so every real ability key already present in
  `data/cards.json` (`compass`, `cannon`, `captainShield`, `pirateDagger`,
  `luckyAnchor`, `seaSerpent`, `treasureMap`, `treasureChestGoldenKey`)
  currently resolves as an explicit, logged "no handler registered"
  no-op — never a thrown error, never silently skipped without a trace.
- `tests/unit/ability-resolver.test.js` — 10 tests, split across
  `abilityManager` (register/lookup round-trip, null/unregistered-key
  no-ops, duplicate-key/invalid-handler/empty-key all throwing) and
  `abilityResolver` (Gold-Coin-shaped null-ability no-op; an unregistered
  key no-op; a 2-hop mock chain ability proving the call-depth counter
  never exceeds 1 — i.e. genuinely iterative, not recursive — while still
  invoking the handler exactly twice and enqueuing exactly one follow-up;
  a 4-hop fan-out variant proving the same property holds for a longer
  chain; and a context-shape check confirming every GDD §12.1
  `AbilityContext` field is present with the documented default).
- Existing tests needed no changes: `shipwreck.test.js`'s
  `RESOLVE_ABILITY` phase-transition spy still fires exactly the same
  number of times (it only counts the phase transition, not what happens
  inside it), and every full-game integration test (`full-loop-stub`,
  `explore-vs-return`, `score-manager`) still completes cleanly — the new
  "no handler registered" warnings are logged, not thrown. Full suite:
  86/86 passing (up from 76/76 before this prompt: +10 for
  `ability-resolver.test.js`).

## Notes on Prompt 008

- `js/scoreManager.js`: implemented per GDD §11/§11.1 as two pure,
  stateless functions (no `gameState.js` import at all, unlike most other
  managers — it only ever operates on the Player objects/definitions it's
  handed):
  - `calculateScore(player, cardDefinitions)`: walks `player.shipCargo`,
    resolves each `CardInstance`'s definition via
    `cardManager.getDefinition()`, and keeps a running best-value-per-type
    map — the final score is the sum of that map's values. An unknown
    `defId` is logged and skipped rather than thrown (mirrors
    `burnManager`'s general "degrade, don't corrupt" posture for
    malformed input), and an empty cargo correctly scores 0.
  - `determineWinner(players)`: expects `.score` already populated on each
    player (by a prior `calculateScore()` call — kept as two functions
    per the prompt rather than one combined "score and rank" function,
    so each is independently unit-testable). Filters to the max-score
    player(s); if more than one, filters further to the max-cargo-count
    player(s) among those; returns whatever's left — length 1 in the
    common case, length > 1 only for a genuine, fully unresolved tie
    (GDD §11.1 doesn't specify anything beyond cargo count, so nothing
    further is invented).
- `js/gameState.js`: added the `results` field to `createInitialState()`
  (so `getStateSnapshot()`/`initState()`/`resetState()` all handle it for
  free, no special-casing needed) plus a `getResults()` selector and a
  `setResults()` mutator — the same clone-in/clone-out pattern as every
  other field, emitting `RESULTS_SET`.
- `js/turnManager.js`: `scoring()` (previously a Prompt 006-era terminal
  stub) now does the real work: reads all players, calls
  `scoreManager.calculateScore()` for each (using `gameCardDefinitions`,
  the same module-private snapshot `burnManager.isDuplicate()` and
  `collectManager.returnToShip()` already rely on), writes each score
  back via `gameState.updatePlayer(id, { score })`, re-reads the
  now-scored players, calls `scoreManager.determineWinner()`, and stores
  `{ scores, winners }` via `gameState.setResults()`. `js/gameManager.js`
  re-exports `getResults()` alongside its other selectors so callers never
  need to import `gameState.js` directly.
- `tests/unit/score-manager.test.js` — 9 tests. Three pure
  `calculateScore()` checks (highest-per-type-only via a 5-card mixed-type
  cargo, an empty cargo, a single card); four pure `determineWinner()`
  checks (outright winner, cargo-count tiebreaker, a genuine unresolved
  tie among 2 of 3 players, an empty `players` array); and two
  integration checks driven entirely through `gameManager` on a real
  (seeded) deck — a full 2-player game where each player returns to ship
  with exactly the one card the game actually dealt them (read back at
  runtime, not hand-guessed), the Treasure Deck is forced empty right
  before p2's return so `endTurn()` routes to `GAME_END -> SCORING`
  immediately, and the resulting `GameState.results` (and each player's
  `.score`) is asserted against the exact values those specific cards
  carried; plus confirming `results` stays `null` before `SCORING` is
  reached.
- No existing test file needed changes — `results` defaults to `null` and
  nothing before this prompt asserted anything about it. Full suite:
  76/76 passing (up from 67/67 before this prompt: +9 for
  `score-manager.test.js`).

## Notes on Prompt 007

- `js/collectManager.js`: implemented per GDD §10 — one function,
  `returnToShip(playerId, cardDefinitions)`, isolated as the aftermath-only
  counterpart to `burnManager.triggerShipwreck()`:
  - Moves every card currently in the Expedition Area into `playerId`'s
    Ship Cargo (`cardManager.moveInstance` → zone `cargo`, owner →
    `playerId`).
  - Merges those newly-secured cards with whatever cargo the player
    already had from earlier turns, then re-sorts the FULL merged array —
    not just the new cards — lowest-to-highest by `value`, tie-broken by
    `type` (`compareForCargo()`, exported alongside `returnToShip()` so it
    can be unit-tested directly if needed). This guarantees cargo stays
    correctly ordered across many turns, not just sorted once per return.
  - Does not touch `turnHistory` and does not end the turn — same
    ownership split as `burnManager.js`: `turnManager.js` still records
    the `'return'` `turnHistory` entry and calls `endTurn()`.
  - Throws if `playerId` doesn't match any player in `GameState.players`,
    rather than silently no-op'ing.
- `js/turnManager.js`:
  - `returnToShip()` now calls `collectManager.returnToShip(current.id,
    gameCardDefinitions)` instead of the Prompt 005 inline/unsorted stub
    that moved cards into cargo and appended without sorting. The call
    sites in `playerDecision()` and `gameManager.returnToShip()` did not
    need to change — this was a pure body swap, per the prompt's own note
    that Prompt 007 "replaces this function's body" without touching call
    sites.
  - `gameCardDefinitions` (the module-private snapshot `startGame()` keeps
    for the lifetime of the game, originally added in Prompt 006 for
    `burnManager.isDuplicate()`) is now also read by `returnToShip()`, for
    the same reason: CardInstances only store `defId`, never `value`/
    `type` directly, so something has to supply the definitions cargo
    sorting needs.
- `tests/unit/collect-manager.test.js` — 5 tests, all operating directly
  on `collectManager.js` + `gameState.js` (no `turnManager`/`gameManager`
  involved, since sorting is a pure aftermath concern): a single
  expedition sorts lowest-to-highest by value; two same-value, different-
  type cards tie-break alphabetically by type; a two-turn scenario proves
  cargo secured on an earlier turn survives untouched (same `instanceId`)
  and the full merged cargo re-sorts correctly after a second return (not
  just the newly-added cards); two players' cargo never mix; an unknown
  `playerId` throws instead of silently corrupting state.
- Existing tests (`explore-vs-return.test.js`, `shipwreck.test.js`,
  `full-loop-stub.test.js`) needed no changes — none of them asserted
  cargo *ordering* against the old inline stub, only counts and id sets,
  so switching to sorted cargo via `collectManager.js` is a
  backward-compatible behavior change. Full suite: 67/67 passing (up from
  62/62 before this prompt: +5 for `collect-manager.test.js`).

## Notes on Prompt 006

- `js/burnManager.js`: implemented per GDD §8 Step 3 / §9 — two pure/
  side-effect-isolated functions:
  - `isDuplicate(candidateCard, expeditionArea, cardDefinitions)`: looks up
    each CardInstance's definition via `cardManager.getDefinition()` and
    compares `type` (GDD §8 says "type/symbol" — verified every
    definition's `symbol` mirrors its `type` in the current 60-card data,
    so comparing `type` alone is equivalent). Never compares a card to
    itself. No side effects.
  - `triggerShipwreck()`: the aftermath ONLY — moves every card currently
    in the Expedition Area to Lost Loot (via `cardManager.moveInstance`)
    and clears the Expedition Area. Does not decide duplicate-ness and
    does not touch turnHistory/turn advancement (turnManager.js owns
    both).
- `js/turnManager.js`:
  - `checkDuplicate()` now calls `burnManager.isDuplicate()` for real,
    replacing the old always-false stub.
  - `shipwreck()` now calls `burnManager.triggerShipwreck()` and records a
    turnHistory entry (`decision: 'shipwreck', cardsLost`) — mirroring
    `returnToShip()`'s entry, so every completed turn (safe or not) has
    exactly one turnHistory entry. This was a necessary addition beyond
    the prompt's literal text: without it, round-robin/turn-accounting
    tests silently broke once real Shipwrecks started occurring.
  - The duplicate's ability never executes because `shipwreck()` is
    reached directly from `checkDuplicate()`, never from
    `resolveAbility()` — the call graph itself is the guarantee (rule 6/7
    in development-rules.md), not a flag checked inside ability
    resolution.
  - `startGame()` now retains the card definitions it was given in a new
    module-private `gameCardDefinitions` variable for the lifetime of the
    game, since `burnManager.isDuplicate()` needs to resolve each
    CardInstance's `type` by `defId`, and CardInstances never store their
    full definition.
- Turning on real duplicate detection meant several Prompt 004/005 tests
  that used to pass "by luck" (since the old stub never actually detected
  a duplicate) needed fixing: `full-loop-stub.test.js`'s card-conservation
  check now accounts for cards lost to Lost Loot, not just cargo +
  Expedition Area; its round-robin/every-player assertions now rely on
  every turn (return OR shipwreck) producing exactly one turnHistory
  entry; and `explore-vs-return.test.js`'s multi-card explore sequences
  now prime the front of the live Treasure Deck with cards of
  guaranteed-distinct types (`primeSafeDraws()`) so they deterministically
  exercise the "no Shipwreck" path they're testing, rather than depending
  on a fixed seed never happening to produce a duplicate.
- `tests/integration/shipwreck.test.js` — 4 tests: `burnManager.isDuplicate()`
  unit checks (true on shared type, false on distinct types, never
  compares a card to itself), plus one full integration scenario building
  a deterministic 3rd-card-duplicates-1st-card's-type deck (via directly
  overriding `gameState`'s live Treasure Deck after reading back what the
  seed actually drew for card 1) asserting: Shipwreck triggers; the
  duplicate's ability never executes (a spy counting RESOLVE_ABILITY phase
  transitions, snapshotted at the exact moment `EXPEDITION_AREA_CLEARED`
  fires — proven explicitly, not inferred); Lost Loot grows by exactly the
  3 cards that were in the Expedition Area; the Expedition Area is empty
  at that instant; a `'shipwreck'` turnHistory entry is recorded with no
  player decision; and the turn correctly advances to the next player.

## Notes on Prompt 005

- `js/gameManager.js`: implemented as the thin public gameplay API (GDD
  §6.1/§18.2) — `startGame()` (passthrough to turnManager), `revealNextCard()`
  and `returnToShip()` (the two human decision actions), plus every
  `gameState.js` selector re-exported read-only, and `on`/`off` for event
  subscription. This is now the only module meant to be imported for
  gameplay actions — UI/tests should never need to reach into
  `turnManager.js` or `gameState.js`'s mutators directly.
- `revealNextCard()`/`returnToShip()` both guard via
  `assertAwaitingHumanDecision()`: they throw unless `GameState.phase` is
  `PLAYER_DECISION` AND the current player is human — calling them with no
  pending decision, or during an AI's turn, throws instead of silently
  corrupting state.
- `js/turnManager.js`'s `playerDecision()` is now real: AI players
  (`current.isAI === true`) resolve immediately via a placeholder threshold
  function `aiDecision()` (explore while Expedition Area size < 4, else
  return — GDD §15 MVP AI; the real AI lands in Prompt 015). Human players
  cause `playerDecision()` to return without continuing the call chain —
  the state machine sits at `PLAYER_DECISION` until `gameManager.
  revealNextCard()`/`returnToShip()` resume it externally by re-entering
  `turnManager.drawCard()`/`turnManager.returnToShip()`. This is the
  "resumable/awaitable step, not a blocking loop" the prompt called for —
  no async/await, no polling; the JS call stack itself is the pause point.
- `js/turnManager.js`'s `returnToShip()` now moves every Expedition Area
  card into the current player's Ship Cargo inline (via
  `cardManager.moveInstance` → zone `cargo`, owner → current player) before
  clearing the Expedition Area — previously (Prompt 004) it only cleared
  the Expedition Area with no cargo movement. This inline version is
  intentionally unsorted; `collectManager.js` (Prompt 007) replaces this
  function's body with the real, sorted implementation without touching
  any call site.
- `tests/integration/explore-vs-return.test.js` — 8 tests: opening-turn
  pause for a human player; `revealNextCard()` growing the Expedition Area
  one card at a time; `returnToShip()` moving cards into Ship Cargo
  (zone/owner correctly set, no duplication/loss) and clearing the
  Expedition Area, with the turn correctly advancing to the next player;
  a full explore-then-return round trip; both actions throwing with no
  decision pending; an AI player's entire turn resolving with zero
  external calls; and a game starting on an AI player completing that
  AI's opening turn before `startGame()` even returns.
- `tests/integration/full-loop-stub.test.js` (originally Prompt 004)
  updated for Prompt 005's real `PLAYER_DECISION` behavior: switched to
  all-AI players so a genuinely unattended full game is still exercised
  (round-robin order, determinism, no thrown errors), and per-turn
  assertions that assumed the old "always return after exactly one card"
  stub (turn count fixed at 50, `cardsSecured` always 1) were relaxed to
  match the placeholder AI threshold's actual behavior (up to 4 cards
  explored per turn); a card-conservation check (cargo + remaining
  Expedition Area == 50) replaced the old "Expedition Area always empty at
  game end" assumption, since the Treasure Deck can now run out mid-explore
  for the last player to act.

## Notes on Prompt 004

- `js/turnManager.js`: the full GDD §7 state machine, one explicitly named
  function per state (`playerTurnStart, drawCard, revealCard,
  checkDuplicate, shipwreck, resolveAbility, playerDecision, returnToShip,
  endTurn, gameEnd, scoring`), called in sequence — never inlined into a
  branching blob — so a later prompt can swap a single function's body
  without touching the transition shape.
- Per Prompt 004 scope: `detectDuplicate()` always returns `false`
  (CHECK_DUPLICATE always resolves "safe" until burnManager.js, Prompt
  006), and `playerDecision()` always auto-resolves "Return to Ship"
  (until gameManager.js makes it externally drivable, Prompt 005).
  `resolveAbility`, `shipwreck`, and `returnToShip` are intentionally
  no-op/minimal passthroughs — `returnToShip` only clears the Expedition
  Area and logs a turn-history entry, no real cargo/collection logic yet
  (Prompt 007).
- Round-robin turn order is driven entirely through
  `gameState.setCurrentPlayerIndex()` — no local counter anywhere in the
  module.
- `startGame(cardDefinitions, config, players, deckOptions)` seeds
  GameState + decks (via `deckManager.initializeDecks`) and runs the
  entire stub loop synchronously to completion — safe at this phase since
  every step resolves deterministically with no external pause. Prompt
  005 will introduce the first async-drivable pause point at
  PLAYER_DECISION.
- `tests/integration/full-loop-stub.test.js` — 9 tests: full games for 2/3/4
  players reach `SCORING` with the Treasure Deck exhausted and no thrown
  errors; exactly 50 turns are recorded (one draw per turn under the
  stubbed decision); strict round-robin order; every player gets at least
  one turn; every turn-history entry records the stubbed `"return"`
  decision; identical turn history across two runs with the same seeds
  (determinism); `startGame` throws for zero players.

## Notes on Prompt 003

- `js/deckManager.js`: `buildInitialDecks(cardDefinitions, config, options)`
  is pure (no gameState side effects) — Lost Loot is selected via
  `gameConfig.initialLostLoot.cardIds` (the single checked source Prompt
  001 derived and validated), never by re-deriving the value-2/value-4
  rule by hand inside this module. The remainder becomes the Treasure
  Deck. Both are converted to `CardInstance`s via `cardManager` and
  shuffled independently with a seeded Fisher-Yates shuffle (mulberry32
  PRNG, no dependency) — `seededShuffle(array, seed)` is deterministic
  when a seed is given, falls back to `Math.random` for real games when
  omitted.
- `initializeDecks(cardDefinitions, config, options)` builds the decks and
  wires them into `gameState` via `setTreasureDeck`/`setLostLoot` only —
  the sanctioned way to seed a new game's decks.
- `drawFromTreasureDeck()` reads/writes only through gameState's
  selector/mutator (`getTreasureDeck`/`setTreasureDeck`), treats index 0
  as the "top" of the deck, and returns `null` (never throws) once empty
  — ready for turnManager (Phase 4) to use as the GAME_END trigger.
- `tests/unit/deck-manager.test.js` — 15 tests: seeded-shuffle
  determinism (string/numeric seeds, non-mutation, permutation
  correctness), Lost Loot rule compliance (GDD §5.2), exact 50-card
  Treasure Deck, independent-seed shuffling, gameState wiring, draw order,
  and empty-deck draw safety (including repeated draws after exhaustion).

## Notes on Prompt 002

- `js/gameState.js`: module-private `state` object matching the GDD §6
  shape exactly (`phase, treasureDeck, lostLoot, expeditionArea, players[],
  currentPlayerIndex, turnHistory, abilityContext, config`). Only selectors
  (deep-copy on every read, via JSON round-trip) and named mutators are
  exported — the raw object is never reachable from outside the module, so
  rule 5 (UI never mutates GameState directly) is structurally enforced,
  not just documented.
- Event system: a tiny internal `Map`-based pub/sub (`on/off/emit`), no
  external library and no browser `EventTarget` (rule 1/12). Every single
  mutator calls `emit()` exactly once after applying its change; a
  wildcard `'*'` subscription is supported for systems (or tests) that
  want to observe every mutation without naming each event type.
- `js/cardManager.js`: kept intentionally stateless/pure — it does not
  import or touch `gameState.js`. It only knows how to build a
  `CardInstance` (GDD §4.2: `defId, currentZone, ownerId, instanceId`) from
  a `cards.json` definition and how to derive a moved copy of one
  (`moveInstance` never mutates in place). Actual zone storage stays owned
  by `gameState.js`'s mutators, per the module-map's "one responsibility
  per file" rule.
- Zones use the GDD §4.2 vocabulary exactly: `deck | lostLoot | expedition
  | cargo` — validated, invalid zones throw rather than silently
  corrupting state.
- No other module in `js/` was wired in this prompt — only `logger.js` is
  imported by the two new files, matching the Prompt 002 exit criteria.

## Notes on Prompt 001

- `data/cards.json`: full 60-card model generated programmatically (not
  hand-typed) to guarantee correctness — 1 Gold Coin type (values 4-9, no
  ability) + 9 other types (values 2-7 each, one ability key each; Treasure
  Chest and Golden Key are two separate card types sharing the
  `treasureChestGoldenKey` ability key per GDD §14.8).
- `data/gameConfig.json`: added `deck.otherTypes.typeKeys` and
  `initialLostLoot.cardIds` (exact derived card ids), so later phases (deck
  shuffling, tests) reference a checked source instead of re-deriving the
  rule by hand.
- `npm test` is now wired to `node --test` (Node's built-in test runner —
  no external dependency added, per rule 12) with a glob over
  `tests/**/*.test.js`, matching the empty-directory fix needed for it to
  work with the Phase-0 `tests/` skeleton.
