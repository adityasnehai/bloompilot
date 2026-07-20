"use client";

import * as THREE from "three";
import type { PlacedPlant } from "./store";
import { getCareScore } from "./store";

function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return new THREE.Color().lerpColors(a, b, t);
}

function wateringColor(t: number): THREE.Color {
  const quiet = new THREE.Color("#5c83a1");
  const active = new THREE.Color("#d89a62");
  return lerpColor(quiet, active, Math.max(0, Math.min(1, t)));
}

function WateringDisc({ plant }: { plant: PlacedPlant }) {
  const score    = getCareScore(plant);
  const color    = wateringColor(score);
  const radius   = 0.55 + score * 0.65;
  const baseOpacity = 0.28 + score * 0.22;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[plant.x, 0.006, plant.z]}>
        <ringGeometry args={[radius * 0.7, radius, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={baseOpacity * 0.4}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[plant.x, 0.007, plant.z]}>
        <circleGeometry args={[radius * 0.7, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={baseOpacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function WateringEffortMap({ plants, visible }: { plants: PlacedPlant[]; visible: boolean }) {
  if (!visible || plants.length === 0) return null;
  return (
    <group>
      {plants.map((plant) => (
        <WateringDisc key={plant.id} plant={plant} />
      ))}
    </group>
  );
}
