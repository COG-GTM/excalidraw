import { act, fireEvent, render as rtlRender } from "@testing-library/react";
import { vi } from "vitest";

import { KEYS, THEME } from "@excalidraw/common";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { render, waitFor } from "../tests/test-utils";

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
import type { ExcalidrawProps, OnExportProgress } from "../types";

const mocks = vi.hoisted(() => ({
  saveAsJSON: vi.fn(),
  loadFromJSON: vi.fn(),
  resaveAsImageWithScene: vi.fn(),
}));

vi.mock("../data", async (importOriginal) => {
  const module = await importOriginal<typeof import("../data")>();
  return {
    ...module,
    saveAsJSON: mocks.saveAsJSON,
    loadFromJSON: mocks.loadFromJSON,
  };
});

vi.mock("../data/resave", () => ({
  resaveAsImageWithScene: mocks.resaveAsImageWithScene,
}));

const { h } = window;

const fileHandle = (name: string) => ({ name } as FileSystemFileHandle);

const namedError = (name: string, message = name) => {
  const error = new Error(message);
  error.name = name;
  return error;
};

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const keyEvent = (init: Partial<KeyboardEvent>) =>
  ({
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    code: "",
    key: "",
    ...init,
  } as KeyboardEvent);

const executeWithValue = <T extends Action>(
  action: T,
  value: Parameters<T["perform"]>[2],
) => {
  act(() => {
    h.app.actionManager.executeAction(action, "api", value);
  });
};

const renderPanel = (name: Action["name"]) =>
  rtlRender(<>{h.app.actionManager.renderAction(name)}</>);

beforeEach(() => {
  mocks.saveAsJSON.mockReset().mockImplementation(async ({ data }) => {
    await data;
    return { fileHandle: fileHandle("drawing.excalidraw") };
  });
  mocks.loadFromJSON.mockReset();
  mocks.resaveAsImageWithScene
    .mockReset()
    .mockImplementation(async (data, handle) => {
      await data;
      return { fileHandle: handle };
    });
});

describe("actionExport", () => {
  describe("export settings", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("updates the project name", () => {
      executeWithValue(actionChangeProjectName, "My drawing");
      expect(h.state.name).toBe("My drawing");
    });

    it("updates the export scale", () => {
      executeWithValue(actionChangeExportScale, 3);
      expect(h.state.exportScale).toBe(3);
    });

    it("updates export background and embed-scene flags", () => {
      executeWithValue(actionChangeExportBackground, false);
      expect(h.state.exportBackground).toBe(false);
      executeWithValue(actionChangeExportBackground, true);
      expect(h.state.exportBackground).toBe(true);

      executeWithValue(actionChangeExportEmbedScene, true);
      expect(h.state.exportEmbedScene).toBe(true);
      executeWithValue(actionChangeExportEmbedScene, false);
      expect(h.state.exportEmbedScene).toBe(false);
    });

    it("sets exportWithDarkMode and the session export theme override", () => {
      executeWithValue(actionExportWithDarkMode, true);
      expect(h.state.exportWithDarkMode).toBe(true);
      expect(h.app.sessionExportThemeOverride).toBe(THEME.DARK);

      executeWithValue(actionExportWithDarkMode, false);
      expect(h.state.exportWithDarkMode).toBe(false);
      expect(h.app.sessionExportThemeOverride).toBe(THEME.LIGHT);
    });

    it("toggles export background and embed scene from their checkboxes", () => {
      const initialBackground = h.state.exportBackground;
      const background = renderPanel("changeExportBackground");
      const backgroundCheckbox = background.getByRole("checkbox");
      expect(backgroundCheckbox.getAttribute("aria-checked")).toBe(
        String(initialBackground),
      );
      fireEvent.click(backgroundCheckbox);
      expect(h.state.exportBackground).toBe(!initialBackground);
      background.unmount();

      const initialEmbed = h.state.exportEmbedScene;
      const embed = renderPanel("changeExportEmbedScene");
      fireEvent.click(embed.getByRole("checkbox"));
      expect(h.state.exportEmbedScene).toBe(!initialEmbed);
      embed.unmount();
    });

    it("toggles the export theme from the dark mode toggle", () => {
      executeWithValue(actionExportWithDarkMode, false);
      const panel = renderPanel("exportWithDarkMode");

      fireEvent.click(panel.getByTitle("Dark mode"));

      expect(h.state.exportWithDarkMode).toBe(true);
      panel.unmount();
    });

    it("renames the project from the file name input on blur", () => {
      const panel = renderPanel("changeProjectName");
      const input = panel.getByRole("textbox") as HTMLInputElement;

      fireEvent.change(input, { target: { value: "Renamed" } });
      fireEvent.blur(input);

      expect(h.state.name).toBe("Renamed");
      panel.unmount();
    });
  });

  describe("actionSaveToActiveFile", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("is enabled only with a file handle outside view mode", () => {
      const isEnabled = () =>
        actionSaveToActiveFile.predicate!(
          h.elements,
          h.state,
          h.app.props,
          h.app,
        );

      expect(isEnabled()).toBe(false);

      API.setAppState({ fileHandle: fileHandle("drawing.excalidraw") });
      expect(isEnabled()).toBe(true);

      API.setAppState({ viewModeEnabled: true });
      expect(isEnabled()).toBe(false);
    });

    it("maps Ctrl+S (without Shift)", () => {
      expect(
        actionSaveToActiveFile.keyTest!(
          keyEvent({ ctrlKey: true, key: KEYS.S }),
        ),
      ).toBe(true);
      expect(
        actionSaveToActiveFile.keyTest!(
          keyEvent({ ctrlKey: true, shiftKey: true, key: KEYS.S }),
        ),
      ).toBe(false);
      expect(actionSaveToActiveFile.keyTest!(keyEvent({ key: KEYS.S }))).toBe(
        false,
      );
    });

    it("saves the scene as JSON to the active file and toasts its name", async () => {
      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);
      const handle = fileHandle("drawing.excalidraw");
      API.setAppState({ fileHandle: handle, name: "drawing" });

      API.executeAction(actionSaveToActiveFile);

      await waitFor(() =>
        expect(h.state.toast?.message).toBe('Saved to "drawing.excalidraw"'),
      );
      expect(mocks.saveAsJSON).toHaveBeenCalledTimes(1);
      const {
        data,
        filename,
        fileHandle: passedHandle,
      } = mocks.saveAsJSON.mock.calls[0][0];
      expect(filename).toBe("drawing");
      expect(passedHandle).toBe(handle);
      const exported = await data;
      expect(exported.elements.map((el: { id: string }) => el.id)).toEqual([
        "rect",
      ]);
      expect(exported.files).toBe(h.app.files);
      expect(mocks.resaveAsImageWithScene).not.toHaveBeenCalled();
    });

    it("re-saves into an image file handle with the scene embedded", async () => {
      const handle = fileHandle("drawing.png");
      API.setAppState({ fileHandle: handle });

      API.executeAction(actionSaveToActiveFile);

      await waitFor(() =>
        expect(h.state.toast?.message).toBe('Saved to "drawing.png"'),
      );
      expect(mocks.resaveAsImageWithScene).toHaveBeenCalledWith(
        expect.any(Promise),
        handle,
        h.app.getName(),
      );
      expect(mocks.saveAsJSON).not.toHaveBeenCalled();
    });

    it("shows a generic toast when saving without a previous file handle", async () => {
      const result = await actionSaveToActiveFile.perform(
        h.app.scene.getElementsIncludingDeleted(),
        { ...h.state, fileHandle: null },
        null,
        h.app,
      );

      expect(result && result.appState).toMatchObject({
        fileHandle: expect.objectContaining({ name: "drawing.excalidraw" }),
        toast: { message: "File saved.", duration: 1500 },
      });
    });

    it.each([
      ["AbortError", "warn"],
      ["Error", "error"],
    ] as const)(
      "clears the toast when saving fails with %s",
      async (errorName, level) => {
        const log = vi.spyOn(console, level).mockImplementation(() => {});
        const error = namedError(errorName);
        mocks.saveAsJSON.mockRejectedValueOnce(error);
        API.setAppState({ fileHandle: fileHandle("drawing.excalidraw") });

        const result = await actionSaveToActiveFile.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          null,
          h.app,
        );

        expect(result && result.appState).toEqual({ toast: null });
        expect(log).toHaveBeenCalledWith(error);
        log.mockRestore();
      },
    );

    it("ignores a save while another save is in progress", async () => {
      const gate = deferred();
      mocks.saveAsJSON.mockImplementationOnce(async () => {
        await gate.promise;
        return { fileHandle: fileHandle("drawing.excalidraw") };
      });
      API.setAppState({ fileHandle: fileHandle("drawing.excalidraw") });

      const first = actionSaveFileToDisk.perform(
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
      expect(mocks.saveAsJSON).toHaveBeenCalledTimes(1);

      gate.resolve();
      expect(await first).toMatchObject({
        appState: { toast: { message: "File saved." } },
      });

      // lock is released after the first save finished
      expect(
        await actionSaveToActiveFile.perform(
          h.app.scene.getElementsIncludingDeleted(),
          h.state,
          null,
          h.app,
        ),
      ).not.toBe(false);
    });
  });

  describe("actionSaveFileToDisk", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("maps Ctrl+Shift+S", () => {
      expect(
        actionSaveFileToDisk.keyTest!(
          keyEvent({ ctrlKey: true, shiftKey: true, key: "S" }),
        ),
      ).toBe(true);
      expect(
        actionSaveFileToDisk.keyTest!(keyEvent({ ctrlKey: true, key: "s" })),
      ).toBe(false);
    });

    it("always saves to a new file and closes the dialog", async () => {
      API.setAppState({
        fileHandle: fileHandle("old.excalidraw"),
        openDialog: { name: "jsonExport" },
      });

      API.executeAction(actionSaveFileToDisk);

      await waitFor(() => expect(h.state.toast?.message).toBe("File saved."));
      expect(mocks.saveAsJSON.mock.calls[0][0].fileHandle).toBe(null);
      expect(h.state.openDialog).toBe(null);
      expect(h.state.fileHandle?.name).toBe("drawing.excalidraw");
    });

    it("clears the toast when the user cancels the file picker", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      mocks.saveAsJSON.mockRejectedValueOnce(namedError("AbortError"));

      const result = await actionSaveFileToDisk.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result && result.appState).toEqual({ toast: null });
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("logs unexpected save errors", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const error = new Error("disk full");
      mocks.saveAsJSON.mockRejectedValueOnce(error);

      const result = await actionSaveFileToDisk.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result && result.appState).toEqual({ toast: null });
      expect(consoleError).toHaveBeenCalledWith(error);
      consoleError.mockRestore();
    });
  });

  describe("host onExport interception", () => {
    const renderWithOnExport = (onExport: ExcalidrawProps["onExport"]) =>
      render(<Excalidraw onExport={onExport} />);

    it("shows progress toasts from an async generator before saving", async () => {
      const gate = deferred();
      const onExport = vi.fn(async function* () {
        yield { type: "progress" as const, message: "Uploading images" };
        await gate.promise;
        yield { type: "done" } as unknown as OnExportProgress;
      });
      await renderWithOnExport(onExport);

      API.executeAction(actionSaveFileToDisk);

      await waitFor(() =>
        expect(h.state.toast?.message).toBe("Uploading images"),
      );
      expect(h.state.toast?.duration).toBe(Infinity);
      expect(onExport).toHaveBeenCalledWith(
        "json",
        expect.objectContaining({ files: h.app.files }),
        { signal: expect.any(AbortSignal) },
      );

      gate.resolve();
      await waitFor(() => expect(h.state.toast?.message).toBe("File saved."));
      expect(mocks.saveAsJSON).toHaveBeenCalledTimes(1);
    });

    it("shows a default progress toast while a promise is pending", async () => {
      const gate = deferred();
      await renderWithOnExport(() => gate.promise);

      API.executeAction(actionSaveFileToDisk);

      await waitFor(() =>
        expect(h.state.toast?.message).toBe("Preparing to save..."),
      );

      gate.resolve();
      await waitFor(() => expect(h.state.toast?.message).toBe("File saved."));
    });

    it("still saves when onExport throws", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      await renderWithOnExport(() => Promise.reject(new Error("host failed")));

      API.executeAction(actionSaveFileToDisk);

      await waitFor(() => expect(h.state.toast?.message).toBe("File saved."));
      expect(consoleError).toHaveBeenCalledWith(
        "Error during props.onExport() handling",
        expect.any(Error),
      );
      consoleError.mockRestore();
    });

    it("still saves when onExport rejects with AbortError", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      await renderWithOnExport(() => Promise.reject(namedError("AbortError")));

      API.executeAction(actionSaveFileToDisk);

      await waitFor(() => expect(h.state.toast?.message).toBe("File saved."));
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("onExport() aborted by host app"),
      );
      warn.mockRestore();
    });

    it("stops the generator when the save is aborted", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const gate = deferred();
      let finished = false;
      let signal: AbortSignal | undefined;
      await renderWithOnExport(async function* (_type, _data, opts) {
        signal = opts.signal;
        try {
          yield { type: "progress" as const, message: "working" };
          await gate.promise;
          yield { type: "progress" as const, message: "still working" };
          yield { type: "done" } as unknown as OnExportProgress;
        } finally {
          finished = true;
        }
      });
      mocks.saveAsJSON.mockRejectedValueOnce(namedError("AbortError"));

      const result = await actionSaveFileToDisk.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );
      expect(result && result.appState).toEqual({ toast: null });
      expect(signal?.aborted).toBe(true);

      gate.resolve();
      await waitFor(() => expect(finished).toBe(true));
      warn.mockRestore();
    });
  });

  describe("actionLoadScene", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("is enabled outside view mode and maps Ctrl+O", () => {
      expect(
        actionLoadScene.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(true);
      API.setAppState({ viewModeEnabled: true });
      expect(
        actionLoadScene.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(false);

      expect(
        actionLoadScene.keyTest!(keyEvent({ ctrlKey: true, key: KEYS.O })),
      ).toBe(true);
      expect(actionLoadScene.keyTest!(keyEvent({ key: KEYS.O }))).toBe(false);
    });

    it("replaces the scene with the loaded file", async () => {
      API.setElements([API.createElement({ id: "old" })]);
      const loaded = API.createElement({ id: "loaded", x: 50 });
      mocks.loadFromJSON.mockImplementationOnce(async (appState) => ({
        elements: [loaded],
        appState: { ...appState, name: "loaded scene" },
        files: {},
      }));

      API.executeAction(actionLoadScene);

      await waitFor(() => expect(h.state.name).toBe("loaded scene"));
      expect(h.elements.map((el) => el.id)).toEqual(["loaded"]);
      expect(mocks.loadFromJSON).toHaveBeenCalledWith(
        expect.objectContaining({ name: expect.any(String) }),
        expect.arrayContaining([expect.objectContaining({ id: "old" })]),
      );
    });

    it("does nothing when the user cancels the file picker", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      mocks.loadFromJSON.mockRejectedValueOnce(namedError("AbortError"));

      const result = await actionLoadScene.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result).toBe(false);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("shows an error message when loading fails", async () => {
      API.setElements([API.createElement({ id: "keep" })]);
      mocks.loadFromJSON.mockRejectedValueOnce(new Error("invalid file"));

      API.executeAction(actionLoadScene);

      await waitFor(() => expect(h.state.errorMessage).toBe("invalid file"));
      expect(h.elements.map((el) => el.id)).toEqual(["keep"]);
    });
  });
});
