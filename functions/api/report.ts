import type { Ctx, Env } from "../_lib";
import { getClientIp, hashIp, isValidSlug, jsonResponse } from "../_lib";

const REPORT_TTL_SECONDS = 365 * 24 * 60 * 60;
const RATE_LIMIT_WINDOW = 60 * 60; // 1 hour
const RATE_LIMIT_MAX = 5;

type StoredReport = {
  id: string;
  ts: string;
  slug: string;
  message: string;
  browserNote: string;
  userAgent: string;
  url: string;
  ipHash: string;
};

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const slug = body.slug;
  const message = String(body.message ?? "").trim();
  const browserNote = String(body.browserNote ?? "").slice(0, 200);
  const url = String(body.url ?? "").slice(0, 500);
  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 500);

  if (!isValidSlug(slug)) {
    return jsonResponse({ error: "bad slug" }, 400);
  }
  if (message.length < 5 || message.length > 2000) {
    return jsonResponse({ error: "message must be 5 to 2000 chars" }, 400);
  }

  const ip = getClientIp(request);
  const salt = env.IP_HASH_SALT || "pocketey-default-salt";
  const ipHash = await hashIp(ip, salt);

  const rateKey = `report-rl:${ipHash}`;
  const rlRaw = await env.FEEDBACK_KV.get(rateKey);
  const rlCount = rlRaw ? Number(rlRaw) : 0;
  if (rlCount >= RATE_LIMIT_MAX) {
    return jsonResponse({ error: "rate limit exceeded" }, 429);
  }
  await env.FEEDBACK_KV.put(rateKey, String(rlCount + 1), {
    expirationTtl: RATE_LIMIT_WINDOW,
  });

  const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const report: StoredReport = {
    id,
    ts: new Date().toISOString(),
    slug,
    message,
    browserNote,
    userAgent,
    url,
    ipHash,
  };

  await env.FEEDBACK_KV.put(`report:${id}`, JSON.stringify(report), {
    expirationTtl: REPORT_TTL_SECONDS,
  });

  // Email is best-effort. Awaited so the Workers runtime doesn't tear down
  // the in-flight fetch when the response returns.
  await sendEmail(env, report).catch((err) =>
    console.error("email failed", err)
  );

  return jsonResponse({ ok: true, id });
};

async function sendEmail(env: Env, report: StoredReport): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn("sendEmail: RESEND_API_KEY missing, skipping");
    return;
  }
  const to = env.REPORT_TO_EMAIL || "shishiyo1@gmail.com";
  const from =
    env.RESEND_FROM || "Pocketey Reports <onboarding@resend.dev>";

  const subject = `[Pocketey] Bug report: ${report.slug}`;
  const text = [
    `New bug report on /${report.slug}/`,
    ``,
    `Reported at: ${report.ts}`,
    `Page: ${report.url}`,
    `Browser / device note: ${report.browserNote || "(none)"}`,
    `User-Agent: ${report.userAgent || "(none)"}`,
    ``,
    `--- Message ---`,
    report.message,
    ``,
    `Report ID: ${report.id}`,
    `IP hash: ${report.ipHash}`,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (res.ok) {
    console.log("resend delivered", report.id);
  } else {
    const errText = await res.text();
    console.error("resend failed", res.status, errText);
  }
}
