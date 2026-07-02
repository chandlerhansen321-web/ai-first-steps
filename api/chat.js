import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Abuse guards. This is a public demo backed by the owner's Anthropic key, so
// every cost lever is clamped server-side and the endpoint is locked to the
// site's own origin. Rate limiting is in-memory per warm instance — best
// effort (resets on cold start, not shared across instances), but combined
// with the per-request cost caps it bounds worst-case spend without adding
// an external store.
const ALLOWED_ORIGINS = [
  "https://ai-first-steps-self.vercel.app",
  "http://localhost:3000",
];
const MAX_OUTPUT_TOKENS = 4096; // generator projects legitimately request 4096
const MAX_MESSAGES = 20;
const MAX_TOTAL_CHARS = 24000;

// Fixed-window rate limits (per warm serverless instance).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_IP = 20; // generous for one human clicking through the demo
const RATE_MAX_GLOBAL = 200; // backstop against distributed / rotating-IP abuse
const rateBuckets = new Map(); // ip -> { count, windowStart }
let globalBucket = { count: 0, windowStart: 0 };

function rateLimited(ip) {
  const now = Date.now();
  if (now - globalBucket.windowStart >= RATE_WINDOW_MS) {
    globalBucket = { count: 0, windowStart: now };
  }
  globalBucket.count += 1;
  if (globalBucket.count > RATE_MAX_GLOBAL) return true;

  // Prune stale buckets so the map can't grow unbounded.
  if (rateBuckets.size > 1000) {
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.windowStart >= RATE_WINDOW_MS) rateBuckets.delete(key);
    }
  }
  const entry = rateBuckets.get(ip);
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX_PER_IP;
}

export default async function handler(req, res) {
  // CORS — lock to the site's own origin (no wildcard); echo only allowed origins.
  const origin = req.headers.origin || "";
  const originAllowed = ALLOWED_ORIGINS.includes(origin);
  if (originAllowed) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Reject calls that aren't from the site itself (blocks cross-origin browser
  // abuse and naive no-origin scripts). Determined header-spoofers get past this,
  // which is why the per-request cost caps below also matter.
  const referer = req.headers.referer || "";
  const refererAllowed = ALLOWED_ORIGINS.some((o) => referer.startsWith(o));
  if (!originAllowed && !refererAllowed) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Per-IP rate limit. On Vercel, x-real-ip / the first x-forwarded-for hop
  // is set by the platform and reflects the real client.
  const ip =
    req.headers["x-real-ip"] ||
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    "unknown";
  if (rateLimited(ip)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests — try again in a minute" });
  }

  const { message, messages, systemPrompt, maxTokens } = req.body || {};

  if (!message && (!messages || !messages.length)) {
    return res.status(400).json({ error: "message or messages is required" });
  }

  // Support both single message and conversation history.
  const chatMessages = messages || [{ role: "user", content: message }];

  // Shape validation: the site only ever sends plain-text turns. Rejecting
  // anything else (content blocks, images, odd roles) keeps the cost surface
  // to text and fails bad requests before they hit the API.
  if (!Array.isArray(chatMessages)) {
    return res.status(400).json({ error: "messages must be an array" });
  }
  for (const m of chatMessages) {
    const valid =
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.length > 0;
    if (!valid) {
      return res.status(400).json({ error: "Invalid message format" });
    }
  }
  if (systemPrompt !== undefined && typeof systemPrompt !== "string") {
    return res.status(400).json({ error: "systemPrompt must be a string" });
  }

  // Cost caps: bound message count, total payload size, and output tokens.
  if (chatMessages.length > MAX_MESSAGES) {
    return res.status(413).json({ error: "Too many messages" });
  }
  const totalChars =
    JSON.stringify(chatMessages).length + (systemPrompt ? systemPrompt.length : 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return res.status(413).json({ error: "Request too large" });
  }
  const cappedTokens = Math.min(
    Math.max(Math.floor(Number(maxTokens)) || 1024, 1),
    MAX_OUTPUT_TOKENS
  );

  try {
    // Set up SSE streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: cappedTokens,
      messages: chatMessages,
      ...(systemPrompt ? { system: systemPrompt } : {}),
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Claude API error:", err);
    // If headers already sent (streaming started), end cleanly
    if (!res.headersSent) {
      res.status(500).json({ error: "Claude API error", detail: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
}
