import { vi } from "vitest";

import { KEYS, THEME } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { loadFromJSON, saveAsJSON } from "../data/index";
import { resaveAsImageWithScene } from "../data/resave";
import { t } from "../i18n";
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

import type { JSONExportData } from "../data/json";
import type { ExcalidrawProps } from "../types";

vi.mock("../data/index", async (importOriginal) => {
  const module = await importOriginal<typeof import("../data/index")>();
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

const getElements = () => h.app.scene.getElementsIncludingDeleted();

const fileHandle = (name: string) => ({ name } as FileSystemFileHandle);

const namedError = (name: string, message = name) =>
  Object.assign(new Error(message), { name });

/** resolves the exported data before returning, like the real saveAsJSON */
let exportedData: JSONExportData | null = null;
const mockSave = (result: { fileHandle: FileSystemFileHandle | null }) =>
  (async ({ data }: { data: Promise<JSONExportData> }) => {
    exportedData = await data;
    return result;
  }) as any;

const executeWithValue = (action: any, value: any) => {
  act(() => {
    h.app.actionManager.executeAction(action, "api", value);
  });
};

const setFileHandle = (handle: FileSystemFileHandle | null) => {
  act(() => {
    h.setState({ fileHandle: handle });
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  exportedData = null;
});

describe("actionExport", () => {
  describe("simple export settings", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("updates project name, export scale, background and embed scene", () => {
      executeWithValue(actionChangeProjectName, "My drawing");
      expect(h.state.name).toBe("My drawing");

      executeWithValue(actionChangeExportScale, 3);
      expect(h.state.exportScale).toBe(3);

      executeWithValue(actionChangeExportBackground, false);
      expect(h.state.exportBackground).toBe(false);
      executeWithValue(actionChangeExportBackground, true);
      expect(h.state.exportBackground).toBe(true);

      executeWithValue(actionChangeExportEmbedScene, true);
      expect(h.state.exportEmbedScene).toBe(true);
    });

    it("toggles export dark mode and records a session theme override", () => {
      executeWithValue(actionExportWithDarkMode, true);
      expect(h.state.exportWithDarkMode).toBe(true);
      expect(h.app.sessionExportThemeOverride).toBe(THEME.DARK);

      executeWithValue(actionExportWithDarkMode, false);
      expect(h.state.exportWithDarkMode).toBe(false);
      expect(h.app.sessionExportThemeOverride).toBe(THEME.LIGHT);
    });

    it("binds save, save-as and load shortcuts", () => {
      const ev = (key: string, mods: Partial<KeyboardEvent> = {}) =>
        ({ key, ctrlKey: true, shiftKey: false, ...mods } as KeyboardEvent);
      const keyTest = (action: any, event: KeyboardEvent) =>
        action.keyTest(event, h.state, h.elements, h.app);

      expect(keyTest(actionSaveToActiveFile, ev(KEYS.S))).toBe(true);
      expect(
        keyTest(actionSaveToActiveFile, ev(KEYS.S, { shiftKey: true })),
      ).toBe(false);
      expect(
        keyTest(actionSaveToActiveFile, ev(KEYS.S, { ctrlKey: false })),
      ).toBe(false);

      expect(keyTest(actionSaveFileToDisk, ev("S", { shiftKey: true }))).toBe(
        true,
      );
      expect(keyTest(actionSaveFileToDisk, ev(KEYS.S))).toBe(false);

      expect(keyTest(actionLoadScene, ev(KEYS.O))).toBe(true);
      expect(keyTest(actionLoadScene, ev(KEYS.O, { ctrlKey: false }))).toBe(
        false,
      );
    });
  });

  describe("saveToActiveFile", () => {
    beforeEach(async () => {
      await render(<Excalidraw name="scene" />);
    });

    const predicate = () =>
      actionSaveToActiveFile.predicate!(
        getElements(),
        h.state,
        h.app.props,
        h.app,
      );

    it("is enabled only with an active file handle outside view mode", () => {
      expect(predicate()).toBe(false);

      setFileHandle(fileHandle("scene.excalidraw"));
      expect(predicate()).toBe(true);

      act(() => {
        h.setState({ viewModeEnabled: true });
      });
      expect(predicate()).toBe(false);
    });

    it("saves the scene as JSON to the active file handle", async () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.setElements([rect]);
      const handle = fileHandle("scene.excalidraw");
      setFileHandle(handle);
      saveAsJSONMock.mockImplementation(mockSave({ fileHandle: handle }));

      const result = await actionSaveToActiveFile.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(saveAsJSONMock).toHaveBeenCalledTimes(1);
      expect(saveAsJSONMock.mock.calls[0][0]).toMatchObject({
        filename: "scene",
        fileHandle: handle,
      });
      expect(resaveMock).not.toHaveBeenCalled();
      expect(exportedData!.elements).toBe(h.elements);
      expect(exportedData!.files).toBe(h.app.files);
      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          fileHandle: handle,
          toast: {
            message: t("toast.fileSavedToFilename").replace(
              "{filename}",
              `"scene.excalidraw"`,
            ),
            duration: 1500,
          },
        },
      });
    });

    it("shows a generic toast when the saved handle has no name", async () => {
      setFileHandle(fileHandle("scene.excalidraw"));
      saveAsJSONMock.mockImplementation(mockSave({ fileHandle: null }));

      const result = await actionSaveToActiveFile.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect((result as any).appState.toast.message).toBe(t("toast.fileSaved"));
    });

    it("re-saves image file handles with the embedded scene", async () => {
      const handle = fileHandle("scene.png");
      setFileHandle(handle);
      resaveMock.mockResolvedValueOnce({ fileHandle: handle });

      const result = await actionSaveToActiveFile.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(saveAsJSONMock).not.toHaveBeenCalled();
      expect(resaveMock).toHaveBeenCalledWith(
        expect.any(Promise),
        handle,
        "scene",
      );
      expect((result as any).appState.fileHandle).toBe(handle);
    });

    it("ignores a second save while one is in progress", async () => {
      setFileHandle(fileHandle("scene.excalidraw"));
      let finishSave!: () => void;
      saveAsJSONMock.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishSave = () => resolve({ fileHandle: null });
          }),
      );

      const first = actionSaveToActiveFile.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );
      const second = await actionSaveToActiveFile.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );
      expect(second).toBe(false);
      expect(saveAsJSONMock).toHaveBeenCalledTimes(1);

      finishSave();
      await first;

      // a new save is allowed once the previous one finished
      saveAsJSONMock.mockImplementationOnce(mockSave({ fileHandle: null }));
      expect(
        await actionSaveToActiveFile.perform(
          getElements(),
          h.state,
          null,
          h.app,
        ),
      ).not.toBe(false);
    });

    it("clears the toast and warns when the user aborts", async () => {
      setFileHandle(fileHandle("scene.excalidraw"));
      saveAsJSONMock.mockRejectedValueOnce(namedError("AbortError"));
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const result = await actionSaveToActiveFile.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: { toast: null },
      });
      expect(consoleWarn).toHaveBeenCalled();
      consoleWarn.mockRestore();
    });

    it("clears the toast and logs other save errors", async () => {
      setFileHandle(fileHandle("scene.excalidraw"));
      const error = new Error("disk full");
      saveAsJSONMock.mockRejectedValueOnce(error);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await actionSaveToActiveFile.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: { toast: null },
      });
      expect(consoleError).toHaveBeenCalledWith(error);
      consoleError.mockRestore();
    });
  });

  describe("saveFileToDisk", () => {
    beforeEach(async () => {
      await render(<Excalidraw name="scene" />);
    });

    it("saves to a new file and closes the dialog", async () => {
      const handle = fileHandle("scene.excalidraw");
      saveAsJSONMock.mockImplementation(mockSave({ fileHandle: handle }));

      const result = await actionSaveFileToDisk.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(saveAsJSONMock.mock.calls[0][0]).toMatchObject({
        filename: "scene",
        fileHandle: null,
      });
      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          openDialog: null,
          fileHandle: handle,
          toast: { message: t("toast.fileSaved"), duration: 3000 },
        },
      });
    });

    it("is allowed in view mode", () => {
      expect(actionSaveFileToDisk.viewMode).toBe(true);
    });

    it.each([
      ["AbortError", "warn"],
      ["Error", "error"],
    ] as const)(
      "clears the toast when saving fails with %s",
      async (name, level) => {
        saveAsJSONMock.mockRejectedValueOnce(namedError(name));
        const spy = vi.spyOn(console, level).mockImplementation(() => {});

        const result = await actionSaveFileToDisk.perform(
          getElements(),
          h.state,
          null,
          h.app,
        );

        expect(result).toEqual({
          captureUpdate: CaptureUpdateAction.NEVER,
          appState: { toast: null },
        });
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
      },
    );
  });

  describe("onExport host callback", () => {
    const renderWithOnExport = async (
      onExport: NonNullable<ExcalidrawProps["onExport"]>,
    ) => {
      await render(<Excalidraw onExport={onExport} />);
      saveAsJSONMock.mockImplementation(mockSave({ fileHandle: null }));
    };

    it("awaits a promise returned by onExport before saving", async () => {
      let resolved = false;
      const onExport = vi.fn(
        () =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              resolved = true;
              resolve();
            }, 0),
          ),
      );
      await renderWithOnExport(onExport);
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([rect]);

      await act(async () => {
        await actionSaveFileToDisk.perform(getElements(), h.state, null, h.app);
      });

      expect(onExport).toHaveBeenCalledWith(
        "json",
        {
          elements: h.elements,
          appState: expect.any(Object),
          files: h.app.files,
        },
        { signal: expect.any(AbortSignal) },
      );
      expect(resolved).toBe(true);
      expect(exportedData!.elements).toEqual([rect]);
    });

    it("renders progress toasts from an async generator", async () => {
      const onExport = vi.fn(async function* () {
        yield {
          type: "progress",
          message: "Uploading",
          progress: 0.5,
        } as const;
        yield { type: "progress" } as const;
      });
      await renderWithOnExport(onExport as any);
      const setAppState = vi.spyOn(h.app, "setAppState");

      await act(async () => {
        await actionSaveFileToDisk.perform(getElements(), h.state, null, h.app);
      });

      expect(onExport).toHaveBeenCalledTimes(1);
      const toasts = setAppState.mock.calls.map(
        ([state]) => (state as any).toast,
      );
      expect(toasts).toHaveLength(2);
      expect(toasts[0].duration).toBe(Infinity);
      // progress is rendered alongside the message
      expect(typeof toasts[0].message).toBe("object");
      expect(toasts[1]).toEqual({
        message: t("progressDialog.defaultMessage"),
        duration: Infinity,
      });
      expect(exportedData).not.toBe(null);
    });

    it("stops consuming the generator once it reports done", async () => {
      const afterDone = vi.fn();
      const onExport = vi.fn(async function* () {
        yield { type: "done" } as any;
        afterDone();
      });
      await renderWithOnExport(onExport as any);

      await actionSaveFileToDisk.perform(getElements(), h.state, null, h.app);

      expect(afterDone).not.toHaveBeenCalled();
      expect(exportedData).not.toBe(null);
    });

    it.each([
      ["AbortError", "warn"],
      ["TypeError", "error"],
    ] as const)(
      "still saves the original data when onExport throws %s",
      async (name, level) => {
        const spy = vi.spyOn(console, level).mockImplementation(() => {});
        await renderWithOnExport(() => {
          throw namedError(name);
        });

        const result = await actionSaveFileToDisk.perform(
          getElements(),
          h.state,
          null,
          h.app,
        );

        expect(spy).toHaveBeenCalled();
        expect(exportedData).not.toBe(null);
        expect((result as any).appState.toast.message).toBe(
          t("toast.fileSaved"),
        );
        spy.mockRestore();
      },
    );
  });

  describe("loadScene", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("is enabled unless in view mode", () => {
      expect(
        actionLoadScene.predicate!(getElements(), h.state, h.app.props, h.app),
      ).toBe(true);
      act(() => {
        h.setState({ viewModeEnabled: true });
      });
      expect(
        actionLoadScene.predicate!(getElements(), h.state, h.app.props, h.app),
      ).toBe(false);
    });

    it("replaces the scene with the loaded file", async () => {
      const loaded = API.createElement({ type: "ellipse", id: "loaded" });
      const loadedAppState = { ...h.state, name: "loaded" };
      loadFromJSONMock.mockResolvedValueOnce({
        elements: [loaded],
        appState: loadedAppState,
        files: {},
      } as any);

      const result = await actionLoadScene.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(loadFromJSONMock).toHaveBeenCalledWith(h.state, h.elements);
      expect(result).toEqual({
        elements: [loaded],
        appState: loadedAppState,
        files: {},
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });

    it("returns false when the user cancels the file picker", async () => {
      loadFromJSONMock.mockRejectedValueOnce(namedError("AbortError"));
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      expect(
        await actionLoadScene.perform(getElements(), h.state, null, h.app),
      ).toBe(false);
      consoleWarn.mockRestore();
    });

    it("keeps the current scene and shows an error for invalid files", async () => {
      loadFromJSONMock.mockRejectedValueOnce(new Error("invalid file"));

      const result = await actionLoadScene.perform(
        getElements(),
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
