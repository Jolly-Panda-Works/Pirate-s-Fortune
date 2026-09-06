/**
 * ai-ability-targeting.test.js
 *
 * Covers Prompt 015 exit criteria (GDD §17 "Ability targeting") for the
 * AI branch turnManager.js's resolveAbility() gained: an AI current
 * player with a targeted ability (Cannon/Pirate Dagger/Lucky
 * Anchor/Treasure Map) and at least one real eligible option resolves
 * IMMEDIATELY — never pausing at PLAYER_CHOICE the way a human would
 * (Prompt 014) — using playerManager.chooseAbilityTarget()'s
 * deterministic "first eligible option" (GDD §17: "no smart targeting
 * yet"). An AI with nothing eligible still falls through to "resolve
 * with no target", exactly as every player type already did pre-Prompt
 * 015.
 *
 * Setup technique: a 2-player game with p1 human (goes first) and p2 AI
 * (the player under test). p1's own opening reveal is discarded
 * (matching single-resolution-abilities.test.js's startFreshExpedition()
 * pattern) and p1 immediately "Returns to Ship" with an empty cargo —
 * ending p1's turn and handing control to p2 (AI). The Treasure Deck is
 * then REPLACED (not merely prepended) with exactly the one scripted
 * ability card, so p2's entire turn is fully deterministic: the ability
 * resolves (immediately, no PLAYER_CHOICE pause), the AI's own threshold
 * decision (playerManager.decideAction(), always "explore" below 4 cards)
 * tries to draw again, finds the deck empty, and the game ends right
 * there — leaving every zone (Expedition Area, every player's Ship
 * Cargo, Lost Loot) in its final, fully-inspectable resting state with
 * zero further randomness to account for.
 *
 * Run with: node --test tests/integration/ai-ability-targeting.test.js
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as gameState from '../../js/gameState.js';
import * as cardManager from '../../js/cardManager.js';
import * as turnManager from '../../js/turnManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
const cardsFile = JSON.parse(readFileSync(path.join(dataDir, 'cards.json'), 'utf-8'));
const config = JSON.parse(readFileSync(path.join(dataDir, 'gameConfig.json'), 'utf-8'));
const cardDefs = cardsFile.cards;

function defFor(id) {
  const def = cardDefs.find((d) => d.id === id);
  if (!def) throw new Error(`fixture setup: no card definition with id "${id}"`);
  return def;
}

/** p1 is human and goes first; p2 is the AI under test. */
function buildHumanThenAiPlayers() {
  return [
    { id: 'p1', name: 'Player 1', isAI: false, shipCargo: [], score: 0 },
    { id: 'p2', name: 'Player 2 (AI)', isAI: true, shipCargo: [], score: 0 },
  ];
}

/**
 * Auto-resolves any pending human ability-target-selection choice by
 * picking its first eligible option (mirrors the identically-named
 * helper in single-resolution-abilities.test.js / chain-abilities.test.js
 * — needed here too since Lost Loot always starts pre-populated, so
 * p1's own opening reveal CAN legitimately be a targeted ability).
 */
function settleAnyPendingAbilityChoice() {
  let pending = gameState.getPendingAbilityChoice();
  while (pending) {
    turnManager.resolveAbilityChoice(pending.options[0]);
    pending = gameState.getPendingAbilityChoice();
  }
}

/**
 * Starts a fresh 2-player (human, AI) game, discards p1's random opening
 * card, and leaves GameState paused at p1's own PLAYER_DECISION with an
 * empty Expedition Area — ready for a test to script p2's (AI) very next
 * card before ending p1's turn.
 */
function startFreshExpeditionThenReady() {
  turnManager.startGame(cardDefs, config, buildHumanThenAiPlayers(), {
    treasureSeed: 'ai-ability-targeting-scenario',
    lostLootSeed: 'ai-ability-targeting-scenario-lostloot',
  });
  settleAnyPendingAbilityChoice();
  gameState.clearExpeditionArea();
}

/**
 * REPLACES the live Treasure Deck with exactly one scripted card, then
 * ends p1's (human) turn with an empty cargo — handing control to p2
 * (AI). p2's entire turn then runs synchronously and deterministically:
 * the scripted card resolves, the AI's threshold decision (always
 * "explore" below 4 cards — GDD §15) tries to draw again, finds the deck
 * empty, and the game ends immediately, with no further real/random
 * cards to account for.
 * @param {object} def - the sole card definition left in the deck
 * @returns {object} the CardInstance that was placed
 */
function endHumanTurnThenRunAiWithScriptedCard(def) {
  const instance = cardManager.createCardInstance(def, cardManager.ZONES.DECK);
  gameState.setTreasureDeck([instance]);
  turnManager.returnToShip();
  return instance;
}

beforeEach(() => {
  gameState.resetState();
  gameState.clearAllListeners();
  cardManager.resetInstanceCounter();
});

// ---------------------------------------------------------------------------
// Cannon
// ---------------------------------------------------------------------------

test('AI + Cannon: resolves immediately (no PLAYER_CHOICE pause), destroying the first eligible rival card', () => {
  startFreshExpeditionThenReady();
  const olderCargoCard = cardManager.createCardInstance(defFor('goldCoin-v4'), cardManager.ZONES.CARGO, 'p1');
  const newerCargoCard = cardManager.createCardInstance(defFor('goldCoin-v5'), cardManager.ZONES.CARGO, 'p1');
  gameState.updatePlayer('p1', { shipCargo: [olderCargoCard, newerCargoCard] });

  endHumanTurnThenRunAiWithScriptedCard(defFor('cannon-v3'));

  // No lingering PLAYER_CHOICE pause: the AI (p2) resolved its own
  // targeted ability immediately, never waiting on a modal.
  assert.notEqual(gameState.getPhase(), 'PLAYER_CHOICE');
  assert.equal(gameState.getPendingAbilityChoice(), null);

  // Deterministic "first eligible option" (GDD §17) — Cannon's own
  // getEligibleTargets() walks shipCargo in array order, so the FIRST
  // card in p1's cargo array is the one destroyed, never the second.
  const p1 = gameState.getPlayer('p1');
  assert.equal(p1.shipCargo.length, 1);
  assert.equal(p1.shipCargo[0].instanceId, newerCargoCard.instanceId, 'the second card should remain');
  assert.ok(
    gameState.getLostLoot().some((c) => c.instanceId === olderCargoCard.instanceId),
    'the first eligible card should have been destroyed to Lost Loot'
  );
});

test('AI + Cannon: no eligible rival card resolves immediately with no target, exactly like before Prompt 015', () => {
  startFreshExpeditionThenReady();
  const lostLootCountBefore = gameState.getLostLoot().length;
  // No player has any cargo yet.
  const instance = endHumanTurnThenRunAiWithScriptedCard(defFor('cannon-v3'));

  assert.notEqual(gameState.getPhase(), 'PLAYER_CHOICE');
  assert.equal(gameState.getPendingAbilityChoice(), null);
  assert.equal(gameState.getLostLoot().length, lostLootCountBefore, 'nothing new should have been destroyed');
  // With no target, the deck now empty, and the game therefore over, the
  // Cannon card itself is left sitting uncollected in the Expedition Area.
  assert.ok(gameState.getExpeditionArea().some((c) => c.instanceId === instance.instanceId));
});

// ---------------------------------------------------------------------------
// Pirate Dagger
// ---------------------------------------------------------------------------

test('AI + Pirate Dagger: resolves immediately, stealing the first eligible rival card', () => {
  startFreshExpeditionThenReady();
  const rivalCard = cardManager.createCardInstance(defFor('goldCoin-v6'), cardManager.ZONES.CARGO, 'p1');
  gameState.updatePlayer('p1', { shipCargo: [rivalCard] });

  endHumanTurnThenRunAiWithScriptedCard(defFor('pirateDagger-v3'));

  assert.notEqual(gameState.getPhase(), 'PLAYER_CHOICE');
  assert.equal(gameState.getPendingAbilityChoice(), null);
  assert.equal(gameState.getPlayer('p1').shipCargo.length, 0, 'the stolen card should have left the rival cargo');

  // The stolen card re-enters through the Resolution Queue (GDD §14.4)
  // and, with the deck now empty and the game therefore over before any
  // Return to Ship, is left sitting uncollected in the Expedition Area —
  // proof it actually left p1's cargo and re-entered play, rather than
  // vanishing or silently no-opping for lack of a target.
  assert.ok(gameState.getExpeditionArea().some((c) => c.instanceId === rivalCard.instanceId));
});

// ---------------------------------------------------------------------------
// Lucky Anchor
// ---------------------------------------------------------------------------

test('AI + Lucky Anchor: resolves immediately, replaying the first eligible card from its OWN cargo', () => {
  startFreshExpeditionThenReady();
  const ownCard = cardManager.createCardInstance(defFor('goldCoin-v7'), cardManager.ZONES.CARGO, 'p2');
  gameState.updatePlayer('p2', { shipCargo: [ownCard] });

  endHumanTurnThenRunAiWithScriptedCard(defFor('luckyAnchor-v3'));

  assert.notEqual(gameState.getPhase(), 'PLAYER_CHOICE');
  assert.equal(gameState.getPendingAbilityChoice(), null);

  // The replayed card left p2's own cargo and re-entered the Resolution
  // Queue (GDD §14.4); with the deck now empty and the game therefore
  // over before any Return to Ship, it's left sitting uncollected in the
  // Expedition Area rather than back in cargo — the whole point of the
  // gamble Lucky Anchor represents.
  assert.equal(
    gameState.getPlayer('p2').shipCargo.some((c) => c.instanceId === ownCard.instanceId),
    false,
    "the replayed card should have left p2's cargo"
  );
  assert.ok(gameState.getExpeditionArea().some((c) => c.instanceId === ownCard.instanceId));
});

test('AI + Lucky Anchor: empty own cargo resolves immediately with no target', () => {
  startFreshExpeditionThenReady();
  endHumanTurnThenRunAiWithScriptedCard(defFor('luckyAnchor-v3'));

  assert.notEqual(gameState.getPhase(), 'PLAYER_CHOICE');
  assert.equal(gameState.getPendingAbilityChoice(), null);
});

// ---------------------------------------------------------------------------
// Treasure Map
// ---------------------------------------------------------------------------

test('AI + Treasure Map: resolves immediately, retrieving the first eligible card from Lost Loot', () => {
  startFreshExpeditionThenReady();
  const targetCard = gameState.getLostLoot()[0];

  endHumanTurnThenRunAiWithScriptedCard(defFor('treasureMap-v3'));

  assert.notEqual(gameState.getPhase(), 'PLAYER_CHOICE');
  assert.equal(gameState.getPendingAbilityChoice(), null);
  assert.ok(
    !gameState.getLostLoot().some((c) => c.instanceId === targetCard.instanceId),
    'the first Lost Loot card should have been retrieved (no longer sitting in Lost Loot)'
  );
  assert.ok(gameState.getExpeditionArea().some((c) => c.instanceId === targetCard.instanceId));
});

// ---------------------------------------------------------------------------
// Human players are unaffected by any of the above (regression guard)
// ---------------------------------------------------------------------------

test('A human player with an eligible Cannon target still pauses at PLAYER_CHOICE, unaffected by the AI branch', () => {
  turnManager.startGame(
    cardDefs,
    config,
    [
      { id: 'human', name: 'Human', isAI: false, shipCargo: [], score: 0 },
      { id: 'rival', name: 'Rival', isAI: false, shipCargo: [], score: 0 },
    ],
    { treasureSeed: 'human-still-pauses', lostLootSeed: 'human-still-pauses-lostloot' }
  );
  settleAnyPendingAbilityChoice();
  gameState.clearExpeditionArea();

  const rivalCard = cardManager.createCardInstance(defFor('goldCoin-v5'), cardManager.ZONES.CARGO, 'rival');
  gameState.updatePlayer('rival', { shipCargo: [rivalCard] });

  const instance = cardManager.createCardInstance(defFor('cannon-v3'), cardManager.ZONES.DECK);
  gameState.setTreasureDeck([instance, ...gameState.getTreasureDeck()]);
  turnManager.drawCard();

  assert.equal(gameState.getPhase(), 'PLAYER_CHOICE');
  assert.ok(gameState.getPendingAbilityChoice(), 'a human should still pause for target selection');
});
