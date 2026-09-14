import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { useAppProps } from "@excalidraw/excalidraw/components/App";
import {
  brainIcon,
  ArrowRightIcon,
} from "@excalidraw/excalidraw/components/icons";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import { randomId } from "@excalidraw/common";
import React, { useCallback, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isAIEnabled } from "./splashVariant";

import "./AISplash.scss";

const PROMPT_PLACEHOLDER = "Describe a diagram, e.g. login flow with 2FA";

export const AISplash = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  const appProps = useAppProps();
  const setChatHistory = useSetAtom(chatHistoryAtom);
  const [prompt, setPrompt] = useState("");

  const openTextToDiagram = useCallback(
    (initialPrompt: string) => {
      setChatHistory({
        id: randomId(),
        messages: [],
        currentPrompt: initialPrompt.trim(),
      });
      trackEvent("ai", "dialog open", "ttd");
      excalidrawAPI.updateScene({
        appState: { openDialog: { name: "ttd", tab: "text-to-diagram" } },
      });
    },
    [excalidrawAPI, setChatHistory],
  );

  if (!isAIEnabled() || appProps.aiEnabled === false) {
    return null;
  }

  const submit = () => openTextToDiagram(prompt);

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        className="ai-splash__menu-item"
        icon={brainIcon}
        shortcut={null}
        onSelect={() => openTextToDiagram("")}
      >
        Generate with AI
        <span className="ai-splash__badge" aria-hidden="true">
          AI
        </span>
      </WelcomeScreen.Center.MenuItem>
      <form
        className="ai-splash__prompt"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        onKeyDown={(event) => event.stopPropagation()}
        onKeyUp={(event) => event.stopPropagation()}
      >
        <input
          className="ai-splash__prompt-input"
          type="text"
          value={prompt}
          placeholder={PROMPT_PLACEHOLDER}
          aria-label="Describe a diagram to generate with AI"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button
          type="submit"
          className="ai-splash__prompt-submit"
          aria-label="Generate diagram"
          title="Generate diagram"
        >
          {ArrowRightIcon}
        </button>
      </form>
    </>
  );
};
