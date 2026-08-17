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

## Development rules

This project follows 20 mandatory rules throughout development — engine
independence, UI independence, data-driven cards, no hard-coded card names,
etc. See [`docs/architecture/development-rules.md`](docs/architecture/development-rules.md)
before writing any gameplay code.

## Roadmap

25 phases, from foundation through Web release and Unity port. See
[`docs/phases/roadmap.md`](docs/phases/roadmap.md).
