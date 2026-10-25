/**
 * The in-game 3D view: a flat treasure board on a ship's deck, seen from
 * a fixed camera. Everything here is a pure function of the replayed
 * engine view; the only thing it can send back is an ability-target click.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, Html } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';

import Card3D from './Card3D.jsx';
import Crew from './Crew.jsx';
import Arena from './Arenas.jsx';
import PhysicsFx from './PhysicsFx.jsx';
import Effects from './Effects.jsx';
import { ParticleProvider, useParticles } from './Particles.jsx';
import { getBackTexture } from './cardTextures.js';
import {
  layoutCards, deckTopY, anchorFor, rivalsOf, rivalAreaX, rivalAreaWidth,
  DECK_POS, LOST_POS, TABLE_Y, CARD_W, CARD_D, BOARD_W, BOARD_D,
  EXPEDITION_Z, EXPEDITION_W, MY_CARGO_Z, RIVAL_CARGO_Z,
} from './layout.js';
import { fxBus, gameStore, send } from '../net.js';
import { appStore, useStore } from '../store.js';
import { scoreOf, TYPE_STYLE } from '../data.js';
import { formatNumber, useT } from '../i18n.js';
import { characterById } from '../../../shared/roster.js';

const EXPEDITION_CENTER = [0, 0.1, EXPEDITION_Z];

const LOOK_AT = new THREE.Vector3(0, 1.4, -1.9);
const SAILOR_Z = -7.15;
const SAILOR_SCALE = 1.1;
const MY_SAILOR_POS = [10.7, 0, 2.4];

/**
 * Fixed camera framing the whole board (pulls back on narrow screens),
 * plus a short decaying shake for shipwrecks / cannon fire.
 */
function CameraRig({ shakeRef }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const base = useRef(new THREE.Vector3());
  const trauma = useRef(0);

  useEffect(() => {
    shakeRef.current = (amount) => { trauma.current = Math.min(1, trauma.current + amount); };
  }, [shakeRef]);

  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const fit = Math.max(1, 1.7 / aspect);
    camera.fov = 42;
    base.current.set(0, 11.6 * fit, 12.6 * fit);
    camera.position.copy(base.current);
    camera.lookAt(LOOK_AT);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  useFrame(({ clock }, dt) => {
    if (trauma.current <= 0) return;
    trauma.current = Math.max(0, trauma.current - dt * 1.6);
    const s = trauma.current * trauma.current * 0.35;
    const t = clock.elapsedTime * 40;
    camera.position.set(base.current.x + Math.sin(t) * s, base.current.y, base.current.z + Math.cos(t * 1.3) * s);
    camera.lookAt(LOOK_AT);
  });
  return null;
}

/** Thin rounded outline marking a zone on the felt. */
function ZoneOutline({ center, width, depth, color = '#d4a63a', opacity = 0.45 }) {
  const geometry = useMemo(() => {
    const r = 0.18;
    const w = width / 2;
    const d = depth / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-w + r, -d);
    shape.lineTo(w - r, -d);
    shape.quadraticCurveTo(w, -d, w, -d + r);
    shape.lineTo(w, d - r);
    shape.quadraticCurveTo(w, d, w - r, d);
    shape.lineTo(-w + r, d);
    shape.quadraticCurveTo(-w, d, -w, d - r);
    shape.lineTo(-w, -d + r);
    shape.quadraticCurveTo(-w, -d, -w + r, -d);
    return new THREE.BufferGeometry().setFromPoints(shape.getPoints(8));
  }, [width, depth]);
  return (
    <lineLoop geometry={geometry} position={[center[0], TABLE_Y + 0.002, center[2]]} rotation-x={-Math.PI / 2}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineLoop>
  );
}

function Board({ rivalCount }) {
  const t = useT();
  return (
    <group>
      {/* frame */}
      <mesh position-y={TABLE_Y - 0.16} receiveShadow castShadow>
        <boxGeometry args={[BOARD_W + 0.8, 0.3, BOARD_D + 0.8]} />
        <meshStandardMaterial color="#5a3418" roughness={0.75} />
      </mesh>
      <mesh position-y={TABLE_Y - 0.03} receiveShadow>
        <boxGeometry args={[BOARD_W + 0.3, 0.02, BOARD_D + 0.3]} />
        <meshStandardMaterial color="#c99a3c" metalness={0.75} roughness={0.3} />
      </mesh>
      {/* felt */}
      <mesh position-y={TABLE_Y - 0.001} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[BOARD_W, BOARD_D]} />
        <meshStandardMaterial color="#1d4a37" roughness={0.95} />
      </mesh>

      <ZoneOutline center={DECK_POS} width={CARD_W + 0.5} depth={CARD_D + 0.5} />
      <ZoneOutline center={LOST_POS} width={CARD_W + 0.5} depth={CARD_D + 0.5} color="#9aa5b1" />
      <ZoneOutline center={[0, 0, EXPEDITION_Z + 0.3]} width={EXPEDITION_W} depth={CARD_D * 2 + 0.7} color="#e8d9a8" opacity={0.25} />
      <ZoneOutline center={[0, 0, MY_CARGO_Z - 0.2]} width={BOARD_W - 1.4} depth={1.9} color="#f1c40f" opacity={0.35} />
      {Array.from({ length: rivalCount }, (_, i) => (
        <ZoneOutline key={i} center={[rivalAreaX(i, rivalCount), 0, RIVAL_CARGO_Z + 0.25]} width={rivalAreaWidth(rivalCount)} depth={1.7} color="#e8d9a8" opacity={0.25} />
      ))}

      <Html position={[0, 0.05, EXPEDITION_Z - CARD_D / 2 - 0.45]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="board-label">🏝️ {t('game.expedition')}</div>
      </Html>
      <Html position={[0, 0.05, MY_CARGO_Z + 0.85]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="board-label">🚢 {t('game.cargo')}</div>
      </Html>
    </group>
  );
}

function TreasureDeck({ count }) {
  const back = useMemo(() => new THREE.MeshStandardMaterial({ map: getBackTexture(), roughness: 0.5 }), []);
  const side = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e7d2a0', roughness: 0.9 }), []);
  const height = Math.max(count, 0) * 0.012;
  return (
    <group position={[DECK_POS[0], TABLE_Y, DECK_POS[2]]}>
      {count > 0 && (
        <mesh position-y={height / 2} castShadow receiveShadow material={[side, side, back, side, side, side]}>
          <boxGeometry args={[CARD_W, height, CARD_D]} />
        </mesh>
      )}
      <Html position={[0, 0.05, CARD_D / 2 + 0.45]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="pile-badge">🃏 {formatNumber(count)}</div>
      </Html>
    </group>
  );
}

function RivalPlate({ player, seat, position, isCurrent }) {
  const color = seat?.color ?? '#f1c40f';
  return (
    <Html position={position} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`seat-plate ${isCurrent ? 'is-current' : ''} ${seat && !seat.connected && !seat.isAI ? 'is-offline' : ''}`} style={{ '--seat': color }}>
        <span className="seat-plate__avatar">{seat?.avatar ?? '☠️'}</span>
        <span className="seat-plate__name">{player.name}{player.isAI ? ' 🤖' : ''}</span>
        <span className="seat-plate__score">⭐ {formatNumber(scoreOf(player))}</span>
      </div>
    </Html>
  );
}

/** Soft glow under whoever's turn it is. */
function TurnGlow({ position, width, color }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.material.opacity = 0.035 + Math.sin(clock.elapsedTime * 3) * 0.02;
  });
  return (
    <mesh ref={ref} position={[position[0], TABLE_Y + 0.001, position[2]]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[width, 1.9]} />
      <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} />
    </mesh>
  );
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
        [[-3, 1.5, 0], [3, 1.8, 0], [0, 2.2, 1.5]].forEach((p, i) => setTimeout(() => {
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
  const targets = useMemo(() => layoutCards(view, room.mySeatId), [view, room.mySeatId]);
  const isPlayer = players.some((p) => p.id === room.mySeatId);
  const rivals = useMemo(() => (isPlayer ? rivalsOf(players, room.mySeatId) : players), [players, isPlayer, room.mySeatId]);

  const playersRef = useRef(players);
  playersRef.current = players;
  const anchorOf = useCallback((playerId) => anchorFor(playersRef.current, room.mySeatId, playerId), [room.mySeatId]);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const positionOfCard = useCallback((id) => targetsRef.current.get(id)?.pos, []);
  const shake = useCallback((amount) => shakeRef.current?.(amount), []);

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
    const unique = new Map();
    for (const card of [...view.expeditionArea, ...view.lostLoot, ...view.players.flatMap((p) => p.shipCargo)]) {
      if (!unique.has(card.instanceId)) unique.set(card.instanceId, card);
    }
    const all = [...unique.values()];
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
  const current = view ? view.players[view.currentPlayerIndex] : null;
  const playing = view && view.phase !== 'SCORING';
  const arena = room.arena || 'ship';

  // Short-lived reactions: cheer when cargo is secured, slump on a shipwreck.
  const [reactions, setReactions] = useState({});
  useEffect(() => fxBus.on((event) => {
    const mood = event.kind === 'return' ? 'cheer' : event.kind === 'shipwreck' ? 'sad' : null;
    if (!mood || !event.playerId) return;
    setReactions((r) => ({ ...r, [event.playerId]: mood }));
    setTimeout(() => setReactions((r) => (r[event.playerId] === mood ? { ...r, [event.playerId]: null } : r)), 2200);
  }), []);
  const winners = view?.results?.winners ?? [];
  const moodOf = (id) => {
    if (reactions[id]) return reactions[id];
    if (!playing) return winners.includes(id) ? 'cheer' : 'idle';
    return id === current?.id ? 'thinking' : 'idle';
  };
  const currentRival = rivals.findIndex((p) => p.id === current?.id);

  return (
    <>
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={0.6} color="#ffe2c4" position={[8, 8, -6]} scale={[12, 4, 1]} />
        <Lightformer intensity={0.35} color="#bcd4ff" position={[-8, 8, 6]} scale={[10, 10, 1]} />
      </Environment>
      <hemisphereLight args={['#ffe2c0', '#1a120b', 0.25]} />
      {/* warm fill so the crew's faces read from the player's seat */}
      <pointLight position={[0, 7, 1]} intensity={45} distance={22} decay={1.4} color="#ffd2a1" />
      <directionalLight position={[0, 6, 14]} intensity={1.1} color="#ffe6c8" />
      <spotLight
        position={[0, 14, 2]}
        angle={0.62}
        penumbra={0.6}
        intensity={260}
        decay={1.6}
        color="#ffe6c4"
        castShadow={quality !== 'low'}
        shadow-mapSize={quality === 'high' ? [2048, 2048] : [1024, 1024]}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0004}
      />

      <ParticleProvider>
        <Arena id={arena} />
        <Board rivalCount={rivals.length} />
        <TreasureDeck count={view?.treasureDeckCount ?? 0} />
        <Html position={[LOST_POS[0], 0.05, LOST_POS[2] + CARD_D / 2 + 0.45]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="pile-badge pile-badge--lost">☠️ {formatNumber(view?.lostLoot.length ?? 0)}</div>
        </Html>

        {playing && current?.id === room.mySeatId && (
          <TurnGlow position={[0, 0, MY_CARGO_Z - 0.2]} width={BOARD_W - 1.4} color={seatsById.get(current.id)?.color ?? '#f1c40f'} />
        )}
        {playing && currentRival >= 0 && (
          <TurnGlow position={[rivalAreaX(currentRival, rivals.length), 0, RIVAL_CARGO_Z + 0.25]} width={rivalAreaWidth(rivals.length)} color={seatsById.get(current.id)?.color ?? '#f1c40f'} />
        )}

        {view?.shieldActive && (
          <group>
            <ZoneOutline center={[0, 0, EXPEDITION_Z + 0.3]} width={EXPEDITION_W + 0.15} depth={CARD_D * 2 + 0.85} color="#7fd1ff" opacity={0.95} />
            <mesh position={[0, TABLE_Y + 0.001, EXPEDITION_Z + 0.3]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[EXPEDITION_W, CARD_D * 2 + 0.7]} />
              <meshBasicMaterial color="#3aa0ff" transparent opacity={0.07} depthWrite={false} />
            </mesh>
          </group>
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

        {rivals.map((p, i) => {
          const x = rivalAreaX(i, rivals.length);
          const seat = seatsById.get(p.id);
          return (
            <group key={p.id}>
              <Crew
                character={characterById(seat?.character)}
                position={[x, 0, SAILOR_Z]}
                scale={SAILOR_SCALE}
                seed={i}
                lookX={-x / 9}
                mood={moodOf(p.id)}
              />
              <RivalPlate player={p} seat={seat} position={[x, 4.75 * SAILOR_SCALE, SAILOR_Z - 0.4]} isCurrent={playing && p.id === current?.id} />
            </group>
          );
        })}
        {isPlayer && (
          <group position={MY_SAILOR_POS} rotation-y={-Math.PI / 2}>
            <Crew
              character={characterById(seatsById.get(room.mySeatId)?.character)}
              scale={SAILOR_SCALE}
              seed={9}
              mood={moodOf(room.mySeatId)}
            />
          </group>
        )}

        <Physics gravity={[0, -9.81, 0]}>
          <PhysicsFx anchorOf={anchorOf} expeditionCenter={EXPEDITION_CENTER} />
        </Physics>
        <SceneFx anchorOf={anchorOf} positionOfCard={positionOfCard} shake={shake} />
      </ParticleProvider>

      <CameraRig shakeRef={shakeRef} />
      <Effects quality={quality} />
    </>
  );
}
