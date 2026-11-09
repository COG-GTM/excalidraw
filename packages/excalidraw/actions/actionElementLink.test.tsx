import { act, waitFor } from "@testing-library/react";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { render } from "../tests/test-utils";

import {
  actionCopyElementLink,
  actionLinkToElement,
} from "./actionElementLink";

const { copyTextToSystemClipboard } = vi.hoisted(() => ({
  copyTextToSystemClipboard: vi.fn(),
}));

vi.mock("../clipboard", async (importOriginal) => {
  const module = await importOriginal<typeof import("../clipboard")>();
  return { ...module, copyTextToSystemClipboard };
});

const { h } = window;

const executeAsync = async (
  action: Parameters<typeof API.executeAction>[0],
) => {
  await act(async () => {
    h.app.actionManager.executeAction(action);
  });
};

describe("actionElementLink", () => {
  beforeEach(() => {
    copyTextToSystemClipboard.mockReset();
    copyTextToSystemClipboard.mockResolvedValue(undefined);
  });

  describe("copyElementLink", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("is enabled for a single element or a single group, but not for unrelated elements", () => {
      const r1 = API.createElement({ type: "rectangle", id: "r1" });
      const r2 = API.createElement({ type: "rectangle", id: "r2" });
      const g1 = API.createElement({
        type: "rectangle",
        id: "g1",
        groupIds: ["group"],
      });
      const g2 = API.createElement({
        type: "ellipse",
        id: "g2",
        groupIds: ["group"],
      });
      API.setElements([r1, r2, g1, g2]);

      const isEnabled = () =>
        actionCopyElementLink.predicate!(h.elements, h.state);

      API.setSelectedElements([]);
      expect(isEnabled()).toBe(false);

      API.setSelectedElements([r1]);
      expect(isEnabled()).toBe(true);

      API.setSelectedElements([r1, r2]);
      expect(isEnabled()).toBe(false);

      API.setSelectedElements([g1, g2]);
      expect(isEnabled()).toBe(true);
    });

    it("copies the default element link for a single element and shows a toast", async () => {
      const r1 = API.createElement({ type: "rectangle", id: "r1" });
      API.setElements([r1]);
      API.setSelectedElements([r1]);

      await executeAsync(actionCopyElementLink);

      expect(copyTextToSystemClipboard).toHaveBeenCalledTimes(1);
      const link = new URL(copyTextToSystemClipboard.mock.calls[0][0]);
      expect(link.searchParams.get("element")).toBe("r1");
      await waitFor(() =>
        expect(h.state.toast).toEqual({
          message: "Link copied to clipboard",
          closable: true,
        }),
      );
    });

    it("copies a group link when a whole group is selected", async () => {
      const g1 = API.createElement({
        type: "rectangle",
        id: "g1",
        groupIds: ["group"],
      });
      const g2 = API.createElement({
        type: "ellipse",
        id: "g2",
        groupIds: ["group"],
      });
      API.setElements([g1, g2]);
      API.setSelectedElements([g1, g2]);
      expect(h.state.selectedGroupIds).toEqual({ group: true });

      await executeAsync(actionCopyElementLink);

      const link = new URL(copyTextToSystemClipboard.mock.calls[0][0]);
      expect(link.searchParams.get("element")).toBe("group");
    });

    it("does nothing when the selection cannot be linked", async () => {
      const r1 = API.createElement({ type: "rectangle", id: "r1" });
      const r2 = API.createElement({ type: "rectangle", id: "r2" });
      API.setElements([r1, r2]);
      API.setSelectedElements([r1, r2]);

      await executeAsync(actionCopyElementLink);

      expect(copyTextToSystemClipboard).not.toHaveBeenCalled();
      expect(h.state.toast).toBe(null);
    });

    it("logs clipboard failures without showing a toast", async () => {
      const error = new Error("clipboard denied");
      copyTextToSystemClipboard.mockRejectedValueOnce(error);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const r1 = API.createElement({ type: "rectangle", id: "r1" });
      API.setElements([r1]);
      API.setSelectedElements([r1]);

      await executeAsync(actionCopyElementLink);

      expect(consoleError).toHaveBeenCalledWith(error);
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

      const r1 = API.createElement({ type: "rectangle", id: "r1" });
      API.setElements([r1]);
      API.setSelectedElements([r1]);

      await executeAsync(actionCopyElementLink);

      expect(generateLinkForSelection).toHaveBeenCalledWith("r1", "element");
      expect(copyTextToSystemClipboard).toHaveBeenCalledWith(
        "https://example.com/element/r1",
      );
    });
  });

  describe("linkToElement", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("is enabled only for a single element while the link dialog is closed", () => {
      const r1 = API.createElement({ type: "rectangle", id: "r1" });
      const g1 = API.createElement({
        type: "rectangle",
        id: "g1",
        groupIds: ["group"],
      });
      const g2 = API.createElement({
        type: "ellipse",
        id: "g2",
        groupIds: ["group"],
      });
      API.setElements([r1, g1, g2]);

      const isEnabled = () =>
        actionLinkToElement.predicate!(h.elements, h.state, h.app.props, h.app);

      API.setSelectedElements([r1]);
      expect(isEnabled()).toBe(true);

      // a group can be linked to (copyElementLink), but not linked from
      API.setSelectedElements([g1, g2]);
      expect(isEnabled()).toBe(false);

      API.setSelectedElements([]);
      expect(isEnabled()).toBe(false);

      API.setSelectedElements([r1]);
      API.setAppState({
        openDialog: { name: "elementLinkSelector", sourceElementId: "r1" },
      });
      expect(isEnabled()).toBe(false);
    });

    it("opens the element link selector for the selected element", () => {
      const r1 = API.createElement({ type: "rectangle", id: "r1" });
      API.setElements([r1]);
      API.setSelectedElements([r1]);

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toEqual({
        name: "elementLinkSelector",
        sourceElementId: "r1",
      });
    });

    it("does not open the dialog for a multi-element selection", () => {
      const g1 = API.createElement({
        type: "rectangle",
        id: "g1",
        groupIds: ["group"],
      });
      const g2 = API.createElement({
        type: "ellipse",
        id: "g2",
        groupIds: ["group"],
      });
      API.setElements([g1, g2]);
      API.setSelectedElements([g1, g2]);

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toBe(null);
    });
  });
});
