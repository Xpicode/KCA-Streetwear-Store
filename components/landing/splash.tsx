"use client";

/* eslint-disable @next/next/no-img-element -- static logo, no resizing needed */
import { useEffect, useState, useSyncExternalStore } from "react";

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
 * Logo curtain shown on the first load of the site in a browser session (see .splash in
 * globals.css). Rendered on the server so it is on screen from the first paint; later
 * reloads in the same tab skip it.
 */
export function Splash() {
  const phase = useSyncExternalStore(subscribe, getSnapshot, () => "show");
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {}
  }, []);

  if (phase === "skip" || done) return null;
  return (
    <div
      aria-hidden
      className="splash fixed inset-0 z-50 flex items-center justify-center bg-white"
      onAnimationEnd={(e) => e.target === e.currentTarget && setDone(true)}
    >
      <img src="/landing/logo.png" alt="" className="splash-logo w-64 sm:w-96" />
    </div>
  );
}
