import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import {
  ArrowRightIcon,
  brainIcon,
} from "@excalidraw/excalidraw/components/icons";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React, { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isAIEnabled } from "./splashVariant";

import "./AISplash.scss";

export const AISplash: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = () => {
  const appProps = useAppProps();
  const setAppState = useExcalidrawSetAppState();
  const [prompt, setPrompt] = useState("");

  if (!isAIEnabled() || appProps.aiEnabled === false) {
    return null;
  }

  const openTTDDialog = () => {
    const currentPrompt = prompt.trim();

    editorJotaiStore.set(chatHistoryAtom, (chatHistory) => ({
      ...chatHistory,
      currentPrompt,
    }));

    trackEvent("ai", "dialog open", "ttd");
    setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
  };

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        className="ai-splash__menu-item"
        onSelect={openTTDDialog}
        shortcut={null}
        icon={brainIcon}
      >
        Generate with AI
        <span className="ai-splash__badge">AI</span>
      </WelcomeScreen.Center.MenuItem>
      <div className="ai-splash__prompt">
        <input
          className="ai-splash__prompt-input"
          type="text"
          value={prompt}
          placeholder="Describe a diagram…"
          aria-label="Describe a diagram"
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              openTTDDialog();
            }
          }}
        />
        <button
          type="button"
          className="ai-splash__prompt-submit"
          aria-label="Generate with AI"
          onClick={openTTDDialog}
        >
          {ArrowRightIcon}
        </button>
      </div>
    </>
  );
};
