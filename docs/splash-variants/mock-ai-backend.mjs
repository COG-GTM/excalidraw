// Minimal mock of the Excalidraw AI backend used by the `ai` and `launcher`
// splash variants during local demos. Streams a fixed Mermaid flowchart as
// SSE chunks from POST /v1/ai/text-to-diagram/chat-streaming.
//
//   node docs/splash-variants/mock-ai-backend.mjs   # listens on :3016
//
// `.env.development` already points VITE_APP_AI_BACKEND at http://localhost:3016.

import { createServer } from "node:http";

const PORT = Number(process.env.PORT) || 3016;

const MERMAID = [
  "flowchart TD",
  "    A[User opens Excalidraw] --> B{Empty canvas?}",
  "    B -- Yes --> C[Show splash page]",
  "    B -- No --> D[Restore last scene]",
  "    C --> E[Pick a template, prompt or file]",
  "    E --> F[Diagram on canvas]",
  "    D --> F",
].join("\n");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
};

const readBody = (req) =>
  new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (
    req.method === "POST" &&
    url.pathname === "/v1/ai/text-to-diagram/chat-streaming"
  ) {
    const body = await readBody(req);
    let prompt = "";
    try {
      const parsed = JSON.parse(body);
      const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      prompt = messages.at(-1)?.content ?? parsed.prompt ?? "";
    } catch {
      // ignore malformed bodies, still answer with the canned diagram
    }
    console.log(`[mock-ai] text-to-diagram prompt: ${JSON.stringify(prompt)}`);

    res.writeHead(200, {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

    // stream a few characters at a time so the dialog visibly "types"
    for (let i = 0; i < MERMAID.length; i += 12) {
      send({ type: "content", delta: MERMAID.slice(i, i + 12) });
      await sleep(25);
    }
    send({ type: "done", finishReason: "stop" });
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404, { ...CORS_HEADERS, "Content-Type": "application/json" });
  res.end(
    JSON.stringify({ error: `no mock for ${req.method} ${url.pathname}` }),
  );
});

server.listen(PORT, () => {
  console.log(`[mock-ai] listening on http://localhost:${PORT}`);
});
