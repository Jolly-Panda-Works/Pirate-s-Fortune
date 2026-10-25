# Pirate's Fortune

[![Android build](https://github.com/Jolly-Panda-Works/Pirate-s-Fortune/actions/workflows/android.yml/badge.svg)](https://github.com/Jolly-Panda-Works/Pirate-s-Fortune/actions/workflows/android.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg)](LICENSE)

A push-your-luck pirate treasure card game for 2–4 players. This is a 3D client built with React Three Fiber, multiplayer runs on Colyseus, and the Android app is built with Capacitor.

## Run locally

```bash
npm install
npm run dev
```

- Client: http://localhost:5177
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
| `shared/roster.js` | The 8 sailor characters and the 2 arenas (ship's cabin, tavern). Shared by the server and the client. |

**How the engine is shared across rooms** (`server/engineHost.js`): `gameState.js` holds one state per process. Before each action, the server restores that room's own snapshot, calls `gameManager`, and takes the new snapshot out again. The engine is synchronous, so the calls cannot interleave. Every engine event is recorded as a replay "frame", and the client animates each one on a flat 3D board.

**Sailors and arenas:** players pick their sailor in **Captain Profile**, and the crew sits around the table, reacting to turns, cargo returns and shipwrecks. The arena is chosen in solo setup, or by the host in the lobby. **3D models are optional.** Official builds use the commercial **Synty POLYGON Pirate Pack**, whose licence forbids redistribution, so those models are **not in this repo**. A plain clone runs with the game's own procedural low-poly crew and props.

If you own the pack: extract it into `game3d/`, then run `npm run assets:synty`. This needs Blender 3.x; set `BLENDER=` if it isn't in the default location. It writes the models to the git-ignored `client/public/models/`, and the game picks them up automatically (the 15 characters are posed seated at runtime by `client/src/three/Synty.jsx`). The official Android CI reads them from a private repo through the `ASSETS_TOKEN` secret.

**Phones:** the game plays in landscape only. The Android app is locked by its manifest, and mobile browsers show a rotate-your-device notice.

The previous 2D web build is preserved on the `legacy-main` branch.

## Contributing

Issues and pull requests are welcome. Before opening a PR:

- `npm test` must pass (219 engine tests + server tests). The rules engine in `js/` is the source of truth, so gameplay changes belong there, with tests.
- Never commit third-party assets you don't have the right to redistribute (see `THIRD_PARTY_NOTICES.md`).
- New UI strings go in `client/src/i18n.js` in both English and Persian.

## License

Code: [MIT](LICENSE) © 2026 Jolly Panda Studio. Third-party components: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
