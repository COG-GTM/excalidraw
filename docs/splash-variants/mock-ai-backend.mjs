// Minimal stand-in for the text-to-diagram backend used while demoing the
// `ai` / `launcher` splash variants locally. It streams a fixed Mermaid
// diagram over SSE in the shape `TTDStreamFetch` expects.
//
//   node docs/splash-variants/mock-ai-backend.mjs            # port 3016
//   VITE_APP_AI_BACKEND=http://localhost:3016 yarn start
import http from "node:http";

const PORT = Number(process.env.PORT || 3016);

const DIAGRAM = `flowchart TD
    A[User opens app] --> B{Has account?}
    B -- No --> C[Sign up]
    B -- Yes --> D[Log in]
    C --> E[Verify email]
    E --> D
    D --> F{2FA enabled?}
    F -- Yes --> G[Enter one-time code]
    F -- No --> H[Home screen]
    G --> H
`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Expose-Headers": "X-Ratelimit-Limit, X-Ratelimit-Remaining",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

http
  .createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end();
      return;
    }

    if (
      req.method !== "POST" ||
      !req.url?.startsWith("/v1/ai/text-to-diagram/chat-streaming")
    ) {
      res.writeHead(404, CORS);
      res.end("not found");
      return;
    }

    for await (const _chunk of req) {
      // drain the request body
    }

    res.writeHead(200, {
      ...CORS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Ratelimit-Limit": "100",
      "X-Ratelimit-Remaining": "99",
    });

    for (const line of DIAGRAM.split("\n")) {
      const chunk = { type: "content", delta: `${line}\n` };
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      await sleep(120);
    }

    res.write(
      `data: ${JSON.stringify({ type: "done", finishReason: "stop" })}\n\n`,
    );
    res.write("data: [DONE]\n\n");
    res.end();
  })
  .listen(PORT, () => {
    console.log(`mock text-to-diagram backend listening on :${PORT}`);
  });
