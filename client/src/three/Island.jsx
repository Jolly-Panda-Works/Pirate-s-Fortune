/**
 * The treasure island the game table stands on: sand, palms, barrels,
 * torches (three.quarks fire) — all procedural.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { Float } from '@react-three/drei';
import { Torch } from './Particles.jsx';

function Palm({ position, lean = 0.2, height = 4.2, rot = 0 }) {
  const segments = 7;
  const trunk = useMemo(() => Array.from({ length: segments }, (_, i) => {
    const t = i / segments;
    return { y: t * height, x: Math.sin(t * 1.4) * lean * height * 0.5, s: 1 - t * 0.35 };
  }), [height, lean]);
  const top = trunk[trunk.length - 1];
  return (
    <group position={position} rotation-y={rot}>
      {trunk.map((seg, i) => (
        <mesh key={i} position={[seg.x, seg.y + height / segments / 2, 0]} castShadow>
          <cylinderGeometry args={[0.16 * seg.s, 0.2 * seg.s, height / segments + 0.02, 8]} />
          <meshStandardMaterial color={i % 2 ? '#7a5532' : '#6b4a2b'} roughness={1} />
        </mesh>
      ))}
      <group position={[top.x, height + 0.1, 0]}>
        {Array.from({ length: 7 }, (_, i) => (
          <group key={i} rotation-y={(i / 7) * Math.PI * 2}>
            <group rotation-x={1.75 + (i % 3) * 0.12}>
              <mesh position-y={1.2} scale={[1, 1, 0.25]} castShadow>
                <coneGeometry args={[0.38, 2.4, 6, 1]} />
                <meshStandardMaterial color={i % 2 ? '#2f7d32' : '#3c9a3f'} roughness={0.8} flatShading />
              </mesh>
            </group>
          </group>
        ))}
        {[0, 1, 2].map((i) => (
          <mesh key={`c${i}`} position={[Math.cos(i * 2.1) * 0.22, -0.2, Math.sin(i * 2.1) * 0.22]}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial color="#4b3218" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Barrel({ position, rot = 0 }) {
  return (
    <group position={position} rotation-y={rot}>
      <mesh castShadow position-y={0.45}>
        <cylinderGeometry args={[0.38, 0.38, 0.9, 16]} />
        <meshStandardMaterial color="#7b4a22" roughness={0.9} />
      </mesh>
      {[0.12, 0.78].map((y) => (
        <mesh key={y} position-y={y}>
          <torusGeometry args={[0.39, 0.03, 6, 20]} />
          <meshStandardMaterial color="#333" metalness={0.8} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function Chest({ position, rot = 0 }) {
  return (
    <group position={position} rotation-y={rot}>
      <mesh castShadow position-y={0.3}>
        <boxGeometry args={[1.0, 0.6, 0.65]} />
        <meshStandardMaterial color="#6d3b16" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.62, -0.1]} rotation-x={-0.6} castShadow>
        <boxGeometry args={[1.02, 0.08, 0.66]} />
        <meshStandardMaterial color="#5a2f10" />
      </mesh>
      <mesh position={[0, 0.62, 0.05]}>
        <sphereGeometry args={[0.38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ffc93c" emissive="#ff9d00" emissiveIntensity={1.4} metalness={0.9} roughness={0.25} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function Island({ torches = true }) {
  const sandGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(13, 18, 2.6, 48, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 1.2) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setY(i, y + Math.sin(x * 0.6) * Math.cos(z * 0.5) * 0.15 - (x * x + z * z) * 0.002);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <group>
      <mesh geometry={sandGeo} position-y={-2.35} receiveShadow>
        <meshStandardMaterial color="#e2c68f" roughness={1} />
      </mesh>
      {/* wet sand ring */}
      <mesh position-y={-2.6} receiveShadow>
        <cylinderGeometry args={[18.5, 20, 1.2, 48]} />
        <meshStandardMaterial color="#b89b63" roughness={1} />
      </mesh>
      <Palm position={[-9, -1.1, -6]} lean={0.35} rot={0.4} />
      <Palm position={[9.5, -1.1, -5]} lean={0.3} rot={2.6} height={5} />
      <Palm position={[-10.5, -1.1, 3]} lean={0.25} rot={-0.6} height={3.6} />
      <Palm position={[10, -1.1, 4.5]} lean={0.4} rot={3.4} height={4.4} />
      <Barrel position={[-6.8, -1.1, -2]} />
      <Barrel position={[-7.4, -1.1, -1.1]} rot={1} />
      <Barrel position={[7.2, -1.1, 1.2]} rot={0.5} />
      <Float speed={1.4} rotationIntensity={0.1} floatIntensity={0.2}>
        <Chest position={[6.6, -1.1, -3.4]} rot={-0.6} />
      </Float>
      {torches && (
        <>
          <Torch position={[-6, -1.1, 4.8]} />
          <Torch position={[6, -1.1, 4.8]} />
          <Torch position={[-5.6, -1.1, -5.2]} />
          <Torch position={[5.6, -1.1, -5.2]} />
        </>
      )}
    </group>
  );
}
