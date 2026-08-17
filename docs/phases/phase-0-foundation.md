# Phase 0 — Project Foundation

Source: GDD §28 (Development Roadmap).

## Goal

- Repository structure
- Documentation skeleton
- Configuration foundation
- Logger
- HTML/CSS/JS foundation

**No gameplay code should exist at this phase.**

## Checklist

- [x] Repository/folder structure matches GDD §18.1
- [x] `index.html` shell with `#app-root` / `#modal-root` mount points, CSS load order
- [x] CSS files created as stubs with documented responsibilities
- [x] All 17 JS system modules created as architectural stubs (no logic)
- [x] `logger.js` fully implemented (tagged diagnostic logging)
- [x] `main.js` boots and logs a foundation-loaded message, nothing else
- [x] `data/cards.json` present but empty (populated in Phase 1)
- [x] `data/gameConfig.json` placeholder reflecting confirmed decisions (GDD §31)
- [x] `data/localization.json` placeholder with `en`/`fa` keys and `dir`
- [x] `docs/` skeleton (this file, architecture docs, design doc, roadmap)
- [x] `tests/` folder structure (unit / integration / scenarios) created, empty

## Exit criteria

Phase 0 is done when the project boots in a browser (blank board, one log
line confirming the foundation loaded) and every module referenced in
GDD §18.1 exists on disk with the correct responsibility documented, even
if unimplemented.

## Next milestone

**Phase 0 → Foundation → Prompt 001** (per GDD §34), then proceed to
Phase 1 — Data Architecture: populate `cards.json`, finalize `gameConfig.json`,
validate the 60-card model.
