import {
  CaptureUpdateAction,
  getCommonBounds,
  MIME_TYPES,
} from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import {
  ArrowRightIcon,
  LoadIcon,
} from "@excalidraw/excalidraw/components/icons";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { loadSceneOrLibraryFromBlob } from "@excalidraw/excalidraw/data/blob";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import { randomId } from "@excalidraw/common";
import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  findTemplateByKeyword,
  loadTemplateIntoScene,
  STARTER_TEMPLATES,
} from "../../data/templates";

import { isAIEnabled } from "./splashVariant";

import "./LauncherSplash.scss";

const EXCALIDRAW_FILE_RE = /\.excalidraw$/i;

const NO_MATCH_HINT =
  "No template matched — try one of the chips or drop a file";

const isExcalidrawFile = (file: File | null | undefined): file is File =>
  !!file && EXCALIDRAW_FILE_RE.test(file.name);

const findExcalidrawFile = (files: FileList | null | undefined) => {
  if (!files) {
    return null;
  }
  for (let i = 0; i < files.length; i++) {
    if (isExcalidrawFile(files[i])) {
      return files[i];
    }
  }
  return null;
};

export const LauncherSplash = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const appProps = useAppProps();
  const setAppState = useExcalidrawSetAppState();
  const setChatHistory = useSetAtom(chatHistoryAtom);

  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const isMounted = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const aiAvailable = isAIEnabled() && appProps.aiEnabled !== false;

  const importScene = async (blob: File | Blob) => {
    if (!excalidrawAPI) {
      return;
    }
    setHint(null);
    try {
      const result = await loadSceneOrLibraryFromBlob(
        blob,
        excalidrawAPI.getAppState(),
        excalidrawAPI.getSceneElementsIncludingDeleted(),
      );
      if (!isMounted.current || excalidrawAPI.getSceneElements().length !== 0) {
        return;
      }
      if (result.type !== MIME_TYPES.excalidraw) {
        throw new Error("That file is a library, not a scene");
      }
      const { elements, appState, files } = result.data;
      if (!elements.length) {
        throw new Error("The scene file has no elements");
      }
      excalidrawAPI.updateScene({
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
          gridStep: appState.gridStep,
          gridModeEnabled: appState.gridModeEnabled,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      const binaryFiles = Object.values(files ?? {});
      if (binaryFiles.length) {
        excalidrawAPI.addFiles(binaryFiles);
      }
      excalidrawAPI.setViewport({
        target: getCommonBounds(elements),
        fit: "scale-down",
      });
    } catch (error) {
      if (isMounted.current) {
        setHint(
          error instanceof Error && error.message
            ? error.message
            : "Could not import that file",
        );
      }
    }
  };

  const submit = () => {
    const value = query.trim();
    if (!value || !excalidrawAPI) {
      return;
    }
    const template = findTemplateByKeyword(value);
    if (template) {
      trackEvent("splash", "launcher template", template.id);
      loadTemplateIntoScene(excalidrawAPI, template);
      return;
    }
    if (aiAvailable) {
      setChatHistory((prev) => ({
        id: prev.messages.length ? prev.id : randomId(),
        messages: prev.messages,
        currentPrompt: value,
      }));
      trackEvent("ai", "dialog open", "ttd");
      setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
      return;
    }
    setHint(NO_MATCH_HINT);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  const onPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const file = findExcalidrawFile(event.clipboardData?.files);
    if (file) {
      event.preventDefault();
      importScene(file);
    }
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const NodeCtor = event.currentTarget.ownerDocument.defaultView?.Node;
    if (
      NodeCtor &&
      event.relatedTarget instanceof NodeCtor &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setIsDragOver(false);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
    const file = findExcalidrawFile(event.dataTransfer?.files);
    if (!file) {
      // let the editor's own drop handler deal with images and other files
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    importScene(file);
  };

  const onBrowse = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) {
      importScene(file);
    }
  };

  return (
    <div
      className={clsx("launcher-splash", {
        "launcher-splash--dragover": isDragOver,
      })}
      data-testid="launcher-splash"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <form
        className="launcher-splash__form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          className="launcher-splash__input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="Type a template keyword, describe a diagram, or drop a .excalidraw file…"
          aria-label="Start from a template, an AI prompt, or a file"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (hint) {
              setHint(null);
            }
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
        <button
          type="submit"
          className="launcher-splash__submit"
          aria-label="Go"
          title="Go"
          disabled={!query.trim() || !excalidrawAPI}
        >
          {ArrowRightIcon}
        </button>
      </form>

      {hint && (
        <div className="launcher-splash__hint" role="status">
          {hint}
        </div>
      )}

      <div className="launcher-splash__chips" aria-label="Templates">
        {STARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="launcher-splash__chip"
            title={template.description}
            disabled={!excalidrawAPI}
            onClick={() => {
              if (excalidrawAPI) {
                trackEvent("splash", "launcher template", template.id);
                loadTemplateIntoScene(excalidrawAPI, template);
              }
            }}
          >
            {template.name}
          </button>
        ))}
      </div>

      <div className="launcher-splash__footer">
        <span className="launcher-splash__drop-hint">
          or drop / paste a .excalidraw file here
        </span>
        <button
          type="button"
          className="launcher-splash__browse"
          disabled={!excalidrawAPI}
          onClick={() => fileInputRef.current?.click()}
        >
          {LoadIcon}
          Browse…
        </button>
        <input
          ref={fileInputRef}
          className="launcher-splash__file-input"
          type="file"
          accept=".excalidraw,application/json"
          tabIndex={-1}
          onChange={onBrowse}
        />
      </div>
    </div>
  );
};
