// Writes the GitHub Release body. Env: VERSION, REPO (owner/name), HAS_MODELS ("true" when the
// licensed Synty models were included in this build).
const version = process.env.VERSION ?? "0.0.0";
const hasModels = process.env.HAS_MODELS === "true";
const f = (kind) => `PiratesFortune-${version}-${kind}`;

const modelsNote = hasModels
  ? "This build includes the licensed Synty POLYGON Pirate Pack crew, props and galleon."
  : "This build uses the game's own procedural crew and props (the licensed Synty models were not available to this build).";

console.log(`## Pirate's Fortune ${version}

A 3D push-your-luck pirate card game for 2 to 4 players by Jolly Panda Studio. Reveal treasure, risk a shipwreck, bank your loot. Play solo against AI captains, or online with friends.

${modelsNote}

### Downloads

| | File |
| --- | --- |
| Android (install on a phone) | \`${f("Android.apk")}\` (signed; if missing, use \`${f("Android-debug.apk")}\`) |
| Android (Google Play upload) | \`${f("Android.aab")}\` (only when the release keystore is configured) |
| Web + game server (self-host) | \`${f("Web.zip")}\`: unzip, run \`npm ci --omit=dev && npm start\`, open http://localhost:2567; see \`HOSTING.txt\` inside |

In the Android app, open **Settings → Game server address** and enter the address of the computer running the server.

Verify a download with \`SHA256SUMS.txt\`.
`);
