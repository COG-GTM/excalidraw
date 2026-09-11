import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import {
  ArrowRightIcon,
  brainIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isAIEnabled } from "./splashVariant";

import "./AISplash.scss";

/**
 * Variant B (`VITE_APP_SPLASH_VARIANT=ai`).
 *
 * Rendered inside `WelcomeScreen.Center.Menu`; a prominent "Generate with AI"
 * entry with an inline prompt input, prefilling & opening the text-to-diagram
 * dialog.
 */
export const AISplash = (_props: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const appProps = useAppProps();
  const setAppState = useExcalidrawSetAppState();
  const setChatHistory = useSetAtom(chatHistoryAtom);
  const [prompt, setPrompt] = useState("");

  const openTTDDialog = (nextPrompt: string) => {
    setChatHistory((chatHistory) => ({
      ...chatHistory,
      currentPrompt: nextPrompt,
    }));
    trackEvent("ai", "dialog open", "ttd");
    setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
  };

  if (!isAIEnabled() || appProps.aiEnabled === false) {
    return null;
  }

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        className="ai-splash__menu-item"
        icon={brainIcon}
        shortcut={null}
        onSelect={() => openTTDDialog(prompt.trim())}
      >
        Generate with AI
        <span className="ai-splash__badge">AI</span>
      </WelcomeScreen.Center.MenuItem>
      <form
        className="ai-splash__prompt"
        onSubmit={(event) => {
          event.preventDefault();
          openTTDDialog(prompt.trim());
        }}
      >
        <input
          className="ai-splash__prompt-input"
          type="text"
          value={prompt}
          placeholder="Describe a diagram, e.g. user signup flow"
          aria-label="Describe a diagram to generate with AI"
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button
          className="ai-splash__prompt-submit"
          type="submit"
          disabled={!prompt.trim()}
          aria-label="Generate diagram"
        >
          {ArrowRightIcon}
        </button>
      </form>
    </>
  );
};
AISplash.displayName = "AISplash";
