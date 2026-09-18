import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";
import { MIME_TYPES } from "@excalidraw/common";
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { vi } from "vitest";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { LauncherSplash } from "../components/splash/LauncherSplash";
import { STARTER_TEMPLATES, parseTemplateElements } from "../data/templates";

const aiEnabledMock = vi.fn(() => false);

vi.mock("../components/splash/splashVariant", async (importOriginal) => {
  const module = await importOriginal<
    typeof import("../components/splash/splashVariant")
  >();
  return {
    ...module,
    isAIEnabled: () => aiEnabledMock(),
  };
});

vi.mock("@excalidraw/excalidraw/components/App", async (importOriginal) => {
  const module = await importOriginal<
    typeof import("@excalidraw/excalidraw/components/App")
  >();
  return {
    ...module,
    useAppProps: () => ({ aiEnabled: true }),
  };
});

type MockAPI = Pick<
  ExcalidrawImperativeAPI,
  | "updateScene"
  | "setViewport"
  | "addFiles"
  | "getAppState"
  | "getSceneElements"
>;

const createMockAPI = (
  sceneElements: readonly unknown[] = [],
): MockAPI & { [K in keyof MockAPI]: ReturnType<typeof vi.fn> } => {
  const appState = getDefaultAppState();
  return {
    updateScene: vi.fn(),
    setViewport: vi.fn(),
    addFiles: vi.fn(),
    getAppState: vi.fn(() => appState),
    getSceneElements: vi.fn(() => sceneElements),
  } as any;
};

const SCENE_JSON = JSON.stringify({
  type: "excalidraw",
  version: 2,
  source: "test",
  elements: [
    {
      id: "rect-1",
      type: "rectangle",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      angle: 0,
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: 1,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
    },
  ],
  appState: {
    viewBackgroundColor: "#fef3c7",
    gridSize: 40,
    gridStep: 4,
    gridModeEnabled: true,
    name: "Imported scene",
  },
  files: {},
});

const createSceneFile = (name = "scene.excalidraw") =>
  new File([SCENE_JSON], name, { type: MIME_TYPES.excalidraw });

const createPngFile = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "image.png", {
    type: MIME_TYPES.png,
  });

const renderSplash = async (api: MockAPI) => {
  const result = render(
    <LauncherSplash
      excalidrawAPI={api as unknown as ExcalidrawImperativeAPI}
    />,
  );
  const root =
    result.container.querySelector<HTMLDivElement>(".launcher-splash")!;
  const input = screen.getByLabelText(
    "What do you want to draw?",
  ) as HTMLInputElement;
  return { ...result, root, input };
};

const submitPrompt = (input: HTMLInputElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest("form")!);
};

const expectTemplateLoaded = (
  api: ReturnType<typeof createMockAPI>,
  templateId: string,
) => {
  const template = STARTER_TEMPLATES.find((t) => t.id === templateId)!;
  const expectedIds = parseTemplateElements(template).map((el) => el.id);

  expect(api.updateScene).toHaveBeenCalledTimes(1);
  const call = api.updateScene.mock.calls[0][0];
  expect(call.captureUpdate).toBe(CaptureUpdateAction.IMMEDIATELY);
  expect(call.elements.map((el: { id: string }) => el.id)).toEqual(expectedIds);
  expect(expectedIds.length).toBeGreaterThan(0);
  expect(api.setViewport).toHaveBeenCalledWith(
    expect.objectContaining({ fit: "scale-down" }),
  );
};

// jsdom has no DragEvent, so `relatedTarget` cannot be passed via event init
const dragLeaveTo = (
  target: HTMLElement,
  relatedTarget: EventTarget | null,
) => {
  const event = createEvent.dragLeave(target);
  Object.defineProperty(event, "relatedTarget", { value: relatedTarget });
  fireEvent(target, event);
};

const dropFiles = (target: HTMLElement, files: File[]) => {
  const event = createEvent.drop(target, { dataTransfer: { files } });
  const preventDefault = vi.spyOn(event, "preventDefault");
  fireEvent(target, event);
  return { event, preventDefault };
};

beforeEach(() => {
  aiEnabledMock.mockReturnValue(false);
  editorJotaiStore.set(chatHistoryAtom, {
    ...editorJotaiStore.get(chatHistoryAtom),
    currentPrompt: "",
  });
});

describe("LauncherSplash", () => {
  describe("template routing", () => {
    it("loads a template when the prompt matches a keyword", async () => {
      const api = createMockAPI();
      const { input } = await renderSplash(api);

      submitPrompt(input, "a kanban for sprint");

      expectTemplateLoaded(api, "kanban-board");
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("loads a template when its chip is clicked", async () => {
      const api = createMockAPI();
      await renderSplash(api);

      fireEvent.click(screen.getByText("Timeline"));

      expectTemplateLoaded(api, "timeline");
    });

    it("renders one chip per starter template", async () => {
      await renderSplash(createMockAPI());
      expect(screen.getAllByRole("listitem")).toHaveLength(
        STARTER_TEMPLATES.length,
      );
    });

    it("ignores an empty prompt", async () => {
      const api = createMockAPI();
      const { input } = await renderSplash(api);

      expect(screen.getByRole("button", { name: "Go" })).toBeDisabled();
      submitPrompt(input, "   ");

      expect(api.updateScene).not.toHaveBeenCalled();
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  describe("free-text prompts", () => {
    it("opens text-to-diagram with the prompt prefilled when AI is enabled", async () => {
      aiEnabledMock.mockReturnValue(true);
      const api = createMockAPI();
      const { input } = await renderSplash(api);

      expect(screen.getByRole("button", { name: "Draw" })).toBeTruthy();
      submitPrompt(input, "a diagram of the water cycle");

      expect(api.updateScene).toHaveBeenCalledTimes(1);
      expect(api.updateScene).toHaveBeenCalledWith({
        appState: { openDialog: { name: "ttd", tab: "text-to-diagram" } },
      });
      expect(editorJotaiStore.get(chatHistoryAtom).currentPrompt).toBe(
        "a diagram of the water cycle",
      );
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("shows an inline hint and leaves the scene alone when AI is disabled", async () => {
      const api = createMockAPI();
      const { input } = await renderSplash(api);

      submitPrompt(input, "a diagram of the water cycle");

      expect(api.updateScene).not.toHaveBeenCalled();
      expect(editorJotaiStore.get(chatHistoryAtom).currentPrompt).toBe("");
      const hint = screen.getByRole("status");
      expect(hint).toHaveClass("launcher-splash__hint--info");
      expect(hint.textContent).toContain("No template matched");
      for (const template of STARTER_TEMPLATES) {
        expect(hint.textContent).toContain(template.keywords[0]);
      }

      fireEvent.change(input, { target: { value: "kanban" } });
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  describe("scene import", () => {
    it("imports a dropped .excalidraw file into the empty canvas", async () => {
      const api = createMockAPI();
      const { root } = await renderSplash(api);

      fireEvent.dragEnter(root);
      expect(root).toHaveClass("launcher-splash--drag-over");

      const { event, preventDefault } = dropFiles(root, [createSceneFile()]);

      expect(preventDefault).toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
      expect(root).not.toHaveClass("launcher-splash--drag-over");

      await waitFor(() => expect(api.updateScene).toHaveBeenCalledTimes(1));

      const call = api.updateScene.mock.calls[0][0];
      expect(call.captureUpdate).toBe(CaptureUpdateAction.IMMEDIATELY);
      expect(call.elements).toHaveLength(1);
      expect(call.elements[0]).toEqual(
        expect.objectContaining({
          id: "rect-1",
          type: "rectangle",
          width: 100,
          height: 50,
        }),
      );
      expect(call.appState).toEqual({
        viewBackgroundColor: "#fef3c7",
        gridSize: 40,
        gridStep: 4,
        gridModeEnabled: true,
        fileHandle: null,
        // `name` is not part of the exported app state, so it falls back
        name: api.getAppState().name,
      });
      expect(api.setViewport).toHaveBeenCalledWith(
        expect.objectContaining({ fit: "scale-down" }),
      );
      expect(api.addFiles).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("falls back to the current app state for missing scene settings", async () => {
      const api = createMockAPI();
      const current = api.getAppState();
      const { root } = await renderSplash(api);

      const file = new File(
        [JSON.stringify({ type: "excalidraw", version: 2, elements: [] })],
        "bare.excalidraw",
        { type: MIME_TYPES.excalidraw },
      );
      dropFiles(root, [file]);

      await waitFor(() => expect(api.updateScene).toHaveBeenCalledTimes(1));
      const call = api.updateScene.mock.calls[0][0];
      expect(call.elements).toEqual([]);
      expect(call.appState).toEqual({
        viewBackgroundColor: current.viewBackgroundColor,
        gridSize: current.gridSize,
        gridStep: current.gridStep,
        gridModeEnabled: current.gridModeEnabled,
        fileHandle: null,
        name: current.name,
      });
      expect(api.setViewport).not.toHaveBeenCalled();
    });

    it("lets the canvas handle a dropped PNG", async () => {
      const api = createMockAPI();
      const { root } = await renderSplash(api);

      fireEvent.dragEnter(root);
      expect(root).toHaveClass("launcher-splash--drag-over");

      const { event, preventDefault } = dropFiles(root, [createPngFile()]);

      expect(preventDefault).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
      expect(root).not.toHaveClass("launcher-splash--drag-over");

      await act(async () => {
        await Promise.resolve();
      });
      expect(api.updateScene).not.toHaveBeenCalled();
      expect(api.getAppState).not.toHaveBeenCalled();
    });

    it("does not prevent default on drag-over for non-scene files", async () => {
      const api = createMockAPI();
      const { root } = await renderSplash(api);

      const pngDragOver = createEvent.dragOver(root, {
        dataTransfer: { files: [createPngFile()] },
      });
      fireEvent(root, pngDragOver);
      expect(pngDragOver.defaultPrevented).toBe(false);
      expect(root).toHaveClass("launcher-splash--drag-over");

      const sceneDragOver = createEvent.dragOver(root, {
        dataTransfer: { files: [createSceneFile()] },
      });
      fireEvent(root, sceneDragOver);
      expect(sceneDragOver.defaultPrevented).toBe(true);
    });

    it("skips the import when the canvas already has elements", async () => {
      const api = createMockAPI([{ id: "existing" }]);
      const { root } = await renderSplash(api);

      const { preventDefault } = dropFiles(root, [createSceneFile()]);
      expect(preventDefault).toHaveBeenCalled();

      await act(async () => {
        await Promise.resolve();
      });
      expect(api.getSceneElements).toHaveBeenCalled();
      expect(api.getAppState).not.toHaveBeenCalled();
      expect(api.updateScene).not.toHaveBeenCalled();
      expect(api.setViewport).not.toHaveBeenCalled();
    });

    it("shows an error hint when the dropped scene file is invalid", async () => {
      const api = createMockAPI();
      const { root } = await renderSplash(api);

      dropFiles(root, [
        new File(["{not json"], "broken.excalidraw", {
          type: MIME_TYPES.excalidraw,
        }),
      ]);

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain('Couldn\'t read "broken.excalidraw"');
      expect(api.updateScene).not.toHaveBeenCalled();
    });

    it("imports a pasted .excalidraw file", async () => {
      const api = createMockAPI();
      const { root } = await renderSplash(api);

      const event = createEvent.paste(root, {
        clipboardData: { files: [createSceneFile()] },
      });
      fireEvent(root, event);

      expect(event.defaultPrevented).toBe(true);
      await waitFor(() => expect(api.updateScene).toHaveBeenCalledTimes(1));
    });
  });

  describe("drag-over state", () => {
    it("toggles the drag-over class on dragenter / dragleave", async () => {
      const { root } = await renderSplash(createMockAPI());

      expect(root).not.toHaveClass("launcher-splash--drag-over");

      fireEvent.dragEnter(root);
      expect(root).toHaveClass("launcher-splash--drag-over");

      fireEvent.dragLeave(root);
      expect(root).not.toHaveClass("launcher-splash--drag-over");
    });

    it("keeps the drag-over class when leaving into a child element", async () => {
      const { root, input } = await renderSplash(createMockAPI());

      fireEvent.dragEnter(root);
      dragLeaveTo(root, input);
      expect(root).toHaveClass("launcher-splash--drag-over");

      dragLeaveTo(root, document.body);
      expect(root).not.toHaveClass("launcher-splash--drag-over");
    });
  });
});
