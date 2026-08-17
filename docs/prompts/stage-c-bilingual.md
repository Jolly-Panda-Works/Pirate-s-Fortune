# Stage C — Bilingual & Responsive

پیش‌نیاز: Stage B تکمیل شده — بازی در مرورگر با کلیک، به‌صورت تک‌زبانه (انگلیسی)
کاملاً قابل‌بازی است. این Stage الزام «بازی دو زبانه است، فارسی و انگلیسی» را برآورده
می‌کند — قبل از انیمیشن/صدا/پولیش، چون تجربه‌ی بازی فارسی‌زبان بخشی از هسته‌ی MVP است،
نه یک ویژگی جانبی.

---

## Prompt 016 — Localization (EN/FA + RTL)

**Phase:** 15 · **Files:** `js/localizationManager.js`, `data/localization.json`, `index.html`, every hard-coded string left with a `// TODO(i18n)` comment from Prompt 012/013/014

```
Implement js/localizationManager.js:
- loadLocale(langCode): loads data/localization.json, returns the strings
  object for that locale plus its `dir`.
- t(key): looks up a dotted key (e.g. "actions.exploreFurther") in the
  active locale; falls back to English with a logged warning
  (logger.js, tag "localizationManager") if a key is missing in the
  active locale — never throws, never renders a raw key to the player.
- setLocale(langCode): switches active locale, sets
  document.documentElement.lang and .dir accordingly (GDD §20:
  en -> ltr, fa -> rtl), and emits a "locale-changed" event so uiManager
  re-renders all text without a full page reload.
- A visible language switcher in the UI (simple EN/FA toggle is enough
  for MVP — placement/styling refined in Stage D polish).

Expand data/localization.json:
- Fill in EVERY string uiManager/modalManager render — go through each
  `// TODO(i18n)` comment left in Stage B and replace the hard-coded
  English string with a `t('key')` call, adding the matching key to both
  `en` and `fa` blocks (never leave a key in only one language).
- Keys needed at minimum: all zone labels, both action buttons, all
  ability names/descriptions used in the Compass/Cannon/Shield modals,
  Shipwreck/scoring messages, win/tie messages, the orientation-gate
  string already present.
- Card artwork stays language-neutral and must not embed text (GDD §20)
  — this only affects data/iconMap.json's `image` field later, not this
  prompt.

CSS check (do not skip): confirm css/*.css use logical properties
(margin-inline-*, padding-inline-*, etc.) wherever directional spacing was
written in Stage B with margin-left/right — fix any that assumed LTR
(GDD §29.4 — RTL must not be retrofitted as a superficial layer).

Deliverable: full EN/FA string coverage; language switch is instant and
complete (no leftover English when FA is active, no leftover LTR-only
spacing).
Add tests/unit/localization.test.js: every key present in `en` also exists
in `fa` and vice versa (symmetry check — prevents silent fallback bugs).

Exit criteria: test passes; manual playtest of a full game in Persian
(RTL) has no untranslated strings and no visually broken layout from
LTR-assumed spacing.
```

---

## Prompt 017 — Responsive / Landscape UI

**Phase:** 16 · **Files:** `css/responsive.css`, `js/uiManager.js` (orientation gate wiring), `index.html` (`#orientation-gate`, already present)

```
Implement the responsive/orientation system per GDD §21:
- Breakpoint tiers in css/responsive.css: XL (>=1366px), MD (1024-1365px),
  SM (844-1023px), XS (~<=932x430, phone landscape). Use layout reflow
  (CSS grid area reassignment / spacing reduction / collapsing rival areas
  / condensing action bars / simplifying cargo presentation per GDD §21),
  not transform-based scaling of the whole board.
- Wire the orientation gate (#orientation-gate in index.html): detect
  portrait orientation via the matchMedia/orientation API, show the
  rotate-device prompt and block interaction (aria-hidden the board or
  disable pointer-events) until landscape is restored. This logic can live
  in uiManager.js or a small dedicated function — keep it isolated so it's
  easy to find.
- Landscape is the intended orientation (rule 15) — the gate is a hard
  requirement, not optional polish, since MVP explicitly targets it.

Deliverable: the board reflows correctly at all four tiers; the
orientation gate blocks/unblocks correctly on a real mobile device or
browser dev-tools device emulation.

Exit criteria — Stage C complete when:
- A full game is playable in Persian (RTL) and in English, at every
  breakpoint tier, in both portrait-blocked and landscape-allowed states.
Bump version (MINOR) and deliver zip + commit message per project
standards before moving to Stage D.
```
