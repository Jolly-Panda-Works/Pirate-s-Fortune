# Stage A — Core Gameplay Engine

هدف کلی این Stage: یک بازی کامل، بدون هیچ UI، فقط با تست/کنسول قابل اجرا و اثبات‌پذیر.
هیچ Prompt‌ای در این Stage نباید به DOM، CSS، یا مرورگر وابسته شود (GDD §2.4).

---

## Prompt 001 — Data Architecture

**Phase:** 1 · **Files:** `data/cards.json`, `data/gameConfig.json`

```
Populate data/cards.json with the full 60-card model defined in GDD §5:
- Gold Coin: values 4-9, 6 cards, no ability, ability key = null.
- 9 other types (choose thematic pirate names, e.g. Compass, Cannon,
  Pirate Dagger, Captain Shield, Sea Serpent, Lucky Anchor, Treasure Chest,
  Golden Key OR Treasure Chest+Golden Key as one type, Treasure Map — total
  9 types): values 2-7, one card per value, 6 cards per type = 54 cards.
- Every card object has: id, name, type, symbol, value, image (null for now,
  see docs/architecture/data-driven-design.md icon system — use iconKey
  instead of a literal path), ability (an ability key string or null).
- Do NOT hard-code any card name into logic anywhere in this task —
  cards.json is the only place names live.

Finalize data/gameConfig.json:
- Confirm deck/goldCoin/otherTypes numbers already present match the final
  card list exactly (60 total, 6+54).
- Add an "initialLostLoot.cards" derivation rule reference (GDD §5.2: nine
  value-2 cards, one per non-Gold-Coin type, plus one Gold Coin value-4).

Deliverable: valid JSON, no gameplay code. Add a tests/unit/deck-model.test.js
(or equivalent) that loads cards.json and asserts: 60 total cards, correct
per-type counts, correct value ranges, exactly one card per value per type.

Exit criteria: the deck-model test passes. cards.json is the single source
of truth for names/values/abilities.
```

---

## Prompt 002 — Game State

**Phase:** 2 · **Files:** `js/gameState.js`, `js/cardManager.js`

```
Implement js/gameState.js as the single source of truth (GDD §6):
- Internal, module-private state object matching the GameState shape in
  GDD §6: phase, treasureDeck, lostLoot, expeditionArea, players[],
  currentPlayerIndex, turnHistory, abilityContext, config.
- Export only controlled mutators and selectors — never the raw state
  object by reference. Selectors: getExpeditionArea(), getCurrentPlayer(),
  getPlayer(id), getPhase(), getConfig(), etc.
- Every mutation emits an event (simple pub/sub — a small internal
  EventTarget or callback-list is fine, no external library) so future UI/
  animation/audio systems can react without polling (GDD §6.1).
- No DOM, no browser APIs.

Implement js/cardManager.js:
- CardInstance shape per GDD §4.2: defId, currentZone, ownerId, runtime
  state (e.g. a unique instanceId).
- Functions to create instances from cards.json definitions, move an
  instance between zones (deck/lostLoot/expedition/cargo), and look up a
  definition by defId (used everywhere instead of hard-coded names).

Deliverable: both files fully implemented, importable as ES modules.
Add tests/unit/game-state.test.js covering: initial state shape, that
selectors never leak a mutable reference, that a mutation emits an event.

Exit criteria: tests pass; no other module in js/ is imported yet except
logger.js and cardManager.js.
```

---

## Prompt 003 — Deck System

**Phase:** 3 · **Files:** `js/deckManager.js`

```
Implement js/deckManager.js:
- buildInitialDecks(cardDefinitions, config) -> { treasureDeck, lostLoot }
  following GDD §5.2/§5.3 exactly: derive the 10-card initial Lost Loot
  (nine value-2 cards, one per non-Gold-Coin type, plus one Gold Coin
  value-4), remainder (50 cards) becomes the Treasure Deck.
- A seeded shuffle function — must accept an optional seed so tests are
  deterministic (GDD §25.3). Treasure Deck and Lost Loot are shuffled
  independently (GDD §5.3).
- drawFromTreasureDeck() -> CardInstance | null (null when empty, used to
  trigger GAME_END).
- Wire into gameState.js via its mutators only — deckManager never touches
  DOM, never imports uiManager.

Deliverable: js/deckManager.js implemented.
Add tests/unit/deck-manager.test.js: seeded shuffle is deterministic (same
seed -> same order), initial Lost Loot matches the §5.2 rule exactly,
initial Treasure Deck is exactly 50 cards, drawing from an empty deck
returns null without throwing.

Exit criteria: tests pass.
```

---

## Prompt 004 — Turn System

**Phase:** 4 · **Files:** `js/turnManager.js`

```
Implement js/turnManager.js as the explicit state machine from GDD §7:

GAME_INIT -> PLAYER_TURN_START -> DRAW_CARD -> REVEAL_CARD ->
CHECK_DUPLICATE -> (duplicate: SHIPWRECK -> END_TURN)
                 -> (safe: RESOLVE_ABILITY -> PLAYER_DECISION ->
                     (explore: DRAW_CARD) | (return: RETURN_TO_SHIP -> END_TURN))
END_TURN -> (deck empty? GAME_END : next player -> PLAYER_TURN_START)

Requirements:
- Every transition is explicit, loggable (via logger.js, tag "turnManager"),
  and deterministic — no hidden branching.
- For this phase, RESOLVE_ABILITY, SHIPWRECK, and RETURN_TO_SHIP can be
  no-op passthroughs (their real logic arrives in Prompts 006/007/009) —
  the state machine shape and transitions are what this prompt delivers.
- Round-robin turn order over players[], driven through gameState.js
  mutators only.
- A "no-ability loop" must be fully playable end-to-end at this point:
  draw -> reveal -> duplicate check (always "safe" until Prompt 006 lands)
  -> player always "returns to ship" (stubbed decision) -> end turn ->
  next player -> ... -> deck empty -> GAME_END.

Deliverable: js/turnManager.js implemented with the full state machine.
Add tests/integration/full-loop-stub.test.js: run a 2-player game with a
fixed deck order end-to-end (every card is "safe", every decision is
"return to ship") and assert it reaches GAME_END with the deck exhausted
and no runtime errors.

Exit criteria: the stub game completes for 2, 3, and 4 players without error.
```

---

## Prompt 005 — Push-Your-Luck Core

**Phase:** 5 · **Files:** `js/gameManager.js`, `js/turnManager.js`

```
Wire the real player decision into the loop (GDD §1.1, §2.2):
- js/gameManager.js: implement the public API mentioned in GDD §6.1 —
  revealNextCard(), returnToShip(), plus getters re-exported from
  gameState.js selectors. This is the ONLY module external callers
  (future UI) should import for gameplay actions.
- turnManager.js's PLAYER_DECISION step now calls out to gameManager's
  decision resolution instead of a stub — for a human player this means
  the state machine pauses at PLAYER_DECISION until revealNextCard() or
  returnToShip() is called externally (i.e., turnManager exposes a
  resumable/awaitable step, not a blocking loop).
- For AI players at this phase, a placeholder decision function is fine
  (real AI arrives in Prompt 015) — e.g. always explore until expedition
  size >= 4, matching the MVP AI threshold in GDD §15.

Deliverable: gameManager.js implemented; turnManager.js updated so
PLAYER_DECISION is externally drivable.
Add tests/integration/explore-vs-return.test.js: verify that calling
revealNextCard() repeatedly grows the Expedition Area, and returnToShip()
moves it to the current player's Ship Cargo and clears the Expedition Area.

Exit criteria: a human-driven sequence of revealNextCard()/returnToShip()
calls produces the expected GameState at every step.
```

---

## Prompt 006 — Duplicate / Shipwreck

**Phase:** 6 · **Files:** `js/burnManager.js`, `js/turnManager.js`

```
Implement the authoritative Card Resolution Order from GDD §8 exactly,
and js/burnManager.js for Shipwreck (GDD §9):

Step 1: card enters Expedition Area (no ability, no check yet).
Step 2: card is displayed (emit an event uiManager can later hook —
        even though no UI exists yet, the event must fire).
Step 3: duplicate check — compare new card's type/symbol against every
        other card currently in the Expedition Area.
  - Duplicate -> burnManager.triggerShipwreck(): duplicate's ability does
    NOT execute, ALL Expedition Area cards move to Lost Loot, Expedition
    Area clears, turn ends, no player decision occurs.
  - Not duplicate -> continue to ability resolution (stubbed until
    Prompt 009), then PLAYER_DECISION.

This ordering is a hard rule (GDD §9) — write it so step order cannot be
silently reordered by future changes (e.g. isolate each step as its own
named function called in sequence, not inlined).

Deliverable: burnManager.js implemented; turnManager.js updated to call it
at the correct point in CHECK_DUPLICATE.
Add tests/integration/shipwreck.test.js: construct a deterministic deck
where the 3rd card duplicates the 1st card's type; assert Shipwreck
triggers, the duplicate's own ability never executed (use a spy/counter),
Lost Loot grows by exactly the cards that were in the Expedition Area, and
Expedition Area is empty after.

Exit criteria: test passes; duplicate ability non-execution is explicitly
asserted, not just inferred.
```

---

## Prompt 007 — Collection

**Phase:** 7 · **Files:** `js/collectManager.js`

```
Implement js/collectManager.js for Return to Ship (GDD §10):
- returnToShip(playerId): move all Expedition Area cards to that player's
  Ship Cargo, sort Ship Cargo lowest-to-highest (by value, tie-break by
  type for stable ordering), clear Expedition Area, end turn.
- Replace the inline "return to ship" behavior stubbed in Prompt 005 with
  a call into this module — gameManager.returnToShip() should now delegate
  here instead of mutating gameState directly.

Deliverable: js/collectManager.js implemented.
Add tests/unit/collect-manager.test.js: cargo is sorted correctly after
multiple returns across multiple turns; cards already in cargo are
untouched by a later return (no duplication, no loss).

Exit criteria: test passes.
```

---

## Prompt 008 — Scoring

**Phase:** 8 · **Files:** `js/scoreManager.js`

```
Implement js/scoreManager.js per GDD §11:
- calculateScore(player): sum of the HIGHEST card value per type present
  in that player's Ship Cargo (only the highest per type counts, per
  GDD §11 — extra lower cards of an already-represented type don't add).
- determineWinner(players): highest score wins; tie -> the player with
  the most total cards in Ship Cargo wins (GDD §11.1); if still tied,
  return all tied players (do not invent an unspecified tiebreaker).
- Wire into turnManager.js: when GAME_END is reached (deck empty), call
  scoreManager and transition to a SCORING phase, then set final results
  on GameState.

Deliverable: js/scoreManager.js implemented; turnManager.js wired to it.
Add tests/unit/score-manager.test.js covering: highest-per-type-only
scoring, the cargo-count tiebreaker, and a genuine unresolved tie.

Exit criteria: test passes; a full deterministic 2-player game (fixed deck,
scripted decisions) run end-to-end produces the exact expected winner.
```

---

## Prompt 009 — Ability Framework

**Phase:** 9 · **Files:** `js/abilityManager.js`, `js/abilityResolver.js`

```
Implement the ability system per GDD §12/§13:
- js/abilityManager.js: a registry — registerAbility(key, handlerFn),
  getAbility(key). No conditional chains on card names anywhere (rule 4).
- js/abilityResolver.js: resolveAbility(card, context) looks up the
  handler via abilityManager and invokes it. AbilityContext shape per
  GDD §12.1: source, currentPlayer, targetPlayer, reason, isForced,
  isGenerated, parentAbility.
- Implement the Resolution Queue (GDD §13): an internal queue of
  AbilityContext, processed iteratively (while queue not empty: process
  next, append any generated actions to the queue). No recursive resolver
  calls — this is a hard rule (rule 10), enforce it structurally (the
  resolver function must not call itself).
- Wire into turnManager.js's RESOLVE_ABILITY step (currently stubbed since
  Prompt 004): after the duplicate check passes, call abilityResolver
  instead of skipping.
- Cards with no ability (ability key = null, e.g. Gold Coin) simply skip
  resolution — resolver must handle null gracefully.

Deliverable: both files implemented; turnManager.js RESOLVE_ABILITY wired.
No concrete abilities yet (Compass/Cannon/Shield arrive in Prompt 010) —
this prompt delivers the framework and must be testable with a fake/mock
ability.
Add tests/unit/ability-resolver.test.js: register a mock ability that
appends a generated context to the queue, verify it's processed without
recursion (e.g. via a call-depth counter that never exceeds 1), verify a
null-ability card resolves as a no-op.

Exit criteria: tests pass.
```

---

## Prompt 010 — MVP Abilities

**Phase:** 10a · **Files:** `js/abilityManager.js` registrations (new small
files are fine if it keeps things organized, e.g. `js/abilities/compass.js`,
`js/abilities/cannon.js`, `js/abilities/captainShield.js` — but each must be
registered through abilityManager, never referenced by name elsewhere)

```
Implement the three MVP abilities per GDD §14.1-14.3, each registered via
abilityManager.registerAbility(key, handler) — key must match the ability
value used in data/cards.json (Prompt 001), never a hard-coded name check
anywhere else.

Compass (§14.1): mandatory preview flow.
  COMPASS_REVEALED -> peek top card of Treasure Deck -> emit a "preview"
  event/state -> player chooses Return to Ship (top card stays exactly
  where it was, unremoved, turn ends) or Explore Further (the exact
  previewed card becomes the next draw — must not be replaced — then
  enters the normal resolution sequence from Step 1).

Cannon (§14.2): single-resolution targeted ability. Destroys one eligible
  rival card. No Resolution Queue chain. For this phase (no UI/modal yet),
  accept the target as a parameter to the handler (context.targetCardId)
  — real target-selection UI arrives in Prompt 014.

Captain Shield (§14.3): retroactive protection, single-resolution (not a
  chain). Edge cases to implement exactly: a Shield revealed as the first
  card protects nothing; a second Shield in the same expedition is still
  a normal duplicate; Shield does not grant general immunity to duplicate
  detection beyond its specific documented effect.

Deliverable: three ability handlers implemented and registered.
Add tests/integration/mvp-abilities.test.js covering all three, including
the Captain Shield edge cases listed above and the Compass "exact card,
not replaced" guarantee.

Exit criteria: tests pass; MVP ability list in gameConfig.json
(mvpAbilities: compass, cannon, captainShield) matches exactly what's
registered.
```

---

## Prompt 011 — Ability Chain Tests (MVP scope)

**Phase:** 11 (scoped to MVP abilities only — full chain testing for
post-MVP abilities like Sea Serpent/Dagger/Anchor is deferred with Phase
10b, outside this roadmap)

```
Add integration tests that exercise Compass/Cannon/Captain Shield inside
full game scenarios (not isolated unit calls):
- A full game where Compass is explored into (previewed card must be
  exactly the next reveal, verified end-to-end).
- A full game where Cannon destroys a rival's expedition card and the
  rival's subsequent state is correct.
- A full game where Captain Shield is the first card of an expedition
  (protects nothing) vs. a later card (protects as designed).
- Confirm the Resolution Queue from Prompt 009 handles these three
  abilities without ever recursing (reuse the call-depth assertion
  pattern from Prompt 009's tests).

Deliverable: tests/integration/ability-chains-mvp.test.js.

Exit criteria — Stage A complete when:
- A full, unscripted-decision-but-deterministic-deck 2-4 player game can
  run start to finish (tests/scenarios/) producing a correct winner.
- Every test file in tests/unit and tests/integration passes.
- No file in js/ imports anything DOM-related.
This is the point to bump the project version (MINOR — new gameplay
systems) and deliver a zip with commit message, per project standards.
```
