/**
 * Mock text-to-diagram backend for local splash-variant demos.
 *
 * Answers the endpoint `VITE_APP_AI_BACKEND` points at in `.env.development`
 * with an SSE stream of a small Mermaid flowchart, so the AI flows can be
 * demoed without a real model.
 *
 *   node docs/splash-variants/mock-ai-backend.mjs
 */
import http from "http";

const PORT = Number(process.env.MOCK_AI_PORT || 3016);

const DIAGRAM = `flowchart TD
  A[Open the app] --> B[Sign up]
  B --> C{Email verified?}
  C -- yes --> D[Onboarding]
  C -- no --> E[Resend email]
  E --> C
  D --> F[Home screen]
`;

const chunk = (payload) => `data: ${JSON.stringify(payload)}\n\n`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const streamDiagram = async (res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Ratelimit-Limit": "100",
    "X-Ratelimit-Remaining": "99",
  });

  for (const line of DIAGRAM.split(/(?<=\n)/)) {
    res.write(chunk({ type: "content", delta: line }));
    await sleep(120);
  }

  res.write(chunk({ type: "done", finishReason: "stop" }));
  res.write("data: [DONE]\n\n");
  res.end();
};

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
    });
    res.end();
    return;
  }

  if (
    req.method === "POST" &&
    req.url?.startsWith("/v1/ai/text-to-diagram/chat-streaming")
  ) {
    // drain the request body, then stream the canned diagram
    req.on("data", () => {});
    req.on("end", () => {
      streamDiagram(res).catch(() => res.end());
    });
    return;
  }

  res.writeHead(404, { "Access-Control-Allow-Origin": "*" });
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`mock AI backend listening on http://localhost:${PORT}`);
});
