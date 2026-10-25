/**
 * Game arenas — the room around the card table: procedural walls and floors
 * dressed with props from the licensed Synty POLYGON Pirate Pack. The table top sits at y = 0; floors are at FLOOR_Y.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  ParticleSystem, RenderMode, ConeEmitter, ConstantValue, IntervalValue, ConstantColor,
  ColorOverLife, SizeOverLife, PiecewiseBezier, Bezier, Gradient, Vector4, Vector3 as QVector3,
} from 'three.quarks';

import { useParticles } from './Particles.jsx';
import { Prop } from './Synty.jsx';

export const FLOOR_Y = -3.2;

const mats = new Map();
function m(color, extra = {}) {
  const key = `${color}|${JSON.stringify(extra)}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra }));
  return mats.get(key);
}

function plankTexture(base, rows = 8, repeat = [4, 4]) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(base);
  for (let i = 0; i < rows; i++) {
    const k = 0.82 + ((i * 53) % 30) / 100;
    ctx.fillStyle = `rgb(${(col.r * 255 * k) | 0}, ${(col.g * 255 * k) | 0}, ${(col.b * 255 * k) | 0})`;
    const h = 256 / rows;
    ctx.fillRect(0, i * h, 256, h - 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, i * h + h - 2, 256, 2);
    ctx.fillRect(((i * 97) % 200) + 20, i * h, 2, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  return tex;
}

function stoneTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3b3631';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 6; x++) {
      const k = 70 + ((x * 31 + y * 17) % 35);
      ctx.fillStyle = `rgb(${k + 18}, ${k + 10}, ${k})`;
      const off = y % 2 ? 21 : 0;
      ctx.fillRect(x * 43 + off - 21 + 2, y * 32 + 2, 39, 28);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 5);
  return tex;
}

// ---------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------

function Lantern({ position, swing = 0.12, intensity = 9, color = '#ffb35c', chain = 2.2 }) {
  const ref = useRef();
  const light = useRef();
  const offset = useMemo(() => Math.random() * 10, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + offset;
    if (ref.current) {
      ref.current.rotation.z = Math.sin(t * 0.9) * swing;
      ref.current.rotation.x = Math.sin(t * 0.7 + 1) * swing * 0.6;
    }
    if (light.current) light.current.intensity = intensity * (0.92 + Math.sin(t * 11) * 0.04 + Math.random() * 0.05);
  });
  return (
    <group position={position}>
      <group ref={ref}>
        <mesh material={m('#222', { metalness: 0.6 })} position-y={-chain / 2}>
          <cylinderGeometry args={[0.025, 0.025, chain, 4]} />
        </mesh>
        <group position-y={-chain}>
          <Prop name="SM_Prop_Lantern_01" position={[0, -2.6, 0]} shadows={false} />
          <pointLight ref={light} position-y={-1.4} color={color} intensity={intensity} distance={14} decay={1.6} />
        </group>
      </group>
    </group>
  );
}

function Candle({ position, name = 'SM_Item_Candle_01', scale = 1 }) {
  const light = useRef();
  useFrame(({ clock }) => {
    if (light.current) light.current.intensity = 2.4 + Math.sin(clock.elapsedTime * 13 + position[0]) * 0.4;
  });
  return (
    <group position={position}>
      <Prop name={name} scale={scale} shadows={false} />
      <pointLight ref={light} position-y={1.6 * scale} color="#ffb35c" distance={6} decay={1.8} />
    </group>
  );
}

/** quarks fire for fireplaces. */
function Fire({ position, scale = 1 }) {
  const api = useParticles();
  const holder = useRef();
  const light = useRef();
  useEffect(() => {
    if (!api || !holder.current) return undefined;
    const tex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const fire = new ParticleSystem({
      duration: 1,
      looping: true,
      worldSpace: false,
      shape: new ConeEmitter({ radius: 0.6 * scale, angle: Math.PI / 10 }),
      startLife: new IntervalValue(0.5, 1.0),
      startSpeed: new IntervalValue(1.2 * scale, 2.4 * scale),
      startSize: new IntervalValue(0.4 * scale, 0.8 * scale),
      startColor: new ConstantColor(new Vector4(1, 0.7, 0.3, 1)),
      emissionOverTime: new ConstantValue(60),
      behaviors: [
        new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.8, 0.5, 0), 0]])),
        new ColorOverLife(new Gradient([[new QVector3(1, 0.9, 0.5), 0], [new QVector3(1, 0.25, 0), 1]], [[1, 0], [0, 1]])),
      ],
      material: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      renderMode: RenderMode.BillBoard,
    });
    fire.emitter.rotation.x = -Math.PI / 2;
    holder.current.add(fire.emitter);
    api.batch.addSystem(fire);
    return () => {
      api.batch.deleteSystem(fire);
      fire.emitter.removeFromParent();
    };
  }, [api, scale]);
  useFrame(({ clock }) => {
    if (light.current) light.current.intensity = 22 + Math.sin(clock.elapsedTime * 9) * 3 + Math.random() * 3;
  });
  return (
    <group position={position}>
      <group ref={holder} />
      {[-0.4, 0, 0.4].map((x) => (
        <mesh key={x} material={m('#3b2412')} position={[x, 0.1, 0]} rotation={[0, x, Math.PI / 2]}>
          <cylinderGeometry args={[0.13, 0.15, 1.2, 6]} />
        </mesh>
      ))}
      <pointLight ref={light} position-y={1} color="#ff8a3c" distance={22} decay={1.4} />
    </group>
  );
}

function WindowPane({ position, rotation = [0, 0, 0], size = [2.4, 2], color = '#2d4e7a', night = true }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <planeGeometry args={size} />
        <meshStandardMaterial color={color} emissive={night ? '#1d3b66' : '#9fd3ff'} emissiveIntensity={night ? 1.2 : 1.8} toneMapped={false} />
      </mesh>
      {/* muntins */}
      <mesh material={m('#3a2410')} position-z={0.02}>
        <boxGeometry args={[size[0] + 0.25, 0.12, 0.08]} />
      </mesh>
      <mesh material={m('#3a2410')} position-z={0.02}>
        <boxGeometry args={[0.12, size[1] + 0.25, 0.08]} />
      </mesh>
      <mesh material={m('#3a2410')} position-z={-0.02}>
        <boxGeometry args={[size[0] + 0.4, size[1] + 0.4, 0.06]} />
      </mesh>
    </group>
  );
}

function Table() {
  const wood = useMemo(() => plankTexture('#6b3e1e', 6, [2, 1]), []);
  return (
    <group>
      {[[-7.6, -4.6], [7.6, -4.6], [-7.6, 4.6], [7.6, 4.6]].map(([x, z]) => (
        <mesh key={`${x}${z}`} material={m('#4a2a12')} position={[x, (FLOOR_Y - 0.3) / 2, z]} castShadow>
          <cylinderGeometry args={[0.32, 0.24, -FLOOR_Y - 0.3, 8]} />
        </mesh>
      ))}
      <mesh position-y={-0.55} castShadow receiveShadow>
        <boxGeometry args={[18.6, 0.5, 12.2]} />
        <meshStandardMaterial map={wood} roughness={0.8} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ship's cabin
// ---------------------------------------------------------------------------

function ShipCabin() {
  const floorTex = useMemo(() => plankTexture('#7a5230', 10, [6, 6]), []);
  const wallTex = useMemo(() => plankTexture('#5b3a1e', 12, [5, 2]), []);
  const room = useRef();
  useFrame(({ clock }) => {
    // the ship rolls gently on the swell (the table is bolted down and stays still)
    if (room.current) room.current.rotation.z = Math.sin(clock.elapsedTime * 0.45) * 0.012;
  });
  return (
    <group>
      <color attach="background" args={['#0d0805']} />
      <fog attach="fog" args={['#120b06', 26, 60]} />
      <ambientLight intensity={0.25} color="#ffcf9a" />
      <group ref={room}>
        <mesh rotation-x={-Math.PI / 2} position-y={FLOOR_Y} receiveShadow>
          <planeGeometry args={[46, 40]} />
          <meshStandardMaterial map={floorTex} roughness={0.9} />
        </mesh>
        {/* back wall with the great stern windows */}
        <mesh position={[0, FLOOR_Y + 5, -14]} receiveShadow>
          <planeGeometry args={[46, 10]} />
          <meshStandardMaterial map={wallTex} roughness={0.9} />
        </mesh>
        {[-9, -4.5, 0, 4.5, 9].map((x) => (
          <WindowPane key={x} position={[x, FLOOR_Y + 5.6, -13.9]} size={[3, 2.6]} />
        ))}
        {/* hull ribs and ceiling beams */}
        {[-16, -11, 11, 16].map((x) => (
          <mesh key={x} material={m('#3d2410')} position={[x, FLOOR_Y + 5, -13.6]} castShadow>
            <boxGeometry args={[0.7, 10, 0.6]} />
          </mesh>
        ))}
        {[-12.5, -10].map((z) => (
          <mesh key={z} material={m('#3d2410')} position={[0, FLOOR_Y + 9.6, z]}>
            <boxGeometry args={[46, 0.6, 0.6]} />
          </mesh>
        ))}
        {/* side walls angle in like a hull */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 21, FLOOR_Y + 5, -2]} rotation={[0, -s * Math.PI / 2, s * 0.12]} receiveShadow>
            <planeGeometry args={[34, 11]} />
            <meshStandardMaterial map={wallTex} roughness={0.9} />
          </mesh>
        ))}
        {/* cannons run out at the gun ports, shot stacked beside them */}
        <Prop name="SM_Prop_Cannon_01" position={[-18.2, FLOOR_Y, -4]} rotation={[0, -Math.PI / 2, 0]} />
        <Prop name="SM_Prop_Cannon_01" position={[18.2, FLOOR_Y, -4]} rotation={[0, Math.PI / 2, 0]} />
        <Prop name="SM_Prop_Crate_Cannonballs_01" position={[-17.5, FLOOR_Y, 2]} rotation={[0, 1.2, 0]} />
        <Prop name="SM_Prop_Crate_Cannonballs_01" position={[17.5, FLOOR_Y, 2]} rotation={[0, -1.4, 0]} />
        {/* the captain's hoard and the ship's stores */}
        <Prop name="SM_Prop_Barrel_01" position={[-15.5, FLOOR_Y, -11.4]} />
        <Prop name="SM_Prop_Barrel_02" position={[-11.8, FLOOR_Y, -11.8]} rotation={[0, 1, 0]} />
        <Prop name="SM_Prop_Barrel_04" position={[-13.6, FLOOR_Y, -8.6]} rotation={[0, 2, 0]} />
        <Prop name="SM_Prop_Stack_01" position={[14, FLOOR_Y, -11.2]} rotation={[0, -0.3, 0]} />
        <Prop name="SM_Prop_Crate_01" position={[17.4, FLOOR_Y, -9.4]} rotation={[0, 0.4, 0]} />
        <Prop name="SM_Prop_Parrot_01" position={[17.4, FLOOR_Y + 3.6, -9.4]} rotation={[0, -0.9, 0]} scale={1.6} />
        <Prop name="SM_Prop_Chest_Treasure_01" position={[-8, FLOOR_Y, -12.2]} rotation={[0, 0.25, 0]} />
        <Prop name="SM_Prop_TreasurePile_01" position={[-4.8, FLOOR_Y, -12.4]} />
        <Prop name="SM_Prop_TreasurePile_01" position={[-10.8, FLOOR_Y, -9.6]} rotation={[0, 2, 0]} />
        <Prop name="SM_Prop_ShipWheel_01" position={[8.5, FLOOR_Y + 0.3, -13.6]} />
        <Prop name="SM_Prop_Anchor_01" position={[-19.4, FLOOR_Y, -9]} rotation={[0, Math.PI / 2, 0.1]} />
        <Prop name="SM_Prop_Rope_Hanging_01" position={[19.6, FLOOR_Y + 3.2, -1]} rotation={[0, -Math.PI / 2, 0]} />
        <Prop name="SM_Prop_Sack_01" position={[12, FLOOR_Y, -8.4]} rotation={[0, 0.7, 0]} />
        <Lantern position={[-6, FLOOR_Y + 9.6, -9]} chain={1.2} />
        <Lantern position={[6, FLOOR_Y + 9.6, -9]} chain={1.2} />
        <Lantern position={[-14, FLOOR_Y + 9.6, -2]} chain={1.2} intensity={6} />
        <Lantern position={[14, FLOOR_Y + 9.6, -2]} chain={1.2} intensity={6} />
        {/* moonlight through the stern windows */}
        <directionalLight position={[0, 6, -14]} intensity={0.35} color="#7aa7ff" />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Tavern
// ---------------------------------------------------------------------------

function Tavern() {
  const floorTex = useMemo(() => stoneTexture(), []);
  const wallTex = useMemo(() => plankTexture('#6a4526', 10, [6, 2]), []);
  const bottles = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    x: -6 + i * 0.9,
    color: ['#1e8449', '#7d3c98', '#a04000', '#1f618d', '#b7950b'][i % 5],
    h: 0.7 + (i % 3) * 0.15,
  })), []);
  return (
    <group>
      <color attach="background" args={['#0c0705']} />
      <fog attach="fog" args={['#140b06', 26, 60]} />
      <ambientLight intensity={0.28} color="#ffcf9a" />
      <mesh rotation-x={-Math.PI / 2} position-y={FLOOR_Y} receiveShadow>
        <planeGeometry args={[46, 40]} />
        <meshStandardMaterial map={floorTex} roughness={0.95} />
      </mesh>
      {/* back wall: wood panelling */}
      <mesh position={[0, FLOOR_Y + 5, -14]} receiveShadow>
        <planeGeometry args={[46, 10]} />
        <meshStandardMaterial map={wallTex} roughness={0.9} />
      </mesh>
      {/* bar counter with shelves of bottles */}
      <group position={[2, FLOOR_Y, -12.4]}>
        <mesh material={m('#5a3418')} position-y={1.1} castShadow receiveShadow>
          <boxGeometry args={[15, 2.2, 1.6]} />
        </mesh>
        <mesh material={m('#3d2410')} position-y={2.25}>
          <boxGeometry args={[15.4, 0.15, 1.9]} />
        </mesh>
        {[3.6, 5.0].map((y) => (
          <mesh key={y} material={m('#3d2410')} position={[0, y, -1.2]}>
            <boxGeometry args={[15, 0.12, 0.6]} />
          </mesh>
        ))}
        {bottles.map((b, i) => (
          <Prop key={i} name={`SM_Item_Bottle_0${(i % 4) + 1}`} position={[b.x, i % 2 ? 5.06 : 3.66, -1.2]} rotation={[0, i, 0]} shadows={false} />
        ))}
        {[-5, -2, 1, 4].map((x, i) => (
          <Prop key={x} name={i % 2 ? 'SM_Item_Chalice_01' : 'SM_Item_Cup_01'} position={[x, 2.33, 0.2]} rotation={[0, x, 0]} />
        ))}
        <Candle position={[-6.6, 2.33, 0.2]} name="SM_Item_Candelabra_01" />
        <Candle position={[6.6, 2.33, 0.2]} name="SM_Item_Candelabra_01" />
      </group>
      {/* fireplace on the left */}
      <group position={[-16, FLOOR_Y, -9]} rotation-y={Math.PI / 4}>
        <mesh material={m('#5d5a55')} position-y={3} castShadow>
          <boxGeometry args={[5, 6, 1.4]} />
        </mesh>
        <mesh material={m('#1a1410')} position={[0, 1.3, 0.45]}>
          <boxGeometry args={[3, 2.4, 0.6]} />
        </mesh>
        <mesh material={m('#4a2a12')} position={[0, 3.2, 0.9]}>
          <boxGeometry args={[5.4, 0.3, 0.8]} />
        </mesh>
        <Fire position={[0, 0.3, 0.9]} scale={1.1} />
      </group>
      {/* windows, dartboard, sign */}
      <WindowPane position={[-8, FLOOR_Y + 6.6, -13.9]} size={[2.4, 2.4]} />
      <WindowPane position={[12, FLOOR_Y + 6.6, -13.9]} size={[2.4, 2.4]} />
      <group position={[16.5, FLOOR_Y + 5.5, -9]} rotation-y={-Math.PI / 4}>
        {[0.8, 0.6, 0.4, 0.2].map((r, i) => (
          <mesh key={r} position-z={i * 0.01}>
            <circleGeometry args={[r, 20]} />
            <meshStandardMaterial color={i % 2 ? '#f5e6c8' : '#1c1c1c'} />
          </mesh>
        ))}
      </group>
      {[-12, -6, 0, 6, 12].map((x) => (
        <mesh key={x} material={m('#3d2410')} position={[x, FLOOR_Y + 9.6, -12.5]}>
          <boxGeometry args={[0.6, 0.6, 3]} />
        </mesh>
      ))}
      <Prop name="SM_Prop_Barrel_01" position={[14.5, FLOOR_Y, -9.6]} />
      <Prop name="SM_Prop_Barrel_02" position={[17.6, FLOOR_Y, -7.4]} rotation={[0, 0.7, 0]} />
      <Prop name="SM_Prop_Barrel_Half_01" position={[14.6, FLOOR_Y, -5.6]} />
      {/* side tables and stools for the regulars */}
      <Prop name="SM_Prop_Table_01" position={[-14.5, FLOOR_Y, -1]} rotation={[0, 0.4, 0]} />
      <Candle position={[-14.5, FLOOR_Y + 4.05, -1]} name="SM_Item_SkullCandle_01" />
      <Prop name="SM_Prop_Stool_02" position={[-17, FLOOR_Y, 0.4]} />
      <Prop name="SM_Prop_Stool_02" position={[-12, FLOOR_Y, 1.6]} rotation={[0, 1, 0]} />
      <Prop name="SM_Prop_Table_01" position={[15, FLOOR_Y, 0.5]} rotation={[0, -0.3, 0]} />
      <Candle position={[15, FLOOR_Y + 4.05, 0.5]} name="SM_Item_Bottle_Candle_01" />
      <Prop name="SM_Prop_Stool_01" position={[17.6, FLOOR_Y, 2.2]} />
      {[-4, -1, 2, 5, 8].map((x) => (
        <Prop key={x} name="SM_Prop_Stool_02" position={[x, FLOOR_Y, -9.8]} rotation={[0, x, 0]} />
      ))}
      <Prop name="SM_Prop_Pot_01" position={[-14.6, FLOOR_Y + 0.4, -8.2]} />
      {/* chandelier over the table */}
      <group position={[0, FLOOR_Y + 11.2, -3.2]}>
        <mesh material={m('#2b1d12')} position-y={-1.6}>
          <cylinderGeometry args={[0.04, 0.04, 3.2, 4]} />
        </mesh>
        <mesh material={m('#3d2410')} position-y={-3.2} rotation-x={Math.PI / 2}>
          <torusGeometry args={[1.6, 0.12, 6, 16]} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return <Candle key={i} position={[Math.cos(a) * 1.6, -3.15, Math.sin(a) * 1.6]} scale={0.7} />;
        })}
        <pointLight position-y={-2.8} color="#ffb35c" intensity={14} distance={18} decay={1.5} />
      </group>
    </group>
  );
}

export default function Arena({ id }) {
  return (
    <>
      <Table />
      {id === 'tavern' ? <Tavern /> : <ShipCabin />}
      {/* candles on the table corners */}
      <Candle position={[-8.6, 0, 5.4]} scale={0.8} />
      <Candle position={[8.6, 0, 5.4]} scale={0.8} />
    </>
  );
}
