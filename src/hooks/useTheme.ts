import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "doc_verify_theme";

/**
 * Light/dark preference, stored in localStorage and mirrored onto the root
 * element as a `dark` class.
 *
 * The stored preference is deliberately NOT read during render. The server has
 * no `window`, so it can only ever produce "light"; a client that read
 * localStorage or `prefers-color-scheme` in the initialiser disagreed with it,
 * and that disagreement made React discard the server's HTML and rebuild the
 * page. It was the same hydration bug as the scan history, just invisible
 * until somebody actually used dark mode.
 *
 * Reading it after mount keeps the first client render identical to the
 * server's. The consequence is that a dark-mode visitor sees one light frame
 * before the class is applied — fixing that properly needs a blocking inline
 * script in the document head, which is not worth the complexity here.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  /** False until the stored preference has been read, so it is never overwritten. */
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    } else {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    // Persisting before the stored value has been read would save the server's
    // default over the visitor's actual choice.
    if (restored) localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, restored]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return { theme, toggleTheme, setTheme };
}
