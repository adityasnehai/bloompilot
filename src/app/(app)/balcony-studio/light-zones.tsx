"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { getZoneSplit, ZONE_META } from "./studio-store";
import { B, HALF_D } from "./balcony-geometry";

function ZonePlane({
  color,
  z,
  depth,
  opacity,
}: {
  color: string;
  z: number;
  depth: number;
  opacity: number;
}) {
  if (depth < 0.05) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, z]}>
      <planeGeometry args={[B.w - 0.08, depth]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ZoneLabel({
  label,
  emoji,
  color,
  z,
}: {
  label: string;
  emoji: string;
  color: string;
  z: number;
}) {
  const texture = useMemo(() => {
    const W = 240, H = 52;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;

    // Pill background
    ctx.fillStyle = `${color}cc`;
    const r = 12;
    ctx.beginPath();
    ctx.moveTo(r, 4); ctx.lineTo(W - r, 4);
    ctx.arcTo(W - 4, 4, W - 4, r + 4, r);
    ctx.lineTo(W - 4, H - r - 4);
    ctx.arcTo(W - 4, H - 4, W - r - 4, H - 4, r);
    ctx.lineTo(r + 4, H - 4);
    ctx.arcTo(4, H - 4, 4, H - r - 4, r);
    ctx.lineTo(4, r + 4);
    ctx.arcTo(4, 4, r + 4, 4, r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
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

// ── Main export ───────────────────────────────────────────────────────────────
export function LightZones({ sunHour, visible }: { sunHour: number; visible: boolean }) {
  if (!visible) return null;

  const { fullFrac, partialFrac } = getZoneSplit(sunHour);

  // Convert fractions to actual z positions and depths
  // Balcony: front z=+HALF_D, back z=-HALF_D, total depth = B.d
  // fromFront=0 → z=+HALF_D, fromFront=1 → z=-HALF_D

  const fullDepth    = fullFrac * B.d;
  const partialDepth = (partialFrac - fullFrac) * B.d;
  const shadeDepth   = (1 - partialFrac) * B.d;

  const fullZ    = HALF_D - fullDepth / 2;
  const partialZ = HALF_D - fullDepth - partialDepth / 2;
  const shadeZ   = -HALF_D + shadeDepth / 2;

  const { full_sun, partial_shade, shade } = ZONE_META;

  return (
    <group>
      <ZonePlane color={full_sun.color}      z={fullZ}    depth={fullDepth}    opacity={0.22} />
      <ZonePlane color={partial_shade.color} z={partialZ} depth={partialDepth} opacity={0.18} />
      <ZonePlane color={shade.color}         z={shadeZ}   depth={shadeDepth}   opacity={0.22} />

      {/* Labels — only show if zone is wide enough */}
      {fullDepth > 0.8 && (
        <ZoneLabel label={full_sun.label} emoji={full_sun.emoji} color={full_sun.color} z={fullZ} />
      )}
      {partialDepth > 0.8 && (
        <ZoneLabel label={partial_shade.label} emoji={partial_shade.emoji} color={partial_shade.color} z={partialZ} />
      )}
      {shadeDepth > 0.8 && (
        <ZoneLabel label={shade.label} emoji={shade.emoji} color={shade.color} z={shadeZ} />
      )}
    </group>
  );
}
