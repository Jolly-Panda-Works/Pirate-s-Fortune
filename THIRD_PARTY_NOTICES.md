# Third-party notices

The code in this repository is MIT-licensed (see `LICENSE`). It builds on the
following third-party work, each under its own licence:

| Component | Licence | Notes |
|---|---|---|
| React, React Three Fiber, Drei, react-postprocessing, Rapier bindings | MIT | npm dependencies |
| three.js, three.quarks, postprocessing | MIT | npm dependencies |
| Colyseus, Capacitor | MIT | npm dependencies |
| Pirata One, Inter, Vazirmatn fonts | SIL Open Font License 1.1 | bundled via `@fontsource/*` |
| Sound effects in `assets/audio/` | MIT (this project) | procedurally generated placeholders |

## Not included: Synty POLYGON Pirate Pack

The 3D characters, props and galleon shown in the official builds come from the
commercial **POLYGON Pirate Pack by Synty Studios**. Its licence does not allow
redistributing the assets, so they are **not** part of this repository.

- Without them, the game runs with its own procedural low-poly crew and props.
- If you own a licence, extract the pack into `game3d/` and run
  `npm run assets:synty` (needs Blender 3.x). This writes the models to the
  git-ignored `client/public/models/`.
