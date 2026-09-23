import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { brainIcon } from "@excalidraw/excalidraw/components/icons";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isAIEnabled } from "./splashVariant";

import "./AISplash.scss";

/**
 * Splash variant "ai": a prominent "Generate with AI" welcome-screen menu item
 * with an inline prompt that prefills and opens the text-to-diagram dialog.
 * Rendered as the first entry of the welcome-screen menu.
 */
export const AISplash = (_props: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const appProps = useAppProps();
  const setAppState = useExcalidrawSetAppState();
  const [prompt, setPrompt] = useState("");

  if (!isAIEnabled() || appProps.aiEnabled === false) {
    return null;
  }

  const openTTDDialog = () => {
    const currentPrompt = prompt.trim();
    editorJotaiStore.set(chatHistoryAtom, (prev) => ({
      ...prev,
      currentPrompt,
    }));
    trackEvent("ai", "dialog open", "ttd");
    setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
  };

  return (
    <div className="ai-splash">
      <WelcomeScreen.Center.MenuItem
        onSelect={openTTDDialog}
        icon={brainIcon}
        shortcut={null}
        className="ai-splash__menu-item"
      >
        Generate with AI
        <span className="ai-splash__badge">AI</span>
      </WelcomeScreen.Center.MenuItem>
      <form
        className="ai-splash__prompt"
        onSubmit={(event) => {
          event.preventDefault();
          openTTDDialog();
        }}
      >
        <input
          className="ai-splash__input"
          type="text"
          value={prompt}
          placeholder="e.g. login flow with 2FA…"
          aria-label="Describe a diagram to generate with AI"
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          onKeyUp={(event) => event.stopPropagation()}
        />
        <button
          type="submit"
          className="ai-splash__submit"
          disabled={!prompt.trim()}
        >
          Generate
        </button>
      </form>
    </div>
  );
};
