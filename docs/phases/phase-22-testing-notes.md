# Phase 22 — Testing / Regression Suite Notes (Prompt 022)

GDD §25 deliverable: consolidate and extend the incrementally-built test
suite into a permanent regression suite, wire a real `npm test`, and run
the GDD §25.5 AI-simulation batch with a documented pass rate. Exit
criteria: `npm test` green; AI-simulation batch zero crashes/illegal
states across all runs.

---

## 1. `npm test` wiring

Already wired to Node's built-in test runner as of Phase 0
(`"test": "node --test --test-reporter=tap tests/**/*.test.js"` in
`package.json`) — not actually a placeholder by this point, so this
prompt's own job here was to verify it still covers every test
directory (`tests/unit/`, `tests/integration/`, `tests/scenarios/`) and
stays green, not to re-wire it. Confirmed: `npm test` picks up both new
files added this prompt with no config change.

## 2. Coverage audit against GDD §25's own checklist

Walked every category the prompt spec names and confirmed each is
covered by an existing file (no gaps found — this section is a record
of the audit, not a list of new work):

**`tests/unit/`**
- Sorting: `tests/unit/localization.test.js`, `collect-manager.test.js`,
  `deck-manager.test.js`, `deck-model.test.js`, `score-manager.test.js`.
- Score calculation: `tests/unit/score-manager.test.js`.
- Duplicate detection: `tests/unit/ability-resolver.test.js`,
  `deck-model.test.js` (+ integration coverage below).
- Seeded shuffle: `tests/unit/deck-manager.test.js` (determinism,
  non-mutation, permutation correctness).
- Localization symmetry: `tests/unit/localization.test.js` (every `en`
  key has an `fa` counterpart and vice versa).

**`tests/integration/`**
- Duplicate resolution: `single-resolution-abilities.test.js`,
  `ability-chains.test.js`, `chain-abilities.test.js`.
- Shipwreck: `shipwreck.test.js`.
- Ability chains: `ability-chains.test.js`, `chain-abilities.test.js`.
- Empty Lost Loot: `ability-chains.test.js`, `chain-abilities.test.js`
  (Treasure Map/Treasure Chest + Golden Key against an exhausted Lost
  Loot pool), re-verified under real UI conditions in Prompt 021.
- Empty Treasure Deck: `full-loop-stub.test.js`, `chain-abilities.test.js`
  (Sea Serpent forcing a reveal against an empty deck — graceful no-op),
  `tests/unit/deck-manager.test.js`, this prompt's own
  `tests/scenarios/ai-simulation.test.js` (every game ends this way).
- Multiplayer turns (round-robin, 2/3/4 players): `full-loop-stub.test.js`,
  `shipwreck.test.js`, `explore-vs-return.test.js`,
  `full-game-scenario.test.js`, and this prompt's own two new files.
- Save/restore: `save-restore.test.js` (Prompt 020).

**`tests/scenarios/`** — see §3, the actual new work this prompt adds.

## 3. New files this prompt adds

### `tests/scenarios/deterministic-full-game.test.js`

The prompt spec's own scenario requirement is narrower than what
`full-game-scenario.test.js` (Prompt 011) already proves: "known
GameState + known deck order, driven end to end, **exact final state
asserted**" — Prompt 011's file deliberately only asserts
internal-consistency invariants (card conservation, no duplicated
instanceId, stored score == recomputed score), not the actual pinned
numbers, since its own purpose was "correct no matter which cards come
up." The only pre-existing exact-final-state test
(`tests/unit/score-manager.test.js`) covers 2 players only, is
human-driven, and lives outside `tests/scenarios/`.

This new file adds one scripted, fully-AI, exact-final-state scenario
per player count (2/3/4 — GDD §16's full table-size range), each pinned
to a specific seed's actual final `GameState.results` (scores + winner)
captured from one real run, plus the same card-conservation/no-duplicate
checks Prompt 011's file uses as a belt-and-suspenders cross-check. This
works safely because AI decision-making has zero `Math.random` in its
path (`playerManager.js`, Prompt 015) — every seed reproduces bit-for-bit,
which is also what `full-game-scenario.test.js`'s own "two runs, same
seed" determinism test already guards structurally.

### `tests/scenarios/ai-simulation.test.js`

GDD §25.5's own AI-simulation batch. Runs `N` (env `AI_SIM_N`, default
100 — the GDD's stated MVP floor) full AI-vs-AI games cycling through
2/3/4 players with a distinct seed per game, asserting per-game:
reaches `SCORING`, Treasure Deck ends empty, all 60 cards conserved, no
duplicated `instanceId` across zones (state corruption), every stored
score matches an independent `scoreManager.calculateScore()`
recomputation, the recorded winner(s) hold the max score, and a
turn-count sanity bound (a tripwire against a hypothetical runaway
state-machine bug, not a tuned limit — real games stay well under it).
Failures accumulate across the whole batch rather than aborting on the
first one, so a single bad seed doesn't hide how many others also
failed. Log output is silenced (`logger.setLevel('ERROR')`, restored in
a `finally`) for the duration purely to keep `npm test`'s own output
readable at N=100 — doesn't change what's asserted.

## 4. Documented AI-simulation pass rate

Two batches run against the actual `js/` implementation as of this
prompt (`v0.27.0`):

| N | Result |
|---|---|
| 100 (`npm test`'s own default, GDD §25.5 MVP floor) | **100/100 passed, 0 crashes/illegal states/corruption** — 637ms |
| 1000 (ad hoc, `AI_SIM_N=1000`) | **1000/1000 passed, 0 crashes/illegal states/corruption** — 5.2s |

Both included in `npm test`'s default N=100 run going forward (fast
enough — well under a second — to run on every invocation, not just
ad hoc).

## 5. Full suite result

`npm test`: **219/219 passing** (215 pre-existing + 3 new deterministic
scenarios + 1 new AI-simulation batch test, the latter itself covering
100 individual games internally).

## Summary

- No coverage gaps found in the pre-existing `tests/unit/`/
  `tests/integration/` suite against GDD §25's checklist.
- `tests/scenarios/` gains the exact-final-state 2/3/4-player scripts
  and the N=100 (overridable) AI-simulation batch GDD §25.5 requires.
- `npm test` was already correctly wired; confirmed still green and
  now covers both new files with no config change.
- Exit criteria met: `npm test` green (219/219); AI-simulation batch
  zero crashes/illegal states at both N=100 and the larger N=1000 ad
  hoc check.
