"use client";

/* eslint-disable @next/next/no-img-element -- static logo, no resizing needed */
import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Logo loader shown on every full page load of the public site. Rendered on the server so
 * it is on screen from the first paint; client-side navigation keeps the layout mounted, so
 * moving between pages does not replay it.
 *
 * GSAP timeline: a counter runs 0 → 100 while the logo fills in from left to right over a
 * faint ghost of itself; then the white sheet lifts and a black sheet chases it off the top.
 */
export function Splash() {
  const [done, setDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setDone(true);
        return;
      }
      const count = root.current!.querySelector<HTMLElement>(".splash-count")!;
      const fill = root.current!.querySelector<HTMLElement>(".splash-fill")!;
      const progress = { v: 0 };
      gsap
        .timeline({ defaults: { ease: "power3.out" }, onComplete: () => setDone(true) })
        .to(".splash-ghost", { opacity: 0.12, duration: 0.5 }, 0)
        .to(".splash-label", { opacity: 1, duration: 0.5 }, 0)
        .to(
          progress,
          {
            v: 100,
            duration: 1.8,
            ease: "power2.inOut",
            onUpdate() {
              count.textContent = String(Math.round(progress.v));
              fill.style.clipPath = `inset(0 ${100 - progress.v}% 0 0)`;
            },
          },
          0.2
        )
        .fromTo(".splash-logo", { scale: 1 }, { scale: 1.04, duration: 0.25, yoyo: true, repeat: 1, ease: "power1.inOut" }, 2.0)
        .to(".splash-white", { yPercent: -100, duration: 0.65, ease: "power4.inOut" }, 2.45)
        .to(".splash-black", { yPercent: -100, duration: 0.65, ease: "power4.inOut" }, 2.6);
    },
    { scope: root }
  );

  if (done) return null;
  return (
    <div ref={root} aria-hidden className="splash fixed inset-0 z-50">
      <div className="splash-black absolute inset-0 bg-zinc-950" />
      <div className="splash-white absolute inset-0 flex items-center justify-center bg-white">
        <div className="splash-logo relative w-64 sm:w-96">
          <img src="/landing/logo.png" alt="" className="splash-ghost w-full opacity-0" />
          <img src="/landing/logo.png" alt="" className="splash-fill absolute inset-0 w-full" style={{ clipPath: "inset(0 100% 0 0)" }} />
        </div>
        <div className="splash-label absolute top-6 left-5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 opacity-0 sm:top-8 sm:left-8">
          Loading
        </div>
        <div className="absolute bottom-6 left-5 flex items-baseline font-display leading-none sm:bottom-8 sm:left-8">
          <span className="splash-count text-7xl tabular-nums sm:text-9xl">0</span>
          <span className="ml-1 text-2xl text-zinc-400 sm:text-4xl">%</span>
        </div>
      </div>
    </div>
  );
}
