# Pirate's Fortune

A push-your-luck pirate treasure card game for 2–4 players. This is a 3D client built with React Three Fiber, multiplayer runs on Colyseus, and the Android app is built with Capacitor.

## Run locally

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- Game server (Colyseus): ws://localhost:2567 (override with `GAME_PORT`)

Production-style, as a single process: run `npm run build`, then `npm start`. The server then also serves `dist/` on port 2567.

Tests: `npm test` runs the 219 engine tests and the server tests.

## Android

Every push to `main` builds an APK in GitHub Actions (`.github/workflows/android.yml`). The newest build is attached to the **android-latest** pre-release, and tags `v*` create a versioned release. In the app, open **Settings → Game server address** and enter the IP of the computer running `npm start`, for example `192.168.1.20:2567`.

To build an APK locally you need the Android SDK. Run `npm run android:apk`.

## Layout

| Path | What |
|---|---|
| `js/`, `data/` | Headless rules engine and card data. This is the game logic, shared and unchanged. |
| `tests/` | Engine test suite |
| `server/` | Colyseus rooms: authoritative engine host, matchmaking, reconnection, AI takeover |
| `client/` | React Three Fiber client: Drei, Rapier physics, three.quarks particles, post-processing. Full UX with EN/FA and RTL. |
| `android/` | Capacitor Android project |
| `docs/` | Game design document and architecture notes |

**How the engine is shared across rooms** (`server/engineHost.js`): `gameState.js` holds one state per process. Before each action, the server restores that room's own snapshot, calls `gameManager`, and takes the new snapshot out again. The engine is synchronous, so the calls cannot interleave. Every engine event is recorded as a replay "frame", and the client animates each one on a flat 3D board.

The previous 2D web build is preserved on the `legacy-main` branch.
