// Prints node tree + mesh bounds of a GLB (no deps).
import { readFileSync } from 'node:fs';
const buf = readFileSync(process.argv[2]);
const len = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.slice(20, 20 + len).toString());
const meshBounds = (mi) => {
  const p = gltf.meshes[mi].primitives[0].attributes.POSITION;
  const a = gltf.accessors[p];
  return { min: a.min.map((v) => +v.toFixed(3)), max: a.max.map((v) => +v.toFixed(3)), count: a.count };
};
const roots = gltf.scenes[0].nodes;
const show = (i, depth) => {
  const n = gltf.nodes[i];
  const info = [n.name, n.mesh !== undefined ? JSON.stringify(meshBounds(n.mesh)) : '', n.skin !== undefined ? 'skin' : '', n.scale ? `s=${n.scale.map((v) => +v.toFixed(3))}` : '', n.rotation ? `r=${n.rotation.map((v) => +v.toFixed(2))}` : ''].filter(Boolean).join(' ');
  if (depth <= Number(process.argv[3] ?? 1)) console.log('  '.repeat(depth) + info);
  for (const c of n.children ?? []) show(c, depth + 1);
};
roots.forEach((r) => show(r, 0));
console.log('images', gltf.images?.length, 'materials', gltf.materials?.map((m) => m.name), 'skins', gltf.skins?.length);
