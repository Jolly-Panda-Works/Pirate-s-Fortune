# Treasure Raiders

Push-your-luck, hand-management pirate card game. Web first, Unity later.
2–4 players, ~10–20 minute sessions.

Full design and architecture reference: [`docs/design/GDD.md`](docs/design/GDD.md).

## Current status

**MVP complete (v1.0.0)** — the full push-your-luck card game is playable
end-to-end, bilingually (English/Persian), on desktop and
mobile-landscape. All 25 phases of the [MVP roadmap](docs/phases/mvp-roadmap.md)
are done: headless engine (Stage A), UI (Stage B), bilingual/responsive
support (Stage C), and feel/release polish (Stage D — animation, audio,
save/restore, a 219-test regression suite including a 100-game AI
simulation batch, and this Prompt's production web-release pass). See
[`docs/phases/mvp-progress.md`](docs/phases/mvp-progress.md) for the
full per-prompt history.

## Running locally

This is a static, framework-free ES-modules project — **no build step**.
Serve the folder with any static file server (ES modules require
`http://`, not `file://`):

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed local URL in a browser.

## Deployment

The whole repository *is* the production build — there is nothing to
compile, bundle, or transpile (vanilla ES modules per GDD §18, no
framework, no `npm run build` script). Every asset path in `index.html`
and every `fetch()`/`import` in `js/` is a **relative** path (no leading
`/`), so the app boots correctly whether it's served from a domain root
or a subdirectory (e.g. `https://example.com/treasure-raiders/`) —
verified with a real headless-browser boot from a subdirectory path as
part of this prompt's performance pass.

Deploy by uploading/pointing any static host at the repository root:

- **Netlify / Vercel / Cloudflare Pages** — connect the repo (or drag-and-drop
  the folder); leave the build command empty and set the publish/output
  directory to the repository root (`.`).
- **GitHub Pages** — enable Pages on the repo, source = the root of the
  default branch (or `/docs` if you prefer a dedicated folder — not used
  here).
- **Plain nginx / Apache / any static file server** — point the document
  root at the repository root. No server-side logic, database, or
  environment variables are required; a plain `try_files $uri =404;`
  (nginx) or default static config is sufficient.

`/tests`, `/docs`, and `package.json`/`CHANGELOG.md` aren't required at
runtime and can be excluded from the deployed artifact if a host charges
by asset count, but leaving them in is harmless — nothing in `index.html`
references them.

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
