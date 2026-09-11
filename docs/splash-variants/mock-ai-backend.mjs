/**
 * Mock text-to-diagram backend for local splash-variant demos.
 *
 * Usage: node docs/splash-variants/mock-ai-backend.mjs
 * Serves the endpoint `VITE_APP_AI_BACKEND` points at in .env.development.
 */
import http from "http";

const PORT = Number(process.env.MOCK_AI_PORT || 3016);

const MERMAID = `flowchart TD
  A[User prompt] --> B{Has template keyword?}
  B -- yes --> C[Load starter template]
  B -- no --> D[Generate with AI]
  C --> E[Canvas ready]
  D --> E[Canvas ready]
`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const chunksOf = (text, size) => {
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

  for (const delta of chunksOf(MERMAID, 12)) {
    res.write(`data: ${JSON.stringify({ type: "content", delta })}\n\n`);
    // eslint-disable-next-line no-await-in-loop
    await sleep(40);
  }

  res.write(
    `data: ${JSON.stringify({ type: "done", finishReason: "stop" })}\n\n`,
  );
  res.write("data: [DONE]\n\n");
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
