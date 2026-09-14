---
name: running-excalidraw-app
description: How to run, switch and browser-test the excalidraw.com app (excalidraw-app/) locally — ports, env flags, welcome-screen gotchas, the mock AI backend, and checks to run before committing.
---

# Running and testing the excalidraw-app locally

## Toolchain

- `yarn`/`node` come from nvm: `source ~/.nvm/nvm.sh` if `yarn` is not on PATH. Dependencies are pre-installed; only re-run `yarn install --frozen-lockfile` if `node_modules/.bin/tsc` or `vite` is missing.
- Export `CHOKIDAR_USEPOLLING=true` before starting Vite; without it several dev servers exhaust inotify watchers and Vite exits with `ENOSPC`.

## Starting the dev server

- The port comes from `VITE_APP_PORT`, **not** `PORT`: `cd excalidraw-app && VITE_APP_PORT=3000 yarn -s vite --strictPort` (or `VITE_APP_PORT=3000 yarn start` from the repo root).
- Build-time `VITE_APP_*` flags are read from `.env.development`; override any of them on the command line, e.g. `VITE_APP_AI_BACKEND=http://localhost:3016 VITE_APP_PORT=3001 yarn start`. Vite only reads env vars at startup, so restart the server after changing one.
- Start servers one at a time. Starting several at once can raise a checker overlay about a missing `vite.config.mts.timestamp-*.mjs`; restart the affected server to clear it.
- Verify readiness with `curl -s -o /dev/null -w '%{http_code}' http://localhost:<port>` → `200`.

## Welcome screen / empty canvas

- The welcome screen only renders on an empty canvas and Excalidraw persists the scene per origin in `localStorage`. Use one port per scenario to keep storage separate, and run `localStorage.clear()` + reload when a canvas is not empty.
- Main menu → "Reset the canvas" does **not** bring the welcome screen back (cleared elements stay as `isDeleted`); clear `localStorage` instead.
- Wait for the page to finish loading before typing into any input: the editor listens for bare keys on the document and treats them as tool shortcuts, so early keystrokes are swallowed.

## AI features

- `VITE_APP_AI_BACKEND` (set to `http://localhost:3016` in `.env.development`) enables the AI UI, but nothing listens there by default, so text-to-diagram fails until a backend is running. To test locally without a real backend, run a small Node HTTP server on port 3016 that answers `POST /v1/ai/text-to-diagram/chat-streaming` with SSE: `data: {"type":"content","delta":"..."}` chunks spelling out Mermaid, then `data: {"type":"done","finishReason":"stop"}` and `data: [DONE]`. Whenever such a mock backs a demo or recording, say so — it is not evidence of real AI behaviour.

## Browser testing notes

- OS-level drag and drop is unavailable; dispatch a `DragEvent("drop")` with a `DataTransfer` containing the `File` instead, and disclose that the drop was simulated.
- For clean screenshots of the app, capture the page content only (no browser chrome or cursor).

## Checks before committing

```
yarn test:typecheck
yarn -s eslint --max-warnings=0 --ext .ts,.tsx excalidraw-app/components excalidraw-app/data
node_modules/.bin/prettier --check <changed .ts/.tsx/.scss/.mjs files>   # never on .excalidraw files
yarn test:update
```

Validate `.excalidraw` fixtures with `JSON.parse` — Prettier cannot parse them. The scoped eslint run prints a harmless `jsx-ast-utils` "MetaProperty could not be resolved" diagnostic; it still exits 0 when clean.
