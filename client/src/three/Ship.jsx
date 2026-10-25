/**
 * A stylized pirate galleon built from primitives (no model files, so
 * the game runs fully offline). Sails billow with a vertex wave.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { waveHeight } from './Ocean.jsx';

const WOOD = '#5a3418';
const WOOD_DARK = '#3a1f0c';
const TRIM = '#c99a3c';
const SAIL = '#efe3c4';

function useHullGeometry() {
  return useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-4.2, 1.6);
    s.lineTo(-3.8, 0.2);
    s.quadraticCurveTo(-3.0, -1.1, -0.8, -1.25);
    s.lineTo(2.6, -1.1);
    s.quadraticCurveTo(4.4, -0.6, 5.0, 1.2);
    s.lineTo(4.4, 1.25);
    s.lineTo(-4.2, 1.6);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 2.4, bevelEnabled: true, bevelSize: 0.35, bevelThickness: 0.5, bevelSegments: 4, curveSegments: 18 });
    geo.translate(0, 0, -1.2);
    geo.computeVertexNormals();
    return geo;
  }, []);
}

function Sail({ width, height, position, phase = 0 }) {
  const ref = useRef();
  const geo = useMemo(() => new THREE.PlaneGeometry(width, height, 12, 10), [width, height]);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo]);
  useFrame(({ clock }) => {
    const pos = geo.attributes.position;
    const t = clock.elapsedTime;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      const nx = x / (width / 2);
      const ny = (y + height / 2) / height;
      const belly = (1 - nx * nx) * Math.sin(ny * Math.PI) * 0.55;
      pos.setZ(i, belly + Math.sin(t * 2 + phase + ny * 3) * 0.04 * (1 - nx * nx));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });
  return (
    <mesh ref={ref} geometry={geo} position={position} rotation-y={Math.PI / 2} castShadow>
      <meshStandardMaterial color={SAIL} side={THREE.DoubleSide} roughness={0.9} />
    </mesh>
  );
}

function Flag({ position }) {
  const geo = useMemo(() => new THREE.PlaneGeometry(1.1, 0.7, 10, 4), []);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo]);
  useFrame(({ clock }) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3] + 0.55;
      pos.setZ(i, Math.sin(x * 4 - clock.elapsedTime * 6) * 0.12 * x);
    }
    pos.needsUpdate = true;
  });
  return (
    <mesh geometry={geo} position={position} rotation-y={Math.PI / 2}>
      <meshStandardMaterial color="#111" side={THREE.DoubleSide} emissive="#220000" />
    </mesh>
  );
}

function Mast({ x, height, sails }) {
  return (
    <group position={[x, 1.6, 0]}>
      <mesh position-y={height / 2} castShadow>
        <cylinderGeometry args={[0.09, 0.14, height, 10]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
      {sails.map((s, i) => (
        <group key={i}>
          <mesh position={[0, s.y + s.h / 2 + 0.05, 0]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.05, 0.05, s.w + 0.4, 6]} />
            <meshStandardMaterial color={WOOD_DARK} />
          </mesh>
          <Sail width={s.w} height={s.h} position={[0.12, s.y, 0]} phase={i + x} />
        </group>
      ))}
    </group>
  );
}

export default function Ship({ position = [0, 0, 0], rotation = 0, scale = 1, float = true }) {
  const group = useRef();
  const hull = useHullGeometry();

  useFrame(({ clock }) => {
    if (!group.current || !float) return;
    const t = clock.elapsedTime;
    const [x, , z] = position;
    group.current.position.y = position[1] + waveHeight(x, z, t) * 0.6 + 0.35;
    group.current.rotation.z = Math.sin(t * 0.7) * 0.04;
    group.current.rotation.x = Math.sin(t * 0.55 + 1) * 0.03;
  });

  const portholes = useMemo(() => Array.from({ length: 6 }, (_, i) => -2.6 + i * 1.05), []);

  return (
    <group ref={group} position={position} rotation-y={rotation} scale={scale}>
      <mesh geometry={hull} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD} roughness={0.8} />
      </mesh>
      {/* gold trim line */}
      <mesh position={[0.3, 0.9, 0]}>
        <boxGeometry args={[8.4, 0.08, 3.5]} />
        <meshStandardMaterial color={TRIM} metalness={0.6} roughness={0.35} />
      </mesh>
      {/* deck */}
      <mesh position={[0.3, 1.55, 0]} receiveShadow>
        <boxGeometry args={[8.2, 0.1, 2.9]} />
        <meshStandardMaterial color="#8a5a2b" roughness={0.9} />
      </mesh>
      {/* stern castle */}
      <mesh position={[-3.3, 2.2, 0]} castShadow>
        <boxGeometry args={[1.8, 1.2, 3.0]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      {/* lantern on stern */}
      <mesh position={[-4.3, 3.0, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color="#ffcf6b" emissive="#ffae3b" emissiveIntensity={4} toneMapped={false} />
      </mesh>
      {/* cannons */}
      {portholes.map((x) => (
        <group key={x}>
          {[1, -1].map((side) => (
            <mesh key={side} position={[x, 0.45, side * 1.62]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.1, 0.12, 0.5, 8]} />
              <meshStandardMaterial color="#1b1b1b" metalness={0.7} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
      {/* bowsprit */}
      <mesh position={[5.4, 1.9, 0]} rotation-z={-Math.PI / 2.6}>
        <cylinderGeometry args={[0.06, 0.1, 2.2, 8]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
      <Mast x={-1.7} height={6} sails={[{ y: 2.0, w: 2.6, h: 1.8 }, { y: 4.1, w: 2.0, h: 1.4 }]} />
      <Mast x={0.9} height={7.2} sails={[{ y: 2.1, w: 3.0, h: 2.1 }, { y: 4.6, w: 2.4, h: 1.6 }]} />
      <Mast x={3.2} height={5.2} sails={[{ y: 1.9, w: 2.2, h: 1.6 }]} />
      <Flag position={[0.9, 9.1, 0.55]} />
    </group>
  );
}
