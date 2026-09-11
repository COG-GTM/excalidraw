import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { brainIcon } from "@excalidraw/excalidraw/components/icons";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React, { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isAIEnabled } from "./splashVariant";

import "./AISplash.scss";

/** Variant B: "Generate with AI" welcome-screen entry. */
export const AISplash: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = () => {
  const appProps = useAppProps();
  const setAppState = useExcalidrawSetAppState();
  const setChatHistory = useSetAtom(chatHistoryAtom);
  const [prompt, setPrompt] = useState("");

  if (!isAIEnabled() || appProps.aiEnabled === false) {
    return null;
  }

  const openTTDDialog = (currentPrompt: string) => {
    setChatHistory((chatHistory) => ({ ...chatHistory, currentPrompt }));
    trackEvent("ai", "dialog open", "ttd");
    setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
  };

  return (
    <div className="ai-splash">
      <WelcomeScreen.Center.MenuItem
        className="ai-splash__menu-item"
        shortcut={null}
        icon={brainIcon}
        onSelect={() => openTTDDialog(prompt.trim())}
      >
        Generate with AI
        <span className="ai-splash__badge">AI</span>
      </WelcomeScreen.Center.MenuItem>
      <form
        className="ai-splash__form"
        onSubmit={(event) => {
          event.preventDefault();
          openTTDDialog(prompt.trim());
        }}
      >
        <input
          className="ai-splash__input"
          type="text"
          value={prompt}
          placeholder="Describe a diagram…"
          aria-label="Describe a diagram"
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button
          className="ai-splash__submit"
          type="submit"
          aria-label="Generate diagram"
        >
          Generate
        </button>
      </form>
    </div>
  );
};
