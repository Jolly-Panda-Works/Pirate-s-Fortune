/**
 * Cinematic backdrop for splash / menus: a galleon at sea at sunset, a
 * floating treasure chest and a slowly orbiting camera.
 */

import { Suspense, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky, Environment, Lightformer, Float, Sparkles, Stars } from '@react-three/drei';

import Ocean from './Ocean.jsx';
import Ship from './Ship.jsx';
import { waveHeight } from './Ocean.jsx';
import { Galleon, ModelBoundary, Prop, SyntySailor, useModelsAvailable } from './Synty.jsx';
import { characterById } from '../../../shared/roster.js';
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

/** The Synty galleon riding the swell (procedural ship while it loads). */
/** The player's chosen sailor, standing on deck as the ship's captain. */
function Captain() {
  const characterId = useStore(appStore, (s) => s.profile.character);
  const [waving, setWaving] = useState(false);
  useEffect(() => {
    let timer;
    const loop = (w) => {
      setWaving(w);
      timer = setTimeout(() => loop(!w), w ? 2400 : 5000 + Math.random() * 3000);
    };
    timer = setTimeout(() => loop(true), 2000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <SyntySailor
      character={characterById(characterId)}
      standing
      mood={waving ? 'standWave' : 'stand'}
      scale={0.24}
      showChair={false}
    />
  );
}

function SeaGalleon({ position, rotation = 0, length, captain = false }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    // waveHeight() is the sea surface in world space; the Synty hull's deep
    // keel and rudder sit well below the 40% waterline Galleon assumes, so
    // ride ~1.5 units higher for the hull to read as afloat.
    ref.current.position.y = waveHeight(position[0], position[2], t) + 1.5;
    ref.current.rotation.z = Math.sin(t * 0.7) * 0.035;
    ref.current.rotation.x = Math.sin(t * 0.55 + 1) * 0.025;
  });
  const available = useModelsAvailable();
  const fallback = <Ship position={position} rotation={rotation} scale={length / 10} />;
  if (!available) return fallback;
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <group ref={ref} position={position} rotation-y={rotation}>
          <Galleon length={length}>{captain ? <Captain /> : null}</Galleon>
        </group>
      </Suspense>
    </ModelBoundary>
  );
}

function SyntyChest() {
  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={1.2}>
      <group position={[8, 1.1, 6]} rotation-y={-0.8}>
        <Prop name="SM_Prop_Chest_Treasure_01" scale={0.75} />
        <pointLight position={[0, 2, 0]} color="#ffbf47" intensity={10} distance={8} />
        <Sparkles count={50} scale={[3, 3, 3]} position={[0, 2, 0]} size={4} speed={0.6} color="#ffe38a" />
      </group>
    </Float>
  );
}

function MenuChest() {
  const available = useModelsAvailable();
  if (!available) return <TreasureChest />;
  return (
    <ModelBoundary fallback={<TreasureChest />}>
      <Suspense fallback={<TreasureChest />}>
        <SyntyChest />
      </Suspense>
    </ModelBoundary>
  );
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
        <SeaGalleon position={[0, -1.2, -3]} rotation={0.3} length={10.5} captain />
        <SeaGalleon position={[-46, -1.2, -55]} rotation={2.2} length={10} />
        <MenuChest />
      </ParticleProvider>
      <OrbitCam variant={variant} />
      <Effects quality={quality} dof={{ target: [0, 3, 0], focalLength: 0.08, bokehScale: 2.5, height: 480 }} />
    </>
  );
}
