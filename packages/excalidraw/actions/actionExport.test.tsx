import { fireEvent, render as rtlRender } from "@testing-library/react";

import { KEYS, THEME } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

import { loadFromJSON, saveAsJSON } from "../data";
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

import type { Action, ActionResult } from "./types";
import type { OnExportProgress } from "../types";

type PerformResult = Exclude<ActionResult, false>;

vi.mock("../data", async (importOriginal) => {
  const module = await importOriginal<typeof import("../data")>();
  return {
    ...module,
    saveAsJSON: vi.fn(),
    loadFromJSON: vi.fn(),
  };
});

vi.mock("../data/resave", async (importOriginal) => {
  const module = await importOriginal<typeof import("../data/resave")>();
  return {
    ...module,
    resaveAsImageWithScene: vi.fn(),
  };
});

const { h } = window;

const fileHandle = (name: string) => ({ name } as FileSystemFileHandle);

const abortError = () => {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
};

const perform = (
  action: { perform: (...args: any[]) => any },
  value: any = null,
  appState: Partial<typeof h.state> = {},
) =>
  Promise.resolve(
    action.perform(
      h.app.scene.getElementsIncludingDeleted(),
      { ...h.state, ...appState },
      value,
      h.app,
    ),
  ) as Promise<ActionResult | false>;

const keyEvent = (init: KeyboardEventInit) =>
  new KeyboardEvent("keydown", init) as unknown as React.KeyboardEvent &
    KeyboardEvent;

const executeWithValue = (action: any, value: any) => {
  act(() => {
    h.app.actionManager.executeAction(action, "api", value);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(saveAsJSON).mockImplementation(async ({ data }) => {
    await data;
    return { fileHandle: fileHandle("saved.excalidraw") };
  });
});

describe("export setting actions", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("sets the project name, export scale, background and embed flags", () => {
    executeWithValue(actionChangeProjectName, "My drawing");
    expect(h.state.name).toBe("My drawing");

    executeWithValue(actionChangeExportScale, 3);
    expect(h.state.exportScale).toBe(3);

    executeWithValue(actionChangeExportBackground, false);
    expect(h.state.exportBackground).toBe(false);

    executeWithValue(actionChangeExportEmbedScene, true);
    expect(h.state.exportEmbedScene).toBe(true);
  });

  it("exportWithDarkMode updates state and the session export theme override", () => {
    executeWithValue(actionExportWithDarkMode, true);
    expect(h.state.exportWithDarkMode).toBe(true);
    expect(h.app.sessionExportThemeOverride).toBe(THEME.DARK);

    executeWithValue(actionExportWithDarkMode, false);
    expect(h.state.exportWithDarkMode).toBe(false);
    expect(h.app.sessionExportThemeOverride).toBe(THEME.LIGHT);
  });

  it("background and embed-scene checkboxes toggle their state", () => {
    API.setAppState({ exportBackground: true, exportEmbedScene: false });

    const background = rtlRender(
      <>{h.app.actionManager.renderAction("changeExportBackground")}</>,
    );
    const backgroundBox = background.getByRole("checkbox");
    expect(backgroundBox.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(backgroundBox);
    expect(h.state.exportBackground).toBe(false);
    background.unmount();

    const embed = rtlRender(
      <>{h.app.actionManager.renderAction("changeExportEmbedScene")}</>,
    );
    const embedBox = embed.getByRole("checkbox");
    expect(embedBox.getAttribute("aria-checked")).toBe("false");
    expect(embed.container.textContent).toContain(
      t("imageExportDialog.label.embedScene"),
    );
    fireEvent.click(embedBox);
    expect(h.state.exportEmbedScene).toBe(true);
    embed.unmount();
  });

  it("project name input renames the scene on blur", () => {
    const { container, unmount } = rtlRender(
      <>{h.app.actionManager.renderAction("changeProjectName")}</>,
    );
    const input = container.querySelector("input")!;
    expect(input.value).toBe(h.app.getName());

    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.blur(input);

    expect(h.state.name).toBe("Renamed");
    unmount();
  });
});

describe("actionSaveToActiveFile", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("is enabled only with a file handle outside view mode", () => {
    const enabled = (appState: Partial<typeof h.state>) =>
      actionSaveToActiveFile.predicate!(
        h.elements,
        { ...h.state, ...appState },
        h.app.props,
        h.app,
      );

    expect(enabled({ fileHandle: null })).toBe(false);
    expect(enabled({ fileHandle: fileHandle("a.excalidraw") })).toBe(true);
    expect(
      enabled({
        fileHandle: fileHandle("a.excalidraw"),
        viewModeEnabled: true,
      }),
    ).toBe(false);
  });

  it("matches Ctrl/Cmd+S but not Ctrl/Cmd+Shift+S", () => {
    const keyTest = (actionSaveToActiveFile as Action).keyTest!;
    expect(
      keyTest(
        keyEvent({ key: KEYS.S, [KEYS.CTRL_OR_CMD]: true }),
        h.state,
        h.elements,
        h.app,
      ),
    ).toBe(true);
    expect(
      keyTest(
        keyEvent({ key: KEYS.S, [KEYS.CTRL_OR_CMD]: true, shiftKey: true }),
        h.state,
        h.elements,
        h.app,
      ),
    ).toBe(false);
  });

  it("saves to the existing JSON handle and names it in the toast", async () => {
    const elements = [API.createElement({ id: "a" })];
    API.setElements(elements);
    const previous = fileHandle("saved.excalidraw");

    const result = (await perform(actionSaveToActiveFile, null, {
      fileHandle: previous,
    })) as PerformResult;

    expect(saveAsJSON).toHaveBeenCalledTimes(1);
    const args = vi.mocked(saveAsJSON).mock.calls[0][0];
    expect(args.fileHandle).toBe(previous);
    expect(args.filename).toBe(h.app.getName());
    const data = await args.data;
    expect(data.elements.map((el) => el.id)).toEqual(["a"]);
    expect(data.files).toBe(h.app.files);
    expect(resaveAsImageWithScene).not.toHaveBeenCalled();
    expect(result).toEqual({
      captureUpdate: CaptureUpdateAction.NEVER,
      appState: {
        fileHandle: expect.objectContaining({ name: "saved.excalidraw" }),
        toast: {
          message: t("toast.fileSavedToFilename").replace(
            "{filename}",
            `"saved.excalidraw"`,
          ),
          duration: 1500,
        },
      },
    });
  });

  it("shows a generic toast when there was no previous handle", async () => {
    const result = (await perform(actionSaveToActiveFile, null, {
      fileHandle: null,
    })) as PerformResult;

    expect(result.appState?.toast).toEqual({
      message: t("toast.fileSaved"),
      duration: 1500,
    });
  });

  it("re-saves image file handles with the embedded scene", async () => {
    const previous = fileHandle("drawing.png");
    vi.mocked(resaveAsImageWithScene).mockResolvedValueOnce({
      fileHandle: previous,
    });

    const result = (await perform(actionSaveToActiveFile, null, {
      fileHandle: previous,
    })) as PerformResult;

    expect(saveAsJSON).not.toHaveBeenCalled();
    expect(resaveAsImageWithScene).toHaveBeenCalledWith(
      expect.any(Promise),
      previous,
      h.app.getName(),
    );
    expect(result.appState?.fileHandle).toBe(previous);
  });

  it("clears the toast and logs on save failure", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const error = new Error("disk full");
    vi.mocked(saveAsJSON).mockRejectedValueOnce(error);

    const result = await perform(actionSaveToActiveFile, null, {
      fileHandle: fileHandle("a.excalidraw"),
    });

    expect(result).toEqual({
      captureUpdate: CaptureUpdateAction.NEVER,
      appState: { toast: null },
    });
    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });

  it("only warns when the user aborts the save", async () => {
    const consoleError = vi.spyOn(console, "error");
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(saveAsJSON).mockRejectedValueOnce(abortError());

    const result = await perform(actionSaveToActiveFile);

    expect(result).toMatchObject({ appState: { toast: null } });
    expect(consoleWarn).toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  it("ignores a second save while one is in progress", async () => {
    let finishSave!: () => void;
    vi.mocked(saveAsJSON).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSave = () =>
            resolve({ fileHandle: fileHandle("saved.excalidraw") });
        }),
    );

    const first = perform(actionSaveToActiveFile);
    expect(await perform(actionSaveToActiveFile)).toBe(false);
    expect(await perform(actionSaveFileToDisk)).toBe(false);

    finishSave();
    expect(await first).not.toBe(false);
    expect(await perform(actionSaveToActiveFile)).not.toBe(false);
  });
});

describe("actionSaveFileToDisk", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("matches Ctrl/Cmd+Shift+S regardless of key case", () => {
    const keyTest = (actionSaveFileToDisk as Action).keyTest!;
    for (const key of ["s", "S"]) {
      expect(
        keyTest(
          keyEvent({ key, shiftKey: true, [KEYS.CTRL_OR_CMD]: true }),
          h.state,
          h.elements,
          h.app,
        ),
      ).toBe(true);
    }
    expect(
      keyTest(
        keyEvent({ key: "s", [KEYS.CTRL_OR_CMD]: true }),
        h.state,
        h.elements,
        h.app,
      ),
    ).toBe(false);
  });

  it("always saves to a new file and closes the dialog", async () => {
    const result = (await perform(actionSaveFileToDisk, null, {
      fileHandle: fileHandle("existing.excalidraw"),
      openDialog: { name: "jsonExport" },
    })) as PerformResult;

    expect(vi.mocked(saveAsJSON).mock.calls[0][0]).toMatchObject({
      fileHandle: null,
      filename: h.app.getName(),
    });
    expect(result).toEqual({
      captureUpdate: CaptureUpdateAction.NEVER,
      appState: {
        openDialog: null,
        fileHandle: expect.objectContaining({ name: "saved.excalidraw" }),
        toast: { message: t("toast.fileSaved"), duration: 3000 },
      },
    });
  });

  it("clears the toast on failure", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(saveAsJSON).mockRejectedValueOnce(abortError());

    expect(await perform(actionSaveFileToDisk)).toEqual({
      captureUpdate: CaptureUpdateAction.NEVER,
      appState: { toast: null },
    });
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});

describe("onExport host hook", () => {
  it("waits for a promise-returning onExport and passes the scene", async () => {
    let resolveExport!: () => void;
    const onExport = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveExport = resolve;
        }),
    );
    await render(<Excalidraw onExport={onExport} />);
    const setAppState = vi.spyOn(h.app, "setAppState");
    let dataResolved = false;
    vi.mocked(saveAsJSON).mockImplementationOnce(async ({ data }) => {
      await data;
      dataResolved = true;
      return { fileHandle: fileHandle("saved.excalidraw") };
    });

    let pending!: Promise<ActionResult | false>;
    await act(async () => {
      pending = perform(actionSaveFileToDisk);
    });

    expect(onExport).toHaveBeenCalledWith(
      "json",
      expect.objectContaining({ elements: h.elements, files: h.app.files }),
      { signal: expect.any(AbortSignal) },
    );
    expect(setAppState).toHaveBeenCalledWith({
      toast: {
        message: t("progressDialog.defaultMessage"),
        duration: Infinity,
      },
    });
    expect(dataResolved).toBe(false);

    resolveExport();
    await act(() => pending);
    expect(dataResolved).toBe(true);
  });

  it("renders progress messages from an async generator until done", async () => {
    const afterDone = vi.fn();
    async function* onExport(): AsyncGenerator<OnExportProgress, void> {
      yield { type: "progress", message: "Uploading", progress: 0.5 };
      yield { type: "progress", message: "Almost" };
      yield { type: "done" } as any;
      afterDone();
    }
    await render(<Excalidraw onExport={onExport} />);
    const setAppState = vi.spyOn(h.app, "setAppState");

    await act(() => perform(actionSaveFileToDisk));

    const toasts = setAppState.mock.calls.map(
      ([state]) => (state as any).toast,
    );
    expect(toasts).toHaveLength(2);
    expect(toasts[0].duration).toBe(Infinity);
    expect(typeof toasts[0].message).toBe("object");
    expect(toasts[1]).toEqual({ message: "Almost", duration: Infinity });
    expect(afterDone).not.toHaveBeenCalled();
  });

  it("still saves the original data when onExport throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const onExport = vi.fn(async () => {
      throw new Error("host failed");
    });
    await render(<Excalidraw onExport={onExport} />);

    const result = (await perform(actionSaveFileToDisk)) as PerformResult;

    expect(consoleError).toHaveBeenCalledWith(
      "Error during props.onExport() handling",
      expect.any(Error),
    );
    expect(result.appState?.fileHandle).toEqual(
      expect.objectContaining({ name: "saved.excalidraw" }),
    );
    consoleError.mockRestore();
  });

  it("aborts the onExport signal when saving fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    let signal: AbortSignal | undefined;
    const onExport = vi.fn((_type, _data, opts: { signal: AbortSignal }) => {
      signal = opts.signal;
    });
    await render(<Excalidraw onExport={onExport} />);
    vi.mocked(saveAsJSON).mockRejectedValueOnce(new Error("disk full"));

    await perform(actionSaveFileToDisk);

    expect(signal?.aborted).toBe(true);
    consoleError.mockRestore();
  });
});

describe("actionLoadScene", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("is disabled in view mode and matches Ctrl/Cmd+O", () => {
    const enabled = (appState: Partial<typeof h.state>) =>
      actionLoadScene.predicate!(
        h.elements,
        { ...h.state, ...appState },
        h.app.props,
        h.app,
      );
    expect(enabled({})).toBe(true);
    expect(enabled({ viewModeEnabled: true })).toBe(false);

    expect(
      (actionLoadScene as Action).keyTest!(
        keyEvent({ key: KEYS.O, [KEYS.CTRL_OR_CMD]: true }),
        h.state,
        h.elements,
        h.app,
      ),
    ).toBe(true);
    expect(
      (actionLoadScene as Action).keyTest!(
        keyEvent({ key: KEYS.O }),
        h.state,
        h.elements,
        h.app,
      ),
    ).toBeFalsy();
  });

  it("replaces the scene with the loaded data", async () => {
    const loadedElements = [
      API.createElement({ id: "loaded" }),
    ] as OrderedExcalidrawElement[];
    const loadedAppState = { ...h.state, name: "loaded" };
    const files = {};
    vi.mocked(loadFromJSON).mockResolvedValueOnce({
      elements: loadedElements,
      appState: loadedAppState,
      files,
    });

    const result = await perform(actionLoadScene);

    expect(loadFromJSON).toHaveBeenCalledWith(
      expect.objectContaining({ name: h.state.name }),
      h.elements,
    );
    expect(result).toEqual({
      elements: loadedElements,
      appState: loadedAppState,
      files,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  });

  it("returns false when the user cancels the file picker", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(loadFromJSON).mockRejectedValueOnce(abortError());

    expect(await perform(actionLoadScene)).toBe(false);
    consoleWarn.mockRestore();
  });

  it("keeps the current scene and shows the error on failure", async () => {
    vi.mocked(loadFromJSON).mockRejectedValueOnce(new Error("invalid file"));
    const elements = h.elements;

    const result = (await perform(actionLoadScene)) as PerformResult;

    expect(result.elements).toBe(elements);
    expect(result.files).toBe(h.app.files);
    expect(result.appState?.errorMessage).toBe("invalid file");
    expect(result.captureUpdate).toBe(CaptureUpdateAction.EVENTUALLY);
  });
});
