"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { IndoorPlant, PlacedIndoorPlant } from "./indoor-store";
import { useIndoorStore } from "./indoor-store";

function useWind(ref: React.RefObject<THREE.Group | null>, speed = 0.8, str = 0.015) {
  const phase = useMemo(() => Math.random() * 100, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * speed + phase;
    ref.current.rotation.z = Math.sin(t) * str;
    ref.current.rotation.x = Math.sin(t * 0.6) * str * 0.4;
  });
}

// ─── Pot ──────────────────────────────────────────────────────────────────────
function Pot({ color, r = 0.18, h = 0.22 }: { color: string; r?: number; h?: number }) {
  return (
    <group>
      {/* pot body */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r * 0.88, r, h, 16]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      {/* soil */}
      <mesh position={[0, h + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r * 0.85, 16]} />
        <meshStandardMaterial color="#2a1a0a" roughness={1} />
      </mesh>
      {/* saucer */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[r * 1.15, 16]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  );
}

// ─── Tall upright plant (fiddle leaf, bird of paradise) ───────────────────────
function TallPlant({ plant }: { plant: IndoorPlant }) {
  const ref = useRef<THREE.Group>(null);
  useWind(ref, 0.4, 0.01);
  const h = plant.height;

  return (
    <group>
      <Pot color={plant.potColor} r={0.2} h={0.26} />
      <group ref={ref}>
        {/* trunk */}
        <mesh position={[0, 0.26 + h * 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.04, h * 0.8, 8]} />
          <meshStandardMaterial color={plant.trunkColor} roughness={0.9} />
        </mesh>
        {/* large paddle leaves */}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const layerY = 0.26 + h * 0.5 + (i * h * 0.06);
          const lean = 0.4 + (i % 3) * 0.15;
          return (
            <group key={i} position={[0, layerY, 0]} rotation={[lean, a, 0]}>
                <mesh position={[0, 0.22, 0]} castShadow>
                <boxGeometry args={[0.28, 0.38, 0.015]} />
                <meshPhysicalMaterial
                  color={i % 2 === 0 ? plant.foliageColor : plant.foliageColor2}
                  roughness={0.7} transmission={0.12} side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

// ─── Bushy plant (monstera, peace lily) ──────────────────────────────────────
function BushyPlant({ plant }: { plant: IndoorPlant }) {
  const ref = useRef<THREE.Group>(null);
  useWind(ref, 0.6, 0.018);

  const leaves = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    angle: (i / 10) * Math.PI * 2 + Math.random() * 0.3,
    lean: 0.5 + Math.random() * 0.5,
    h: 0.28 + Math.random() * plant.height * 0.5,
    w: 0.15 + Math.random() * 0.12,
    l: 0.22 + Math.random() * 0.18,
  })), [plant.height]);

  return (
    <group>
      <Pot color={plant.potColor} r={0.18} h={0.22} />
      <group ref={ref} position={[0, 0.22, 0]}>
        {leaves.map((lf, i) => (
          <group key={i} rotation={[lf.lean, lf.angle, 0]}>
            {/* stem */}
            <mesh position={[0, lf.h * 0.45, 0]} castShadow>
              <cylinderGeometry args={[0.012, 0.018, lf.h * 0.9, 6]} />
              <meshStandardMaterial color={plant.trunkColor} roughness={0.9} />
            </mesh>
            {/* leaf */}
            <mesh position={[0, lf.h, 0]} castShadow>
              <boxGeometry args={[lf.w, lf.l, 0.012]} />
              <meshPhysicalMaterial
                color={i % 2 === 0 ? plant.foliageColor : plant.foliageColor2}
                roughness={0.72} transmission={0.1} side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

// ─── Upright architectural (snake plant, ZZ) ─────────────────────────────────
function UprightPlant({ plant }: { plant: IndoorPlant }) {
  const ref = useRef<THREE.Group>(null);
  useWind(ref, 0.3, 0.008);

  return (
    <group>
      <Pot color={plant.potColor} r={0.14} h={0.18} />
      <group ref={ref} position={[0, 0.18, 0]}>
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2 + 0.2;
          const tilt = 0.1 + (i % 3) * 0.08;
          const h = plant.height * (0.6 + Math.random() * 0.5);
          return (
            <group key={i} rotation={[tilt, a, 0]}>
              <mesh position={[0, h / 2, 0]} castShadow>
                <boxGeometry args={[0.055, h, 0.018]} />
                <meshPhysicalMaterial
                  color={i % 2 === 0 ? plant.foliageColor : plant.foliageColor2}
                  roughness={0.65} transmission={0.08} side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

// ─── Trailing / hanging plant ─────────────────────────────────────────────────
function TrailingPlant({ plant, hanging }: { plant: IndoorPlant; hanging: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useWind(ref, 1.0, 0.025);

  const vines = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    angle: (i / 8) * Math.PI * 2,
    len: 0.25 + Math.random() * (hanging ? 0.5 : 0.3),
    nodes: 5 + Math.floor(Math.random() * 4),
  })), [hanging]);

  return (
    <group>
      {!hanging && <Pot color={plant.potColor} r={0.12} h={0.14} />}
      <group ref={ref} position={[0, hanging ? 0 : 0.14, 0]}>
        {vines.map((v, vi) => (
          <group key={vi} rotation={[0, v.angle, 0]}>
            {Array.from({ length: v.nodes }, (_, ni) => {
              const t = (ni + 1) / v.nodes;
              const x = Math.sin(t * 1.2) * v.len * 0.7;
              const y = hanging ? -t * v.len : Math.sin(t * 0.8) * 0.12;
              const z = Math.cos(t * 1.5) * v.len * 0.3;
              return (
                <mesh key={ni} position={[x, y, z]}>
                  <sphereGeometry args={[0.045 + Math.random() * 0.025, 8, 6]} />
                  <meshPhysicalMaterial
                    color={ni % 2 === 0 ? plant.foliageColor : plant.foliageColor2}
                    roughness={0.7} transmission={0.08}
                  />
                </mesh>
              );
            })}
          </group>
        ))}
      </group>
    </group>
  );
}

// ─── Succulent rosette ────────────────────────────────────────────────────────
function SucculentPlant({ plant }: { plant: IndoorPlant }) {
  return (
    <group>
      <Pot color={plant.potColor} r={0.1} h={0.12} />
      <group position={[0, 0.12, 0]}>
        {Array.from({ length: 16 }, (_, i) => {
          const layer = Math.floor(i / 5);
          const idx = i % 5;
          const a = (idx / 5) * Math.PI * 2 + layer * 0.62;
          const r = 0.04 + layer * 0.04;
          const tilt = 0.4 + layer * 0.22;
          return (
            <mesh key={i} position={[Math.cos(a) * r, layer * 0.03, Math.sin(a) * r]}
              rotation={[tilt, 0, a + Math.PI / 2]} castShadow>
              <coneGeometry args={[0.042, 0.1, 5]} />
              <meshPhysicalMaterial
                color={i % 2 === 0 ? plant.foliageColor : plant.foliageColor2}
                roughness={0.6}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ─── Herb cluster ─────────────────────────────────────────────────────────────
function HerbPlant({ plant }: { plant: IndoorPlant }) {
  const ref = useRef<THREE.Group>(null);
  useWind(ref, 1.4, 0.03);

  return (
    <group>
      <Pot color={plant.potColor} r={0.12} h={0.14} />
      <group ref={ref} position={[0, 0.14, 0]}>
        {Array.from({ length: 18 }, (_, i) => {
          const a = (i / 18) * Math.PI * 2;
          const r = 0.03 + Math.random() * 0.08;
          const h = 0.08 + Math.random() * 0.14;
          return (
            <mesh key={i} position={[Math.cos(a) * r, h / 2, Math.sin(a) * r]} castShadow>
              <cylinderGeometry args={[0.015, 0.012, h, 5]} />
              <meshPhysicalMaterial color={plant.foliageColor} roughness={0.85} transmission={0.06} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ─── Hanging string ───────────────────────────────────────────────────────────
function HangingString({ y }: { y: number }) {
  return (
    <mesh position={[0, y / 2, 0]} castShadow>
      <cylinderGeometry args={[0.006, 0.006, Math.abs(y), 4]} />
      <meshStandardMaterial color="#8a7060" roughness={0.9} />
    </mesh>
  );
}

// ─── Plant dispatcher ─────────────────────────────────────────────────────────
function PlantMesh({ plant, isHanging }: { plant: IndoorPlant; isHanging: boolean }) {
  if (plant.plantType === "tall") return <TallPlant plant={plant} />;
  if (plant.plantType === "upright") return <UprightPlant plant={plant} />;
  if (plant.plantType === "trailing") return <TrailingPlant plant={plant} hanging={isHanging} />;
  if (plant.plantType === "succulent") return <SucculentPlant plant={plant} />;
  if (plant.id === "herbs") return <HerbPlant plant={plant} />;
  return <BushyPlant plant={plant} />;
}

// ─── Placed plant wrapper ─────────────────────────────────────────────────────
export function PlacedIndoorPlantMesh({ item }: { item: PlacedIndoorPlant }) {
  const ref = useRef<THREE.Group>(null);
  const activeId = useIndoorStore((s) => s.activeId);
  const setActive = useIndoorStore((s) => s.setActive);
  const isActive = activeId === item.id;
  const isHanging = item.zone.type === "hanging";

  useFrame((_, delta) => {
    if (!ref.current) return;
    const targetY = isActive ? (isHanging ? item.zone.y + 0.1 : item.zone.y + 0.08) : item.zone.y;
    ref.current.position.y += (targetY - ref.current.position.y) * Math.min(delta * 8, 1);
  });

  return (
    <group
      ref={ref}
      position={[item.zone.x, item.zone.y, item.zone.z]}
      rotation={[0, item.rotation, 0]}
      onClick={(e) => { e.stopPropagation(); setActive(isActive ? null : item.id); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
    >
      {isHanging && <HangingString y={-0.35} />}
      <PlantMesh plant={item.plant} isHanging={isHanging} />

      {isActive && (
        <mesh position={[0, isHanging ? -0.6 : 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.3, 32]} />
          <meshBasicMaterial color="#86efac" transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  );
}
