export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

export function countChars(text: string): number {
  return Array.from(text).length;
}

export function sortedTimelines<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export function hostFromApiBase(base: string): string {
  try {
    return new URL(base).host;
  } catch {
    return base;
  }
}
