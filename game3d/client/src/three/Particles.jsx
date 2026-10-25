/**
 * three.quarks integration: one BatchedRenderer per scene, a burst()
 * API for one-shot effects (sparks, smoke, gold, magic trails) and a
 * looping torch fire.
 */

import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  BatchedRenderer,
  ParticleSystem,
  RenderMode,
  SphereEmitter,
  ConeEmitter,
  ConstantValue,
  IntervalValue,
  ConstantColor,
  Gradient,
  ColorOverLife,
  SizeOverLife,
  ApplyForce,
  PiecewiseBezier,
  Bezier,
  Vector4,
  Vector3 as QVector3,
} from 'three.quarks';

const ParticleContext = createContext(null);

let softTexture = null;
function getSoftTexture() {
  if (softTexture) return softTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  softTexture = new THREE.CanvasTexture(c);
  return softTexture;
}

function material(blending = THREE.AdditiveBlending) {
  return new THREE.MeshBasicMaterial({
    map: getSoftTexture(),
    transparent: true,
    depthWrite: false,
    blending,
  });
}

const fadeOut = () => new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.85, 0.45, 0), 0]]));
const grow = () => new SizeOverLife(new PiecewiseBezier([[new Bezier(0.4, 0.9, 1.3, 1.6), 0]]));
const v4 = (hex, a = 1) => {
  const c = new THREE.Color(hex);
  return new Vector4(c.r, c.g, c.b, a);
};

const grad = (from, to, a0 = 1, a1 = 0) => {
  const c0 = new THREE.Color(from);
  const c1 = new THREE.Color(to);
  return new Gradient(
    [[new QVector3(c0.r, c0.g, c0.b), 0], [new QVector3(c1.r, c1.g, c1.b), 1]],
    [[a0, 0], [a1, 1]]
  );
};

const PRESETS = {
  sparks: (color = '#ffd36b') => ({
    shape: new SphereEmitter({ radius: 0.15 }),
    startLife: new IntervalValue(0.4, 0.9),
    startSpeed: new IntervalValue(2.5, 6),
    startSize: new IntervalValue(0.05, 0.14),
    startColor: new ConstantColor(v4(color)),
    count: 70,
    behaviors: [new ApplyForce(new QVector3(0, -1, 0), new ConstantValue(6)), fadeOut(), new ColorOverLife(grad(color, '#ff5a1f', 1, 0))],
  }),
  gold: () => ({
    shape: new ConeEmitter({ radius: 0.4, angle: Math.PI / 7 }),
    startLife: new IntervalValue(0.8, 1.6),
    startSpeed: new IntervalValue(2, 4.5),
    startSize: new IntervalValue(0.06, 0.16),
    startColor: new ConstantColor(v4('#ffe08a')),
    count: 90,
    behaviors: [new ApplyForce(new QVector3(0, -1, 0), new ConstantValue(3)), fadeOut(), new ColorOverLife(grad('#fff3b0', '#ffb300', 1, 0))],
  }),
  smoke: () => ({
    shape: new SphereEmitter({ radius: 0.6 }),
    startLife: new IntervalValue(1.4, 2.6),
    startSpeed: new IntervalValue(0.4, 1.4),
    startSize: new IntervalValue(0.6, 1.3),
    startColor: new ConstantColor(v4('#3a3a3a', 0.65)),
    count: 40,
    blending: THREE.NormalBlending,
    behaviors: [new ApplyForce(new QVector3(0, 1, 0), new ConstantValue(0.9)), grow(), new ColorOverLife(grad('#555555', '#222222', 0.7, 0))],
  }),
  splash: () => ({
    shape: new ConeEmitter({ radius: 0.6, angle: Math.PI / 5 }),
    startLife: new IntervalValue(0.6, 1.1),
    startSpeed: new IntervalValue(3, 6),
    startSize: new IntervalValue(0.08, 0.2),
    startColor: new ConstantColor(v4('#bfe9ff', 0.9)),
    count: 80,
    blending: THREE.NormalBlending,
    behaviors: [new ApplyForce(new QVector3(0, -1, 0), new ConstantValue(9)), fadeOut()],
  }),
  magic: (color = '#b48bff') => ({
    shape: new SphereEmitter({ radius: 0.35 }),
    startLife: new IntervalValue(0.7, 1.3),
    startSpeed: new IntervalValue(1.2, 3.2),
    startSize: new IntervalValue(0.05, 0.1),
    startColor: new ConstantColor(v4(color)),
    count: 28,
    trail: true,
    behaviors: [new ApplyForce(new QVector3(0, 1, 0), new ConstantValue(1.5)), new ColorOverLife(grad('#ffffff', color, 1, 0))],
  }),
  shield: () => ({
    shape: new SphereEmitter({ radius: 1.2, thickness: 0.05 }),
    startLife: new IntervalValue(0.6, 1.0),
    startSpeed: new ConstantValue(0.3),
    startSize: new IntervalValue(0.08, 0.16),
    startColor: new ConstantColor(v4('#7fd1ff')),
    count: 120,
    behaviors: [fadeOut()],
  }),
};

function buildBurst(kind, color) {
  const p = PRESETS[kind](color);
  const params = {
    duration: 0.2,
    looping: false,
    autoDestroy: true,
    worldSpace: true,
    shape: p.shape,
    startLife: p.startLife,
    startSpeed: p.startSpeed,
    startSize: p.startSize,
    startColor: p.startColor,
    emissionOverTime: new ConstantValue(0),
    emissionBursts: [{ time: 0, count: new ConstantValue(p.count), cycle: 1, interval: 0.01, probability: 1 }],
    behaviors: p.behaviors,
    material: material(p.blending),
    renderMode: RenderMode.BillBoard,
  };
  if (p.trail) {
    params.renderMode = RenderMode.Trail;
    params.rendererEmitterSettings = { startLength: new ConstantValue(18), followLocalOrigin: false };
  }
  return new ParticleSystem(params);
}

export function ParticleProvider({ children }) {
  const { scene } = useThree();
  const batch = useMemo(() => new BatchedRenderer(), []);

  useEffect(() => {
    scene.add(batch);
    return () => {
      scene.remove(batch);
    };
  }, [scene, batch]);

  useFrame((_, dt) => batch.update(Math.min(dt, 0.05)));

  const api = useMemo(() => ({
    batch,
    burst(kind, position, color) {
      if (!PRESETS[kind]) return;
      let system;
      try {
        system = buildBurst(kind, color);
      } catch {
        if (kind === 'magic') system = buildBurst('sparks', color);
        else return;
      }
      system.emitter.position.set(...position);
      if (kind === 'gold' || kind === 'splash') system.emitter.rotation.x = -Math.PI / 2;
      batch.addSystem(system);
      scene.add(system.emitter);
    },
  }), [batch, scene]);

  return <ParticleContext.Provider value={api}>{children}</ParticleContext.Provider>;
}

export function useParticles() {
  return useContext(ParticleContext);
}

/** Looping torch flame + flickering light. */
export function Torch({ position }) {
  const api = useParticles();
  const holder = useRef();
  const light = useRef();

  useEffect(() => {
    if (!api || !holder.current) return undefined;
    const system = new ParticleSystem({
      duration: 1,
      looping: true,
      worldSpace: false,
      shape: new ConeEmitter({ radius: 0.08, angle: Math.PI / 12 }),
      startLife: new IntervalValue(0.35, 0.7),
      startSpeed: new IntervalValue(0.6, 1.4),
      startSize: new IntervalValue(0.18, 0.32),
      startColor: new ConstantColor(v4('#ffb347')),
      emissionOverTime: new ConstantValue(38),
      behaviors: [fadeOut(), new ColorOverLife(grad('#ffe08a', '#ff3b00', 1, 0))],
      material: material(),
      renderMode: RenderMode.BillBoard,
    });
    system.emitter.rotation.x = -Math.PI / 2;
    holder.current.add(system.emitter);
    api.batch.addSystem(system);
    return () => {
      api.batch.deleteSystem(system);
      system.emitter.removeFromParent();
    };
  }, [api]);

  useFrame(({ clock }) => {
    if (light.current) light.current.intensity = 6 + Math.sin(clock.elapsedTime * 13 + position[0]) * 1.2 + Math.random() * 0.8;
  });

  return (
    <group position={position}>
      <mesh position-y={0.9} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 1.8, 6]} />
        <meshStandardMaterial color="#4a2c12" />
      </mesh>
      <mesh position-y={1.85}>
        <cylinderGeometry args={[0.13, 0.08, 0.2, 8]} />
        <meshStandardMaterial color="#222" metalness={0.6} />
      </mesh>
      <group ref={holder} position-y={1.95} />
      <pointLight ref={light} position-y={2.2} color="#ff9a3c" distance={9} decay={1.6} />
    </group>
  );
}
