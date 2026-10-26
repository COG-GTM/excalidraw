import { act } from "@testing-library/react";
import { vi } from "vitest";

import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { render, waitFor } from "../tests/test-utils";

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

const linkFor = (id: string) => {
  const url = new URL(h.app.ownerWindow.location.href);
  url.searchParams.set("element", id);
  return url.toString();
};

describe("actionElementLink", () => {
  beforeEach(() => {
    copyTextToSystemClipboard.mockReset();
    copyTextToSystemClipboard.mockResolvedValue(undefined);
  });

  describe("actionCopyElementLink", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("is enabled for a single element or a single group", () => {
      const rect1 = API.createElement({ id: "r1" });
      const rect2 = API.createElement({ id: "r2", x: 200 });
      const g1 = API.createElement({ id: "g1a", groupIds: ["g1"] });
      const g2 = API.createElement({ id: "g1b", x: 200, groupIds: ["g1"] });
      API.setElements([rect1, rect2, g1, g2]);

      API.setSelectedElements([rect1]);
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(true);

      API.setSelectedElements([rect1, rect2]);
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(false);

      API.setSelectedElements([g1, g2]);
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(true);

      API.clearSelection();
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(false);
    });

    it("copies a link to the selected element and shows a toast", async () => {
      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      API.executeAction(actionCopyElementLink);

      await waitFor(() =>
        expect(h.state.toast?.message).toBe("Link copied to clipboard"),
      );
      expect(h.state.toast?.closable).toBe(true);
      expect(copyTextToSystemClipboard).toHaveBeenCalledTimes(1);
      expect(copyTextToSystemClipboard).toHaveBeenCalledWith(linkFor("rect"));
    });

    it("links to the group id when a whole group is selected", async () => {
      const g1 = API.createElement({ id: "a", groupIds: ["group1"] });
      const g2 = API.createElement({ id: "b", x: 200, groupIds: ["group1"] });
      API.setElements([g1, g2]);
      API.setSelectedElements([g1, g2]);
      expect(h.state.selectedGroupIds).toEqual({ group1: true });

      API.executeAction(actionCopyElementLink);

      await waitFor(() =>
        expect(copyTextToSystemClipboard).toHaveBeenCalledWith(
          linkFor("group1"),
        ),
      );
    });

    it("does not copy anything when the selection can't be linked", async () => {
      const rect1 = API.createElement({ id: "r1" });
      const rect2 = API.createElement({ id: "r2", x: 200 });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      const result = await actionCopyElementLink.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(copyTextToSystemClipboard).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        appState: h.state,
        elements: h.elements,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("logs and keeps state unchanged when copying fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const error = new Error("clipboard denied");
      copyTextToSystemClipboard.mockRejectedValueOnce(error);

      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const result = await actionCopyElementLink.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(consoleError).toHaveBeenCalledWith(error);
      expect(result).toMatchObject({
        appState: h.state,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(result && result.appState?.toast).toBeFalsy();
      consoleError.mockRestore();
    });
  });

  it("uses the host's generateLinkForSelection when provided", async () => {
    const generateLinkForSelection = vi.fn(
      (id: string, type: "element" | "group") => `custom://${type}/${id}`,
    );
    await render(
      <Excalidraw generateLinkForSelection={generateLinkForSelection} />,
    );
    const rect = API.createElement({ id: "rect" });
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    API.executeAction(actionCopyElementLink);

    await waitFor(() =>
      expect(copyTextToSystemClipboard).toHaveBeenCalledWith(
        "custom://element/rect",
      ),
    );
    expect(generateLinkForSelection).toHaveBeenCalledWith("rect", "element");
  });

  describe("actionLinkToElement", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("is enabled only for a single element while the selector is closed", () => {
      const rect1 = API.createElement({ id: "r1" });
      const rect2 = API.createElement({ id: "r2", x: 200 });
      API.setElements([rect1, rect2]);

      API.setSelectedElements([rect1]);
      expect(
        actionLinkToElement.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(true);

      API.setSelectedElements([rect1, rect2]);
      expect(
        actionLinkToElement.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(false);

      API.setSelectedElements([rect1]);
      API.setAppState({
        openDialog: { name: "elementLinkSelector", sourceElementId: "r1" },
      });
      expect(
        actionLinkToElement.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(false);
    });

    it("opens the element link selector for the selected element", () => {
      const rect = API.createElement({ id: "rect" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      act(() => {
        h.app.actionManager.executeAction(actionLinkToElement);
      });

      expect(h.state.openDialog).toEqual({
        name: "elementLinkSelector",
        sourceElementId: "rect",
      });
    });

    it("does nothing when more than one ungrouped element is selected", () => {
      const rect1 = API.createElement({ id: "r1" });
      const rect2 = API.createElement({ id: "r2", x: 200 });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      const result = actionLinkToElement.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        appState: h.state,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(h.state.openDialog).toBe(null);
    });

    it("does nothing for a whole group (needs exactly one element)", () => {
      const g1 = API.createElement({ id: "a", groupIds: ["group1"] });
      const g2 = API.createElement({ id: "b", x: 200, groupIds: ["group1"] });
      API.setElements([g1, g2]);
      API.setSelectedElements([g1, g2]);

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toBe(null);
    });
  });
});
