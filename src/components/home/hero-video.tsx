"use client";

import { useEffect, useRef, useState } from "react";

export function HeroVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    const fadeWindow = 0.5;

    const step = () => {
      if (!el) return;
      const duration = el.duration || 0;
      const current = el.currentTime || 0;
      if (duration > 0) {
        if (current <= fadeWindow) {
          el.style.opacity = `${Math.max(0, Math.min(1, current / fadeWindow))}`;
        } else if (duration - current <= fadeWindow) {
          const t = (duration - current) / fadeWindow;
          el.style.opacity = `${Math.max(0, Math.min(1, t))}`;
        } else {
          el.style.opacity = "1";
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };

    const onEnded = () => {
      el.style.opacity = "0";
      setTimeout(() => {
        el.currentTime = 0;
        void el.play();
      }, 100);
    };

    const start = async () => {
      try {
        await el.play();
      } catch {
        // ignore autoplay failures
      }
    };

    el.addEventListener("ended", onEnded);
    rafRef.current = requestAnimationFrame(step);
    void start();

    return () => {
      el.removeEventListener("ended", onEnded);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      {!failed ? (
        <video
          ref={ref}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setFailed(true)}
          style={{ opacity: 0 }}
        >
          <source src={src} type="video/mp4" />
        </video>
      ) : (
        <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,#284538_0%,#12231b_45%,#0b1511_100%)]" />
      )}
    </>
  );
}
