import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { brainIcon } from "@excalidraw/excalidraw/components/icons";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React, { useState } from "react";

import { isAIEnabled } from "./splashVariant";

import "./AISplash.scss";

export const AISplash: React.FC = () => {
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
    <div className="ai-splash">
      <WelcomeScreen.Center.MenuItem
        className="ai-splash__trigger"
        onSelect={openTTDDialog}
        shortcut={null}
        icon={brainIcon}
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
          placeholder="Describe a diagram…"
          aria-label="Describe a diagram to generate with AI"
          onChange={(event) => setPrompt(event.currentTarget.value)}
        />
        <button className="ai-splash__submit" type="submit">
          Generate
        </button>
      </form>
    </div>
  );
};
