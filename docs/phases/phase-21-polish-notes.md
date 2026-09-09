# Phase 21 — Polish Notes (Prompt 021)

A running punch-list, kept as the prompt requires ("so nothing is fixed
silently and untracked"). Each item below is either **Fixed** (with what
changed and where) or **Verified — no bug found** (with how it was
checked). Exit criteria: no known crash or stuck-state bug remains open
on this list — see the summary at the bottom.

---

## Part 1 — UI/UX pattern review (`docs/design/ui-ux-inspiration.md`)

Walked each of the four cited patterns against the actual implementation
(`js/uiManager.js`, `css/*.css`) as of v0.25.0.

### 1. Incan Gold / Diamant — layout clarity

**Verified — no major gap found.** `css/layout.css`'s grid already
mirrors the physical-table reference reasonably closely: the shared,
not-yet-claimed pot (Expedition Area) sits front-and-center in the
middle row, the shared deck and Lost Loot flank it, and the current
player's own collected pile (Ship Cargo) gets its own full-width row
below — the "shared deck + community pot + personal path" shape the
reference calls for. No change made here; this pattern's own gap turned
out to be smaller than the other three below, so effort went there
instead (see the prompt's own "fix the biggest gaps first").

Minor, non-functional observation (not worth a fix on its own): `.opponent--current`
in `css/layout.css` is dead CSS — `renderOpponents()` in `js/uiManager.js`
has always deliberately skipped the current player's index (`if (index
=== currentIndex) return;`, since that player gets their own big Ship
Cargo zone instead), so this class is never actually applied to
anything. Harmless, but noted here for anyone auditing CSS coverage
later.

### 2. Balatro — reveal beat / duplicate-visible pause

**Verified — no gap found.** Already solid from Prompt 018:
`css/animations.css`'s `card-reveal`/`card-duplicate-flash` keyframes
give a real flip-in beat and an unmissable flash before Shipwreck's
aftermath ever renders, backed by `js/animationManager.js`'s own
render-gating hold (the actual GDD §22 guarantee — the animation itself
is polish on top of that, per that file's own header). No change made.

### 3. Slay the Spire — safe/danger card visual language

**Fixed.** Before this prompt, every face-up card looked identical
(`.card--face-up` in `css/cards.css`) regardless of what it was — no
persistent visual cue distinguished an offensive ability (Cannon, Pirate
Dagger, Sea Serpent) from a defensive/informational one (Captain Shield,
Compass) from a beneficial one (Lucky Anchor, Treasure Map, Treasure
Chest + Golden Key). The only color-coding that existed
(`css/animations.css`'s per-ability `--ability-glow-color`) was
transient — visible only during the ~500ms resolution glow, gone the
moment the card settles into the Expedition Area or Ship Cargo.

Note on what "safe/danger" means in this game specifically, since it's
mechanically different from Slay the Spire's own Attack/Skill/Power
split: **every** card type here (including Gold Coin) is equally
duplicate-risky once its type has already appeared this expedition —
there's no fundamentally "safe" card the way STS has non-damaging
Skills. So rather than inventing a misleading "safe" category, the fix
differentiates the one thing that genuinely IS a fixed property of a
card: what its ability actually *does* (offense / defense-or-information
/ benefit) — the closest honest analog to STS's own card-type language.

- `js/uiManager.js`'s `createCardElement()` now sets
  `el.dataset.abilityKey` to the same `iconKey` (`definition.ability ??
  definition.type`) it already computed for icon resolution — no new
  logic, just exposing an existing value.
- `css/cards.css` adds a persistent `border-inline-start` accent on
  `.card--face-up[data-ability-key]`, reusing the exact color
  categorization `css/animations.css`'s glow palette already
  established: red (`--color-danger`) for Cannon/Pirate Dagger/Sea
  Serpent, blue (`#4fa8e8`) for Captain Shield/Compass, gold
  (`--color-gold`) for Lucky Anchor/Treasure Map/Treasure Chest+Golden
  Key. Gold Coin intentionally gets no rule (stays visually neutral, per
  the note above). Logical property (`border-inline-start`, not
  `border-left`) — correct under RTL with no separate override (GDD
  §29.4).
- Data-driven, rule 4-compliant: a new ability only ever needs one new
  3-line color rule in `css/cards.css`, never a `js/uiManager.js` change.
- Verified via a one-off hand-rolled DOM-shim script (no jsdom
  available): rendered a real mid-game board with a Cannon in the
  current player's cargo, a Sea Serpent in the Expedition Area, and a
  Gold Coin — confirmed `dataset.abilityKey` is set correctly on each
  (`"cannon"`, `"seaSerpent"`, `"goldCoin"`), with zero exceptions.

### 4. Hearthstone — opponent-area compression

**Fixed.** Before this prompt, `renderOpponents()` rendered every
individual card in a rival's Ship Cargo at full detail, at every
breakpoint — `css/responsive.css`'s SM/XS tiers only trimmed the
per-opponent name label and score-preview line, never the growing card
list itself, which is what actually gets cluttered as a game goes on
(late-game rivals routinely hold a dozen+ secured cards after several
successful expeditions). This is exactly the gap GDD §21's own wording
("collapsing rival-player areas at smaller breakpoints") already named
as a goal but hadn't fully delivered on.

- `js/uiManager.js`'s `renderOpponents()` now renders BOTH a full card
  row (`.opponent__cards`, unchanged from before) AND a new compact
  one-line summary (`.opponent__summary` — a card-back icon + "N cards")
  for every rival with cargo, following this file's own established
  responsive philosophy (Prompt 017's own header: "layout REFLOW...
  never rendering logic changes, only how much space/what size those
  existing elements get").
- `css/layout.css` hides `.opponent__summary` by default (XL/MD — full
  detail, plenty of room); `css/responsive.css`'s SM tier flips it
  (`.opponent__cards { display: none; } .opponent__summary { display:
  flex; }`) — a rival's exact holdings were never actionable information
  the way the current player's own cargo is, only their tentative score
  and count, both of which the summary line still carries.
- New `zones.opponentCardCountOne`/`Other` localization keys, added
  symmetrically to `en`/`fa`.
- Verified via the same DOM-shim script: an opponent with 3 cargo cards
  renders both `.opponent__cards` and a `.opponent__summary` whose text
  includes "3", with zero exceptions.

---

## Part 2 — Edge cases (GDD §29.6 and others), re-verified under real UI conditions

The prompt explicitly asks these be re-checked "under real UI
conditions, not just unit tests" — each of these already had solid
engine-level test coverage from earlier prompts (Prompt 010b's
`tests/integration/chain-abilities.test.js`/`ability-chains.test.js`),
but none of that coverage exercised `uiManager.js`/`modalManager.js`/
`animationManager.js` actually rendering around the edge case. A
one-off hand-rolled DOM-shim script (no jsdom available; mirrors the
precedent from Prompts 019/020's own verification scripts) drove real
games through `turnManager.js` and called `uiManager.render()` +
`modalManager.render()` after each case.

### Empty Lost Loot — Treasure Map

**Verified — no bug found.** With Lost Loot genuinely empty,
`turnManager.resolveAbility()`'s own `eligibleOptions.length > 0` gate
(Prompt 014) already prevents ever pausing at `PLAYER_CHOICE` for a
0-option target pool — the ability resolves immediately as a no-op
(`abilities/treasureMap.js`'s own graceful degrade, Prompt 010b) and no
modal ever opens. Confirmed: `#modal-root` stays empty, phase reaches
`PLAYER_DECISION` cleanly, zero exceptions across `uiManager.render()` +
`modalManager.render()`.

### Empty Lost Loot — Treasure Chest + Golden Key at Return to Ship

**Verified — no bug found.** `abilities/treasureChestGoldenKey.js`'s own
empty-Lost-Loot no-op (Prompt 010b) holds under real UI conditions too:
`turnManager.returnToShip()` completes normally, the player's Ship Cargo
gains only the Chest itself (no bonus card), both render calls succeed
with zero exceptions.

### Treasure Deck reaching exactly 0 mid-reveal, including mid Sea Serpent chain

**Verified — no bug found.** Scripted a Sea Serpent as the very last
card in an otherwise-empty deck: `abilities/seaSerpent.js`'s own
empty-deck no-op (Prompt 010b) holds — no forced reveal happens, the
chain simply doesn't continue, and (this is the part genuinely worth
re-checking under real rendering, since it wasn't exercised by the
existing engine-only tests) `renderTreasureDeck()` correctly shows no
face-down pile card for a 0-length deck rather than a stale/leftover
one. Zero exceptions.

### A player with an empty Ship Cargo at scoring

**Verified — no bug found** (this specific combination — reaching
`SCORING` with a player holding literally zero cards, e.g. because their
only reveal Shipwrecked — wasn't previously covered end-to-end).
Scripted a guaranteed same-type duplicate on a player's very first
reveal (immediate Shipwreck) with the deck already empty, so `endTurn()`
routes straight to `GAME_END`/`SCORING`. Confirmed: `scoreManager`
correctly returns a score of `0` for the empty-cargo player (no
divide-by-zero, no exception, no `NaN`), `getResults().scores` reflects
it correctly, and `uiManager.render()`'s results banner renders normally
even with an empty-cargo player among the results — zero exceptions.

---

## Part 3 — Stability pass

Per the prompt's own note, the FULL AI-simulation batch (GDD §25.5,
N=100+) is explicitly Prompt 022's own deliverable, not this one's — but
this prompt still calls for "no uncaught exceptions across a batch of
full playthroughs" before its own punch-list can close out. Ran a
lighter-weight sanity batch (not part of the permanent test suite; a
one-off script, same precedent as the DOM-shim verifications above) as a
pre-check:

- **180 AI-vs-AI full games** (60 each at 2, 3, and 4 players), each with
  a distinct deterministic seed, driven end-to-end via
  `gameManager.startGame()` with no human input.
- **Result: 0 crashes, 0 stuck states (every game reached `SCORING`), 0
  malformed results** (every game's `getResults().winners` was a real,
  non-empty array). Max observed `turnHistory` length: 19.
- This doesn't replace Prompt 022's own official N=100 harness (which
  will also assert no illegal moves / no ability-chain failures more
  rigorously) — it's a scoped, honest pre-check confirming nothing
  egregious is broken going into that prompt, consistent with this
  prompt's own "(see Prompt 022's AI-simulation output for this)"
  wording.

---

## Summary — exit criteria

| # | Item | Status |
|---|------|--------|
| 1 | Incan Gold/Diamant layout clarity | Verified — no gap found |
| 2 | Balatro reveal beat | Verified — no gap found |
| 3 | Slay the Spire safe/danger card language | **Fixed** — persistent per-ability accent border (`css/cards.css`, `js/uiManager.js`) |
| 4 | Hearthstone opponent compression | **Fixed** — compact summary line at SM/XS (`js/uiManager.js`, `css/layout.css`, `css/responsive.css`, `data/localization.json`) |
| 5 | Empty Lost Loot — Treasure Map | Verified — no bug found |
| 6 | Empty Lost Loot — Treasure Chest+Golden Key | Verified — no bug found |
| 7 | Treasure Deck exactly 0 mid-reveal / mid Sea Serpent chain | Verified — no bug found |
| 8 | Empty Ship Cargo at scoring | Verified — no bug found |
| 9 | Stability (180-game AI batch) | Verified — 0 crashes/stuck-states |

**No known crash or stuck-state bug remains open on this list.** Full
engine test suite: 215/215, zero regressions from the two UI fixes
above.
