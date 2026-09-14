import {
  CaptureUpdateAction,
  getCommonBounds,
  loadSceneOrLibraryFromBlob,
  MIME_TYPES,
} from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";
import { useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  findTemplateByKeyword,
  loadTemplateIntoScene,
  STARTER_TEMPLATES,
} from "../../data/templates";

import { isAIEnabled } from "./splashVariant";

import "./LauncherSplash.scss";

const NO_MATCH_HINT =
  "No matching template — try: flowchart, kanban, timeline, mind map, wireframe or system architecture.";

const isExcalidrawFile = (file: File) =>
  file.name.toLowerCase().endsWith(".excalidraw") ||
  file.type === MIME_TYPES.excalidraw ||
  file.type === MIME_TYPES.json;

const findExcalidrawFile = (files: FileList | null | undefined) => {
  if (!files) {
    return null;
  }
  return Array.from(files).find(isExcalidrawFile) ?? null;
};

const hasFilesPayload = (dataTransfer: DataTransfer | null) =>
  !!dataTransfer && Array.from(dataTransfer.types).includes("Files");

export const LauncherSplash = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const setAppState = useExcalidrawSetAppState();
  const appProps = useAppProps();

  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const importExcalidrawFile = async (file: File) => {
    if (!excalidrawAPI) {
      return;
    }
    try {
      const result = await loadSceneOrLibraryFromBlob(
        file,
        excalidrawAPI.getAppState(),
        excalidrawAPI.getSceneElements(),
      );
      if (
        !isMountedRef.current ||
        excalidrawAPI.getSceneElements().length > 0
      ) {
        return;
      }
      if (result.type !== MIME_TYPES.excalidraw) {
        excalidrawAPI.setToast({
          message: "Only .excalidraw scene files can be imported here.",
        });
        return;
      }

      const { elements, appState, files } = result.data;
      const current = excalidrawAPI.getAppState();
      excalidrawAPI.updateScene({
        elements,
        appState: {
          viewBackgroundColor:
            appState?.viewBackgroundColor ?? current.viewBackgroundColor,
          gridSize: appState?.gridSize ?? current.gridSize,
          gridStep: appState?.gridStep ?? current.gridStep,
          gridModeEnabled: appState?.gridModeEnabled ?? current.gridModeEnabled,
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
    } catch (error: unknown) {
      if (!isMountedRef.current) {
        return;
      }
      excalidrawAPI.setToast({
        message:
          error instanceof Error && error.message
            ? error.message
            : "Couldn't import this file.",
      });
    }
  };

  const submit = () => {
    const trimmed = query.trim();
    if (!trimmed || !excalidrawAPI) {
      return;
    }

    const template = findTemplateByKeyword(trimmed);
    if (template) {
      setHint(null);
      loadTemplateIntoScene(excalidrawAPI, template);
      return;
    }

    if (isAIEnabled() && appProps.aiEnabled !== false) {
      setHint(null);
      editorJotaiStore.set(chatHistoryAtom, (history) => ({
        ...history,
        currentPrompt: trimmed,
      }));
      trackEvent("ai", "dialog open", "ttd");
      setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
      return;
    }

    setHint(NO_MATCH_HINT);
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFilesPayload(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const ownerWindow = event.currentTarget.ownerDocument.defaultView;
    const related = event.relatedTarget;
    if (
      ownerWindow &&
      related instanceof ownerWindow.Node &&
      event.currentTarget.contains(related)
    ) {
      return;
    }
    setIsDragOver(false);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
    const file = findExcalidrawFile(event.dataTransfer?.files);
    if (!file) {
      // let the editor's own drop handler deal with images & co.
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    importExcalidrawFile(file);
  };

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const file = findExcalidrawFile(event.clipboardData?.files);
    if (!file) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    importExcalidrawFile(file);
  };

  const onBrowse = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!isExcalidrawFile(file)) {
      excalidrawAPI?.setToast({
        message: "Please pick a .excalidraw file.",
      });
      return;
    }
    importExcalidrawFile(file);
  };

  const stopKeyPropagation = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      className={`launcher-splash${isDragOver ? " drag-over" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPaste={onPaste}
      onKeyDown={stopKeyPropagation}
      onKeyUp={stopKeyPropagation}
      data-testid="launcher-splash"
    >
      <form
        className="launcher-splash__row"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          type="text"
          className="launcher-splash__input"
          placeholder="Type a template name, describe a diagram, or drop a .excalidraw file…"
          aria-label="Start from a template, a prompt or a file"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (hint) {
              setHint(null);
            }
          }}
          autoComplete="off"
          spellCheck={false}
          data-testid="launcher-splash-input"
        />
        <button
          type="submit"
          className="launcher-splash__submit"
          disabled={!query.trim() || !excalidrawAPI}
          data-testid="launcher-splash-submit"
        >
          Start
        </button>
      </form>

      {hint && (
        <div className="launcher-splash__hint" role="status">
          {hint}
        </div>
      )}

      <div className="launcher-splash__chips">
        {STARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="launcher-splash__chip"
            title={template.description}
            disabled={!excalidrawAPI}
            onClick={() => {
              if (excalidrawAPI) {
                setHint(null);
                loadTemplateIntoScene(excalidrawAPI, template);
              }
            }}
            data-testid={`launcher-splash-chip-${template.id}`}
          >
            {template.name}
          </button>
        ))}
      </div>

      <div className="launcher-splash__import">
        <button
          type="button"
          className="launcher-splash__browse"
          disabled={!excalidrawAPI}
          onClick={() => fileInputRef.current?.click()}
          data-testid="launcher-splash-browse"
        >
          Browse…
        </button>
        <span className="launcher-splash__import-hint">
          or drop / paste a .excalidraw file here
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".excalidraw,application/json"
          className="launcher-splash__file-input"
          onChange={onBrowse}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};
LauncherSplash.displayName = "LauncherSplash";
