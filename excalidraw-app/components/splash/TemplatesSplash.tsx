import { LibraryIcon } from "@excalidraw/excalidraw/components/icons";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React, { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TemplatesDialog } from "../TemplatesDialog";

export const TemplatesSplash: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </>
  );
};
