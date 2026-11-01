import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

function initial(): Theme {
  const stored = document.documentElement.getAttribute("data-theme");
  return stored === "light" ? "light" : "dark";
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("hb-theme", theme);
    } catch {
      // storage may be unavailable in private mode; the attribute still applies
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return [theme, toggle];
}
