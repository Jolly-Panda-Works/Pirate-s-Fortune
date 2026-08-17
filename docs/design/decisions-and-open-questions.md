# Design Decisions & Open Questions

Source: GDD §31–32.

## Confirmed decisions

- "Treasure Raiders" is the working title.
- Pirate treasure-hunting card game.
- Player count: 2–4.
- Session target: ~10–20 minutes.
- Initial deck size: 60 cards; one card per value per type.
- Gold Coin values 4–9; other 9 types use values 2–7.
- Initial Lost Loot: 10 cards. Initial Treasure Deck: 50 cards.
- Duplicate cards are displayed before Shipwreck, and never execute their ability.
- Compass uses an exact-card preview flow.
- Ability chains use an iterative Resolution Queue.
- Web is developed first; Unity later.
- MVP abilities: Compass, Cannon, Captain Shield.
- Post-MVP abilities: Pirate Dagger, Lucky Anchor, Sea Serpent, Treasure Map, Treasure Chest + Golden Key.
- English and Persian are supported; landscape is the intended orientation.
- The UI never owns game state.

## Open / deferred (resolve during the phase that owns each system, not early)

- Exact AI risk profile and difficulty progression → Phase 19
- Treasure Chest + Golden Key's exact behavior drawing from Lost Loot → Phase 10b
- Final responsive mobile-landscape layouts → Phase 16
- Exact animation timings → Phase 17
- Exact audio assets → Phase 18
- Final visual art direction and card illustration set → art phases
- Final save UX → Phase 20
- Final UI copy and localization review → Phase 15
