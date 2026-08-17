# Changelog

Format follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
Starts at `0.0.0` (empty repo). Bumped on every change:

- **MAJOR** — breaking changes to data schemas or the public gameplay API (`gameManager.js`). Stays `0` until Phase 23 (Web Release).
- **MINOR** — new files/systems/docs added, backward compatible.
- **PATCH** — fixes or edits to existing files, no new systems.

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
