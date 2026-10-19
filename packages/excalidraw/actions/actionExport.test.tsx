import React from "react";
import { vi } from "vitest";

import { KEYS, THEME } from "@excalidraw/common";

import { loadFromJSON, saveAsJSON } from "../data";
import { resaveAsImageWithScene } from "../data/resave";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { act, render } from "../tests/test-utils";

import {
  actionChangeExportBackground,
  actionChangeExportEmbedScene,
  actionChangeExportScale,
  actionChangeProjectName,
  actionExportWithDarkMode,
  actionLoadScene,
  actionSaveFileToDisk,
  actionSaveToActiveFile,
} from "./actionExport";

import type { ExcalidrawProps, OnExportProgress } from "../types";

vi.mock("../data", async (importOriginal) => {
  const module = await importOriginal<typeof import("../data")>();
  return {
    ...module,
    saveAsJSON: vi.fn(),
    loadFromJSON: vi.fn(),
  };
});

vi.mock("../data/resave", () => ({
  resaveAsImageWithScene: vi.fn(),
}));

const saveAsJSONMock = vi.mocked(saveAsJSON);
const loadFromJSONMock = vi.mocked(loadFromJSON);
const resaveMock = vi.mocked(resaveAsImageWithScene);

const { h } = window;

const fileHandle = (name: string) => ({ name } as FileSystemFileHandle);

const executeAsync = async (
  action: Parameters<typeof API.executeAction>[0],
) => {
  await act(async () => {
    h.app.actionManager.executeAction(action);
  });
};

const abortError = () =>
  Object.assign(new Error("aborted"), { name: "AbortError" });

const silenceConsole = (method: "error" | "warn") =>
  vi.spyOn(console, method).mockImplementation(() => {});

describe("actionExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveAsJSONMock.mockImplementation(async ({ data }) => {
      await data;
      return { fileHandle: fileHandle("saved.excalidraw") };
    });
    resaveMock.mockImplementation(async (data, handle) => {
      await data;
      return { fileHandle: handle };
    });
  });

  describe("simple appState setters", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("update export settings and the project name", () => {
      act(() => {
        h.app.actionManager.executeAction(
          actionChangeProjectName,
          "api",
          "My drawing",
        );
      });
      act(() => {
        h.app.actionManager.executeAction(actionChangeExportScale, "api", 3);
      });
      act(() => {
        h.app.actionManager.executeAction(
          actionChangeExportBackground,
          "api",
          false,
        );
      });
      act(() => {
        h.app.actionManager.executeAction(
          actionChangeExportEmbedScene,
          "api",
          true,
        );
      });

      expect(h.state.name).toBe("My drawing");
      expect(h.state.exportScale).toBe(3);
      expect(h.state.exportBackground).toBe(false);
      expect(h.state.exportEmbedScene).toBe(true);
    });

    it("exportWithDarkMode sets the session export theme override", () => {
      act(() => {
        h.app.actionManager.executeAction(
          actionExportWithDarkMode,
          "api",
          true,
        );
      });
      expect(h.app.sessionExportThemeOverride).toBe(THEME.DARK);
      expect(h.state.exportWithDarkMode).toBe(true);

      act(() => {
        h.app.actionManager.executeAction(
          actionExportWithDarkMode,
          "api",
          false,
        );
      });
      expect(h.app.sessionExportThemeOverride).toBe(THEME.LIGHT);
      expect(h.state.exportWithDarkMode).toBe(false);
    });
  });

  describe("saveToActiveFile", () => {
    it("predicate requires a file handle, the UI option and edit mode", async () => {
      await render(<Excalidraw />);
      const predicate = () =>
        actionSaveToActiveFile.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        );

      expect(predicate()).toBe(false);
      API.setAppState({ fileHandle: fileHandle("a.excalidraw") });
      expect(predicate()).toBe(true);
      API.setAppState({ viewModeEnabled: true });
      expect(predicate()).toBe(false);
    });

    it("predicate is false when saveToActiveFile is disabled via UIOptions", async () => {
      await render(
        <Excalidraw
          UIOptions={{ canvasActions: { saveToActiveFile: false } }}
        />,
      );
      API.setAppState({ fileHandle: fileHandle("a.excalidraw") });
      expect(
        actionSaveToActiveFile.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);
    });

    it("saves JSON to the active file handle and shows the filename", async () => {
      await render(<Excalidraw name="drawing" />);
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([rect]);
      const handle = fileHandle("drawing.excalidraw");
      API.setAppState({ fileHandle: handle });

      await executeAsync(actionSaveToActiveFile);

      expect(saveAsJSONMock).toHaveBeenCalledTimes(1);
      const args = saveAsJSONMock.mock.calls[0][0];
      expect(args.filename).toBe("drawing");
      expect(args.fileHandle).toBe(handle);
      const data = await args.data;
      expect(data.elements.map((el) => el.id)).toEqual([rect.id]);
      expect(data.files).toBe(h.app.files);
      expect(resaveMock).not.toHaveBeenCalled();
      expect(h.state.fileHandle?.name).toBe("saved.excalidraw");
      expect(h.state.toast).toEqual({
        message: 'Saved to "saved.excalidraw"',
        duration: 1500,
      });
    });

    it("resaves image file handles with the embedded scene", async () => {
      await render(<Excalidraw name="drawing" />);
      const handle = fileHandle("drawing.png");
      API.setAppState({ fileHandle: handle });

      await executeAsync(actionSaveToActiveFile);

      expect(saveAsJSONMock).not.toHaveBeenCalled();
      expect(resaveMock).toHaveBeenCalledTimes(1);
      expect(resaveMock.mock.calls[0][1]).toBe(handle);
      expect(resaveMock.mock.calls[0][2]).toBe("drawing");
      expect(h.state.toast?.message).toBe('Saved to "drawing.png"');
    });

    it("shows a generic toast when the saved handle has no name", async () => {
      await render(<Excalidraw />);
      API.setAppState({ fileHandle: fileHandle("a.excalidraw") });
      saveAsJSONMock.mockResolvedValueOnce({ fileHandle: null });

      await executeAsync(actionSaveToActiveFile);

      expect(h.state.toast?.message).toBe("File saved.");
    });

    it.each([
      ["AbortError", abortError(), "warn"],
      ["other errors", new Error("disk full"), "error"],
    ] as const)(
      "clears the toast and logs on %s",
      async (_, error, logLevel) => {
        await render(<Excalidraw />);
        const handle = fileHandle("a.excalidraw");
        API.setAppState({
          fileHandle: handle,
          toast: { message: "previous" },
        });
        saveAsJSONMock.mockRejectedValueOnce(error);
        const log = silenceConsole(logLevel);

        await executeAsync(actionSaveToActiveFile);

        expect(log).toHaveBeenCalledWith(error);
        expect(h.state.toast).toBe(null);
        expect(h.state.fileHandle).toBe(handle);
        log.mockRestore();
      },
    );

    it("ignores re-entrant saves while one is in progress", async () => {
      await render(<Excalidraw />);
      API.setAppState({ fileHandle: fileHandle("a.excalidraw") });
      let resolveSave!: () => void;
      saveAsJSONMock.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSave = () =>
              resolve({ fileHandle: fileHandle("a.excalidraw") });
          }),
      );

      await act(async () => {
        h.app.actionManager.executeAction(actionSaveToActiveFile);
        h.app.actionManager.executeAction(actionSaveToActiveFile);
      });
      expect(saveAsJSONMock).toHaveBeenCalledTimes(1);

      await act(async () => resolveSave());
      expect(h.state.toast?.message).toBe('Saved to "a.excalidraw"');

      await executeAsync(actionSaveToActiveFile);
      expect(saveAsJSONMock).toHaveBeenCalledTimes(2);
    });

    it("matches Ctrl+S but not Ctrl+Shift+S", () => {
      expect(
        actionSaveToActiveFile.keyTest!({
          key: KEYS.S,
          ctrlKey: true,
          shiftKey: false,
        } as KeyboardEvent),
      ).toBe(true);
      expect(
        actionSaveToActiveFile.keyTest!({
          key: KEYS.S,
          ctrlKey: true,
          shiftKey: true,
        } as KeyboardEvent),
      ).toBe(false);
    });
  });

  describe("onExport host callback", () => {
    const renderWithOnExport = async (
      onExport: ExcalidrawProps["onExport"],
    ) => {
      await render(<Excalidraw onExport={onExport} />);
      API.setAppState({ fileHandle: fileHandle("a.excalidraw") });
    };

    it("awaits a promise-returning onExport and shows a progress toast", async () => {
      let resolveExport!: () => void;
      const onExport = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveExport = resolve;
          }),
      );
      await renderWithOnExport(onExport);
      const setAppState = vi.spyOn(h.app, "setAppState");

      await executeAsync(actionSaveToActiveFile);

      expect(onExport).toHaveBeenCalledTimes(1);
      const [type, data, options] = onExport.mock.calls[0] as any;
      expect(type).toBe("json");
      expect(data.elements).toBe(h.elements);
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(setAppState).toHaveBeenCalledWith({
        toast: expect.objectContaining({
          message: "Preparing to save...",
          duration: Infinity,
        }),
      });
      expect(h.state.toast?.message).not.toBe('Saved to "saved.excalidraw"');

      await act(async () => resolveExport());
      expect(h.state.toast?.message).toBe('Saved to "saved.excalidraw"');
    });

    it("renders progress updates yielded by an async generator", async () => {
      const onExport = vi.fn(async function* () {
        yield { type: "progress" as const, message: "Loading images" };
        yield { type: "progress" as const, progress: 0.5 };
        // "done" isn't part of the public OnExportProgress type, but is handled
        yield { type: "done" } as unknown as OnExportProgress;
        yield { type: "progress" as const, message: "never shown" };
      });
      await renderWithOnExport(onExport);
      const setAppState = vi.spyOn(h.app, "setAppState");

      await executeAsync(actionSaveToActiveFile);

      const toastMessages = setAppState.mock.calls.map(
        ([state]) => (state as any).toast?.message,
      );
      expect(toastMessages).toContain("Loading images");
      expect(toastMessages).not.toContain("never shown");
      // the numeric progress renders a progress bar element
      expect(toastMessages.some((msg) => msg && typeof msg === "object")).toBe(
        true,
      );
      expect(saveAsJSONMock).toHaveBeenCalledTimes(1);
      expect(h.state.toast?.message).toBe('Saved to "saved.excalidraw"');
    });

    it("still saves when the generator completes without a done message", async () => {
      const onExport = vi.fn(async function* () {
        yield { type: "progress" as const, message: "step" };
      });
      await renderWithOnExport(onExport);

      await executeAsync(actionSaveToActiveFile);

      expect(h.state.toast?.message).toBe('Saved to "saved.excalidraw"');
    });

    it.each([
      ["an AbortError", abortError(), "warn"],
      ["a regular error", new Error("host failed"), "error"],
    ] as const)(
      "still saves the original data if onExport throws %s",
      async (_, error, logLevel) => {
        const onExport = vi.fn(() => {
          throw error;
        });
        await renderWithOnExport(onExport);
        const log = silenceConsole(logLevel);

        await executeAsync(actionSaveToActiveFile);

        expect(log).toHaveBeenCalled();
        expect(saveAsJSONMock).toHaveBeenCalledTimes(1);
        expect(h.state.toast?.message).toBe('Saved to "saved.excalidraw"');
        log.mockRestore();
      },
    );

    it("waits for the editor to finish loading before handling onExport", async () => {
      const onExport = vi.fn(() => Promise.resolve());
      await renderWithOnExport(onExport);
      API.setAppState({ isLoading: true });

      await executeAsync(actionSaveToActiveFile);
      expect(h.state.toast?.message).toBe("Preparing to save...");

      await act(async () => {
        API.setAppState({ isLoading: false });
      });
      expect(h.state.toast?.message).toBe('Saved to "saved.excalidraw"');
    });
  });

  describe("saveFileToDisk", () => {
    beforeEach(async () => {
      await render(<Excalidraw name="drawing" />);
    });

    it("saves to a new file and closes the dialog", async () => {
      API.setAppState({
        fileHandle: fileHandle("old.excalidraw"),
        openDialog: { name: "jsonExport" },
      });

      await executeAsync(actionSaveFileToDisk);

      expect(saveAsJSONMock).toHaveBeenCalledTimes(1);
      expect(saveAsJSONMock.mock.calls[0][0]).toMatchObject({
        filename: "drawing",
        fileHandle: null,
      });
      expect(h.state.openDialog).toBe(null);
      expect(h.state.fileHandle?.name).toBe("saved.excalidraw");
      expect(h.state.toast).toEqual({ message: "File saved.", duration: 3000 });
    });

    it.each([
      ["AbortError", abortError(), "warn"],
      ["other errors", new Error("disk full"), "error"],
    ] as const)(
      "clears the toast and logs on %s",
      async (_, error, logLevel) => {
        API.setAppState({
          openDialog: { name: "jsonExport" },
          toast: { message: "previous" },
        });
        saveAsJSONMock.mockRejectedValueOnce(error);
        const log = silenceConsole(logLevel);

        await executeAsync(actionSaveFileToDisk);

        expect(log).toHaveBeenCalledWith(error);
        expect(h.state.toast).toBe(null);
        expect(h.state.openDialog).toEqual({ name: "jsonExport" });
        log.mockRestore();
      },
    );

    it("matches Ctrl+Shift+S regardless of key case", () => {
      expect(
        actionSaveFileToDisk.keyTest!({
          key: "S",
          ctrlKey: true,
          shiftKey: true,
        } as KeyboardEvent),
      ).toBe(true);
      expect(
        actionSaveFileToDisk.keyTest!({
          key: "s",
          ctrlKey: true,
          shiftKey: false,
        } as KeyboardEvent),
      ).toBe(false);
    });
  });

  describe("loadScene", () => {
    it("predicate respects UIOptions and view mode", async () => {
      await render(
        <Excalidraw UIOptions={{ canvasActions: { loadScene: false } }} />,
      );
      expect(
        actionLoadScene.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(false);

      await render(<Excalidraw />);
      expect(
        actionLoadScene.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(true);
      API.setAppState({ viewModeEnabled: true });
      expect(
        actionLoadScene.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(false);
    });

    it("replaces the scene with the loaded file", async () => {
      await render(<Excalidraw />);
      const existing = API.createElement({ type: "rectangle" });
      API.setElements([existing]);
      const loaded = API.createElement({ type: "ellipse", id: "loaded" });
      loadFromJSONMock.mockResolvedValueOnce({
        elements: [loaded],
        appState: { ...h.state, viewBackgroundColor: "#ffc9c9" },
        files: {},
      } as any);

      await executeAsync(actionLoadScene);

      expect(loadFromJSONMock).toHaveBeenCalledTimes(1);
      expect(h.elements.map((el) => el.id)).toEqual([loaded.id]);
      expect(h.state.viewBackgroundColor).toBe("#ffc9c9");
    });

    it("ignores AbortError (user cancelled the file picker)", async () => {
      await render(<Excalidraw />);
      const existing = API.createElement({ type: "rectangle" });
      API.setElements([existing]);
      loadFromJSONMock.mockRejectedValueOnce(abortError());
      const warn = silenceConsole("warn");

      await executeAsync(actionLoadScene);

      expect(warn).toHaveBeenCalled();
      expect(h.elements.map((el) => el.id)).toEqual([existing.id]);
      expect(h.state.errorMessage).toBe(null);
      warn.mockRestore();
    });

    it("shows an error message when loading fails", async () => {
      await render(<Excalidraw />);
      const existing = API.createElement({ type: "rectangle" });
      API.setElements([existing]);
      loadFromJSONMock.mockRejectedValueOnce(new Error("invalid file"));

      await executeAsync(actionLoadScene);

      expect(h.state.errorMessage).toBe("invalid file");
      expect(h.elements.map((el) => el.id)).toEqual([existing.id]);
    });

    it("matches Ctrl+O", () => {
      expect(
        actionLoadScene.keyTest!({
          key: KEYS.O,
          ctrlKey: true,
        } as KeyboardEvent),
      ).toBe(true);
      expect(
        actionLoadScene.keyTest!({
          key: KEYS.O,
          ctrlKey: false,
        } as KeyboardEvent),
      ).toBe(false);
    });
  });
});
