# Pirate's Fortune: 2D art prompts

These are ready-to-use prompts for every piece of 2D art the game needs. They fit the game's current look: low-poly 3D (Synty POLYGON style), a warm night palette lit by lanterns, and a navy-and-gold interface.

> **How to use (راهنمای استفاده):** The text in the **🎨 Master style** block goes at the start of every prompt, and then you add that asset's own prompt. Generate each image at the stated size, keep the file name exactly as written, and put it in the given folder. Once they're ready, say so and I'll wire them into the game.

---

## 🎨 Master style (prefix every prompt with this)

```
Stylized low-poly 3D render in the style of Synty POLYGON assets, flat-shaded
faceted geometry, clean simple shapes, soft ambient occlusion, warm golden
lantern light with cool navy-blue shadows, pirate treasure theme, game-ready
asset, crisp edges, no text, no watermark, no signature
```

**Palette:**

| Role | Hex |
|---|---|
| Deep navy (UI background) | `#0B1A2A` |
| Panel navy | `#12283F` |
| Gold (accents, frames) | `#E8B923` / highlight `#FFD86B` / shadow `#8A6410` |
| Parchment | `#F6E7C1` → `#D9B977` |
| Lantern glow | `#FFB35C` |
| Blood red (danger) | `#D64541` |

**Negative prompt** (if your tool supports one):

```
text, letters, watermark, signature, photorealistic, realistic skin, blurry,
noisy, grainy, cropped, extra limbs, deformed, busy background, gradient banding
```

---

## 1. Card illustrations: 10 images (most important)

These replace the emoji in the middle of each card. Each one is a single object, centred, on a transparent background.

- **Size:** 1024 × 1024 PNG, transparent background
- **Folder:** `client/public/art/cards/`
- **Composition:** object centred, filling about 75% of the frame, three-quarter view from slightly above, soft rim light in the card's colour

| File | Card | Accent colour | Prompt (after the master style) |
|---|---|---|---|
| `goldCoin.png` | Gold Coin | `#E8B923` | `a small heap of shining gold doubloons with a skull emblem stamped on the top coin, sparkling highlights, isolated on transparent background, golden rim light` |
| `compass.png` | Compass | `#2BB3A3` | `an ornate brass ship's compass with an open lid, glowing teal needle pointing north, engraved rose, isolated on transparent background, teal rim light` |
| `cannon.png` | Cannon | `#6C7A89` | `a black iron ship cannon on a wooden carriage firing a puff of smoke, cannonball beside it, isolated on transparent background, cool steel-grey rim light` |
| `captainShield.png` | Captain Shield | `#3C82D6` | `a round wooden-and-steel buccaneer shield with a gold skull-and-crossed-swords crest, faint blue magical glow, isolated on transparent background, blue rim light` |
| `pirateDagger.png` | Pirate Dagger | `#D64541` | `a curved pirate dagger with a ruby-studded hilt, blade catching red light, isolated on transparent background, crimson rim light` |
| `luckyAnchor.png` | Lucky Anchor | `#4A5FC1` | `a heavy iron ship's anchor wrapped in rope with a small four-leaf clover charm tied on, isolated on transparent background, royal-blue rim light` |
| `seaSerpent.png` | Sea Serpent | `#3FA34D` | `a coiled green sea serpent rising from a small splash of water, fins and scales, menacing grin, isolated on transparent background, emerald rim light` |
| `treasureMap.png` | Treasure Map | `#B9864A` | `a rolled-open parchment treasure map with a red X, dotted path and tiny island, edges curling, isolated on transparent background, warm brown rim light` |
| `treasureChest.png` | Treasure Chest | `#9B59B6` | `an open wooden treasure chest with iron bands overflowing with gold coins and purple gems, isolated on transparent background, violet rim light` |
| `goldenKey.png` | Golden Key | `#F39C12` | `an ornate golden skeleton key with a skull-shaped bow and a small ribbon, glinting, isolated on transparent background, amber rim light` |

---

## 2. Card back: 1 image

- **File:** `client/public/art/cards/back.png`, 1024 × 1434 (5:7 ratio), opaque
```
playing card back design for a pirate card game, deep navy (#0B1A2A) field
with a fine diagonal rope pattern, ornate gold (#E8B923) double border with
corner flourishes, a large gold skull-and-crossbones emblem inside a ship's
wheel in the centre, symmetrical, flat front view, no text
```

## 3. Parchment card face base (optional)

- **File:** `client/public/art/cards/parchment.png`, 1024 × 1434, opaque
```
blank aged parchment texture for a playing card face, warm cream to tan
gradient (#F6E7C1 to #D9B977), subtle stains and fibres, slightly darker
vignette edges, flat front view, empty centre, no text, no border
```

---

## 4. Logos and identity

| File | Size | Prompt (after the master style) |
|---|---|---|
| `client/public/art/logo/logo-emblem.png` | 1024 × 1024, transparent | `game logo emblem: a golden skull wearing a red pirate bandana over crossed cutlasses, a ship's wheel behind, treasure coins at the bottom, bold readable silhouette, isolated on transparent background` |
| `client/public/art/logo/logo-banner.png` | 2048 × 768, transparent | `wide decorative pirate banner for a game title: a torn parchment scroll ribbon held by two golden anchors, gold coins and a small skull at the centre, empty space in the middle for title text, isolated on transparent background` |
| `client/public/art/logo/studio.png` | 1024 × 1024, transparent | `cute friendly panda wearing a pirate tricorn hat and an eyepatch, holding a gold coin, mascot logo, isolated on transparent background` |

> The title "Pirate's Fortune" is set by the game in the Pirata One font, so don't put text in the images.

## 5. App icon and Android splash

| File | Size | Prompt |
|---|---|---|
| `client/public/art/app/icon.png` | 1024 × 1024, opaque | `mobile game app icon: golden skull with red bandana in front of an open treasure chest spilling gold coins, deep navy background with warm golden glow, bold centred composition, rounded-square safe area, no text` |
| `client/public/art/app/icon-foreground.png` | 1024 × 1024, transparent | `same golden skull and treasure chest as an app icon foreground, centred inside the middle 66% of the canvas, isolated on transparent background` |
| `client/public/art/app/splash.png` | 2732 × 2732, opaque | `night sea with a low-poly pirate galleon silhouette under a big moon, lantern-lit sails, deep navy sky fading to gold at the horizon, calm centred composition with empty space in the middle, no text` |

## 6. Backgrounds

| File | Size | Prompt |
|---|---|---|
| `client/public/art/bg/loading.png` | 1920 × 1080 | `interior of a pirate captain's cabin at night, big stern windows with moonlight, treasure on the floor, hanging brass lanterns, warm and moody, shallow depth of field, lower third darker for UI text` |
| `client/public/art/bg/arena-ship.png` | 800 × 450 | `cosy low-poly ship's cabin around a green-felt card table, lanterns, barrels and a ship's wheel, warm light, thumbnail illustration` |
| `client/public/art/bg/arena-tavern.png` | 800 × 450 | `cosy low-poly pirate tavern around a card table, candle chandelier, bar with bottles, fireplace glow, thumbnail illustration` |

---

## 7. Character portraits: 15 images

These are for lobby seats, the profile and table name tags. Same framing for all: **bust portrait, three-quarter view, looking slightly toward camera, circular composition, on a transparent background**.

- **Size:** 512 × 512 PNG, transparent
- **Folder:** `client/public/art/portraits/`
- **Shared portrait prompt** (after the master style): `low-poly character bust portrait, head and shoulders, three-quarter view, friendly expressive face, soft golden key light from the left, navy rim light from the right, isolated on transparent background`

| File (= roster id) | Description to append |
|---|---|
| `redbeard.png` | `pirate captain with a black tricorn hat, red coat with gold trim, bushy red beard, gold earring` |
| `anne.png` | `female pirate quartermaster, teal bandana, long dark-brown hair, leather vest, confident smirk` |
| `barnaby.png` | `old seaman, grey wool beanie, long white beard, blue sweater, smoking a small pipe` |
| `bones.png` | `cheerful pirate skeleton, black bicorne hat, eyepatch over an empty socket, purple shirt` |
| `mei.png` | `tavern barmaid, black hair in a bun, white blouse with a purple corset, holding a tankard` |
| `hook.png` | `first mate, navy tricorn, goatee, eyepatch, iron hook hand raised` |
| `tom.png` | `young deckhand, red bandana, striped shirt, stubble, friendly grin` |
| `grace.png` | `noble lady, blonde hair in an updo, elegant blue dress with lace, feathered hat` |
| `blackbeard.png` | `infamous pirate Blackbeard, long braided black beard, black tricorn, dark coat, fierce` |
| `rattles.png` | `skeleton pirate, red bandana, cracked skull, mischievous grin` |
| `ghost.png` | `ghostly skeleton captain, translucent pale-blue glow, tattered tricorn` |
| `navy.png` | `navy captain, white powdered wig, black bicorne, blue coat with gold epaulettes` |
| `governor.png` | `colonial governor, white wig, purple velvet coat, gold chain, haughty expression` |
| `redcoat.png` | `marine sergeant, blue uniform with white crossed straps, tricorn with gold trim` |
| `gentleman.png` | `gentleman adventurer, brown frock coat, cravat, monocle, neat moustache` |

---

## 8. UI icon set: 18 icons

- **Size:** 256 × 256 PNG, transparent
- **Folder:** `client/public/art/icons/`
- **Shared style:** `game UI icon, chunky low-poly object, gold (#E8B923) and warm wood tones, thick dark outline, soft drop shadow, isolated on transparent background, readable at 32px`

| File | Description |
|---|---|
| `explore.png` | `small sailing ship cresting a wave, sails full` |
| `return.png` | `rowboat heading to a ship with a curved arrow` |
| `deck.png` | `stack of playing cards with a skull card back` |
| `lostloot.png` | `skull resting on sunken coins underwater` |
| `shipwreck.png` | `broken ship hull with splintered planks and splash` |
| `shield.png` | `round shield with a blue glow` |
| `score.png` | `gold star medallion with a coin` |
| `cargo.png` | `wooden cargo crate with rope` |
| `turn.png` | `hourglass with gold sand` |
| `settings.png` | `ship's wheel shaped like a cog` |
| `profile.png` | `tricorn hat on a captain's bust` |
| `howto.png` | `rolled scroll with a quill` |
| `multiplayer.png` | `three crossed cutlasses` |
| `solo.png` | `single cutlass against a robot-skeleton head` |
| `chat.png` | `parrot with a speech bubble` |
| `trophy.png` | `golden goblet trophy overflowing with coins` |
| `music.png` | `concertina accordion with notes` |
| `language.png` | `globe with a compass rose` |

## 9. Rank badges: 6 images

These are for the profile ranks, from Deckhand up to Legend of the Seas.

- **Size:** 512 × 512 PNG, transparent
- **Folder:** `client/public/art/ranks/`
- **Shared style:** `military-style rank badge, shield-shaped emblem, low-poly metal, isolated on transparent background`

| File | Description |
|---|---|
| `rank-1.png` | `plain wooden badge with a rope border and a single anchor` (Deckhand) |
| `rank-2.png` | `bronze badge with crossed oars` (Boatswain) |
| `rank-3.png` | `silver badge with a ship's wheel` (First Mate) |
| `rank-4.png` | `gold badge with a tricorn hat and crossed swords` (Captain) |
| `rank-5.png` | `gold badge with a crown above a skull, rubies` (Pirate Lord) |
| `rank-6.png` | `radiant gold-and-sapphire badge with a sea serpent coiled around a trident, glowing` (Legend of the Seas) |

---

## Delivery checklist

- [ ] 10 card illustrations, 1 card back (and optionally the parchment base)
- [ ] 3 logos, 3 app icon / splash files
- [ ] 3 backgrounds
- [ ] 15 character portraits
- [ ] 18 UI icons
- [ ] 6 rank badges

Total: **59 images** (60 with the optional parchment).
