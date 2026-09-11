/**
 * Mock text-to-diagram backend for local splash-variant demos.
 *
 * Answers `POST /v1/ai/text-to-diagram/chat-streaming` with an SSE stream that
 * spells out a small Mermaid flowchart, matching the shape the app expects
 * from `VITE_APP_AI_BACKEND` (see `excalidraw-app/components/AI.tsx`).
 *
 *   node docs/splash-variants/mock-ai-backend.mjs   # listens on :3016
 */
import http from "node:http";

const PORT = Number(process.env.PORT || 3016);

const DIAGRAM = `flowchart TD
  A[User opens app] --> B{Signed in?}
  B -- No --> C[Show login]
  C --> D[Authenticate]
  B -- Yes --> E[Load canvas]
  D --> E
  E --> F[Start drawing]
`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const chunk = (payload) => `data: ${JSON.stringify(payload)}\n\n`;

const streamDiagram = async (res) => {
  res.writeHead(200, {
    ...CORS,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const parts = DIAGRAM.match(/.{1,24}/gs) ?? [DIAGRAM];

  for (const delta of parts) {
    res.write(chunk({ type: "content", delta }));
    await new Promise((resolve) => setTimeout(resolve, 60));
  }

  res.write(chunk({ type: "done", finishReason: "stop" }));
  res.write("data: [DONE]\n\n");
  res.end();
};

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end();
      return;
    }

    if (
      req.method === "POST" &&
      req.url?.startsWith("/v1/ai/text-to-diagram/chat-streaming")
    ) {
      req.resume();
      req.on("end", () => {
        streamDiagram(res);
      });
      return;
    }

    res.writeHead(404, { ...CORS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  })
  .listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`mock ai backend listening on http://localhost:${PORT}`);
  });
