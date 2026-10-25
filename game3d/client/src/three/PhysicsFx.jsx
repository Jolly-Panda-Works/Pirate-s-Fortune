/**
 * Rapier physics flourishes: gold coins rain onto a captain's cargo when
 * they return to ship; hull planks burst off the table on a shipwreck.
 * Purely cosmetic — the engine on the server decides everything.
 */

import { useEffect, useMemo, useState } from 'react';
import { RigidBody, CylinderCollider, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

import { fxBus } from '../net.js';
import { coinClink } from '../audio.js';
import { TABLE_R, TABLE_Y } from './layout.js';

const coinGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.025, 18);
const coinMat = new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.95, roughness: 0.25, emissive: '#7a4b00', emissiveIntensity: 0.4 });
const plankGeo = new THREE.BoxGeometry(0.7, 0.06, 0.16);
const plankMat = new THREE.MeshStandardMaterial({ color: '#6b3f1d', roughness: 0.9 });

let burstId = 0;

function Coin({ position, impulse, spin }) {
  return (
    <RigidBody
      colliders={false}
      position={position}
      rotation={[spin, spin * 2, 0]}
      linearVelocity={impulse}
      angularVelocity={[spin * 6, 0, spin * 4]}
      restitution={0.35}
      friction={0.7}
      onCollisionEnter={({ totalForceMagnitude }) => {
        if (Math.random() < 0.35) coinClink((totalForceMagnitude ?? 1) / 20);
      }}
    >
      <CylinderCollider args={[0.0125, 0.11]} />
      <mesh geometry={coinGeo} material={coinMat} castShadow />
    </RigidBody>
  );
}

function Plank({ position, impulse, spin }) {
  return (
    <RigidBody colliders="cuboid" position={position} linearVelocity={impulse} angularVelocity={[spin * 5, spin * 9, spin * 3]} restitution={0.2}>
      <mesh geometry={plankGeo} material={plankMat} castShadow />
    </RigidBody>
  );
}

export default function PhysicsFx({ anchorOf, expeditionCenter }) {
  const [bursts, setBursts] = useState([]);

  useEffect(() => fxBus.on((event) => {
    let burst = null;
    if (event.kind === 'return') {
      const [x, , z] = anchorOf(event.playerId);
      const count = Math.min(6 + event.count * 3, 26);
      burst = {
        id: ++burstId,
        type: 'coin',
        items: Array.from({ length: count }, () => ({
          position: [x + (Math.random() - 0.5) * 1.2, 2.2 + Math.random() * 1.5, z + (Math.random() - 0.5) * 0.6],
          impulse: [(Math.random() - 0.5) * 1.5, -1, (Math.random() - 0.5) * 1.5],
          spin: Math.random() - 0.5,
        })),
      };
    } else if (event.kind === 'shipwreck') {
      const [x, , z] = expeditionCenter;
      burst = {
        id: ++burstId,
        type: 'plank',
        items: Array.from({ length: 14 }, () => {
          const a = Math.random() * Math.PI * 2;
          const speed = 2.5 + Math.random() * 3;
          return {
            position: [x + Math.cos(a) * 0.4, 0.5, z + Math.sin(a) * 0.4],
            impulse: [Math.cos(a) * speed, 3 + Math.random() * 3, Math.sin(a) * speed],
            spin: Math.random() - 0.5,
          };
        }),
      };
    }
    if (!burst) return;
    setBursts((b) => [...b.slice(-3), burst]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== burst.id)), 4500);
  }), [anchorOf, expeditionCenter]);

  const floor = useMemo(() => (
    <RigidBody type="fixed" colliders={false}>
      <CylinderCollider args={[0.1, TABLE_R]} position={[0, TABLE_Y - 0.1, 0]} />
      <CuboidCollider args={[30, 0.2, 30]} position={[0, -1.3, 0]} />
    </RigidBody>
  ), []);

  return (
    <>
      {floor}
      {bursts.map((burst) => (
        <group key={burst.id}>
          {burst.items.map((item, i) => (burst.type === 'coin'
            ? <Coin key={i} {...item} />
            : <Plank key={i} {...item} />))}
        </group>
      ))}
    </>
  );
}
