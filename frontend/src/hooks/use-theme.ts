import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem("gitplus_theme") || localStorage.getItem("theme");
    return saved === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

let currentTheme = readTheme();
const listeners = new Set<() => void>();

function applyTheme(theme: Theme) {
  document.documentElement.classList.remove(theme === "dark" ? "light" : "dark");
  document.documentElement.classList.add(theme);
}

function publishTheme(theme: Theme) {
  applyTheme(theme);
  if (currentTheme === theme) return;
  currentTheme = theme;
  listeners.forEach((listener) => listener());
}

function handleStorage(event: StorageEvent) {
  if (event.key === null || event.key === "gitplus_theme" || event.key === "theme") {
    publishTheme(readTheme());
  }
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    setTheme(readTheme());
    window.addEventListener("storage", handleStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", handleStorage);
  };
}

function setTheme(theme: Theme) {
  try {
    localStorage.setItem("gitplus_theme", theme);
    localStorage.setItem("theme", theme);
  } catch {
    // The current tab can still switch themes when browser storage is unavailable.
  }
  publishTheme(theme);
}

function toggleTheme() {
  setTheme(currentTheme === "dark" ? "light" : "dark");
}

const getSnapshot = () => currentTheme;

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot);
  return { theme, toggleTheme, setTheme };
}

