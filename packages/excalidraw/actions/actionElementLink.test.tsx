import { CaptureUpdateAction } from "@excalidraw/element";

import { copyTextToSystemClipboard } from "../clipboard";
import { t } from "../i18n";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { render } from "../tests/test-utils";

import {
  actionCopyElementLink,
  actionLinkToElement,
} from "./actionElementLink";

import type { ActionResult } from "./types";

type PerformResult = Exclude<ActionResult, false>;

vi.mock("../clipboard", async (importOriginal) => {
  const module = await importOriginal<typeof import("../clipboard")>();
  return {
    ...module,
    copyTextToSystemClipboard: vi.fn(async () => {}),
  };
});

const { h } = window;

const performCopyLink = () =>
  actionCopyElementLink.perform(
    h.app.scene.getElementsIncludingDeleted(),
    h.state,
    null,
    h.app,
  ) as Promise<PerformResult>;

describe("actionElementLink", () => {
  beforeEach(() => {
    vi.mocked(copyTextToSystemClipboard).mockClear();
  });

  describe("actionCopyElementLink", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("is enabled for a single element or a single group only", () => {
      const a = API.createElement({ id: "a", groupIds: ["g1"] });
      const b = API.createElement({ id: "b", groupIds: ["g1"] });
      const c = API.createElement({ id: "c" });
      API.setElements([a, b, c]);

      API.setSelectedElements([c]);
      expect(h.app.actionManager.isActionEnabled(actionCopyElementLink)).toBe(
        true,
      );

      API.setSelectedElements([a, b]);
      expect(h.app.actionManager.isActionEnabled(actionCopyElementLink)).toBe(
        true,
      );

      API.setSelectedElements([a, b, c]);
      expect(h.app.actionManager.isActionEnabled(actionCopyElementLink)).toBe(
        false,
      );

      API.setSelectedElements([]);
      expect(h.app.actionManager.isActionEnabled(actionCopyElementLink)).toBe(
        false,
      );
    });

    it("copies an element link for a single selected element and shows a toast", async () => {
      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const result = await performCopyLink();

      expect(copyTextToSystemClipboard).toHaveBeenCalledTimes(1);
      const link = new URL(
        vi.mocked(copyTextToSystemClipboard).mock.calls[0][0] as string,
      );
      expect(link.searchParams.get("element")).toBe("rect");
      expect(link.host).toBe(window.location.host);
      expect(result).toEqual({
        appState: {
          toast: { message: t("toast.elementLinkCopied"), closable: true },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("copies a group link using the selected group id", async () => {
      const a = API.createElement({ id: "a", groupIds: ["g1"] });
      const b = API.createElement({ id: "b", groupIds: ["g1"] });
      API.setElements([a, b]);
      API.setSelectedElements([a, b]);
      expect(h.state.selectedGroupIds).toEqual({ g1: true });

      await performCopyLink();

      const link = new URL(
        vi.mocked(copyTextToSystemClipboard).mock.calls[0][0] as string,
      );
      expect(link.searchParams.get("element")).toBe("g1");
    });

    it("does not copy anything for elements that aren't in one group", async () => {
      const a = API.createElement({ id: "a" });
      const b = API.createElement({ id: "b" });
      API.setElements([a, b]);
      API.setSelectedElements([a, b]);

      const result = await performCopyLink();

      expect(copyTextToSystemClipboard).not.toHaveBeenCalled();
      expect(result.appState).toBe(h.state);
      expect(result.captureUpdate).toBe(CaptureUpdateAction.EVENTUALLY);
      expect(result.appState?.toast).toBeFalsy();
    });

    it("logs and swallows clipboard errors without showing a toast", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const error = new Error("clipboard denied");
      vi.mocked(copyTextToSystemClipboard).mockRejectedValueOnce(error);

      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const result = await performCopyLink();

      expect(consoleError).toHaveBeenCalledWith(error);
      expect(result.appState).toBe(h.state);
      expect(result.appState?.toast).toBeFalsy();
      consoleError.mockRestore();
    });
  });

  it("uses the host generateLinkForSelection prop when provided", async () => {
    const generateLinkForSelection = vi.fn(
      (id: string, type: "element" | "group") =>
        `https://host.example/?${type}=${id}`,
    );
    await render(
      <Excalidraw generateLinkForSelection={generateLinkForSelection} />,
    );
    const rect = API.createElement({ id: "rect" });
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    await performCopyLink();

    expect(generateLinkForSelection).toHaveBeenCalledWith("rect", "element");
    expect(copyTextToSystemClipboard).toHaveBeenCalledWith(
      "https://host.example/?element=rect",
    );
  });

  describe("actionLinkToElement", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("is enabled for exactly one selected element while the selector is closed", () => {
      const a = API.createElement({ id: "a", groupIds: ["g1"] });
      const b = API.createElement({ id: "b", groupIds: ["g1"] });
      API.setElements([a, b]);

      API.setSelectedElements([a]);
      expect(h.app.actionManager.isActionEnabled(actionLinkToElement)).toBe(
        true,
      );

      // a whole group can be linked via copy, but not via the selector
      API.setSelectedElements([a, b]);
      expect(h.app.actionManager.isActionEnabled(actionLinkToElement)).toBe(
        false,
      );

      API.setSelectedElements([a]);
      API.setAppState({
        openDialog: { name: "elementLinkSelector", sourceElementId: a.id },
      });
      expect(h.app.actionManager.isActionEnabled(actionLinkToElement)).toBe(
        false,
      );
    });

    it("opens the element link selector for the selected element", () => {
      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const result = actionLinkToElement.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      ) as PerformResult;

      expect(result).toMatchObject({
        appState: {
          openDialog: { name: "elementLinkSelector", sourceElementId: "rect" },
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      API.executeAction(actionLinkToElement);
      expect(h.state.openDialog).toEqual({
        name: "elementLinkSelector",
        sourceElementId: "rect",
      });
    });

    it("does nothing when more than one element is selected", () => {
      const a = API.createElement({ id: "a", groupIds: ["g1"] });
      const b = API.createElement({ id: "b", groupIds: ["g1"] });
      API.setElements([a, b]);
      API.setSelectedElements([a, b]);

      const result = actionLinkToElement.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      ) as PerformResult;

      expect(result).toMatchObject({
        appState: h.state,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(result.appState?.openDialog).toBe(null);
    });
  });
});
