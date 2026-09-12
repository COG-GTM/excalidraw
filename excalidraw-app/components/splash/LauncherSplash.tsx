import { MIME_TYPES } from "@excalidraw/common";
import { CaptureUpdateAction, getCommonBounds } from "@excalidraw/element";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  useAppProps,
  useExcalidrawSetAppState,
} from "@excalidraw/excalidraw/components/App";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import {
  ArrowRightIcon,
  LoadIcon,
} from "@excalidraw/excalidraw/components/icons";
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

const isExcalidrawFile = (file: File) =>
  /\.excalidraw$/i.test(file.name) || file.type === MIME_TYPES.json;

/**
 * Variant C (`VITE_APP_SPLASH_VARIANT=launcher`): compact inline launcher
 * (prompt input, template keyword chips, file drop/browse) rendered between
 * the welcome heading and the menu.
 */
export const LauncherSplash: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const appProps = useAppProps();
  const setAppState = useExcalidrawSetAppState();
  const setChatHistory = useSetAtom(chatHistoryAtom);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef(true);

  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const importFile = useCallback(
    async (file: File) => {
      if (!excalidrawAPI) {
        return;
      }
      setHint(null);
      setError(null);
      try {
        const result = await loadSceneOrLibraryFromBlob(
          file,
          excalidrawAPI.getAppState(),
          excalidrawAPI.getSceneElements(),
        );
        // discard stale results: the user may have unmounted the welcome
        // screen (by drawing) while the file was being read
        if (!isMountedRef.current || excalidrawAPI.getSceneElements().length) {
          return;
        }
        if (result.type !== MIME_TYPES.excalidraw) {
          setError("That file is a library, not a scene.");
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
        excalidrawAPI.addFiles(Object.values(files));
        if (elements.length) {
          excalidrawAPI.setViewport({
            target: getCommonBounds(elements),
            fit: "scale-down",
          });
        }
      } catch {
        if (isMountedRef.current) {
          setError("Couldn't read that file — is it a valid .excalidraw file?");
        }
      }
    },
    [excalidrawAPI],
  );

  useEffect(() => {
    const ownerDocument = containerRef.current?.ownerDocument;
    if (!ownerDocument) {
      return;
    }
    const onPaste = (event: ClipboardEvent) => {
      const file = event.clipboardData?.files[0];
      if (file && isExcalidrawFile(file)) {
        event.preventDefault();
        event.stopPropagation();
        importFile(file);
      }
    };
    ownerDocument.addEventListener("paste", onPaste, true);
    return () => {
      ownerDocument.removeEventListener("paste", onPaste, true);
    };
  }, [importFile]);

  const onSubmit = () => {
    if (!excalidrawAPI) {
      return;
    }
    const prompt = query.trim();
    if (!prompt) {
      return;
    }
    setError(null);

    const template = findTemplateByKeyword(prompt);
    if (template) {
      setHint(null);
      loadTemplateIntoScene(excalidrawAPI, template);
      return;
    }

    if (isAIEnabled() && appProps.aiEnabled !== false) {
      setHint(null);
      setChatHistory((chatHistory) => ({
        ...chatHistory,
        currentPrompt: prompt,
      }));
      trackEvent("ai", "dialog open", "ttd");
      setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
      return;
    }

    setHint("No matching template — try one of the chips below");
  };

  return (
    <div
      ref={containerRef}
      className={`launcher-splash${
        isDraggedOver ? " launcher-splash--dragged-over" : ""
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDraggedOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDraggedOver(true);
      }}
      onDragLeave={(event) => {
        const ownerWindow = event.currentTarget.ownerDocument.defaultView;
        const relatedTarget = event.relatedTarget;
        // ignore drags moving between the launcher's own children
        if (
          !ownerWindow ||
          !(relatedTarget instanceof ownerWindow.Node) ||
          !event.currentTarget.contains(relatedTarget)
        ) {
          setIsDraggedOver(false);
        }
      }}
      onDrop={(event) => {
        setIsDraggedOver(false);
        const file = event.dataTransfer.files[0];
        // let images & everything else fall through to the editor's own
        // drop handling
        if (!file || !isExcalidrawFile(file)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        importFile(file);
      }}
    >
      <div className="launcher-splash__prompt">
        <input
          className="launcher-splash__input"
          type="text"
          value={query}
          placeholder="What do you want to draw? e.g. kanban, flowchart, or describe it…"
          aria-label="What do you want to draw?"
          onChange={(event) => setQuery(event.target.value)}
          // keystrokes would otherwise be handled as canvas tool shortcuts
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
            }
          }}
          onKeyUp={(event) => event.stopPropagation()}
        />
        <button
          type="button"
          className="launcher-splash__submit"
          aria-label="Start drawing"
          onClick={onSubmit}
        >
          {ArrowRightIcon}
        </button>
      </div>

      <div className="launcher-splash__chips">
        {STARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="launcher-splash__chip"
            title={template.description}
            onClick={() => {
              if (excalidrawAPI) {
                setHint(null);
                setError(null);
                loadTemplateIntoScene(excalidrawAPI, template);
              }
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
          {LoadIcon}
          Browse…
        </button>
        <span className="launcher-splash__import-hint">
          or drop / paste an .excalidraw file here
        </span>
        <input
          ref={fileInputRef}
          className="launcher-splash__file-input"
          type="file"
          accept=".excalidraw,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              importFile(file);
            }
          }}
        />
      </div>

      {hint && <div className="launcher-splash__hint">{hint}</div>}
      {error && <div className="launcher-splash__error">{error}</div>}
    </div>
  );
};
