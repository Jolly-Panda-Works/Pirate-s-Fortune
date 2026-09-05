/**
 * single-resolution-abilities.test.js
 *
 * Covers Prompt 010 exit criteria (GDD §14.1-14.3) for
 * js/abilities/compass.js, js/abilities/cannon.js, and
 * js/abilities/captainShield.js:
 *   - Compass: peeks the exact top-of-deck card, and "Explore Further"
 *     draws that EXACT card, never a replacement.
 *   - Cannon: destroys an eligible rival Ship Cargo card; ineligible
 *     targets (self, nonexistent card) and a missing target all no-op.
 *   - Captain Shield: a Shield revealed as the first card protects
 *     nothing; a second Shield is still a normal duplicate (never
 *     absorbed); a genuine (non-Shield) duplicate is absorbed exactly
 *     once while Shield is active, sparing the rest of the expedition;
 *     and that protection does NOT persist — the next unrelated duplicate
 *     causes a normal Shipwreck (no general immunity).
 *   - Every "goldCoin"/"compass"/"cannon"/"captainShield" ability key is
 *     registered, matching gameConfig.json's abilities.singleResolution
 *     list (plus goldCoin's null ability, still a legitimate no-op).
 *
 * Uses the SAME override-the-deck-then-drawCard() technique as
 * shipwreck.test.js: startGame() to properly initialize turnManager's
 * private cardDefinitions snapshot, discard whatever random card1 was
 * (gameState.clearExpeditionArea() — acceptable direct-state test setup,
 * same spirit as collect-manager.test.js), then script every subsequent
 * card via gameState.setTreasureDeck() + turnManager.drawCard() so each
 * scenario is fully deterministic regardless of the run's random seed.
 *
 * Run with: node --test tests/integration/single-resolution-abilities.test.js
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as gameState from '../../js/gameState.js';
import * as cardManager from '../../js/cardManager.js';
import * as turnManager from '../../js/turnManager.js';
import * as abilityManager from '../../js/abilityManager.js';
import * as abilityResolver from '../../js/abilityResolver.js';

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

function buildPlayers(count = 2) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    isAI: false,
    shipCargo: [],
    score: 0,
  }));
}

/**
 * Auto-resolves any pending human ability-target-selection choice by
 * picking its first eligible option (Prompt 014's PLAYER_CHOICE pause —
 * see turnManager.js's resolveAbility()/resolveAbilityChoice()). Needed
 * because Lost Loot always starts pre-populated (10 cards), so a fixed
 * seed's very first real card CAN legitimately be a Treasure Map that
 * pauses play before startFreshExpedition() gets a chance to discard it.
 * Resolving with the first option (rather than, say, requiring the test
 * to know in advance whether this will happen) keeps every test's own
 * setup below unaffected — clearExpeditionArea() then discards whatever
 * that resolution put in the Expedition Area exactly as it always did.
 */
function settleAnyPendingAbilityChoice() {
  let pending = gameState.getPendingAbilityChoice();
  while (pending) {
    turnManager.resolveAbilityChoice(pending.options[0]);
    pending = gameState.getPendingAbilityChoice();
  }
}

/**
 * Starts a fresh 2-player game (to properly set turnManager's private
 * cardDefinitions snapshot), then discards whatever random card1 was so
 * every test starts from a genuinely empty, fully-scripted expedition.
 */
function startFreshExpedition(playerCount = 2) {
  turnManager.startGame(cardDefs, config, buildPlayers(playerCount), {
    treasureSeed: 'single-resolution-abilities-scenario',
    lostLootSeed: 'single-resolution-abilities-scenario-lostloot',
  });
  settleAnyPendingAbilityChoice();
  gameState.clearExpeditionArea();
}

/** Queues `defs` (in order) at the front of the Treasure Deck, then draws
 * them one at a time via turnManager.drawCard() (the real "Explore
 * Further" path — reveal, duplicate check, ability resolution, all real).
 * Stops early if a Shipwreck or GAME_END ends the loop.
 */
function revealSequence(defs) {
  const instances = defs.map((def) => cardManager.createCardInstance(def, cardManager.ZONES.DECK));
  gameState.setTreasureDeck([...instances, ...gameState.getTreasureDeck()]);
  for (let i = 0; i < instances.length; i += 1) {
    if (gameState.getPhase() !== 'PLAYER_DECISION') break; // shipwrecked/game ended early
    turnManager.drawCard();
  }
  return instances;
}

beforeEach(() => {
  gameState.resetState();
  gameState.clearAllListeners();
  cardManager.resetInstanceCounter();
});

// ---------------------------------------------------------------------------
// Registration: every single-resolution ability key is wired up.
// ---------------------------------------------------------------------------

test('gameConfig.json abilities.singleResolution keys are all registered', () => {
  for (const key of config.abilities.singleResolution) {
    assert.equal(abilityManager.hasAbility(key), true, `expected "${key}" to be registered`);
  }
});

test("Gold Coin's null ability resolves as a no-op end-to-end through turnManager", () => {
  startFreshExpedition();
  revealSequence([defFor('goldCoin-v4')]);
  assert.equal(gameState.getPhase(), 'PLAYER_DECISION');
  assert.equal(gameState.getExpeditionArea().length, 1);
});

// ---------------------------------------------------------------------------
// Compass (§14.1)
// ---------------------------------------------------------------------------

test('Compass: peeks the exact top-of-deck card without removing it', () => {
  startFreshExpedition();
  const nextDef = defFor('goldCoin-v4');
  const nextInstance = cardManager.createCardInstance(nextDef, cardManager.ZONES.DECK);
  gameState.setTreasureDeck([nextInstance, ...gameState.getTreasureDeck()]);

  revealSequence([defFor('compass-v2')]);

  const abilityCtx = gameState.getAbilityContext();
  assert.equal(abilityCtx.ability, 'compass');
  assert.equal(abilityCtx.peekedDefId, nextDef.id);
  assert.equal(abilityCtx.peekedInstanceId, nextInstance.instanceId);
  // Not removed — still sitting on top of the deck.
  assert.equal(gameState.getTreasureDeck()[0].instanceId, nextInstance.instanceId);
});

test('Compass: Explore Further draws the EXACT previewed card, never a replacement', () => {
  startFreshExpedition();
  const nextDef = defFor('goldCoin-v4');
  const nextInstance = cardManager.createCardInstance(nextDef, cardManager.ZONES.DECK);
  gameState.setTreasureDeck([nextInstance, ...gameState.getTreasureDeck()]);

  revealSequence([defFor('compass-v2')]);
  const peekedInstanceId = gameState.getAbilityContext().peekedInstanceId;

  // Explore Further -> the next natural draw.
  turnManager.drawCard();

  assert.equal(gameState.getPhase(), 'PLAYER_DECISION');
  const expeditionArea = gameState.getExpeditionArea();
  assert.equal(expeditionArea.length, 2);
  const drawnCard = expeditionArea[1];
  assert.equal(drawnCard.instanceId, peekedInstanceId);
  assert.equal(drawnCard.defId, nextDef.id);
});

test('Compass: Return to Ship leaves the previewed card exactly where it was', () => {
  startFreshExpedition(1); // single player: returning starts a new turn we can inspect
  const nextDef = defFor('goldCoin-v4');
  const nextInstance = cardManager.createCardInstance(nextDef, cardManager.ZONES.DECK);
  gameState.setTreasureDeck([nextInstance, ...gameState.getTreasureDeck()]);

  revealSequence([defFor('compass-v2')]);
  assert.equal(gameState.getTreasureDeck()[0].instanceId, nextInstance.instanceId);

  turnManager.returnToShip();

  // A brand new turn auto-starts (single player) and draws from the top —
  // it must draw the SAME card the Compass previewed, since Return to
  // Ship never touched the deck.
  const newExpedition = gameState.getExpeditionArea();
  assert.equal(newExpedition.length, 1);
  assert.equal(newExpedition[0].instanceId, nextInstance.instanceId);
});

// ---------------------------------------------------------------------------
// Cannon (§14.2)
// ---------------------------------------------------------------------------

test('Cannon: destroys an eligible rival Ship Cargo card', () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(2) });

  const rivalCard = cardManager.createCardInstance(defFor('goldCoin-v5'), cardManager.ZONES.CARGO, 'p2');
  gameState.updatePlayer('p2', { shipCargo: [rivalCard] });

  abilityResolver.resolveAbility(defFor('cannon-v3'), {
    currentPlayer: gameState.getPlayer('p1'),
    targetPlayer: gameState.getPlayer('p2'),
    targetCardId: rivalCard.instanceId,
    reason: 'reveal',
  });

  const p2 = gameState.getPlayer('p2');
  assert.equal(p2.shipCargo.length, 0);
  const lostLoot = gameState.getLostLoot();
  assert.equal(lostLoot.length, 1);
  assert.equal(lostLoot[0].instanceId, rivalCard.instanceId);
  assert.equal(lostLoot[0].currentZone, 'lostLoot');
  assert.equal(lostLoot[0].ownerId, null);
});

test('Cannon: cannot target your own Ship Cargo (no-op)', () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(2) });

  const ownCard = cardManager.createCardInstance(defFor('goldCoin-v5'), cardManager.ZONES.CARGO, 'p1');
  gameState.updatePlayer('p1', { shipCargo: [ownCard] });

  abilityResolver.resolveAbility(defFor('cannon-v3'), {
    currentPlayer: gameState.getPlayer('p1'),
    targetPlayer: gameState.getPlayer('p1'),
    targetCardId: ownCard.instanceId,
    reason: 'reveal',
  });

  assert.equal(gameState.getPlayer('p1').shipCargo.length, 1);
  assert.equal(gameState.getLostLoot().length, 0);
});

test('Cannon: a nonexistent target card id no-ops rather than throwing', () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(2) });

  assert.doesNotThrow(() => {
    abilityResolver.resolveAbility(defFor('cannon-v3'), {
      currentPlayer: gameState.getPlayer('p1'),
      targetPlayer: gameState.getPlayer('p2'),
      targetCardId: 'goldCoin-v9#999',
      reason: 'reveal',
    });
  });
  assert.equal(gameState.getLostLoot().length, 0);
});

test('Cannon: end-to-end through turnManager now pauses for a human target choice (Prompt 014), then destroys exactly the chosen card', () => {
  startFreshExpedition();
  const rivalCard = cardManager.createCardInstance(defFor('goldCoin-v5'), cardManager.ZONES.CARGO, 'p2');
  gameState.updatePlayer('p2', { shipCargo: [rivalCard] });

  revealSequence([defFor('cannon-v3')]);

  // Prompt 014: a human current player with an eligible rival card PAUSES
  // at PLAYER_CHOICE instead of resolving immediately — this replaces the
  // pre-Prompt-014 "no target supplied by turnManager, so nothing was
  // destroyed" assumption this test used to assert.
  assert.equal(gameState.getPhase(), 'PLAYER_CHOICE');
  const pending = gameState.getPendingAbilityChoice();
  assert.equal(pending.ability, 'cannon');
  assert.deepEqual(pending.options, [
    { targetPlayerId: 'p2', targetCardId: rivalCard.instanceId, defId: rivalCard.defId },
  ]);

  turnManager.resolveAbilityChoice(pending.options[0]);

  assert.equal(gameState.getPhase(), 'PLAYER_DECISION');
  assert.equal(gameState.getPendingAbilityChoice(), null);
  assert.equal(gameState.getPlayer('p2').shipCargo.length, 0, 'the chosen card was actually destroyed');
  assert.ok(
    gameState.getLostLoot().some((c) => c.instanceId === rivalCard.instanceId),
    'the destroyed card landed in Lost Loot'
  );
});

test('Cannon: end-to-end through turnManager with no eligible rival card resolves immediately (no pause, no modal)', () => {
  startFreshExpedition();
  // No player has any cargo yet — Cannon's own getEligibleTargets() (Prompt
  // 014) returns an empty array, so resolveAbility() never pauses at all,
  // matching the graceful "nothing eligible" degrade every other targeted
  // ability also has (never a broken empty modal).
  revealSequence([defFor('cannon-v3')]);

  assert.equal(gameState.getPhase(), 'PLAYER_DECISION');
  assert.equal(gameState.getPendingAbilityChoice(), null);
});

// ---------------------------------------------------------------------------
// Captain Shield (§14.3)
// ---------------------------------------------------------------------------

test('Captain Shield: revealed as the first card protects nothing — a later duplicate still Shipwrecks', () => {
  startFreshExpedition();
  revealSequence([defFor('captainShield-v2'), defFor('goldCoin-v4'), defFor('goldCoin-v5')]);

  assert.equal(gameState.getShieldActive(), false);
  // goldCoin-v5 duplicates goldCoin-v4's type -> unprotected Shipwreck.
  // (Turn already advanced to p2, whose own card auto-revealed into a
  // fresh Expedition Area — so we check turnHistory, not the CURRENT
  // Expedition Area, to confirm what happened to p1's turn specifically.)
  const p1Entry = gameState.getTurnHistory().find((e) => e.playerId === 'p1');
  assert.equal(p1Entry.decision, 'shipwreck');
  assert.equal(p1Entry.cardsLost, 3);
  assert.equal(gameState.getPlayer('p1').shipCargo.length, 0);
});

test('Captain Shield: a second Shield in the same expedition is still a normal duplicate (never absorbed)', () => {
  startFreshExpedition();
  // captainShield-v3 (2nd card) activates protection; captainShield-v2
  // duplicates its TYPE ("captainShield") as the 3rd card.
  revealSequence([defFor('goldCoin-v4'), defFor('captainShield-v3'), defFor('captainShield-v2')]);

  // Turn already advanced to p2 (own card auto-revealed into a fresh
  // Expedition Area) — confirm via turnHistory that p1's turn was
  // specifically the one that Shipwrecked, not the current live state.
  const p1Entry = gameState.getTurnHistory().find((e) => e.playerId === 'p1');
  assert.equal(p1Entry.decision, 'shipwreck', 'Shipwreck occurred — Shield never protects against another Shield');
  assert.equal(p1Entry.cardsLost, 3);
  assert.equal(gameState.getShieldActive(), false);
});

test('Captain Shield: absorbs one genuine duplicate, sparing the rest of the expedition — then grants no further protection', () => {
  startFreshExpedition();

  // card1: goldCoin (safe). card2: Shield, NOT first card -> activates.
  // card3: cannon (safe, distinct type).
  revealSequence([defFor('goldCoin-v4'), defFor('captainShield-v3'), defFor('cannon-v2')]);
  assert.equal(gameState.getShieldActive(), true);
  assert.equal(gameState.getExpeditionArea().length, 3);

  // card4: another goldCoin -> duplicates card1's type. Shield is active
  // and this is NOT another Shield -> absorbed, not a full Shipwreck.
  revealSequence([defFor('goldCoin-v5')]);

  assert.equal(gameState.getShieldActive(), false, 'the one-time protection is now consumed');
  const expeditionAfterAbsorb = gameState.getExpeditionArea();
  assert.equal(expeditionAfterAbsorb.length, 3, 'only the duplicate card was removed — the rest of the expedition survived');
  assert.ok(!expeditionAfterAbsorb.some((c) => c.defId === 'goldCoin-v5'));
  assert.equal(gameState.getPhase(), 'PLAYER_DECISION', 'turn continues after an absorbed duplicate — no Shipwreck, no forced end of turn');

  // card5: another cannon -> duplicates card3's type. Shield was already
  // consumed above, so THIS duplicate is a normal, unprotected Shipwreck
  // (GDD §14.3: "does not grant general immunity").
  revealSequence([defFor('cannon-v3')]);
  const p1Entry = gameState.getTurnHistory().find((e) => e.playerId === 'p1');
  assert.equal(p1Entry.decision, 'shipwreck');
  assert.equal(p1Entry.cardsLost, 4); // goldCoin-v4, captainShield-v3, cannon-v2, cannon-v3
});
