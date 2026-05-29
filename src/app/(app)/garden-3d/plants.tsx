"use client";

import { useRef, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Clone } from "@react-three/drei";
import * as THREE from "three";
import type { PlantDef, PlacedPlant } from "./garden-store";
import { useGardenStore } from "./garden-store";

// ─── Free GLTF models from pmndrs/market (CC0) ───────────────────────────────
const MODEL_URLS: Record<string, string> = {
  tree_lime:   "https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/tree-lime/model.gltf",
  tree_beech:  "https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/tree-beech/model.gltf",
  tree_spruce: "https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/tree-spruce/model.gltf",
  cactus:      "https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/cactus/model.gltf",
  flowers:     "https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/flowers-4/model.gltf",
};

useGLTF.preload(MODEL_URLS.tree_lime);
useGLTF.preload(MODEL_URLS.tree_beech);
useGLTF.preload(MODEL_URLS.tree_spruce);
useGLTF.preload(MODEL_URLS.cactus);
useGLTF.preload(MODEL_URLS.flowers);

function GTLFModel({ url, scale = 1 }: { url: string; scale?: number }) {
  const { scene } = useGLTF(url);
  return <Clone object={scene} scale={scale} castShadow receiveShadow />;
}

// ─── Wind hook ─────────────────────────────────────────────────────────────────
function useWind(ref: React.RefObject<THREE.Group | null>, speed = 0.8, strength = 0.02) {
  const phase = useMemo(() => Math.random() * 100, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * speed + phase;
    ref.current.rotation.z = Math.sin(t) * strength;
    ref.current.rotation.x = Math.sin(t * 0.73) * strength * 0.4;
  });
}

// ─── Procedural fallback plants (used when GLTF unavailable) ─────────────────

function ProceduralTree({ plant }: { plant: PlantDef }) {
  const foliageRef = useRef<THREE.Group>(null);
  useWind(foliageRef, 0.5, 0.015);

  const clusters = useMemo(() => {
    const arr: { x: number; y: number; z: number; r: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 0.35 + Math.random() * 0.45;
      const y = 1.5 + Math.random() * 0.8;
      arr.push({ x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, r: 0.5 + Math.random() * 0.35 });
    }
    arr.push({ x: 0, y: 2.3, z: 0, r: 0.65 });
    return arr;
  }, []);

  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.16, 1.8, 10]} />
        <meshStandardMaterial color={plant.trunkColor} roughness={0.95} />
      </mesh>
      <group ref={foliageRef}>
        {clusters.map((c, i) => (
          <mesh key={i} position={[c.x, c.y, c.z]} castShadow>
            <sphereGeometry args={[c.r, 9, 7]} />
            <meshPhysicalMaterial
              color={i % 2 === 0 ? plant.foliageColor : plant.foliageColor2}
              roughness={0.9}
              transmission={0.05}
              flatShading
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function ProceduralShrub({ plant }: { plant: PlantDef }) {
  const ref = useRef<THREE.Group>(null);
  useWind(ref, 1.1, 0.025);

  const bumps = useMemo(() => {
    const arr: { x: number; y: number; z: number; r: number }[] = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + Math.random() * 0.3;
      const r = 0.12 + Math.random() * 0.22;
      arr.push({ x: Math.cos(a) * r, y: 0.1 + Math.random() * 0.28, z: Math.sin(a) * r, r: 0.22 + Math.random() * 0.18 });
    }
    arr.push({ x: 0, y: 0.32, z: 0, r: 0.32 });
    return arr;
  }, []);

  return (
    <group ref={ref}>
      {bumps.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]} castShadow>
          <sphereGeometry args={[b.r, 9, 7]} />
          <meshPhysicalMaterial
            color={i % 2 === 0 ? plant.foliageColor : plant.foliageColor2}
            roughness={0.85}
            flatShading
          />
        </mesh>
      ))}
      {/* accent blooms */}
      {plant.accentColor !== plant.foliageColor &&
        Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={`bloom${i}`} position={[Math.cos(a) * 0.26, 0.38, Math.sin(a) * 0.26]}>
              <sphereGeometry args={[0.09, 8, 6]} />
              <meshPhysicalMaterial color={plant.accentColor} emissive={plant.accentColor} emissiveIntensity={0.2} roughness={0.5} />
            </mesh>
          );
        })}
    </group>
  );
}

function ProceduralPalm({ plant }: { plant: PlantDef }) {
  const topRef = useRef<THREE.Group>(null);
  useWind(topRef, 1.2, 0.04);

  return (
    <group>
      {Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        const lean = Math.sin(t * 1.2) * 0.4;
        return (
          <mesh key={i} position={[lean, 0.22 + i * 0.52, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.1, 0.6, 9]} />
            <meshStandardMaterial color={plant.trunkColor} roughness={0.9} />
          </mesh>
        );
      })}
      <group ref={topRef} position={[0.35, 3.9, 0]}>
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(angle) * 0.1, 0, Math.sin(angle) * 0.1]}
              rotation={[0.75, angle, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.055, 1.6, 6]} />
              <meshPhysicalMaterial color={plant.foliageColor} roughness={0.7} transmission={0.1} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function ProceduralFern({ plant }: { plant: PlantDef }) {
  const ref = useRef<THREE.Group>(null);
  useWind(ref, 1.3, 0.045);

  return (
    <group ref={ref}>
      {Array.from({ length: 9 }, (_, i) => {
        const angle = (i / 9) * Math.PI * 2;
        const lean = 0.6 + Math.random() * 0.2;
        return (
          <group key={i} rotation={[lean, angle, 0]}>
            <mesh position={[0, 0.4, 0]} castShadow>
              <cylinderGeometry args={[0.02, 0.03, 0.8, 5]} />
              <meshStandardMaterial color={plant.foliageColor} roughness={0.85} />
            </mesh>
            {Array.from({ length: 4 }, (_, j) => (
              <mesh key={j} position={[(j % 2 === 0 ? 0.06 : -0.06), 0.2 + j * 0.15, 0]}
                rotation={[0, 0, (j % 2 === 0 ? 0.6 : -0.6)]}>
                <planeGeometry args={[0.16, 0.08, 1, 1]} />
                <meshPhysicalMaterial color={plant.foliageColor2} roughness={0.8} transmission={0.08} side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function ProceduralSucculent({ plant }: { plant: PlantDef }) {
  return (
    <group>
      {Array.from({ length: 14 }, (_, i) => {
        const layer = Math.floor(i / 5);
        const posInLayer = i % 5;
        const angle = (posInLayer / 5) * Math.PI * 2 + layer * 0.628;
        const r = (0.08 + layer * 0.13);
        const tilt = Math.PI / 2 - layer * 0.18;
        return (
          <mesh key={i}
            position={[Math.cos(angle) * r, layer * 0.065, Math.sin(angle) * r]}
            rotation={[tilt, 0, angle + Math.PI / 2]}
            castShadow>
            <coneGeometry args={[0.09, 0.26, 5]} />
            <meshPhysicalMaterial
              color={i % 2 === 0 ? plant.foliageColor : plant.foliageColor2}
              roughness={0.65}
              transmission={0.05}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function ProceduralFlower({ plant }: { plant: PlantDef }) {
  const ref = useRef<THREE.Group>(null);
  useWind(ref, 1.6, 0.05);

  const stems = useMemo(() => Array.from({ length: 5 }, () => ({
    x: (Math.random() - 0.5) * 0.5,
    z: (Math.random() - 0.5) * 0.5,
    h: 0.45 + Math.random() * 0.3,
  })), []);

  return (
    <group ref={ref}>
      {stems.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]}>
          <mesh position={[0, s.h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.022, s.h, 6]} />
            <meshStandardMaterial color={plant.foliageColor} roughness={0.9} />
          </mesh>
          <mesh position={[0, s.h + 0.09, 0]}>
            <sphereGeometry args={[0.11, 10, 8]} />
            <meshPhysicalMaterial color={plant.accentColor} emissive={plant.accentColor} emissiveIntensity={0.25} roughness={0.45} />
          </mesh>
          {Array.from({ length: 7 }, (_, pi) => {
            const pa = (pi / 7) * Math.PI * 2;
            return (
              <mesh key={pi} position={[Math.cos(pa) * 0.14, s.h + 0.09, Math.sin(pa) * 0.14]}>
                <sphereGeometry args={[0.062, 7, 5]} />
                <meshPhysicalMaterial color={plant.foliageColor2} roughness={0.5} emissive={plant.foliageColor2} emissiveIntensity={0.1} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function ProceduralBamboo({ plant }: { plant: PlantDef }) {
  const ref = useRef<THREE.Group>(null);
  useWind(ref, 1.0, 0.035);

  const stalks = useMemo(() => Array.from({ length: 6 }, () => ({
    x: (Math.random() - 0.5) * 0.6,
    z: (Math.random() - 0.5) * 0.6,
    h: 1.3 + Math.random() * 0.9,
  })), []);

  return (
    <group ref={ref}>
      {stalks.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]}>
          {Array.from({ length: 6 }, (_, seg) => (
            <mesh key={seg} position={[0, (seg + 0.5) * (s.h / 6), 0]} castShadow>
              <cylinderGeometry args={[0.032, 0.04, s.h / 6, 8]} />
              <meshPhysicalMaterial
                color={seg % 2 === 0 ? plant.trunkColor : plant.foliageColor}
                roughness={0.55}
              />
            </mesh>
          ))}
          {Array.from({ length: 3 }, (_, li) => (
            <mesh key={`l${li}`}
              position={[(li - 1) * 0.14, s.h * 0.82, 0]}
              rotation={[0.45 * (li - 1), li * 1.1, 0]}>
              <boxGeometry args={[0.025, 0.42, 0.1]} />
              <meshPhysicalMaterial color={plant.foliageColor2} roughness={0.75} transmission={0.1} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ─── Route each plant type to the right renderer ─────────────────────────────
function PlantMesh({ plant, scale }: { plant: PlantDef; scale: number }) {
  if (plant.id === "oak" || plant.id === "cherry") {
    return (
      <Suspense fallback={<ProceduralTree plant={plant} />}>
        <GTLFModel url={MODEL_URLS.tree_lime} scale={scale * 0.9} />
      </Suspense>
    );
  }
  if (plant.id === "pine") {
    return (
      <Suspense fallback={<ProceduralTree plant={plant} />}>
        <GTLFModel url={MODEL_URLS.tree_spruce} scale={scale * 0.85} />
      </Suspense>
    );
  }
  if (plant.id === "rose" || plant.id === "hydrangea") {
    return (
      <Suspense fallback={<ProceduralShrub plant={plant} />}>
        <GTLFModel url={MODEL_URLS.flowers} scale={scale * 0.7} />
      </Suspense>
    );
  }
  if (plant.id === "agave") {
    return (
      <Suspense fallback={<ProceduralSucculent plant={plant} />}>
        <GTLFModel url={MODEL_URLS.cactus} scale={scale * 0.6} />
      </Suspense>
    );
  }
  if (plant.id === "lavender" || plant.id === "sunflower") {
    return <ProceduralFlower plant={plant} />;
  }
  if (plant.id === "palm") return <ProceduralPalm plant={plant} />;
  if (plant.id === "fern") return <ProceduralFern plant={plant} />;
  if (plant.id === "bamboo") return <ProceduralBamboo plant={plant} />;
  if (plant.id === "boxwood") return <ProceduralShrub plant={plant} />;
  return <ProceduralShrub plant={plant} />;
}

// ─── Placed plant in scene ────────────────────────────────────────────────────
export function PlacedPlantMesh({ item }: { item: PlacedPlant }) {
  const groupRef = useRef<THREE.Group>(null);
  const activeId = useGardenStore((s) => s.activeId);
  const setActive = useGardenStore((s) => s.setActive);
  const isActive = activeId === item.id;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetY = isActive ? 0.25 : 0;
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * Math.min(delta * 9, 1);
  });

  return (
    <group
      ref={groupRef}
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotation, 0]}
      onClick={(e) => { e.stopPropagation(); setActive(isActive ? null : item.id); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
      <PlantMesh plant={item.plant} scale={item.scale} />

      {isActive && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.62, 40]} />
          <meshBasicMaterial color="#86efac" transparent opacity={0.65} />
        </mesh>
      )}
    </group>
  );
}
