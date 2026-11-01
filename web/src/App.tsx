import { useCallback, useEffect, useState } from "react";
import CommandPalette from "./components/CommandPalette";
import Footer from "./components/Footer";
import Landing from "./components/Landing";
import TopBar from "./components/TopBar";
import WorkDetail from "./components/WorkDetail";
import { ToastProvider } from "./components/ui";
import { loadIndex } from "./data";
import { go, useHashRoute } from "./hooks/useHashRoute";
import { useTheme } from "./hooks/useTheme";
import type { WorkIndex } from "./types";

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const route = useHashRoute();
  const [index, setIndex] = useState<WorkIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    loadIndex()
      .then((data) => {
        if (alive) setIndex(data);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  const jumpToIntegration = useCallback(() => {
    const scroll = () => {
      document.getElementById("integration")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (route.name !== "home") {
      window.location.hash = "#/";
      window.setTimeout(scroll, 160);
      return;
    }
    scroll();
  }, [route.name]);

  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col">
        <TopBar
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenPalette={() => setPaletteOpen(true)}
          onJumpToIntegration={jumpToIntegration}
        />

        <main className="shell flex-1">
          {route.name === "home" ? (
            <Landing
              index={index}
              error={error}
              tag={route.tag}
              onOpenPalette={() => setPaletteOpen(true)}
            />
          ) : (
            <WorkDetail key={route.id} route={route} onBack={() => go({ name: "home" })} />
          )}
        </main>

        <div className="shell">
          <Footer />
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} index={index} />
    </ToastProvider>
  );
}
