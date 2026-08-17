# Stage D — Feel & Release

پیش‌نیاز: Stage C تکمیل شده — بازی کامل، دوزبانه، ریسپانسیو، قابل‌بازی است.
این Stage بازی را از «قابل‌بازی» به «آماده‌ی انتشار» می‌رساند.

---

## Prompt 018 — Animations

**Phase:** 17 · **Files:** `js/animationManager.js`, `css/animations.css`

```
Implement js/animationManager.js coordinating presentation-layer motion,
strictly separate from game logic (GDD §22):
- Hard requirement (do not compromise on this): a duplicate card must be
  VISIBLY displayed before Shipwreck resolves. Implement this as an
  explicit acknowledgment step — burnManager/turnManager must await an
  "animation acknowledged" signal (or a timeout fallback, see below)
  before completing the Shipwreck transition, not just fire-and-forget a
  CSS class.
- Timeout/fallback strategy (GDD §22): if the animation layer fails to
  acknowledge within a reasonable timeout (e.g. 2s), proceed anyway —
  animation failure must never permanently deadlock the game.
- Cover at minimum: card reveal, Shipwreck, collection (Return to Ship),
  and each of the 8 abilities' trigger moments (Compass preview, Cannon
  destroy, Captain Shield protect, Pirate Dagger steal, Lucky Anchor
  replay, Sea Serpent forced-reveal chain, Treasure Map selection,
  Treasure Chest+Golden Key draw).
- css/animations.css holds the actual keyframes/transitions;
  animationManager.js only triggers/sequences them and listens for
  their completion (via `transitionend`/`animationend` or the timeout).

Deliverable: js/animationManager.js implemented; css/animations.css filled
in; burnManager/turnManager updated to await acknowledgment.

Exit criteria: manual playtest — a duplicate is always visibly shown
before the Shipwreck outcome appears, in every observed run; killing the
animation layer (e.g. via a debug flag) still lets the game reach a
correct result via the timeout fallback.
```

---

## Prompt 019 — Audio

**Phase:** 18 · **Files:** `js/audioManager.js`, `assets/audio/`

```
Implement js/audioManager.js:
- Event-driven playback tied to gameplay events from gameState.js (GDD
  §23): card reveal, Shipwreck, Return to Ship, ability trigger, special
  ability, game completion.
- Mute toggle (persisted — can use the same mechanism saveManager.js will
  use in Prompt 020, or a simple standalone persisted flag for now) that
  actually stops all playback, not just future sounds.
- Placeholder audio assets are acceptable for MVP (short, license-free
  clips) — note any placeholder asset that must be replaced before real
  release in a comment or a docs/design note.

Deliverable: js/audioManager.js implemented; at least placeholder assets
for the 6 event categories above in assets/audio/.

Exit criteria: manual playtest confirms each event category triggers its
sound exactly once per occurrence (no duplicate/missing triggers), and
mute fully silences playback.
```

---

## Prompt 020 — Save System

**Phase:** 20 · **Files:** `js/saveManager.js`

```
Implement js/saveManager.js per GDD §24:
- serialize(): produces a JSON-safe snapshot of the full GameState
  (via gameState.js selectors, never by reaching into internals).
- restore(snapshot): rebuilds GameState exactly from a snapshot.
- save() only at discrete safe states — end of a completed action
  (END_TURN, GAME_END), never mid-ability-chain or mid-Resolution-Queue
  (GDD §24) — gate this by checking turnManager's current state before
  allowing a save.
- Use localStorage for MVP web persistence (this is presentation-layer
  persistence, not gameplay logic, so it's fine here — contrast with the
  "never use localStorage in artifacts" rule elsewhere, which does not
  apply to this real project).

Deliverable: js/saveManager.js implemented; a "resume game" affordance in
the UI (can be minimal — a button that appears if a save exists).

Exit criteria: save -> reload the page -> restore reproduces the exact
same GameState (assert via a snapshot equality test in
tests/integration/save-restore.test.js), including mid-game states at
several different turnManager phases.
```

---

## Prompt 021 — Polish

**Phase:** 21

```
UX pass across everything built so far. Concretely:
- Walk through docs/design/ui-ux-inspiration.md and check each referenced
  pattern (Incan Gold/Diamant layout clarity, Balatro-style reveal beat,
  Slay-the-Spire-style safe/danger card language, Hearthstone-style
  opponent compression) against the actual implementation; fix the
  biggest gaps first.
- Edge cases: empty Lost Loot interactions (GDD §29.6 — Treasure Map and
  Treasure Chest+Golden Key both query Lost Loot and must already degrade
  gracefully per Prompt 010b; re-verify here under real UI conditions,
  not just unit tests), Treasure Deck reaching exactly 0 mid-reveal
  (including mid Sea Serpent chain), a player with an empty Ship Cargo at
  scoring time.
- Stability pass: no uncaught exceptions across a batch of full playthroughs
  (see Prompt 022's AI-simulation output for this).

Deliverable: a punch-list of fixed issues (keep it in
docs/phases/phase-21-polish-notes.md as you go, so nothing is fixed
silently and untracked).

Exit criteria: no known crash or stuck-state bug remains open on the
punch-list.
```

---

## Prompt 022 — Testing (Regression Suite)

**Phase:** 22 · **Files:** `tests/`

```
Consolidate and extend the test suite built incrementally across every
prior prompt into a permanent regression suite (GDD §25):
- tests/unit/: sorting, score calculation, duplicate detection, seeded
  shuffle, localization symmetry — already exist from earlier prompts,
  verify coverage is complete.
- tests/integration/: duplicate resolution, Shipwreck, ability chains,
  empty Lost Loot, empty Treasure Deck, multiplayer turns, save/restore.
- tests/scenarios/: deterministic full-game scripts (known GameState +
  known deck order, driven end to end, exact final state asserted) —
  add at least one scenario per player count (2, 3, 4).
- AI simulation (GDD §25.5): script N AI-vs-AI full games (no human input)
  in a loop, asserting no illegal moves, no state corruption, no infinite
  loops, no crashes, no ability-chain failures. Start with N=100 for MVP.
- Wire `npm test` (package.json, currently a placeholder from Phase 0) to
  actually run the full suite.

Deliverable: a real `npm test` command; a documented pass rate for the
AI-simulation batch.

Exit criteria: `npm test` is green; the AI-simulation batch completes with
zero crashes/illegal states across all runs.
```

---

## Prompt 023 — Web Release

**Phase:** 23

```
Prepare the production web build:
- Verify no build step is strictly required (vanilla ES modules, per GDD
  §18 "no unnecessary framework") — if any optimization is added
  (minification/bundling), document the exact build command in README.md
  and keep it optional/reversible.
- Basic performance pass: confirm asset sizes are reasonable, no obvious
  memory leaks across a long AI-simulation run (reuse Prompt 022's
  harness), confirm the game boots correctly when served from a
  subdirectory (not just root `/`) since deployment targets vary.
- Deployment: document (in README.md) how to deploy the static folder
  (e.g. any static host — Netlify/Vercel/GitHub Pages/plain nginx) since
  no server-side logic exists.
- Final version bump to 1.0.0 (first MAJOR — this is the "public API is
  stable" milestone per the versioning rule in CHANGELOG.md) once every
  prior Stage's exit criteria are confirmed still passing.

Deliverable: a production-ready static build; updated README.md
deployment section.

Exit criteria — MVP complete when: the full regression suite passes, the
game is playable end-to-end bilingually on desktop and mobile-landscape,
and the build is deployed (or deploy-ready) as a static site.

Post-MVP (explicitly out of scope here, see docs/phases/mvp-roadmap.md):
Phase 24 (Unity Port) only — all 8 card abilities are already implemented
and tested as part of Stage A (Prompts 010/010b/011), since abilities are
core gameplay, not a deferred layer.
```
