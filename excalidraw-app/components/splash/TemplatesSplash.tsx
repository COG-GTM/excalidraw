import { LibraryIcon } from "@excalidraw/excalidraw/components/icons";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TemplatesDialog } from "../TemplatesDialog";

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
        icon={LibraryIcon}
        shortcut={null}
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
