import { gridIcon } from "@excalidraw/excalidraw/components/icons";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React, { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TemplatesDialog } from "../TemplatesDialog";

/**
 * Variant A ("templates"): welcome-screen entry point into a starter-template
 * picker dialog.
 */
export const TemplatesSplash: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!excalidrawAPI) {
    return null;
  }

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        onSelect={() => setIsDialogOpen(true)}
        shortcut={null}
        icon={gridIcon}
      >
        Start from a template
      </WelcomeScreen.Center.MenuItem>
      {isDialogOpen && (
        <TemplatesDialog
          excalidrawAPI={excalidrawAPI}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </>
  );
};
