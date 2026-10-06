import { useState } from "react";

import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { useAppProps } from "@excalidraw/excalidraw/components/App";
import {
  ArrowRightIcon,
  brainIcon,
} from "@excalidraw/excalidraw/components/icons";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isAIEnabled } from "./splashVariant";

import "./AISplash.scss";

export const AISplash = (props: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const appProps = useAppProps();
  const [prompt, setPrompt] = useState("");

  if (!isAIEnabled() || appProps.aiEnabled === false || !props.excalidrawAPI) {
    return null;
  }

  const excalidrawAPI = props.excalidrawAPI;

  const openTTD = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      editorJotaiStore.set(chatHistoryAtom, (prev) => ({
        ...prev,
        currentPrompt: trimmed,
      }));
    }
    trackEvent("ai", "dialog open", "ttd");
    excalidrawAPI.updateScene({
      appState: { openDialog: { name: "ttd", tab: "text-to-diagram" } },
    });
    setPrompt("");
  };

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        className="AISplash__menu-item"
        icon={brainIcon}
        shortcut={null}
        onSelect={() => openTTD(prompt)}
      >
        Generate with AI
        <span className="AISplash__badge">AI</span>
      </WelcomeScreen.Center.MenuItem>
      <form
        className="AISplash__prompt"
        onSubmit={(event) => {
          event.preventDefault();
          openTTD(prompt);
        }}
      >
        <input
          type="text"
          className="AISplash__input"
          placeholder="Describe a diagram…"
          aria-label="Describe a diagram"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          onKeyUp={(event) => event.stopPropagation()}
        />
        <button
          type="submit"
          className="AISplash__submit"
          aria-label="Generate"
          disabled={!prompt.trim()}
        >
          {ArrowRightIcon}
        </button>
      </form>
    </>
  );
};
