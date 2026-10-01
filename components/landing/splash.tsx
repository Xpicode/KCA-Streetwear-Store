"use client";

/* eslint-disable @next/next/no-img-element -- static logo, no resizing needed */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const KEY = "kca-splash";
const subscribe = () => () => {};
// decided once per page load, before the effect below marks the splash as seen
let decision: "show" | "skip" | null = null;
const getSnapshot = () => {
  if (decision === null) {
    try {
      decision = sessionStorage.getItem(KEY) === "1" ? "skip" : "show";
    } catch {
      decision = "show";
    }
  }
  return decision;
};

/**
 * Logo curtain shown on the first load of the site in a browser session. Rendered on the
 * server so it is on screen from the first paint; later reloads in the same tab skip it.
 * The sequence is a GSAP timeline: logo sharpens in, a line fills, the white sheet lifts
 * and a black sheet chases it off the top of the screen.
 */
export function Splash() {
  const phase = useSyncExternalStore(subscribe, getSnapshot, () => "show");
  const [done, setDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {}
  }, []);

  useGSAP(
    () => {
      if (phase === "skip") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setDone(true);
        return;
      }
      gsap
        .timeline({ defaults: { ease: "power3.out" }, onComplete: () => setDone(true) })
        .to(".splash-logo", { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.9 }, 0.1)
        .to(".splash-bar", { scaleX: 1, duration: 1.2, ease: "power2.inOut" }, 0.3)
        .to(".splash-logo", { y: -12, duration: 0.5, ease: "power2.in" }, 1.35)
        .to(".splash-white", { yPercent: -100, duration: 0.65, ease: "power4.inOut" }, 1.6)
        .to(".splash-black", { yPercent: -100, duration: 0.65, ease: "power4.inOut" }, 1.75);
    },
    { scope: root, dependencies: [phase] }
  );

  if (phase === "skip" || done) return null;
  return (
    <div ref={root} aria-hidden className="splash fixed inset-0 z-50">
      <div className="splash-black absolute inset-0 bg-zinc-950" />
      <div className="splash-white absolute inset-0 flex flex-col items-center justify-center bg-white">
        <img src="/landing/logo.png" alt="" className="splash-logo w-64 scale-90 opacity-0 blur-lg sm:w-96" />
        <div className="mt-10 h-0.5 w-40 overflow-hidden bg-zinc-200">
          <div className="splash-bar h-full w-full origin-left scale-x-0 bg-zinc-950" />
        </div>
      </div>
    </div>
  );
}
