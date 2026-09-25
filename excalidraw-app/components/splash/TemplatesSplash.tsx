import { gridIcon } from "@excalidraw/excalidraw/components/icons";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { TemplatesDialog } from "../TemplatesDialog";

export const TemplatesSplash = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        onSelect={() => setOpen(true)}
        icon={gridIcon}
        shortcut={null}
      >
        Start from a template
      </WelcomeScreen.Center.MenuItem>
      {open && (
        <TemplatesDialog
          excalidrawAPI={excalidrawAPI}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};
