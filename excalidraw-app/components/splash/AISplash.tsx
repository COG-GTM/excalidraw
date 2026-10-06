import { useState } from "react";

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

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isAIEnabled } from "./splashVariant";

import "./AISplash.scss";

const STRINGS = {
  menuItem: "Generate with AI",
  badge: "AI",
  placeholder: "Describe a diagram…",
  inputLabel: "Describe a diagram to generate with AI",
  submitLabel: "Generate diagram with AI",
} as const;

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
    const trimmed = prompt.trim();
    if (trimmed) {
      setChatHistory((prev) => ({ ...prev, currentPrompt: trimmed }));
    }
    trackEvent("ai", "dialog open", "ttd");
    setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
    setPrompt("");
  };

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        className="AISplash__menu-item"
        icon={brainIcon}
        shortcut={null}
        onSelect={openTextToDiagram}
      >
        {STRINGS.menuItem}
        <span className="AISplash__badge">{STRINGS.badge}</span>
      </WelcomeScreen.Center.MenuItem>
      <form
        className="AISplash__prompt"
        onSubmit={(event) => {
          event.preventDefault();
          openTextToDiagram();
        }}
      >
        <input
          type="text"
          className="AISplash__input"
          placeholder={STRINGS.placeholder}
          aria-label={STRINGS.inputLabel}
          autoComplete="off"
          spellCheck={false}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          onKeyUp={(event) => event.stopPropagation()}
        />
        <button
          type="submit"
          className="AISplash__submit"
          aria-label={STRINGS.submitLabel}
          title={STRINGS.submitLabel}
          disabled={!prompt.trim()}
        >
          {ArrowRightIcon}
        </button>
      </form>
    </>
  );
};
