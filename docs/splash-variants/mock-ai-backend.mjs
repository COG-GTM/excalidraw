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
const HOST = "127.0.0.1";
const CHUNK_DELAY_MS = 40;
const MAX_BODY_BYTES = 64 * 1024;
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

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
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        req.pause();
        reject(new Error("payload too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// only the local Vite dev servers may call this from a browser
const corsHeaders = (req) => {
  const origin = req.headers.origin;
  if (!origin || !LOCAL_ORIGIN_RE.test(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Expose-Headers": "X-Ratelimit-Limit, X-Ratelimit-Remaining",
  };
};

const server = http.createServer(async (req, res) => {
  const CORS_HEADERS = corsHeaders(req);

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (
    req.method === "POST" &&
    req.url === "/v1/ai/text-to-diagram/chat-streaming"
  ) {
    let raw;
    try {
      raw = await readBody(req);
    } catch {
      res.writeHead(413, {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        Connection: "close",
      });
      res.end(JSON.stringify({ message: "payload too large" }), () =>
        req.destroy(),
      );
      return;
    }
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

server.listen(PORT, HOST, () => {
  process.stdout.write(`mock AI backend listening on http://${HOST}:${PORT}\n`);
});
