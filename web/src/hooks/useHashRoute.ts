import { useEffect, useState } from "react";

export type Route =
  | { name: "home"; tag?: string }
  | { name: "work"; id: string; timeline?: string; chars?: string[]; hook?: string };

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  const [path, search] = raw.split("?");
  const params = new URLSearchParams(search ?? "");
  const parts = path.split("/").filter(Boolean);

  if (parts[0] === "work" && parts[1]) {
    const chars = params.get("c");
    return {
      name: "work",
      id: decodeURIComponent(parts[1]),
      timeline: params.get("t") ?? undefined,
      chars: chars ? chars.split(",").filter(Boolean) : undefined,
      hook: params.get("hook") ?? undefined,
    };
  }

  const tag = params.get("tag");
  return { name: "home", tag: tag ? decodeURIComponent(tag) : undefined };
}

export function toHash(route: Route): string {
  if (route.name === "home") {
    return route.tag ? "#/?tag=" + encodeURIComponent(route.tag) : "#/";
  }
  const params = new URLSearchParams();
  if (route.timeline) params.set("t", route.timeline);
  if (route.chars && route.chars.length) params.set("c", route.chars.join(","));
  if (route.hook) params.set("hook", route.hook);
  const query = params.toString();
  return "#/work/" + encodeURIComponent(route.id) + (query ? "?" + query : "");
}

export function go(route: Route, replace = false): void {
  const hash = toHash(route);
  if (replace) {
    window.history.replaceState(null, "", hash);
    return;
  }
  if (window.location.hash === hash) return;
  window.location.hash = hash;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash));
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}
