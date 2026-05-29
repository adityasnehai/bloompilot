"use client";

import { useRef, useMemo, useCallback, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  AccumulativeShadows,
  RandomizedLight,
  useTexture,
  Sparkles,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  DepthOfField,
  HueSaturation,
  SMAA,
} from "@react-three/postprocessing";
import * as THREE from "three";
import { useGardenStore } from "./garden-store";
import { PlacedPlantMesh } from "./plants";

// ─── Instanced grass blades ───────────────────────────────────────────────────
const GRASS_COUNT = 6000;

function Grass() {
  const ref = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const bladeGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      -0.03, 0, 0,
       0.03, 0, 0,
      -0.015, 0.18, 0,
       0.015, 0.18, 0,
       0,     0.32, 0,
    ]);
    const idx = new Uint16Array([0,1,2, 1,3,2, 2,3,4]);
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    return geo;
  }, []);

  // positions excluding path
  const positions = useMemo(() => {
    const arr: { x: number; z: number; rot: number; scale: number }[] = [];
    for (let i = 0; i < GRASS_COUNT; i++) {
      let x: number, z: number;
      let tries = 0;
      do {
        x = (Math.random() - 0.5) * 26;
        z = (Math.random() - 0.5) * 26;
        tries++;
      } while (tries < 10 && (Math.abs(x) < 1.2 || Math.abs(z) < 1.2)); // avoid path
      arr.push({ x, z, rot: Math.random() * Math.PI, scale: 0.7 + Math.random() * 0.6 });
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    positions.forEach((p, i) => {
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.y = p.rot;
      const sway = Math.sin(t * 1.2 + p.x * 0.3 + p.z * 0.2) * 0.08;
      dummy.rotation.z = sway;
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[bladeGeo, undefined, GRASS_COUNT]} castShadow>
      <meshPhysicalMaterial
        color="#4a8a40"
        roughness={0.9}
        side={THREE.DoubleSide}
        transmission={0.08}
      />
    </instancedMesh>
  );
}

// ─── Ground  ─────────────────────────────────────────────────────────────────
function Ground() {
  return (
    <group>
      {/* base lawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30, 1, 1]} />
        <meshStandardMaterial color="#3d7a38" roughness={1} />
      </mesh>

      {/* outer dark ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#294d25" roughness={1} />
      </mesh>

      {/* grass blades */}
      <Grass />

      {/* stone path cross */}
      <StonePath />

      {/* raised beds */}
      <RaisedBed x={-7.5} z={-7.5} />
      <RaisedBed x={7.5} z={-7.5} />
      <RaisedBed x={-7.5} z={7.5} />
      <RaisedBed x={7.5} z={7.5} />

      {/* perimeter hedge/fence posts */}
      <PerimeterFence />
    </group>
  );
}

function StonePath() {
  const stones = useMemo(() => {
    const arr = [];
    for (let i = -9; i <= 9; i++) {
      const jitter = (Math.random() - 0.5) * 0.05;
      arr.push({ x: i * 1.05 + jitter, z: 0, w: 0.95, d: 1.7 });
      arr.push({ x: 0, z: i * 1.05 + jitter, w: 1.7, d: 0.95 });
    }
    return arr;
  }, []);

  return (
    <group position={[0, 0.005, 0]}>
      {stones.map((s, i) => (
        <mesh key={i} position={[s.x, 0, s.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[s.w, s.d]} />
          <meshStandardMaterial color={i % 7 === 0 ? "#8a8078" : "#9a9088"} roughness={0.92} />
        </mesh>
      ))}
      {/* grout */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[19, 1.75]} />
        <meshStandardMaterial color="#6a6860" roughness={1} />
      </mesh>
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[19, 1.75]} />
        <meshStandardMaterial color="#6a6860" roughness={1} />
      </mesh>
    </group>
  );
}

function RaisedBed({ x, z }: { x: number; z: number }) {
  const w = 5.2, d = 5.2, h = 0.28;
  return (
    <group position={[x, 0, z]}>
      {/* soil */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
        <planeGeometry args={[w - 0.22, d - 0.22]} />
        <meshStandardMaterial color="#3a2010" roughness={0.98} />
      </mesh>
      {/* wooden border */}
      {[[-d / 2, 0, 0, w, h, 0.12], [d / 2, 0, 0, w, h, 0.12],
        [0, 0, -w / 2, 0.12, h, d], [0, 0, w / 2, 0.12, h, d]
      ].map(([bx, by, bz, bw, bh, bd], i) => (
        <mesh key={i} position={[bx as number, (by as number) + h / 2, bz as number]} castShadow receiveShadow>
          <boxGeometry args={[bw as number, bh as number, bd as number]} />
          <meshStandardMaterial color="#6b3d1e" roughness={0.88} />
        </mesh>
      ))}
    </group>
  );
}

function PerimeterFence() {
  const posts = useMemo(() => {
    const arr = [];
    const r = 14;
    const count = 28;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      arr.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
    }
    return arr;
  }, []);

  return (
    <group>
      {posts.map((p, i) => (
        <mesh key={i} position={[p.x, 0.4, p.z]} castShadow receiveShadow>
          <boxGeometry args={[0.14, 0.8, 0.14]} />
          <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Garden centrepiece ───────────────────────────────────────────────────────
function Fountain() {
  const waterRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (waterRef.current) {
      const mat = waterRef.current.material as THREE.MeshPhysicalMaterial;
      mat.color.setHSL(0.57, 0.6, 0.35 + Math.sin(clock.elapsedTime * 0.5) * 0.04);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.72, 0.82, 0.2, 28]} />
        <meshStandardMaterial color="#aba8a0" roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.17, 0.35, 14]} />
        <meshStandardMaterial color="#aba8a0" roughness={0.55} />
      </mesh>
      <mesh ref={waterRef} position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.66, 0.66, 0.07, 28]} />
        <meshPhysicalMaterial color="#4a8aaa" roughness={0.1} metalness={0.2} transparent opacity={0.72} transmission={0.3} />
      </mesh>
    </group>
  );
}

// ─── Click-to-plant plane ─────────────────────────────────────────────────────
function PlantingPlane() {
  const selected = useGardenStore((s) => s.selected);
  const placeAt = useGardenStore((s) => s.placeAt);
  const setActive = useGardenStore((s) => s.setActive);
  const [hover, setHover] = useState<THREE.Vector3 | null>(null);

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.06, 0]}
        onClick={(e) => {
          e.stopPropagation();
          if (!selected) { setActive(null); return; }
          placeAt(e.point.x, e.point.z);
        }}
        onPointerMove={(e) => setHover(e.point.clone())}
        onPointerLeave={() => setHover(null)}
      >
        <planeGeometry args={[28, 28]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {selected && hover && (
        <group position={[hover.x, 0.05, hover.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.4 * selected.scale, 0.52 * selected.scale, 32]} />
            <meshBasicMaterial color="#86efac" transparent opacity={0.5} />
          </mesh>
          <mesh position={[0, 0.25 * selected.scale, 0]}>
            <sphereGeometry args={[0.22 * selected.scale, 10, 8]} />
            <meshPhysicalMaterial color={selected.foliageColor} transparent opacity={0.35} />
          </mesh>
        </group>
      )}
    </>
  );
}

// ─── Scene lighting (time-of-day driven) ─────────────────────────────────────
const TIME_CONFIGS = {
  morning: { envPreset: "dawn" as const, sunPos: [0.4, 0.5, 1.0], intensity: 1.6, ambColor: "#ffd580", hue: 0.03, sat: 0.1 },
  day:     { envPreset: "park" as const, sunPos: [1.0, 1.8, 0.6], intensity: 2.2, ambColor: "#ffffff", hue: 0.0,  sat: 0.05 },
  evening: { envPreset: "sunset" as const, sunPos: [1.2, 0.2, -0.5], intensity: 1.3, ambColor: "#ff8844", hue: -0.03, sat: 0.15 },
};

// ─── Main scene ───────────────────────────────────────────────────────────────
export function GardenScene() {
  const placed = useGardenStore((s) => s.placed);
  const setActive = useGardenStore((s) => s.setActive);
  const timeOfDay = useGardenStore((s) => s.timeOfDay);
  const cfg = TIME_CONFIGS[timeOfDay];

  return (
    <>
      {/* HDR environment (lighting + background) */}
      <Environment
        preset={cfg.envPreset}
        background
        backgroundBlurriness={0.05}
        backgroundIntensity={0.8}
      />

      {/* Sun */}
      <directionalLight
        position={[cfg.sunPos[0] * 18, cfg.sunPos[1] * 18, cfg.sunPos[2] * 18]}
        intensity={cfg.intensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={60}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-0.001}
        color={cfg.ambColor}
      />
      <ambientLight intensity={0.45} color={cfg.ambColor} />
      <directionalLight position={[-12, 8, -12]} intensity={0.35} color="#aaccff" />

      {/* Subtle fog */}
      <fog attach="fog" args={["#c8e8d0", 28, 65]} />

      {/* scene background click */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} onClick={() => setActive(null)}>
        <planeGeometry args={[300, 300]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Garden geometry */}
      <Ground />
      <Fountain />
      <PlantingPlane />

      {/* Atmospheric sparkles (pollen/dust) */}
      <Sparkles count={120} scale={[20, 4, 20]} size={1.2} speed={0.25} opacity={0.35} color="#d4f0a0" />

      {/* Photorealistic shadow baking */}
      <AccumulativeShadows
        temporal
        frames={40}
        alphaTest={0.75}
        scale={28}
        position={[0, 0.01, 0]}
      >
        <RandomizedLight amount={6} radius={6} intensity={0.8} ambient={0.5} position={[5, 10, -5]} />
      </AccumulativeShadows>

      {/* Placed plants */}
      {placed.map((item) => (
        <PlacedPlantMesh key={item.id} item={item} />
      ))}

      {/* Post-processing */}
      <EffectComposer multisampling={0}>
        <SMAA />
        <DepthOfField focusDistance={0.01} focalLength={0.05} bokehScale={2.5} />
        <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.9} intensity={0.45} />
        <HueSaturation hue={cfg.hue} saturation={cfg.sat} />
        <Vignette offset={0.28} darkness={0.55} />
      </EffectComposer>

      {/* Camera */}
      <OrbitControls
        makeDefault
        enablePan
        panSpeed={0.5}
        minDistance={3}
        maxDistance={40}
        minPolarAngle={Math.PI / 12}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0.5, 0]}
      />
    </>
  );
}
