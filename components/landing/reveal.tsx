"use client";

import { useEffect } from "react";

/**
 * Adds .is-visible to every .reveal element as it scrolls into view (once). Also watches the
 * DOM for .reveal elements added later: client-side navigation keeps this component mounted
 * while the page content changes, and filtered catalogs re-render their tiles.
 */
export function RevealOnScroll() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      document.documentElement.classList.add("no-reveal");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    const observe = (root: ParentNode) => root.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)").forEach((el) => io.observe(el));
    observe(document);
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (!(n instanceof HTMLElement)) continue;
          if (n.classList.contains("reveal") && !n.classList.contains("is-visible")) io.observe(n);
          observe(n);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
