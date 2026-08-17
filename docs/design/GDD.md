# TREASURE RAIDERS — Game Design Document

**Document Type:** Game Design Document / Master Pre-Production Document  
**Status:** Design & Architecture  
**Current Phase:** Phase 0 — Foundation  
**Platforms:** Web first, Unity later  
**Players:** 2–4  
**Session Length:** Approximately 10–20 minutes  
**Genre:** Push-Your-Luck / Hand-Management Card Game  
**Theme:** Pirate treasure hunting  
**Rules Architecture:** Engine-independent and UI-independent

---

## 1. Game Overview

### 1.1 High Concept

Treasure Raiders is a push-your-luck, hand-management card game in which pirate captains lead their crews into dangerous expeditions to collect treasure.

Players reveal treasure cards one at a time, growing the value of their current expedition while simultaneously increasing the risk of triggering a duplicate and losing the entire expedition to Shipwreck.

At every decision point, the player must choose between:

- **Explore Further** — reveal another card and increase potential rewards.
- **Return to Ship** — safely collect the current Expedition Area into Ship Cargo.

The game is built around a simple risk/reward curve:

> The deeper you explore, the greater the potential reward — and the greater the chance that one bad reveal destroys everything you have not yet secured.

### 1.2 Elevator Pitch

> You're a pirate captain racing rival crews through a cursed expedition of shipwrecks and buried gold — reveal treasure cards one at a time, bank your loot before disaster strikes, and outscore every rival captain before the map runs dry.

### 1.3 Player Fantasy

The player commands a small pirate crew on repeated risky forays into unstable wrecks, reefs, and treasure sites.

The central emotional decision is:

> "Do I take what I have, or risk everything for more?"

### 1.4 Session Structure

A complete game is designed to take approximately 10–20 minutes.

The game should provide:

- Fast turns
- Frequent decision points
- High tension
- Meaningful risk/reward decisions
- Replayability through shuffled decks
- Strategic interactions through card abilities
- Support for human and AI players

---

## 2. Design Pillars

### 2.1 Push Your Luck

The primary mechanic is controlled risk.

Every additional card potentially increases the player's eventual score, but also increases the probability of a duplicate and Shipwreck.

### 2.2 Simple Core, Deep Interactions

The base rules should be easy to understand:

1. Reveal a card.
2. Check for a duplicate.
3. Resolve its ability if it is safe.
4. Decide whether to continue or bank the expedition.

Depth comes from card abilities rather than from complicated base rules.

### 2.3 Data-Driven Design

Cards are data.

Card definitions belong in:

`data/cards.json`

Gameplay code must never depend on card names such as:

```text
if card.name == "Cannon"
```

Instead, abilities are referenced through an ability key:

```text
card.ability
```

This keeps the rules flexible and makes the system portable to Unity.

### 2.4 Engine Independence

The gameplay rules must not depend on:

- Browser DOM
- HTML
- CSS
- Unity APIs
- Unity-specific objects

The same logical rules must be implementable in Web JavaScript and Unity C#.

### 2.5 UI Independence

The UI is a presentation layer.

UI reads the game state but does not become the source of truth.

All gameplay mutations must pass through the game-management layer.

---

# 3. Core Gameplay Loop

```text
GAME START
  ↓
Build Treasure Deck + Lost Loot
  ↓
Determine Turn Order
  ↓
PLAYER TURN
  ↓
DRAW CARD
  ↓
ADD TO EXPEDITION
  ↓
DISPLAY CARD
  ↓
CHECK DUPLICATE
  ├── DUPLICATE
  │     ↓
  │   SHIPWRECK
  │     ↓
  │   Expedition → Lost Loot
  │     ↓
  │   END TURN
  │
  └── NO DUPLICATE
        ↓
      RESOLVE ABILITY
        ↓
      PLAYER DECISION
        ├── EXPLORE FURTHER → DRAW CARD
        │
        └── RETURN TO SHIP
              ↓
            Expedition → Ship Cargo
              ↓
            END TURN

After the Treasure Deck is empty:
  ↓
SCORING
  ↓
TIE BREAKER
  ↓
EXPEDITION COMPLETE
```

The game is card-driven rather than timer-driven.

---

# 4. Card System

## 4.1 Card Definition

All card definitions are stored in:

`data/cards.json`

A card definition contains:

- `id`
- `name`
- `type`
- `symbol`
- `value`
- `image`
- `ability`

Example conceptual structure:

```text
CardDefinition
├── id
├── name
├── type
├── symbol
├── value
├── image
└── ability
```

## 4.2 Card Instance

A card in gameplay is represented as a lightweight runtime instance.

```text
CardInstance
├── defId
├── currentZone
├── ownerId
└── runtime state
```

Possible zones:

- `deck`
- `lostLoot`
- `expedition`
- `cargo`

The definition remains static while the instance tracks runtime state.

---

# 5. Deck Composition

The confirmed initial deck model contains **60 cards**.

## 5.1 Card Distribution

There are 10 card types.

### Gold Coin

- Values: 4–9
- 6 cards
- No ability

### Other 9 Types

Each of the remaining nine types contains:

- Values: 2–7
- 6 cards per type
- One card per value

Therefore:

```text
Gold Coin:
6 cards

9 other types:
9 × 6 = 54 cards

TOTAL:
60 cards
```

## 5.2 Initial Lost Loot

The initial Lost Loot contains:

- Nine value-2 cards, one from each non-Gold-Coin type
- One Gold Coin value-4 card

Total:

```text
10 cards
```

## 5.3 Initial Treasure Deck

The remaining:

```text
60 - 10 = 50 cards
```

form the initial Treasure Deck.

Treasure Deck and Lost Loot are independently shuffled.

---

# 6. Game State

`GameState` is the single source of truth.

Conceptual structure:

```text
GameState
├── phase
├── treasureDeck
├── lostLoot
├── expeditionArea
├── players
│   ├── id
│   ├── name
│   ├── isAI
│   ├── shipCargo
│   └── score
├── currentPlayerIndex
├── turnHistory
├── abilityContext
└── config
```

## 6.1 State Ownership Rules

The UI must never directly mutate GameState.

UI reads state through selectors and calls actions exposed by the game-management layer.

Examples:

```text
getExpeditionArea()
getCurrentPlayer()
revealNextCard()
returnToShip()
resolveAbilityChoice()
```

Every mutation should emit an event so UI, animation, and audio systems can react without polling the state continuously.

---

# 7. State Machine

The game uses an explicit state machine.

```text
GAME_INIT
  ↓
PLAYER_TURN_START
  ↓
DRAW_CARD
  ↓
REVEAL_CARD
  ↓
CHECK_DUPLICATE
  ├── duplicate → SHIPWRECK → END_TURN
  │
  └── safe
        ↓
      RESOLVE_ABILITY
        ↓
      PLAYER_DECISION
        ├── Explore Further → DRAW_CARD
        └── Return to Ship → RETURN_TO_SHIP → END_TURN
```

At the end of a turn:

```text
Deck empty?
├── Yes → GAME_END → SCORING
└── No  → Next Player → PLAYER_TURN_START
```

All state transitions should be:

- Explicit
- Loggable
- Testable
- Deterministic

---

# 8. Card Resolution Order

This is the authoritative resolution order for every card entering the Expedition Area.

It applies to:

- Normal draws
- Compass previews
- Sea Serpent forced draws
- Dagger steals
- Anchor replays
- Treasure Map selections
- Other generated cards

## Step 1 — Card Enters Expedition

The card instance is added to the Expedition Area.

No ability has executed.

No duplicate check has executed.

## Step 2 — Card Is Displayed

The exact card is rendered face-up.

The player must see the card before the game reacts to its identity.

This rule applies even when the card is a duplicate.

## Step 3 — Duplicate Check

The new card's type/symbol is compared with all previous cards in the current Expedition Area.

### If Duplicate

Immediately trigger Shipwreck.

The duplicate card's ability does **not** execute.

All cards in the Expedition Area move to Lost Loot.

The turn ends.

No player decision occurs.

### If Not Duplicate

Continue to ability resolution.

## Step 4 — Ability Resolution

If the card has an ability, resolve it now.

Ability resolution occurs only after the duplicate check has passed.

Abilities that create additional cards must send those cards through the same resolution process.

## Step 5 — Player Decision

After ability resolution finishes, the player chooses:

- Explore Further
- Return to Ship

---

# 9. Shipwreck

Shipwreck is the primary failure state of the push-your-luck loop.

When a duplicate is revealed:

1. The duplicate enters the Expedition Area.
2. The duplicate is displayed.
3. The duplicate is detected.
4. Its ability is skipped.
5. All Expedition cards move to Lost Loot.
6. The Expedition Area is cleared.
7. The turn ends.

The duplicate card must never execute its own ability.

This ordering is a hard rule.

---

# 10. Return to Ship

When the player chooses Return to Ship:

- All cards currently in the Expedition Area are secured.
- They move to the current player's Ship Cargo.
- Cargo is sorted lowest-to-highest.
- The Expedition Area is cleared.
- The turn ends.

Cards secured in Ship Cargo are no longer at risk from the current expedition.

---

# 11. Scoring

Scoring takes place when the Treasure Deck is empty.

The primary score is calculated by taking the **highest card of each type** in a player's Ship Cargo.

Conceptually:

```text
Score =
highest Gold Coin
+ highest Type A
+ highest Type B
+ ...
```

Only the highest card of each type contributes to the main score.

## 11.1 Tie Breaker

If two or more players have the same score:

> The player with the most total cards in Ship Cargo wins.

---

# 12. Ability Architecture

Abilities are centralized.

The system exposes a conceptual resolver:

```text
resolveAbility(card, context)
```

Abilities are registered by ability key.

There must be no large conditional chain based on card names.

## 12.1 Ability Context

```text
AbilityContext
├── source
├── currentPlayer
├── targetPlayer
├── reason
├── isForced
├── isGenerated
└── parentAbility
```

Possible reasons include:

- `reveal`
- `forced`
- `anchor`
- `map`
- `dagger-steal`

---

# 13. Resolution Queue

Forced and generated abilities use a Resolution Queue.

```text
ResolutionQueue: AbilityContext[]
```

The resolver processes the queue iteratively.

Conceptually:

```text
while queue is not empty:
    process next context
    generated actions are appended to queue
```

Uncontrolled recursion is explicitly disallowed.

This is especially important for:

- Sea Serpent
- Pirate Dagger
- Lucky Anchor

A Sea Serpent that creates another Sea Serpent must extend the queue rather than recursively calling the resolver.

---

# 14. Card Abilities

There are eight non-trivial abilities defined in the design:

1. Compass
2. Cannon
3. Pirate Dagger
4. Captain Shield
5. Sea Serpent
6. Lucky Anchor
7. Treasure Chest + Golden Key
8. Treasure Map

Gold Coin has no ability.

---

## 14.1 Compass — Look Before You Explore

Compass creates a mandatory preview flow.

```text
COMPASS_REVEALED
  ↓
PEEK_TOP_CARD
  ↓
SHOW_PREVIEW
  ↓
PLAYER_CHOICE
```

### Return to Ship

The previewed card remains exactly where it was:

```text
Treasure Deck top = same card
```

The card is not removed.

The turn ends.

### Explore Further

The exact previewed card becomes the next draw.

It must not be replaced by another card.

The previewed card then enters the normal:

```text
ADD_TO_EXPEDITION
→ DISPLAY
→ DUPLICATE CHECK
→ ABILITY
→ DECISION
```

sequence.

---

## 14.2 Cannon — Destroy One Rival Card

Cannon is a single-resolution targeted ability.

It allows the current player to destroy one eligible rival card.

Cannon does not create a Resolution Queue chain.

The exact target-selection UI is handled by the modal/selection system.

---

## 14.3 Captain Shield — Protect Your Expedition

Captain Shield provides retroactive protection for the expedition.

The Shield interacts with duplicate resolution.

The ability is intentionally designed as a single-resolution ability rather than a chain ability.

Important edge cases:

- A Shield revealed as the first card protects nothing.
- A second Shield is still a normal duplicate.
- Shield does not grant general immunity to duplicate detection.

---

## 14.4 Pirate Dagger

Pirate Dagger is a post-MVP chain ability.

It can steal a card from another player's Ship Cargo and introduce that card into the current expedition/resolution flow.

Because the stolen card can itself trigger another ability, Dagger uses the Resolution Queue.

If the generated/stolen card creates a duplicate when it enters the Expedition Area, normal duplicate rules apply:

- It is displayed.
- Duplicate is detected.
- Its own ability does not execute.
- Shipwreck occurs.

---

## 14.5 Lucky Anchor

Lucky Anchor is a post-MVP ability.

It can replay a card from Ship Cargo into the current resolution flow.

The replayed card can cause a duplicate and can trigger further resolution.

Anchor therefore uses the Resolution Queue.

---

## 14.6 Sea Serpent

Sea Serpent is the highest-complexity ability.

It forces additional card reveals.

Forced reveals:

- Enter the Expedition Area normally.
- Are displayed before duplicate detection.
- Follow the complete Card Resolution Order.
- May trigger additional abilities.
- May trigger additional Sea Serpent cards.

Sea Serpent chains must be processed through the Resolution Queue.

No uncontrolled recursive resolver calls are allowed.

---

## 14.7 Treasure Map

Treasure Map interacts with Lost Loot.

It allows the player to search/select an eligible card from Lost Loot.

The selected/generated card enters the normal card-resolution pipeline.

If Lost Loot is empty or no valid card exists, the ability must degrade gracefully rather than producing an illegal state.

---

## 14.8 Treasure Chest + Golden Key

This is a post-MVP ability.

It is associated with Return to Ship rather than normal reveal resolution.

The design notes identify additional cards being drawn from Lost Loot.

The exact source-order behavior is identified as a rule detail to preserve during implementation; the current recommendation is random draw rather than player choice, distinguishing it from Treasure Map.

---

# 15. MVP Definition

The revised MVP includes:

- 2–4 players
- 1 human + basic AI
- Treasure Deck
- Lost Loot
- Expedition Area
- Ship Cargo
- Explore Further
- Return to Ship
- Duplicate detection
- Shipwreck
- Scoring
- Tie breaker
- Compass
- Cannon
- Captain Shield

Post-MVP abilities:

- Pirate Dagger
- Lucky Anchor
- Sea Serpent
- Treasure Map
- Treasure Chest + Golden Key

### MVP AI

A basic placeholder AI is acceptable initially.

Example threshold behavior:

```text
Expedition < 3 cards → Explore Further
Expedition >= 4 cards → Return to Ship
```

The final AI is refined later in the AI phase.

---

# 16. Player Structure

The game supports 2–4 players.

Each player has:

```text
Player
├── id
├── name
├── isAI
├── shipCargo
└── score
```

The current MVP targets one human player plus basic AI opponents.

AI difficulty is intentionally not deeply specified at the design stage.

---

# 17. AI Design

AI decisions primarily concern:

- Explore Further vs Return to Ship
- Ability targeting
- Risk management

The eventual AI should consider:

- Expedition size
- Current secured cargo
- Remaining safe card types
- Deck composition
- Risk of duplicate
- Current score
- Rival scores
- Ability opportunities

The first implementation should prioritize legal and stable behavior rather than sophisticated balancing.

---

# 18. Web Architecture

The Web version uses:

- HTML5
- CSS
- Vanilla JavaScript
- ES Modules
- JSON

No unnecessary framework is required.

## 18.1 Web Structure

```text
/project
  index.html

  /css
    main.css
    layout.css
    cards.css
    modal.css
    responsive.css
    animations.css

  /js
    main.js
    gameManager.js
    gameState.js
    cardManager.js
    deckManager.js
    turnManager.js
    abilityManager.js
    abilityResolver.js
    collectManager.js
    burnManager.js
    scoreManager.js
    playerManager.js
    uiManager.js
    modalManager.js
    localizationManager.js
    audioManager.js
    animationManager.js
    saveManager.js
    logger.js

  /data
    cards.json
    gameConfig.json
    localization.json

  /assets
    /cards
    /ui
    /icons
    /backgrounds
    /characters
    /audio

  /docs
```

## 18.2 Module Responsibilities

### gameManager.js

Thin orchestrator and public gameplay API.

### gameState.js

Owns GameState and controlled mutators.

### cardManager.js

Handles card instances and card-related operations.

### deckManager.js

Handles Treasure Deck and Lost Loot.

### turnManager.js

Drives state-machine transitions.

### abilityManager.js

Registers ability handlers.

### abilityResolver.js

Executes ability contexts and Resolution Queue.

### collectManager.js

Handles Return to Ship.

### burnManager.js

Handles Shipwreck.

### scoreManager.js

Handles scoring.

### playerManager.js

Handles player and AI-related logic.

### uiManager.js

DOM rendering only.

### modalManager.js

Selection and targeting UI.

### localizationManager.js

Localization and direction handling.

### audioManager.js

Audio event handling.

### animationManager.js

Gameplay animation coordination.

### saveManager.js

GameState serialization/restoration.

### logger.js

Tagged diagnostic logging.

---

# 19. UI Architecture

The UI is never the source of truth.

The UI:

- Reads state.
- Displays state.
- Sends user actions to gameManager.
- Does not directly mutate GameState.

Gameplay zones include:

- Treasure Deck
- Lost Loot
- Expedition Area
- Ship Cargo
- Opponents
- Actions
- Modals

The board should use a landscape-first architecture.

---

# 20. Localization

English and Persian are supported at launch.

All UI strings are keyed.

Example:

```text
data/localization.json
```

The root document direction changes:

```text
English → dir="ltr"
Persian → dir="rtl"
```

CSS should use logical properties such as:

```text
margin-inline-start
padding-inline-end
```

rather than assuming left-to-right layout.

Card artwork must remain language-neutral and must not embed text.

Number and score formatting should also pass through the localization layer.

---

# 21. Responsive / Landscape Design

The game is landscape-first.

The final orientation system uses an orientation gate that:

- Detects portrait orientation.
- Displays a rotate-device prompt.
- Blocks interaction until landscape orientation is restored.

Breakpoint tiers:

### XL

Desktop:

```text
≥ 1366px
```

Full board with generous spacing.

### MD

Tablet landscape:

```text
1024–1365px
```

### SM

Compact landscape:

```text
844–1023px
```

### XS

Phone landscape:

```text
approximately ≤ 932 × ≤ 430
```

The design should use layout reflow rather than simply scaling the entire board with transforms.

Potential responsive changes include:

- Collapsing rival-player areas
- Condensing action bars
- Reassigning CSS grid areas
- Reducing spacing
- Simplifying cargo presentation

---

# 22. Animation Requirements

Animations are part of presentation and must not corrupt gameplay state.

Important hard requirement:

> A duplicate card must visibly appear before Shipwreck resolves.

The system must therefore support synchronization between:

```text
Game Logic
↓
Render / Animation
↓
Resolution
```

Animation failures must not permanently deadlock the game.

A timeout/fallback strategy is recommended.

---

# 23. Audio

Audio events should be tied to gameplay events.

Important sound categories include:

- Card reveal
- Shipwreck
- Return to Ship
- Ability trigger
- Special ability
- Game completion

Audio must be muteable.

---

# 24. Save System

The Web MVP uses local persistence.

The save system serializes/restores GameState.

Saving should occur at discrete safe states rather than during the middle of an active ability chain.

The intended guarantee is:

```text
Save
→ Reload
→ Restore exact game state
```

---

# 25. Testing Strategy

Testing is built around deterministic scripted scenarios.

## 25.1 Unit Tests

Pure functions such as:

- Sorting
- Score calculation
- Duplicate detection
- Seeded shuffle

should be tested independently.

## 25.2 Integration Tests

Full turn and full-game scenarios should be tested.

Special attention is required for:

- Duplicate resolution
- Shipwreck
- Forced reveals
- Ability chains
- Empty Lost Loot
- Empty Treasure Deck
- Multiplayer turns

## 25.3 Deterministic Deck Tests

A test scenario should construct a known GameState and known deck order.

The state machine is then driven deterministically.

Expected state transitions and final state are asserted.

## 25.4 Manual / Visual Tests

Required for:

- Duplicate displayed before Shipwreck
- Animation ordering
- RTL layout
- Responsive breakpoints
- Orientation gate
- UI presentation

## 25.5 AI Simulation

Multiple AI-vs-AI games should eventually be simulated to detect:

- Illegal moves
- State corruption
- Infinite loops
- Unexpected crashes
- Ability-chain failures

---

# 26. Unity Port

Unity is the second target platform.

The Unity architecture mirrors the Web architecture at the system level.

```text
/Assets
  /Scripts
    /Core
      GameManager.cs
      GameState.cs
      TurnManager.cs

    /Deck
      DeckManager.cs
      CardManager.cs

    /Abilities
      AbilityManager.cs
      AbilityResolver.cs
      AbilityContext.cs

    /Players
      PlayerManager.cs
      Player.cs

    /Resolution
      CollectManager.cs
      BurnManager.cs

    /Scoring
      ScoreManager.cs

    /Systems
      LocalizationManager.cs
      AudioManager.cs
      AnimationManager.cs
      SaveManager.cs
      Logger.cs

    /UI
      UIManager.cs
      ModalManager.cs
      CardView.cs
      BoardView.cs

  /Data
    Cards.json
    GameConfig.json
    Localization.json

  /Art
    Cards
    UI
    Icons
    Backgrounds
    Characters

  /Audio

  /Prefabs
    Card.prefab
    Board.prefab
    Modal.prefab

  /Scenes
    MainMenu.unity
    Game.unity
```

The following structures must remain compatible between Web and Unity:

- Card definition schema
- GameState
- AbilityContext
- Rules
- Deterministic test scenarios

---

# 27. Art Direction

The project is strictly pirate / ocean / treasure themed.

The game must not visually, textually, or structurally reference the original Iranian/Persian inspiration.

Do not introduce:

- Iranian architecture
- Persian architecture
- Persian archaeology
- Persian historical objects
- Persian historical symbols
- Persian cultural references
- Archaeological motifs derived from the original inspiration

This is a hard production constraint.

The art direction should remain consistent with:

- Pirates
- Oceans
- Shipwrecks
- Treasure
- Maps
- Gold
- Tropical/coastal environments
- Cursed ruins interpreted generically within the pirate setting

Card artwork and icons should remain language-neutral.

---

# 28. Development Roadmap

## Phase 0 — Project Foundation

Goal:

- Repository structure
- Documentation skeleton
- Configuration foundation
- Logger
- HTML/CSS/JS foundation

No gameplay.

## Phase 1 — Data Architecture

Goal:

- Populate cards.json
- Finalize gameConfig.json
- Validate 60-card model

## Phase 2 — Game State

Goal:

- GameState
- Controlled mutators
- Card state

## Phase 3 — Deck System

Goal:

- Treasure Deck
- Lost Loot
- Shuffle

## Phase 4 — Turn System

Goal:

- State machine
- Round-robin turns
- No-ability loop

## Phase 5 — Push-Your-Luck Core

Goal:

- Explore Further
- Return to Ship

## Phase 6 — Duplicate / Shipwreck

Goal:

- Exact Card Resolution Order
- Shipwreck

## Phase 7 — Collection

Goal:

- Ship Cargo
- Sorting

## Phase 8 — Scoring

Goal:

- Highest-per-type scoring
- Tie breaker

## Phase 9 — Ability Framework

Goal:

- Ability registry
- Ability resolver
- Resolution Queue

## Phase 10a — MVP Abilities

Goal:

- Compass
- Cannon
- Captain Shield

## Phase 10b — Post-MVP Abilities

Goal:

- Pirate Dagger
- Lucky Anchor
- Sea Serpent
- Treasure Map
- Treasure Chest + Golden Key

## Phase 11 — Ability Chains

Goal:

- Chain integration tests
- Queue validation
- Forced reveal testing

## Phase 12 — UI

Goal:

- Board rendering
- Read-only UI layer

## Phase 13 — Card Interaction

Goal:

- User interaction
- Action routing

## Phase 14 — Modal System

Goal:

- Target selection
- Ability selection UI

## Phase 15 — Localization

Goal:

- Full EN/FA localization
- RTL support

## Phase 16 — Responsive / Landscape UI

Goal:

- Responsive tiers
- Orientation gate

## Phase 17 — Animations

Goal:

- Reveal
- Shipwreck
- Collection
- Ability animations

## Phase 18 — Audio

Goal:

- Gameplay sounds
- Mute support

## Phase 19 — AI

Goal:

- Functional AI
- Risk-based decision making

## Phase 20 — Save System

Goal:

- Local persistence
- Exact state restoration

## Phase 21 — Polish

Goal:

- UX pass
- Edge cases
- Stability

## Phase 22 — Testing

Goal:

- Permanent regression suite
- Full scenario coverage

## Phase 23 — Web Release

Goal:

- Production Web build
- Optimization
- Deployment

## Phase 24 — Unity Port

Goal:

- Port the validated rules architecture to Unity
- Reuse shared data structures
- Run the same scenario suite

---

# 29. Technical Risks

## 29.1 Ability Chain Correctness

Highest-risk system.

Mitigation:

- Resolution Queue
- No uncontrolled recursion
- Deterministic chain tests

## 29.2 Animation / Logic Ordering

Duplicate cards must be visible before Shipwreck.

Mitigation:

- Animation acknowledgment
- Timeout fallback

## 29.3 UI State Drift

DOM must never become authoritative.

Mitigation:

- Read-only UI
- gameManager actions
- centralized GameState

## 29.4 RTL

RTL must not be retrofitted as a superficial visual layer.

Mitigation:

- CSS logical properties from the UI phase onward

## 29.5 Web / Unity Parity

JavaScript and C# can behave differently around typing and asynchronous operations.

Mitigation:

- Shared data schemas
- Shared deterministic scenarios
- Cross-platform regression testing

## 29.6 Lost Loot Exhaustion

Abilities such as Map and Chest + Key may interact with an empty Lost Loot.

Mitigation:

- Graceful no-op/degrade behavior
- Explicit tests

## 29.7 Art-Direction Drift

Outsourced or AI-generated assets may accidentally introduce forbidden cultural references.

Mitigation:

- Asset checklist
- Explicit pirate-only art direction in every art-related phase

---

# 30. Development Rules

The following rules are mandatory throughout development:

1. Gameplay logic is engine-independent.
2. Gameplay logic is UI-independent.
3. Cards are data-driven.
4. Card names must not be hard-coded into gameplay logic.
5. UI never directly mutates GameState.
6. Every generated/forced card follows the same Card Resolution Order.
7. Duplicate cards never execute their own ability.
8. Duplicate cards are displayed before Shipwreck.
9. Ability chains use the Resolution Queue.
10. Uncontrolled recursion is forbidden for chain abilities.
11. No browser dialogs (`alert`, `confirm`, `prompt`).
12. Avoid unnecessary frameworks and dependencies.
13. Localization is key-based.
14. RTL uses logical CSS properties.
15. Landscape is the intended gameplay orientation.
16. Pirate/ocean/treasure art direction is mandatory.
17. No Iranian/Persian cultural or archaeological references.
18. Web implementation must be designed for later Unity porting.
19. Tests should be authored alongside the features they validate.
20. Phase boundaries must be respected.

---

# 31. Current Design Decisions

The following decisions are currently confirmed:

- Treasure Raiders is the working title.
- The game is a pirate treasure-hunting card game.
- Player count is 2–4.
- Session target is approximately 10–20 minutes.
- Initial deck size is 60 cards.
- One card exists per value per type.
- Gold Coin values are 4–9.
- Other types use values 2–7.
- Initial Lost Loot contains 10 cards.
- Initial Treasure Deck contains 50 cards.
- Duplicate cards are displayed before Shipwreck.
- Duplicate cards never execute their abilities.
- Compass uses an exact-card preview flow.
- Ability chains use an iterative Resolution Queue.
- Web is developed first.
- Unity is developed later.
- MVP includes Compass, Cannon, and Captain Shield.
- Dagger, Anchor, Sea Serpent, Map, and Chest + Key are post-MVP.
- English and Persian are supported.
- Landscape is the intended gameplay orientation.
- The UI never owns game state.

---

# 32. Open / Deferred Design Details

The following details remain implementation decisions or tuning points:

- Exact AI risk profile and difficulty progression.
- Final behavior of Treasure Chest + Golden Key when drawing from Lost Loot.
- Final presentation of responsive mobile-landscape layouts.
- Exact animation timings.
- Exact audio assets.
- Final visual art direction and card illustration set.
- Final save UX.
- Final UI copy and localization review.

These should be resolved during the phase that owns each system rather than being invented prematurely.

---

# 33. Definition of Done

Treasure Raiders is considered fully complete when:

- The complete 60-card model is implemented.
- Treasure Deck and Lost Loot are correct.
- Full push-your-luck gameplay works.
- Duplicate and Shipwreck behavior follows the authoritative resolution order.
- Scoring works correctly.
- All MVP abilities work.
- Post-MVP abilities work.
- Resolution Queue handles all chains safely.
- UI is fully playable.
- Localization works in English and Persian.
- RTL layout works.
- Landscape responsive behavior works.
- Animations and audio work.
- AI can complete legal games.
- Save/restore works.
- The full regression suite passes.
- The Web build is production-ready.
- The Unity port follows the same rules and passes the same scenarios.

---

# 34. Document Status

This document represents the current consolidated design and architecture direction for Treasure Raiders.

At the Phase 0 stage:

- No gameplay code should exist.
- `cards.json` should remain empty until Phase 1.
- Gameplay modules may exist as architectural stubs.
- The project foundation should be validated before gameplay implementation begins.

The next implementation milestone is:

**Phase 0 → Foundation → Prompt 001**
