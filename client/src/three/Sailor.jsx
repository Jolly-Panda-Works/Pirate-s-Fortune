/**
 * A seated, low-poly sailor built procedurally from a roster entry
 * (shared/roster.js). Faces +z (toward the table), origin at table-top
 * height in the middle of the seat. Animated with simple joint rotations:
 *   mood 'idle' | 'thinking' (their turn) | 'cheer' (secured cargo) | 'sad' (shipwreck)
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const matCache = new Map();
function mat(color, extra = {}) {
  const key = `${color}|${JSON.stringify(extra)}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...extra }));
  }
  return matCache.get(key);
}

const BLACK = '#111111';
const GOLD = '#d4a63a';
const BONE = '#ece4cf';

function Hat({ type, color, trim }) {
  switch (type) {
    case 'tricorn':
      return (
        <group position-y={0.62}>
          <mesh material={mat(color)} scale={[1.25, 0.18, 1.25]} rotation-y={Math.PI / 6} castShadow>
            <cylinderGeometry args={[1, 1, 1, 3]} />
          </mesh>
          <mesh material={mat(trim, { metalness: 0.5 })} scale={[1.27, 0.06, 1.27]} position-y={0.08} rotation-y={Math.PI / 6}>
            <cylinderGeometry args={[1, 1, 1, 3]} />
          </mesh>
          <mesh material={mat(color)} position-y={0.3} castShadow>
            <cylinderGeometry args={[0.52, 0.66, 0.5, 8]} />
          </mesh>
        </group>
      );
    case 'bicorne':
      return (
        <group position-y={0.6}>
          <mesh material={mat(color)} rotation-z={Math.PI / 2} scale={[1, 1, 0.35]} position-y={0.15} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 2.0, 10, 1, false, 0, Math.PI]} />
          </mesh>
          <mesh material={mat(trim, { metalness: 0.6 })} position={[0, 0.35, 0.2]}>
            <sphereGeometry args={[0.12, 8, 6]} />
          </mesh>
        </group>
      );
    case 'bandana':
      return (
        <group position-y={0.18}>
          <mesh material={mat(color)} scale={[1.04, 0.92, 1.04]} castShadow>
            <sphereGeometry args={[0.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh material={mat(color)} position={[0.55, -0.05, -0.55]} rotation-z={0.5}>
            <coneGeometry args={[0.2, 0.6, 4]} />
          </mesh>
          <mesh material={mat(trim)} position-y={0.02} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.8, 0.05, 4, 16]} />
          </mesh>
        </group>
      );
    case 'beanie':
      return (
        <group position-y={0.22}>
          <mesh material={mat(color)} scale={[1.02, 1.05, 1.02]} castShadow>
            <sphereGeometry args={[0.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh material={mat(trim)} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.8, 0.13, 6, 16]} />
          </mesh>
        </group>
      );
    case 'feather':
      return (
        <group position-y={0.55}>
          <mesh material={mat(color)} scale={[1, 0.1, 1]} castShadow>
            <cylinderGeometry args={[1.25, 1.25, 1, 12]} />
          </mesh>
          <mesh material={mat(color)} position-y={0.3}>
            <cylinderGeometry args={[0.55, 0.65, 0.55, 10]} />
          </mesh>
          <mesh material={mat(trim)} position={[0.45, 0.65, -0.2]} rotation={[-0.4, 0, -0.6]} scale={[0.35, 1, 0.12]}>
            <coneGeometry args={[0.5, 1.6, 6]} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

function Beard({ type, color }) {
  switch (type) {
    case 'full':
      return (
        <mesh material={mat(color)} position={[0, -0.42, 0.42]} scale={[1, 1, 0.75]} castShadow>
          <dodecahedronGeometry args={[0.55, 0]} />
        </mesh>
      );
    case 'long':
      return (
        <mesh material={mat(color)} position={[0, -0.75, 0.45]} rotation-x={Math.PI} castShadow>
          <coneGeometry args={[0.5, 1.2, 6]} />
        </mesh>
      );
    case 'goatee':
      return (
        <mesh material={mat(color)} position={[0, -0.62, 0.55]} rotation-x={Math.PI}>
          <coneGeometry args={[0.18, 0.4, 5]} />
        </mesh>
      );
    case 'stubble':
      return (
        <mesh material={mat(color, { transparent: true, opacity: 0.45 })} position={[0, -0.28, 0.12]} scale={[0.98, 0.7, 0.98]}>
          <sphereGeometry args={[0.76, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        </mesh>
      );
    default:
      return null;
  }
}

function Head({ c }) {
  const skin = c.skeleton ? BONE : c.skin;
  const patch = c.extras?.includes('eyepatch');
  return (
    <group>
      <mesh material={mat(skin)} castShadow>
        <icosahedronGeometry args={[0.78, 1]} />
      </mesh>
      {/* ears */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={mat(skin)} position={[s * 0.76, 0, 0]} scale={[0.4, 0.7, 0.5]}>
          <sphereGeometry args={[0.22, 6, 5]} />
        </mesh>
      ))}
      {/* eyes */}
      {c.skeleton ? (
        [-1, 1].map((s) => (
          <mesh key={s} material={mat(BLACK)} position={[s * 0.28, 0.12, 0.62]} scale={[1, 1.2, 0.5]}>
            <sphereGeometry args={[0.18, 8, 6]} />
          </mesh>
        ))
      ) : (
        [-1, 1].map((s) => (
          <group key={s} position={[s * 0.27, 0.12, 0.7]}>
            <mesh material={mat('#ffffff')} scale={[1, 1, 0.5]}>
              <sphereGeometry args={[0.12, 8, 6]} />
            </mesh>
            <mesh material={mat(BLACK)} position-z={0.05}>
              <sphereGeometry args={[0.065, 6, 5]} />
            </mesh>
          </group>
        ))
      )}
      {patch && (
        <group>
          <mesh material={mat(BLACK)} position={[0.27, 0.12, 0.74]} scale={[1, 1, 0.35]}>
            <sphereGeometry args={[0.17, 8, 6]} />
          </mesh>
          <mesh material={mat(BLACK)} rotation={[0.2, 0, -0.25]}>
            <torusGeometry args={[0.79, 0.025, 4, 24]} />
          </mesh>
        </group>
      )}
      {/* nose / mouth */}
      {c.skeleton ? (
        <>
          <mesh material={mat(BLACK)} position={[0, -0.12, 0.72]} rotation-x={Math.PI}>
            <coneGeometry args={[0.08, 0.16, 3]} />
          </mesh>
          <mesh material={mat('#f8f4e6')} position={[0, -0.42, 0.62]}>
            <boxGeometry args={[0.5, 0.12, 0.1]} />
          </mesh>
        </>
      ) : (
        <>
          <mesh material={mat(skin)} position={[0, -0.08, 0.78]} rotation-x={Math.PI / 2}>
            <coneGeometry args={[0.12, 0.3, 5]} />
          </mesh>
          <mesh material={mat('#6b2f2f')} position={[0, -0.36, 0.7]} scale={[1, 0.35, 0.4]}>
            <sphereGeometry args={[0.16, 8, 5]} />
          </mesh>
        </>
      )}
      {/* hair */}
      {c.hair && c.hat !== 'beanie' && c.hat !== 'bandana' && (
        <mesh material={mat(c.hair)} position-y={0.08} scale={[1.04, 1, 1.04]}>
          <sphereGeometry args={[0.78, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
        </mesh>
      )}
      {c.longHair && (
        <mesh material={mat(c.hair)} position={[0, -0.45, -0.38]} scale={[1.6, 1.4, 0.5]}>
          <boxGeometry args={[0.8, 1, 0.8]} />
        </mesh>
      )}
      <Beard type={c.beard} color={c.hair ?? '#6b4a2b'} />
      <Hat type={c.hat} color={c.hatColor} trim={c.trim} />
      {c.extras?.includes('earring') && (
        <mesh material={mat(GOLD, { metalness: 0.9, roughness: 0.25 })} position={[-0.8, -0.22, 0.05]} rotation-y={Math.PI / 2}>
          <torusGeometry args={[0.09, 0.025, 6, 12]} />
        </mesh>
      )}
      {c.extras?.includes('pipe') && (
        <group position={[0.22, -0.38, 0.75]}>
          <mesh material={mat('#5b3a1e')} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.035, 0.035, 0.5, 5]} />
          </mesh>
          <mesh material={mat('#5b3a1e')} position={[0, 0.08, 0.25]}>
            <cylinderGeometry args={[0.08, 0.06, 0.18, 6]} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function Parrot() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 1.7) * 0.5;
  });
  return (
    <group ref={ref} position={[-1.05, 1.45, 0]}>
      <mesh material={mat('#e74c3c')} scale={[0.8, 1.1, 0.8]} castShadow>
        <sphereGeometry args={[0.28, 8, 6]} />
      </mesh>
      <mesh material={mat('#e74c3c')} position-y={0.38}>
        <sphereGeometry args={[0.2, 8, 6]} />
      </mesh>
      <mesh material={mat('#f1c40f')} position={[0, 0.36, 0.2]} rotation-x={Math.PI / 2}>
        <coneGeometry args={[0.07, 0.18, 4]} />
      </mesh>
      <mesh material={mat('#2e86c1')} position={[0, -0.32, -0.15]} rotation-x={-0.5}>
        <coneGeometry args={[0.12, 0.5, 4]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={mat('#27ae60')} position={[s * 0.2, 0, -0.02]} scale={[0.3, 1, 0.6]}>
          <sphereGeometry args={[0.25, 6, 5]} />
        </mesh>
      ))}
    </group>
  );
}

/** One arm: shoulder joint → upper arm → elbow joint → forearm → hand. */
function Arm({ side, refs, c }) {
  const sleeve = c.coat ?? c.shirt;
  const skin = c.skeleton ? BONE : c.skin;
  const hook = side > 0 && c.extras?.includes('hook');
  const r = c.big ? 0.32 : 0.26;
  return (
    <group ref={refs.shoulder} position={[side * (c.big ? 1.18 : 1.02), 1.0, 0]}>
      <mesh material={mat(sleeve)} position-y={-0.6} castShadow>
        <capsuleGeometry args={[r, 0.8, 3, 7]} />
      </mesh>
      <group ref={refs.elbow} position-y={-1.2}>
        <mesh material={mat(c.shirt)} position-y={-0.5} castShadow>
          <capsuleGeometry args={[r * 0.88, 0.7, 3, 7]} />
        </mesh>
        {hook ? (
          <mesh material={mat('#9aa5b1', { metalness: 0.9, roughness: 0.3 })} position-y={-1.12} rotation-y={Math.PI / 2}>
            <torusGeometry args={[0.16, 0.04, 6, 12, Math.PI * 1.4]} />
          </mesh>
        ) : (
          <mesh material={mat(skin)} position-y={-1.05} castShadow>
            <icosahedronGeometry args={[r * 1.05, 0]} />
          </mesh>
        )}
      </group>
    </group>
  );
}

const POSES = {
  idle: { ls: [-0.55, 0, 0.18], le: -1.0, rs: [-0.55, 0, -0.18], re: -1.0, lean: 0.12, head: 0 },
  thinking: { ls: [-0.55, 0, 0.18], le: -1.0, rs: [-1.25, 0, -0.35], re: -2.35, lean: 0.22, head: -0.15 },
  cheer: { ls: [-2.9, 0, 0.45], le: -0.25, rs: [-2.9, 0, -0.45], re: -0.25, lean: -0.15, head: 0.25 },
  sad: { ls: [-0.25, 0, 0.1], le: -1.35, rs: [-0.25, 0, -0.1], re: -1.35, lean: 0.45, head: 0.55 },
};

export default function Sailor({ character: c, mood = 'idle', lookX = 0, position = [0, 0, 0], scale = 1, seed = 0, showChair = true }) {
  const root = useRef();
  const torso = useRef();
  const head = useRef();
  const left = { shoulder: useRef(), elbow: useRef() };
  const right = { shoulder: useRef(), elbow: useRef() };
  const phase = useMemo(() => seed * 1.7 + Math.random() * 3, [seed]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + phase;
    const p = POSES[mood] ?? POSES.idle;
    const k = 1 - Math.exp(-dt * 8);
    const bounce = mood === 'cheer' ? Math.abs(Math.sin(t * 9)) * 0.18 : 0;
    if (root.current) root.current.position.y = position[1] + bounce;
    if (torso.current) {
      torso.current.rotation.x = THREE.MathUtils.lerp(torso.current.rotation.x, p.lean + Math.sin(t * 1.3) * 0.02, k);
      torso.current.scale.y = 1 + Math.sin(t * 2.1) * 0.012;
    }
    if (head.current) {
      const look = mood === 'idle' ? THREE.MathUtils.clamp(lookX, -0.6, 0.6) + Math.sin(t * 0.5) * 0.15 : 0;
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, look, k * 0.5);
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, p.head + (mood === 'thinking' ? Math.sin(t * 3) * 0.05 : 0), k);
    }
    const wave = mood === 'cheer' ? Math.sin(t * 9) * 0.3 : 0;
    const tap = mood === 'thinking' ? Math.sin(t * 6) * 0.06 : 0;
    for (const [arm, s, e, sign] of [[left, p.ls, p.le, 1], [right, p.rs, p.re, -1]]) {
      if (!arm.shoulder.current) continue;
      arm.shoulder.current.rotation.x = THREE.MathUtils.lerp(arm.shoulder.current.rotation.x, s[0] + wave * sign, k);
      arm.shoulder.current.rotation.z = THREE.MathUtils.lerp(arm.shoulder.current.rotation.z, s[2], k);
      arm.elbow.current.rotation.x = THREE.MathUtils.lerp(arm.elbow.current.rotation.x, e + (sign < 0 ? tap : 0), k);
    }
  });

  const w = c.big ? 1.15 : 0.95;
  return (
    <group ref={root} position={position} scale={scale}>
      {showChair && (
        <group position={[0, -1.6, -0.4]}>
          <mesh material={mat('#5a3418')} castShadow receiveShadow>
            <boxGeometry args={[2.2, 0.2, 1.6]} />
          </mesh>
          <mesh material={mat('#4a2a12')} position={[0, 1.4, -0.75]} castShadow>
            <boxGeometry args={[2.2, 2.6, 0.18]} />
          </mesh>
          {[[-0.95, -0.65], [0.95, -0.65], [-0.95, 0.65], [0.95, 0.65]].map(([x, z]) => (
            <mesh key={`${x}${z}`} material={mat('#4a2a12')} position={[x, -0.85, z]}>
              <boxGeometry args={[0.16, 1.6, 0.16]} />
            </mesh>
          ))}
        </group>
      )}
      {/* legs (mostly hidden under the table) */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={mat(c.pants)} position={[s * 0.45, -1.35, 0.5]} rotation-x={Math.PI / 2}>
            <capsuleGeometry args={[0.3, 0.8, 3, 6]} />
          </mesh>
          <mesh material={mat(c.pants)} position={[s * 0.45, -2.2, 1.0]}>
            <capsuleGeometry args={[0.27, 1.0, 3, 6]} />
          </mesh>
          <mesh material={mat('#2b1d12')} position={[s * 0.45, -3.0, 1.2]} scale={[1, 0.6, 1.6]}>
            <boxGeometry args={[0.45, 0.4, 0.5]} />
          </mesh>
        </group>
      ))}
      <group ref={torso} position-y={-1.2}>
        <group position-y={1.2}>
          {/* body */}
          <mesh material={mat(c.coat ?? c.shirt)} position-y={0} scale={[1, 1, 0.62]} castShadow>
            <cylinderGeometry args={[w, w * 0.85, 2.3, 7]} />
          </mesh>
          {c.coat && (
            <mesh material={mat(c.shirt)} position={[0, 0.15, w * 0.5]} scale={[0.75, 1, 0.3]}>
              <cylinderGeometry args={[0.55, 0.45, 2.0, 5]} />
            </mesh>
          )}
          {c.stripes && [-0.6, -0.1, 0.4].map((y) => (
            <mesh key={y} material={mat(c.stripes)} position-y={y} scale={[1, 1, 0.62]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[w * 0.95, 0.07, 4, 14]} />
            </mesh>
          ))}
          {/* belt */}
          <mesh material={mat('#2b1d12')} position-y={-0.85} scale={[1, 1, 0.62]}>
            <cylinderGeometry args={[w * 0.9, w * 0.88, 0.28, 7]} />
          </mesh>
          <mesh material={mat(GOLD, { metalness: 0.8, roughness: 0.3 })} position={[0, -0.85, w * 0.56]}>
            <boxGeometry args={[0.36, 0.26, 0.08]} />
          </mesh>
          {c.coat && (
            <mesh material={mat(c.trim, { metalness: 0.4 })} position={[0, 1.08, 0]} scale={[1, 1, 0.66]}>
              <cylinderGeometry args={[w * 1.02, w * 1.02, 0.14, 7]} />
            </mesh>
          )}
          {/* neck + head */}
          <mesh material={mat(c.skeleton ? BONE : c.skin)} position-y={1.3}>
            <cylinderGeometry args={[0.28, 0.32, 0.4, 6]} />
          </mesh>
          <group ref={head} position-y={2.05}>
            <Head c={c} />
          </group>
          <Arm side={-1} refs={left} c={c} />
          <Arm side={1} refs={right} c={c} />
          {c.extras?.includes('parrot') && <Parrot />}
        </group>
      </group>
      {c.extras?.includes('spyglass') && (
        <mesh material={mat('#b8860b', { metalness: 0.85, roughness: 0.3 })} position={[1.6, 0.1, 1.5]} rotation={[Math.PI / 2, 0, 0.6]} castShadow>
          <cylinderGeometry args={[0.09, 0.13, 1.1, 8]} />
        </mesh>
      )}
    </group>
  );
}
