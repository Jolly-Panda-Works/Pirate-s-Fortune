/** Character + arena pickers (profile, solo setup, lobby). */

import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';

import Crew from './three/Crew.jsx';
import { CHARACTERS, ARENAS, characterById } from '../../shared/roster.js';
import { appStore, useStore } from './store.js';
import { uiTick } from './audio.js';

function Turntable({ children }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.45;
  });
  return <group ref={ref}>{children}</group>;
}

/** Live 3D preview of a sailor on a slowly turning stand. */
export function SailorPreview({ characterId, mood = 'idle', height = 300 }) {
  const quality = useStore(appStore, (s) => s.settings.quality);
  return (
    <div className="sailor-preview" style={{ height }}>
      <Canvas
        shadows={quality !== 'low'}
        dpr={[1, 1.5]}
        camera={{ position: [0, 2.4, 13.5], fov: 34 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.2, 0)}
      >
        <ambientLight intensity={0.9} color="#ffe2c0" />
        <directionalLight position={[3, 6, 8]} intensity={3} castShadow />
        <pointLight position={[-4, 3, -3]} intensity={30} color="#5fa8ff" />
        <Suspense fallback={null}>
          <Turntable>
            <Crew character={characterById(characterId)} mood={mood} position={[0, 0, 0]} />
          </Turntable>
        </Suspense>
        <ContactShadows position={[0, -3.2, 0]} opacity={0.5} scale={8} blur={2.5} far={4} />
      </Canvas>
    </div>
  );
}

export function CharacterGrid({ value, onChange, locale }) {
  return (
    <div className="character-grid">
      {CHARACTERS.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`character-card ${value === c.id ? 'is-active' : ''}`}
          style={{ '--seat': c.color }}
          onClick={() => { uiTick(); onChange(c.id); }}
        >
          <span className="character-card__icon">{c.icon}</span>
          <span className="character-card__name">{c.name[locale] ?? c.name.en}</span>
        </button>
      ))}
    </div>
  );
}

export function ArenaPicker({ value, onChange, locale, disabled }) {
  return (
    <div className="arena-picker">
      {ARENAS.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={disabled}
          className={`arena-card arena-card--${a.id} ${value === a.id ? 'is-active' : ''}`}
          onClick={() => { uiTick(); onChange(a.id); }}
        >
          <span className="arena-card__icon">{a.icon}</span>
          <span className="arena-card__name">{a.name[locale] ?? a.name.en}</span>
        </button>
      ))}
    </div>
  );
}
