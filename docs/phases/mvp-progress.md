# MVP Prompt Progress

وضعیت اجرای Promptهای [`../prompts/`](../prompts/README.md). هر ردیف بعد از
تکمیل و سبز شدن تست‌های مربوطه به‌روزرسانی می‌شود.

| Prompt | فاز | وضعیت | نسخه |
|---|---|---|---|
| 001 — Data Architecture | 1 | ✅ Done — 60 card model generated + validated (`tests/unit/deck-model.test.js`, 9/9 pass) | 0.5.0 |
| 002 — Game State | 2 | ✅ Done — `gameState.js` + `cardManager.js` implemented (`tests/unit/game-state.test.js` 9/9, `tests/unit/card-manager.test.js` 8/8 pass) | 0.6.0 |
| 003 — Deck System | 3 | ✅ Done — `deckManager.js` implemented (`tests/unit/deck-manager.test.js` 15/15 pass) | 0.7.0 |
| 004 — Turn System | 4 | ✅ Done — `turnManager.js` state machine implemented (`tests/integration/full-loop-stub.test.js` 9/9 pass) | 0.8.0 |
| 005 — Push-Your-Luck Core | 5 | ⏳ Not started | — |
| 006 — Duplicate / Shipwreck | 6 | ⏳ Not started | — |
| 007 — Collection | 7 | ⏳ Not started | — |
| 008 — Scoring | 8 | ⏳ Not started | — |
| 009 — Ability Framework | 9 | ⏳ Not started | — |
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
