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
 * GSAP timeline: the logo sharpens in, the line under it fills, then the white sheet lifts and a black sheet chases it off the top of the screen.
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
      gsap
        .timeline({ defaults: { ease: "power3.out" }, onComplete: () => setDone(true) })
        .to(".splash-logo", { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.9 }, 0.1)
        .to(".splash-meter", { opacity: 1, duration: 0.4 }, 0.3)
        .to(".splash-bar", { scaleX: 1, duration: 1.6, ease: "power2.inOut" }, 0.3)
        .to(".splash-logo", { y: -12, duration: 0.5, ease: "power2.in" }, 1.75)
        .to(".splash-meter", { opacity: 0, duration: 0.3 }, 1.9)
        .to(".splash-white", { yPercent: -100, duration: 0.65, ease: "power4.inOut" }, 2.05)
        .to(".splash-black", { yPercent: -100, duration: 0.65, ease: "power4.inOut" }, 2.2);
    },
    { scope: root }
  );

  if (done) return null;
  return (
    <div ref={root} aria-hidden className="splash fixed inset-0 z-50">
      <div className="splash-black absolute inset-0 bg-zinc-950" />
      <div className="splash-white absolute inset-0 flex flex-col items-center justify-center bg-white">
        <img src="/landing/logo.png" alt="" className="splash-logo w-64 scale-90 opacity-0 blur-lg sm:w-96" />
        <div className="splash-meter mt-10 h-0.5 w-40 overflow-hidden bg-zinc-200 opacity-0">
          <div className="splash-bar h-full w-full origin-left scale-x-0 bg-zinc-950" />
        </div>
      </div>
    </div>
  );
}
