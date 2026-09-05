/**
 * ability-chains.test.js
 *
 * Covers Prompt 011 exit criteria (docs/prompts/stage-a-core-engine.md,
 * GDD §14.1-14.8): integration tests that exercise ALL EIGHT card
 * abilities inside full game scenarios — not the isolated unit-style
 * calls tests/unit/ability-resolver.test.js and
 * tests/integration/single-resolution-abilities.test.js /
 * chain-abilities.test.js already cover for each ability's own edge
 * cases (those files remain the source of truth for per-ability
 * eligibility/no-op coverage and are not duplicated here). This file's
 * job is different: real multi-player state, a rival's SUBSEQUENT state
 * (cargo, score) after an ability touches it, and combined/mixed-ability
 * chains that only make sense once every chain ability exists together.
 *
 * Scenarios (per Prompt 011's own list):
 *   - Compass: previewed card is exactly the next reveal, end-to-end,
 *     driven through the real public API (gameManager), not turnManager.
 *   - Cannon: destroys a rival's Ship Cargo card (GDD §14.2 names no
 *     zone — js/abilities/cannon.js's documented design decision targets
 *     Ship Cargo, the only zone where multiple players' cards coexist
 *     distinctly); the rival's cargo AND eventual score both reflect it.
 *   - Captain Shield: first-card-of-an-expedition protects nothing vs. a
 *     later reveal that protects as designed — both cases inside one
 *     continuous 2-player game.
 *   - Pirate Dagger: steals a rival's cargo card into the resolution
 *     flow (rival permanently loses it, proven via score), including the
 *     case where the stolen card is a duplicate (its own ability proven
 *     to never run).
 *   - Lucky Anchor: replays a card from the player's own cargo, including
 *     the case where the replayed card triggers a further (chained, not
 *     recursive) ability.
 *   - Sea Serpent: a 3+-deep forced-reveal chain through real cards (full
 *     Card Resolution Order at every hop), plus a mock-ability call-depth
 *     counter (reusing Prompt 009's technique) proving the SAME
 *     Resolution Queue never recurses no matter how deep a chain runs.
 *   - Treasure Map: retrieves a card from Lost Loot into the resolution
 *     flow (later actually secured via Return to Ship); an empty Lost
 *     Loot degrades gracefully.
 *   - Treasure Chest + Golden Key: grants a bonus card from Lost Loot
 *     only on Return to Ship, reflected in the eventual score; an empty
 *     Lost Loot degrades gracefully.
 *   - Combined: a Dagger steal that triggers a Sea Serpent that forces a
 *     second Dagger — proves the queue handles MIXED-ability chains, not
 *     just a single ability repeating itself.
 *
 * Run with: node --test tests/integration/ability-chains.test.js
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as gameState from '../../js/gameState.js';
import * as cardManager from '../../js/cardManager.js';
import * as turnManager from '../../js/turnManager.js';
import * as gameManager from '../../js/gameManager.js';
import * as abilityManager from '../../js/abilityManager.js';
import * as abilityResolver from '../../js/abilityResolver.js';
import * as scoreManager from '../../js/scoreManager.js';

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
 * picking its first eligible option (Prompt 014's PLAYER_CHOICE pause).
 * Needed because Lost Loot always starts pre-populated, so a fixed
 * seed's very first real card CAN legitimately be a Treasure Map that
 * pauses play before startFreshExpedition() discards it.
 */
function settleAnyPendingAbilityChoice() {
  let pending = gameState.getPendingAbilityChoice();
  while (pending) {
    turnManager.resolveAbilityChoice(pending.options[0]);
    pending = gameState.getPendingAbilityChoice();
  }
}

/**
 * Starts a fresh game (to properly initialize turnManager's private
 * cardDefinitions snapshot), then discards whatever random card1 was so
 * every scenario below starts from a genuinely empty, fully-scripted
 * expedition — same technique established in single-resolution-abilities
 * .test.js / chain-abilities.test.js.
 */
function startFreshExpedition(playerCount, seedSuffix) {
  turnManager.startGame(cardDefs, config, buildPlayers(playerCount), {
    treasureSeed: `ability-chains-${seedSuffix}`,
    lostLootSeed: `ability-chains-${seedSuffix}-lostloot`,
  });
  settleAnyPendingAbilityChoice();
  gameState.clearExpeditionArea();
}

/**
 * Queues `defs` (in order) at the front of the Treasure Deck, then draws
 * them one at a time via the real "Explore Further" path
 * (turnManager.drawCard() — reveal, duplicate check, ability resolution,
 * all real). Stops early if a Shipwreck or GAME_END ends the loop.
 */
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
// Registration — the Stage A gate: every one of the 8 abilities wired up.
// ---------------------------------------------------------------------------

test('all 8 ability keys (singleResolution + chain) are registered and match data/cards.json exactly', () => {
  const allKeys = [...config.abilities.singleResolution, ...config.abilities.chain];
  assert.equal(allKeys.length, 8);
  for (const key of allKeys) {
    assert.equal(abilityManager.hasAbility(key), true, `expected "${key}" to be registered`);
  }

  const abilityKeysInData = new Set(cardDefs.map((d) => d.ability).filter((a) => a !== null));
  assert.equal(abilityKeysInData.size, 8, 'every non-null ability key actually present in the card data');
  for (const key of abilityKeysInData) {
    assert.equal(abilityManager.hasAbility(key), true, `card data references unregistered ability "${key}"`);
  }
});

// ---------------------------------------------------------------------------
// Compass (§14.1)
// ---------------------------------------------------------------------------

test('Compass: end-to-end inside a real game — the previewed card is exactly the next reveal', () => {
  startFreshExpedition(2, 'compass');
  const nextDef = defFor('goldCoin-v6');
  const nextInstance = cardManager.createCardInstance(nextDef, cardManager.ZONES.DECK);
  gameState.setTreasureDeck([nextInstance, ...gameState.getTreasureDeck()]);

  revealSequence([defFor('compass-v3')]);
  const peeked = gameState.getAbilityContext();
  assert.equal(peeked.ability, 'compass');
  assert.equal(peeked.peekedInstanceId, nextInstance.instanceId);

  // Explore Further through the real public API, not turnManager directly.
  gameManager.revealNextCard();

  const expedition = gameState.getExpeditionArea();
  assert.equal(expedition.length, 2);
  assert.equal(expedition[1].instanceId, nextInstance.instanceId, 'the EXACT previewed instance, never a replacement');
  assert.equal(expedition[1].defId, nextDef.id);
});

// ---------------------------------------------------------------------------
// Cannon (§14.2)
// ---------------------------------------------------------------------------

test("Cannon: destroys an eligible rival Ship Cargo card; the rival's cargo and eventual score both reflect the loss", () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(2) });

  const rivalCard = cardManager.createCardInstance(defFor('goldCoin-v7'), cardManager.ZONES.CARGO, 'p2');
  const survivorCard = cardManager.createCardInstance(defFor('cannon-v4'), cardManager.ZONES.CARGO, 'p2');
  gameState.updatePlayer('p2', { shipCargo: [rivalCard, survivorCard] });

  // Simulate the initiating Cannon already having gone through
  // REVEAL_CARD (it's already sitting in the Expedition Area), same as
  // turnManager.resolveAbility() would find it.
  const initiatingCannon = cardManager.createCardInstance(defFor('cannon-v2'), cardManager.ZONES.EXPEDITION);
  gameState.setExpeditionArea([initiatingCannon]);

  abilityResolver.resolveAbility(
    defFor('cannon-v2'),
    {
      currentPlayer: gameState.getPlayer('p1'),
      targetPlayer: gameState.getPlayer('p2'),
      targetCardId: rivalCard.instanceId,
      reason: 'reveal',
    },
    cardDefs
  );

  const p2AfterDestroy = gameState.getPlayer('p2');
  assert.equal(p2AfterDestroy.shipCargo.length, 1, 'only the targeted card was destroyed');
  assert.equal(p2AfterDestroy.shipCargo[0].instanceId, survivorCard.instanceId);
  const lostLoot = gameState.getLostLoot();
  assert.equal(lostLoot.length, 1);
  assert.equal(lostLoot[0].instanceId, rivalCard.instanceId);
  assert.equal(lostLoot[0].ownerId, null, 'destroyed card no longer belongs to anyone');

  // Rival's subsequent state: the destroyed card must contribute nothing
  // to the rival's eventual score — only the survivor's value does.
  const rivalScore = scoreManager.calculateScore(gameState.getPlayer('p2'), cardDefs);
  assert.equal(rivalScore, defFor('cannon-v4').value);
});

// ---------------------------------------------------------------------------
// Captain Shield (§14.3)
// ---------------------------------------------------------------------------

test('Captain Shield: first-card reveal protects nothing, but a later reveal protects as designed — across one continuous game', () => {
  startFreshExpedition(2, 'shield');

  // p1's expedition: Shield is the very FIRST card -> protects nothing,
  // so the very next duplicate is a normal, unprotected Shipwreck.
  revealSequence([defFor('captainShield-v3'), defFor('goldCoin-v5'), defFor('goldCoin-v6')]);
  assert.equal(gameState.getShieldActive(), false);
  const p1Entry = gameState.getTurnHistory().find((e) => e.playerId === 'p1');
  assert.equal(p1Entry.decision, 'shipwreck');
  assert.equal(p1Entry.cardsLost, 3);

  // Turn already advanced to p2, whose own card auto-revealed into a
  // fresh Expedition Area as part of the same Shipwreck -> endTurn ->
  // playerTurnStart cascade — discard that unscripted card so p2's
  // scripted expedition below starts from a clean slate, same technique
  // startFreshExpedition() itself uses.
  gameState.clearExpeditionArea();

  // p2's expedition: Shield is NOT the first card -> activates, then
  // absorbs the very next duplicate instead of Shipwrecking everything.
  revealSequence([defFor('goldCoin-v5'), defFor('captainShield-v4'), defFor('goldCoin-v6')]);
  assert.equal(gameState.getShieldActive(), false, 'the one-time protection was just spent absorbing the duplicate');
  assert.equal(gameState.getPhase(), 'PLAYER_DECISION', 'the expedition continues — no Shipwreck this time');
  const expeditionAfterAbsorb = gameState.getExpeditionArea();
  assert.equal(expeditionAfterAbsorb.length, 2, 'only the duplicate card was removed to Lost Loot');

  gameManager.returnToShip();
  const p2Entry = gameState.getTurnHistory().filter((e) => e.playerId === 'p2').at(-1);
  assert.equal(p2Entry.decision, 'return');
  assert.equal(p2Entry.cardsSecured, 2);
});

// ---------------------------------------------------------------------------
// Pirate Dagger (§14.4)
// ---------------------------------------------------------------------------

test("Pirate Dagger: steals a rival cargo card into the resolution flow; the rival permanently loses it", () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(2) });

  const keepCard = cardManager.createCardInstance(defFor('goldCoin-v6'), cardManager.ZONES.CARGO, 'p2');
  const stealCard = cardManager.createCardInstance(defFor('treasureMap-v6'), cardManager.ZONES.CARGO, 'p2');
  gameState.updatePlayer('p2', { shipCargo: [keepCard, stealCard] });

  const initiatingDagger = cardManager.createCardInstance(defFor('pirateDagger-v4'), cardManager.ZONES.EXPEDITION);
  gameState.setExpeditionArea([initiatingDagger]);

  const result = abilityResolver.resolveAbility(
    defFor('pirateDagger-v4'),
    {
      currentPlayer: gameState.getPlayer('p1'),
      targetPlayer: gameState.getPlayer('p2'),
      targetCardId: stealCard.instanceId,
      reason: 'reveal',
    },
    cardDefs
  );

  assert.equal(result.shipwreckedCard, null);
  const p2After = gameState.getPlayer('p2');
  assert.equal(p2After.shipCargo.length, 1, 'the stolen card is gone from the rival');
  assert.equal(p2After.shipCargo[0].instanceId, keepCard.instanceId);
  const expedition = gameState.getExpeditionArea();
  assert.equal(expedition.length, 2);
  assert.equal(expedition[1].instanceId, stealCard.instanceId);
  assert.equal(expedition[1].ownerId, null, 'stolen card is at risk again, not still owned by the rival');

  // Rival's subsequent state: the theft is permanent, reflected in score.
  const rivalScore = scoreManager.calculateScore(gameState.getPlayer('p2'), cardDefs);
  assert.equal(rivalScore, defFor('goldCoin-v6').value);
});

test("Pirate Dagger: a stolen card that duplicates an existing expedition card halts resolution — its own ability never executes", () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(2) });

  // A Compass already present in the expedition; the stolen card below
  // shares its TYPE, so it duplicates the instant it enters. Using an
  // ability-bearing card (rather than a Gold Coin) lets us prove its own
  // ability handler — which would call gameState.setAbilityContext() —
  // genuinely never ran, not just infer it from a null-ability card.
  const existingCompass = cardManager.createCardInstance(defFor('compass-v3'), cardManager.ZONES.EXPEDITION);
  const initiatingDagger = cardManager.createCardInstance(defFor('pirateDagger-v5'), cardManager.ZONES.EXPEDITION);
  gameState.setExpeditionArea([existingCompass, initiatingDagger]);
  assert.equal(gameState.getAbilityContext(), null);

  const stolenCompass = cardManager.createCardInstance(defFor('compass-v5'), cardManager.ZONES.CARGO, 'p2');
  gameState.updatePlayer('p2', { shipCargo: [stolenCompass] });

  const result = abilityResolver.resolveAbility(
    defFor('pirateDagger-v5'),
    {
      currentPlayer: gameState.getPlayer('p1'),
      targetPlayer: gameState.getPlayer('p2'),
      targetCardId: stolenCompass.instanceId,
      reason: 'reveal',
    },
    cardDefs
  );

  assert.ok(result.shipwreckedCard);
  assert.equal(result.shipwreckedCard.instanceId, stolenCompass.instanceId);
  assert.equal(
    gameState.getAbilityContext(),
    null,
    "the stolen Compass's own ability (which would set abilityContext) never ran — it duplicated before its ability could resolve"
  );
});

// ---------------------------------------------------------------------------
// Lucky Anchor (§14.5)
// ---------------------------------------------------------------------------

test('Lucky Anchor: replaying a card from cargo can itself trigger a further ability (chained, never recursive)', () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(1) });

  const cargoSerpent = cardManager.createCardInstance(defFor('seaSerpent-v3'), cardManager.ZONES.CARGO, 'p1');
  gameState.updatePlayer('p1', { shipCargo: [cargoSerpent] });

  const initiatingAnchor = cardManager.createCardInstance(defFor('luckyAnchor-v4'), cardManager.ZONES.EXPEDITION);
  gameState.setExpeditionArea([initiatingAnchor]);

  const forcedDraw = cardManager.createCardInstance(defFor('goldCoin-v7'), cardManager.ZONES.DECK);
  gameState.setTreasureDeck([forcedDraw]);

  const result = abilityResolver.resolveAbility(
    defFor('luckyAnchor-v4'),
    { currentPlayer: gameState.getPlayer('p1'), cargoCardId: cargoSerpent.instanceId, reason: 'reveal' },
    cardDefs
  );

  assert.equal(gameState.getPlayer('p1').shipCargo.length, 0, "replayed card is removed from cargo — genuinely at risk again");
  const expedition = gameState.getExpeditionArea();
  assert.equal(expedition.length, 3, 'anchor + replayed sea serpent + the reveal ITS ability forces');
  assert.equal(expedition[1].instanceId, cargoSerpent.instanceId);
  assert.equal(expedition[2].instanceId, forcedDraw.instanceId);
  assert.equal(result.shipwreckedCard, null);
  assert.equal(result.processedCount, 3, 'anchor(1) + replayed serpent introduced+resolved(1) + forced draw introduced(1)');
});

// ---------------------------------------------------------------------------
// Sea Serpent (§14.6)
// ---------------------------------------------------------------------------

test('Sea Serpent-shaped chain: the Resolution Queue drains iteratively, never recursively, even 3+ hops deep', () => {
  // Reuses the call-depth-counter technique from Prompt 009's tests
  // (tests/unit/ability-resolver.test.js) against a mock ability shaped
  // like Sea Serpent's own chain (each hop enqueues one more), proving
  // the SAME Resolution Queue Sea Serpent rides on never nests a handler
  // invocation inside another, no matter how deep the chain runs. A real
  // Sea Serpent can never chain into a THIRD Sea Serpent (every Sea
  // Serpent shares one type, so a second one always duplicates and halts
  // the queue — documented in js/abilities/seaSerpent.js and proven in
  // chain-abilities.test.js), so a mock is what actually lets this go
  // 3+ hops deep against a real card wouldn't be possible.
  let currentDepth = 0;
  let maxDepthSeen = 0;
  let hopsRun = 0;
  const chainLength = 5; // origin + 4 generated hops — comfortably "3+ deep"

  function mockDeepChain(context, enqueue) {
    currentDepth += 1;
    maxDepthSeen = Math.max(maxDepthSeen, currentDepth);
    hopsRun += 1;

    const hop = Number(context.parentAbility.split('-')[1]) + 1;
    if (hop < chainLength) {
      enqueue({
        source: { id: `mockDeepChain-hop${hop}`, type: 'mockDeepChain', value: 1, ability: 'mockDeepChainAbility' },
        reason: 'forced',
        parentAbility: `hop-${hop}`,
      });
    }
    currentDepth -= 1;
  }

  abilityManager.registerAbility('mockDeepChainAbility', mockDeepChain);

  const originDef = { id: 'mockDeepChain-origin', type: 'mockDeepChain', value: 1, ability: 'mockDeepChainAbility' };
  const result = abilityResolver.resolveAbility(originDef, { reason: 'reveal', parentAbility: 'hop-0' });

  assert.equal(hopsRun, chainLength);
  assert.equal(maxDepthSeen, 1, 'no nested/recursive handler invocation at any depth of the chain');
  assert.equal(result.processedCount, chainLength);
});

test('Sea Serpent: a forced reveal cascades through 3+ real cards, each completing the full Card Resolution Order', () => {
  startFreshExpedition(1, 'seaserpent-cascade');

  // hop 3: sitting in Lost Loot, retrieved by hop 2's Treasure Map. A
  // Cannon with no target forwarded through the chain, so its own
  // ability legitimately no-ops — but it must still go through
  // expedition-entry + duplicate-checking like any other chain-generated
  // card (that's the property this test is actually proving).
  const hop3Def = defFor('cannon-v5');
  const hop3Card = cardManager.createCardInstance(hop3Def, cardManager.ZONES.LOST_LOOT);
  gameState.setLostLoot([hop3Card]);

  // hop 2: forced from the deck by Sea Serpent — a Treasure Map (distinct type).
  const hop2Def = defFor('treasureMap-v4');
  const hop2Card = cardManager.createCardInstance(hop2Def, cardManager.ZONES.DECK);
  gameState.setTreasureDeck([hop2Card, ...gameState.getTreasureDeck()]);

  // hop 1: the naturally revealed Sea Serpent, through the real "Explore
  // Further" path (turnManager.drawCard()).
  revealSequence([defFor('seaSerpent-v3')]);

  assert.equal(gameState.getPhase(), 'PLAYER_DECISION', 'no duplicate anywhere in the chain — resolved safely');
  const expedition = gameState.getExpeditionArea();
  assert.equal(expedition.length, 3, 'seaSerpent + forced treasureMap + retrieved cannon, all one resolveAbility() call');
  assert.equal(expedition[1].instanceId, hop2Card.instanceId);
  assert.equal(expedition[2].instanceId, hop3Card.instanceId);
  assert.equal(gameState.getLostLoot().length, 0);
  assert.ok(
    gameState.getTreasureDeck().every((c) => c.instanceId !== hop2Card.instanceId),
    'hop 2 was actually drawn, not just peeked'
  );
});

// ---------------------------------------------------------------------------
// Treasure Map (§14.7)
// ---------------------------------------------------------------------------

test('Treasure Map: pauses for a human target choice, then retrieves the chosen card into the resolution flow, later actually secured via Return to Ship', () => {
  // Prompt 014: Treasure Map is now a targeted ability — a human current
  // player with an eligible Lost Loot card PAUSES at PLAYER_CHOICE
  // (turnManager.js's resolveAbility()) rather than resolving
  // immediately, exactly like Cannon/Dagger/Anchor. This replaces this
  // test's pre-Prompt-014 assumption that Explore Further alone would
  // finish resolution synchronously.
  startFreshExpedition(1, 'treasuremap');
  const retrievedDef = defFor('goldCoin-v8');
  const retrievedCard = cardManager.createCardInstance(retrievedDef, cardManager.ZONES.LOST_LOOT);
  gameState.setLostLoot([retrievedCard]);

  revealSequence([defFor('treasureMap-v5')]);

  assert.equal(gameState.getPhase(), 'PLAYER_CHOICE');
  const pending = gameState.getPendingAbilityChoice();
  assert.equal(pending.ability, 'treasureMap');
  assert.equal(pending.options.length, 1);
  assert.equal(pending.options[0].targetCardId, retrievedCard.instanceId);

  turnManager.resolveAbilityChoice(pending.options[0]);

  assert.equal(gameState.getPhase(), 'PLAYER_DECISION');
  assert.equal(gameState.getPendingAbilityChoice(), null);
  const expedition = gameState.getExpeditionArea();
  assert.equal(expedition.length, 2);
  assert.equal(expedition[1].instanceId, retrievedCard.instanceId);
  assert.equal(gameState.getLostLoot().length, 0);

  gameManager.returnToShip();
  const cargo = gameState.getPlayer('p1').shipCargo;
  assert.equal(cargo.length, 2);
  assert.ok(cargo.some((c) => c.instanceId === retrievedCard.instanceId));
});

test('Treasure Map: an empty Lost Loot mid-game is a graceful no-op, not a thrown error', () => {
  startFreshExpedition(1, 'treasuremap-empty');
  gameState.setLostLoot([]);
  assert.doesNotThrow(() => revealSequence([defFor('treasureMap-v5')]));
  assert.equal(gameState.getExpeditionArea().length, 1, 'only the Treasure Map itself — nothing retrieved');
});

// ---------------------------------------------------------------------------
// Treasure Chest + Golden Key (§14.8)
// ---------------------------------------------------------------------------

test('Treasure Chest + Golden Key: grants a bonus card from Lost Loot on Return to Ship, reflected in the eventual score', () => {
  startFreshExpedition(1, 'chest');
  const bonusDef = defFor('luckyAnchor-v5');
  const bonusCard = cardManager.createCardInstance(bonusDef, cardManager.ZONES.LOST_LOOT);
  gameState.setLostLoot([bonusCard]);

  revealSequence([defFor('treasureChest-v4')]);
  gameManager.returnToShip();

  const cargo = gameState.getPlayer('p1').shipCargo;
  assert.equal(cargo.length, 2);
  assert.ok(cargo.some((c) => c.instanceId === bonusCard.instanceId));
  assert.equal(gameState.getLostLoot().length, 0);

  const finalScore = scoreManager.calculateScore(gameState.getPlayer('p1'), cardDefs);
  assert.equal(finalScore, defFor('treasureChest-v4').value + bonusDef.value, 'both the Chest and its bonus card count');
});

test('Treasure Chest + Golden Key: an empty Lost Loot at Return to Ship gracefully grants no bonus', () => {
  startFreshExpedition(1, 'chest-empty');
  gameState.setLostLoot([]);
  revealSequence([defFor('treasureChest-v4')]);
  assert.doesNotThrow(() => gameManager.returnToShip());
  const cargo = gameState.getPlayer('p1').shipCargo;
  assert.equal(cargo.length, 1, 'just the Chest itself, no bonus');
});

// ---------------------------------------------------------------------------
// Combined mixed-ability chain
// ---------------------------------------------------------------------------

test('Combined chain: a Dagger steal triggers a Sea Serpent that forces a second Dagger — the queue handles MIXED-ability chains', () => {
  gameState.resetState();
  cardManager.resetInstanceCounter();
  gameState.initState({ config, players: buildPlayers(2) });

  const initiatingDagger = cardManager.createCardInstance(defFor('pirateDagger-v6'), cardManager.ZONES.EXPEDITION);
  gameState.setExpeditionArea([initiatingDagger]);

  const stolenSerpent = cardManager.createCardInstance(defFor('seaSerpent-v4'), cardManager.ZONES.CARGO, 'p2');
  gameState.updatePlayer('p2', { shipCargo: [stolenSerpent] });

  const forcedSecondDagger = cardManager.createCardInstance(defFor('pirateDagger-v2'), cardManager.ZONES.DECK);
  gameState.setTreasureDeck([forcedSecondDagger]);

  const result = abilityResolver.resolveAbility(
    defFor('pirateDagger-v6'),
    {
      currentPlayer: gameState.getPlayer('p1'),
      targetPlayer: gameState.getPlayer('p2'),
      targetCardId: stolenSerpent.instanceId,
      reason: 'reveal',
    },
    cardDefs
  );

  // Hop 1: pirateDagger-v6 (initiating, already in the expedition) steals
  // hop 2 (seaSerpent-v4, distinct type — enters safely, its own ability
  // forces hop 3 from the deck). Hop 3 (pirateDagger-v2) shares its type
  // with hop 1, already sitting in the expedition -> duplicate -> halt.
  assert.ok(result.shipwreckedCard, 'the mixed chain correctly halts on the second Dagger');
  assert.equal(result.shipwreckedCard.instanceId, forcedSecondDagger.instanceId);
  assert.equal(result.processedCount, 3, 'dagger(1) + seaSerpent introduced+resolved(1) + forced second dagger introduced(1)');

  const expedition = gameState.getExpeditionArea();
  assert.equal(expedition.length, 3);
  assert.equal(expedition[1].instanceId, stolenSerpent.instanceId, 'the stolen Sea Serpent genuinely entered the expedition');
  assert.equal(expedition[2].instanceId, forcedSecondDagger.instanceId);

  assert.equal(
    gameState.getPlayer('p2').shipCargo.length,
    0,
    "rival's cargo permanently lost the stolen card regardless of the eventual Shipwreck"
  );
});
