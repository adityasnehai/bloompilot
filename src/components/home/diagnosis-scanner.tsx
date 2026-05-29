"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type DiagnosisScannerProps = {
  infectedSrc: string;
  healthySrc: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function DiagnosisScanner({
  infectedSrc,
  healthySrc,
}: DiagnosisScannerProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    let start = 0;
    const duration = 3600;

    const tick = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = (timestamp - start) % duration;
      setProgress(elapsed / duration);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const revealProgress = useMemo(() => clamp(progress, 0, 1), [progress]);

  const clipPath = useMemo(() => {
    const rightPct = clamp((1 - revealProgress) * 100, 0, 100);
    return `inset(0 ${rightPct}% 0 0)`;
  }, [revealProgress]);

  const scannerLeft = `${revealProgress * 100}%`;

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
      <Image
        src={infectedSrc}
        alt="Infected plant before diagnosis"
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover"
      />

      <div className="absolute inset-0 overflow-hidden" style={{ clipPath }}>
        <Image
          src={healthySrc}
          alt="Healthy plant revealed by diagnosis scan"
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,28,18,0.04)_0%,rgba(16,28,18,0.14)_100%)]" />

      <div
        className="pointer-events-none absolute inset-y-0 w-[0.9%] min-w-[4px] mix-blend-screen"
        style={{
          left: `calc(${scannerLeft} - max(2px, 0.45%))`,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(196,255,167,0.42) 35%, rgba(222,255,202,0.92) 50%, rgba(196,255,167,0.42) 65%, rgba(255,255,255,0) 100%)",
          boxShadow: "0 0 10px rgba(196,255,167,0.48)",
          opacity: revealProgress > 0.02 && revealProgress < 0.995 ? 1 : 0,
        }}
      />

      <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,rgba(16,28,18,0)_0%,rgba(16,28,18,0.24)_100%)]" />
    </div>
  );
}
