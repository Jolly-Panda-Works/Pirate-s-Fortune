# Data-Driven Design

Standing project rule (reinforces GDD §2.3 / development rule 3/4): nothing
that will need to change post-launch should be hard-coded. If it's tunable,
swappable, or content, it belongs in `/data`, not in JS.

## Current data files

| File | Owns |
|---|---|
| `data/cards.json` | Card definitions (id, name, type, symbol, value, image, ability) |
| `data/gameConfig.json` | Deck composition, player counts, session targets, ability lists, asset mode |
| `data/localization.json` | All UI strings, keyed, per language, with `dir` |
| `data/iconMap.json` | iconKey → emoji/image mapping (see below) |

## Icon abstraction (emoji now, artwork later)

Phase 1 ships with emoji as placeholder card/UI icons — fast to iterate on,
no art pipeline dependency. To guarantee the later swap to real artwork
never touches gameplay or UI code:

1. Every icon is referenced in code by a logical **iconKey**
   (`"goldCoin"`, `"action.returnToShip"`, etc.) — never by a literal emoji
   or file path.
2. `data/iconMap.json` maps each iconKey to both an `emoji` and an `image`
   value. Only one is populated today (`emoji`); `image` stays `null`.
3. `data/gameConfig.json`'s `assets.iconMode` (`"emoji"` | `"image"`)
   decides which one renders.
4. `js/iconManager.js` is the single resolver every other module calls —
   `resolveIcon(iconKey)` — and is the only place that reads `iconMode`.

**To swap to real art later:** fill in `image` paths in `iconMap.json` and
flip `iconMode` to `"image"` in `gameConfig.json`. No JS file changes, no UI
file changes. If an `image` path is missing for a given key, `iconManager.js`
falls back to that key's emoji automatically, so migration can happen
gradually, icon by icon.

## Rule for future data

Before adding any new hard-coded constant, ability name, tunable number, or
UI string to a JS file, ask: does this belong in `/data` instead? Per
development rule 4, gameplay logic must never branch on a card name or
literal string — only on data-defined keys.
