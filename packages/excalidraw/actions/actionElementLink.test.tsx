import React from "react";
import { vi } from "vitest";

import { copyTextToSystemClipboard } from "../clipboard";
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

const copyTextMock = vi.mocked(copyTextToSystemClipboard);

const { h } = window;

const createElements = () => {
  const rect = API.createElement({ type: "rectangle", id: "rect" });
  const grouped1 = API.createElement({
    type: "ellipse",
    id: "grouped1",
    groupIds: ["g1"],
  });
  const grouped2 = API.createElement({
    type: "diamond",
    id: "grouped2",
    groupIds: ["g1"],
  });
  return { rect, grouped1, grouped2 };
};

const executeAsync = async (
  action: typeof actionCopyElementLink | typeof actionLinkToElement,
) => {
  await act(async () => {
    h.app.actionManager.executeAction(action);
  });
};

describe("actionElementLink", () => {
  beforeEach(() => {
    copyTextMock.mockReset();
    copyTextMock.mockResolvedValue(undefined);
  });

  describe("copyElementLink", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("predicate allows a single element or a single group", () => {
      const { rect, grouped1, grouped2 } = createElements();
      API.setElements([rect, grouped1, grouped2]);

      API.setSelectedElements([rect]);
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(true);

      API.setSelectedElements([grouped1, grouped2]);
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(true);

      API.setSelectedElements([rect, grouped1]);
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(false);

      API.clearSelection();
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(false);
    });

    it("copies an element link for a single selected element", async () => {
      const { rect } = createElements();
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      await executeAsync(actionCopyElementLink);

      expect(copyTextMock).toHaveBeenCalledTimes(1);
      const link = new URL(copyTextMock.mock.calls[0][0] as string);
      expect(link.searchParams.get("element")).toBe(rect.id);
      await waitFor(() =>
        expect(h.state.toast).toEqual({
          message: "Link copied to clipboard",
          closable: true,
        }),
      );
    });

    it("copies a group link when a whole group is selected", async () => {
      const { grouped1, grouped2 } = createElements();
      API.setElements([grouped1, grouped2]);
      API.setSelectedElements([grouped1, grouped2]);

      await executeAsync(actionCopyElementLink);

      expect(copyTextMock).toHaveBeenCalledTimes(1);
      const link = new URL(copyTextMock.mock.calls[0][0] as string);
      expect(link.searchParams.get("element")).toBe("g1");
    });

    it("does nothing when the selection cannot be linked", async () => {
      const { rect, grouped1 } = createElements();
      API.setElements([rect, grouped1]);
      API.setSelectedElements([rect, grouped1]);

      await executeAsync(actionCopyElementLink);

      expect(copyTextMock).not.toHaveBeenCalled();
      expect(h.state.toast).toBe(null);
    });

    it("logs and shows no toast when copying fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      copyTextMock.mockRejectedValueOnce(new Error("denied"));
      const { rect } = createElements();
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      await executeAsync(actionCopyElementLink);

      expect(copyTextMock).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "denied" }),
      );
      expect(h.state.toast).toBe(null);
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
        <Excalidraw generateLinkForSelection={generateLinkForSelection} />,
      );
      const { rect } = createElements();
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      await executeAsync(actionCopyElementLink);

      expect(generateLinkForSelection).toHaveBeenCalledWith(rect.id, "element");
      expect(copyTextMock).toHaveBeenCalledWith(
        `https://example.com/element/${rect.id}`,
      );
    });
  });

  describe("linkToElement", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("predicate requires exactly one element and no open link dialog", () => {
      const { rect, grouped1, grouped2 } = createElements();
      API.setElements([rect, grouped1, grouped2]);

      API.setSelectedElements([rect]);
      expect(
        actionLinkToElement.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(true);

      API.setSelectedElements([grouped1, grouped2]);
      expect(
        actionLinkToElement.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(false);

      API.setSelectedElements([rect]);
      API.setAppState({
        openDialog: { name: "elementLinkSelector", sourceElementId: rect.id },
      });
      expect(
        actionLinkToElement.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(false);
    });

    it("opens the element link selector for the selected element", () => {
      const { rect } = createElements();
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toEqual({
        name: "elementLinkSelector",
        sourceElementId: rect.id,
      });
    });

    it("does not open the dialog for multiple selected elements", () => {
      const { grouped1, grouped2 } = createElements();
      API.setElements([grouped1, grouped2]);
      API.setSelectedElements([grouped1, grouped2]);

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toBe(null);
    });

    it("does not open the dialog with nothing selected", () => {
      const { rect } = createElements();
      API.setElements([rect]);
      API.clearSelection();

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toBe(null);
    });
  });
});
