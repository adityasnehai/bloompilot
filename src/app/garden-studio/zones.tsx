"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { getZoneSplit, GARDEN_DIMS, ZONE_META, type GardenTypeStudio } from "./store";

function ZonePlane({ color, width, z, depth, opacity, variant }: { color: string; width: number; z: number; depth: number; opacity: number; variant: "sun" | "filtered" | "shade" }) {
  if (depth < 0.05) return null;
  return (
    <group position={[0, 0.008, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 0.08, depth]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {variant === "sun" && [0.22, 0.5, 0.78].map((fraction) => (
        <mesh key={fraction} position={[(width - 0.5) * (fraction - 0.5), 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.018, Math.max(0.2, depth - 0.15)]} />
          <meshBasicMaterial color="#fff1bd" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      ))}
      {variant === "filtered" && [0.25, 0.5, 0.75].map((fraction) => (
        <mesh key={fraction} position={[(width - 0.5) * (fraction - 0.5), 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.014, Math.max(0.2, depth - 0.18)]} />
          <meshBasicMaterial color="#d7edf3" transparent opacity={0.24} depthWrite={false} />
        </mesh>
      ))}
      {variant === "shade" && [-0.38, 0, 0.38].map((x) => (
        <mesh key={x} position={[x * Math.min(width, 4), 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.09, 0.12, 8]} />
          <meshBasicMaterial color="#d9d2f0" transparent opacity={0.25} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function ZoneLabel({ label, emoji, color, z }: { label: string; emoji: string; color: string; z: number }) {
  const texture = useMemo(() => {
    const W = 240, H = 52;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = `${color}cc`;
    const r = 12;
    ctx.beginPath();
    ctx.moveTo(r, 4); ctx.lineTo(W - r, 4); ctx.arcTo(W - 4, 4, W - 4, r + 4, r);
    ctx.lineTo(W - 4, H - r - 4); ctx.arcTo(W - 4, H - 4, W - r - 4, H - 4, r);
    ctx.lineTo(r + 4, H - 4); ctx.arcTo(4, H - 4, 4, H - r - 4, r);
    ctx.lineTo(4, r + 4); ctx.arcTo(4, 4, r + 4, 4, r);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`${emoji} ${label}`, W / 2, H / 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [label, emoji, color]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, z]}>
      <planeGeometry args={[1.6, 0.34]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

export function LightZones({ gardenType, sunHour, visible }: { gardenType: GardenTypeStudio; sunHour: number; visible: boolean }) {
  if (!visible) return null;
  const { halfW, halfD } = GARDEN_DIMS[gardenType];
  const gardenWidth = halfW * 2;
  const { fullFrac, partialFrac } = getZoneSplit(sunHour);
  const fullDepth    = fullFrac * halfD * 2;
  const partialDepth = (partialFrac - fullFrac) * halfD * 2;
  const shadeDepth   = (1 - partialFrac) * halfD * 2;
  const lightSide = gardenType === "indoor" ? -1 : 1;
  const fullZ    = lightSide * (halfD - fullDepth / 2);
  const partialZ = lightSide * (halfD - fullDepth - partialDepth / 2);
  const shadeZ   = lightSide * (-halfD + shadeDepth / 2);
  const { full_sun, partial_shade, shade } = ZONE_META;
  return (
    <group>
      <ZonePlane color={full_sun.color}      width={gardenWidth} z={fullZ}    depth={fullDepth}    opacity={0.22} variant="sun" />
      <ZonePlane color={partial_shade.color} width={gardenWidth} z={partialZ} depth={partialDepth} opacity={0.18} variant="filtered" />
      <ZonePlane color={shade.color}         width={gardenWidth} z={shadeZ}   depth={shadeDepth}   opacity={0.22} variant="shade" />
      {fullDepth > 0.8 && <ZoneLabel label={full_sun.label}      emoji={full_sun.emoji}      color={full_sun.color}      z={fullZ} />}
      {partialDepth > 0.8 && <ZoneLabel label={partial_shade.label} emoji={partial_shade.emoji} color={partial_shade.color} z={partialZ} />}
      {shadeDepth > 0.8 && <ZoneLabel label={shade.label}        emoji={shade.emoji}        color={shade.color}        z={shadeZ} />}
    </group>
  );
}
