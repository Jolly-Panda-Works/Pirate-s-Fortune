/**
 * Cinematic backdrop for splash / menus: a galleon at sea at sunset, a
 * floating treasure chest and a slowly orbiting camera.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky, Environment, Lightformer, Float, Sparkles, Stars } from '@react-three/drei';

import Ocean from './Ocean.jsx';
import Ship from './Ship.jsx';
import Effects from './Effects.jsx';
import { ParticleProvider } from './Particles.jsx';
import { appStore, useStore } from '../store.js';

function OrbitCam({ variant }) {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * (variant === 'splash' ? 0.05 : 0.035);
    const r = variant === 'splash' ? 24 : 20;
    camera.position.set(Math.sin(t) * r, 5 + Math.sin(t * 2) * 0.8, Math.cos(t) * r);
    camera.lookAt(0, 2.5, 0);
  });
  return null;
}

function TreasureChest() {
  const lid = useRef();
  useFrame(({ clock }) => {
    if (lid.current) lid.current.rotation.x = -0.6 - Math.sin(clock.elapsedTime * 1.2) * 0.12;
  });
  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1.4}>
      <group position={[8, 1.4, 6]} rotation-y={-0.8} scale={1.4}>
        <mesh castShadow>
          <boxGeometry args={[1.4, 0.8, 0.9]} />
          <meshStandardMaterial color="#6d3b16" roughness={0.7} />
        </mesh>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <boxGeometry args={[0.1, 0.84, 0.94]} />
            <meshStandardMaterial color="#c99a3c" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        <group ref={lid} position={[0, 0.4, -0.45]}>
          <mesh position={[0, 0.05, 0.45]}>
            <boxGeometry args={[1.42, 0.12, 0.92]} />
            <meshStandardMaterial color="#5a2f10" />
          </mesh>
        </group>
        <mesh position={[0, 0.42, 0]}>
          <sphereGeometry args={[0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#ffd04a" emissive="#ffa000" emissiveIntensity={2.4} metalness={1} roughness={0.2} toneMapped={false} />
        </mesh>
        <pointLight position={[0, 1.2, 0]} color="#ffbf47" intensity={10} distance={8} />
        <Sparkles count={50} scale={[2.2, 2.5, 2.2]} position={[0, 1, 0]} size={4} speed={0.6} color="#ffe38a" />
      </group>
    </Float>
  );
}

export default function MenuScene({ variant = 'menu' }) {
  const quality = useStore(appStore, (s) => s.settings.quality);
  return (
    <>
      <color attach="background" args={['#f4a86f']} />
      <fog attach="fog" args={['#ee9f6c', 50, 220]} />
      <Sky distance={4500} sunPosition={[40, 6, -100]} turbidity={8} rayleigh={2.6} mieCoefficient={0.008} mieDirectionalG={0.88} />
      <Stars radius={180} depth={40} count={600} factor={4} fade speed={0.5} />
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={2.5} color="#ffcf9a" position={[10, 5, -15]} scale={[14, 5, 1]} />
        <Lightformer intensity={0.7} color="#87b8ff" position={[-12, 9, 10]} scale={[10, 10, 1]} />
      </Environment>
      <hemisphereLight args={['#ffd9b0', '#1d3550', 0.6]} />
      <directionalLight position={[20, 12, -30]} intensity={2.6} color="#ffcf9a" castShadow={quality !== 'low'} />
      <ParticleProvider>
        <Ocean sunDirection={[0.35, 0.08, -0.95]} />
        <Ship position={[0, -1.2, 0]} rotation={0.3} scale={1.15} />
        <Ship position={[-46, -1.2, -55]} rotation={2.2} scale={0.9} />
        <TreasureChest />
      </ParticleProvider>
      <OrbitCam variant={variant} />
      <Effects quality={quality} dof={{ target: [0, 3, 0], focalLength: 0.08, bokehScale: 2.5, height: 480 }} />
    </>
  );
}
