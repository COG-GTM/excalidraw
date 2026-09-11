import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * Variant B (`VITE_APP_SPLASH_VARIANT=ai`).
 *
 * Rendered inside `WelcomeScreen.Center.Menu`; should render a prominent
 * "Generate with AI" `WelcomeScreen.Center.MenuItem` that opens
 * `openDialog: { name: "ttd", tab: "text-to-diagram" }`.
 */
export const AISplash = (_props: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  return null;
};
AISplash.displayName = "AISplash";
