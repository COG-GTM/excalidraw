import { useState } from "react";

import { POINTER_EVENTS } from "@excalidraw/common";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { brainIcon } from "@excalidraw/excalidraw/components/icons";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { AI_SPLASH_STRINGS } from "./aiSplashStrings";
import { isAIEnabled } from "./splashVariant";

import "./AISplash.scss";

export const AISplash = ({
  excalidrawAPI: _excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const { aiEnabled } = useAppProps();
  const setAppState = useExcalidrawSetAppState();
  const setChatHistory = useSetAtom(chatHistoryAtom);
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState("");

  if (!isAIEnabled() || aiEnabled === false) {
    return null;
  }

  const openTTD = (prompt: string) => {
    if (prompt) {
      setChatHistory((prev) => ({ ...prev, currentPrompt: prompt }));
    }
    trackEvent("ai", "dialog open", "ttd");
    setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
  };

  const trimmedPrompt = inputValue.trim();

  return (
    <>
      <WelcomeScreen.Center.MenuItem
        icon={brainIcon}
        className="ai-splash__item"
        shortcut={null}
        onSelect={() => openTTD(trimmedPrompt)}
      >
        {AI_SPLASH_STRINGS.label}
        <span className="ai-splash__badge">{AI_SPLASH_STRINGS.badge}</span>
      </WelcomeScreen.Center.MenuItem>
      <form
        className="ai-splash__form"
        onSubmit={(event) => {
          event.preventDefault();
          openTTD(trimmedPrompt);
        }}
        style={{ pointerEvents: POINTER_EVENTS.inheritFromUI }}
      >
        <input
          aria-label={t("labels.prompt")}
          className="ai-splash__input"
          onChange={(event) => setInputValue(event.target.value)}
          placeholder={AI_SPLASH_STRINGS.placeholder}
          style={{ pointerEvents: POINTER_EVENTS.inheritFromUI }}
          type="text"
          value={inputValue}
        />
        <button
          aria-label={AI_SPLASH_STRINGS.submitAriaLabel}
          className="ai-splash__submit"
          disabled={!trimmedPrompt}
          type="submit"
        >
          {AI_SPLASH_STRINGS.submitLabel}
        </button>
      </form>
    </>
  );
};
