import { CaptureUpdateAction, getCommonBounds } from "@excalidraw/excalidraw";
import { MIME_TYPES } from "@excalidraw/common";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { useAppProps } from "@excalidraw/excalidraw/components/App";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { loadSceneOrLibraryFromBlob } from "@excalidraw/excalidraw/data/blob";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";

import React, { useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  STARTER_TEMPLATES,
  findTemplateByKeyword,
  loadTemplateIntoScene,
} from "../../data/templates";

import { isAIEnabled } from "./splashVariant";

import "./LauncherSplash.scss";

import type { StarterTemplate } from "../../data/templates";

const STRINGS = {
  label: "Describe a diagram or pick a template",
  placeholder: "Describe a diagram or pick a template…",
  submit: "Go",
  templates: "Templates",
  browse: "Browse…",
  dropHint: "Drop or paste a .excalidraw file",
  dropActive: "Release to open this .excalidraw file",
  emptyQuery: "Type a description or pick a template below.",
  noMatch: "No matching template. Try one of the templates below.",
  invalidFile: "That file isn't a valid .excalidraw scene.",
};

const EXCALIDRAW_EXTENSION = ".excalidraw";

const isExcalidrawFile = (file: File) =>
  file.type === MIME_TYPES.excalidraw ||
  file.name.toLowerCase().endsWith(EXCALIDRAW_EXTENSION);

const getSingleExcalidrawFile = (files: FileList | null | undefined) =>
  files?.length === 1 && isExcalidrawFile(files[0]) ? files[0] : null;

const hasFiles = (dataTransfer: DataTransfer) =>
  Array.from(dataTransfer.types).includes("Files");

export const LauncherSplash: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const { aiEnabled } = useAppProps();
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

  const canUseAI = isAIEnabled() && aiEnabled !== false;

  const loadTemplate = (template: StarterTemplate) => {
    if (!excalidrawAPI) {
      return;
    }
    setHint(null);
    loadTemplateIntoScene(excalidrawAPI, template);
  };

  const openTextToDiagram = (api: ExcalidrawImperativeAPI, prompt: string) => {
    editorJotaiStore.set(chatHistoryAtom, (chatHistory) => ({
      ...chatHistory,
      currentPrompt: prompt,
    }));
    api.updateScene({
      appState: {
        openDialog: { name: "ttd", tab: "text-to-diagram" },
      },
    });
    trackEvent("ai", "dialog open", "ttd");
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!excalidrawAPI) {
      return;
    }
    const prompt = query.trim();
    if (!prompt) {
      setHint(STRINGS.emptyQuery);
      return;
    }
    const template = findTemplateByKeyword(prompt);
    if (template) {
      loadTemplate(template);
      return;
    }
    if (canUseAI) {
      setHint(null);
      openTextToDiagram(excalidrawAPI, prompt);
      return;
    }
    setHint(STRINGS.noMatch);
  };

  const importFile = async (file: File) => {
    const api = excalidrawAPI;
    if (!api) {
      return;
    }
    setHint(null);
    try {
      const result = await loadSceneOrLibraryFromBlob(
        file,
        api.getAppState(),
        null,
      );
      if (!isMountedRef.current || api.getSceneElements().length > 0) {
        return;
      }
      if (result.type !== MIME_TYPES.excalidraw) {
        setHint(STRINGS.invalidFile);
        return;
      }
      const { elements, appState, files } = result.data;
      const currentAppState = api.getAppState();
      api.updateScene({
        elements,
        appState: {
          viewBackgroundColor:
            appState.viewBackgroundColor ?? currentAppState.viewBackgroundColor,
          gridSize: appState.gridSize ?? currentAppState.gridSize,
          gridStep: appState.gridStep ?? currentAppState.gridStep,
          gridModeEnabled:
            appState.gridModeEnabled ?? currentAppState.gridModeEnabled,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      api.addFiles(Object.values(files));
      if (elements.length > 0) {
        api.setViewport({
          target: getCommonBounds(elements),
          fit: "scale-down",
        });
      }
    } catch {
      if (isMountedRef.current) {
        setHint(STRINGS.invalidFile);
      }
    }
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const NodeConstructor = event.currentTarget.ownerDocument.defaultView?.Node;
    const { relatedTarget } = event;
    if (
      NodeConstructor &&
      relatedTarget instanceof NodeConstructor &&
      event.currentTarget.contains(relatedTarget)
    ) {
      return;
    }
    setIsDragOver(false);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
    const file = getSingleExcalidrawFile(event.dataTransfer.files);
    if (!file) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    importFile(file);
  };

  const onPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const file = getSingleExcalidrawFile(event.clipboardData.files);
    if (!file) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    importFile(file);
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!isExcalidrawFile(file)) {
      setHint(STRINGS.invalidFile);
      return;
    }
    importFile(file);
  };

  const isDisabled = !excalidrawAPI;

  return (
    <div
      className={`launcher-splash${
        isDragOver ? " launcher-splash--drag-over" : ""
      }`}
      data-testid="launcher-splash"
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
          placeholder={STRINGS.placeholder}
          aria-label={STRINGS.label}
          disabled={isDisabled}
          onChange={(event) => {
            setQuery(event.target.value);
            setHint(null);
          }}
          onPaste={onPaste}
        />
        <button
          className="launcher-splash__submit"
          type="submit"
          disabled={isDisabled}
        >
          {STRINGS.submit}
        </button>
      </form>
      <div
        className="launcher-splash__chips"
        role="group"
        aria-label={STRINGS.templates}
      >
        {STARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            className="launcher-splash__chip"
            type="button"
            title={template.name}
            disabled={isDisabled}
            onClick={() => loadTemplate(template)}
          >
            {template.keywords[0]}
          </button>
        ))}
      </div>
      <div className="launcher-splash__footer">
        <span className="launcher-splash__drop-hint">
          {isDragOver ? STRINGS.dropActive : STRINGS.dropHint}
        </span>
        <button
          className="launcher-splash__browse"
          type="button"
          disabled={isDisabled}
          onClick={() => fileInputRef.current?.click()}
        >
          {STRINGS.browse}
        </button>
        <input
          ref={fileInputRef}
          className="launcher-splash__file-input"
          type="file"
          accept={`${EXCALIDRAW_EXTENSION},${MIME_TYPES.excalidraw}`}
          tabIndex={-1}
          onChange={onFileInputChange}
        />
      </div>
      {hint && (
        <div className="launcher-splash__hint" role="status">
          {hint}
        </div>
      )}
    </div>
  );
};
