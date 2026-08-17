# Module Map

Source: GDD §18.2. One responsibility per file — gameplay mutations only ever
happen through `gameManager.js`'s public API (GDD §6.1).

| Module | Responsibility | Implemented in |
|---|---|---|
| `gameManager.js` | Thin orchestrator and public gameplay API | Phase 2 |
| `gameState.js` | Owns `GameState` and controlled mutators | Phase 2 |
| `cardManager.js` | Card instances and card-related operations | Phase 2 |
| `deckManager.js` | Treasure Deck and Lost Loot | Phase 3 |
| `turnManager.js` | Drives state-machine transitions | Phase 4 |
| `abilityManager.js` | Registers ability handlers by ability key | Phase 9 |
| `abilityResolver.js` | Executes ability contexts and the Resolution Queue | Phase 9 |
| `collectManager.js` | Return to Ship | Phase 7 |
| `burnManager.js` | Shipwreck | Phase 6 |
| `scoreManager.js` | Scoring | Phase 8 |
| `playerManager.js` | Player and AI-related logic | Phase 19 |
| `uiManager.js` | DOM rendering only (read-only) | Phase 12 |
| `modalManager.js` | Selection and targeting UI | Phase 14 |
| `localizationManager.js` | Localization and direction handling | Phase 15 |
| `audioManager.js` | Audio event handling | Phase 18 |
| `animationManager.js` | Gameplay animation coordination | Phase 17 |
| `saveManager.js` | `GameState` serialization/restoration | Phase 20 |
| `logger.js` | Tagged diagnostic logging | Phase 0 (done) |

## Data flow

```
User input
  → uiManager.js (reads event, no logic)
  → gameManager.js (public API)
  → turnManager.js / abilityResolver.js / collectManager.js / burnManager.js
  → gameState.js (controlled mutation)
  → event emitted
  → uiManager.js / animationManager.js / audioManager.js react
```

`gameState.js` is the only module allowed to mutate `GameState`. Every other
system reads it through selectors and requests changes through
`gameManager.js`. See GDD §6.1.
