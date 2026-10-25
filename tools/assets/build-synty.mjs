// Rebuilds client/public/models/*.glb from the licensed Synty POLYGON
// Pirate Pack extracted into game3d/ (kept out of git):
// Output goes to client/public/models/ (git-ignored — the licence forbids
// redistributing the assets), plus a manifest.json the client looks for.
//   1. Blender (headless) exports characters / props / ship to GLB
//   2. gltf-transform quantizes + meshopt-compresses them (~10 MB -> ~2 MB)
//
//   npm run assets:synty            (set BLENDER=... if Blender isn't in the default path)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pack = path.join(root, 'game3d');
const out = path.join(root, 'client/public/models');
const blender = process.env.BLENDER
  ?? ['C:/Program Files/Blender Foundation/Blender 3.0/blender.exe', '/usr/bin/blender', '/Applications/Blender.app/Contents/MacOS/Blender']
    .find((p) => existsSync(p))
  ?? 'blender';

if (!existsSync(path.join(pack, 'PolygonPirates'))) {
  console.error(`Synty pack not found at ${pack}/PolygonPirates — extract your licensed copy there first.`);
  process.exit(1);
}

const raw = mkdtempSync(path.join(tmpdir(), 'synty-'));
mkdirSync(out, { recursive: true });
execFileSync(blender, ['-b', '--python-exit-code', '1', '-P', path.join(root, 'tools/assets/export_synty.py'), '--', pack, raw], { stdio: 'inherit' });

const cli = path.join(root, 'node_modules/@gltf-transform/cli/bin/cli.js');
for (const file of readdirSync(raw).filter((f) => f.endsWith('.glb'))) {
  execFileSync(process.execPath, [
    cli, 'optimize', path.join(raw, file), path.join(out, file),
    '--compress', 'meshopt', '--texture-compress', 'false', '--simplify', 'false',
    '--instance', 'false', '--join', 'false', '--flatten', 'false', '--palette', 'false',
  ], { stdio: 'inherit' });
}
writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify({ version: Date.now().toString(36), source: 'Synty POLYGON Pirate Pack (licensed, not redistributable)' }, null, 2)}\n`);
console.log(`Models written to ${out}`);
