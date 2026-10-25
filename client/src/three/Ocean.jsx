import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertex = /* glsl */ `
  uniform float uTime;
  varying float vHeight;
  varying vec3 vWorld;

  float waves(vec2 p, float t) {
    float h = 0.0;
    h += sin(p.x * 0.12 + t * 0.8) * 0.42;
    h += sin(p.y * 0.18 + t * 1.1) * 0.30;
    h += sin((p.x + p.y) * 0.33 + t * 1.6) * 0.14;
    h += sin((p.x * 0.7 - p.y) * 0.6 + t * 2.3) * 0.05;
    return h;
  }

  void main() {
    vec3 pos = position;
    vec4 world = modelMatrix * vec4(pos, 1.0);
    float h = waves(world.xz, uTime);
    pos.z += h;
    vHeight = h;
    vWorld = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  varying float vHeight;
  varying vec3 vWorld;

  void main() {
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    if (n.y < 0.0) n = -n;
    vec3 viewDir = normalize(cameraPosition - vWorld);

    vec3 color = mix(uDeep, uShallow, smoothstep(-0.6, 0.7, vHeight));
    float foam = smoothstep(0.62, 0.85, vHeight);
    color = mix(color, vec3(0.92, 0.96, 1.0), foam * 0.55);

    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    color = mix(color, uHorizon, fresnel * 0.28);

    vec3 r = reflect(-uSunDir, n);
    float spec = pow(max(dot(r, viewDir), 0.0), 220.0);
    color += uSunColor * spec * 0.9;

    float dist = length(cameraPosition.xz - vWorld.xz);
    color = mix(color, uHorizon, smoothstep(70.0, 260.0, dist) * 0.85);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function Ocean({ sunDirection = [0.3, 0.25, -1], deep = '#03192c', shallow = '#0c5a73', horizon = '#c98f74', size = 420 }) {
  const mat = useRef();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(deep) },
    uShallow: { value: new THREE.Color(shallow) },
    uHorizon: { value: new THREE.Color(horizon) },
    uSunDir: { value: new THREE.Vector3(...sunDirection).normalize() },
    uSunColor: { value: new THREE.Color('#ffd7a1') },
  }), [deep, shallow, horizon, sunDirection]);

  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime.value += dt;
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-1.2} receiveShadow>
      <planeGeometry args={[size, size, 220, 220]} />
      <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} />
    </mesh>
  );
}

/** Same wave function on the CPU so floating objects bob in sync. */
export function waveHeight(x, z, t) {
  return Math.sin(x * 0.12 + t * 0.8) * 0.42
    + Math.sin(z * 0.18 + t * 1.1) * 0.3
    + Math.sin((x + z) * 0.33 + t * 1.6) * 0.14
    - 1.2;
}
