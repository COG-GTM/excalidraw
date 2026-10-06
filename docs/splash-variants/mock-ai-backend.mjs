import { createServer } from "node:http";

const port = Number(process.env.PORT) || 3016;
const endpoint = "/v1/ai/text-to-diagram/chat-streaming";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-Ratelimit-Limit, X-Ratelimit-Remaining",
  "X-Ratelimit-Limit": "100",
  "X-Ratelimit-Remaining": "99",
};
const chunks = [
  "flowchart TD\n",
  "  A[User signs up] --> ",
  "B[Verify email]\n",
  "  B --> ",
  "C{Email verified?}\n",
  "  C -->|Yes| ",
  "D[Create profile]\n",
  "  C -->|No| ",
  "E[Resend link]\n",
  "  E --> ",
  "B\n",
  "  D --> ",
  "F[Welcome tour]",
];

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");

  if (pathname !== endpoint) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, headers);
    response.end();
    return;
  }

  if (request.method !== "POST") {
    response.writeHead(404, headers);
    response.end("Not found");
    return;
  }

  request.resume();
  response.writeHead(200, {
    ...headers,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  response.flushHeaders();

  for (const delta of chunks) {
    response.write(`data: ${JSON.stringify({ type: "content", delta })}\n\n`);
    await delay(60);
  }

  response.write('data: {"type":"done","finishReason":"stop"}\n\n');
  response.end("data: [DONE]\n\n");
}).listen(port, () => {
  console.log(`Mock AI backend listening on port ${port}`);
});
