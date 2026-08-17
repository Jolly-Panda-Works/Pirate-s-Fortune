# Development Rules

Source: GDD §30. These are mandatory throughout development — not
suggestions. Every PR/commit should be checked against this list.

1. Gameplay logic is engine-independent.
2. Gameplay logic is UI-independent.
3. Cards are data-driven.
4. Card names must not be hard-coded into gameplay logic (dispatch via `card.ability`).
5. UI never directly mutates `GameState`.
6. Every generated/forced card follows the same Card Resolution Order (GDD §8).
7. Duplicate cards never execute their own ability.
8. Duplicate cards are displayed before Shipwreck.
9. Ability chains use the Resolution Queue.
10. Uncontrolled recursion is forbidden for chain abilities.
11. No browser dialogs (`alert`, `confirm`, `prompt`).
12. Avoid unnecessary frameworks and dependencies.
13. Localization is key-based.
14. RTL uses logical CSS properties (`margin-inline-*`, not `margin-left`).
15. Landscape is the intended gameplay orientation.
16. Pirate/ocean/treasure art direction is mandatory.
17. No Iranian/Persian cultural or archaeological references (GDD §27 — hard constraint).
18. Web implementation must be designed for later Unity porting.
19. Tests should be authored alongside the features they validate.
20. Phase boundaries must be respected.

## Architecture-relevant excerpts

**Card Resolution Order (GDD §8)** — applies to every card entering the
Expedition Area (normal draws, Compass previews, Sea Serpent forced draws,
Dagger steals, Anchor replays, Treasure Map selections):

1. Card enters Expedition (no ability, no duplicate check yet)
2. Card is displayed face-up
3. Duplicate check — if duplicate: Shipwreck, ability skipped, no player decision
4. Ability resolution (only if not a duplicate)
5. Player decision: Explore Further / Return to Ship

**Resolution Queue (GDD §13)** — forced/generated abilities are processed
iteratively, never via recursive resolver calls:

```
while queue is not empty:
    process next context
    generated actions are appended to queue
```

**Art direction constraint (GDD §27)** — hard production constraint, applies
to every art-related phase: no Iranian/Persian architecture, archaeology,
historical objects, symbols, or cultural references of any kind. Pirate/
ocean/treasure themed only.
