# Treasure Raiders (a.k.a. "Pirate's Fortune") — Project Overview

## 1. What this project is

**Treasure Raiders** is a push-your-luck, hand-management card game for
2–4 players, themed around pirate treasure hunting. It's built as a
**static, framework-free, vanilla ES-modules web application** — no
build step, no bundler, no backend.

**Core gameplay loop:** players reveal treasure cards one at a time from
a shared deck, growing the value of their current expedition while
increasing the risk of drawing a duplicate card and losing everything
not yet secured to a "Shipwreck." At every step, a player chooses:

- **Explore Further** — reveal another card, risking more for a bigger
  payoff, or
- **Return to Ship** — bank the current expedition safely.

A full game takes roughly 10–20 minutes. The game supports both human
and AI players, special ability cards (single-resolution and multi-step
chain abilities), English/Persian bilingual UI with RTL support, and
responsive layouts from desktop down to mobile landscape.

**Architecture:** the rules engine is fully headless and
framework/UI-independent (pure JS modules operating on a single
`GameState` object via a pub/sub event system); the UI layer is a
separate, swappable rendering layer subscribed to that same event
stream. This separation is what let animation, audio, save/restore, and
localization all be added later without ever making the core game loop
asynchronous or touching its logic.

## 2. Current status

**MVP COMPLETE — v1.0.0.**

The game is fully playable end-to-end, bilingually, on desktop and
mobile-landscape, and is deploy-ready as a static site (verified to boot
correctly from a subdirectory path, not just a domain root). The full
automated regression suite passes at **219/219**, including a 100-game
(and separately spot-checked 1000-game) unattended AI-vs-AI simulation
batch with zero crashes or corrupted states.

The project was built through **23 sequential, numbered prompts**, each
a discrete feature phase with its own exit criteria, tests, and a
version bump — tracked in `docs/prompts/stage-d-feel-and-release.md`
(and the earlier stage documents) and `docs/phases/mvp-progress.md`.

## 3. Roadmap completed (Prompts 001–023)

### Stage A — Core Engine (headless, no UI)
| # | Prompt | What it added |
|---|---|---|
| 001 | Data Architecture | The 60-card data model, validated |
| 002 | Game State | `gameState.js` (pub/sub state store) + `cardManager.js` |
| 003 | Deck System | `deckManager.js` — seeded, deterministic shuffling |
| 004 | Turn System | `turnManager.js` state machine |
| 005 | Push-Your-Luck Core | `gameManager.js`; externally-drivable player decisions |
| 006 | Duplicate / Shipwreck | `burnManager.js` — the core risk mechanic |
| 007 | Collection | `collectManager.js` — banking an expedition |
| 008 | Scoring | `scoreManager.js` |
| 009 | Ability Framework | `abilityManager.js` + `abilityResolver.js` |
| 010 / 010b | Abilities | 8 ability cards (single-resolution + multi-step chains) |
| 011 | Full Ability Chain Integration | Stage A completion gate — full-game scenario tests |

### Stage B — UI
| # | Prompt | What it added |
|---|---|---|
| 012 | UI (Board Rendering) | `uiManager.js` — read-only renderer reacting to state events |
| 013 | Card Interaction | `inputManager.js` — click-driven play |
| 014 | Modal System | `modalManager.js` — ability target-selection UI |
| 015 | AI | `playerManager.js` — deterministic AI decision-making |

### Stage C — Bilingual & Responsive
| # | Prompt | What it added |
|---|---|---|
| 016 | Localization | `localizationManager.js` — EN/FA, RTL support |
| 017 | Responsive / Landscape UI | 4-tier breakpoint layout system, portrait-blocking gate |

### Stage D — Feel & Release
| # | Prompt | What it added |
|---|---|---|
| 018 | Animations | `animationManager.js` — render-gated, still 100% synchronous engine |
| 019 | Audio | `audioManager.js` — 6 sound categories, mute persistence |
| 020 | Save System | `saveManager.js` — auto-save + resume |
| 021 | Polish | UI refinements against design-inspiration review; edge-case verification |
| 022 | Testing (Regression Suite) | Coverage audit; deterministic exact-state scenarios; the N=100 AI-simulation batch |
| 023 | Web Release | Production build verification, performance pass, deployment docs — **MVP complete** |

## 4. Key numbers

- **219/219** automated tests passing (`node --test`, no external test
  framework)
- **60** cards, **8** ability types
- **2–4** players supported, AI or human, in any mix
- **~2.3MB** total deployable static payload
- **v1.0.0** — versioned MINOR per prompt throughout development, MAJOR
  at MVP completion

## 5. Where to look next

- `README.md` — how to run locally and deploy
- `docs/design/GDD.md` — full Game Design Document
- `docs/phases/mvp-progress.md` — per-prompt detailed history and notes
- `CHANGELOG.md` — version-by-version change log
- `docs/architecture/` — module map and non-negotiable dev rules
  (e.g. "engine modules never touch the DOM")
