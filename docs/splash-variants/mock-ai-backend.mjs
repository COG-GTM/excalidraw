/**
 * Mock text-to-diagram backend for local splash-variant demos.
 *
 * Usage: node docs/splash-variants/mock-ai-backend.mjs
 * Matches VITE_APP_AI_BACKEND=http://localhost:3016 from .env.development.
 */
import http from "node:http";

const PORT = 3016;

const MERMAID = `flowchart TD
  A[Idea] --> B[Sketch]
  B --> C{Good enough?}
  C -->|Yes| D[Share]
  C -->|No| B
`;

const sse = (res, payload) => {
  res.write(`data: ${payload}\n\n`);
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (
    req.method !== "POST" ||
    !req.url?.startsWith("/v1/ai/text-to-diagram/chat-streaming")
  ) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
    return;
  }

  req.resume();
  req.on("end", () => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const chunks = MERMAID.match(/.{1,12}/gs) ?? [];
    let index = 0;

    const tick = () => {
      if (index < chunks.length) {
        sse(res, JSON.stringify({ type: "content", delta: chunks[index] }));
        index++;
        setTimeout(tick, 60);
        return;
      }
      sse(res, JSON.stringify({ type: "done", finishReason: "stop" }));
      sse(res, "[DONE]");
      res.end();
    };

    tick();
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`mock ai backend listening on http://localhost:${PORT}`);
});
