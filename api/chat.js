import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Abuse guards. This is a public demo backed by the owner's Anthropic key, so
// every cost lever is clamped server-side and the endpoint is locked to the
// site's own origin. (A per-IP rate limit via Upstash/Vercel KV is still
// recommended for full protection — these caps bound per-request cost + block
// casual cross-origin/script abuse.)
const ALLOWED_ORIGINS = [
  "https://ai-first-steps-self.vercel.app",
  "http://localhost:3000",
];
const MAX_OUTPUT_TOKENS = 4096; // generator projects legitimately request 4096
const MAX_MESSAGES = 20;
const MAX_TOTAL_CHARS = 24000;

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

  const { message, messages, systemPrompt, maxTokens } = req.body || {};

  if (!message && (!messages || !messages.length)) {
    return res.status(400).json({ error: "message or messages is required" });
  }

  // Support both single message and conversation history.
  const chatMessages = messages || [{ role: "user", content: message }];

  // Cost caps: bound message count, total payload size, and output tokens.
  if (chatMessages.length > MAX_MESSAGES) {
    return res.status(413).json({ error: "Too many messages" });
  }
  const totalChars =
    JSON.stringify(chatMessages).length + (systemPrompt ? String(systemPrompt).length : 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return res.status(413).json({ error: "Request too large" });
  }
  const cappedTokens = Math.min(Number(maxTokens) || 1024, MAX_OUTPUT_TOKENS);

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
