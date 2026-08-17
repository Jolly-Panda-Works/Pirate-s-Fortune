# Stage B — Minimal Playable UI

پیش‌نیاز: تمام Prompt‌های Stage A تکمیل و تست‌شده باشند. تا اینجا بازی فقط از طریق
تست/کنسول قابل اجراست؛ هدف این Stage این است که بازی در مرورگر، با ماوس، حداقل
به زبان انگلیسی و بدون انیمیشن/صدای واقعی، قابل‌بازی شود.

---

## Prompt 012 — UI (Board Rendering)

**Phase:** 12 · **Files:** `js/uiManager.js`, `css/layout.css`, `css/cards.css`, `index.html` (zone markup)

```
Implement js/uiManager.js as a strictly read-only renderer (GDD §19, rule 5):
- Subscribes to gameState.js events (from Prompt 002) — never polls, never
  imports gameManager to call gameplay actions from here (input wiring is
  Prompt 013).
- Renders the zones listed in GDD §19: Treasure Deck, Lost Loot,
  Expedition Area, Ship Cargo, Opponents, Actions, Modals (modal root
  itself stays empty until Prompt 014).
- Every card/icon is rendered by calling js/iconManager.js's resolveIcon()
  with the card's ability key or type as the iconKey — never inline an
  emoji or path in uiManager.js directly (data-driven rule, see
  docs/architecture/data-driven-design.md).
- Fill in the zone markup inside #app-root in index.html (CSS grid areas
  in css/layout.css) and basic card visual states in css/cards.css
  (face-down, face-up — reveal/duplicate/secured states arrive with
  animations in Stage D, static styling is enough now).
- English-only text for now (hard-coded English strings are acceptable
  here ONLY as a temporary placeholder — Prompt 016 replaces every string
  with a localization key; note each one with a `// TODO(i18n)` comment so
  they're all findable).

Deliverable: a running page (npm start) that shows the current GameState
visually and updates live as gameState events fire, driven by a temporary
test harness (e.g. a debug script that calls gameManager actions from the
browser console) — real click-to-play input is Prompt 013.

Exit criteria: opening index.html and driving the game via console calls
to gameManager visibly updates the board with no console errors.
```

---

## Prompt 013 — Card Interaction

**Phase:** 13 · **Files:** `js/uiManager.js` (input wiring), new `js/inputManager.js` if it keeps concerns clean (optional)

```
Wire real user interaction:
- "Explore Further" / "Return to Ship" buttons (rendered by uiManager)
  call gameManager.revealNextCard() / gameManager.returnToShip() — the
  ONLY two mutation entry points a human player uses at this stage.
- No `alert`, `confirm`, or `prompt` anywhere (rule 11) — any needed
  confirmation uses in-page UI.
- Buttons must reflect legal actions only: e.g. disable both while it's
  not the human player's turn, disable during an AI turn.
- Route action clicks through a single function so future features (undo,
  input logging) have one seam to hook into — do not scatter
  addEventListener calls with inline logic across the file.

Deliverable: a human player can play a full game by clicking, no console
needed.

Exit criteria: manual playtest — start a 2-player game (1 human + 1 AI
using the Prompt-005 placeholder decision logic), play to completion via
clicks only, reach a correct scoring result.
```

---

## Prompt 014 — Modal System

**Phase:** 14 · **Files:** `js/modalManager.js`, `css/modal.css`

```
Implement js/modalManager.js — target/ability selection UI, needed
specifically for:
- Cannon (Prompt 010): select one eligible rival card to destroy. Replace
  the Prompt-010 placeholder (context.targetCardId passed directly) with
  a real modal flow: abilityResolver requests a target via modalManager,
  modalManager renders eligible targets into #modal-root, resolves a
  promise/callback with the player's choice, resolver continues.
- Compass (Prompt 010): the PLAYER_CHOICE step (Return to Ship / Explore
  Further after the preview) uses this same modal system rather than the
  generic turn-decision buttons, since it's a distinct decision point with
  its own context (the previewed card must be shown in the modal).
- Modal is rendered into #modal-root only; uiManager's zone rendering is
  untouched by modal state (separation of concerns, rule 5).
- Style via css/modal.css (basic overlay + centered panel is enough for
  MVP — polish arrives in Stage D).

Deliverable: js/modalManager.js implemented; Cannon and Compass flows
updated to go through it instead of their Stage-A placeholders.

Exit criteria: manual playtest — a game that includes Cannon and Compass
draws is fully playable via the modal, no console intervention needed.
```

---

## Prompt 015 — AI (Basic MVP AI)

**Phase:** 19 (pulled forward into Stage B because MVP requires at least
one AI opponent to be playable at all, per GDD §15)

**Files:** `js/playerManager.js`

```
Implement js/playerManager.js with the MVP threshold AI from GDD §15:

  Expedition < 3 cards -> Explore Further
  Expedition >= 4 cards -> Return to Ship

- Replace the Prompt-005 placeholder decision function with this one,
  called automatically by turnManager when the current player has
  isAI = true — no human input, no modal pause for AI turns (except where
  an AI must resolve a targeted ability like Cannon: pick the first
  eligible target deterministically for MVP, no smart targeting yet, per
  GDD §17 "prioritize legal and stable behavior over sophisticated
  balancing" for the first implementation).
- AI turns should still emit the same events as human turns (so uiManager
  renders them identically, just without waiting on input) — add a short
  artificial delay between AI actions ONLY at the UI layer (not inside
  playerManager) so a human watching an AI turn can follow what happened;
  playerManager itself must stay synchronous/deterministic and testable
  without timers.

Deliverable: js/playerManager.js implemented; 2-4 player games (any mix of
1 human + up to 3 AI) playable end-to-end without ever stalling.

Exit criteria — Stage B complete when:
- A full 4-player game (1 human, 3 AI) is playable start to finish in the
  browser via clicks only, in English, reaching a correct final score.
- No `alert`/`confirm`/`prompt` calls anywhere in js/.
Bump version (MINOR) and deliver zip + commit message per project
standards before moving to Stage C.
```
