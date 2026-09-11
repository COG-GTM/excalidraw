// Minimal stand-in for VITE_APP_AI_BACKEND used to demo the `ai` and
// `launcher` splash variants locally. It only implements the streaming
// text-to-diagram endpoint and always answers with the same Mermaid
// flowchart; nothing here talks to a real model.
//
//   node docs/splash-variants/mock-ai-backend.mjs   # listens on :3016

import http from "node:http";

const PORT = Number(process.env.PORT) || 3016;
const ENDPOINT = "/v1/ai/text-to-diagram/chat-streaming";
const CHUNK_DELAY_MS = 40;

const MERMAID = `flowchart TD
    A[Open app] --> B[Enter credentials]
    B --> C{Valid?}
    C -- Yes --> D[Load dashboard]
    C -- No --> E[Show error]
    E --> B
    D --> F[Done]
`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Expose-Headers": "X-Ratelimit-Limit, X-Ratelimit-Remaining",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendEvent = (res, payload) => {
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

  if (req.method !== "POST" || req.url !== ENDPOINT) {
    res.writeHead(404, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ statusCode: 404, message: "Not found" }));
    return;
  }

  const body = await readBody(req);
  let prompt = "";
  try {
    const messages = JSON.parse(body).messages ?? [];
    prompt = messages[messages.length - 1]?.content ?? "";
  } catch {
    // ignore malformed bodies; the response is canned anyway
  }
  console.log(
    `[mock-ai] ${new Date().toISOString()} prompt=${JSON.stringify(prompt)}`,
  );

  res.writeHead(200, {
    ...CORS_HEADERS,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Ratelimit-Limit": "50",
    "X-Ratelimit-Remaining": "49",
  });

  for (const delta of MERMAID.match(/\S+\s*|\s+/g) ?? []) {
    sendEvent(res, JSON.stringify({ type: "content", delta }));
    await sleep(CHUNK_DELAY_MS);
  }
  sendEvent(res, JSON.stringify({ type: "done", finishReason: "stop" }));
  sendEvent(res, "[DONE]");
  res.end();
});

server.listen(PORT, () => {
  console.log(`[mock-ai] listening on http://localhost:${PORT}${ENDPOINT}`);
});
