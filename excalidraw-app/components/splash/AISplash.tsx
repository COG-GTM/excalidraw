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
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React, { useState } from "react";

import { KEYS } from "@excalidraw/common";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isAIEnabled } from "./splashVariant";

import "./AISplash.scss";

const PLACEHOLDER = "Describe a diagram… e.g. login flow with 2FA";

// the editor listens for bare keys on the document and treats them as tool
// shortcuts, so keyboard events must not leave the prompt input
const stopKeyboardPropagation = (event: React.KeyboardEvent) => {
  event.stopPropagation();
};

export const AISplash = (_props: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const appProps = useAppProps();
  const setAppState = useExcalidrawSetAppState();
  const setChatHistory = useSetAtom(chatHistoryAtom);
  const [prompt, setPrompt] = useState("");

  if (!isAIEnabled() || appProps.aiEnabled === false) {
    return null;
  }

  const openTextToDiagram = () => {
    const currentPrompt = prompt.trim();
    setChatHistory((prev) => ({ ...prev, currentPrompt }));
    trackEvent("ai", "dialog open", "ttd");
    setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    stopKeyboardPropagation(event);
    if (event.key === KEYS.ENTER) {
      event.preventDefault();
      openTextToDiagram();
    }
  };

  return (
    <div className="ai-splash">
      <WelcomeScreen.Center.MenuItem
        className="ai-splash__menu-item"
        onSelect={openTextToDiagram}
        icon={brainIcon}
        shortcut={null}
      >
        Generate with AI
        <span className="ai-splash__badge">AI</span>
      </WelcomeScreen.Center.MenuItem>
      <div className="ai-splash__prompt">
        <input
          className="ai-splash__prompt-input"
          type="text"
          value={prompt}
          placeholder={PLACEHOLDER}
          aria-label="Describe a diagram to generate with AI"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={onInputKeyDown}
          onKeyUp={stopKeyboardPropagation}
        />
        <button
          className="ai-splash__prompt-submit"
          type="button"
          title="Generate with AI"
          aria-label="Generate with AI"
          onClick={openTextToDiagram}
        >
          {ArrowRightIcon}
        </button>
      </div>
    </div>
  );
};
