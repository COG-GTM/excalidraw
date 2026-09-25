import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { brainIcon } from "@excalidraw/excalidraw/components/icons";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import { KEYS, randomId } from "@excalidraw/common";
import { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isAIEnabled } from "./splashVariant";

import "./AISplash.scss";

const PROMPT_PLACEHOLDER = "Describe a diagram… e.g. user signup flow";

const arrowRightIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    role="img"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

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

  const openTextToDiagram = (currentPrompt: string) => {
    setChatHistory((prev) => ({
      id: prev?.id ?? randomId(),
      messages: prev?.messages ?? [],
      currentPrompt,
    }));
    trackEvent("ai", "dialog open", "ttd");
    setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
  };

  const submitPrompt = () => {
    openTextToDiagram(prompt.trim());
    setPrompt("");
  };

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        className="ai-splash-menu-item"
        onSelect={() => openTextToDiagram("")}
        icon={brainIcon}
        shortcut={null}
      >
        Generate with AI
        <span className="ai-splash-badge">AI</span>
      </WelcomeScreen.Center.MenuItem>
      <form
        className="ai-splash-prompt"
        onSubmit={(event) => {
          event.preventDefault();
          submitPrompt();
        }}
        onKeyDown={(event) => event.stopPropagation()}
        onKeyUp={(event) => event.stopPropagation()}
      >
        <input
          className="ai-splash-prompt__input"
          type="text"
          value={prompt}
          placeholder={PROMPT_PLACEHOLDER}
          aria-label="Describe a diagram to generate with AI"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === KEYS.ESCAPE) {
              event.currentTarget.blur();
            }
          }}
        />
        <button
          className="ai-splash-prompt__submit"
          type="submit"
          aria-label="Generate diagram with AI"
          title="Generate (Enter)"
          disabled={!prompt.trim()}
        >
          {arrowRightIcon}
        </button>
      </form>
    </>
  );
};
