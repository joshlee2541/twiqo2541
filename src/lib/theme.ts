export type ThemeMode = "light" | "dark" | "system";

const KEY = "theme";

export function getThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const v = localStorage.getItem(KEY);
  if (v === "dark" || v === "light" || v === "system") return v;
  return "dark";
}

function prefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  return mode === "system" ? (prefersDark() ? "dark" : "light") : mode;
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveTheme(mode) === "dark");
}

export function setThemeMode(mode: ThemeMode) {
  localStorage.setItem(KEY, mode);
  applyTheme(mode);
}

/** Applies the saved theme and keeps "system" in sync with the OS. Returns a cleanup fn. */
export function initTheme(): () => void {
  if (typeof window === "undefined") return () => {};
  applyTheme(getThemeMode());
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (getThemeMode() === "system") applyTheme("system");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
