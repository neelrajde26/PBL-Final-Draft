"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export type Load<T> = { data: T | null; error: boolean };

/** Fetch keyed by `key`; results for an older key are never shown, so no reset-in-effect is needed. */
export function useLoad<T>(key: string, fn: (s: AbortSignal) => Promise<T>): Load<T> {
  const [state, setState] = useState<{ key: string; data: T | null; error: boolean } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fn(ctrl.signal)
      .then((data) => setState({ key, data, error: false }))
      .catch(() => !ctrl.signal.aborted && setState({ key, data: null, error: true }));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state?.key === key ? { data: state.data, error: state.error } : { data: null, error: false };
}

const DISTRICT_KEY = "mdis_district";
const EVENT = "mdis-district";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}
function read(): string | null {
  try {
    return localStorage.getItem(DISTRICT_KEY);
  } catch {
    return null;
  }
}

/** Last district the user picked, shared across pages and tabs. */
export function useStoredDistrict(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function storeDistrict(id: string) {
  try {
    localStorage.setItem(DISTRICT_KEY, id);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}
