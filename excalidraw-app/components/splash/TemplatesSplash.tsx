import { LibraryIcon } from "@excalidraw/excalidraw/components/icons";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";

import React, { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TemplatesDialog } from "../TemplatesDialog";
import { TEMPLATES_STRINGS } from "../templates/templatesStrings";

export const TemplatesSplash: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        onSelect={() => setIsDialogOpen(true)}
        icon={LibraryIcon}
        shortcut={null}
        data-testid="templates-splash-menu-item"
      >
        {TEMPLATES_STRINGS.menuItem}
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
