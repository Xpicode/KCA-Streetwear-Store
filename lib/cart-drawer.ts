"use client";

import { useSyncExternalStore } from "react";

/** Open/closed state of the slide-in cart, shared by the header button, the drawer and "add to cart" buttons. */
let isOpen = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const cartDrawer = {
  open() {
    isOpen = true;
    emit();
  },
  close() {
    isOpen = false;
    emit();
  },
  toggle() {
    isOpen = !isOpen;
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  get: () => isOpen,
};

export function useCartDrawer() {
  return useSyncExternalStore(cartDrawer.subscribe, cartDrawer.get, () => false);
}
