import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * Variant C (`VITE_APP_SPLASH_VARIANT=launcher`).
 *
 * Rendered inline inside `welcome-screen-center` (between the heading and the
 * menu); should render a compact "Start canvas" input that routes to AI /
 * template / `.excalidraw` import.
 */
export const LauncherSplash = (_props: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  return null;
};
LauncherSplash.displayName = "LauncherSplash";
