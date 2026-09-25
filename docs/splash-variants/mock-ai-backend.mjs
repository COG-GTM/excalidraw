// Minimal stand-in for the Excalidraw AI backend used by the welcome-screen
// splash variants during local demos. Streams a fixed Mermaid flowchart over
// SSE in the shape `TTDStreamFetch` expects.
//
//   node docs/splash-variants/mock-ai-backend.mjs   # listens on :3016
//
// Point the app at it with VITE_APP_AI_BACKEND=http://localhost:3016
// (already the default in .env.development).
import http from "node:http";

const PORT = Number(process.env.PORT || 3016);
const CHUNK_DELAY_MS = 40;

const buildMermaid = (prompt) => {
  const title = prompt.trim().slice(0, 40) || "Your idea";
  return [
    "flowchart TD",
    `  A["${title.replace(/"/g, "'")}"] --> B{Understand the request}`,
    "  B -->|Clear| C[Sketch the first draft]",
    "  B -->|Unclear| D[Ask a clarifying question]",
    "  D --> B",
    "  C --> E[Review with the team]",
    "  E -->|Changes| C",
    "  E -->|Approved| F([Ship it])",
  ].join("\n");
};

const lastUserPrompt = (messages) => {
  if (!Array.isArray(messages)) {
    return "";
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (
      message &&
      message.role === "user" &&
      typeof message.content === "string"
    ) {
      return message.content;
    }
  }
  return "";
};

const readBody = (req) =>
  new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Expose-Headers": "X-Ratelimit-Limit, X-Ratelimit-Remaining",
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (
    req.method === "POST" &&
    req.url === "/v1/ai/text-to-diagram/chat-streaming"
  ) {
    const raw = await readBody(req);
    let messages = [];
    try {
      messages = JSON.parse(raw || "{}").messages ?? [];
    } catch {
      // fall through with an empty prompt
    }

    res.writeHead(200, {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Ratelimit-Limit": "50",
      "X-Ratelimit-Remaining": "49",
    });

    const mermaid = buildMermaid(lastUserPrompt(messages));
    // stream a handful of characters at a time so the dialog visibly types
    for (let i = 0; i < mermaid.length; i += 6) {
      const delta = mermaid.slice(i, i + 6);
      res.write(`data: ${JSON.stringify({ type: "content", delta })}\n\n`);
      await sleep(CHUNK_DELAY_MS);
    }
    res.write(
      `data: ${JSON.stringify({ type: "done", finishReason: "stop" })}\n\n`,
    );
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  res.writeHead(404, { ...CORS_HEADERS, "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: `No mock for ${req.method} ${req.url}` }));
});

server.listen(PORT, () => {
  process.stdout.write(
    `mock AI backend listening on http://localhost:${PORT}\n`,
  );
});
