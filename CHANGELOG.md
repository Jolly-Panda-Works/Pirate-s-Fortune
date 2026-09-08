# Changelog

Format follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
Starts at `0.0.0` (empty repo). Bumped on every change:

- **MAJOR** — breaking changes to data schemas or the public gameplay API (`gameManager.js`). Stays `0` until Phase 23 (Web Release).
- **MINOR** — new files/systems/docs added, backward compatible.
- **PATCH** — fixes or edits to existing files, no new systems.

## [0.23.0] - Prompt 018: Animations

### Added
- `js/animationManager.js` (previously an empty stub) implements GDD §22.
  Architecture decision (full rationale in the file's own header):
  rather than making turnManager.js literally `async`/`await` an
  animation acknowledgment (which would transitively force all 15 of its
  functions, gameManager.js, and all 162 pre-existing tests to become
  async), this module gates WHEN `uiManager.render()`/
  `modalManager.render()` run instead of gating the GameState mutation
  itself — game logic still runs to completion instantly and
  synchronously, exactly as before.
  - The render-gating hold: lets a render through immediately unless
    already holding; the instant `PHASE_CHANGED` reports `SHIPWRECK`
    (which turnManager.shipwreck() always sets BEFORE
    burnManager.triggerShipwreck() moves anything), engages a 900ms
    hold, collapsing every GameState change during it into one release
    render reflecting the latest state.
  - `acknowledgeDuplicate(expeditionCard)` — turnManager.shipwreck()'s
    explicit, fire-and-forget acknowledgment call; flashes the specific
    duplicate card via CSS on top of the automatic hold.
  - `waitForAnimation(el, animationClass, timeoutMs)` — generic
    animationend/transitionend-or-timeout helper (GDD §22's own
    recommended timeout/fallback strategy); never rejects/throws.
  - `playCardReveal()`, `playCollection()`,
    `playAbilityTrigger(abilityKey, cards)` — cover GDD §22's "at
    minimum" list (reveal, Return to Ship collection, all 8 ability
    trigger moments), dispatched purely off ability key (rule 4).
  - `setDisabled(true)` — debug escape hatch per the prompt's exit
    criteria; game logic was never at risk either way in this design.
  - `resetForTesting()` — testing-only reset for module-level hold
    state, added after a real cross-test leakage bug surfaced during
    test-writing.
  - Every DOM-touching function guards `typeof document !== 'undefined'`
    — required, since turnManager.js now calls into several of these
    unconditionally on every reveal/shipwreck/ability/return.
- `css/animations.css` (previously an empty stub): reveal, duplicate-
  flash (900ms, matching `DUPLICATE_VISIBLE_HOLD_MS`), collection, and
  one shared per-ability glow keyframe differentiated by an
  `--ability-glow-color` custom property per ability. Respects
  `prefers-reduced-motion`.
- `tests/unit/animation-manager.test.js` (13 tests, using `node:test`'s
  built-in `mock.timers`): the render-gating hold's full state machine.

### Changed
- `js/turnManager.js`: `revealCard()`/`shipwreck()`/
  `finishResolveAbility()`/`returnToShip()` each fire the matching
  animationManager trigger, fire-and-forget. turnManager.js's own
  synchronous contract is completely unchanged — confirmed by all 162
  pre-existing tests passing with zero modifications.
- `js/uiManager.js` / `js/modalManager.js`: each removed its own direct
  `gameState.on('*', render)` subscription — animationManager.js now
  owns it and calls both `render` functions (passed in as `init()`'s
  render targets) through its gate instead.
- `js/main.js`: wires `animationManager.init([uiManager.render,
  modalManager.render])` after both modules' own `init()` but before
  `gameManager.startGame()`.

### Verified
- `tests/unit/animation-manager.test.js`: 13/13 — immediate render for
  an ordinary phase change, immediate-then-held for SHIPWRECK, automatic
  release after the hold elapses, multiple changes during a hold
  collapsing into one release render, back-to-back Shipwrecks each
  holding correctly, the `setDisabled()` escape hatch, a throwing render
  target never breaking a sibling, headless-safety.
- A hand-rolled DOM shim (with real `dataset`->attribute reflection)
  drove a genuine duplicate through `turnManager` via
  `gameManager.revealNextCard()` and, using actual elapsed real time
  (not mocked), confirmed: `gameState.getPhase()` had ALREADY moved past
  SHIPWRECK to the next turn immediately after the synchronous call
  returned (game logic never gated), while the DOM's Expedition Area
  zone still showed both duplicate cards, not yet cleared — only
  catching up to the Shipwreck aftermath once real time genuinely
  elapsed. This is the actual hard requirement, proven end-to-end.
- Full engine test suite: 175/175 (162 + 13 new, zero regressions, zero
  existing tests modified).

## [0.22.0] - Prompt 017: Responsive / Landscape UI — Stage C complete

### Added
- `css/responsive.css` (previously an empty stub): all four GDD §21
  breakpoint tiers (XL >=1366px, MD 1024-1365px, SM 844-1023px, XS
  ~<=932x430) via genuine layout reflow — grid area reassignment
  (Treasure Deck + Lost Loot collapse into one narrow shared column at
  SM/XS, freeing width for the Expedition Area), spacing reduction
  (root `--space-*` tokens redefined per tier), collapsed rival areas
  (opponent score-preview/name hidden at SM/XS), condensed action bar —
  never `transform: scale(...)` of the whole board. Narrower tiers
  cascade as descending `max-width` overrides (MD -> SM -> XS, in that
  file order); XS is the only tier also gated on `max-height` (a
  landscape phone is wide but short, unlike a merely-narrow desktop
  window).
- `js/uiManager.js`: new `initOrientationGate()` (GDD §21 / rule 15),
  wired against `window.matchMedia('(orientation: portrait)')`.
  Blocking is two layers together (`aria-hidden` + a new
  `pointer-events: none` CSS class), not either/or — neither alone
  actually stops both a screen reader AND a click.
- `.app-root--blocked`/`.modal-root--blocked`/`.orientation-gate` CSS in
  `css/responsive.css`.

### Changed
- `js/main.js`: calls `uiManager.initOrientationGate()` once during
  bootstrap, independent of every other bootstrap step.
- `css/layout.css`: scoped `overflow-y: auto` added to
  `.zone-expedition-area` (inside `responsive.css`'s SM block) — the
  base `.zone { overflow: hidden; }` would otherwise clip wrapped
  Expedition Area cards once that zone spans 2 grid rows at SM/XS.

### Verified
- No new unit tests (pure CSS/DOM-orientation-toggling, outside `npm
  test`'s scope like Prompt 012-014's own UI code). Two one-off
  verification scripts instead: a `matchMedia`-mocking script exercising
  `initOrientationGate()`'s full state machine (landscape at init,
  rotate to portrait blocks+shows gate, rotate back unblocks+hides,
  page-loads-already-portrait case), and a regression run of the full
  4-player click-driven game with the gate now wired into bootstrap,
  confirming no interference with normal play.
- Full engine test suite: 162/162 (unchanged — no new game-logic
  module).
- **Stage C (Bilingual) complete**: a full game is playable in English
  and Persian (RTL), at all four breakpoint tiers, with the orientation
  gate correctly blocking portrait / unblocking landscape in both
  languages.

## [0.21.0] - Prompt 016: Localization

### Added
- `js/localizationManager.js` (previously an empty stub) implements EN/FA
  localization and RTL direction handling (GDD §20):
  - `t(key, params)` — dotted-key lookup with `{placeholder}`
    interpolation; falls back to English (logged) if missing in the
    active locale, and to `''` (logged as an error) if missing
    everywhere — never renders a raw key.
  - `loadLocale(langCode)` — pure lookup against the already-loaded
    `data/localization.json` (one file holds both locales; nothing to
    re-fetch on switch).
  - `setLocale(langCode)` — updates `document.documentElement.lang`/
    `.dir`, refreshes `[data-i18n]`/`[data-i18n-aria-label]` elements
    and the switcher's active state, emits `locale-changed`.
  - `formatNumber(value)` — `Intl.NumberFormat`, real Eastern
    Arabic-Indic digits for Persian (GDD §20 number formatting).
  - `mountSwitcher()` — wires the new EN/FA toggle in `index.html`.
- `data/localization.json`: full EN/FA string trees, 64 symmetric keys
  covering every zone/action/ability/status string used by the UI.
- `tests/unit/localization.test.js` (7 tests): EN/FA key symmetry (both
  directions), `dir` correctness, non-empty leaf values, and
  `{placeholder}` token symmetry between locales.
- Language switcher (`#language-switcher`, `.lang-button`) in
  `index.html` + CSS (`css/main.css`), using logical inset properties.

### Changed
- `js/uiManager.js` / `js/modalManager.js`: every `// TODO(i18n)` from
  Prompt 012/013/014 resolved — all hard-coded English strings and card
  type names now route through `localizationManager.t()`/
  `formatNumber()`. `modalManager.js`'s old English-only `ABILITY_COPY`
  table is replaced by `getAbilityCopy()`, reading the same data from
  `data/localization.json`.
- `js/main.js`: loads `data/localization.json` at bootstrap and
  initializes `localizationManager` before `uiManager`/`modalManager`;
  both managers' `render()` subscribed to
  `localizationManager.onLocaleChange()`.
- `css/layout.css`, `css/cards.css`, `css/modal.css`: physical
  `margin-top`/4-value `margin: 0 0 Xpx 0` shorthands converted to
  logical properties (`margin-block-start`/`margin-block-end`/
  `margin-block`) — nothing was actually LTR-broken (all values were
  already left/right-symmetric), but this makes `layout.css`'s own
  "uses logical properties" header claim true in practice (GDD §29.4).
- `index.html`: every zone's `aria-label` now also carries a matching
  `data-i18n-aria-label` so screen-reader text is localized too.

### Verified
- A hand-rolled DOM shim (no jsdom dependency, matching Prompt
  012–015's own precedent) drove a full 4-player game through a real
  mid-game language switch: confirmed `lang`/`dir` flip, every zone
  re-renders in Persian, Persian digit formatting, a targeted-ability
  modal shows correctly translated title/prompt text, the game reaches
  `SCORING` with a correctly-localized results banner, and switching
  back to English re-renders it in English too. The only leftover
  Latin-script text anywhere was AI player names themselves (user/config
  data, correctly left untranslated).
- Full engine test suite: 162/162.

## [0.20.0] - Prompt 015: AI

### Added
- `js/playerManager.js` (previously an empty architectural stub) now
  implements every AI decision (GDD §15/§17):
  - `decideAction(expeditionSize)` — the GDD §15 MVP threshold (Explore
    Further below 4 cards, Return to Ship at 4+).
  - `chooseAbilityTarget(options)` — deterministically returns the first
    entry of a targeted ability's own `getEligibleTargets()` list (Cannon/
    Dagger/Anchor/Map); throws on an empty/invalid array.
  Both are pure and synchronous — no GameState access, no timers.
- `tests/unit/player-manager.test.js` (14 tests) and
  `tests/integration/ai-ability-targeting.test.js` (7 tests) covering
  both functions end-to-end through `turnManager`.

### Changed
- `js/turnManager.js`: `playerDecision()` now calls
  `playerManager.decideAction()` instead of the removed Prompt 005
  placeholder (`aiDecision()`/`AI_RETURN_THRESHOLD`) — identical
  threshold behavior, just relocated. `resolveAbility()`'s targeted-
  ability branch now also covers an AI current player: with at least one
  real eligible option, it calls `playerManager.chooseAbilityTarget()`
  and resolves immediately (no PLAYER_CHOICE pause — only a human still
  pauses). New shared helper `buildAbilityTargetContext()` factors the
  option-shape-to-AbilityContext mapping out of `resolveAbilityChoice()`
  so both the human and AI paths use the same code.

### Fixed
- `tests/integration/full-loop-stub.test.js`'s "recorded turns is
  bounded" test had a stale `cardsSecured/cardsLost <= 4` assumption
  from the pre-Prompt-015 no-targeting placeholder era. Since AI players
  now actually target Pirate Dagger/Lucky Anchor/Treasure Map, a single
  turn's Expedition Area can grow by more than the number of cards
  literally drawn (each of those three abilities can inject one extra
  card via the Resolution Queue before the next threshold check).
  Relaxed to the real ceiling (60, the total card pool).

### Verified
- A hand-rolled DOM shim (no jsdom dependency, matching the Prompt
  012/013/014 precedent) drove a full 4-player game (1 human, 3 AI) to
  `SCORING` using ONLY simulated clicks — Explore Further/Return to Ship
  AND modal target selections — across 6 different seeds, every one
  completing cleanly with a correct scoring result and the AI opponents
  genuinely exploring, returning, and targeting abilities on their own.
- Full engine test suite: 155/155.

## [0.19.0] - Prompt 014: Modal System

### Added
- New `PHASES.PLAYER_CHOICE` phase (`gameState.js`) — the same "pause
  point + resume function" pattern `PLAYER_DECISION` already uses for
  Explore Further/Return to Ship, now applied to targeted-ability
  resolution. New `gameState.pendingAbilityChoice` field +
  `getPendingAbilityChoice()`/`setPendingAbilityChoice()`/
  `clearPendingAbilityChoice()`.
- `js/turnManager.js`: `resolveAbility()` now pauses at PLAYER_CHOICE for
  a targeted ability (Cannon/Pirate Dagger/Lucky Anchor/Treasure Map)
  whenever the current player is human AND at least one real eligible
  target exists (checked generically via
  `abilityManager.needsTargetSelection()`/`getEligibleTargets()` — zero
  hard-coded ability names). New `resolveAbilityChoice()` resumes it,
  validating the selection and building the AbilityContext generically
  from whichever fields the selection itself carries. AI players (and
  humans with nothing eligible) continue to resolve immediately with no
  target, unchanged from Stage A. Also fixes a latent bug: `abilityContext`
  (Compass's preview) was never actually cleared by real gameplay before
  this — now cleared at the start of every new ability resolution.
- `js/abilityManager.js`: an ability can now optionally register a
  `getEligibleTargets` function alongside its handler; new
  `needsTargetSelection()`/`getEligibleTargets()` lookups.
- `js/abilities/{cannon,pirateDagger,luckyAnchor,treasureMap}.js`: each
  gained a `getEligibleTargets()` (rival cargo cards for Cannon/Dagger,
  own cargo for Anchor, Lost Loot for Map). No resolution logic changed.
- `js/modalManager.js` (new) — the only module reading/writing
  `#modal-root`. Renders a blocking, grouped-by-rival choice modal for a
  pending ability target selection, and a non-blocking Compass preview
  panel, both driven purely by GameState reads via the same
  `gameState.on('*', render)` full-re-render strategy `uiManager.js`
  uses. Never calls `uiManager.js`; the two communicate only through
  GameState events.
- `js/inputManager.js`: `dispatchAction()` now accepts an optional
  `payload`; added `ACTIONS.CHOOSE_ABILITY_TARGET`.
- `js/gameManager.js`: added `chooseAbilityTarget()` + re-exported
  `getPendingAbilityChoice`.
- `css/modal.css`: blocking overlay/panel for the choice modal, small
  non-blocking corner panel for the Compass preview.
- `js/main.js`: now also initializes `modalManager`.

### Fixed
- Three existing test files' `startFreshExpedition()` helpers (which
  discard a fresh game's auto-revealed first card) could leave the game
  paused at PLAYER_CHOICE before discarding it, since Lost Loot always
  starts pre-populated and a fixed seed's first card can legitimately be
  a Treasure Map. Fixed with a small `settleAnyPendingAbilityChoice()`
  step in each helper. Two tests whose own titles already predicted this
  exact change ("real UI arrives Prompt 014") were rewritten for the new
  pause-then-resolve behavior; a full-game determinism test's expected
  scores now derive from actual final Ship Cargo via
  `scoreManager.calculateScore()` rather than a pre-effect assumption.

### Verified
- A DOM shim (extended from Prompts 012/013) was used to drive a full
  2-player game (1 human, 1 AI) to `SCORING` using ONLY simulated clicks
  — Explore Further/Return to Ship AND modal target selections — across
  14 different seeds, every one completing cleanly with a correct
  scoring result. A DOM-tree dump of a real Pirate Dagger pause confirmed
  the grouped-by-rival modal renders correctly.
- Full engine test suite: 136/136 (up from 135/135; net +1 from splitting
  one Cannon test into two).

## [0.18.0] - Prompt 013: Card Interaction

### Added
- `js/inputManager.js` (new) — the single seam every human action click
  routes through. Exports `ACTIONS` (`EXPLORE_FURTHER`/`RETURN_TO_SHIP`)
  and `dispatchAction()`, the only place deciding which `gameManager`
  mutation an action name maps to. No DOM access, no `gameState.js`
  import — the two sanctioned mutation entry points
  (`gameManager.revealNextCard()` / `gameManager.returnToShip()`) are the
  only calls it makes. Wrapped in a defensive try/catch (never
  `alert`/`confirm`/`prompt` — rule 11); a rejected action is logged, not
  surfaced via a blocking dialog.
- `js/uiManager.js` — the Explore Further / Return to Ship buttons (their
  `disabled` state already correct since Prompt 012) now carry real
  `click` listeners, both routed through `inputManager.dispatchAction()`.
  This file still makes zero direct `gameManager` calls, preserving the
  render/input separation Prompt 012 established.
- `js/main.js` — comments/log line updated now that clicking actually
  works; `window.gameManager` stays exposed purely as an optional
  debugging convenience.

### Verified
- A full 2-player game (1 human, 1 AI) driven to `SCORING` using ONLY
  simulated button clicks (a DOM shim with real `click()`/`disabled`
  semantics — a disabled element's `click()` is a no-op, matching real
  DOM behavior) — never calling `gameManager` directly — across 6
  different seeds, each completing cleanly (16-22 clicks) with a correct,
  internally-consistent scoring result and a correctly-rendered results
  banner.
- Full engine test suite: still 135/135 (no engine file touched).

## [0.17.0] - Prompt 012: UI (Board Rendering) — Stage B begins

### Added
- `js/uiManager.js` — strictly read-only GameState renderer (GDD §19,
  rule 5). Subscribes once to `gameState.on('*', render)` (no polling, no
  per-event-type handler map); every mutation triggers exactly one full
  re-render. Zero imports of `gameManager.js`, zero calls to any
  `gameState.js` mutator.
  - Renders all 6 non-modal GDD §19 zones: Treasure Deck (face-down top
    card + count), Lost Loot (fully face-up — Treasure Map needs its
    contents visible), Expedition Area (face-up, reveal order, + a
    Shield-Active badge), Ship Cargo (current player, face-up, + a live
    score preview via `scoreManager.calculateScore()`), Opponents
    (every other player, compact), Actions (turn/phase status +
    Explore-Further/Return-to-Ship buttons whose `disabled` state
    reflects whether a decision is legally pending — no click handlers
    yet, that's Prompt 013).
  - Every visual glyph resolves through `iconManager.resolveIcon()`
    using `definition.ability ?? definition.type` as the key — never an
    inline emoji/path. This single fallback rule is what lets Treasure
    Chest and Golden Key (two `type`s, one shared `ability`) resolve
    correctly with zero special-casing, while Gold Coin (the only
    `ability: null` card) falls back to its `type`.
- `index.html` — filled in the static zone markup inside `#app-root`
  (`zone-opponents`, `zone-treasure-deck`, `zone-expedition-area`,
  `zone-lost-loot`, `zone-actions`, `zone-ship-cargo`); `#modal-root`
  stays untouched, owned entirely by `modalManager.js` (Prompt 014).
- `css/layout.css` — fixed CSS grid (`grid-template-areas`, landscape-
  first per GDD §19/§21) plus the shared zone/card-row/opponent/action-
  button/results-banner classes.
- `css/cards.css` — static `.card--face-up` / `.card--face-down` looks
  (animated state transitions arrive in Stage D).
- `js/main.js` — replaced the Phase 0 boot-only stub: `fetch()`es the
  real data files, initializes `iconManager`/`uiManager`, starts a
  default 2-player game (1 human, 1 AI), and exposes `window.gameManager`
  as this Prompt's temporary debug harness (Prompt 013 replaces the
  console-only flow with real button clicks).

### Verified
- A hand-rolled minimal DOM shim (no `jsdom`/`node_modules` available)
  drove the real `js/uiManager.js` + `js/main.js` source through `init()`
  and many genuine `gameManager` calls — reveals, returns, several real
  Shipwrecks, several real ability resolutions — with zero exceptions; a
  DOM-tree dump confirmed correct icons/values/counts/button-state at
  each step.
- Full engine test suite: still 135/135 (no engine file touched; Stage B
  UI code is outside `npm test`'s scope per
  `docs/architecture/testing-strategy.md` — visual correctness is Stage
  B's manual-playtest exit criterion instead).

## [0.16.0] - Prompt 011: Full Ability Chain Integration Tests — Stage A complete

### Added
- `tests/integration/ability-chains.test.js` — 14 tests exercising ALL
  EIGHT card abilities inside full-game scenarios (real multi-player
  state, a rival's SUBSEQUENT state after being targeted, and combined/
  mixed-ability chains), distinct from the per-ability edge-case coverage
  already in tests/unit/ability-resolver.test.js and
  tests/integration/{single-resolution,chain}-abilities.test.js (kept,
  not duplicated here):
  - Registration: all 8 ability keys (singleResolution + chain) match
    data/cards.json exactly.
  - Compass: previewed card is exactly the next reveal, driven through
    the real public API (`gameManager.revealNextCard()`).
  - Cannon: destroys a rival's Ship Cargo card (GDD §14.2 names no
    zone — targets Ship Cargo per Prompt 010's documented decision); the
    rival's cargo AND `scoreManager.calculateScore()` both reflect it.
  - Captain Shield: first-card-of-an-expedition protects nothing vs. a
    later reveal that protects as designed, inside one continuous
    2-player game.
  - Pirate Dagger: steals a rival cargo card (permanent loss, proven via
    score); a stolen card that duplicates halts resolution — proven its
    own ability never runs by checking `GameState.abilityContext` stays
    `null` (an ability-bearing stolen card, not a null-ability Gold Coin).
  - Lucky Anchor: replaying a card from cargo (a Sea Serpent) triggers
    that card's OWN ability (forcing a further reveal) — chained, not
    recursive.
  - Sea Serpent: a mock-ability call-depth counter (reusing Prompt 009's
    technique) proves the Resolution Queue never recurses 3+ hops deep —
    a real Sea Serpent can never chain into a THIRD Sea Serpent (shared
    type always duplicates the second one), so a mock is what actually
    lets this go deep; plus a REAL 3-card cascade (Sea Serpent ->
    Treasure Map -> a Cannon retrieved from Lost Loot) proving every hop
    completes the full Card Resolution Order, not just the first.
  - Treasure Map: retrieves a card from Lost Loot mid-expedition, later
    actually secured via Return to Ship; empty Lost Loot no-ops.
  - Treasure Chest + Golden Key: bonus card from Lost Loot on Return to
    Ship, reflected in `scoreManager.calculateScore()`; empty Lost Loot
    grants no bonus.
  - Combined: a Dagger steal triggers a Sea Serpent that forces a SECOND
    Dagger — the second Dagger duplicates the first (already in the
    expedition) and halts resolution, proving the queue correctly handles
    a MIXED-ability chain (dagger -> seaSerpent -> dagger), not just one
    ability repeating itself.
- `tests/scenarios/full-game-scenario.test.js` — 7 tests, the Stage A
  completion gate (docs/prompts/stage-a-core-engine.md's Prompt 011 exit
  criteria):
  - Full 2/3/4-player all-AI games, each with a fixed seed
    ("unscripted-decision-but-deterministic-deck" — every
    PLAYER_DECISION resolves via turnManager's own placeholder AI
    threshold, nothing here hand-picks a card), run GAME_INIT through
    SCORING unattended and are asserted internally consistent: card
    conservation across Lost Loot/(any abandoned) Expedition Area/every
    player's cargo sums to the full 60; no instanceId is duplicated
    across zones; every player's stored `.score` matches an independent
    `scoreManager.calculateScore()` recomputation; `GameState.results
    .winners` matches an independent `scoreManager.determineWinner()`;
    and the winner's score is verified >= every other player's (the
    actual definition of "a correct winner").
  - A same-seed-twice determinism check (turnHistory + results
    `deepEqual` across two independent runs — GDD §25.3).
  - "No ability key in data/cards.json is unregistered."
  - "No file in js/ imports anything DOM-related" — scoped to the actual
    Stage A deliverable files (gameState/cardManager/deckManager/
    burnManager/collectManager/scoreManager/abilityManager/
    abilityResolver/turnManager/gameManager/iconManager/abilities/*);
    deliberately excludes main.js and the Phase 12+/14/17/18/19/20 UI
    stub files (uiManager.js, modalManager.js, etc.), which are
    documented in their own headers as future-phase scaffolding outside
    Stage A's scope and already legitimately reference `document.` once
    (main.js) ahead of their own phase.

### Fixed / discovered (no code change — documented as accepted behavior)
- Writing `full-game-scenario.test.js` surfaced that an all-AI 3/4-player
  game can legitimately end with cards still sitting in the Expedition
  Area: `turnManager.drawCard()`'s DRAW_CARD step folds straight into
  `endTurn()` when the Treasure Deck runs dry (its existing, Prompt
  004/005-era behavior — see that function's own docstring), which can
  happen mid-explore, after a player has already revealed some cards this
  turn but before Returning to Ship or hitting a duplicate. Those
  cards are simply abandoned (never secured, never Shipwrecked) — this
  was already the accepted behavior `tests/integration/full-loop-stub
  .test.js` was written around (Prompt 005's notes: "a card-conservation
  check ... replaced the old 'Expedition Area always empty at game end'
  assumption, since the Treasure Deck can now run out mid-explore for the
  last player to act"). This prompt's scenario test's conservation check
  was written to fold in any such leftover cards rather than assert the
  Expedition Area is always empty at SCORING — no engine code changed.
- Full suite: 135/135 passing (up from 114/114 before this prompt: +14
  for `ability-chains.test.js`, +7 for `full-game-scenario.test.js`).

### Stage A — Core Gameplay Engine: complete
All 11 prompts of `docs/prompts/stage-a-core-engine.md` are now done. A
full, deterministic-deck, unscripted-decision 2-4 player game runs start
to finish with a correct winner; every one of the 8 abilities is
exercised at least once across the test suite; no ability key in
data/cards.json is unregistered; no Stage A file imports anything
DOM-related. Stage B (UI, Phase 12+) can now begin without further
changes to `js/gameState.js`'s public shape (per the "UI never mutates
GameState directly" rule this whole stage was built to guarantee).

## [0.15.0] - Prompt 010b: Chain Abilities

### Added
- `js/abilities/pirateDagger.js` (GDD §14.4): steals a rival's Ship Cargo
  card and feeds it back into the Resolution Queue via
  `enqueue({ cardInstance, ... })` — a stolen card is genuinely at risk
  again (could Shipwreck the whole expedition, itself included).
- `js/abilities/luckyAnchor.js` (GDD §14.5): replays a card from the
  CURRENT player's own Ship Cargo the same way. Removing it from cargo
  (rather than duplicating it there) was a deliberate design decision,
  documented in the file — a pure freebie wouldn't be an interesting risk.
- `js/abilities/seaSerpent.js` (GDD §14.6): forces an additional card
  reveal straight from the Treasure Deck via `deckManager.drawFromTreasureDeck()`,
  enqueued the same way. Graceful no-op on an empty deck.
- `js/abilities/treasureMap.js` (GDD §14.7): retrieves a card from Lost
  Loot into the resolution flow; defaults to the top of Lost Loot when no
  explicit target is supplied (e.g. when reached via a chain, where the
  parent context doesn't carry a `targetCardId` to forward). Graceful
  no-op on an empty Lost Loot.
- `js/abilities/treasureChestGoldenKey.js` (GDD §14.8): the one ability
  that triggers on Return to Ship rather than a normal reveal — self-
  guards on `context.reason === 'returnToShip'` (the registry has no
  concept of restricting which call site may invoke a key, and the normal
  reveal pipeline calls every ability generically). Grants a bonus card
  from the top of Lost Loot — deterministic, not `Math.random()`, to keep
  seeded games fully reproducible (GDD §25.3).
- `tests/integration/chain-abilities.test.js` — 16 tests covering all
  five abilities: Dagger's steal-and-resolve plus a stolen-card-duplicates
  Shipwreck case and ineligible-target no-ops; Anchor's replay plus an
  invalid-selection no-op; Sea Serpent's forced reveal, the fact that two
  Sea Serpents always Shipwreck each other (shared type), a genuine
  3-card cross-ability cascade (Sea Serpent -> Treasure Map -> Lost Loot),
  and an empty-deck no-op; Treasure Map's retrieval plus an empty-Lost-
  Loot no-op; and Treasure Chest + Golden Key's reveal-vs-Return-to-Ship
  distinction, its bonus grant, and its empty-Lost-Loot no-op. Plus a
  registration check against gameConfig.json's `abilities.chain` list.

### Changed
- `js/abilityResolver.js`: the Resolution Queue now distinguishes a plain
  `enqueue({ source: definition })` (queue another ability invocation,
  Prompt 009's original behavior) from `enqueue({ cardInstance })` (queue
  a chain-generated CARD that must run the full Card Resolution Order —
  enter the Expedition Area, duplicate-check, then its own ability or
  halt). The latter is handled by the queue-draining loop itself, not by
  a handler or a recursive `resolveAbility()` call — this module now
  imports `gameState.js`/`cardManager.js`/`burnManager.js` for that one
  specific responsibility (a scope expansion from Prompt 009, documented
  in the file). `resolveAbility()`'s return type changed from a bare
  `processedCount` number to `{ processedCount, shipwreckedCard }`, so a
  chain-generated duplicate can be reported back to the caller without
  abilityResolver.js ever ending a turn itself.
- `js/turnManager.js`: `resolveAbility()` now passes `gameCardDefinitions`
  through as `resolveAbility()`'s third argument, and checks the returned
  `shipwreckedCard` — routing to the EXISTING `shipwreck()` step (unchanged
  itself) exactly like a normal duplicate, rather than duplicating that
  logic here or in abilityResolver.js.
- `js/collectManager.js`: `returnToShip()` now writes secured cards into
  cargo BEFORE triggering any Treasure Chest + Golden Key among them (via
  a plain `abilityResolver.resolveAbility()` call, `reason: 'returnToShip'`)
  so its handler's own bonus-card mutation isn't silently overwritten by
  this function's final sorted write; the final sort/write happens once,
  after all such triggers, so a bonus card ends up correctly positioned.
- `js/abilities/index.js`: imports the five new files for their
  registration side effects.
- Several pre-Prompt-010b tests assumed abilities were no-ops and needed
  updates now that they're real — see "Notes on Prompt 010b" below for
  the specific fixes and the seed changes involved.

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
