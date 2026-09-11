import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { useAppProps } from "@excalidraw/excalidraw/components/App";
import { brainIcon } from "@excalidraw/excalidraw/components/icons";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React, { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isAIEnabled } from "./splashVariant";

import "./AISplash.scss";

/**
 * Variant B ("ai"): welcome-screen entry point into the text-to-diagram
 * dialog, with an inline prompt.
 */
export const AISplash: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const [prompt, setPrompt] = useState("");
  const setChatHistory = useSetAtom(chatHistoryAtom);
  const { aiEnabled } = useAppProps();

  const openTTDDialog = () => {
    if (!excalidrawAPI) {
      return;
    }

    setChatHistory((chatHistory) => ({
      ...chatHistory,
      currentPrompt: prompt.trim(),
    }));

    excalidrawAPI.updateScene({
      appState: { openDialog: { name: "ttd", tab: "text-to-diagram" } },
    });

    trackEvent("ai", "dialog open", "ttd");
  };

  if (!isAIEnabled() || aiEnabled === false) {
    return null;
  }

  return (
    <div className="ai-splash">
      <WelcomeScreen.Center.MenuItem
        className="ai-splash__cta"
        icon={brainIcon}
        shortcut={null}
        onSelect={openTTDDialog}
      >
        Generate with AI
        <span className="ai-splash__badge">AI</span>
      </WelcomeScreen.Center.MenuItem>
      <form
        className="ai-splash__form"
        onSubmit={(event) => {
          event.preventDefault();
          openTTDDialog();
        }}
      >
        <input
          className="ai-splash__input"
          type="text"
          value={prompt}
          placeholder="Describe a diagram, e.g. idea to launch flow"
          aria-label="Describe a diagram to generate with AI"
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button className="ai-splash__submit" type="submit">
          Generate
        </button>
      </form>
    </div>
  );
};
