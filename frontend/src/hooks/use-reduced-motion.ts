import { useSyncExternalStore } from "react";
import { useSettingsStore } from "@/lib/settings-store";

const preference = window.matchMedia("(prefers-reduced-motion: reduce)");

function subscribe(listener: () => void) {
  preference.addEventListener("change", listener);
  return () => preference.removeEventListener("change", listener);
}

const getSnapshot = () => preference.matches;

export function useReducedMotion(): boolean {
  const appPreference = useSettingsStore((state) => state.settings.reducedMotion);
  const systemPreference = useSyncExternalStore(subscribe, getSnapshot);
  return appPreference || systemPreference;
}
