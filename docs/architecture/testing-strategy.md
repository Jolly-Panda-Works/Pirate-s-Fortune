# Testing Strategy

Source: GDD §25. Testing is built around deterministic scripted scenarios.
Tests are authored alongside the features they validate (rule 19), not
retrofitted later.

Folder mapping in this repo:

- `tests/unit/` — pure functions: sorting, score calculation, duplicate
  detection, seeded shuffle.
- `tests/integration/` — full turn and full-game scenarios, especially
  duplicate resolution, Shipwreck, forced reveals, ability chains, empty
  Lost Loot, empty Treasure Deck, multiplayer turns.
- `tests/scenarios/` — deterministic deck tests: construct a known
  `GameState` + known deck order, drive the state machine deterministically,
  assert expected transitions and final state.

## Manual / visual tests (not automatable, tracked separately)

- Duplicate displayed before Shipwreck
- Animation ordering
- RTL layout
- Responsive breakpoints
- Orientation gate
- General UI presentation

## AI simulation (Phase 19+)

Multiple AI-vs-AI games simulated to catch: illegal moves, state corruption,
infinite loops, unexpected crashes, ability-chain failures.
