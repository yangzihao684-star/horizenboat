import type { IndexWork, WorkIndex } from "../types";

export type DocKind = "work" | "character" | "hook" | "tag";

export interface SearchDoc {
  key: string;
  kind: DocKind;
  workId: string;
  title: string;
  subtitle: string;
  href: string;
  fields: { text: string; weight: number }[];
}

function norm(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function fieldScore(haystack: string, needle: string): number {
  if (!needle) return 0;
  const hay = norm(haystack);
  const at = hay.indexOf(needle);
  if (at >= 0) {
    const position = at === 0 ? 1 : 1 - Math.min(at, 48) / 96;
    const length = 1 - Math.min(hay.length, 160) / 640;
    return 60 + 26 * position + 14 * length;
  }

  // Subsequence fallback only for latin queries, so "kleinm" can still reach "Klein Moretti".
  if (!/^[a-z0-9]+$/.test(needle) || needle.length < 3) return 0;
  let cursor = 0;
  for (let i = 0; i < hay.length && cursor < needle.length; i += 1) {
    if (hay[i] === needle[cursor]) cursor += 1;
  }
  return cursor === needle.length ? 26 : 0;
}

export function scoreDoc(doc: SearchDoc, query: string): number {
  const q = norm(query);
  if (!q) return 0;
  const tokens = q.split(" ").filter(Boolean);
  let total = 0;

  for (const token of tokens) {
    let best = 0;
    for (const field of doc.fields) {
      const score = fieldScore(field.text, token) * field.weight;
      if (score > best) best = score;
    }
    if (best === 0) return 0;
    total += best;
  }

  if (norm(doc.title) === q) total += 48;
  return total;
}

export function workFields(work: IndexWork): { text: string; weight: number }[] {
  return [
    { text: work.title, weight: 4 },
    { text: work.title_en, weight: 3 },
    { text: work.tags.join(" "), weight: 2.4 },
    { text: work.category, weight: 1.8 },
    { text: work.characters_list.map((c) => c.name + " " + c.role).join(" "), weight: 2.2 },
    { text: work.hooks_list.map((h) => h.title).join(" "), weight: 1.8 },
    { text: work.search_terms.join(" "), weight: 1.6 },
    { text: work.summary, weight: 1.1 },
    { text: work.author, weight: 1 },
  ];
}

export function buildSearchDocs(index: WorkIndex): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const work of index.works) {
    docs.push({
      key: "work:" + work.id,
      kind: "work",
      workId: work.id,
      title: work.title,
      subtitle: work.title_en + " · " + work.category,
      href: "#/work/" + work.id,
      fields: workFields(work),
    });

    for (const character of work.characters_list) {
      docs.push({
        key: "character:" + work.id + ":" + character.id,
        kind: "character",
        workId: work.id,
        title: character.name,
        subtitle: work.title + " · " + character.role,
        href: "#/work/" + work.id + "?c=" + character.id,
        fields: [
          { text: character.name, weight: 4 },
          { text: character.name_en ?? "", weight: 3 },
          { text: (character.aliases ?? []).join(" "), weight: 3 },
          { text: character.role, weight: 2 },
          { text: character.pathway, weight: 1.8 },
          { text: work.title, weight: 0.9 },
          { text: work.tags.join(" "), weight: 0.8 },
        ],
      });
    }

    for (const hook of work.hooks_list) {
      docs.push({
        key: "hook:" + work.id + ":" + hook.hook_id,
        kind: "hook",
        workId: work.id,
        title: hook.title,
        subtitle: work.title + " · 发散钩子",
        href: "#/work/" + work.id + "?hook=" + hook.hook_id,
        fields: [
          { text: hook.title, weight: 3.4 },
          { text: work.title, weight: 1 },
          { text: work.tags.join(" "), weight: 0.7 },
        ],
      });
    }
  }

  for (const tag of index.tags) {
    docs.push({
      key: "tag:" + tag.tag,
      kind: "tag",
      workId: "",
      title: tag.tag,
      subtitle: tag.count + " 部作品",
      href: "#/?tag=" + encodeURIComponent(tag.tag),
      fields: [{ text: tag.tag, weight: 4 }],
    });
  }

  return docs;
}

export function searchDocs(docs: SearchDoc[], query: string, limit = 12): SearchDoc[] {
  if (!query.trim()) return docs.slice(0, limit);
  return docs
    .map((doc) => ({ doc, score: scoreDoc(doc, query) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.doc);
}

export interface WorkFilter {
  query: string;
  tag: string | null;
  type: "all" | "fanfic" | "original";
}

export function filterWorks(works: IndexWork[], filter: WorkFilter): IndexWork[] {
  const query = filter.query.trim();
  return works
    .filter((work) => filter.type === "all" || work.type === filter.type)
    .filter((work) => !filter.tag || work.tags.includes(filter.tag))
    .map((work) => {
      if (!query) return { work, score: 0 };
      const doc: SearchDoc = {
        key: work.id,
        kind: "work",
        workId: work.id,
        title: work.title,
        subtitle: "",
        href: "",
        fields: workFields(work),
      };
      return { work, score: scoreDoc(doc, query) };
    })
    .filter((row) => row.score > 0 || !query)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.work);
}
