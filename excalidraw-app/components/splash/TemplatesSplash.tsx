import { LibraryIcon } from "@excalidraw/excalidraw/components/icons";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TemplatesDialog } from "../TemplatesDialog";

/**
 * Variant A (`VITE_APP_SPLASH_VARIANT=templates`): "Start from a template"
 * welcome-screen menu item opening a templates dialog.
 */
export const TemplatesSplash: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!excalidrawAPI) {
    return null;
  }

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        icon={LibraryIcon}
        shortcut={null}
        onSelect={() => setIsOpen(true)}
      >
        Start from a template
      </WelcomeScreen.Center.MenuItem>
      {isOpen && (
        <TemplatesDialog
          excalidrawAPI={excalidrawAPI}
          onCloseRequest={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
