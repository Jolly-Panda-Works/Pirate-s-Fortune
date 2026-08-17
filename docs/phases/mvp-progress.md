# MVP Prompt Progress

وضعیت اجرای Promptهای [`../prompts/`](../prompts/README.md). هر ردیف بعد از
تکمیل و سبز شدن تست‌های مربوطه به‌روزرسانی می‌شود.

| Prompt | فاز | وضعیت | نسخه |
|---|---|---|---|
| 001 — Data Architecture | 1 | ✅ Done — 60 card model generated + validated (`tests/unit/deck-model.test.js`, 9/9 pass) | 0.5.0 |
| 002 — Game State | 2 | ⏳ Not started | — |
| 003 — Deck System | 3 | ⏳ Not started | — |
| 004 — Turn System | 4 | ⏳ Not started | — |
| 005 — Push-Your-Luck Core | 5 | ⏳ Not started | — |
| 006 — Duplicate / Shipwreck | 6 | ⏳ Not started | — |
| 007 — Collection | 7 | ⏳ Not started | — |
| 008 — Scoring | 8 | ⏳ Not started | — |
| 009 — Ability Framework | 9 | ⏳ Not started | — |
| 010 — Single-Resolution Abilities | 10a | ⏳ Not started | — |
| 010b — Chain Abilities | 10b | ⏳ Not started | — |
| 011 — Full Ability Chain Integration Tests | 11 | ⏳ Not started | — |
| 012 — UI (Board Rendering) | 12 | ⏳ Not started | — |
| 013 — Card Interaction | 13 | ⏳ Not started | — |
| 014 — Modal System | 14 | ⏳ Not started | — |
| 015 — AI | 19 | ⏳ Not started | — |
| 016 — Localization | 15 | ⏳ Not started | — |
| 017 — Responsive / Landscape UI | 16 | ⏳ Not started | — |
| 018 — Animations | 17 | ⏳ Not started | — |
| 019 — Audio | 18 | ⏳ Not started | — |
| 020 — Save System | 20 | ⏳ Not started | — |
| 021 — Polish | 21 | ⏳ Not started | — |
| 022 — Testing (Regression Suite) | 22 | ⏳ Not started | — |
| 023 — Web Release | 23 | ⏳ Not started | — |

## Notes on Prompt 001

- `data/cards.json`: full 60-card model generated programmatically (not
  hand-typed) to guarantee correctness — 1 Gold Coin type (values 4-9, no
  ability) + 9 other types (values 2-7 each, one ability key each; Treasure
  Chest and Golden Key are two separate card types sharing the
  `treasureChestGoldenKey` ability key per GDD §14.8).
- `data/gameConfig.json`: added `deck.otherTypes.typeKeys` and
  `initialLostLoot.cardIds` (exact derived card ids), so later phases (deck
  shuffling, tests) reference a checked source instead of re-deriving the
  rule by hand.
- `npm test` is now wired to `node --test` (Node's built-in test runner —
  no external dependency added, per rule 12) with a glob over
  `tests/**/*.test.js`, matching the empty-directory fix needed for it to
  work with the Phase-0 `tests/` skeleton.
