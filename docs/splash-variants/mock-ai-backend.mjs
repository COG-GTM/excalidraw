// Minimal stand-in for the Excalidraw AI backend used by local splash-variant
// demos. Streams a fixed Mermaid flowchart over SSE for
// POST /v1/ai/text-to-diagram/chat-streaming.
//
//   node docs/splash-variants/mock-ai-backend.mjs   # listens on :3016
//
// This is NOT the real backend; every prompt gets the same diagram.
import http from "node:http";

const PORT = Number(process.env.PORT || 3016);

const MERMAID = `flowchart TD
    A[User prompt] --> B{Understood?}
    B -- yes --> C[Draft diagram]
    B -- no --> D[Ask a follow-up]
    D --> A
    C --> E[Insert into canvas]
    E --> F([Done])`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (
    req.method === "POST" &&
    req.url === "/v1/ai/text-to-diagram/chat-streaming"
  ) {
    for await (const _chunk of req) {
      // drain body
    }
    res.writeHead(200, {
      ...CORS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Ratelimit-Limit": "1000",
      "X-Ratelimit-Remaining": "999",
    });
    const send = (payload) => res.write(`data: ${payload}\n\n`);
    for (const line of MERMAID.split("\n")) {
      send(JSON.stringify({ type: "content", delta: `${line}\n` }));
      await sleep(60);
    }
    send(JSON.stringify({ type: "done", finishReason: "stop" }));
    send("[DONE]");
    res.end();
    return;
  }

  res.writeHead(404, { ...CORS, "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: `No mock for ${req.method} ${req.url}` }));
});

server.listen(PORT, () => {
  console.log(`mock AI backend listening on http://localhost:${PORT}`);
});
