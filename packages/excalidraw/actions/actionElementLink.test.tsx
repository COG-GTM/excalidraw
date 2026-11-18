import { CaptureUpdateAction } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { act, render, waitFor } from "../tests/test-utils";

import {
  actionCopyElementLink,
  actionLinkToElement,
} from "./actionElementLink";

import type { Action } from "./types";

const { h } = window;

const isEnabled = (action: Action) =>
  action.predicate!(h.elements, h.state, h.app.props, h.app);

const setupScene = () => {
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
  API.updateScene({
    elements: [rect, grouped1, grouped2],
    captureUpdate: CaptureUpdateAction.NEVER,
  });
  return { rect, grouped1, grouped2 };
};

describe("element link actions", () => {
  let copiedText: string[];
  const originalExecCommand = document.execCommand;

  beforeEach(() => {
    copiedText = [];
    // jsdom has no navigator.clipboard, so copying falls back to execCommand
    document.execCommand = vi.fn(() => {
      copiedText.push(
        document.body.querySelector<HTMLTextAreaElement>("textarea[readonly]")
          ?.value ?? "",
      );
      return true;
    });
  });

  afterEach(() => {
    document.execCommand = originalExecCommand;
  });

  describe("actionCopyElementLink", () => {
    it("is enabled for a single element or a single group", async () => {
      await render(<Excalidraw />);
      const { rect, grouped1, grouped2 } = setupScene();

      expect(isEnabled(actionCopyElementLink)).toBe(false);

      API.setSelectedElements([rect]);
      expect(isEnabled(actionCopyElementLink)).toBe(true);

      API.setSelectedElements([grouped1, grouped2]);
      expect(isEnabled(actionCopyElementLink)).toBe(true);

      API.setSelectedElements([rect, grouped1]);
      expect(isEnabled(actionCopyElementLink)).toBe(false);
    });

    it("copies the default element link and shows a toast", async () => {
      await render(<Excalidraw />);
      const { rect } = setupScene();
      API.setSelectedElements([rect]);

      API.executeAction(actionCopyElementLink);

      await waitFor(() => expect(h.state.toast).not.toBeNull());
      expect(h.state.toast).toMatchObject({ closable: true });
      expect(copiedText).toHaveLength(1);
      expect(new URL(copiedText[0]).searchParams.get("element")).toBe("rect");
    });

    it("uses generateLinkForSelection for groups when provided", async () => {
      const generateLinkForSelection = vi.fn(
        (id: string, type: "element" | "group") =>
          `https://example.com/#${type}=${id}`,
      );
      await render(
        <Excalidraw generateLinkForSelection={generateLinkForSelection} />,
      );
      const { grouped1, grouped2 } = setupScene();
      API.setSelectedElements([grouped1, grouped2]);

      API.executeAction(actionCopyElementLink);

      await waitFor(() => expect(h.state.toast).not.toBeNull());
      expect(generateLinkForSelection).toHaveBeenCalledWith("group", "group");
      expect(copiedText).toEqual(["https://example.com/#group=group"]);
    });

    it("does not copy anything without a linkable selection", async () => {
      await render(<Excalidraw />);
      const { rect, grouped1 } = setupScene();
      API.setSelectedElements([rect, grouped1]);

      API.executeAction(actionCopyElementLink);
      await act(() => Promise.resolve());

      expect(copiedText).toEqual([]);
      expect(h.state.toast).toBeNull();
    });

    it("logs and keeps state when copying fails", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      document.execCommand = vi.fn(() => false);
      await render(<Excalidraw />);
      const { rect } = setupScene();
      API.setSelectedElements([rect]);

      API.executeAction(actionCopyElementLink);

      await waitFor(() => expect(errorSpy).toHaveBeenCalled());
      expect(h.state.toast).toBeNull();
      errorSpy.mockRestore();
    });
  });

  describe("actionLinkToElement", () => {
    it("is enabled for exactly one element when the dialog is closed", async () => {
      await render(<Excalidraw />);
      const { rect, grouped1, grouped2 } = setupScene();

      API.setSelectedElements([rect]);
      expect(isEnabled(actionLinkToElement)).toBe(true);

      API.setSelectedElements([grouped1, grouped2]);
      expect(isEnabled(actionLinkToElement)).toBe(false);

      API.setSelectedElements([rect]);
      act(() => {
        API.setAppState({
          openDialog: { name: "elementLinkSelector", sourceElementId: "rect" },
        });
      });
      expect(isEnabled(actionLinkToElement)).toBe(false);
    });

    it("opens the element link selector for the selected element", async () => {
      await render(<Excalidraw />);
      const { rect } = setupScene();
      API.setSelectedElements([rect]);

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toEqual({
        name: "elementLinkSelector",
        sourceElementId: "rect",
      });
    });

    it("does nothing for multi-element selections", async () => {
      await render(<Excalidraw />);
      const { grouped1, grouped2 } = setupScene();
      API.setSelectedElements([grouped1, grouped2]);

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toBeNull();
    });
  });
});
