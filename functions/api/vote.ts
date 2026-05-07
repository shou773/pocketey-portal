import type { Ctx } from "../_lib";
import {
  getClientIp,
  getVoteCounts,
  hashIp,
  isValidSlug,
  jsonResponse,
  setVoteCounts,
} from "../_lib";

const TTL_30_DAYS = 60 * 60 * 24 * 30;

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  let body: { slug?: unknown; value?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const slug = body.slug;
  const value = body.value;
  if (!isValidSlug(slug) || (value !== "up" && value !== "down")) {
    return jsonResponse({ error: "bad request" }, 400);
  }

  const ip = getClientIp(request);
  const salt = env.IP_HASH_SALT || "pocketey-default-salt";
  const ipHash = await hashIp(ip, salt, slug);
  const dedupKey = `ip:${ipHash}`;

  const existing = (await env.FEEDBACK_KV.get(dedupKey)) as
    | "up"
    | "down"
    | null;
  const counts = await getVoteCounts(env, slug);

  let newState: "up" | "down" | null = value;
  if (existing === value) {
    // Toggle off
    counts[value] = Math.max(0, counts[value] - 1);
    newState = null;
  } else if (existing === "up" || existing === "down") {
    // Switch
    counts[existing] = Math.max(0, counts[existing] - 1);
    counts[value] = counts[value] + 1;
  } else {
    // New
    counts[value] = counts[value] + 1;
  }

  await setVoteCounts(env, slug, counts);
  if (newState) {
    await env.FEEDBACK_KV.put(dedupKey, newState, {
      expirationTtl: TTL_30_DAYS,
    });
  } else {
    await env.FEEDBACK_KV.delete(dedupKey);
  }

  return jsonResponse({ slug, ...counts, your: newState });
};
