import { getCommonBounds } from "@excalidraw/element";
import { MIME_TYPES, POINTER_EVENTS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { loadSceneOrLibraryFromBlob } from "@excalidraw/excalidraw/data/blob";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  findTemplateByKeyword,
  loadTemplateIntoScene,
} from "../../data/templates";

import { isAIEnabled } from "./splashVariant";

import "./LauncherSplash.scss";

const KEYWORD_CHIPS = [
  "Flowchart",
  "Mind map",
  "Kanban",
  "Architecture",
  "Timeline",
  "Wireframe",
];

const isExcalidrawFile = (file: File) => /\.excalidraw$/i.test(file.name);

export const LauncherSplash: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const setAppState = useExcalidrawSetAppState();
  const appProps = useAppProps();
  const setChatHistory = useSetAtom(chatHistoryAtom);

  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const aiEnabled = isAIEnabled() && appProps.aiEnabled !== false;

  const submit = useCallback(
    (value: string) => {
      const prompt = value.trim();

      if (!excalidrawAPI || !prompt) {
        return;
      }

      const template = findTemplateByKeyword(prompt);

      if (template) {
        setHint(null);
        loadTemplateIntoScene(excalidrawAPI, template);
        return;
      }

      if (aiEnabled) {
        setHint(null);
        setChatHistory((chatHistory) => ({
          ...chatHistory,
          currentPrompt: prompt,
        }));
        setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
        return;
      }

      setHint(
        "No template matches that yet, and AI generation is off. Try a keyword like “kanban” or “timeline”.",
      );
    },
    [aiEnabled, excalidrawAPI, setAppState, setChatHistory],
  );

  const importSceneFile = useCallback(
    async (file: File) => {
      if (!excalidrawAPI || excalidrawAPI.getSceneElements().length) {
        return;
      }

      try {
        const contents = await loadSceneOrLibraryFromBlob(
          file,
          excalidrawAPI.getAppState(),
          excalidrawAPI.getSceneElements(),
        );

        if (
          !isMountedRef.current ||
          contents.type !== MIME_TYPES.excalidraw ||
          excalidrawAPI.getSceneElements().length
        ) {
          return;
        }

        const { elements, appState, files } = contents.data;
        const localAppState = excalidrawAPI.getAppState();

        excalidrawAPI.updateScene({
          elements,
          appState: {
            viewBackgroundColor:
              appState.viewBackgroundColor ?? localAppState.viewBackgroundColor,
            gridSize: appState.gridSize ?? localAppState.gridSize,
            gridStep: appState.gridStep ?? localAppState.gridStep,
            gridModeEnabled:
              appState.gridModeEnabled ?? localAppState.gridModeEnabled,
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        excalidrawAPI.addFiles(Object.values(files));

        if (elements.length) {
          excalidrawAPI.setViewport({
            target: getCommonBounds(elements),
            fit: "scale-down",
          });
        }

        setHint(null);
      } catch (error: any) {
        if (isMountedRef.current) {
          setHint("That file could not be read as an Excalidraw scene.");
        }
      }
    },
    [excalidrawAPI],
  );

  if (!excalidrawAPI) {
    return null;
  }

  return (
    <div
      className={`launcher-splash${
        isDraggedOver ? " launcher-splash--dragged-over" : ""
      }`}
      style={{ pointerEvents: POINTER_EVENTS.inheritFromUI }}
      onDragOver={() => setIsDraggedOver(true)}
      onDragLeave={(event) => {
        const relatedTarget = event.relatedTarget;
        const nodeConstructor =
          event.currentTarget.ownerDocument.defaultView?.Node;

        if (
          nodeConstructor &&
          relatedTarget instanceof nodeConstructor &&
          event.currentTarget.contains(relatedTarget)
        ) {
          return;
        }

        setIsDraggedOver(false);
      }}
      onDrop={(event) => {
        setIsDraggedOver(false);

        const file = event.dataTransfer.files[0];

        if (!file || !isExcalidrawFile(file)) {
          // leave images & co. to the editor's own drop handler
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        importSceneFile(file);
      }}
      onPaste={(event) => {
        const file = event.clipboardData.files[0];

        if (!file || !isExcalidrawFile(file)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        importSceneFile(file);
      }}
    >
      <form
        className="launcher-splash__form"
        onSubmit={(event) => {
          event.preventDefault();
          submit(query);
        }}
      >
        <input
          className="launcher-splash__input"
          type="text"
          value={query}
          placeholder="Start with a template, a prompt, or drop a file…"
          aria-label="Start with a template, a prompt, or drop a file"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="launcher-splash__submit" type="submit">
          Start
        </button>
      </form>

      <div className="launcher-splash__chips">
        {KEYWORD_CHIPS.map((chip) => (
          <button
            key={chip}
            className="launcher-splash__chip"
            type="button"
            onClick={() => {
              setQuery(chip);
              submit(chip);
            }}
          >
            {chip}
          </button>
        ))}
        <button
          className="launcher-splash__chip launcher-splash__chip--browse"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          Browse…
        </button>
      </div>

      <div className="launcher-splash__hint">
        {hint ?? "Or drop / paste an .excalidraw file here"}
      </div>

      <input
        ref={fileInputRef}
        className="launcher-splash__file-input"
        type="file"
        accept=".excalidraw"
        onChange={(event) => {
          const file = event.target.files?.[0];

          event.target.value = "";

          if (file) {
            importSceneFile(file);
          }
        }}
      />
    </div>
  );
};
