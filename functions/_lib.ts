/**
 * Shared helpers for Pages Functions under /api/*.
 *
 * Cloudflare Pages Functions run on the Workers runtime; KVNamespace is provided
 * at runtime via the FEEDBACK_KV binding declared in the Pages dashboard.
 */

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  FEEDBACK_KV: KVNamespace;
  IP_HASH_SALT?: string;
  RESEND_API_KEY?: string;
  REPORT_TO_EMAIL?: string;
  RESEND_FROM?: string;
}

export type Ctx = {
  request: Request;
  env: Env;
};

export const SLUG_RE = /^[a-z0-9-]{1,50}$/;

export function isValidSlug(s: unknown): s is string {
  return typeof s === "string" && SLUG_RE.test(s);
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("CF-Connecting-IP") ||
    req.headers.get("X-Forwarded-For") ||
    "unknown"
  );
}

export async function hashIp(
  ip: string,
  salt: string,
  scope = ""
): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}:${scope}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type VoteCounts = { up: number; down: number };

export async function getVoteCounts(
  env: Env,
  slug: string
): Promise<VoteCounts> {
  const raw = await env.FEEDBACK_KV.get(`vote:${slug}`);
  if (!raw) return { up: 0, down: 0 };
  try {
    const parsed = JSON.parse(raw);
    return {
      up: Math.max(0, Number(parsed.up) || 0),
      down: Math.max(0, Number(parsed.down) || 0),
    };
  } catch {
    return { up: 0, down: 0 };
  }
}

export async function setVoteCounts(
  env: Env,
  slug: string,
  counts: VoteCounts
): Promise<void> {
  await env.FEEDBACK_KV.put(
    `vote:${slug}`,
    JSON.stringify({
      up: Math.max(0, counts.up | 0),
      down: Math.max(0, counts.down | 0),
    })
  );
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
