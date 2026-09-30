"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

/** Horizontal scroll-snap strip with prev/next arrows. Children are the <li> cards. */
export function Carousel({ heading, link, children }: { heading: ReactNode; link: { href: string; label: string }; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const go = (dir: -1 | 1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  const arrow = "flex size-11 items-center justify-center rounded-full border border-stone-300 transition hover:border-stone-900 disabled:cursor-default disabled:opacity-30 disabled:hover:border-stone-300";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        {heading}
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous" onClick={() => go(-1)} disabled={edge.start} className={arrow}>
            <ArrowLeft className="size-4" />
          </button>
          <button type="button" aria-label="Next" onClick={() => go(1)} disabled={edge.end} className={arrow}>
            <ArrowRight className="size-4" />
          </button>
          <Link href={link.href} className="ml-3 text-[11px] font-semibold uppercase tracking-[0.22em] underline underline-offset-4 hover:no-underline">
            {link.label}
          </Link>
        </div>
      </div>
      <ul
        ref={ref}
        className="-mx-6 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
    </>
  );
}
