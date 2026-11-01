import type { Work, WorkIndex } from "./types";

const indexCache = { value: null as WorkIndex | null };
const workCache = new Map<string, Work>();
const inflight = new Map<string, Promise<Work>>();

/**
 * The dataset is served as plain static JSON, so the "API" is just a directory.
 * Resolution order: VITE_HB_API_BASE (build-time) -> ./api/v1 next to index.html.
 */
export function apiBase(): string {
  const override = import.meta.env.VITE_HB_API_BASE;
  if (typeof override === "string" && override.trim()) {
    return override.trim().replace(/\/+$/, "");
  }
  const url = new URL("./api/v1", document.baseURI);
  return url.toString().replace(/\/+$/, "");
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-cache" });
  if (!res.ok) {
    throw new Error("请求 " + url + " 失败（HTTP " + res.status + "）");
  }
  return (await res.json()) as T;
}

export async function loadIndex(): Promise<WorkIndex> {
  if (indexCache.value) return indexCache.value;
  const data = await getJson<WorkIndex>(apiBase() + "/index.json");
  indexCache.value = data;
  return data;
}

export async function loadWork(workId: string): Promise<Work> {
  const cached = workCache.get(workId);
  if (cached) return cached;
  const pending = inflight.get(workId);
  if (pending) return pending;

  const request = getJson<Work>(apiBase() + "/works/" + encodeURIComponent(workId) + ".json")
    .then((work) => {
      workCache.set(workId, work);
      inflight.delete(workId);
      return work;
    })
    .catch((err) => {
      inflight.delete(workId);
      throw err;
    });

  inflight.set(workId, request);
  return request;
}

export function workJsonUrl(workId: string): string {
  return apiBase() + "/works/" + encodeURIComponent(workId) + ".json";
}
