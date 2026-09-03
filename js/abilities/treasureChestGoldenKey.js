/**
 * abilities/treasureChestGoldenKey.js
 *
 * GDD §14.8 — Treasure Chest + Golden Key: triggers on Return to Ship
 * (not normal reveal resolution — this handler itself self-guards on
 * `context.reason === 'returnToShip'`, since the registry
 * (abilityManager.js) has no notion of restricting WHICH call site may
 * invoke a given key, and turnManager's normal RESOLVE_ABILITY step calls
 * abilityResolver.resolveAbility() for every revealed card regardless of
 * its ability). Once a Treasure Chest + Golden Key card is successfully
 * secured into Ship Cargo, a card is drawn from the top of Lost Loot and
 * added directly to that same player's Ship Cargo as a bonus — no
 * duplicate check, no Expedition Area involvement, since the expedition
 * that just succeeded is already over by the time this runs.
 * Implemented: Phase 10b (Chain Abilities) — Prompt 010b.
 *
 * This is registered under its ability key exactly like every other
 * ability (so abilityManager.hasAbility('treasureChestGoldenKey') is
 * true and nothing about the registry itself is special-cased), and it's
 * invoked via a plain abilityResolver.resolveAbility() call from
 * collectManager.js — it never calls `enqueue`, so it never participates
 * in the Resolution Queue the way a chain ability during exploration does.
 *
 * GDD §29.6 graceful degradation: an empty Lost Loot at the moment of
 * Return to Ship is a no-op (logged) — no bonus card, no error.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - Registered under the ability key from data/cards.json
 *    ("treasureChestGoldenKey") via abilityManager — nothing else in the
 *    codebase checks for this ability by name (rule 4).
 *  - UI never mutates GameState directly — this module is one of the
 *    sanctioned callers of gameState.js's mutators.
 */

import { createLogger } from '../logger.js';
import * as gameState from '../gameState.js';
import * as cardManager from '../cardManager.js';
import * as abilityManager from '../abilityManager.js';

const log = createLogger('abilities/treasureChestGoldenKey');

/**
 * @param {object} context - AbilityContext (GDD §12.1); `context.reason`
 *   is expected to be `'returnToShip'` (set by collectManager.js), not
 *   `'reveal'` — this ability never triggers off a normal reveal.
 */
function handleTreasureChestGoldenKey(context) {
  if (context.reason !== 'returnToShip') {
    // GDD §14.8: this ability triggers ONLY on Return to Ship — but the
    // registry (abilityManager.js) has no notion of "this key may only
    // ever be invoked from one specific call site," and turnManager's
    // normal RESOLVE_ABILITY step calls abilityResolver.resolveAbility()
    // for every revealed card regardless of which ability it has. Rather
    // than teaching the generic reveal pipeline to skip one specific
    // ability key by name (which would violate rule 4), this handler
    // guards itself: a normal reveal ('reason: reveal') — or any other
    // reason that isn't collectManager.js's explicit 'returnToShip' call
    // — is a no-op here. The card still behaves exactly like any other
    // card during a normal reveal (enters the expedition, duplicate-
    // checked, etc.) — it simply grants no bonus until it's actually
    // secured.
    return;
  }

  const playerId = context.currentPlayer?.id ?? null;
  if (!playerId) {
    log.warn('Treasure Chest + Golden Key: no current player on context — no-op');
    return;
  }

  const lostLoot = gameState.getLostLoot();
  if (lostLoot.length === 0) {
    log.info('Treasure Chest + Golden Key: Lost Loot is empty — no bonus card, graceful no-op', {
      playerId,
    });
    return;
  }

  // GDD §14.8 describes a random draw. This engine keeps every source of
  // chance behind a seed (GDD §25.3 — deterministic test scenarios;
  // deckManager.js's Treasure/Lost Loot shuffles both work this way), and
  // no "ability seed" concept exists to thread through to ability
  // handlers. Rather than reaching for Math.random() here (which would
  // make an otherwise fully-seeded game's turnHistory non-reproducible),
  // this takes the top of Lost Loot — index 0 — the same "top of an
  // already-shuffled pile" convention the Treasure Deck itself uses
  // everywhere else in this codebase. Lost Loot's own order was already
  // determined by a seeded shuffle at deck-build time, so this is still
  // effectively an unpredictable card from the player's perspective, just
  // a deterministic one from the engine's.
  const bonusRawCard = lostLoot[0];
  const remainingLostLoot = lostLoot.slice(1);
  gameState.setLostLoot(remainingLostLoot);

  const player = gameState.getPlayer(playerId);
  const claimedCard = cardManager.moveInstance(bonusRawCard, cardManager.ZONES.CARGO, playerId);
  gameState.updatePlayer(playerId, {
    shipCargo: [...(player?.shipCargo ?? []), claimedCard],
  });

  log.info('Treasure Chest + Golden Key: bonus card claimed from Lost Loot', {
    playerId,
    defId: claimedCard.defId,
  });
}

abilityManager.registerAbility('treasureChestGoldenKey', handleTreasureChestGoldenKey);

export { handleTreasureChestGoldenKey };
