import { vi } from "vitest";

import { copyTextToSystemClipboard } from "../clipboard";
import { t } from "../i18n";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { act, render, waitFor } from "../tests/test-utils";

import {
  actionCopyElementLink,
  actionLinkToElement,
} from "./actionElementLink";

vi.mock("../clipboard", async (importOriginal) => {
  const module = await importOriginal<typeof import("../clipboard")>();
  return {
    ...module,
    copyTextToSystemClipboard: vi.fn(),
  };
});

const { h } = window;

const copyTextMock = vi.mocked(copyTextToSystemClipboard);

const isEnabled = (action: Parameters<typeof API.executeAction>[0]) =>
  h.app.actionManager.isActionEnabled(action);

describe("actionElementLink", () => {
  beforeEach(() => {
    copyTextMock.mockReset();
    copyTextMock.mockResolvedValue(undefined);
  });

  describe("copyElementLink", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("is enabled for one element or a single group", () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      const grouped1 = API.createElement({
        type: "rectangle",
        id: "g1",
        groupIds: ["group"],
      });
      const grouped2 = API.createElement({
        type: "ellipse",
        id: "g2",
        groupIds: ["group"],
      });
      API.setElements([rect, grouped1, grouped2]);

      API.setSelectedElements([]);
      expect(isEnabled(actionCopyElementLink)).toBe(false);

      API.setSelectedElements([rect]);
      expect(isEnabled(actionCopyElementLink)).toBe(true);

      API.setSelectedElements([grouped1, grouped2]);
      expect(isEnabled(actionCopyElementLink)).toBe(true);

      API.setSelectedElements([rect, grouped1]);
      expect(isEnabled(actionCopyElementLink)).toBe(false);
    });

    it("copies a link to the selected element and shows a toast", async () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      API.executeAction(actionCopyElementLink);

      await waitFor(() => {
        expect(h.state.toast).toEqual({
          message: t("toast.elementLinkCopied"),
          closable: true,
        });
      });
      expect(copyTextMock).toHaveBeenCalledTimes(1);
      const link = new URL(copyTextMock.mock.calls[0][0] as string);
      expect(link.searchParams.get("element")).toBe(rect.id);
    });

    it("copies a link to the selected group", async () => {
      const grouped1 = API.createElement({
        type: "rectangle",
        id: "g1",
        groupIds: ["group"],
      });
      const grouped2 = API.createElement({
        type: "ellipse",
        id: "g2",
        groupIds: ["group"],
      });
      API.setElements([grouped1, grouped2]);
      API.setSelectedElements([grouped1, grouped2]);
      expect(h.state.selectedGroupIds).toEqual({ group: true });

      API.executeAction(actionCopyElementLink);

      await waitFor(() => expect(copyTextMock).toHaveBeenCalledTimes(1));
      const link = new URL(copyTextMock.mock.calls[0][0] as string);
      expect(link.searchParams.get("element")).toBe("group");
    });

    it("does not copy anything when nothing linkable is selected", async () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      const ellipse = API.createElement({ type: "ellipse", id: "ellipse" });
      API.setElements([rect, ellipse]);
      API.setSelectedElements([rect, ellipse]);

      API.executeAction(actionCopyElementLink);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(copyTextMock).not.toHaveBeenCalled();
      expect(h.state.toast).toBe(null);
    });

    it("logs and keeps state when copying to the clipboard fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const error = new Error("clipboard denied");
      copyTextMock.mockRejectedValueOnce(error);

      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      API.executeAction(actionCopyElementLink);

      await waitFor(() => expect(consoleError).toHaveBeenCalledWith(error));
      expect(h.state.toast).toBe(null);
      expect(h.state.selectedElementIds).toEqual({ [rect.id]: true });
      consoleError.mockRestore();
    });
  });

  describe("copyElementLink with generateLinkForSelection", () => {
    it("uses the host-provided link generator", async () => {
      const generateLinkForSelection = vi.fn(
        (id: string, type: "element" | "group") =>
          `https://example.com/${type}/${id}`,
      );
      await render(
        <Excalidraw
          handleKeyboardGlobally={true}
          generateLinkForSelection={generateLinkForSelection}
        />,
      );
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      API.executeAction(actionCopyElementLink);

      await waitFor(() =>
        expect(copyTextMock).toHaveBeenCalledWith(
          "https://example.com/element/rect",
        ),
      );
      expect(generateLinkForSelection).toHaveBeenCalledWith("rect", "element");
    });
  });

  describe("linkToElement", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("is enabled only for exactly one selected element", () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      const grouped1 = API.createElement({
        type: "rectangle",
        id: "g1",
        groupIds: ["group"],
      });
      const grouped2 = API.createElement({
        type: "ellipse",
        id: "g2",
        groupIds: ["group"],
      });
      API.setElements([rect, grouped1, grouped2]);

      API.setSelectedElements([]);
      expect(isEnabled(actionLinkToElement)).toBe(false);

      API.setSelectedElements([grouped1, grouped2]);
      expect(isEnabled(actionLinkToElement)).toBe(false);

      API.setSelectedElements([rect]);
      expect(isEnabled(actionLinkToElement)).toBe(true);
    });

    it("is disabled while the element link selector is already open", () => {
      const rect = API.createElement({ type: "rectangle", id: "rect" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toEqual({
        name: "elementLinkSelector",
        sourceElementId: rect.id,
      });
      expect(isEnabled(actionLinkToElement)).toBe(false);
    });

    it("does not open the dialog for a multi-element selection", () => {
      const grouped1 = API.createElement({
        type: "rectangle",
        id: "g1",
        groupIds: ["group"],
      });
      const grouped2 = API.createElement({
        type: "ellipse",
        id: "g2",
        groupIds: ["group"],
      });
      API.setElements([grouped1, grouped2]);
      API.setSelectedElements([grouped1, grouped2]);

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toBe(null);
    });

    it("does not open the dialog without a selection", () => {
      API.setElements([API.createElement({ type: "rectangle" })]);
      API.setSelectedElements([]);

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toBe(null);
    });
  });
});
