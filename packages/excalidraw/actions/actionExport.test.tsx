import React from "react";
import { vi } from "vitest";

import { KEYS, THEME } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

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

import type { Action } from "./types";
import type { ExcalidrawProps } from "../types";

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

const { h } = window;

const saveAsJSONMock = vi.mocked(saveAsJSON);
const loadFromJSONMock = vi.mocked(loadFromJSON);
const resaveMock = vi.mocked(resaveAsImageWithScene);

const fileHandle = (name: string) => ({ name } as FileSystemFileHandle);

const makeError = (name: string, message = name) => {
  const error = new Error(message);
  error.name = name;
  return error;
};

const executeWithValue = (action: Action, value: unknown) => {
  act(() => {
    h.app.actionManager.executeAction(action, "api", value);
  });
};

const keyEvent = (init: KeyboardEventInit) =>
  new KeyboardEvent("keydown", init);

describe("actionExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // resolve the (possibly onExport-delayed) data like the real saveAsJSON
    saveAsJSONMock.mockImplementation(async ({ data, fileHandle }) => {
      await data;
      return { fileHandle };
    });
    resaveMock.mockImplementation(async (data, fileHandle) => {
      await data;
      return { fileHandle };
    });
  });

  describe("export settings", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("changeProjectName sets appState.name", () => {
      executeWithValue(actionChangeProjectName, "My drawing");
      expect(h.state.name).toBe("My drawing");
      expect(h.app.getName()).toBe("My drawing");
    });

    it("changeExportScale, changeExportBackground and changeExportEmbedScene set their flags", () => {
      executeWithValue(actionChangeExportScale, 3);
      expect(h.state.exportScale).toBe(3);

      executeWithValue(actionChangeExportBackground, false);
      expect(h.state.exportBackground).toBe(false);
      executeWithValue(actionChangeExportBackground, true);
      expect(h.state.exportBackground).toBe(true);

      executeWithValue(actionChangeExportEmbedScene, true);
      expect(h.state.exportEmbedScene).toBe(true);
    });

    it("exportWithDarkMode sets the session export theme override", () => {
      const dark = actionExportWithDarkMode.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        true,
        h.app,
      );
      expect(h.app.sessionExportThemeOverride).toBe(THEME.DARK);
      expect(dark).toMatchObject({
        appState: { exportWithDarkMode: true },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });

      const light = actionExportWithDarkMode.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        false,
        h.app,
      );
      expect(h.app.sessionExportThemeOverride).toBe(THEME.LIGHT);
      expect(light).toMatchObject({ appState: { exportWithDarkMode: false } });
    });
  });

  describe("actionSaveToActiveFile", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("predicate requires a file handle and edit mode", () => {
      const predicate = () =>
        actionSaveToActiveFile.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        );

      expect(predicate()).toBe(false);

      API.setAppState({ fileHandle: fileHandle("scene.excalidraw") });
      expect(predicate()).toBe(true);

      API.setAppState({ viewModeEnabled: true });
      expect(predicate()).toBe(false);
    });

    it("keyTest matches Ctrl/Cmd+S without Shift", () => {
      const keyTest = (init: KeyboardEventInit) =>
        actionSaveToActiveFile.keyTest!(keyEvent(init));
      expect(keyTest({ key: KEYS.S, ctrlKey: true })).toBe(true);
      expect(keyTest({ key: KEYS.S, ctrlKey: true, shiftKey: true })).toBe(
        false,
      );
      expect(keyTest({ key: KEYS.S })).toBe(false);
    });

    it("saves JSON to the active file handle and shows its name", async () => {
      const handle = fileHandle("scene.excalidraw");
      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);
      API.setAppState({ fileHandle: handle, name: "scene" });

      const result = await actionSaveToActiveFile.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(saveAsJSONMock).toHaveBeenCalledTimes(1);
      const args = saveAsJSONMock.mock.calls[0][0];
      expect(args.filename).toBe("scene");
      expect(args.fileHandle).toBe(handle);
      const data = await args.data;
      expect(data.elements.map((el) => el.id)).toEqual(["rect"]);
      expect(data.files).toBe(h.app.files);
      expect(resaveMock).not.toHaveBeenCalled();
      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          fileHandle: handle,
          toast: { message: 'Saved to "scene.excalidraw"', duration: 1500 },
        },
      });
    });

    it("re-saves into an image file handle with the embedded scene", async () => {
      const handle = fileHandle("scene.png");
      API.setAppState({ fileHandle: handle });

      const result = await actionSaveToActiveFile.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(resaveMock).toHaveBeenCalledTimes(1);
      expect(resaveMock.mock.calls[0][1]).toBe(handle);
      expect(saveAsJSONMock).not.toHaveBeenCalled();
      expect((result as any).appState.fileHandle).toBe(handle);
    });

    it("shows a generic toast when the saved handle has no name", async () => {
      saveAsJSONMock.mockResolvedValueOnce({ fileHandle: null });
      API.setAppState({ fileHandle: fileHandle("scene.excalidraw") });

      const result = await actionSaveToActiveFile.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect((result as any).appState.toast.message).toBe("File saved.");
    });

    it("clears the toast and aborts onExport when saving fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      let signal: AbortSignal | undefined;
      const onExport: ExcalidrawProps["onExport"] = (_type, _data, opts) => {
        signal = opts.signal;
      };
      await render(<Excalidraw onExport={onExport} />);
      saveAsJSONMock.mockRejectedValueOnce(new Error("disk full"));
      API.setAppState({ fileHandle: fileHandle("scene.excalidraw") });

      const result = await actionSaveToActiveFile.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: { toast: null },
      });
      expect(signal?.aborted).toBe(true);
      expect(consoleError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "disk full" }),
      );
      consoleError.mockRestore();
    });

    it("only warns when the user aborts the save", async () => {
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const consoleError = vi.spyOn(console, "error");
      saveAsJSONMock.mockRejectedValueOnce(makeError("AbortError"));
      API.setAppState({ fileHandle: fileHandle("scene.excalidraw") });

      const result = await actionSaveToActiveFile.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect((result as any).appState.toast).toBe(null);
      expect(consoleWarn).toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      consoleWarn.mockRestore();
      consoleError.mockRestore();
    });

    it("ignores a second save while one is in progress", async () => {
      API.setAppState({ fileHandle: fileHandle("scene.excalidraw") });

      const first = actionSaveToActiveFile.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );
      const second = await actionSaveToActiveFile.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(second).toBe(false);
      await first;
      expect(saveAsJSONMock).toHaveBeenCalledTimes(1);

      // the lock is released once the first save finishes
      await actionSaveToActiveFile.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );
      expect(saveAsJSONMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("onExport host hook", () => {
    it("is called with the scene and its progress is shown as a toast", async () => {
      const onExport = vi.fn<NonNullable<ExcalidrawProps["onExport"]>>(
        async function* () {
          yield { type: "progress", message: "Uploading" };
          yield { type: "progress", message: "Uploading", progress: 0.5 };
          // runtime supports "done" though OnExportProgress does not type it
          yield { type: "done" } as any;
          yield { type: "progress", message: "never shown" };
        },
      );
      await render(<Excalidraw onExport={onExport} />);
      const setAppState = vi.spyOn(h.app, "setAppState");
      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);

      await actionSaveFileToDisk.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(onExport).toHaveBeenCalledTimes(1);
      const [type, data, opts] = onExport.mock.calls[0];
      expect(type).toBe("json");
      expect(data.elements.map((el) => el.id)).toEqual(["rect"]);
      expect(data.files).toBe(h.app.files);
      expect(opts.signal).toBeInstanceOf(AbortSignal);
      const toasts = setAppState.mock.calls.map(
        ([state]) => (state as any).toast,
      );
      expect(toasts).toHaveLength(2);
      expect(toasts[0]).toEqual({ message: "Uploading", duration: Infinity });
      expect(toasts[1].duration).toBe(Infinity);
      expect(React.isValidElement(toasts[1].message)).toBe(true);
      expect(saveAsJSONMock).toHaveBeenCalledTimes(1);
    });

    it("shows the default progress toast while a returned promise is pending", async () => {
      const onExport: ExcalidrawProps["onExport"] = () => Promise.resolve();
      await render(<Excalidraw onExport={onExport} />);
      const setAppState = vi.spyOn(h.app, "setAppState");

      await actionSaveFileToDisk.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(setAppState).toHaveBeenCalledTimes(1);
      expect(setAppState).toHaveBeenCalledWith({
        toast: { message: "Preparing to save...", duration: Infinity },
      });
    });

    it("still saves the original data when onExport throws", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const onExport = vi
        .fn<NonNullable<ExcalidrawProps["onExport"]>>()
        .mockRejectedValueOnce(new Error("host failed"))
        .mockRejectedValueOnce(makeError("AbortError"));
      await render(<Excalidraw onExport={onExport} />);
      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);

      const result = await actionSaveFileToDisk.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );
      expect(consoleError).toHaveBeenCalledWith(
        "Error during props.onExport() handling",
        expect.objectContaining({ message: "host failed" }),
      );
      const data = await saveAsJSONMock.mock.calls[0][0].data;
      expect(data.elements.map((el) => el.id)).toEqual(["rect"]);
      expect((result as any).appState.toast.message).toBe("File saved.");

      await actionSaveFileToDisk.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("onExport() aborted by host app"),
      );
      expect(saveAsJSONMock).toHaveBeenCalledTimes(2);

      consoleError.mockRestore();
      consoleWarn.mockRestore();
    });
  });

  describe("actionSaveFileToDisk", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("keyTest matches Ctrl/Cmd+Shift+S", () => {
      const keyTest = (init: KeyboardEventInit) =>
        actionSaveFileToDisk.keyTest!(keyEvent(init));
      expect(keyTest({ key: "S", ctrlKey: true, shiftKey: true })).toBe(true);
      expect(keyTest({ key: "s", ctrlKey: true })).toBe(false);
      expect(actionSaveFileToDisk.viewMode).toBe(true);
    });

    it("always asks for a new file and stores the returned handle", async () => {
      const newHandle = fileHandle("new.excalidraw");
      saveAsJSONMock.mockResolvedValueOnce({ fileHandle: newHandle });
      API.setAppState({
        fileHandle: fileHandle("old.excalidraw"),
        name: "drawing",
        openDialog: { name: "jsonExport" },
      });

      const result = await actionSaveFileToDisk.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      const args = saveAsJSONMock.mock.calls[0][0];
      expect(args.fileHandle).toBe(null);
      expect(args.filename).toBe("drawing");
      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          openDialog: null,
          fileHandle: newHandle,
          toast: { message: "File saved.", duration: 3000 },
        },
      });
    });

    it("clears the toast when saving fails", async () => {
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      saveAsJSONMock.mockRejectedValueOnce(makeError("AbortError"));
      saveAsJSONMock.mockRejectedValueOnce(new Error("disk full"));

      const aborted = await actionSaveFileToDisk.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );
      expect(aborted).toEqual({
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: { toast: null },
      });
      expect(consoleWarn).toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();

      const failed = await actionSaveFileToDisk.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );
      expect(failed).toEqual(aborted);
      expect(consoleError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "disk full" }),
      );
      consoleWarn.mockRestore();
      consoleError.mockRestore();
    });
  });

  describe("actionLoadScene", () => {
    it("predicate requires the loadScene canvas action and edit mode", async () => {
      await render(<Excalidraw />);
      const predicate = () =>
        actionLoadScene.predicate!(h.elements, h.state, h.app.props, h.app);
      expect(predicate()).toBe(true);
      API.setAppState({ viewModeEnabled: true });
      expect(predicate()).toBe(false);

      await render(
        <Excalidraw UIOptions={{ canvasActions: { loadScene: false } }} />,
      );
      expect(predicate()).toBe(false);
    });

    describe("perform", () => {
      beforeEach(async () => {
        await render(<Excalidraw />);
      });

      it("keyTest matches Ctrl/Cmd+O", () => {
        expect(
          actionLoadScene.keyTest!(keyEvent({ key: KEYS.O, ctrlKey: true })),
        ).toBe(true);
        expect(actionLoadScene.keyTest!(keyEvent({ key: KEYS.O }))).toBe(false);
      });

      it("replaces the scene with the loaded file", async () => {
        const loaded = API.createElement({ id: "loaded" });
        const loadedAppState = { ...h.state, name: "loaded scene" };
        const files = {};
        loadFromJSONMock.mockResolvedValueOnce({
          elements: [loaded],
          appState: loadedAppState,
          files,
        } as any);

        const result = await actionLoadScene.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          null,
          h.app,
        );

        expect(loadFromJSONMock).toHaveBeenCalledWith(h.state, h.elements);
        expect(result).toEqual({
          elements: [loaded],
          appState: loadedAppState,
          files,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });

      it("returns false when the user cancels the file picker", async () => {
        const consoleWarn = vi
          .spyOn(console, "warn")
          .mockImplementation(() => {});
        loadFromJSONMock.mockRejectedValueOnce(makeError("AbortError"));

        const result = await actionLoadScene.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          null,
          h.app,
        );

        expect(result).toBe(false);
        consoleWarn.mockRestore();
      });

      it("keeps the current scene and shows the error when loading fails", async () => {
        loadFromJSONMock.mockRejectedValueOnce(new Error("invalid file"));
        const rect = API.createElement({ id: "rect" });
        API.setElements([rect]);

        const result = await actionLoadScene.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          null,
          h.app,
        );

        expect(result).toMatchObject({
          elements: h.elements,
          appState: { errorMessage: "invalid file" },
          files: h.app.files,
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
        });
      });
    });
  });
});
