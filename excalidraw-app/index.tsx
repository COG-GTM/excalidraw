import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
// Since Vite 5.1, modules inside an import cycle are hot-updated instead of
// triggering a full reload. That re-evaluates the cycle and recreates the
// editor's contexts, which crashes the mounted tree, so reload instead.
if (import.meta.hot) {
  import.meta.hot.on("vite:beforeUpdate", (payload) => {
    if (payload.updates.some((update) => update.isWithinCircularImport)) {
      window.location.reload();
      // never resolves, so the update isn't applied while the page reloads
      return new Promise<void>(() => {});
    }
  });
}

const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
registerSW();
root.render(
  <StrictMode>
    <ExcalidrawApp />
  </StrictMode>,
);
