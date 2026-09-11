import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { brainIcon } from "@excalidraw/excalidraw/components/icons";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isAIEnabled } from "./splashVariant";

import "./AISplash.scss";

const PROMPT_PLACEHOLDER = "Describe the diagram you want…";

/**
 * Variant B (`VITE_APP_SPLASH_VARIANT=ai`).
 *
 * Rendered inside `WelcomeScreen.Center.Menu`; renders a prominent
 * "Generate with AI" `WelcomeScreen.Center.MenuItem` (plus an inline prompt
 * box) that opens `openDialog: { name: "ttd", tab: "text-to-diagram" }`.
 */
export const AISplash = (_props: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const { aiEnabled } = useAppProps();
  const setAppState = useExcalidrawSetAppState();
  const setChatHistory = useSetAtom(chatHistoryAtom);
  const [prompt, setPrompt] = useState("");

  if (!isAIEnabled() || aiEnabled === false) {
    return null;
  }

  const openTextToDiagram = (initialPrompt?: string) => {
    const trimmed = initialPrompt?.trim();
    if (trimmed) {
      setChatHistory((prev) => ({ ...prev, currentPrompt: trimmed }));
    }
    trackEvent("ai", "dialog open", "ttd");
    setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
  };

  return (
    <div className="welcome-screen-ai-splash">
      <WelcomeScreen.Center.MenuItem
        className="welcome-screen-menu-item--ai"
        onSelect={() => openTextToDiagram()}
        icon={brainIcon}
        shortcut={null}
        aria-label="Generate with AI"
      >
        Generate with AI
        <span className="welcome-screen-menu-item__badge">AI</span>
      </WelcomeScreen.Center.MenuItem>
      <form
        className="welcome-screen-ai-splash__prompt"
        onSubmit={(event) => {
          event.preventDefault();
          openTextToDiagram(prompt);
        }}
      >
        <input
          className="welcome-screen-ai-splash__input"
          type="text"
          value={prompt}
          placeholder={PROMPT_PLACEHOLDER}
          aria-label="Describe the diagram to generate"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button
          type="submit"
          className="welcome-screen-ai-splash__submit"
          disabled={!prompt.trim()}
        >
          Generate
        </button>
      </form>
    </div>
  );
};
AISplash.displayName = "AISplash";
