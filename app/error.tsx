"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BRAND } from "@/lib/brand";

/**
 * Catches any page error below the root layout, so the layout (and the theme script in
 * its <head>) stays mounted instead of React rebuilding the whole tree on the client.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="theme-zone flex min-h-screen items-center justify-center bg-zinc-50 p-6 text-zinc-900">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <div className="text-xs font-bold tracking-wider text-brand-700 uppercase">{BRAND.name}</div>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm font-medium text-zinc-500">
          The page couldn&apos;t load. This is usually temporary — please try again in a moment.
        </p>
        {error.digest && <p className="mt-2 text-[11px] font-medium text-zinc-400">Reference: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="h-10 rounded-lg bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800"
          >
            Try again
          </button>
          <Link href="/" className="flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-bold hover:bg-zinc-50">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
