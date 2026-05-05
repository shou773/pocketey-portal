import type { CollectionEntry } from "astro:content";

export type Strategy = "random" | "same-category" | "smart";

type GameEntry = CollectionEntry<"games">;

function seededShuffle<T>(arr: T[], seed: number): T[] {
  // deterministic Fisher-Yates so the SSR output stays stable per page
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickNextGames(
  all: GameEntry[],
  currentSlug: string,
  count: number,
  strategy: Strategy = "random",
): GameEntry[] {
  const others = all.filter((g) => g.data.slug !== currentSlug);
  if (others.length === 0) return [];

  if (strategy === "same-category") {
    const current = all.find((g) => g.data.slug === currentSlug);
    if (current) {
      const same = others.filter(
        (g) => g.data.category === current.data.category,
      );
      const filler = others.filter(
        (g) => g.data.category !== current.data.category,
      );
      const seed = hashString(currentSlug);
      const result = [
        ...seededShuffle(same, seed),
        ...seededShuffle(filler, seed + 1),
      ];
      return result.slice(0, count);
    }
  }

  // random / smart fallback (smart needs client-side localStorage; SSR uses random)
  const seed = hashString(currentSlug);
  return seededShuffle(others, seed).slice(0, count);
}
