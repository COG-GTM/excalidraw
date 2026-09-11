import { LibraryIcon } from "@excalidraw/excalidraw/components/icons";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TemplatesDialog } from "../TemplatesDialog";

/**
 * Variant A (`VITE_APP_SPLASH_VARIANT=templates`).
 *
 * Rendered inside `WelcomeScreen.Center.Menu`; renders a
 * `WelcomeScreen.Center.MenuItem` that opens the templates dialog.
 */
export const TemplatesSplash = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!excalidrawAPI) {
    return null;
  }

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        onSelect={() => setIsDialogOpen(true)}
        shortcut={null}
        icon={LibraryIcon}
      >
        Start from a template
      </WelcomeScreen.Center.MenuItem>
      {isDialogOpen && (
        <TemplatesDialog
          excalidrawAPI={excalidrawAPI}
          onCloseRequest={() => setIsDialogOpen(false)}
        />
      )}
    </>
  );
};
TemplatesSplash.displayName = "TemplatesSplash";
