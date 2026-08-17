# Technical Risks

Source: GDD §29. Keep this list in view when planning each phase.

## Ability Chain Correctness (highest risk)

Mitigation: Resolution Queue, no uncontrolled recursion, deterministic chain tests.

## Animation / Logic Ordering

Duplicate cards must be visible before Shipwreck resolves.
Mitigation: animation acknowledgment, timeout fallback.

## UI State Drift

DOM must never become authoritative.
Mitigation: read-only UI, `gameManager` actions only, centralized `GameState`.

## RTL

RTL must not be retrofitted as a superficial visual layer.
Mitigation: CSS logical properties from the UI phase onward.

## Web / Unity Parity

JS and C# can behave differently around typing and async operations.
Mitigation: shared data schemas, shared deterministic scenarios, cross-platform regression testing.

## Lost Loot Exhaustion

Map and Chest + Key may interact with an empty Lost Loot.
Mitigation: graceful no-op/degrade behavior, explicit tests.

## Art-Direction Drift

Outsourced/AI-generated assets may accidentally introduce forbidden cultural references.
Mitigation: asset checklist, explicit pirate-only art direction in every art-related phase.
