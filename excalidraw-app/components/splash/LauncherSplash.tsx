import { CaptureUpdateAction, getCommonBounds } from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { useAppProps } from "@excalidraw/excalidraw/components/App";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { loadSceneOrLibraryFromBlob } from "@excalidraw/excalidraw/data/blob";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";
import { MIME_TYPES } from "@excalidraw/common";
import React, { useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  STARTER_TEMPLATES,
  findTemplateByKeyword,
  loadTemplateIntoScene,
} from "../../data/templates";

import { isAIEnabled } from "./splashVariant";

import "./LauncherSplash.scss";

const isExcalidrawFile = (file: File | null | undefined): file is File =>
  !!file &&
  (file.name.toLowerCase().endsWith(".excalidraw") ||
    file.type === MIME_TYPES.excalidraw ||
    file.type === MIME_TYPES.json);

const hasExcalidrawFile = (dataTransfer: DataTransfer | null) =>
  !!dataTransfer &&
  Array.from(dataTransfer.files).some((file) => isExcalidrawFile(file));

export const LauncherSplash = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  const appProps = useAppProps();
  const [query, setQuery] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [hint, setHint] = useState<{
    kind: "info" | "error";
    text: string;
  } | null>(null);
  const isMountedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const aiAvailable = isAIEnabled() && appProps.aiEnabled !== false;

  const importFile = async (file: File) => {
    if (excalidrawAPI.getSceneElements().length > 0) {
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
        setHint({
          kind: "error",
          text: "That file is a library, not a scene. Drop a .excalidraw scene file instead.",
        });
        return;
      }
      const { elements, appState, files } = result.data;
      const current = excalidrawAPI.getAppState();
      const fileList = Object.values(files ?? {});
      if (fileList.length) {
        excalidrawAPI.addFiles(fileList);
      }
      excalidrawAPI.updateScene({
        elements,
        appState: {
          viewBackgroundColor:
            appState.viewBackgroundColor ?? current.viewBackgroundColor,
          gridSize: appState.gridSize ?? current.gridSize,
          gridStep: appState.gridStep ?? current.gridStep,
          gridModeEnabled: appState.gridModeEnabled ?? current.gridModeEnabled,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      if (elements.length) {
        excalidrawAPI.setViewport({
          target: getCommonBounds(elements),
          fit: "scale-down",
        });
      }
      trackEvent("splash", "import", "launcher");
    } catch (error: any) {
      if (isMountedRef.current) {
        setHint({
          kind: "error",
          text: `Couldn't read "${file.name}": ${
            error?.message ?? "invalid file"
          }`,
        });
      }
    }
  };

  const submit = () => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    const template = findTemplateByKeyword(trimmed);
    if (template) {
      trackEvent("splash", "template", template.id);
      loadTemplateIntoScene(excalidrawAPI, template);
      return;
    }
    if (aiAvailable) {
      editorJotaiStore.set(chatHistoryAtom, {
        ...editorJotaiStore.get(chatHistoryAtom),
        currentPrompt: trimmed,
      });
      trackEvent("ai", "dialog open", "ttd");
      excalidrawAPI.updateScene({
        appState: { openDialog: { name: "ttd", tab: "text-to-diagram" } },
      });
      return;
    }
    setHint({
      kind: "info",
      text: `No template matched. Try one of: ${STARTER_TEMPLATES.map(
        (t) => t.keywords[0],
      ).join(", ")}.`,
    });
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const NodeCtor = event.currentTarget.ownerDocument.defaultView?.Node;
    const related = event.relatedTarget;
    if (NodeCtor && related instanceof NodeCtor) {
      if (event.currentTarget.contains(related)) {
        return;
      }
    }
    setIsDragOver(false);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
    if (!hasExcalidrawFile(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const file = Array.from(event.dataTransfer.files).find(isExcalidrawFile);
    if (file) {
      importFile(file);
    }
  };

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const file = Array.from(event.clipboardData?.files ?? []).find(
      isExcalidrawFile,
    );
    if (!file) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    importFile(file);
  };

  const stopKeys = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      className={`launcher-splash${
        isDragOver ? " launcher-splash--drag-over" : ""
      }`}
      onDragOver={(event) => {
        if (hasExcalidrawFile(event.dataTransfer) || !event.dataTransfer) {
          event.preventDefault();
        }
        if (!isDragOver) {
          setIsDragOver(true);
        }
      }}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPaste={onPaste}
      onKeyDown={stopKeys}
      onKeyUp={stopKeys}
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
          aria-label="What do you want to draw?"
          placeholder="What do you want to draw? Try 'kanban', 'flowchart' or describe a diagram…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (hint) {
              setHint(null);
            }
          }}
        />
        <button
          type="submit"
          className="launcher-splash__submit"
          disabled={!query.trim()}
        >
          {aiAvailable ? "Draw" : "Go"}
        </button>
      </form>
      <div className="launcher-splash__chips" role="list">
        {STARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            role="listitem"
            className="launcher-splash__chip"
            title={template.description}
            onClick={() => {
              trackEvent("splash", "template", template.id);
              loadTemplateIntoScene(excalidrawAPI, template);
            }}
          >
            {template.name}
          </button>
        ))}
      </div>
      <div className="launcher-splash__import">
        <button
          type="button"
          className="launcher-splash__browse"
          onClick={() => fileInputRef.current?.click()}
        >
          Browse…
          <input
            ref={fileInputRef}
            type="file"
            accept=".excalidraw,application/json"
            hidden
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                importFile(file);
              }
            }}
          />
        </button>
        <span className="launcher-splash__import-hint">
          or drop / paste a .excalidraw file here
        </span>
      </div>
      {hint && (
        <div
          className={`launcher-splash__hint launcher-splash__hint--${hint.kind}`}
          role={hint.kind === "error" ? "alert" : "status"}
        >
          {hint.text}
        </div>
      )}
    </div>
  );
};
