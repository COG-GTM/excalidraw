import { MIME_TYPES, POINTER_EVENTS } from "@excalidraw/common";
import { CaptureUpdateAction, getCommonBounds } from "@excalidraw/excalidraw";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { loadSceneOrLibraryFromBlob } from "@excalidraw/excalidraw/data/blob";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type { BinaryFileData } from "@excalidraw/excalidraw/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  STARTER_TEMPLATES,
  findTemplateByKeyword,
  loadTemplateIntoScene,
} from "../../data/templates";

import { isAIEnabled } from "./splashVariant";

import "./LauncherSplash.scss";

const EXCALIDRAW_FILE_EXTENSION = ".excalidraw";

const isSceneFile = (file: File | null | undefined): file is File =>
  Boolean(file?.name.toLowerCase().endsWith(EXCALIDRAW_FILE_EXTENSION));

const getSceneFile = (dataTransfer: DataTransfer | null) =>
  Array.from(dataTransfer?.files ?? []).find(isSceneFile) ?? null;

/**
 * Variant C ("launcher"): inline launcher that routes a prompt to a template,
 * to AI, or imports a dropped/pasted/browsed `.excalidraw` scene.
 */
export const LauncherSplash: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const appProps = useAppProps();
  const setAppState = useExcalidrawSetAppState();
  const setChatHistory = useSetAtom(chatHistoryAtom);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);

  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const aiAvailable = isAIEnabled() && appProps.aiEnabled !== false;

  const importSceneFile = useCallback(
    async (file: File) => {
      if (!excalidrawAPI || excalidrawAPI.getSceneElements().length) {
        return;
      }

      let result;
      try {
        result = await loadSceneOrLibraryFromBlob(
          file,
          excalidrawAPI.getAppState(),
          excalidrawAPI.getSceneElements(),
        );
      } catch (error: any) {
        if (mountedRef.current) {
          setHint(`Could not read ${file.name}.`);
        }
        return;
      }

      if (!mountedRef.current || excalidrawAPI.getSceneElements().length) {
        return;
      }

      if (result.type !== MIME_TYPES.excalidraw) {
        setHint(`${file.name} is a library file, not a scene.`);
        return;
      }

      const { elements, appState, files } = result.data;
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

      excalidrawAPI.addFiles(Object.values(files ?? {}) as BinaryFileData[]);

      if (elements.length) {
        excalidrawAPI.setViewport({
          target: getCommonBounds(elements),
          fit: "scale-down",
        });
      }

      setHint(null);
    },
    [excalidrawAPI],
  );

  const runTemplate = useCallback(
    (value: string) => {
      const template = findTemplateByKeyword(value);

      if (!template || !excalidrawAPI) {
        return false;
      }

      loadTemplateIntoScene(excalidrawAPI, template);
      setQuery("");
      setHint(null);
      return true;
    },
    [excalidrawAPI],
  );

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const value = query.trim();

    if (!value || !excalidrawAPI) {
      return;
    }

    if (runTemplate(value)) {
      return;
    }

    if (aiAvailable) {
      setChatHistory((chatHistory) => ({
        ...chatHistory,
        currentPrompt: value,
      }));
      setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
      setHint(null);
      return;
    }

    setHint(
      "No matching template. Pick a keyword below, or drop an .excalidraw file.",
    );
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggedOver(true);
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const NodeCtor = event.currentTarget.ownerDocument.defaultView?.Node;
    const relatedTarget = event.relatedTarget;

    if (
      NodeCtor &&
      relatedTarget instanceof NodeCtor &&
      event.currentTarget.contains(relatedTarget)
    ) {
      return;
    }

    setIsDraggedOver(false);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDraggedOver(false);

    const file = getSceneFile(event.dataTransfer);

    // let images and everything else reach the editor's own drop handling
    if (!file) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    importSceneFile(file);
  };

  useEffect(() => {
    const document = containerRef.current?.ownerDocument;

    if (!document) {
      return;
    }

    const onPaste = (event: ClipboardEvent) => {
      const file = getSceneFile(event.clipboardData);

      if (!file) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      importSceneFile(file);
    };

    document.addEventListener("paste", onPaste, true);

    return () => {
      document.removeEventListener("paste", onPaste, true);
    };
  }, [importSceneFile]);

  return (
    <div
      ref={containerRef}
      className={`launcher-splash${
        isDraggedOver ? " launcher-splash--dragged-over" : ""
      }`}
      style={{ pointerEvents: POINTER_EVENTS.inheritFromUI }}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <form className="launcher-splash__form" onSubmit={onSubmit}>
        <input
          className="launcher-splash__input"
          type="text"
          value={query}
          placeholder={
            aiAvailable
              ? "Start with a template keyword, or describe a diagram…"
              : "Start with a template keyword…"
          }
          aria-label="Start a drawing"
          onChange={(event) => {
            setQuery(event.target.value);
            setHint(null);
          }}
        />
        <button
          className="launcher-splash__submit"
          type="submit"
          disabled={!query.trim()}
        >
          Start
        </button>
      </form>

      <div className="launcher-splash__chips">
        {STARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            className="launcher-splash__chip"
            type="button"
            title={template.description}
            onClick={() => runTemplate(template.id)}
          >
            {template.name}
          </button>
        ))}
      </div>

      <div className="launcher-splash__footer">
        <button
          className="launcher-splash__browse"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          Browse…
        </button>
        <span className="launcher-splash__drop-hint">
          or drop / paste an .excalidraw file here
        </span>
        <input
          ref={fileInputRef}
          className="launcher-splash__file-input"
          type="file"
          accept={EXCALIDRAW_FILE_EXTENSION}
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (isSceneFile(file)) {
              importSceneFile(file);
            }
            event.target.value = "";
          }}
        />
      </div>

      {hint && <div className="launcher-splash__message">{hint}</div>}
    </div>
  );
};
