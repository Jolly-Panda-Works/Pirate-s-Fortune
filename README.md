# Treasure Raiders

Push-your-luck, hand-management pirate card game. Web first, Unity later.
2–4 players, ~10–20 minute sessions.

Full design and architecture reference: [`docs/design/GDD.md`](docs/design/GDD.md).

## Current status

**Phase 0 — Project Foundation.** No gameplay exists yet. This phase only
establishes the repository structure, documentation skeleton, configuration
foundation, logger, and the HTML/CSS/JS shell. See
[`docs/phases/phase-0-foundation.md`](docs/phases/phase-0-foundation.md).

## Running locally

This is a static, framework-free ES-modules project. Serve the folder with
any static file server (ES modules require `http://`, not `file://`):

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed local URL in a browser.

## Project structure

```
/treasure-raiders
  index.html            Shell page, mounts #app-root / #modal-root
  /css                  Stylesheets (main, layout, cards, modal, animations, responsive)
  /js                   ES modules — one file per system, see docs/architecture/module-map.md
  /data                 cards.json, gameConfig.json, localization.json
  /assets               cards, ui, icons, backgrounds, characters, audio
  /docs                 design, architecture, and phase documentation
  /tests                unit, integration, scenarios
```

## MVP roadmap (gameplay-first)

Development for this project follows [`docs/phases/mvp-roadmap.md`](docs/phases/mvp-roadmap.md),
not the raw 25-phase order in the GDD: the gameplay engine (Stage A) is
built and fully tested headless, before any UI (Stage B), before
bilingual/responsive support (Stage C, required — the game ships in
Persian and English), before feel/release polish (Stage D). Executable
prompts for every phase live in [`docs/prompts/`](docs/prompts/README.md).

## Development rules

This project follows 20 mandatory rules throughout development — engine
independence, UI independence, data-driven cards, no hard-coded card names,
etc. See [`docs/architecture/development-rules.md`](docs/architecture/development-rules.md)
before writing any gameplay code.

## Project standards

Standing rules that apply to every future change, not just Phase 0:

1. **Delivery** — every delivered zip is accompanied by a git commit header + description (conventional-commit style).
2. **Versioning** — `package.json` version follows [SemVer](https://semver.org/), starting at `0.0.0`; bumped on every change (see [`CHANGELOG.md`](CHANGELOG.md)).
3. **UI/UX** — layout and interaction decisions reference well-known games with the same problem (see [`docs/design/ui-ux-inspiration.md`](docs/design/ui-ux-inspiration.md)) rather than inventing conventions from scratch.
4. **Data-driven** — no gameplay constant, ability name, or UI string is hard-coded in JS; it lives in `/data` (see [`docs/architecture/data-driven-design.md`](docs/architecture/data-driven-design.md)).
5. **Icons** — Phase 1+ uses emoji placeholders resolved through `js/iconManager.js` + `data/iconMap.json`, so swapping to real artwork later never requires code changes.

## Roadmap

25 phases, from foundation through Web release and Unity port. See
[`docs/phases/roadmap.md`](docs/phases/roadmap.md).
