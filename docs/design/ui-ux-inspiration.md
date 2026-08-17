# UI / UX Inspiration

Standing project rule: UI/UX decisions should draw on proven patterns from
well-known games with the same mechanic or presentation problem, rather
than inventing conventions from scratch.

## Closest mechanical reference: push-your-luck deck reveal

- **Incan Gold / Diamant** (board game) — the direct mechanical ancestor of
  this game's core loop (reveal → grow the pot → duplicate destroys it →
  bank or push). Its physical table layout (shared deck, per-player "path"
  of collected treasure, visible danger cards) is the clearest reference
  for how to lay out the Expedition Area and Ship Cargo zones.
- **Balatro** — strong reference for card reveal juice: how a single card
  flip communicates stakes through motion, sound, and a beat of pause
  before consequence lands. Relevant to Phase 17 (Animations) and the hard
  rule that a duplicate must be visibly shown before Shipwreck resolves
  (GDD §22).
- **Slay the Spire** — reference for clear "is this safe or not" visual
  language on cards, and for compact HUD design that stays readable at
  small sizes (relevant to the XS/phone-landscape breakpoint, GDD §21).
- **Hearthstone** — reference for opponent-area compression (how to show
  rival players' state at a glance without full detail), relevant to
  collapsing rival-player areas at smaller breakpoints (GDD §21).

## Notes

- These are references for interaction and layout patterns only — art
  direction stays pirate/ocean/treasure per GDD §27, never copying another
  game's visual identity or IP.
- Cite the specific pattern being borrowed (e.g. "Balatro-style flip beat
  before resolution") in PR descriptions when a UI decision is inspired by
  one of these, so the reasoning stays traceable.
