import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useCursor } from '@react-three/drei';
import * as THREE from 'three';

import { getBackTexture, getFaceTexture } from './cardTextures.js';
import { CARD_D, CARD_T, CARD_W } from './layout.js';
import { defOf, TYPE_STYLE } from '../data.js';
import { cardTypeName, formatNumber } from '../i18n.js';

const sideMaterial = new THREE.MeshStandardMaterial({ color: '#d9c089', roughness: 0.8 });
const geometry = new THREE.BoxGeometry(CARD_W, CARD_T, CARD_D);

const tmp = new THREE.Vector3();

/**
 * One physical card. Animates (damped) toward its layout target; a card
 * that changes zone arcs up over the table and flips if needed.
 */
export default function Card3D({ card, target, spawn, locale, selectable, onSelect, highlight }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && selectable);
  const def = defOf(card);

  const materials = useMemo(() => {
    // matte paper: no glare from the lanterns and spot light
    const front = new THREE.MeshStandardMaterial({ map: getFaceTexture(card.defId, locale), roughness: 0.92, metalness: 0, envMapIntensity: 0.35 });
    const back = new THREE.MeshStandardMaterial({ map: getBackTexture(), roughness: 0.85, metalness: 0, envMapIntensity: 0.35 });
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z
    return [sideMaterial, sideMaterial, front, back, sideMaterial, sideMaterial];
  }, [card.defId, locale]);

  const state = useRef(null);
  if (!state.current) {
    const from = spawn ?? target;
    state.current = {
      pos: new THREE.Vector3(...from.pos),
      rotY: from.rotY,
      flip: from.faceUp ? 0 : Math.PI,
      scale: from.scale,
      lastTarget: new THREE.Vector3(...from.pos),
      travel: 0,
    };
  }

  useFrame((_, dt) => {
    const s = state.current;
    const mesh = ref.current;
    if (!mesh) return;
    const d = Math.min(dt, 0.05);
    tmp.set(...target.pos);
    if (!tmp.equals(s.lastTarget)) {
      s.travel = s.pos.distanceTo(tmp);
      s.lastTarget.copy(tmp);
    }
    const lambda = 7;
    s.pos.x = THREE.MathUtils.damp(s.pos.x, tmp.x, lambda, d);
    s.pos.z = THREE.MathUtils.damp(s.pos.z, tmp.z, lambda, d);
    s.pos.y = THREE.MathUtils.damp(s.pos.y, tmp.y, lambda, d);
    const remaining = Math.hypot(s.pos.x - tmp.x, s.pos.z - tmp.z);
    const progress = s.travel > 0.01 ? 1 - Math.min(remaining / s.travel, 1) : 1;
    const lift = s.travel > 0.3 ? Math.sin(progress * Math.PI) * Math.min(s.travel * 0.35, 1.4) : 0;

    s.rotY = THREE.MathUtils.damp(s.rotY, target.rotY, 6, d);
    s.flip = THREE.MathUtils.damp(s.flip, target.faceUp ? 0 : Math.PI, 6, d);
    s.scale = THREE.MathUtils.damp(s.scale, target.scale * (hovered && selectable ? 1.12 : 1), 8, d);

    const hover = (hovered || highlight) ? 0.08 + (highlight ? Math.sin(performance.now() / 180) * 0.03 : 0) : 0;
    mesh.position.set(s.pos.x, s.pos.y + lift + hover, s.pos.z);
    mesh.rotation.set(0, s.rotY, s.flip);
    mesh.scale.setScalar(s.scale);
  });

  const style = TYPE_STYLE[def?.type];

  return (
    <group>
      <mesh
        ref={ref}
        geometry={geometry}
        material={materials}
        castShadow
        receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          if (!selectable) return;
          e.stopPropagation();
          onSelect?.();
        }}
      >
        {highlight && (
          <mesh position-y={-0.006} scale={[1.12, 1, 1.1]}>
            <boxGeometry args={[CARD_W, CARD_T * 0.5, CARD_D]} />
            <meshBasicMaterial color={style?.color ?? '#ffd36b'} toneMapped={false} transparent opacity={0.9} />
          </mesh>
        )}
        {hovered && def && (
          <Html position={[0, 0.25, -CARD_D / 2]} center distanceFactor={9} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className="card-tip" style={{ borderColor: style?.color }}>
              <span className="card-tip__icon">{style?.icon}</span>
              <strong>{cardTypeName(def.type, locale)}</strong>
              <span className="card-tip__value">{formatNumber(def.value, locale)}</span>
            </div>
          </Html>
        )}
      </mesh>
    </group>
  );
}
