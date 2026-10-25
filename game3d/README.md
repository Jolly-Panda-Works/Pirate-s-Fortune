# Pirate's Fortune 3D

A 3D, multiplayer client/server for Pirate's Fortune. **The game rules are not touched.** The server runs the original headless engine from `../js/` (`gameManager.js`, `turnManager.js`, and the rest) unmodified, and it reads the same `../data/*.json` files.

## Run locally

```bash
cd game3d
npm install
npm run dev
```

- Client (Vite + React Three Fiber): http://localhost:5173
- Game server (Colyseus): ws://localhost:2567 (override with `GAME_PORT`)

Production-style, as a single process: run `npm run build`, then `npm start`. The server then also serves `dist/` on port 2567.

Tests: `npm test` runs the server/engine-host tests. The original 219 engine tests still run from the repo root with `npm test`.

## Architecture

| Layer | Tech | Where |
|---|---|---|
| Rules engine (unchanged) | vanilla ES modules | `../js/` |
| Authoritative server | Colyseus rooms, matchmaking, reconnection, schema state sync | `server/` |
| 3D scene | React Three Fiber, Drei (Sky, Environment, OrbitControls, CameraShake, Html, Float, Sparkles, ContactShadows) | `client/src/three/` |
| Physics | @react-three/rapier: coins on Return to Ship, planks on Shipwreck | `three/PhysicsFx.jsx` |
| Particles | three.quarks: sparks, smoke, splash, gold, magic trails, torch fire | `three/Particles.jsx` |
| Post-processing | @react-three/postprocessing: bloom, depth of field, grain, vignette | `three/Effects.jsx` |
| UX | loading → splash → menu → solo / multiplayer lobby → game → results, plus profile, settings, how-to-play and credits; English/Persian with RTL | `client/src/screens/` |

**How the engine is shared across rooms** (`server/engineHost.js`): `gameState.js` holds one state per process. Before each action, the server restores that room's own snapshot with `restoreStateSnapshot`, calls `gameManager`, and takes the new snapshot out again. The engine is synchronous, so the calls cannot interleave. Every engine event is recorded as a replay "frame", and the client animates each reveal, ability, shipwreck and AI decision from those frames.

The client only sends intents: `explore`, `return` and `choose`. The server validates whose turn it is, and the engine's own guards reject illegal moves. If a human leaves a game for good, their seat is played by the engine's own AI (`playerManager`).

All art is procedural (ship, island, cards painted on canvas), so the game runs fully offline. TripoSR (image → 3D model) is a separate Python prototyping tool and is not part of the runtime. You could use it to replace the procedural props later.
