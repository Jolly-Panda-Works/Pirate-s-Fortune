# Changelog

Format follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
Starts at `0.0.0` (empty repo). Bumped on every change:

- **MAJOR** — breaking changes to data schemas or the public gameplay API (`gameManager.js`). Stays `0` until Phase 23 (Web Release).
- **MINOR** — new files/systems/docs added, backward compatible.
- **PATCH** — fixes or edits to existing files, no new systems.

## [0.14.0] - Prompt 010: Single-Resolution Abilities

### Added
- `js/abilities/compass.js` (GDD §14.1): peeks `treasureDeck[0]` and
  stores it in `GameState.abilityContext` (`{ ability: 'compass',
  playerId, peekedInstanceId, peekedDefId }`). "The exact previewed card
  becomes the next draw, never a replacement" is satisfied structurally —
  the handler only ever reads the deck's top, never mutates it.
- `js/abilities/cannon.js` (GDD §14.2): destroys one eligible rival Ship
  Cargo card, relocating it to Lost Loot (no dedicated "destroyed" zone
  exists; Lost Loot is the existing zone meaning "no longer under any
  player's control"). Reads `context.targetPlayer`/`context.targetCardId`
  since real target-selection UI doesn't land until Prompt 014; missing,
  self-targeted, or nonexistent targets all no-op rather than throwing.
- `js/abilities/captainShield.js` (GDD §14.3): activates a new,
  expedition-scoped `gameState.shieldActive` flag — UNLESS this Shield is
  the very first card of the expedition (that documented edge case grants
  no protection at all).
- `js/abilities/index.js`: side-effect-only loader (imports the three
  ability modules so they self-register) — imported once by
  `turnManager.js` so every game entry point gets abilities wired up
  automatically.
- `js/gameState.js`: new `shieldActive` field, `getShieldActive()`
  selector, `setShieldActive()` mutator. `clearExpeditionArea()` now also
  resets `shieldActive` to `false`, since Shield's protection is scoped to
  exactly one expedition by definition (GDD §14.3's own wording) and every
  expedition-ending event (Shipwreck or Return to Ship) already calls
  `clearExpeditionArea()`.
- `js/burnManager.js`: new `absorbDuplicateWithShield(duplicateCard)` —
  removes ONLY the triggering duplicate card into Lost Loot (unlike
  `triggerShipwreck()`, the rest of the expedition survives) and consumes
  the shield flag.
- `tests/integration/single-resolution-abilities.test.js` — 12 tests:
  ability-registration check against `gameConfig.json`'s
  `abilities.singleResolution` list; Gold Coin's null ability as an
  end-to-end no-op; Compass's peek/no-replace/Return-to-Ship guarantees
  (3 tests); Cannon's destroy + all three no-op eligibility paths (4
  tests, one fully end-to-end through `turnManager` with no target
  supplied); and all three documented Captain Shield edge cases plus a
  full "absorbs once, then grants no further protection" scenario (3
  tests).

### Changed
- `js/turnManager.js`: `checkDuplicate()` gained one new branch — when a
  duplicate occurs while `gameState.getShieldActive()` is true AND the
  duplicate is not itself another Captain Shield (checked here by ability
  key, so `burnManager.js` stays exactly as ability-agnostic as before),
  the duplicate is absorbed via `burnManager.absorbDuplicateWithShield()`
  instead of a full Shipwreck, then flow goes straight to
  `playerDecision()` — never `resolveAbility()` — so "a duplicate's own
  ability never executes" still holds exactly as strictly for an absorbed
  card as for a normally Shipwrecked one. Also now imports
  `./abilities/index.js` for its registration side effects.

## [0.13.0] - Prompt 009: Ability Framework

### Added
- `js/abilityManager.js` fully implemented (GDD §12): a minimal registry —
  `registerAbility(key, handlerFn)` / `getAbility(key)` / `hasAbility(key)`
  / `resetRegistry()` (test isolation only). Registering a duplicate key,
  a non-function handler, or an empty key all throw rather than silently
  misbehaving. `getAbility(null | undefined)` returns `null` — the
  legitimate "no ability" case (Gold Coin), not an error.
- `js/abilityResolver.js` fully implemented (GDD §12.1/§13): `buildContext()`
  fills in every AbilityContext field (`source, currentPlayer,
  targetPlayer, reason, isForced, isGenerated, parentAbility`) with a safe
  default; `resolveAbility(cardDefinition, context)` seeds a Resolution
  Queue with one context and drains it iteratively. Handlers receive
  `(context, enqueue)` — `enqueue()` is how a chain ability (Sea Serpent
  generating another Sea Serpent, etc. — concrete versions arrive Prompt
  010b) extends the SAME queue; `resolveAbility()` never calls itself
  anywhere in its body, which is what structurally guarantees no
  uncontrolled recursion (rule 10) rather than a depth counter someone
  could forget to check.
- `tests/unit/ability-resolver.test.js` — 10 tests: `abilityManager`
  register/lookup round-trip, null/unregistered-key no-ops, duplicate/
  invalid registration throwing; `abilityResolver` null-ability and
  unregistered-key no-ops; a mock chain ability proving iterative (never
  recursive) processing via a call-depth counter that never exceeds 1
  across a 2-hop and a 4-hop chain; and a context-shape check against the
  GDD §12.1 AbilityContext fields.

### Changed
- `js/turnManager.js`: `resolveAbility()` (the `RESOLVE_ABILITY` state
  step) no longer no-ops — it resolves `expeditionCard`'s definition via
  `cardManager.getDefinition()` and calls
  `abilityResolver.resolveAbility(definition, { currentPlayer, reason:
  'reveal' })`. No concrete ability handlers are registered yet (Prompt
  010/010b), so every card in `data/cards.json` (whether it has a real
  ability key or `null`) currently resolves as an explicit, logged no-op.

## [0.12.0] - Prompt 008: Scoring

### Added
- `js/scoreManager.js` fully implemented (GDD §11/§11.1): pure,
  stateless — `calculateScore(player, cardDefinitions)` sums only the
  highest card value per distinct type in a player's Ship Cargo;
  `determineWinner(players)` picks the highest score, falls back to the
  most total cargo cards on a tie, and returns every tied player if that's
  ALSO tied (no invented tiebreaker beyond the GDD).
- `js/gameState.js`: new `results` GameState field + `getResults()`
  selector / `setResults()` mutator (emits `RESULTS_SET`), following the
  same clone-on-read/clone-on-write discipline as every other
  selector/mutator here.
- `tests/unit/score-manager.test.js` — 9 tests: highest-per-type-only
  scoring (including an empty-cargo and a single-card edge case), the
  cargo-count tiebreaker, a genuine unresolved tie (equal score AND equal
  cargo count), an empty-players no-op, and a full deterministic
  2-player game driven end-to-end via `gameManager` (scripted Return to
  Ship decisions, Treasure Deck forced empty on schedule) asserting the
  exact expected winner derived from the cards the game actually drew,
  plus `GameState.results` being `null` before `SCORING`.

### Changed
- `js/turnManager.js`: `scoring()` is no longer a terminal stub — it now
  calls `scoreManager.calculateScore()` per player (writing each score
  back via `gameState.updatePlayer()`), then
  `scoreManager.determineWinner()`, then `gameState.setResults()`.
- `js/gameManager.js`: re-exports `getResults()` alongside the other
  read-only selectors.

## [0.11.0] - Prompt 007: Collection

### Added
- `js/collectManager.js` fully implemented (GDD §10): `returnToShip(playerId,
  cardDefinitions)` moves every card in the Expedition Area into that
  player's Ship Cargo, merges it with cargo already secured on earlier
  turns, and re-sorts the FULL merged cargo lowest-to-highest by value
  (tie-break by type) before clearing the Expedition Area. Aftermath only —
  mirrors `burnManager.js`'s split for Shipwreck; never touches
  `turnHistory` or turn advancement.
- `tests/unit/collect-manager.test.js` — 5 tests: single-expedition sort
  order, equal-value tie-break by type, cargo staying correctly sorted and
  undiminished across multiple returns spanning multiple turns (no
  duplication, no loss), cargo never mixing between players, and an
  unknown player id throwing.

### Changed
- `js/turnManager.js`: `returnToShip()` now delegates to
  `collectManager.returnToShip()` instead of the Prompt 005 inline/unsorted
  stub. Call sites in `playerDecision()`/`gameManager.returnToShip()` were
  unaffected.

## [0.8.0] - Prompt 004: Turn System

### Added
- `js/turnManager.js` fully implemented: the explicit GDD §7 state
  machine, one named function per state
  (`startGame, playerTurnStart, drawCard, revealCard, checkDuplicate,
  shipwreck, resolveAbility, playerDecision, returnToShip, endTurn,
  gameEnd, scoring`), driving every transition through `gameState.js`'s
  mutators only. Round-robin player order uses
  `gameState.setCurrentPlayerIndex()` exclusively.
- Prompt 004 scope: `CHECK_DUPLICATE` always resolves "safe"
  (`detectDuplicate()` stub returns `false`; real logic in Prompt 006's
  `burnManager.js`), `PLAYER_DECISION` always auto-resolves "Return to
  Ship" (real externally-drivable decision arrives in Prompt 005's
  `gameManager.js`), and `RESOLVE_ABILITY`/`SHIPWRECK`/`RETURN_TO_SHIP`
  are no-op/minimal passthroughs per the prompt's explicit scope.
- `tests/integration/full-loop-stub.test.js` — 9 tests: full stub games
  for 2, 3, and 4 players complete end-to-end to `SCORING` with the
  Treasure Deck exhausted and no runtime errors; exactly 50 turns
  recorded; strict round-robin order; every player gets a turn;
  turn-history correctness; determinism across repeated runs with the
  same seeds; zero-player guard.

## [0.7.0] - Prompt 003: Deck System

### Added
- `js/deckManager.js` fully implemented:
  - `seededShuffle(array, seed)` — dependency-free mulberry32-based seeded
    Fisher-Yates shuffle; deterministic with a seed (string or number),
    falls back to `Math.random` when no seed is given; never mutates its
    input.
  - `buildInitialDecks(cardDefinitions, config, options)` — pure function
    deriving the initial Treasure Deck (50 cards) and Lost Loot (10 cards)
    per GDD §5.2/§5.3, using `gameConfig.initialLostLoot.cardIds` as the
    single checked source rather than re-deriving the rule by hand;
    shuffles both independently.
  - `initializeDecks(cardDefinitions, config, options)` — builds and wires
    the result into `gameState` via `setTreasureDeck`/`setLostLoot` only.
  - `drawFromTreasureDeck()` — pops the top card via gameState's
    selector/mutator, returns `null` (never throws) once the deck is
    empty.
- `tests/unit/deck-manager.test.js` — 15 tests covering shuffle
  determinism, GDD §5.2 Lost Loot compliance, exact deck sizes, gameState
  wiring, draw ordering, and empty-deck draw safety.

## [0.6.0] - Prompt 002: Game State

### Added
- `js/gameState.js` fully implemented: module-private `GameState` object
  matching GDD §6 exactly (`phase, treasureDeck, lostLoot, expeditionArea,
  players[], currentPlayerIndex, turnHistory, abilityContext, config`).
  Selectors return deep copies (never a live reference); a full set of
  named mutators is the only way to change state; an internal `on/off`
  pub/sub emits an event after every single mutation (GDD §6.1), including
  a `'*'` wildcard subscription.
- `js/cardManager.js` fully implemented: `createCardInstance`,
  `createInstancesFromDefinitions`, `moveInstance` (returns a new,
  non-mutated copy), `getDefinition` — all operating on `defId` only, per
  rule 4. Zones use the GDD §4.2 vocabulary (`deck | lostLoot | expedition
  | cargo`).
- `tests/unit/game-state.test.js` — 9 tests: initial state shape,
  mutable-reference leakage (arrays, single player object, full snapshot),
  every mutator emits its event, listener unsubscribe.
- `tests/unit/card-manager.test.js` — 8 tests against the real
  `data/cards.json` deck model: instance shape, zone validation, unique
  instanceIds, immutable `moveInstance`, `getDefinition` lookup.

### Scope notes
- No other `js/` module was wired in this prompt — `gameState.js` and
  `cardManager.js` only import `logger.js`, per the Prompt 002 exit
  criteria.

## [0.5.0] - Prompt 001: Data Architecture

### Added
- `data/cards.json`: full 60-card model, generated programmatically —
  Gold Coin (values 4-9, 6 cards, no ability) + 9 other types (values 2-7,
  6 cards each, one ability key each). Types: Compass, Cannon, Captain
  Shield, Pirate Dagger, Lucky Anchor, Sea Serpent, Treasure Map, Treasure
  Chest, Golden Key (the last two share the `treasureChestGoldenKey`
  ability key per GDD §14.8).
- `tests/unit/deck-model.test.js` — 9 assertions validating the deck model
  against GDD §5 and cross-checking cards.json against gameConfig.json
  (card counts, value ranges, no duplicate ids, every ability key
  declared, initial Lost Loot derivation, deck totals). All passing.
- `docs/phases/mvp-progress.md` — tracks completion status of every
  roadmap prompt.

### Changed
- `data/gameConfig.json`: added `deck.otherTypes.typeKeys` (the 9 type
  keys) and `initialLostLoot.cardIds` (the exact 10 derived card ids) so
  later phases reference a checked source instead of re-deriving GDD §5.2's
  rule by hand.
- `package.json`: `test` script now runs the real suite via Node's
  built-in test runner (`node --test`, no external dependency added, per
  development rule 12) instead of the Phase-0 placeholder.

## [0.4.0] - Card abilities moved into core gameplay scope

### Changed
- Card abilities are core gameplay, not a deferred/optional layer (user
  instruction). Phase 10b (Pirate Dagger, Lucky Anchor, Sea Serpent,
  Treasure Map, Treasure Chest+Golden Key) is no longer "post-MVP" — it's
  merged into Stage A alongside Phase 10a, before any UI work.
- `docs/phases/mvp-roadmap.md`: Stage A now covers all 8 abilities; only
  Phase 24 (Unity Port) remains outside this roadmap.
- `docs/prompts/stage-a-core-engine.md`: split old "Prompt 010 — MVP
  Abilities" into `Prompt 010` (single-resolution: Compass, Cannon,
  Captain Shield) and new `Prompt 010b` (chain abilities: Dagger, Anchor,
  Sea Serpent, Map, Chest+Key). `Prompt 011` is now full-scope ability
  chain integration testing (all 8), not an MVP-trimmed subset.
- `docs/prompts/stage-b-minimal-ui.md` (Prompt 014), `stage-c-bilingual.md`
  (Prompt 016), `stage-d-feel-and-release.md` (Prompts 018, 021, 023):
  updated to cover targeting/localization/animation/polish for all 8
  abilities instead of the 3 originally-MVP ones.
- `data/gameConfig.json`: replaced `mvpAbilities`/`postMvpAbilities` with
  `abilities.singleResolution` / `abilities.chain` — the split now reflects
  the Resolution Queue implementation detail, not build/release order.

## [0.3.0] - MVP roadmap & implementation prompts

### Added
- `docs/phases/mvp-roadmap.md` — GDD's 25 phases regrouped into 4 build
  stages (Core Engine → Minimal UI → Bilingual/Responsive → Feel/Release),
  reordered so gameplay is complete and tested before any UI work, per
  project instruction ("gameplay first, then everything else").
- `docs/prompts/` — 23 self-contained implementation prompts (one per GDD
  phase in MVP scope), each with target files, constraints, and exit
  criteria: `stage-a-core-engine.md`, `stage-b-minimal-ui.md`,
  `stage-c-bilingual.md`, `stage-d-feel-and-release.md`, plus an index
  README.
- README.md — new "MVP roadmap" section linking the above.

### Scope notes
- Post-MVP abilities (Phase 10b) and the Unity port (Phase 24) are
  explicitly excluded from this roadmap, per GDD §15's MVP definition.

## [0.2.0] - Phase 0 (foundation, standards pass)

### Added
- `data/iconMap.json` + `js/iconManager.js` — data-driven icon resolution
  system. Ships with emoji today; swapping to real artwork later requires
  editing data only (`iconMap.json` image paths + `gameConfig.assets.iconMode`),
  never code.
- `gameConfig.json` → `assets.iconMode` config key.
- `docs/design/ui-ux-inspiration.md` — reference games for UI/UX decisions
  (Incan Gold/Diamant, Balatro, Slay the Spire, Hearthstone).
- `docs/architecture/data-driven-design.md` — data files inventory and the
  icon-swap system explained.
- `CHANGELOG.md` (this file).

## [0.1.0] - Phase 0 (foundation, initial scaffold)

### Added
- Full repository structure per GDD §18.1 (`css/`, `js/`, `data/`, `assets/`, `docs/`, `tests/`).
- `index.html` shell with `#app-root` / `#modal-root` mount points.
- CSS stub files (main, layout, cards, modal, responsive, animations).
- All 17 JS system module stubs per GDD §18.2, each documenting its
  responsibility and target implementation phase.
- `js/logger.js` — fully implemented tagged diagnostic logger.
- `js/main.js` — boot entry point.
- `data/cards.json` (empty, per GDD §34), `data/gameConfig.json`,
  `data/localization.json` (en/fa).
- `docs/` skeleton: GDD copy, roadmap, module map, development rules,
  technical risks, testing strategy, decisions/open-questions.
- `README.md`, `package.json`, `.gitignore`.

## [0.0.0]

Empty repository / project not yet started.
