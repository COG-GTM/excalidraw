/* eslint-disable no-console */
// Minimal stand-in for the Excalidraw AI backend used by the `ai` and
// `launcher` splash variants during local demos.
//
//   node docs/splash-variants/mock-ai-backend.mjs   # listens on :3016
//
// It answers `POST /v1/ai/text-to-diagram/chat-streaming` with an SSE stream
// that spells out a Mermaid flowchart, mirroring the chunk shape the app's
// `TTDStreamFetch` expects. Everything else is a 404.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 3016);

const MERMAID = `flowchart TD
  A[Start] --> B{Is the canvas empty?}
  B -- Yes --> C[Show the welcome screen]
  B -- No --> D[Show the drawing]
  C --> E[Pick a template, prompt the AI, or drop a file]
  E --> D
  D --> F[Keep drawing]
`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
  "Access-Control-Expose-Headers":
    "X-Ratelimit-Limit, X-Ratelimit-Remaining, X-Ratelimit-Reset",
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const server = createServer(async (req, res) => {
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
      const parsed = JSON.parse(body);
      const last = Array.isArray(parsed.messages)
        ? parsed.messages[parsed.messages.length - 1]
        : null;
      prompt = typeof last?.content === "string" ? last.content : "";
    } catch {
      // ignore malformed bodies, still answer with the canned diagram
    }
    console.log(`[mock-ai] prompt: ${JSON.stringify(prompt)}`);

    res.writeHead(200, {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Ratelimit-Limit": "100",
      "X-Ratelimit-Remaining": "99",
      "X-Ratelimit-Reset": String(Date.now() + 60 * 60 * 1000),
    });

    const send = (payload) => res.write(`data: ${payload}\n\n`);

    for (const delta of MERMAID.match(/.{1,12}/gs) ?? []) {
      send(JSON.stringify({ type: "content", delta }));
      await sleep(40);
    }
    send(JSON.stringify({ type: "done", finishReason: "stop" }));
    send("[DONE]");
    res.end();
    return;
  }

  res.writeHead(404, { ...CORS_HEADERS, "Content-Type": "application/json" });
  res.end(JSON.stringify({ statusCode: 404, message: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`[mock-ai] listening on http://localhost:${PORT}`);
});
