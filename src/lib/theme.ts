export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "botsbots:theme";
const CHANGE_EVENT = "botsbots:theme-change";

// Runs in <head> before first paint so a saved dark choice never flashes light.
export const themeScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}})()`;

export function parseTheme(value: unknown): Theme {
  return value === "dark" ? "dark" : "light";
}

export function readTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
}

export function saveTheme(theme: Theme) {
  try {
    if (theme === "dark") localStorage.setItem(THEME_STORAGE_KEY, theme);
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    /* Storage is optional; the choice still applies to this page. */
  }
  const root = document.documentElement;
  root.classList.add("theme-switching");
  applyTheme(theme);
  window.dispatchEvent(new Event(CHANGE_EVENT));
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.classList.remove("theme-switching")),
  );
}

export function subscribeTheme(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyTheme(parseTheme(event.newValue));
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}
