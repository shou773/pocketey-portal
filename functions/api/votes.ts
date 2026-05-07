import type { Ctx } from "../_lib";
import { getVoteCounts, isValidSlug, jsonResponse } from "../_lib";

export const onRequestGet = async ({ request, env }: Ctx): Promise<Response> => {
  const url = new URL(request.url);
  const single = url.searchParams.get("slug");
  const batch = url.searchParams.get("slugs");

  if (single) {
    if (!isValidSlug(single)) return jsonResponse({ error: "bad slug" }, 400);
    const counts = await getVoteCounts(env, single);
    return jsonResponse({ slug: single, ...counts });
  }

  if (batch) {
    const slugs = batch
      .split(",")
      .filter((s) => isValidSlug(s))
      .slice(0, 50);
    const results: Record<string, { up: number; down: number }> = {};
    await Promise.all(
      slugs.map(async (s) => {
        results[s] = await getVoteCounts(env, s);
      })
    );
    return jsonResponse({ counts: results });
  }

  return jsonResponse({ error: "missing slug or slugs" }, 400);
};
