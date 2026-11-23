import { fireEvent, render as rtlRender, within } from "@testing-library/react";
import { vi } from "vitest";

import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import { loadFromJSON, saveAsJSON } from "../data/index";
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
  actionLoadScene,
  actionSaveFileToDisk,
  actionSaveToActiveFile,
} from "./actionExport";

import type { Action } from "./types";

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

const { h } = window;

const elements = () => h.app.scene.getElementsIncludingDeleted();

const saveAsJSONMock = vi.mocked(saveAsJSON);
const loadFromJSONMock = vi.mocked(loadFromJSON);
const resaveMock = vi.mocked(resaveAsImageWithScene);

const fileHandle = (name: string) => ({ name } as FileSystemFileHandle);

const namedError = (name: string) => Object.assign(new Error(name), { name });

const keyEvent = (init: KeyboardEventInit) =>
  new KeyboardEvent("keydown", init);

/** saveAsJSON mock that awaits the exported data like the real one */
const resolveWithData = (name: string) =>
  saveAsJSONMock.mockImplementation(async ({ data }) => {
    await data;
    return { fileHandle: fileHandle(name) };
  });

const renderEditor = async (props: Partial<ExcalidrawProps> = {}) => {
  await render(<Excalidraw handleKeyboardGlobally={true} {...props} />);
};

describe("actionExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("export settings", () => {
    beforeEach(renderEditor);

    it("updates name, scale, background and embedScene from the passed value", () => {
      const execute = (action: Action, value: unknown) =>
        act(() => {
          h.app.actionManager.executeAction(action, "api", value);
        });
      execute(actionChangeProjectName, "My drawing");
      execute(actionChangeExportScale, 3);
      execute(actionChangeExportBackground, false);
      execute(actionChangeExportEmbedScene, true);

      expect(h.state.name).toBe("My drawing");
      expect(h.state.exportScale).toBe(3);
      expect(h.state.exportBackground).toBe(false);
      expect(h.state.exportEmbedScene).toBe(true);
    });

    it("toggles background and embedScene from their checkbox panels", () => {
      API.setAppState({ exportBackground: true, exportEmbedScene: false });

      const background = within(
        rtlRender(
          <>{h.app.actionManager.renderAction("changeExportBackground")}</>,
        ).container,
      );
      expect(background.getByRole("checkbox")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      act(() => {
        fireEvent.click(background.getByRole("checkbox"));
      });
      expect(h.state.exportBackground).toBe(false);

      const embed = within(
        rtlRender(
          <>{h.app.actionManager.renderAction("changeExportEmbedScene")}</>,
        ).container,
      );
      expect(embed.getByRole("checkbox")).toHaveAttribute(
        "aria-checked",
        "false",
      );
      act(() => {
        fireEvent.click(embed.getByRole("checkbox"));
      });
      expect(h.state.exportEmbedScene).toBe(true);
    });
  });

  describe("saveToActiveFile", () => {
    beforeEach(renderEditor);

    it("is enabled only with a file handle outside view mode", () => {
      const predicate = (state: Partial<typeof h.state>) =>
        actionSaveToActiveFile.predicate!(
          h.elements,
          { ...h.state, ...state },
          h.app.props,
          h.app,
        );

      expect(predicate({ fileHandle: null })).toBe(false);
      expect(predicate({ fileHandle: fileHandle("a.excalidraw") })).toBe(true);
      expect(
        predicate({
          fileHandle: fileHandle("a.excalidraw"),
          viewModeEnabled: true,
        }),
      ).toBe(false);
    });

    it("is bound to Ctrl+S but not Ctrl+Shift+S", () => {
      expect(
        actionSaveToActiveFile.keyTest!(
          keyEvent({ key: KEYS.S, ctrlKey: true }),
        ),
      ).toBe(true);
      expect(
        actionSaveToActiveFile.keyTest!(
          keyEvent({ key: KEYS.S, ctrlKey: true, shiftKey: true }),
        ),
      ).toBe(false);
    });

    it("saves JSON to the existing handle and names the file in the toast", async () => {
      resolveWithData("drawing.excalidraw");
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([rect]);
      const previous = fileHandle("drawing.excalidraw");

      const result = await actionSaveToActiveFile.perform(
        elements(),
        { ...h.state, fileHandle: previous },
        null,
        h.app,
      );

      expect(saveAsJSONMock).toHaveBeenCalledTimes(1);
      const args = saveAsJSONMock.mock.calls[0][0];
      expect(args.fileHandle).toBe(previous);
      expect(args.filename).toBe(h.app.getName());
      const data = (await args.data) as JSONExportData;
      expect(data.elements).toEqual(h.elements);
      expect(data.files).toBe(h.app.files);
      expect(resaveMock).not.toHaveBeenCalled();
      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          fileHandle: fileHandle("drawing.excalidraw"),
          toast: {
            message: t("toast.fileSavedToFilename").replace(
              "{filename}",
              `"drawing.excalidraw"`,
            ),
            duration: 1500,
          },
        },
      });
    });

    it("shows a generic toast when there was no previous handle", async () => {
      resolveWithData("new.excalidraw");

      const result = await actionSaveToActiveFile.perform(
        elements(),
        { ...h.state, fileHandle: null },
        null,
        h.app,
      );

      expect(result).toMatchObject({
        appState: {
          toast: { message: t("toast.fileSaved"), duration: 1500 },
        },
      });
    });

    it.each(["drawing.png", "drawing.svg"])(
      "re-saves image handles (%s) with the embedded scene",
      async (name) => {
        const previous = fileHandle(name);
        resaveMock.mockResolvedValueOnce({ fileHandle: previous });

        const result = await actionSaveToActiveFile.perform(
          elements(),
          { ...h.state, fileHandle: previous },
          null,
          h.app,
        );

        expect(saveAsJSONMock).not.toHaveBeenCalled();
        expect(resaveMock).toHaveBeenCalledTimes(1);
        expect(resaveMock.mock.calls[0][1]).toBe(previous);
        expect(resaveMock.mock.calls[0][2]).toBe(h.app.getName());
        expect(result).toMatchObject({ appState: { fileHandle: previous } });
      },
    );

    it.each([
      ["AbortError", "warn"],
      ["Error", "error"],
    ] as const)(
      "clears the toast and logs via console.%s when saving fails with %s",
      async (name, level) => {
        saveAsJSONMock.mockRejectedValueOnce(namedError(name));
        const spy = vi.spyOn(console, level).mockImplementation(() => {});

        const result = await actionSaveToActiveFile.perform(
          elements(),
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

    it("ignores a second save while one is in progress", async () => {
      let finish!: () => void;
      saveAsJSONMock.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = () => resolve({ fileHandle: fileHandle("a.excalidraw") });
          }),
      );

      const first = actionSaveToActiveFile.perform(
        elements(),
        h.state,
        null,
        h.app,
      );
      const second = await actionSaveFileToDisk.perform(
        elements(),
        h.state,
        null,
        h.app,
      );
      expect(second).toBe(false);
      expect(saveAsJSONMock).toHaveBeenCalledTimes(1);

      finish();
      await first;

      resolveWithData("b.excalidraw");
      const third = await actionSaveToActiveFile.perform(
        elements(),
        h.state,
        null,
        h.app,
      );
      expect(third).not.toBe(false);
      expect(saveAsJSONMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("onExport host callback", () => {
    it("is called with the scene and shows progress from an async iterator", async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const onExport = vi.fn(async function* () {
        yield {
          type: "progress" as const,
          message: "Uploading",
          progress: 0.5,
        };
        await gate;
        yield { type: "done" as const };
      });
      await renderEditor({
        onExport: onExport as unknown as ExcalidrawProps["onExport"],
      });
      resolveWithData("a.excalidraw");

      const pending = actionSaveFileToDisk.perform(
        elements(),
        h.state,
        null,
        h.app,
      );

      await waitFor(() => expect(h.state.toast?.duration).toBe(Infinity));
      expect(onExport).toHaveBeenCalledTimes(1);
      const [type, data, opts] = onExport.mock.calls[0] as any[];
      expect(type).toBe("json");
      expect(data).toMatchObject({ elements: h.elements, files: h.app.files });
      expect(opts.signal).toBeInstanceOf(AbortSignal);

      release();
      const result = await pending;
      expect(result).toMatchObject({
        appState: { toast: { message: t("toast.fileSaved") } },
      });
    });

    it("shows the default progress message while a returned promise is pending", async () => {
      let release!: () => void;
      const onExport = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );
      await renderEditor({ onExport });
      resolveWithData("a.excalidraw");

      const pending = actionSaveFileToDisk.perform(
        elements(),
        h.state,
        null,
        h.app,
      );

      await waitFor(() =>
        expect(h.state.toast?.message).toBe(t("progressDialog.defaultMessage")),
      );
      release();
      expect(await pending).toMatchObject({
        appState: { fileHandle: fileHandle("a.excalidraw") },
      });
    });

    it.each([
      ["AbortError", "warn"],
      ["Error", "error"],
    ] as const)(
      "still saves when onExport throws %s (logged via console.%s)",
      async (name, level) => {
        const onExport = vi.fn(async () => {
          throw namedError(name);
        });
        await renderEditor({ onExport });
        resolveWithData("a.excalidraw");
        const spy = vi.spyOn(console, level).mockImplementation(() => {});

        const result = await actionSaveFileToDisk.perform(
          elements(),
          h.state,
          null,
          h.app,
        );

        expect(spy).toHaveBeenCalled();
        expect(result).toMatchObject({
          appState: { fileHandle: fileHandle("a.excalidraw") },
        });
        spy.mockRestore();
      },
    );
  });

  describe("saveFileToDisk", () => {
    beforeEach(renderEditor);

    it("always saves to a new file and closes the dialog", async () => {
      resolveWithData("copy.excalidraw");

      const result = await actionSaveFileToDisk.perform(
        elements(),
        { ...h.state, fileHandle: fileHandle("orig.excalidraw") },
        null,
        h.app,
      );

      expect(saveAsJSONMock.mock.calls[0][0]).toMatchObject({
        fileHandle: null,
        filename: h.app.getName(),
      });
      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          openDialog: null,
          fileHandle: fileHandle("copy.excalidraw"),
          toast: { message: t("toast.fileSaved"), duration: 3000 },
        },
      });
    });

    it("clears the toast when saving fails", async () => {
      saveAsJSONMock.mockRejectedValueOnce(namedError("AbortError"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await actionSaveFileToDisk.perform(
        elements(),
        h.state,
        null,
        h.app,
      );

      expect(result).toEqual({
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: { toast: null },
      });
      warn.mockRestore();
    });

    it("is bound to Ctrl+Shift+S and allowed in view mode", () => {
      expect(actionSaveFileToDisk.viewMode).toBe(true);
      expect(
        actionSaveFileToDisk.keyTest!(
          keyEvent({ key: "S", ctrlKey: true, shiftKey: true }),
        ),
      ).toBe(true);
      expect(
        actionSaveFileToDisk.keyTest!(keyEvent({ key: KEYS.S, ctrlKey: true })),
      ).toBe(false);
    });
  });

  describe("loadScene", () => {
    beforeEach(renderEditor);

    it("is disabled in view mode and bound to Ctrl+O", () => {
      expect(
        actionLoadScene.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(true);
      expect(
        actionLoadScene.predicate!(
          h.elements,
          { ...h.state, viewModeEnabled: true },
          h.app.props,
          h.app,
        ),
      ).toBe(false);
      expect(
        actionLoadScene.keyTest!(keyEvent({ key: KEYS.O, ctrlKey: true })),
      ).toBe(true);
    });

    it("replaces the scene with the loaded file", async () => {
      const loaded = [API.createElement({ type: "ellipse", id: "loaded" })];
      const loadedState = { ...h.state, name: "loaded" };
      loadFromJSONMock.mockResolvedValueOnce({
        elements: loaded,
        appState: loadedState,
        files: {},
      } as any);

      const result = await actionLoadScene.perform(
        elements(),
        h.state,
        null,
        h.app,
      );

      expect(loadFromJSONMock).toHaveBeenCalledWith(h.state, h.elements);
      expect(result).toEqual({
        elements: loaded,
        appState: loadedState,
        files: {},
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });

    it("returns false when the user cancels the file picker", async () => {
      loadFromJSONMock.mockRejectedValueOnce(namedError("AbortError"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(
        await actionLoadScene.perform(elements(), h.state, null, h.app),
      ).toBe(false);
      warn.mockRestore();
    });

    it("keeps the current scene and shows the error on failure", async () => {
      loadFromJSONMock.mockRejectedValueOnce(new Error("invalid file"));

      const result = await actionLoadScene.perform(
        elements(),
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
