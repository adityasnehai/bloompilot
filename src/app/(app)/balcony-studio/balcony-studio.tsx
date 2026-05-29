"use client";

import { Suspense, lazy } from "react";
import { StudioStoreProvider } from "./studio-store";
import { PlantPanel } from "./plant-panel";
import { StudioHeader, StudioFooter } from "./studio-hud";

const BalconyCanvas = lazy(() =>
  import("./balcony-scene").then((m) => ({ default: m.BalconyCanvas })),
);

function Loader() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0d1820]">
      <div className="mb-6 text-5xl animate-[bounce_1.4s_ease-in-out_infinite]">🌿</div>
      <div className="h-0.5 w-44 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-green-400/60"
          style={{ animation: "load 1.8s ease-in-out infinite" }}
        />
      </div>
      <p className="mt-5 text-sm text-white/35">Building your balcony…</p>
      <style>{`
        @keyframes load {
          0%   { width: 0; margin-left: 0 }
          50%  { width: 55%; margin-left: 22% }
          100% { width: 0; margin-left: 100% }
        }
        .sun-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          background: rgba(255,255,255,0.12);
          border-radius: 4px;
          outline: none;
          cursor: pointer;
        }
        .sun-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          background: #fef3c7;
          border: 2px solid #f97316;
          border-radius: 50%;
          cursor: grab;
          box-shadow: 0 0 8px 2px #fbbf2455;
          position: relative;
          z-index: 2;
        }
        .sun-slider::-webkit-slider-thumb:active {
          cursor: grabbing;
          box-shadow: 0 0 14px 4px #fbbf2466;
        }
        .sun-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          background: #fef3c7;
          border: 2px solid #f97316;
          border-radius: 50%;
          cursor: grab;
          box-shadow: 0 0 8px 2px #fbbf2455;
        }
      `}</style>
    </div>
  );
}

export function BalconyStudio() {
  return (
    <StudioStoreProvider>
      <div className="fixed inset-0 z-50 flex flex-col bg-[#0d1820]">
        <StudioHeader />

        {/* Main content: panel + canvas */}
        <div className="flex flex-1 min-h-0">
          {/* Left panel */}
          <div className="h-full overflow-y-auto border-r border-white/8 bg-[rgba(13,24,32,0.85)] backdrop-blur-sm">
            <PlantPanel />
          </div>

          {/* 3D canvas */}
          <div className="relative flex-1">
            <Suspense fallback={<Loader />}>
              <BalconyCanvas />
            </Suspense>

            {/* Corner hint */}
            <div className="pointer-events-none absolute bottom-4 right-4 rounded-xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-sm">
              <p className="text-xs text-white/40">
                Scroll to zoom · Drag to orbit
              </p>
            </div>
          </div>
        </div>

        <StudioFooter />
      </div>
    </StudioStoreProvider>
  );
}
