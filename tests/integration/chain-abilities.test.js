/**
 * chain-abilities.test.js
 *
 * Covers Prompt 010b exit criteria (GDD §14.4-14.8) for
 * js/abilities/pirateDagger.js, luckyAnchor.js, seaSerpent.js,
 * treasureMap.js, and treasureChestGoldenKey.js, plus abilityResolver.js's
 * extended Resolution Queue (GDD §13) that makes chain-generated cards go
 * through the full Card Resolution Order:
 *   - Pirate Dagger: steals a rival's cargo card, which re-enters the
 *     expedition through the Resolution Queue (not a recursive call).
 *   - Lucky Anchor: replays a card from the CURRENT player's own cargo.
 *   - Sea Serpent: forces an additional reveal; chains into a SECOND Sea
 *     Serpent without recursion; and a forced reveal that duplicates
 *     halts resolution and requires a Shipwreck, exactly like a normal
 *     duplicate would.
 *   - Treasure Map: retrieves a card from Lost Loot into the resolution
 *     flow; gracefully no-ops on an empty Lost Loot.
 *   - Treasure Chest + Golden Key: grants a bonus card from Lost Loot
 *     ONLY on Return to Ship (never on a normal reveal); gracefully
 *     no-ops on an empty Lost Loot.
 *   - Every chain ability key in gameConfig.json's abilities.chain list
 *     is registered.
 *
 * Uses the same deterministic techniques established in
 * single-resolution-abilities.test.js: startGame() once (to initialize
 * turnManager's private cardDefinitions snapshot), then direct gameState
 * manipulation for full control over every subsequent card.
 *
 * Run with: node --test tests/integration/chain-abilities.test.js
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

function startFreshExpedition(playerCount = 2) {
  turnManager.startGame(cardDefs, config, buildPlayers(playerCount), {
    treasureSeed: 'chain-abilities-scenario',
    lostLootSeed: 'chain-abilities-scenario-lostloot',
  });
  gameState.clearExpeditionArea();
}

function revealSequence(defs) {
  const instances = defs.map((def) => cardManager.createCardInstance(def, cardManager.ZONES.DECK));
  gameState.setTreasureDeck([...instances, ...gameState.getTreasureDeck()]);
  for (let i = 0; i < instances.length; i += 1) {
    if (gameState.getPhase() !== 'PLAYER_DECISION') break;
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
// Registration
// ---------------------------------------------------------------------------

test('gameConfig.json abilities.chain keys are all registered', () => {
  for (const key of config.abilities.chain) {
    assert.equal(abilityManager.hasAbility(key), true, `expected "${key}" to be registered`);
  }
});

// ---------------------------------------------------------------------------
// Pirate Dagger (§14.4)
// ---------------------------------------------------------------------------

test('Pirate Dagger: steals a rival card and resolves it through the Resolution Queue, not a recursive call', () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(2) });

  const stolenCard = cardManager.createCardInstance(defFor('goldCoin-v5'), cardManager.ZONES.CARGO, 'p2');
  gameState.updatePlayer('p2', { shipCargo: [stolenCard] });

  const result = abilityResolver.resolveAbility(
    defFor('pirateDagger-v3'),
    {
      currentPlayer: gameState.getPlayer('p1'),
      targetPlayer: gameState.getPlayer('p2'),
      targetCardId: stolenCard.instanceId,
      reason: 'reveal',
    },
    cardDefs
  );

  // Removed from the rival's cargo...
  assert.equal(gameState.getPlayer('p2').shipCargo.length, 0);
  // ...and now sitting in the (shared) Expedition Area, at risk again.
  const expedition = gameState.getExpeditionArea();
  assert.equal(expedition.length, 1);
  assert.equal(expedition[0].instanceId, stolenCard.instanceId);
  assert.equal(expedition[0].ownerId, null);
  assert.equal(expedition[0].currentZone, 'expedition');
  // pirateDagger itself (1) + the stolen card resolving safely (1) = 2.
  assert.equal(result.processedCount, 2);
  assert.equal(result.shipwreckedCard, null);
});

test('Pirate Dagger: a stolen card that duplicates an existing expedition card halts the queue and requires a Shipwreck', () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(2) });

  const existingCard = cardManager.createCardInstance(defFor('goldCoin-v4'), cardManager.ZONES.EXPEDITION);
  gameState.setExpeditionArea([existingCard]);

  // Same TYPE as existingCard (goldCoin) -> a genuine duplicate once stolen in.
  const stolenCard = cardManager.createCardInstance(defFor('goldCoin-v5'), cardManager.ZONES.CARGO, 'p2');
  gameState.updatePlayer('p2', { shipCargo: [stolenCard] });

  const result = abilityResolver.resolveAbility(
    defFor('pirateDagger-v3'),
    {
      currentPlayer: gameState.getPlayer('p1'),
      targetPlayer: gameState.getPlayer('p2'),
      targetCardId: stolenCard.instanceId,
      reason: 'reveal',
    },
    cardDefs
  );

  assert.ok(result.shipwreckedCard);
  assert.equal(result.shipwreckedCard.instanceId, stolenCard.instanceId);
});

test('Pirate Dagger: cannot steal from yourself, and a missing target no-ops', () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(2) });

  const ownCard = cardManager.createCardInstance(defFor('goldCoin-v5'), cardManager.ZONES.CARGO, 'p1');
  gameState.updatePlayer('p1', { shipCargo: [ownCard] });

  const selfTargetResult = abilityResolver.resolveAbility(
    defFor('pirateDagger-v3'),
    {
      currentPlayer: gameState.getPlayer('p1'),
      targetPlayer: gameState.getPlayer('p1'),
      targetCardId: ownCard.instanceId,
      reason: 'reveal',
    },
    cardDefs
  );
  assert.equal(gameState.getPlayer('p1').shipCargo.length, 1);
  assert.equal(gameState.getExpeditionArea().length, 0);
  assert.equal(selfTargetResult.shipwreckedCard, null);

  const noTargetResult = abilityResolver.resolveAbility(
    defFor('pirateDagger-v3'),
    { currentPlayer: gameState.getPlayer('p1'), reason: 'reveal' },
    cardDefs
  );
  assert.equal(gameState.getExpeditionArea().length, 0);
  assert.equal(noTargetResult.processedCount, 1);
});

// ---------------------------------------------------------------------------
// Lucky Anchor (§14.5)
// ---------------------------------------------------------------------------

test('Lucky Anchor: replays a card from the current player\'s own cargo into the resolution flow', () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(1) });

  const replayCard = cardManager.createCardInstance(defFor('goldCoin-v5'), cardManager.ZONES.CARGO, 'p1');
  gameState.updatePlayer('p1', { shipCargo: [replayCard] });

  const result = abilityResolver.resolveAbility(
    defFor('luckyAnchor-v3'),
    { currentPlayer: gameState.getPlayer('p1'), cargoCardId: replayCard.instanceId, reason: 'reveal' },
    cardDefs
  );

  assert.equal(gameState.getPlayer('p1').shipCargo.length, 0, 'removed from cargo — back at risk');
  const expedition = gameState.getExpeditionArea();
  assert.equal(expedition.length, 1);
  assert.equal(expedition[0].instanceId, replayCard.instanceId);
  assert.equal(result.shipwreckedCard, null);
});

test('Lucky Anchor: a nonexistent cargo card id no-ops rather than throwing', () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(1) });

  assert.doesNotThrow(() => {
    abilityResolver.resolveAbility(
      defFor('luckyAnchor-v3'),
      { currentPlayer: gameState.getPlayer('p1'), cargoCardId: 'goldCoin-v9#999', reason: 'reveal' },
      cardDefs
    );
  });
  assert.equal(gameState.getExpeditionArea().length, 0);
});

// ---------------------------------------------------------------------------
// Sea Serpent (§14.6)
// ---------------------------------------------------------------------------

test('Sea Serpent: forces an additional reveal from the Treasure Deck', () => {
  startFreshExpedition();
  const forcedDef = defFor('goldCoin-v5');
  const forcedInstance = cardManager.createCardInstance(forcedDef, cardManager.ZONES.DECK);
  gameState.setTreasureDeck([forcedInstance, ...gameState.getTreasureDeck()]);

  revealSequence([defFor('seaSerpent-v2')]);

  assert.equal(gameState.getPhase(), 'PLAYER_DECISION');
  const expedition = gameState.getExpeditionArea();
  assert.equal(expedition.length, 2);
  assert.equal(expedition[1].instanceId, forcedInstance.instanceId);
  assert.ok(
    !gameState.getTreasureDeck().some((c) => c.instanceId === forcedInstance.instanceId),
    'the forced card was actually drawn (removed from the deck), not just peeked'
  );
});

test('Sea Serpent forcing another Sea Serpent is always an immediate Shipwreck (every Sea Serpent shares one type)', () => {
  startFreshExpedition();
  const secondSerpentInstance = cardManager.createCardInstance(defFor('seaSerpent-v4'), cardManager.ZONES.DECK);
  gameState.setTreasureDeck([secondSerpentInstance, ...gameState.getTreasureDeck()]);

  revealSequence([defFor('seaSerpent-v2')]);

  // Every Sea Serpent card shares the type "seaSerpent" (GDD §14.6), so a
  // forced reveal that happens to ALSO be a Sea Serpent duplicates the
  // one that forced it — the Resolution Queue halts before that second
  // card's own ability (which would have forced a THIRD reveal) ever
  // runs, exactly as it would for any other duplicate.
  const p1Entry = gameState.getTurnHistory().find((e) => e.playerId === 'p1');
  assert.equal(p1Entry.decision, 'shipwreck');
  assert.equal(p1Entry.cardsLost, 2);
});

test('Sea Serpent: a forced reveal can chain into a DIFFERENT chain ability, cascading across three cards', () => {
  startFreshExpedition();
  const lostLootDef = defFor('goldCoin-v6');
  const lostLootCard = cardManager.createCardInstance(lostLootDef, cardManager.ZONES.LOST_LOOT);
  gameState.setLostLoot([lostLootCard]);

  const forcedMapInstance = cardManager.createCardInstance(defFor('treasureMap-v3'), cardManager.ZONES.DECK);
  gameState.setTreasureDeck([forcedMapInstance, ...gameState.getTreasureDeck()]);

  // seaSerpent-v2 (revealed normally, hop 1) forces treasureMap-v3 (hop
  // 2, a DIFFERENT type — safe). Treasure Map's own handler then runs
  // (still within the SAME resolveAbility() call, no recursion), and
  // with no explicit targetCardId forwarded through the chain, defaults
  // to retrieving the top of Lost Loot (hop 3) — three cards from one
  // original reveal, entirely via the Resolution Queue.
  revealSequence([defFor('seaSerpent-v2')]);

  assert.equal(gameState.getPhase(), 'PLAYER_DECISION');
  const expedition = gameState.getExpeditionArea();
  assert.equal(expedition.length, 3);
  assert.equal(expedition[1].instanceId, forcedMapInstance.instanceId);
  assert.equal(expedition[2].instanceId, lostLootCard.instanceId);
  assert.equal(gameState.getLostLoot().length, 0);
});

test('Sea Serpent: a forced reveal that duplicates halts the chain and Shipwrecks', () => {
  startFreshExpedition();
  // goldCoin-v4 is already in the expedition; the forced card duplicates its type.
  const duplicateInstance = cardManager.createCardInstance(defFor('goldCoin-v6'), cardManager.ZONES.DECK);
  gameState.setTreasureDeck([duplicateInstance, ...gameState.getTreasureDeck()]);

  revealSequence([defFor('goldCoin-v4'), defFor('seaSerpent-v2')]);

  const p1Entry = gameState.getTurnHistory().find((e) => e.playerId === 'p1');
  assert.equal(p1Entry.decision, 'shipwreck');
  assert.equal(p1Entry.cardsLost, 3); // goldCoin-v4, seaSerpent-v2, the forced duplicate
});

test('Sea Serpent: an empty Treasure Deck is a graceful no-op', () => {
  startFreshExpedition();
  gameState.setTreasureDeck([]);
  revealSequence([defFor('seaSerpent-v2')]);

  assert.equal(gameState.getPhase(), 'PLAYER_DECISION');
  assert.equal(gameState.getExpeditionArea().length, 1);
});

// ---------------------------------------------------------------------------
// Treasure Map (§14.7)
// ---------------------------------------------------------------------------

test('Treasure Map: retrieves a card from Lost Loot into the resolution flow', () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(1) });

  const lostCard = cardManager.createCardInstance(defFor('goldCoin-v5'), cardManager.ZONES.LOST_LOOT);
  gameState.setLostLoot([lostCard]);

  const result = abilityResolver.resolveAbility(
    defFor('treasureMap-v2'),
    { currentPlayer: gameState.getPlayer('p1'), targetCardId: lostCard.instanceId, reason: 'reveal' },
    cardDefs
  );

  assert.equal(gameState.getLostLoot().length, 0);
  const expedition = gameState.getExpeditionArea();
  assert.equal(expedition.length, 1);
  assert.equal(expedition[0].instanceId, lostCard.instanceId);
  assert.equal(result.shipwreckedCard, null);
});

test('Treasure Map: an empty Lost Loot is a graceful no-op', () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(1) });

  assert.doesNotThrow(() => {
    abilityResolver.resolveAbility(
      defFor('treasureMap-v2'),
      { currentPlayer: gameState.getPlayer('p1'), reason: 'reveal' },
      cardDefs
    );
  });
  assert.equal(gameState.getExpeditionArea().length, 0);
});

// ---------------------------------------------------------------------------
// Treasure Chest + Golden Key (§14.8)
// ---------------------------------------------------------------------------

test('Treasure Chest + Golden Key: grants no bonus on a normal reveal — only on Return to Ship', () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(1) });

  const lostCard = cardManager.createCardInstance(defFor('goldCoin-v5'), cardManager.ZONES.LOST_LOOT);
  gameState.setLostLoot([lostCard]);

  abilityResolver.resolveAbility(
    defFor('treasureChest-v3'),
    { currentPlayer: gameState.getPlayer('p1'), reason: 'reveal' },
    cardDefs
  );

  assert.equal(gameState.getLostLoot().length, 1, 'a normal reveal must not trigger the bonus draw');
  assert.equal(gameState.getPlayer('p1').shipCargo.length, 0);
});

test('Treasure Chest + Golden Key: grants a bonus card from Lost Loot on Return to Ship', () => {
  startFreshExpedition(1);
  const bonusCard = cardManager.createCardInstance(defFor('cannon-v5'), cardManager.ZONES.LOST_LOOT);
  gameState.setLostLoot([bonusCard]);

  revealSequence([defFor('treasureChest-v3')]);
  turnManager.returnToShip();

  assert.equal(gameState.getLostLoot().length, 0);
  const cargo = gameState.getPlayer('p1').shipCargo;
  assert.equal(cargo.length, 2); // the Chest itself + the bonus card
  assert.ok(cargo.some((c) => c.instanceId === bonusCard.instanceId));
  assert.ok(cargo.every((c) => c.currentZone === 'cargo' && c.ownerId === 'p1'));
});

test('Treasure Chest + Golden Key: an empty Lost Loot at Return to Ship is a graceful no-op', () => {
  startFreshExpedition(1);
  gameState.setLostLoot([]);

  revealSequence([defFor('treasureChest-v3')]);
  assert.doesNotThrow(() => turnManager.returnToShip());

  const cargo = gameState.getPlayer('p1').shipCargo;
  assert.equal(cargo.length, 1); // just the Chest itself, no bonus
});
