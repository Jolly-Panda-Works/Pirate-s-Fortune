/**
 * shipwreck.test.js
 *
 * Covers Prompt 006 exit criteria for js/burnManager.js + js/turnManager.js
 * (GDD §8 Step 3, §9): construct a deterministic deck where the 3rd card
 * duplicates the 1st card's type, and assert —
 *   - Shipwreck triggers
 *   - the duplicate's own ability never executes (explicitly asserted via
 *     a spy on the RESOLVE_ABILITY phase transition, not just inferred
 *     from the final state)
 *   - Lost Loot grows by exactly the cards that were in the Expedition Area
 *   - the Expedition Area is empty immediately after Shipwreck
 *
 * Also covers burnManager.isDuplicate()/triggerShipwreck() directly as
 * pure-function unit checks, and a couple of turnManager-level integration
 * properties (no player decision occurs; turn ends and advances).
 *
 * Run with: node --test tests/integration/shipwreck.test.js
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as gameManager from '../../js/gameManager.js';
import * as gameState from '../../js/gameState.js';
import * as cardManager from '../../js/cardManager.js';
import * as burnManager from '../../js/burnManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
const cardsFile = JSON.parse(readFileSync(path.join(dataDir, 'cards.json'), 'utf-8'));
const config = JSON.parse(readFileSync(path.join(dataDir, 'gameConfig.json'), 'utf-8'));
const cardDefs = cardsFile.cards;

beforeEach(() => {
  gameState.resetState();
  gameState.clearAllListeners();
  cardManager.resetInstanceCounter();
});

function buildPlayers() {
  return [
    { id: 'p1', name: 'Player 1', isAI: false, shipCargo: [], score: 0 },
    { id: 'p2', name: 'Player 2', isAI: false, shipCargo: [], score: 0 },
  ];
}

// ---------------------------------------------------------------------------
// burnManager.js unit-level checks (pure functions, no game loop involved).
// ---------------------------------------------------------------------------

test('burnManager.isDuplicate: true when another Expedition Area card shares the candidate\'s type', () => {
  const compassA = cardManager.createCardInstance(
    cardDefs.find((d) => d.id === 'compass-v6'),
    cardManager.ZONES.EXPEDITION
  );
  const compassB = cardManager.createCardInstance(
    cardDefs.find((d) => d.id === 'compass-v3'),
    cardManager.ZONES.EXPEDITION
  );
  const cannon = cardManager.createCardInstance(
    cardDefs.find((d) => d.id === 'cannon-v5'),
    cardManager.ZONES.EXPEDITION
  );

  assert.equal(burnManager.isDuplicate(compassB, [compassA, cannon, compassB], cardDefs), true);
});

test('burnManager.isDuplicate: false when every Expedition Area card has a distinct type', () => {
  const compass = cardManager.createCardInstance(
    cardDefs.find((d) => d.id === 'compass-v6'),
    cardManager.ZONES.EXPEDITION
  );
  const cannon = cardManager.createCardInstance(
    cardDefs.find((d) => d.id === 'cannon-v5'),
    cardManager.ZONES.EXPEDITION
  );

  assert.equal(burnManager.isDuplicate(cannon, [compass, cannon], cardDefs), false);
});

test('burnManager.isDuplicate: never compares a card to itself', () => {
  const compass = cardManager.createCardInstance(
    cardDefs.find((d) => d.id === 'compass-v6'),
    cardManager.ZONES.EXPEDITION
  );
  // Only card in the Expedition Area is the candidate itself.
  assert.equal(burnManager.isDuplicate(compass, [compass], cardDefs), false);
});

// ---------------------------------------------------------------------------
// Full integration scenario: 3rd card duplicates the 1st card's type.
// ---------------------------------------------------------------------------

test('a duplicate on the 3rd card triggers Shipwreck: ability skipped, Lost Loot grows by exactly the lost cards, Expedition Area emptied', () => {
  gameManager.startGame(cardDefs, config, buildPlayers(), {
    treasureSeed: 'shipwreck-scenario',
    lostLootSeed: 'shipwreck-scenario-lostloot',
  });

  // Card 1: whatever the seed drew — read it back to know its type.
  const card1 = gameManager.getExpeditionArea()[0];
  const card1Def = cardDefs.find((d) => d.id === card1.defId);

  // Card 2: any definition of a DIFFERENT type (stays safe).
  const card2Def = cardDefs.find((d) => d.type !== card1Def.type);
  // Card 3: another definition of the SAME type as card 1, but a different
  // card (distinct value) — a genuine duplicate per GDD §8 Step 3 (type
  // match), since the deck never contains two literally identical cards.
  const card3Def = cardDefs.find((d) => d.type === card1Def.type && d.id !== card1Def.id);

  const card2Instance = cardManager.createCardInstance(card2Def, cardManager.ZONES.DECK);
  const card3Instance = cardManager.createCardInstance(card3Def, cardManager.ZONES.DECK);
  gameState.setTreasureDeck([card2Instance, card3Instance, ...gameManager.getTreasureDeck()]);

  // Spy: count RESOLVE_ABILITY phase transitions from this point forward.
  // resolveAbility() is the ONLY function that ever sets this phase
  // (turnManager.js) — if it were invoked for the duplicate, this count
  // would include it. Subscribed here (after card 1's own — already
  // resolved — reveal, since startGame() already ran it before we could
  // subscribe), so it only needs to track card 2 (safe) and card 3
  // (duplicate).
  let resolveAbilityCount = 0;
  gameManager.on('PHASE_CHANGED', (event) => {
    if (event.detail.phase === gameManager.PHASES.RESOLVE_ABILITY) {
      resolveAbilityCount += 1;
    }
  });

  // Snapshot captured synchronously inside the EXPEDITION_AREA_CLEARED
  // handler — i.e. the instant Shipwreck clears the Expedition Area,
  // before endTurn() advances to the next player and that player's own
  // opening card is revealed into a fresh (empty) Expedition Area. This is
  // also the precise moment to snapshot resolveAbilityCount, so p2's own
  // (legitimate, unrelated) RESOLVE_ABILITY never muddies the assertion
  // that card 3's ability specifically never ran.
  let expeditionAreaAtClear = null;
  let lostLootAtClear = null;
  let resolveAbilityCountAtClear = null;
  gameManager.on('EXPEDITION_AREA_CLEARED', () => {
    expeditionAreaAtClear = gameManager.getExpeditionArea();
    lostLootAtClear = gameManager.getLostLoot();
    resolveAbilityCountAtClear = resolveAbilityCount;
  });

  const lostLootBefore = gameManager.getLostLoot();
  assert.equal(lostLootBefore.length, 10); // GDD §5.2 initial Lost Loot

  // Reveal card 2 — safe, different type from card 1. Turn stays open.
  gameManager.revealNextCard();
  assert.equal(gameManager.getPhase(), gameManager.PHASES.PLAYER_DECISION);
  assert.equal(gameManager.getExpeditionArea().length, 2);

  // resolveAbility() ran once so far, for card 2 (safe).
  assert.equal(resolveAbilityCount, 1);

  // Reveal card 3 — duplicates card 1's type. Shipwreck fires immediately;
  // no player decision; turn ends and advances to p2, whose own opening
  // card is then automatically revealed (safe, in a now-empty Expedition
  // Area) — which legitimately adds one more RESOLVE_ABILITY of its own.
  gameManager.revealNextCard();

  // --- Explicitly asserted, not inferred: the duplicate's ability never ran ---
  // Still exactly 1 at the moment of Shipwreck's clear (only card 2's) —
  // card 3 (the duplicate) never reached RESOLVE_ABILITY. p2's own card
  // reveal happens strictly AFTER this snapshot, so it can't muddy it.
  assert.equal(resolveAbilityCountAtClear, 1);

  // --- Expedition Area was genuinely emptied by Shipwreck (captured at the
  //     moment of clearing, not the current — already-advanced — state) ---
  assert.ok(expeditionAreaAtClear, 'EXPEDITION_AREA_CLEARED should have fired');
  assert.equal(expeditionAreaAtClear.length, 0);

  // --- Lost Loot grew by EXACTLY the 3 cards that were in the Expedition
  //     Area (card1, card2, card3) — no more, no less ---
  assert.equal(lostLootAtClear.length, 13);
  const newLostLootIds = lostLootAtClear
    .map((c) => c.instanceId)
    .filter((id) => !lostLootBefore.some((c) => c.instanceId === id));
  assert.deepEqual(
    newLostLootIds.sort(),
    [card1.instanceId, card2Instance.instanceId, card3Instance.instanceId].sort()
  );
  assert.ok(lostLootAtClear.every((c) => c.currentZone === 'lostLoot' && c.ownerId === null));

  // --- No player decision occurred for the Shipwreck turn: turnHistory
  //     records a 'shipwreck' entry (not 'return'), and the turn passed to
  //     the next player (round-robin) without ever pausing at
  //     PLAYER_DECISION for p1 again ---
  const p1ShipwreckEntry = gameManager.getTurnHistory().find((e) => e.playerId === 'p1');
  assert.ok(p1ShipwreckEntry);
  assert.equal(p1ShipwreckEntry.decision, 'shipwreck');
  assert.equal(p1ShipwreckEntry.cardsLost, 3);

  // p1 secured nothing — the whole expedition was lost, not banked.
  const p1 = gameManager.getPlayer('p1');
  assert.equal(p1.shipCargo.length, 0);

  // Turn correctly advanced to p2, who is now paused on their own opening
  // decision (proving the game continued normally after the Shipwreck).
  assert.equal(gameManager.getPhase(), gameManager.PHASES.PLAYER_DECISION);
  assert.equal(gameManager.getCurrentPlayer().id, 'p2');
});
