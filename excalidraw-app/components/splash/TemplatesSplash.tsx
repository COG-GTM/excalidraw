import { gridIcon } from "@excalidraw/excalidraw/components/icons";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TemplatesDialog } from "../TemplatesDialog";

/**
 * Splash variant "templates": a "Start from a template" welcome-screen menu
 * item that opens a templates dialog. Rendered as the first entry of the
 * welcome-screen menu.
 */
export const TemplatesSplash = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        onSelect={() => setIsOpen(true)}
        icon={gridIcon}
        shortcut={null}
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
