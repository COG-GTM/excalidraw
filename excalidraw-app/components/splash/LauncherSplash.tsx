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
import {
  ArrowRightIcon,
  LoadIcon,
} from "@excalidraw/excalidraw/components/icons";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";
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

const isExcalidrawFile = (file: File) =>
  file.name.endsWith(".excalidraw") || file.type === MIME_TYPES.excalidraw;

const findExcalidrawFile = (files: FileList | null | undefined) => {
  if (!files) {
    return null;
  }
  for (const file of Array.from(files)) {
    if (isExcalidrawFile(file)) {
      return file;
    }
  }
  return null;
};

const TEMPLATE_HINT = `No template matched — try: ${STARTER_TEMPLATES.map(
  (template) => template.keywords[0],
).join(", ")}…`;

/**
 * Splash variant "launcher": a compact inline input rendered between the
 * welcome-screen heading and menu that routes a prompt to a starter template,
 * to the AI text-to-diagram dialog, or imports a dropped `.excalidraw` file.
 */
export const LauncherSplash = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const appProps = useAppProps();
  const setAppState = useExcalidrawSetAppState();
  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const aiAvailable = isAIEnabled() && appProps.aiEnabled !== false;

  const importExcalidrawFile = async (file: File) => {
    if (!excalidrawAPI) {
      return;
    }
    try {
      const result = await loadSceneOrLibraryFromBlob(file, null, null);
      if (
        result.type !== MIME_TYPES.excalidraw ||
        !isMountedRef.current ||
        excalidrawAPI.getSceneElements().length !== 0
      ) {
        return;
      }
      const { elements, appState, files } = result.data;
      const current = excalidrawAPI.getAppState();
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
      if (files && Object.keys(files).length) {
        excalidrawAPI.addFiles(Object.values(files));
      }
      excalidrawAPI.setViewport({
        target: getCommonBounds(elements),
        fit: "scale-down",
      });
    } catch (error: any) {
      if (isMountedRef.current) {
        setHint(error?.message || "Could not load that file.");
      }
    }
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    if (aiAvailable) {
      setHint(null);
      editorJotaiStore.set(chatHistoryAtom, (prev) => ({
        ...prev,
        currentPrompt: trimmed,
      }));
      trackEvent("ai", "dialog open", "ttd");
      setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
      return;
    }
    setHint(TEMPLATE_HINT);
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const { currentTarget, relatedTarget } = event;
    const NodeCtor = currentTarget.ownerDocument.defaultView?.Node;
    if (
      NodeCtor &&
      relatedTarget instanceof NodeCtor &&
      currentTarget.contains(relatedTarget)
    ) {
      return;
    }
    setIsDragging(false);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(false);
    const file = findExcalidrawFile(event.dataTransfer?.files);
    if (!file) {
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
    importExcalidrawFile(file);
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      importExcalidrawFile(file);
    }
  };

  return (
    <div
      className={clsx("launcher-splash", { "is-dragging": isDragging })}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPaste={onPaste}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <form className="launcher-splash__form" onSubmit={onSubmit}>
        <input
          className="launcher-splash__input"
          type="text"
          value={query}
          placeholder="Type a template name or describe a diagram…"
          aria-label="Template name or diagram description"
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            if (hint) {
              setHint(null);
            }
          }}
        />
        <button
          className="launcher-splash__submit"
          type="submit"
          aria-label="Create"
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
          >
            {template.name}
          </button>
        ))}
        <label className="launcher-splash__chip launcher-splash__browse">
          {LoadIcon}
          Browse…
          <input
            type="file"
            accept=".excalidraw,application/json"
            onChange={onFileChange}
          />
        </label>
      </div>
      <div className="launcher-splash__drop-hint">
        …or drop / paste an .excalidraw file here
      </div>
    </div>
  );
};
