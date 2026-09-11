import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import { LibraryIcon } from "@excalidraw/excalidraw/components/icons";
import React, { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TemplatesDialog } from "../TemplatesDialog";

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
        shortcut={null}
        icon={LibraryIcon}
        onSelect={() => setIsDialogOpen(true)}
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
