import {
  CaptureUpdateAction,
  MIME_TYPES,
  getCommonBounds,
  loadSceneOrLibraryFromBlob,
} from "@excalidraw/excalidraw";
import { useExcalidrawSetAppState } from "@excalidraw/excalidraw/components/App";
import {
  ArrowRightIcon,
  LoadIcon,
} from "@excalidraw/excalidraw/components/icons";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { useSetAtom } from "@excalidraw/excalidraw/editor-jotai";
import clsx from "clsx";
import { useCallback, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  STARTER_TEMPLATES,
  findTemplateByKeyword,
  loadTemplateIntoScene,
} from "../../data/templates";

import { isAIEnabled } from "./splashVariant";

import "./LauncherSplash.scss";

import type { StarterTemplate } from "../../data/templates";

/** inputs longer than this are treated as natural-language prompts */
const MAX_KEYWORD_WORDS = 3;

const ACCEPTED_FILE_TYPES = ".excalidraw,.json,application/json";

type LauncherMessage = { type: "info" | "error"; text: string };

const wordCount = (text: string) => text.trim().split(/\s+/).length;

const templateHint = () =>
  `No matching template — try: ${STARTER_TEMPLATES.map(
    (template) => template.keywords[0],
  ).join(", ")}`;

/**
 * Variant C (`VITE_APP_SPLASH_VARIANT=launcher`).
 *
 * Rendered inline inside `welcome-screen-center` (between the heading and the
 * menu); a compact "Start canvas" input that routes to a starter template
 * (keyword), the text-to-diagram AI dialog (prompt) or a dropped / pasted /
 * browsed `.excalidraw` file (import).
 */
export const LauncherSplash = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const setAppState = useExcalidrawSetAppState();
  const setChatHistory = useSetAtom(chatHistoryAtom);

  const [value, setValue] = useState("");
  const [message, setMessage] = useState<LauncherMessage | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const aiEnabled = isAIEnabled();
  const disabled = !excalidrawAPI || isImporting;

  const loadTemplate = useCallback(
    (template: StarterTemplate) => {
      if (!excalidrawAPI) {
        return;
      }
      setMessage(null);
      loadTemplateIntoScene(excalidrawAPI, template);
    },
    [excalidrawAPI],
  );

  const openTextToDiagram = useCallback(
    (prompt: string) => {
      setChatHistory((prev) => ({ ...prev, currentPrompt: prompt }));
      setAppState({ openDialog: { name: "ttd", tab: "text-to-diagram" } });
    },
    [setAppState, setChatHistory],
  );

  const importFile = useCallback(
    async (file: File) => {
      if (!excalidrawAPI) {
        return;
      }
      setIsImporting(true);
      setMessage(null);
      try {
        const result = await loadSceneOrLibraryFromBlob(
          file,
          excalidrawAPI.getAppState(),
          excalidrawAPI.getSceneElements(),
        );
        if (result.type !== MIME_TYPES.excalidraw) {
          throw new Error("Not a scene file");
        }
        const { elements, appState, files } = result.data;
        excalidrawAPI.updateScene({
          elements,
          appState,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        const binaryFiles = Object.values(files);
        if (binaryFiles.length) {
          excalidrawAPI.addFiles(binaryFiles);
        }
        if (elements.length) {
          excalidrawAPI.setViewport({
            target: getCommonBounds(elements),
            fit: "scale-down",
            animation: false,
          });
        }
      } catch (error) {
        console.error(error);
        setMessage({
          type: "error",
          text: `Couldn't open "${file.name}" — drop a valid .excalidraw file.`,
        });
      } finally {
        setIsImporting(false);
      }
    },
    [excalidrawAPI],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = value.trim();
    if (disabled || !query) {
      return;
    }

    const isKeyword = wordCount(query) <= MAX_KEYWORD_WORDS;
    const template = isKeyword ? findTemplateByKeyword(query) : null;
    if (template) {
      loadTemplate(template);
      return;
    }

    if (aiEnabled) {
      openTextToDiagram(query);
      return;
    }

    const fallback = isKeyword ? null : findTemplateByKeyword(query);
    if (fallback) {
      loadTemplate(fallback);
      return;
    }

    setMessage({ type: "info", text: templateHint() });
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const file = event.clipboardData?.files?.[0];
    if (file) {
      event.preventDefault();
      importFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    // keep Excalidraw's own canvas drop handler from also running
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    if (disabled) {
      return;
    }
    const file = event.dataTransfer.files?.[0];
    if (file) {
      importFile(file);
    } else {
      setMessage({
        type: "error",
        text: "Drop a .excalidraw file to open it.",
      });
    }
  };

  const handleBrowse = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      importFile(file);
    }
  };

  return (
    <div
      className={clsx("launcher-splash", {
        "launcher-splash--dragover": isDragOver,
        "launcher-splash--disabled": disabled,
      })}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="launcher-splash"
    >
      <form className="launcher-splash__form" onSubmit={handleSubmit}>
        <input
          className="launcher-splash__input"
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (message) {
              setMessage(null);
            }
          }}
          onPaste={handlePaste}
          disabled={disabled}
          placeholder={
            aiEnabled
              ? "Describe a diagram, type a template name, or drop a .excalidraw file…"
              : "Type a template name (e.g. kanban) or drop a .excalidraw file…"
          }
          aria-label="Start canvas"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="launcher-splash__submit"
          disabled={disabled || !value.trim()}
          title="Start canvas (Enter)"
        >
          <span>Start canvas</span>
          {ArrowRightIcon}
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
            disabled={disabled}
            onClick={() => loadTemplate(template)}
          >
            {template.name}
          </button>
        ))}
      </div>

      <div className="launcher-splash__footer excalifont">
        <span className="launcher-splash__hint">
          {isDragOver
            ? "Release to open the file"
            : "Drop or paste a .excalidraw file here, or"}
        </span>
        <button
          type="button"
          className="launcher-splash__browse"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          {LoadIcon}
          <span>Browse…</span>
        </button>
        <input
          ref={fileInputRef}
          className="launcher-splash__file-input"
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleBrowse}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      {message && (
        <div
          className={clsx(
            "launcher-splash__message",
            `launcher-splash__message--${message.type}`,
          )}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}
    </div>
  );
};
LauncherSplash.displayName = "LauncherSplash";
