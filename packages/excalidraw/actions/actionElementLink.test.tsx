import React from "react";
import { vi } from "vitest";

import { CaptureUpdateAction } from "@excalidraw/element";

import { copyTextToSystemClipboard } from "../clipboard";
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { render } from "../tests/test-utils";

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

describe("actionElementLink", () => {
  beforeEach(() => {
    copyTextMock.mockReset();
    copyTextMock.mockResolvedValue(undefined);
  });

  describe("actionCopyElementLink", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("predicate requires one element or elements in a single group", () => {
      const rect1 = API.createElement({ id: "rect1" });
      const rect2 = API.createElement({ id: "rect2", x: 200 });
      const grouped1 = API.createElement({ id: "g1", groupIds: ["group"] });
      const grouped2 = API.createElement({
        id: "g2",
        x: 400,
        groupIds: ["group"],
      });
      API.setElements([rect1, rect2, grouped1, grouped2]);

      API.setSelectedElements([]);
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(false);

      API.setSelectedElements([rect1]);
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(true);

      API.setSelectedElements([rect1, rect2]);
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(false);

      API.setSelectedElements([grouped1, grouped2]);
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(true);
    });

    it("copies a link to the selected element and shows a toast", async () => {
      const rect = API.createElement({ id: "rect1" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const result = await actionCopyElementLink.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(copyTextMock).toHaveBeenCalledTimes(1);
      const link = new h.app.ownerWindow.URL(
        copyTextMock.mock.calls[0][0] as string,
      );
      expect(link.searchParams.get("element")).toBe("rect1");
      expect(result).toEqual({
        appState: {
          toast: { message: "Link copied to clipboard", closable: true },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("copies a link to the group when a whole group is selected", async () => {
      const grouped1 = API.createElement({ id: "g1", groupIds: ["group"] });
      const grouped2 = API.createElement({
        id: "g2",
        x: 200,
        groupIds: ["group"],
      });
      API.setElements([grouped1, grouped2]);
      API.setSelectedElements([grouped1, grouped2]);
      expect(h.state.selectedGroupIds).toEqual({ group: true });

      await actionCopyElementLink.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      const link = new h.app.ownerWindow.URL(
        copyTextMock.mock.calls[0][0] as string,
      );
      expect(link.searchParams.get("element")).toBe("group");
    });

    it("does not copy anything when the selection cannot be linked", async () => {
      const rect1 = API.createElement({ id: "rect1" });
      const rect2 = API.createElement({ id: "rect2", x: 200 });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);
      const appState = h.state;

      const result = await actionCopyElementLink.perform(
        h.app.scene.getElementsIncludingDeleted(),
        appState,
        null,
        h.app,
      );

      expect(copyTextMock).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("logs and returns the unchanged state when copying fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      copyTextMock.mockRejectedValueOnce(new Error("clipboard denied"));
      const rect = API.createElement({ id: "rect1" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);
      const appState = h.state;

      const result = await actionCopyElementLink.perform(
        h.app.scene.getElementsIncludingDeleted(),
        appState,
        null,
        h.app,
      );

      expect(consoleError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "clipboard denied" }),
      );
      expect(result).toMatchObject({
        appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect((result as any).appState.toast).toBeFalsy();
      consoleError.mockRestore();
    });
  });

  describe("actionCopyElementLink with generateLinkForSelection", () => {
    it("uses the host-provided link generator", async () => {
      const generateLinkForSelection = vi.fn(
        (id: string, type: "element" | "group") =>
          `https://example.com/${type}/${id}`,
      );
      await render(
        <Excalidraw generateLinkForSelection={generateLinkForSelection} />,
      );
      const rect = API.createElement({ id: "rect1" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      await actionCopyElementLink.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(generateLinkForSelection).toHaveBeenCalledWith("rect1", "element");
      expect(copyTextMock).toHaveBeenCalledWith(
        "https://example.com/element/rect1",
      );
    });
  });

  describe("actionLinkToElement", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("predicate requires exactly one linkable element and no open selector", () => {
      const rect1 = API.createElement({ id: "rect1" });
      const grouped1 = API.createElement({ id: "g1", groupIds: ["group"] });
      const grouped2 = API.createElement({
        id: "g2",
        x: 200,
        groupIds: ["group"],
      });
      API.setElements([rect1, grouped1, grouped2]);

      API.setSelectedElements([]);
      expect(
        actionLinkToElement.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(false);

      API.setSelectedElements([rect1]);
      expect(
        actionLinkToElement.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(true);

      API.setSelectedElements([grouped1, grouped2]);
      expect(
        actionLinkToElement.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(false);

      API.setSelectedElements([rect1]);
      API.setAppState({
        openDialog: { name: "elementLinkSelector", sourceElementId: "rect1" },
      });
      expect(
        actionLinkToElement.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(false);
    });

    it("opens the element link selector for the selected element", () => {
      const rect = API.createElement({ id: "rect1" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toEqual({
        name: "elementLinkSelector",
        sourceElementId: "rect1",
      });
    });

    it("does not open the selector for multiple selected elements", () => {
      const grouped1 = API.createElement({ id: "g1", groupIds: ["group"] });
      const grouped2 = API.createElement({
        id: "g2",
        x: 200,
        groupIds: ["group"],
      });
      API.setElements([grouped1, grouped2]);
      API.setSelectedElements([grouped1, grouped2]);

      const result = actionLinkToElement.perform(
        h.app.scene.getElementsIncludingDeleted(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        appState: { openDialog: null },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });
  });
});
