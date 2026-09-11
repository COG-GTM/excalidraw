/**
 * Mock text-to-diagram backend for local splash-variant demos.
 *
 *   node docs/splash-variants/mock-ai-backend.mjs
 *
 * Answers POST /v1/ai/text-to-diagram/chat-streaming with an SSE stream of a
 * Mermaid flowchart, matching what `.env.development`'s VITE_APP_AI_BACKEND
 * (http://localhost:3016) points at.
 */
import http from "http";

const PORT = Number(process.env.MOCK_AI_PORT || 3016);

const DIAGRAM = `flowchart TD
  A[Visitor lands on the app] --> B[Sign up]
  B --> C{Email verified?}
  C -- yes --> D[Onboarding tour]
  C -- no --> E[Resend verification]
  E --> C
  D --> F[First diagram created]
`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const chunkify = (text, size) => {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const streamDiagram = async (res) => {
  res.writeHead(200, {
    ...CORS_HEADERS,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (payload) => res.write(`data: ${payload}\n\n`);

  for (const delta of chunkify(DIAGRAM, 12)) {
    send(JSON.stringify({ type: "content", delta }));
    // eslint-disable-next-line no-await-in-loop
    await sleep(40);
  }

  send(JSON.stringify({ type: "done", finishReason: "stop" }));
  send("[DONE]");
  res.end();
};

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (
    req.method === "POST" &&
    req.url?.startsWith("/v1/ai/text-to-diagram/chat-streaming")
  ) {
    req.resume();
    req.on("end", () => {
      streamDiagram(res).catch(() => res.end());
    });
    return;
  }

  res.writeHead(404, { ...CORS_HEADERS, "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "not found" }));
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`mock AI backend listening on http://localhost:${PORT}`);
});
