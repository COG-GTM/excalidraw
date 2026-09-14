// Minimal stand-in for the text-to-diagram AI backend used by the `ai` and
// `launcher` splash variants in local demos. It answers
// `POST /v1/ai/text-to-diagram/chat-streaming` with an SSE stream that spells
// out a fixed Mermaid flowchart, then a `done` chunk and `[DONE]`.
//
//   node docs/splash-variants/mock-ai-backend.mjs   # listens on :3016
//
// `.env.development` points `VITE_APP_AI_BACKEND` at http://localhost:3016.
import http from "node:http";

const PORT = Number(process.env.PORT || 3016);

const MERMAID = `flowchart TD
  A[User submits prompt] --> B{AI backend reachable?}
  B -- Yes --> C[Stream Mermaid chunks]
  B -- No --> D[Show inline hint]
  C --> E[Render diagram on canvas]
  D --> E`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const writeEvent = (res, payload) => {
  res.write(`data: ${payload}\n\n`);
};

const readBody = (req) =>
  new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
  });

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
    const body = await readBody(req);
    let prompt = "";
    try {
      const messages = JSON.parse(body).messages;
      prompt = messages?.[messages.length - 1]?.content ?? "";
    } catch {
      // ignore malformed bodies; the mock always answers the same diagram
    }
    console.log(`[mock-ai] prompt: ${JSON.stringify(prompt).slice(0, 120)}`);

    res.writeHead(200, {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Ratelimit-Limit": "50",
      "X-Ratelimit-Remaining": "49",
    });

    const chunks = MERMAID.match(/.{1,12}/gs) ?? [];
    for (const delta of chunks) {
      writeEvent(res, JSON.stringify({ type: "content", delta }));
      await sleep(40);
    }
    writeEvent(res, JSON.stringify({ type: "done", finishReason: "stop" }));
    writeEvent(res, "[DONE]");
    res.end();
    return;
  }

  res.writeHead(404, { ...CORS_HEADERS, "Content-Type": "application/json" });
  res.end(JSON.stringify({ statusCode: 404, message: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`[mock-ai] listening on http://localhost:${PORT}`);
});
