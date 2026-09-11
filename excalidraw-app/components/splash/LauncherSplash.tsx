import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { MIME_TYPES, POINTER_EVENTS } from "@excalidraw/common";
import { getCommonBounds } from "@excalidraw/element";
import { loadSceneOrLibraryFromBlob } from "@excalidraw/excalidraw/data/blob";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import {
  ArrowRightIcon,
  LoadIcon,
} from "@excalidraw/excalidraw/components/icons";
import React, { useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  findTemplateByKeyword,
  loadTemplateIntoScene,
  STARTER_TEMPLATES,
} from "../../data/templates";

import { isAIEnabled } from "./splashVariant";

import "./LauncherSplash.scss";

const CHIPS = STARTER_TEMPLATES.map((template) => ({
  id: template.id,
  keyword: template.keywords[0],
  name: template.name,
}));

const isSceneFile = (file: File) =>
  file.name.toLowerCase().endsWith(".excalidraw");

export const LauncherSplash: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const importSceneFile = async (file: File) => {
    if (!excalidrawAPI || excalidrawAPI.getSceneElements().length > 0) {
      return;
    }

    let contents;
    try {
      contents = await loadSceneOrLibraryFromBlob(file, null, null);
    } catch (error: any) {
      if (isMountedRef.current) {
        setHint("Couldn't read that file.");
      }
      return;
    }

    if (!isMountedRef.current || excalidrawAPI.getSceneElements().length > 0) {
      return;
    }

    if (contents.type !== MIME_TYPES.excalidraw) {
      setHint("That file doesn't contain a scene.");
      return;
    }

    const { elements, appState, files } = contents.data;
    const localAppState = excalidrawAPI.getAppState();

    excalidrawAPI.updateScene({
      elements,
      appState: {
        viewBackgroundColor:
          appState?.viewBackgroundColor ?? localAppState.viewBackgroundColor,
        gridSize: appState?.gridSize ?? localAppState.gridSize,
        gridStep: appState?.gridStep ?? localAppState.gridStep,
        gridModeEnabled:
          appState?.gridModeEnabled ?? localAppState.gridModeEnabled,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    if (files) {
      excalidrawAPI.addFiles(Object.values(files));
    }

    if (elements.length) {
      excalidrawAPI.setViewport({
        target: getCommonBounds(elements),
        fit: "scale-down",
      });
    }

    setHint(null);
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    launch(query);
  };

  const launch = (value: string) => {
    const prompt = value.trim();

    if (!prompt || !excalidrawAPI) {
      return;
    }

    const template = findTemplateByKeyword(prompt);

    if (template) {
      setHint(null);
      loadTemplateIntoScene(excalidrawAPI, template);
      return;
    }

    if (isAIEnabled()) {
      setHint(null);
      editorJotaiStore.set(chatHistoryAtom, (chatHistory) => ({
        ...chatHistory,
        currentPrompt: prompt,
      }));
      excalidrawAPI.updateScene({
        appState: {
          openDialog: { name: "ttd", tab: "text-to-diagram" },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      return;
    }

    setHint(
      "No template matches that. Try one of the keywords below, or open a .excalidraw file.",
    );
  };

  const onDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes("Files")) {
      setIsDraggedOver(true);
    }
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
    }
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const view = event.currentTarget.ownerDocument.defaultView;
    const relatedTarget = event.relatedTarget;

    if (
      view &&
      relatedTarget instanceof view.Node &&
      event.currentTarget.contains(relatedTarget)
    ) {
      return;
    }

    setIsDraggedOver(false);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDraggedOver(false);

    const file = Array.from(event.dataTransfer.files).find(isSceneFile);

    if (!file) {
      // let images & other files reach the editor's own drop handler
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    importSceneFile(file);
  };

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const file = Array.from(event.clipboardData.files).find(isSceneFile);

    if (!file) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    importSceneFile(file);
  };

  return (
    <div
      className={`launcher-splash${
        isDraggedOver ? " launcher-splash--dragged-over" : ""
      }`}
      style={{ pointerEvents: POINTER_EVENTS.inheritFromUI }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPaste={onPaste}
    >
      <form className="launcher-splash__form" onSubmit={onSubmit}>
        <input
          className="launcher-splash__input"
          type="text"
          name="launcher-prompt"
          value={query}
          placeholder="Describe a diagram, or type a template name…"
          aria-label="Describe a diagram, or type a template name"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          className="launcher-splash__submit"
          type="submit"
          title="Start"
          aria-label="Start"
        >
          {ArrowRightIcon}
        </button>
      </form>
      <div className="launcher-splash__chips">
        {CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="launcher-splash__chip"
            title={chip.name}
            onClick={() => {
              setQuery(chip.keyword);
              launch(chip.keyword);
            }}
          >
            {chip.keyword}
          </button>
        ))}
      </div>
      {hint && <div className="launcher-splash__error">{hint}</div>}
      <div className="launcher-splash__footer">
        <label className="launcher-splash__browse">
          {LoadIcon}
          <span>Browse…</span>
          <input
            type="file"
            name="launcher-file"
            accept=".excalidraw"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";

              if (file) {
                importSceneFile(file);
              }
            }}
          />
        </label>
        <span className="launcher-splash__hint">
          or drop / paste a .excalidraw file
        </span>
      </div>
    </div>
  );
};
