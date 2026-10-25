/**
 * The in-game 3D world: a round treasure table on an island at sunset.
 * Everything here is a pure function of the replayed engine view; the
 * only thing it can send back is an ability-target click.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Environment, Lightformer, OrbitControls, CameraShake, ContactShadows, Html, Sparkles } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';

import Ocean from './Ocean.jsx';
import Island from './Island.jsx';
import Ship from './Ship.jsx';
import Card3D from './Card3D.jsx';
import PhysicsFx from './PhysicsFx.jsx';
import Effects from './Effects.jsx';
import { ParticleProvider, useParticles } from './Particles.jsx';
import { getBackTexture } from './cardTextures.js';
import {
  layoutCards, seatAngle, seatAnchor, deckTopY,
  DECK_POS, LOST_POS, TABLE_R, TABLE_Y, CARD_W, CARD_D,
} from './layout.js';
import { fxBus, gameStore, send } from '../net.js';
import { appStore, useStore } from '../store.js';
import { scoreOf, TYPE_STYLE } from '../data.js';
import { formatNumber } from '../i18n.js';

const SUN = [60, 18, -90];
const EXPEDITION_CENTER = [0, 0.1, 0.5];

function Table() {
  const woodTop = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.7 }), []);
  return (
    <group>
      <mesh position-y={TABLE_Y - 0.14} receiveShadow castShadow material={woodTop}>
        <cylinderGeometry args={[TABLE_R, TABLE_R - 0.15, 0.26, 72]} />
      </mesh>
      <mesh position-y={TABLE_Y - 0.004} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[TABLE_R - 0.45, 72]} />
        <meshStandardMaterial color="#1f4d3a" roughness={0.95} />
      </mesh>
      <mesh position-y={TABLE_Y} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[TABLE_R - 0.48, TABLE_R - 0.4, 96]} />
        <meshStandardMaterial color="#d4a63a" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position-y={TABLE_Y - 0.02} rotation-x={Math.PI / 2}>
        <torusGeometry args={[TABLE_R, 0.08, 10, 96]} />
        <meshStandardMaterial color="#c99a3c" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* compass rose inlay */}
      <mesh position={[0, TABLE_Y - 0.002, -1.2]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.55, 0.62, 48]} />
        <meshStandardMaterial color="#d4a63a" metalness={0.6} roughness={0.4} transparent opacity={0.5} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos(i * Math.PI / 2) * 3, TABLE_Y - 1.1, Math.sin(i * Math.PI / 2) * 3]} castShadow>
          <cylinderGeometry args={[0.18, 0.26, 2, 10]} />
          <meshStandardMaterial color="#4a2c12" />
        </mesh>
      ))}
    </group>
  );
}

function TreasureDeck({ count, onPeek }) {
  const back = useMemo(() => new THREE.MeshStandardMaterial({ map: getBackTexture(), roughness: 0.5 }), []);
  const side = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e7d2a0', roughness: 0.9 }), []);
  const height = Math.max(count, 0) * 0.012;
  if (count <= 0) return null;
  return (
    <group position={[DECK_POS[0], TABLE_Y, DECK_POS[2]]}>
      <mesh position-y={height / 2} castShadow receiveShadow material={[side, side, back, side, side, side]}>
        <boxGeometry args={[CARD_W, height, CARD_D]} />
      </mesh>
      <Html position={[0, height + 0.25, CARD_D / 2 + 0.1]} center distanceFactor={10} zIndexRange={[10, 0]}>
        <div className="pile-badge" onClick={onPeek}>🃏 {formatNumber(count)}</div>
      </Html>
    </group>
  );
}

function SeatPlate({ player, seat, angle, isCurrent, isMe, score }) {
  const ring = useRef();
  const pos = seatAnchor(angle, TABLE_R + 0.55);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.material.emissiveIntensity = isCurrent ? 2.5 + Math.sin(clock.elapsedTime * 4) * 1.2 : 0.2;
  });
  const color = seat?.color ?? '#f1c40f';
  return (
    <group>
      <mesh ref={ring} position={seatAnchor(angle, TABLE_R - 0.05)} rotation={[-Math.PI / 2, 0, -angle]}>
        <ringGeometry args={[0.35, 0.5, 32, 1, Math.PI * 0.25, Math.PI * 0.5]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {isCurrent && <pointLight position={[pos[0] * 0.8, 1.6, pos[2] * 0.8]} color={color} intensity={6} distance={5} />}
      <Html position={[pos[0], 0.55, pos[2]]} center distanceFactor={isMe ? 11 : 13} zIndexRange={[10, 0]}>
        <div className={`seat-plate ${isCurrent ? 'is-current' : ''} ${seat && !seat.connected && !seat.isAI ? 'is-offline' : ''}`} style={{ '--seat': color }}>
          <span className="seat-plate__avatar">{seat?.avatar ?? (player.isAI ? '🤖' : '🏴‍☠️')}</span>
          <span className="seat-plate__name">{player.name}{player.isAI ? ' 🤖' : ''}</span>
          <span className="seat-plate__score">⭐ {formatNumber(score)}</span>
        </div>
      </Html>
    </group>
  );
}

/** The menu backdrop orbits the shared camera — put it back at the seat. */
function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  useEffect(() => {
    camera.position.set(0, 7.6, 7.4);
    camera.lookAt(0, 0, 0.9);
    camera.updateProjectionMatrix();
    controls?.update?.();
  }, [camera, controls]);
  return null;
}

function SceneFx({ anchorOf, positionOfCard, shake }) {
  const particles = useParticles();
  useEffect(() => fxBus.on((event) => {
    if (!particles) return;
    switch (event.kind) {
      case 'reveal':
        particles.burst('sparks', [DECK_POS[0], 0.4, DECK_POS[2]], '#ffe6a6');
        break;
      case 'shipwreck':
        particles.burst('smoke', EXPEDITION_CENTER);
        particles.burst('splash', EXPEDITION_CENTER);
        particles.burst('sparks', EXPEDITION_CENTER, '#ff7b39');
        if (appStore.get().settings.shake) shake(1);
        break;
      case 'ability': {
        const pos = positionOfCard(event.card?.instanceId) ?? EXPEDITION_CENTER;
        particles.burst('magic', [pos[0], pos[1] + 0.2, pos[2]], TYPE_STYLE[event.type]?.color ?? '#b48bff');
        particles.burst('sparks', [pos[0], pos[1] + 0.2, pos[2]], TYPE_STYLE[event.type]?.color);
        if (event.ability === 'cannon' && appStore.get().settings.shake) shake(0.5);
        break;
      }
      case 'return': {
        const [x, , z] = anchorOf(event.playerId);
        particles.burst('gold', [x, 0.1, z]);
        break;
      }
      case 'shield':
      case 'shieldBreak':
        particles.burst('shield', EXPEDITION_CENTER);
        break;
      case 'gameEnd':
        [[-2, 1.5, -1], [2, 1.8, -1], [0, 2.2, 1]].forEach((p, i) => setTimeout(() => {
          particles.burst('gold', p);
          particles.burst('magic', p, '#ffd36b');
        }, i * 350));
        break;
      default:
    }
  }), [particles, anchorOf, positionOfCard, shake]);
  return null;
}

export default function GameScene() {
  const view = useStore(gameStore, (s) => s.view);
  const room = useStore(gameStore, (s) => s.room);
  const busy = useStore(gameStore, (s) => s.busy);
  const locale = useStore(appStore, (s) => s.settings.locale);
  const quality = useStore(appStore, (s) => s.settings.quality);
  const shakeRef = useRef();
  const seen = useRef(new Set());
  const firstLayout = useRef(true);

  const players = view?.players ?? [];
  const myIndex = Math.max(0, players.findIndex((p) => p.id === room.mySeatId));
  const targets = useMemo(() => layoutCards(view, room.mySeatId), [view, room.mySeatId]);

  const anglesById = useMemo(() => {
    const m = new Map();
    players.forEach((p, i) => m.set(p.id, seatAngle(i, myIndex, players.length)));
    return m;
  }, [players, myIndex]);

  const anchorOf = useCallback((playerId) => seatAnchor(anglesById.get(playerId) ?? 0), [anglesById]);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const positionOfCard = useCallback((id) => targetsRef.current.get(id)?.pos, []);
  const shake = useCallback((amount) => {
    const s = shakeRef.current;
    if (!s) return;
    s.setIntensity(amount);
    setTimeout(() => s.setIntensity(0), 650);
  }, []);

  // Ability-target choices for the local player (clickable glowing cards).
  const choiceByCard = useMemo(() => {
    const map = new Map();
    const pending = view?.pendingAbilityChoice;
    if (!pending || busy || pending.currentPlayerId !== room.mySeatId) return map;
    for (const option of pending.options) {
      const id = option.targetCardId ?? option.cargoCardId;
      if (id) map.set(id, option);
    }
    return map;
  }, [view, busy, room.mySeatId]);

  const cards = useMemo(() => {
    if (!view) return [];
    const all = [...view.expeditionArea, ...view.lostLoot, ...view.players.flatMap((p) => p.shipCargo)];
    const instant = firstLayout.current;
    firstLayout.current = false;
    return all.map((card) => {
      const target = targets.get(card.instanceId);
      let spawn = null;
      if (!seen.current.has(card.instanceId)) {
        seen.current.add(card.instanceId);
        if (!instant && target?.zone === 'expedition') {
          spawn = { pos: [DECK_POS[0], deckTopY(view.treasureDeckCount + 1) + 0.02, DECK_POS[2]], rotY: 0, faceUp: false, scale: 1 };
        }
      }
      return { card, target, spawn };
    });
  }, [view, targets]);

  const seatsById = useMemo(() => new Map(room.seats.map((s) => [s.id, s])), [room.seats]);
  const currentId = view ? view.players[view.currentPlayerIndex]?.id : null;

  return (
    <>
      <color attach="background" args={['#f2a76d']} />
      <fog attach="fog" args={['#e99a68', 35, 160]} />
      <Sky distance={4500} sunPosition={SUN} turbidity={7} rayleigh={2.2} mieCoefficient={0.006} mieDirectionalG={0.85} />
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={2.2} color="#ffd2a1" position={[10, 6, -12]} scale={[12, 4, 1]} />
        <Lightformer intensity={0.8} color="#7fb6ff" position={[-10, 8, 10]} scale={[10, 10, 1]} />
        <Lightformer intensity={0.6} color="#ffffff" rotation-x={Math.PI / 2} position={[0, 12, 0]} scale={[20, 20, 1]} />
      </Environment>
      <hemisphereLight args={['#ffe2c0', '#2a3d52', 0.55]} />
      <directionalLight
        position={[8, 14, -6]}
        intensity={2.4}
        color="#ffd6a8"
        castShadow={quality !== 'low'}
        shadow-mapSize={quality === 'high' ? [2048, 2048] : [1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0004}
      />
      <pointLight position={[0, 4.5, 0]} intensity={8} distance={14} color="#ffc98a" />

      <ParticleProvider>
        <Ocean sunDirection={[0.55, 0.2, -0.8]} />
        <Island torches={quality !== 'low'} />
        <Ship position={[-26, -1.2, -34]} rotation={0.5} scale={1.3} />
        <Ship position={[38, -1.2, -60]} rotation={2.4} scale={1.1} />
        <group position-y={0.05}>
          <Table />
          <TreasureDeck count={view?.treasureDeckCount ?? 0} />
          <Html position={[LOST_POS[0], 0.6, LOST_POS[2] + 0.75]} center distanceFactor={10} zIndexRange={[10, 0]}>
            <div className="pile-badge pile-badge--lost">☠️ {formatNumber(view?.lostLoot.length ?? 0)}</div>
          </Html>
          {view?.shieldActive && (
            <mesh position={EXPEDITION_CENTER} scale={[3.2, 0.9, 1.6]}>
              <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#6fc3ff" emissive="#3aa0ff" emissiveIntensity={1.4} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
            </mesh>
          )}
          {cards.map(({ card, target, spawn }) => target && (
            <Card3D
              key={card.instanceId}
              card={card}
              target={target}
              spawn={spawn}
              locale={locale}
              selectable={choiceByCard.has(card.instanceId)}
              highlight={choiceByCard.has(card.instanceId)}
              onSelect={() => send('choose', choiceByCard.get(card.instanceId))}
            />
          ))}
          {players.map((p, i) => p.id !== room.mySeatId && (
            <SeatPlate
              key={p.id}
              player={p}
              seat={seatsById.get(p.id)}
              angle={seatAngle(i, myIndex, players.length)}
              isCurrent={p.id === currentId && view.phase !== 'SCORING'}
              isMe={p.id === room.mySeatId}
              score={scoreOf(p)}
            />
          ))}
          <Sparkles count={quality === 'low' ? 0 : 40} scale={[8, 2, 8]} position={[0, 1.2, 0]} size={2.5} speed={0.3} color="#ffd98a" />
          <Physics gravity={[0, -9.81, 0]}>
            <PhysicsFx anchorOf={anchorOf} expeditionCenter={EXPEDITION_CENTER} />
          </Physics>
        </group>
        <SceneFx anchorOf={anchorOf} positionOfCard={positionOfCard} shake={shake} />
      </ParticleProvider>

      <ContactShadows position={[0, -0.25, 0]} opacity={0.4} scale={14} blur={2.4} far={3} />
      <OrbitControls
        makeDefault
        target={[0, 0, 0.9]}
        enablePan={false}
        minDistance={5}
        maxDistance={15}
        minPolarAngle={0.35}
        maxPolarAngle={1.18}
        enableDamping
      />
      <CameraRig />
      <CameraShake ref={shakeRef} intensity={0} maxYaw={0.04} maxPitch={0.04} maxRoll={0.03} yawFrequency={8} pitchFrequency={8} rollFrequency={6} />
      <Effects quality={quality} />
    </>
  );
}

