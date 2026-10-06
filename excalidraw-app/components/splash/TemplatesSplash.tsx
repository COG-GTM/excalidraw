import { LibraryIcon } from "@excalidraw/excalidraw/components/icons";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";

import React, { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { loadTemplateIntoScene } from "../../data/templates";
import { TemplatesDialog, STRINGS } from "../TemplatesDialog";

import type { StarterTemplate } from "../../data/templates";

export const TemplatesSplash: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (template: StarterTemplate) => {
    if (!excalidrawAPI) {
      return;
    }

    setOpen(false);
    loadTemplateIntoScene(excalidrawAPI, template);
  };

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        onSelect={() => setOpen(true)}
        icon={LibraryIcon}
        shortcut={null}
      >
        {STRINGS.menuItem}
      </WelcomeScreen.Center.MenuItem>
      {open && (
        <TemplatesDialog
          onClose={() => setOpen(false)}
          onSelect={handleSelect}
        />
      )}
    </>
  );
};
