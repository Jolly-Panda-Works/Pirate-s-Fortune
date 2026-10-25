/**
 * Models from the licensed Synty POLYGON Pirate Pack, exported to GLB by
 * tools/assets/export_synty.py into client/src/assets/models/.
 *
 *  <Prop name="SM_Prop_Barrel_01" />   — a static prop, real-world metres × WORLD_SCALE
 *  <SyntySailor character={…} mood=… /> — a seated, animated crew member
 *
 * The characters ship in a T-pose with no animation clips, so they are
 * posed at runtime: each bone is aimed so the vector to its child bone
 * points along a target direction in the sailor's own frame (+z = toward
 * the table, +y = up). That needs no knowledge of the rig's local bone
 * axes, and blending those directions gives smooth mood changes.
 */

import { Component, Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

import charactersUrl from '../assets/models/characters.glb?url';
import propsUrl from '../assets/models/props.glb?url';
import shipUrl from '../assets/models/ship.glb?url';

// Imported through Vite so each file gets a content-hashed URL (no stale caches).
export const MODEL_URLS = { characters: charactersUrl, props: propsUrl, ship: shipUrl };

/** Table top is 0.75 m tall and 3.2 world units: 1 m ≈ 4.27 units. */
export const WORLD_SCALE = 3.2 / 0.75;

function prepare(object, { shadows = true } = {}) {
  object.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = shadows;
      o.receiveShadow = true;
      if (o.material?.map) o.material.map.anisotropy = 4;
    }
  });
  return object;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export function Prop({ name, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, shadows = true, ...rest }) {
  const { nodes } = useGLTF(MODEL_URLS.props);
  const object = useMemo(() => {
    const source = nodes[name];
    if (!source) return null;
    return prepare(source.clone(true), { shadows });
  }, [nodes, name, shadows]);
  if (!object) return null;
  return (
    <group position={position} rotation={rotation} scale={scale * WORLD_SCALE} {...rest}>
      <primitive object={object} position={[0, 0, 0]} />
    </group>
  );
}

/** The pack's galleon, normalised to `length` world units along its keel. */
export function Galleon({ length = 12, ...rest }) {
  const { scene } = useGLTF(MODEL_URLS.ship);
  const object = useMemo(() => {
    const o = prepare(scene.clone(true));
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    const s = length / Math.max(size.x, size.z);
    o.scale.multiplyScalar(s);
    const b2 = new THREE.Box3().setFromObject(o);
    const c = b2.getCenter(new THREE.Vector3());
    o.position.set(-c.x, -b2.min.y, -c.z);
    // keel along x like the procedural ship it replaces
    const wrap = new THREE.Group();
    wrap.add(o);
    if (size.z > size.x) wrap.rotation.y = Math.PI / 2;
    return wrap;
  }, [scene, length]);
  return (
    <group {...rest}>
      <primitive object={object} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Seated sailors
// ---------------------------------------------------------------------------

const CHAIN = [
  // [bone, child that defines its direction]
  ['Spine_01', 'Spine_02'],
  ['Spine_02', 'Spine_03'],
  ['Spine_03', 'Neck'],
  ['Neck', 'Head'],
  ['UpperLeg_L', 'LowerLeg_L'],
  ['LowerLeg_L', 'Ankle_L'],
  ['Ankle_L', 'Ball_L'],
  ['UpperLeg_R', 'LowerLeg_R'],
  ['LowerLeg_R', 'Ankle_R'],
  ['Ankle_R', 'Ball_R'],
  ['Shoulder_L', 'Elbow_L'],
  ['Elbow_L', 'Hand_L'],
  ['Shoulder_R', 'Elbow_R'],
  ['Elbow_R', 'Hand_R'],
];

const v = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

/**
 * Target directions in the sailor's frame (+x = the sailor's left, +y up,
 * +z toward the table). `L`/`R` arm entries are mirrored on x.
 */
const POSES = {
  idle: {
    spine: v(0, 1, 0.16), neck: v(0, 1, 0.22),
    upperLeg: v(0.08, -0.05, 1), lowerLeg: v(0, -1, 0.08), foot: v(0, -0.25, 1),
    upperArm: v(0.32, -0.62, 0.72), foreArm: v(-0.22, 0.02, 1),
  },
  thinking: {
    spine: v(0, 1, 0.3), neck: v(0, 1, 0.25),
    upperLeg: v(0.08, -0.05, 1), lowerLeg: v(0, -1, 0.08), foot: v(0, -0.25, 1),
    upperArm: v(0.32, -0.62, 0.72), foreArm: v(-0.22, 0.02, 1),
    rUpperArm: v(-0.2, -0.45, 0.87), rForeArm: v(0.25, 0.92, -0.1),
  },
  cheer: {
    spine: v(0, 1, -0.08), neck: v(0, 1, -0.15),
    upperLeg: v(0.08, -0.05, 1), lowerLeg: v(0, -1, 0.08), foot: v(0, -0.25, 1),
    upperArm: v(0.45, 0.85, 0.15), foreArm: v(0.15, 1, 0.1),
  },
  sad: {
    spine: v(0, 1, 0.55), neck: v(0, 0.55, 0.85),
    upperLeg: v(0.08, -0.05, 1), lowerLeg: v(0, -1, 0.08), foot: v(0, -0.25, 1),
    upperArm: v(0.12, -0.95, 0.28), foreArm: v(-0.1, -0.35, 1),
  },
};

function targetFor(pose, bone) {
  const mirror = (d) => new THREE.Vector3(-d.x, d.y, d.z);
  switch (bone) {
    case 'Spine_01': case 'Spine_02': case 'Spine_03': return pose.spine;
    case 'Neck': return pose.neck;
    case 'UpperLeg_L': return pose.upperLeg;
    case 'UpperLeg_R': return mirror(pose.upperLeg);
    case 'LowerLeg_L': return pose.lowerLeg;
    case 'LowerLeg_R': return mirror(pose.lowerLeg);
    case 'Ankle_L': return pose.foot;
    case 'Ankle_R': return mirror(pose.foot);
    case 'Shoulder_L': return pose.upperArm;
    case 'Elbow_L': return pose.foreArm;
    case 'Shoulder_R': return pose.rUpperArm ?? mirror(pose.upperArm);
    case 'Elbow_R': return pose.rForeArm ?? mirror(pose.foreArm);
    default: return null;
  }
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const qDelta = new THREE.Quaternion();
const qWorld = new THREE.Quaternion();
const qParent = new THREE.Quaternion();
const qFrame = new THREE.Quaternion();

/** Rotate `bone` so (child - bone) points along `dirWorld`. */
function aim(bone, child, dirWorld) {
  bone.getWorldPosition(tmpA);
  child.getWorldPosition(tmpB);
  tmpB.sub(tmpA).normalize();
  qDelta.setFromUnitVectors(tmpB, dirWorld);
  bone.getWorldQuaternion(qWorld);
  bone.parent.getWorldQuaternion(qParent);
  bone.quaternion.copy(qParent.invert().multiply(qDelta.multiply(qWorld)));
  bone.updateMatrixWorld(true);
}

export function useCharacterModels() {
  return useGLTF(MODEL_URLS.characters);
}

/**
 * Seated Synty character. Same contract as the procedural <Sailor>:
 * faces +z, origin at table-top height over the middle of the seat.
 */
export function SyntySailor({ character, mood = 'idle', lookX = 0, position = [0, 0, 0], scale = 1, seed = 0, showChair = true }) {
  const { scene } = useCharacterModels();
  const frame = useRef();

  // Clone and measure in bind pose (before any posing touches the bones).
  const { rig, placement } = useMemo(() => {
    const root = cloneSkinned(scene);
    let mesh = null;
    root.traverse((o) => {
      if (o.isSkinnedMesh) {
        if (o.name === character.model) mesh = o;
        else o.visible = false;
        o.frustumCulled = false;
        o.castShadow = true;
      }
    });
    const bones = {};
    root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    root.updateMatrixWorld(true);
    const wp = (n) => bones[n].getWorldPosition(new THREE.Vector3());
    const hips = wp('Hips');
    const head = wp('Head');
    const ankle = wp('Ankle_L');
    const ball = wp('Ball_L');
    const fwd = ball.clone().sub(ankle);
    const yaw = Math.atan2(fwd.x, fwd.z);
    const footY = Math.min(ankle.y, wp('Ankle_R').y);
    const height = (head.y - footY) * 1.18 || 1.8; // head bone sits ~85% up the body
    const s = (1.82 / height) * WORLD_SCALE; // every character ~1.82 m tall
    const headRest = bones.Head.quaternion.clone();
    return { rig: { root, mesh, bones, headRest }, placement: { s, yaw, hipsY: hips.y - footY + 0.08 * (height / 1.82) } };
  }, [scene, character.model]);

  const dirs = useRef(new Map());
  const phase = useMemo(() => seed * 1.37, [seed]);
  const SEAT_Y = -3.2 + 0.47 * WORLD_SCALE; // chair seat height in world units

  useLayoutEffect(() => {
    dirs.current.clear();
  }, [rig]);

  useFrame(({ clock }, dt) => {
    const f = frame.current;
    if (!f || !rig.bones.Hips) return;
    const t = clock.elapsedTime + phase;
    const pose = POSES[mood] ?? POSES.idle;
    const k = dirs.current.size ? 1 - Math.exp(-dt * 7) : 1;
    f.updateMatrixWorld(true);
    f.getWorldQuaternion(qFrame);

    for (const [boneName, childName] of CHAIN) {
      const bone = rig.bones[boneName];
      const child = rig.bones[childName];
      const target = targetFor(pose, boneName);
      if (!bone || !child || !target) continue;
      const local = target.clone();
      // life: breathing, a little sway, waving arms when cheering
      if (boneName.startsWith('Spine')) local.z += Math.sin(t * 1.6) * 0.02;
      if (mood === 'cheer' && boneName.startsWith('Elbow')) local.x += Math.sin(t * 9 + (boneName.endsWith('L') ? 0 : 1.5)) * 0.35;
      if (mood === 'thinking' && boneName === 'Elbow_R') local.z += Math.sin(t * 5) * 0.08;
      local.normalize();
      const cur = dirs.current.get(boneName) ?? local.clone();
      cur.lerp(local, k).normalize();
      dirs.current.set(boneName, cur);
      aim(bone, child, cur.clone().applyQuaternion(qFrame));
    }

    // head yaw toward the action, nods while thinking
    const head = rig.bones.Head;
    if (head) {
      head.quaternion.copy(rig.headRest); // reset, so the yaw below never accumulates
      const yaw = mood === 'idle' ? THREE.MathUtils.clamp(lookX, -0.6, 0.6) + Math.sin(t * 0.45) * 0.18 : 0;
      head.rotateOnWorldAxis(tmpA.set(0, 1, 0).applyQuaternion(qFrame), yaw);
    }
    f.position.y = mood === 'cheer' ? Math.abs(Math.sin(t * 9)) * 0.12 : 0;
  });

  return (
    <group position={position} scale={scale}>
      {showChair && <Prop name="SM_Prop_Stool_01" position={[0, -3.2, -0.25]} scale={1.05} />}
      <group ref={frame}>
        {/* bind-pose model: turn toes to +z, scale to ~1.82 m, drop hips onto the seat */}
        <group rotation-y={-placement.yaw} scale={placement.s} position-y={SEAT_Y - placement.hipsY * placement.s + 0.1}>
          <primitive object={rig.root} />
        </group>
      </group>
    </group>
  );
}

export function preloadSynty() {
  useGLTF.preload(MODEL_URLS.characters);
  useGLTF.preload(MODEL_URLS.props);
  useGLTF.preload(MODEL_URLS.ship);
}

/** Renders `fallback` instead of crashing the scene if a model file is missing. */
export class ModelBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('[models] falling back to procedural look:', error);
  }

  render() {
    return this.state.failed ? this.props.fallback ?? null : this.props.children;
  }
}

/** Synty character with the procedural sailor as loading / missing-file stand-in. */
export function CrewMember({ fallback, ...props }) {
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <SyntySailor {...props} />
      </Suspense>
    </ModelBoundary>
  );
}
