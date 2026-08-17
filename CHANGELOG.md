# Changelog

Format follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
Starts at `0.0.0` (empty repo). Bumped on every change:

- **MAJOR** — breaking changes to data schemas or the public gameplay API (`gameManager.js`). Stays `0` until Phase 23 (Web Release).
- **MINOR** — new files/systems/docs added, backward compatible.
- **PATCH** — fixes or edits to existing files, no new systems.

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
