import { POINTER_EVENTS } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  MIME_TYPES,
  getCommonBounds,
} from "@excalidraw/excalidraw";
import { useAppProps } from "@excalidraw/excalidraw/components/App";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { loadSceneOrLibraryFromBlob } from "@excalidraw/excalidraw/data/blob";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  STARTER_TEMPLATES,
  findTemplateByKeyword,
  loadTemplateIntoScene,
} from "../../data/templates";

import { isAIEnabled } from "./splashVariant";

import "./LauncherSplash.scss";

const isExcalidrawFile = (file: File | null | undefined): file is File =>
  Boolean(file?.name.toLowerCase().endsWith(".excalidraw"));

const getFirstFile = (dataTransfer: DataTransfer | null) =>
  dataTransfer?.files?.[0] ?? null;

/** Variant C: inline launcher (prompt, template keywords, file import). */
export const LauncherSplash: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const appProps = useAppProps();
  const setChatHistory = useSetAtom(chatHistoryAtom);

  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const aiEnabled = isAIEnabled() && appProps.aiEnabled !== false;

  const importSceneFile = useCallback(
    async (file: File) => {
      if (!excalidrawAPI) {
        return;
      }

      let result;
      try {
        result = await loadSceneOrLibraryFromBlob(
          file,
          excalidrawAPI.getAppState(),
          excalidrawAPI.getSceneElements(),
        );
      } catch (error) {
        console.error(error);
        if (isMountedRef.current) {
          setHint("That file could not be read as an Excalidraw scene.");
        }
        return;
      }

      // discard stale results (unmounted, or the user drew in the meantime)
      if (
        !isMountedRef.current ||
        excalidrawAPI.isDestroyed ||
        excalidrawAPI.getSceneElements().length
      ) {
        return;
      }

      if (result.type !== MIME_TYPES.excalidraw) {
        setHint("That file is a library, not a scene.");
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

      const binaryFiles = Object.values(files ?? {});
      if (binaryFiles.length) {
        excalidrawAPI.addFiles(binaryFiles);
      }

      if (elements.length) {
        excalidrawAPI.setViewport({
          target: getCommonBounds(elements),
          fit: "scale-down",
        });
      }
    },
    [excalidrawAPI],
  );

  const submit = useCallback(
    (value: string) => {
      const prompt = value.trim();

      if (!prompt || !excalidrawAPI) {
        return;
      }

      const template = findTemplateByKeyword(prompt);

      if (template) {
        setHint(null);
        setQuery("");
        loadTemplateIntoScene(excalidrawAPI, template);
        return;
      }

      if (aiEnabled) {
        setHint(null);
        setQuery("");
        setChatHistory((chatHistory) => ({
          ...chatHistory,
          currentPrompt: prompt,
        }));
        excalidrawAPI.updateScene({
          appState: {
            openDialog: { name: "ttd", tab: "text-to-diagram" },
          },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        return;
      }

      setHint(
        `No template matches “${prompt}”. Try a keyword such as flowchart, mind map or kanban.`,
      );
    },
    [aiEnabled, excalidrawAPI, setChatHistory],
  );

  useEffect(() => {
    const container = containerRef.current;
    const view = container?.ownerDocument.defaultView;

    if (!container || !view) {
      return;
    }

    const onPaste = (event: ClipboardEvent) => {
      const file = getFirstFile(event.clipboardData);

      if (!isExcalidrawFile(file)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      importSceneFile(file);
    };

    container.ownerDocument.addEventListener("paste", onPaste, true);

    return () => {
      container.ownerDocument.removeEventListener("paste", onPaste, true);
    };
  }, [importSceneFile]);

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer?.types.includes("Files")) {
      setIsDraggedOver(true);
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

    const file = getFirstFile(event.dataTransfer);

    if (!isExcalidrawFile(file)) {
      // let images and everything else reach the editor's own drop handler
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    importSceneFile(file);
  };

  return (
    <div
      ref={containerRef}
      className={`launcher-splash${
        isDraggedOver ? " launcher-splash--dragged-over" : ""
      }`}
      style={{ pointerEvents: POINTER_EVENTS.inheritFromUI }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
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
          placeholder={
            aiEnabled
              ? "Describe a diagram, or type a template keyword…"
              : "Type a template keyword, e.g. flowchart…"
          }
          aria-label="Describe a diagram or type a template keyword"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          className="launcher-splash__submit"
          type="submit"
          disabled={!query.trim()}
        >
          Create
        </button>
      </form>

      <div className="launcher-splash__chips">
        {STARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            className="launcher-splash__chip"
            type="button"
            title={template.description}
            onClick={() => submit(template.name)}
          >
            {template.name.toLowerCase()}
          </button>
        ))}
      </div>

      <div className="launcher-splash__import">
        <label className="launcher-splash__browse">
          Browse…
          <input
            type="file"
            accept=".excalidraw"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (isExcalidrawFile(file)) {
                importSceneFile(file);
              } else if (file) {
                setHint("Only .excalidraw scenes can be imported here.");
              }
            }}
          />
        </label>
        <span className="launcher-splash__import-hint">
          or drop / paste an <code>.excalidraw</code> file
        </span>
      </div>

      {hint && <div className="launcher-splash__message">{hint}</div>}
    </div>
  );
};
