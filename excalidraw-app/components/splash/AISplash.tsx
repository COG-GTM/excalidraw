import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { brainIcon } from "@excalidraw/excalidraw/components/icons";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import { KEYS } from "@excalidraw/common";
import React, { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isAIEnabled } from "./splashVariant";

import "./AISplash.scss";

const PROMPT_PLACEHOLDER = "Describe a diagram…";

/**
 * Variant B (`VITE_APP_SPLASH_VARIANT=ai`): "Generate with AI" welcome-screen
 * menu item + inline prompt that prefills and opens the text-to-diagram dialog.
 */
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

  const openTTDDialog = (nextPrompt?: string) => {
    const trimmed = nextPrompt?.trim();
    if (trimmed) {
      setChatHistory((prev) => ({ ...prev, currentPrompt: trimmed }));
    }
    trackEvent("ai", "dialog open", "ttd");
    setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    openTTDDialog(prompt);
  };

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        className="ai-splash__menu-item"
        icon={brainIcon}
        shortcut={null}
        onSelect={() => openTTDDialog()}
      >
        Generate with AI
        <span className="ai-splash__badge" aria-hidden>
          AI
        </span>
      </WelcomeScreen.Center.MenuItem>
      <form className="ai-splash__prompt" onSubmit={onSubmit}>
        <input
          className="ai-splash__prompt-input"
          type="text"
          aria-label={PROMPT_PLACEHOLDER}
          placeholder={PROMPT_PLACEHOLDER}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            // keep keystrokes from being handled as canvas tool shortcuts
            event.stopPropagation();
            if (event.key === KEYS.ESCAPE) {
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="submit"
          className="ai-splash__prompt-submit"
          disabled={!prompt.trim()}
        >
          Generate
        </button>
      </form>
    </>
  );
};
