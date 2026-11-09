import { MIME_TYPES } from "@excalidraw/common";
import { CaptureUpdateAction, getCommonBounds } from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import {
  getFileHandle,
  loadSceneOrLibraryFromBlob,
} from "@excalidraw/excalidraw/data/blob";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import { t } from "@excalidraw/excalidraw/i18n";
import React, { useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  findTemplateByKeyword,
  loadTemplateIntoScene,
  STARTER_TEMPLATES,
} from "../../data/templates";

import { LAUNCHER_STRINGS } from "./launcherStrings";
import { isAIEnabled } from "./splashVariant";

import "./LauncherSplash.scss";

const isExcalidrawFile = (file: File): boolean =>
  file.name.toLowerCase().endsWith(".excalidraw") ||
  file.type === MIME_TYPES.excalidraw;

export const LauncherSplash = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const appProps = useAppProps();
  const setAppState = useExcalidrawSetAppState();
  const setChatHistory = useSetAtom(chatHistoryAtom);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(false);
  const importingRef = useRef(false);
  const [importing, setImporting] = useState(false);

  const disabled = !excalidrawAPI;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const route = (rawQuery: string) => {
    const q = rawQuery.trim();
    if (!q || !excalidrawAPI) {
      return;
    }
    const template = findTemplateByKeyword(q);
    if (template) {
      loadTemplateIntoScene(excalidrawAPI, template);
      setStatus(LAUNCHER_STRINGS.templateLoaded(template.name));
      return;
    }
    if (isAIEnabled() && appProps.aiEnabled !== false) {
      setChatHistory((prev) => ({ ...prev, currentPrompt: q }));
      trackEvent("ai", "dialog open", "ttd");
      setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
      return;
    }
    setStatus(LAUNCHER_STRINGS.noMatch(q));
  };

  const importFile = async (
    file: File,
    fileHandlePromise?: Promise<FileSystemFileHandle | null>,
  ) => {
    if (!excalidrawAPI) {
      return;
    }
    if (importingRef.current) {
      setStatus(LAUNCHER_STRINGS.importBusy(file.name));
      return;
    }
    importingRef.current = true;
    setImporting(true);
    try {
      await commitImport(excalidrawAPI, file, fileHandlePromise);
    } finally {
      importingRef.current = false;
      if (mountedRef.current) {
        setImporting(false);
      }
    }
  };

  const commitImport = async (
    excalidrawAPI: ExcalidrawImperativeAPI,
    file: File,
    fileHandlePromise?: Promise<FileSystemFileHandle | null>,
  ) => {
    let result;
    try {
      const fileHandle = (await fileHandlePromise) ?? null;
      result = await loadSceneOrLibraryFromBlob(
        file,
        excalidrawAPI.getAppState(),
        excalidrawAPI.getSceneElements(),
        fileHandle,
      );
    } catch (error) {
      if (mountedRef.current) {
        setStatus(t("alerts.couldNotLoadInvalidFile"));
      }
      return;
    }
    if (!mountedRef.current || excalidrawAPI.getSceneElements().length !== 0) {
      return;
    }
    if (result.type === MIME_TYPES.excalidraw) {
      const { elements, appState, files } = result.data;
      const { zoom, scrollX, scrollY } = excalidrawAPI.getAppState();
      excalidrawAPI.addFiles(Object.values(files ?? {}));
      excalidrawAPI.updateScene({
        elements,
        appState: { ...appState, zoom, scrollX, scrollY },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      const visibleElements = elements.filter((element) => !element.isDeleted);
      if (visibleElements.length) {
        excalidrawAPI.setViewport({
          target: getCommonBounds(visibleElements),
          fit: "scale-down",
        });
      }
      setStatus(LAUNCHER_STRINGS.fileOpened(file.name));
      return;
    }
    setStatus(LAUNCHER_STRINGS.libraryFileMessage);
  };

  const hasFiles = (dataTransfer: DataTransfer) =>
    Array.from(dataTransfer.types).includes("Files");

  const onDragEnterOrOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (hasFiles(event.dataTransfer)) {
      event.preventDefault();
      setDragOver(true);
    }
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const ownerWindow = event.currentTarget.ownerDocument.defaultView;
    if (!ownerWindow) {
      setDragOver(false);
      return;
    }
    const { Node } = ownerWindow;
    const related = event.relatedTarget;
    if (!(related instanceof Node && event.currentTarget.contains(related))) {
      setDragOver(false);
    }
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setDragOver(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length !== 1 || !isExcalidrawFile(files[0])) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    importFile(files[0], getFileHandle(event));
  };

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length === 1 && isExcalidrawFile(files[0])) {
      event.preventDefault();
      event.stopPropagation();
      importFile(files[0]);
    }
  };

  const className = `launcher-splash${
    dragOver ? " launcher-splash--dragover" : ""
  }`;

  return (
    <div
      className={className}
      onDragEnter={onDragEnterOrOver}
      onDragOver={onDragEnterOrOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPaste={onPaste}
    >
      <form
        className="launcher-splash__form"
        onSubmit={(event) => {
          event.preventDefault();
          route(query);
        }}
      >
        <input
          type="text"
          className="launcher-splash__input"
          placeholder={LAUNCHER_STRINGS.inputPlaceholder}
          aria-label={LAUNCHER_STRINGS.inputAriaLabel}
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") {
              event.stopPropagation();
            }
          }}
        />
        <button
          type="submit"
          className="launcher-splash__go"
          disabled={disabled}
        >
          {LAUNCHER_STRINGS.go}
        </button>
      </form>
      <div className="launcher-splash__chips">
        {STARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="launcher-splash__chip"
            title={template.description}
            disabled={disabled}
            onClick={() => route(template.id)}
          >
            {template.name}
          </button>
        ))}
        <button
          type="button"
          className="launcher-splash__chip launcher-splash__chip--browse"
          disabled={disabled || importing}
          onClick={() => fileInputRef.current?.click()}
        >
          {LAUNCHER_STRINGS.browse}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".excalidraw,application/vnd.excalidraw+json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            importFile(file);
          }
          event.target.value = "";
        }}
      />
      <div className="launcher-splash__hint">
        {dragOver
          ? LAUNCHER_STRINGS.dragOverHint
          : LAUNCHER_STRINGS.dropPasteHint}
      </div>
      <div className="launcher-splash__status" role="status">
        {status}
      </div>
    </div>
  );
};
