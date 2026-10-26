/** Character + arena pickers (profile, solo setup, lobby). */

import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';

import Crew from './three/Crew.jsx';
import { CHARACTERS, ARENAS, characterById } from '../../shared/roster.js';
import { appStore, useStore } from './store.js';
import { uiTick } from './audio.js';

/** Sits facing the camera; every few seconds gives a friendly wave. */
function usePortraitMood() {
  const [mood, setMood] = useState('portrait');
  useEffect(() => {
    let timer;
    const loop = (waving) => {
      setMood(waving ? 'wave' : 'portrait');
      timer = setTimeout(() => loop(!waving), waving ? 2600 : 4200 + Math.random() * 2500);
    };
    timer = setTimeout(() => loop(true), 1200);
    return () => clearTimeout(timer);
  }, []);
  return mood;
}

/** Live 3D preview of a sailor on a slowly turning stand. */
export function SailorPreview({ characterId, height = 300 }) {
  const quality = useStore(appStore, (s) => s.settings.quality);
  const mood = usePortraitMood();
  return (
    <div className="sailor-preview" style={{ height }}>
      <Canvas
        shadows={quality !== 'low'}
        dpr={[1, 1.5]}
        // framed on the face and shoulders, at the sailor's eye level
        camera={{ position: [0, 2.9, 8.8], fov: 30 }}
        onCreated={({ camera }) => camera.lookAt(0, 2.05, 0)}
      >
        <ambientLight intensity={0.9} color="#ffe2c0" />
        <directionalLight position={[2.5, 5, 8]} intensity={3} castShadow />
        <pointLight position={[-3, 3, 4]} intensity={18} color="#ffd2a1" />
        <pointLight position={[-4, 3, -3]} intensity={30} color="#5fa8ff" />
        <Suspense fallback={null}>
          <Crew character={characterById(characterId)} mood={mood} position={[0, 0, 0]} showChair={false} />
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
