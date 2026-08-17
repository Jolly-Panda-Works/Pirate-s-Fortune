# Development Roadmap

Source: GDD §28. Phase boundaries must be respected (GDD §30, rule 20) —
don't build ahead of the current phase.

| Phase | Name | Goal |
|---|---|---|
| 0 | Project Foundation | Repo structure, docs skeleton, config foundation, logger, HTML/CSS/JS shell |
| 1 | Data Architecture | Populate `cards.json`, finalize `gameConfig.json`, validate 60-card model |
| 2 | Game State | `GameState`, controlled mutators, card state |
| 3 | Deck System | Treasure Deck, Lost Loot, shuffle |
| 4 | Turn System | State machine, round-robin turns, no-ability loop |
| 5 | Push-Your-Luck Core | Explore Further, Return to Ship |
| 6 | Duplicate / Shipwreck | Exact Card Resolution Order, Shipwreck |
| 7 | Collection | Ship Cargo, sorting |
| 8 | Scoring | Highest-per-type scoring, tie breaker |
| 9 | Ability Framework | Ability registry, resolver, Resolution Queue |
| 10a | MVP Abilities | Compass, Cannon, Captain Shield |
| 10b | Post-MVP Abilities | Pirate Dagger, Lucky Anchor, Sea Serpent, Treasure Map, Chest + Key |
| 11 | Ability Chains | Chain integration tests, queue validation, forced reveal testing |
| 12 | UI | Board rendering, read-only UI layer |
| 13 | Card Interaction | User interaction, action routing |
| 14 | Modal System | Target selection, ability selection UI |
| 15 | Localization | Full EN/FA localization, RTL support |
| 16 | Responsive / Landscape UI | Responsive tiers, orientation gate |
| 17 | Animations | Reveal, shipwreck, collection, ability animations |
| 18 | Audio | Gameplay sounds, mute support |
| 19 | AI | Functional AI, risk-based decision making |
| 20 | Save System | Local persistence, exact state restoration |
| 21 | Polish | UX pass, edge cases, stability |
| 22 | Testing | Permanent regression suite, full scenario coverage |
| 23 | Web Release | Production web build, optimization, deployment |
| 24 | Unity Port | Port validated rules architecture to Unity, reuse shared data structures |

See [`../design/GDD.md`](../design/GDD.md) §28 for full detail per phase, and
§29 (Technical Risks) for the risks each phase should watch for.
