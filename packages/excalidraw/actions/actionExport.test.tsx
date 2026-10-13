import { fireEvent, render as rtlRender } from "@testing-library/react";
import { vi } from "vitest";

import { KEYS, THEME } from "@excalidraw/common";

import { loadFromJSON, saveAsJSON } from "../data";
import { resaveAsImageWithScene } from "../data/resave";
import { t } from "../i18n";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { act, render, waitFor } from "../tests/test-utils";

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
import type { PanelComponentProps } from "./types";

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

const namedError = (name: string) => {
  const error = new Error(name);
  error.name = name;
  return error;
};

const isEnabled = (action: Parameters<typeof API.executeAction>[0]) =>
  h.app.actionManager.isActionEnabled(action);

const executeWithValue = <T extends Parameters<typeof API.executeAction>[0]>(
  action: T,
  value: Parameters<T["perform"]>[2],
) =>
  act(() => {
    h.app.actionManager.executeAction(action, "api", value);
  });

const keyDown = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

/** resolves the data promise passed to saveAsJSON, like the real impl does */
const resolveSavedData = async () =>
  (await saveAsJSONMock.mock.calls[0][0].data) as JSONExportData;

describe("actionExport", () => {
  beforeEach(() => {
    saveAsJSONMock.mockReset();
    loadFromJSONMock.mockReset();
    resaveMock.mockReset();
  });

  describe("appState setters", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("changeProjectName sets the scene name", () => {
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

    it("exportWithDarkMode overrides the session export theme", () => {
      expect(h.state.theme).toBe(THEME.LIGHT);

      executeWithValue(actionExportWithDarkMode, true);
      expect(h.state.exportWithDarkMode).toBe(true);
      expect(h.app.sessionExportThemeOverride).toBe(THEME.DARK);

      executeWithValue(actionExportWithDarkMode, false);
      expect(h.state.exportWithDarkMode).toBe(false);
      expect(h.app.sessionExportThemeOverride).toBe(THEME.LIGHT);
    });
  });

  describe("saveToActiveFile", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("is enabled only with an active file handle outside view mode", () => {
      expect(isEnabled(actionSaveToActiveFile)).toBe(false);

      API.setAppState({ fileHandle: fileHandle("scene.excalidraw") });
      expect(isEnabled(actionSaveToActiveFile)).toBe(true);

      API.setAppState({ viewModeEnabled: true });
      expect(isEnabled(actionSaveToActiveFile)).toBe(false);
    });

    it("matches Ctrl/Cmd+S without Shift", () => {
      const { keyTest } = actionSaveToActiveFile;
      expect(keyTest!(keyDown({ key: KEYS.S, ctrlKey: true }))).toBe(true);
      expect(
        keyTest!(keyDown({ key: KEYS.S, ctrlKey: true, shiftKey: true })),
      ).toBe(false);
      expect(keyTest!(keyDown({ key: KEYS.S }))).toBe(false);
    });

    it("saves JSON to the current handle and reports the filename", async () => {
      const handle = fileHandle("scene.excalidraw");
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.setElements([rect]);
      API.setAppState({ fileHandle: handle, name: "scene" });
      saveAsJSONMock.mockResolvedValueOnce({ fileHandle: handle });

      API.executeAction(actionSaveToActiveFile);

      await waitFor(() =>
        expect(h.state.toast).toEqual({
          message: t("toast.fileSavedToFilename").replace(
            "{filename}",
            `"scene.excalidraw"`,
          ),
          duration: 1500,
        }),
      );
      expect(saveAsJSONMock).toHaveBeenCalledWith(
        expect.objectContaining({ filename: "scene", fileHandle: handle }),
      );
      const data = await resolveSavedData();
      expect(data.elements.map((el) => el.id)).toEqual([rect.id]);
      expect(data.files).toBe(h.app.files);
      expect(resaveMock).not.toHaveBeenCalled();
    });

    it("falls back to a generic toast when the saved handle has no name", async () => {
      API.setAppState({ fileHandle: fileHandle("scene.excalidraw") });
      saveAsJSONMock.mockResolvedValueOnce({ fileHandle: null });

      API.executeAction(actionSaveToActiveFile);

      await waitFor(() =>
        expect(h.state.toast?.message).toBe(t("toast.fileSaved")),
      );
      expect(h.state.fileHandle).toBe(null);
    });

    it("re-saves into an image file handle with the embedded scene", async () => {
      const handle = fileHandle("scene.png");
      API.setAppState({ fileHandle: handle, name: "scene" });
      resaveMock.mockResolvedValueOnce({ fileHandle: handle });

      API.executeAction(actionSaveToActiveFile);

      await waitFor(() => expect(h.state.toast).not.toBe(null));
      expect(saveAsJSONMock).not.toHaveBeenCalled();
      expect(resaveMock).toHaveBeenCalledWith(
        expect.any(Promise),
        handle,
        "scene",
      );
    });

    it("clears the toast and warns when the user aborts", async () => {
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      API.setAppState({
        fileHandle: fileHandle("scene.excalidraw"),
        toast: { message: "pending" },
      });
      saveAsJSONMock.mockRejectedValueOnce(namedError("AbortError"));

      API.executeAction(actionSaveToActiveFile);

      await waitFor(() => expect(h.state.toast).toBe(null));
      expect(consoleWarn).toHaveBeenCalled();
      consoleWarn.mockRestore();
    });

    it("clears the toast and logs on other save errors", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      API.setAppState({
        fileHandle: fileHandle("scene.excalidraw"),
        toast: { message: "pending" },
      });
      saveAsJSONMock.mockRejectedValueOnce(new Error("disk full"));

      API.executeAction(actionSaveToActiveFile);

      await waitFor(() => expect(h.state.toast).toBe(null));
      expect(consoleError).toHaveBeenCalledWith(new Error("disk full"));
      consoleError.mockRestore();
    });

    it("ignores repeated saves while one is in progress", async () => {
      const handle = fileHandle("scene.excalidraw");
      API.setAppState({ fileHandle: handle });
      let finishSave!: (value: { fileHandle: FileSystemFileHandle }) => void;
      saveAsJSONMock.mockReturnValueOnce(
        new Promise((resolve) => {
          finishSave = resolve;
        }),
      );

      API.executeAction(actionSaveToActiveFile);
      API.executeAction(actionSaveToActiveFile);
      API.executeAction(actionSaveFileToDisk);

      expect(saveAsJSONMock).toHaveBeenCalledTimes(1);

      finishSave({ fileHandle: handle });
      await waitFor(() => expect(h.state.toast).not.toBe(null));

      API.setAppState({ toast: null });
      saveAsJSONMock.mockResolvedValueOnce({ fileHandle: handle });
      API.executeAction(actionSaveToActiveFile);
      expect(saveAsJSONMock).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(h.state.toast).not.toBe(null));
    });
  });

  describe("onExport host hook", () => {
    it("awaits a promise returned by onExport before saving", async () => {
      let finishExport!: () => void;
      const onExport = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishExport = resolve;
          }),
      );
      await render(<Excalidraw onExport={onExport} />);
      API.setElements([API.createElement({ type: "rectangle" })]);
      saveAsJSONMock.mockImplementationOnce(async ({ data }) => {
        await data;
        return { fileHandle: null };
      });

      API.executeAction(actionSaveFileToDisk);

      await waitFor(() => expect(onExport).toHaveBeenCalledTimes(1));
      const [type, data, opts] = onExport.mock.calls[0] as any[];
      expect(type).toBe("json");
      expect(data.elements).toHaveLength(1);
      expect(opts.signal).toBeInstanceOf(AbortSignal);
      await waitFor(() =>
        expect(h.state.toast?.message).toBe(t("progressDialog.defaultMessage")),
      );

      finishExport();

      await waitFor(() =>
        expect(h.state.toast?.message).toBe(t("toast.fileSaved")),
      );
    });

    it("renders progress yielded by an async generator", async () => {
      let resume!: () => void;
      const onExport = vi.fn(async function* () {
        yield { type: "progress" as const, message: "Loading images" };
        await new Promise<void>((resolve) => {
          resume = resolve;
        });
        yield { type: "progress" as const, progress: 0.5 };
      });
      await render(<Excalidraw onExport={onExport} />);
      saveAsJSONMock.mockImplementationOnce(async ({ data }) => {
        await data;
        return { fileHandle: null };
      });

      API.executeAction(actionSaveFileToDisk);

      await waitFor(() =>
        expect(h.state.toast?.message).toBe("Loading images"),
      );
      expect(h.state.toast?.duration).toBe(Infinity);

      resume();

      await waitFor(() =>
        expect(h.state.toast?.message).toBe(t("toast.fileSaved")),
      );
    });

    it("stops consuming the generator once it reports done", async () => {
      const afterDone = vi.fn();
      const onExport = vi.fn(async function* () {
        yield { type: "done" } as any;
        afterDone();
      });
      await render(<Excalidraw onExport={onExport} />);
      saveAsJSONMock.mockImplementationOnce(async ({ data }) => {
        await data;
        return { fileHandle: null };
      });

      API.executeAction(actionSaveFileToDisk);

      await waitFor(() =>
        expect(h.state.toast?.message).toBe(t("toast.fileSaved")),
      );
      expect(afterDone).not.toHaveBeenCalled();
    });

    it("still saves the original data when onExport throws", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const onExport = vi.fn(() => {
        throw new Error("host failure");
      });
      await render(<Excalidraw onExport={onExport} />);
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.setElements([rect]);
      saveAsJSONMock.mockResolvedValueOnce({ fileHandle: null });

      API.executeAction(actionSaveFileToDisk);

      const data = await waitFor(resolveSavedData);
      expect(data.elements.map((el) => el.id)).toEqual([rect.id]);
      expect(consoleError).toHaveBeenCalledWith(
        "Error during props.onExport() handling",
        expect.any(Error),
      );
      consoleError.mockRestore();
    });

    it("warns instead of erroring when onExport throws an AbortError", async () => {
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const onExport = vi.fn(async () => {
        throw namedError("AbortError");
      });
      await render(<Excalidraw onExport={onExport} />);
      saveAsJSONMock.mockResolvedValueOnce({ fileHandle: null });

      API.executeAction(actionSaveFileToDisk);

      await waitFor(resolveSavedData);
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("onExport() aborted by host app"),
      );
      consoleWarn.mockRestore();
    });
  });

  describe("saveFileToDisk", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("matches Ctrl/Cmd+Shift+S", () => {
      const { keyTest } = actionSaveFileToDisk;
      expect(
        keyTest!(keyDown({ key: "S", ctrlKey: true, shiftKey: true })),
      ).toBe(true);
      expect(keyTest!(keyDown({ key: KEYS.S, ctrlKey: true }))).toBe(false);
    });

    it("saves to a new file, stores the handle and closes the dialog", async () => {
      const handle = fileHandle("new.excalidraw");
      API.setAppState({
        name: "drawing",
        openDialog: { name: "jsonExport" },
        fileHandle: fileHandle("old.excalidraw"),
      });
      saveAsJSONMock.mockResolvedValueOnce({ fileHandle: handle });

      API.executeAction(actionSaveFileToDisk);

      await waitFor(() => expect(h.state.fileHandle).toBe(handle));
      expect(saveAsJSONMock).toHaveBeenCalledWith(
        expect.objectContaining({ filename: "drawing", fileHandle: null }),
      );
      expect(h.state.openDialog).toBe(null);
      expect(h.state.toast).toEqual({
        message: t("toast.fileSaved"),
        duration: 3000,
      });
    });

    it("clears the toast when saving fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      API.setAppState({ toast: { message: "pending" } });
      saveAsJSONMock.mockRejectedValueOnce(new Error("nope"));

      API.executeAction(actionSaveFileToDisk);

      await waitFor(() => expect(h.state.toast).toBe(null));
      expect(consoleError).toHaveBeenCalled();
      expect(h.state.fileHandle).toBe(null);
      consoleError.mockRestore();
    });

    it("clears the toast when the user cancels the file picker", async () => {
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      API.setAppState({ toast: { message: "pending" } });
      saveAsJSONMock.mockRejectedValueOnce(namedError("AbortError"));

      API.executeAction(actionSaveFileToDisk);

      await waitFor(() => expect(h.state.toast).toBe(null));
      expect(consoleWarn).toHaveBeenCalled();
      consoleWarn.mockRestore();
    });
  });

  describe("loadScene", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("is disabled in view mode", () => {
      expect(isEnabled(actionLoadScene)).toBe(true);
      API.setAppState({ viewModeEnabled: true });
      expect(isEnabled(actionLoadScene)).toBe(false);
    });

    it("matches Ctrl/Cmd+O", () => {
      const { keyTest } = actionLoadScene;
      expect(keyTest!(keyDown({ key: KEYS.O, ctrlKey: true }))).toBe(true);
      expect(keyTest!(keyDown({ key: KEYS.O }))).toBe(false);
    });

    it("replaces the scene with the loaded elements and appState", async () => {
      const existing = API.createElement({ type: "rectangle", id: "old" });
      API.setElements([existing]);
      const loaded = API.createElement({ type: "ellipse", id: "loaded" });
      loadFromJSONMock.mockResolvedValueOnce({
        elements: [loaded],
        appState: { ...h.state, viewBackgroundColor: "#ffc9c9" },
        files: {},
      } as any);

      API.executeAction(actionLoadScene);

      await waitFor(() =>
        expect(h.elements.map((el) => el.id)).toEqual([loaded.id]),
      );
      expect(h.state.viewBackgroundColor).toBe("#ffc9c9");
      expect(loadFromJSONMock).toHaveBeenCalledWith(
        expect.objectContaining({ viewBackgroundColor: "#ffffff" }),
        [existing],
      );
    });

    it("keeps the scene untouched when the user cancels", async () => {
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const existing = API.createElement({ type: "rectangle", id: "old" });
      API.setElements([existing]);
      loadFromJSONMock.mockRejectedValueOnce(namedError("AbortError"));

      API.executeAction(actionLoadScene);

      await waitFor(() => expect(consoleWarn).toHaveBeenCalled());
      expect(h.elements.map((el) => el.id)).toEqual([existing.id]);
      expect(h.state.errorMessage).toBe(null);
      consoleWarn.mockRestore();
    });

    it("shows an error message when loading fails", async () => {
      const existing = API.createElement({ type: "rectangle", id: "old" });
      API.setElements([existing]);
      loadFromJSONMock.mockRejectedValueOnce(new Error("invalid file"));

      API.executeAction(actionLoadScene);

      await waitFor(() => expect(h.state.errorMessage).toBe("invalid file"));
      expect(h.elements.map((el) => el.id)).toEqual([existing.id]);
    });
  });

  describe("PanelComponents", () => {
    const renderPanel = (
      action:
        | typeof actionChangeExportBackground
        | typeof actionChangeExportEmbedScene
        | typeof actionExportWithDarkMode,
      appState: Partial<PanelComponentProps["appState"]>,
    ) => {
      const updateData = vi.fn();
      const PanelComponent = action.PanelComponent!;
      const result = rtlRender(
        <PanelComponent
          {...({
            appState,
            updateData,
            elements: [],
            appProps: {},
            app: {},
            renderAction: vi.fn(),
          } as unknown as PanelComponentProps)}
        />,
      );
      return { ...result, updateData };
    };

    it("export background checkbox reflects and toggles the flag", () => {
      const { getByRole, updateData } = renderPanel(
        actionChangeExportBackground,
        { exportBackground: true },
      );
      const checkbox = getByRole("checkbox");
      expect(checkbox.getAttribute("aria-checked")).toBe("true");

      fireEvent.click(checkbox);

      expect(updateData).toHaveBeenCalledWith(false);
    });

    it("embed scene checkbox reflects and toggles the flag", () => {
      const { getByRole, updateData } = renderPanel(
        actionChangeExportEmbedScene,
        { exportEmbedScene: false },
      );
      const checkbox = getByRole("checkbox");
      expect(checkbox.getAttribute("aria-checked")).toBe("false");

      fireEvent.click(checkbox);

      expect(updateData).toHaveBeenCalledWith(true);
    });

    it("dark mode toggle flips the export theme", () => {
      const { getByTestId, updateData } = renderPanel(
        actionExportWithDarkMode,
        { exportWithDarkMode: true },
      );

      fireEvent.click(getByTestId("toggle-dark-mode"));

      expect(updateData).toHaveBeenCalledWith(false);
    });
  });
});
