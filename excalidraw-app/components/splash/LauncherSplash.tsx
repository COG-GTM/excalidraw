import {
  CaptureUpdateAction,
  getCommonBounds,
  loadSceneOrLibraryFromBlob,
  MIME_TYPES,
} from "@excalidraw/excalidraw";
import { useAppProps } from "@excalidraw/excalidraw/components/App";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import {
  ArrowRightIcon,
  LoadIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import {
  STARTER_TEMPLATES,
  findTemplateByKeyword,
  loadTemplateIntoScene,
} from "../../data/templates";

import { isAIEnabled } from "./splashVariant";

import "./LauncherSplash.scss";

const PLACEHOLDER =
  "Describe a diagram, name a template, or drop a .excalidraw file";

const isSceneEmpty = (excalidrawAPI: ExcalidrawImperativeAPI) =>
  excalidrawAPI.getSceneElements().length === 0;

const isExcalidrawFile = (file: File) =>
  file.name.toLowerCase().endsWith(".excalidraw") ||
  file.type === MIME_TYPES.excalidraw;

/**
 * Variant C (`VITE_APP_SPLASH_VARIANT=launcher`).
 *
 * Rendered inline inside `welcome-screen-center` (between the heading and the
 * menu): a compact "start canvas" input routing to template / AI / import.
 */
export const LauncherSplash = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const appProps = useAppProps();
  const setChatHistory = useSetAtom(chatHistoryAtom);

  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const aiEnabled = isAIEnabled() && appProps.aiEnabled !== false;

  const loadScene = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      files: BinaryFiles,
      appState?: Partial<AppState> | null,
    ) => {
      if (!excalidrawAPI) {
        return;
      }

      // scene-level settings saved with the file, falling back to the current
      // (empty) canvas
      const current = excalidrawAPI.getAppState();

      excalidrawAPI.updateScene({
        elements,
        appState: {
          viewBackgroundColor:
            appState?.viewBackgroundColor ?? current.viewBackgroundColor,
          gridSize: appState?.gridSize ?? current.gridSize,
          gridStep: appState?.gridStep ?? current.gridStep,
          gridModeEnabled: appState?.gridModeEnabled ?? current.gridModeEnabled,
          selectedElementIds: {},
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      excalidrawAPI.addFiles(Object.values(files));

      if (elements.length) {
        excalidrawAPI.setViewport({
          target: getCommonBounds(elements),
          fit: "scale-down",
          animation: false,
        });
      }
    },
    [excalidrawAPI],
  );

  const importFile = useCallback(
    async (file: File) => {
      if (!excalidrawAPI) {
        return;
      }

      setHint(null);

      try {
        const contents = await loadSceneOrLibraryFromBlob(file, null, null);

        // the file may have been parsed after the component unmounted, or
        // after the canvas stopped being empty
        if (!isMountedRef.current || !isSceneEmpty(excalidrawAPI)) {
          return;
        }

        if (contents.type !== MIME_TYPES.excalidraw) {
          setHint("That file is a library, not a scene.");
          return;
        }

        const { elements, files, appState } = contents.data;
        loadScene(elements, files, appState);
      } catch (error: any) {
        if (isMountedRef.current) {
          setHint("Couldn't read that file. Is it a valid .excalidraw scene?");
        }
        console.warn(error);
      }
    },
    [excalidrawAPI, loadScene],
  );

  const submit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || !excalidrawAPI) {
        return;
      }

      const template = findTemplateByKeyword(trimmed);
      if (template) {
        setHint(null);
        setQuery("");
        loadTemplateIntoScene(excalidrawAPI, template);
        return;
      }

      if (aiEnabled) {
        setHint(null);
        setChatHistory((chatHistory) => ({
          ...chatHistory,
          currentPrompt: trimmed,
        }));
        excalidrawAPI.updateScene({
          appState: { openDialog: { name: "ttd", tab: "text-to-diagram" } },
        });
        return;
      }

      setHint(
        "No template matched. Try a keyword like “kanban” or “flowchart”, or import a .excalidraw file.",
      );
    },
    [aiEnabled, excalidrawAPI, setChatHistory],
  );

  if (!excalidrawAPI) {
    return null;
  }

  return (
    <div
      className={`launcher-splash${
        isDraggedOver ? " launcher-splash--dragged-over" : ""
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        dragCounterRef.current += 1;
        setIsDraggedOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragCounterRef.current = Math.max(dragCounterRef.current - 1, 0);
        if (!dragCounterRef.current) {
          setIsDraggedOver(false);
        }
      }}
      onDrop={(event) => {
        dragCounterRef.current = 0;
        setIsDraggedOver(false);

        // let anything that isn't a scene (images, …) reach the editor's own
        // drop handler
        const file = event.dataTransfer.files[0];
        if (!file || !isExcalidrawFile(file)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        importFile(file);
      }}
      onPaste={(event) => {
        const file = event.clipboardData.files[0];
        if (file && isExcalidrawFile(file)) {
          event.preventDefault();
          event.stopPropagation();
          importFile(file);
        }
      }}
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
          placeholder={PLACEHOLDER}
          aria-label={PLACEHOLDER}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          className="launcher-splash__submit"
          type="submit"
          aria-label="Start canvas"
          disabled={!query.trim()}
        >
          {ArrowRightIcon}
        </button>
      </form>

      <div className="launcher-splash__chips">
        {STARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            className="launcher-splash__chip"
            type="button"
            title={template.description}
            onClick={() => {
              setHint(null);
              setQuery("");
              loadTemplateIntoScene(excalidrawAPI, template);
            }}
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
          {LoadIcon}
          Browse…
        </button>
        <span className="launcher-splash__hint">
          {hint ?? "…or drop / paste a .excalidraw file here"}
        </span>
        <input
          ref={fileInputRef}
          className="launcher-splash__file-input"
          type="file"
          accept=".excalidraw,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // allow re-picking the same file
            event.target.value = "";
            if (file) {
              importFile(file);
            }
          }}
        />
      </div>
    </div>
  );
};
LauncherSplash.displayName = "LauncherSplash";
