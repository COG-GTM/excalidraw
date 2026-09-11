import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * Variant A (`VITE_APP_SPLASH_VARIANT=templates`).
 *
 * Rendered inside `WelcomeScreen.Center.Menu`; should render a
 * `WelcomeScreen.Center.MenuItem` that opens the templates dialog.
 */
export const TemplatesSplash = (_props: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  return null;
};
TemplatesSplash.displayName = "TemplatesSplash";
