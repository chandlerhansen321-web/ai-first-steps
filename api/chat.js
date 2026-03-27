import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  // CORS — allow same origin + localhost dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, messages, systemPrompt, maxTokens } = req.body;

  if (!message && (!messages || !messages.length)) {
    return res.status(400).json({ error: "message or messages is required" });
  }

  try {
    // Set up SSE streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Support both single message and conversation history
    const chatMessages = messages || [{ role: "user", content: message }];

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens || 1024,
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
