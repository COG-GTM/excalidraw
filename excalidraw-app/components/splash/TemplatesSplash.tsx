import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { LibraryIcon } from "@excalidraw/excalidraw/components/icons";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React, { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TemplatesDialog } from "../TemplatesDialog";

export const TemplatesSplash = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        onSelect={() => {
          trackEvent("splash", "templates.open");
          setIsOpen(true);
        }}
        shortcut={null}
        icon={LibraryIcon}
        data-testid="splash-templates-open"
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
