"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { OrbitControls } from "@react-three/drei";
import { IndoorScene } from "./indoor-scene";
import { IndoorUI } from "./indoor-ui";
import { IndoorStoreProvider } from "./indoor-store";

function Loader() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0d1a10]">
      <div className="mb-5 text-5xl animate-[bounce_1.4s_ease-in-out_infinite]">🪴</div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-green-400/50"
          style={{ animation: "load 1.6s ease-in-out infinite" }} />
      </div>
      <p className="mt-4 text-sm text-white/35">Setting up your room…</p>
      <style>{`@keyframes load{0%{width:0;margin-left:0}50%{width:55%;margin-left:22%}100%{width:0;margin-left:100%}}`}</style>
    </div>
  );
}

export function GardenBuilder3D() {
  return (
    <IndoorStoreProvider>
      <div className="relative h-full w-full overflow-hidden bg-[#0d1a10]">
        <Suspense fallback={<Loader />}>
          <Canvas
            shadows
            camera={{ position: [4.5, 3.2, 6.5], fov: 55, near: 0.1, far: 100 }}
            gl={{
              antialias: false,
              toneMapping: 4,             // ACESFilmic
              toneMappingExposure: 1.15,
              outputColorSpace: "srgb",
            }}
          >
            <Suspense fallback={null}>
              <IndoorScene />
            </Suspense>
            <OrbitControls
              makeDefault
              enablePan
              panSpeed={0.5}
              minDistance={2.5}
              maxDistance={11}
              minPolarAngle={Math.PI / 8}
              maxPolarAngle={Math.PI / 2.05}
              target={[0, 1.2, 0]}
            />
          </Canvas>
        </Suspense>
        <IndoorUI />
      </div>
    </IndoorStoreProvider>
  );
}
