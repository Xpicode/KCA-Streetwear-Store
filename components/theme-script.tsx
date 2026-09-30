"use client";

import { useSyncExternalStore } from "react";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const subscribe = () => () => {};

/**
 * Inline script that sets the .dark class before first paint (see lib/theme.ts).
 *
 * Rendered on the server only: during hydration React sees the server snapshot ("server") so
 * the markup matches, then switches to "client" and simply removes the tag — it has already
 * run. If React ever has to render the whole document on the client (a page crashed before
 * the shell was sent), the tag is never created, so React does not complain about client-
 * rendered <script> elements, and the page keeps its proper 404 / redirect status codes.
 */
export function ThemeScript({ nonce }: { nonce?: string }) {
  const phase = useSyncExternalStore(subscribe, () => "client", () => "server");
  if (phase === "client") return null;
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
