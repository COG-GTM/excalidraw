import { vi } from "vitest";

import { CaptureUpdateAction } from "@excalidraw/element";
import { defaultGetElementLinkFromSelection } from "@excalidraw/element";

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

const copyTextMock = vi.mocked(copyTextToSystemClipboard);

const { h } = window;

const getElements = () => h.app.scene.getElementsIncludingDeleted();

const createScene = () => {
  const rect = API.createElement({
    type: "rectangle",
    id: "rect",
    x: 0,
    y: 0,
  });
  const grouped1 = API.createElement({
    type: "rectangle",
    id: "grouped1",
    x: 200,
    y: 0,
    groupIds: ["g1"],
  });
  const grouped2 = API.createElement({
    type: "ellipse",
    id: "grouped2",
    x: 300,
    y: 0,
    groupIds: ["g1"],
  });
  API.updateScene({
    elements: [rect, grouped1, grouped2],
    captureUpdate: CaptureUpdateAction.NEVER,
  });
  return { rect, grouped1, grouped2 };
};

describe("actionElementLink", () => {
  beforeEach(() => {
    copyTextMock.mockReset();
    copyTextMock.mockResolvedValue(undefined);
  });

  describe("copyElementLink", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("is enabled for a single element or a single group", () => {
      const { rect, grouped1, grouped2 } = createScene();

      API.setSelectedElements([rect]);
      expect(actionCopyElementLink.predicate!(getElements(), h.state)).toBe(
        true,
      );

      API.setSelectedElements([grouped1, grouped2]);
      expect(actionCopyElementLink.predicate!(getElements(), h.state)).toBe(
        true,
      );

      API.setSelectedElements([rect, grouped1]);
      expect(actionCopyElementLink.predicate!(getElements(), h.state)).toBe(
        false,
      );

      API.setSelectedElements([]);
      expect(actionCopyElementLink.predicate!(getElements(), h.state)).toBe(
        false,
      );
    });

    it("copies the default element link and shows a toast", async () => {
      const { rect } = createScene();
      API.setSelectedElements([rect]);

      API.executeAction(actionCopyElementLink);

      await waitFor(() =>
        expect(h.state.toast?.message).toBe(t("toast.elementLinkCopied")),
      );
      expect(copyTextMock).toHaveBeenCalledTimes(1);
      const link = copyTextMock.mock.calls[0][0] as string;
      expect(link).toBe(defaultGetElementLinkFromSelection(rect.id, "element"));
      expect(new URL(link).searchParams.get("element")).toBe(rect.id);
      expect(h.state.toast?.closable).toBe(true);
    });

    it("copies a group link when a whole group is selected", async () => {
      const { grouped1, grouped2 } = createScene();
      API.setSelectedElements([grouped1, grouped2]);
      act(() => {
        h.setState({ selectedGroupIds: { g1: true } });
      });

      const result = await actionCopyElementLink.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(copyTextMock).toHaveBeenCalledWith(
        defaultGetElementLinkFromSelection("g1", "group"),
      );
      expect(result).toMatchObject({
        appState: { toast: { message: t("toast.elementLinkCopied") } },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("does not copy anything when no link can be created", async () => {
      const { rect, grouped1 } = createScene();
      API.setSelectedElements([rect, grouped1]);

      const result = await actionCopyElementLink.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(copyTextMock).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        appState: h.state,
        elements: h.elements,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect((result as any).appState.toast).toBe(null);
    });

    it("logs and swallows clipboard errors", async () => {
      const { rect } = createScene();
      API.setSelectedElements([rect]);
      const error = new Error("clipboard denied");
      copyTextMock.mockRejectedValueOnce(error);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await actionCopyElementLink.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(consoleError).toHaveBeenCalledWith(error);
      expect(result).toMatchObject({
        appState: h.state,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect((result as any).appState.toast).toBe(null);
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
      const { rect } = createScene();
      API.setSelectedElements([rect]);

      await actionCopyElementLink.perform(getElements(), h.state, null, h.app);

      expect(generateLinkForSelection).toHaveBeenCalledWith(rect.id, "element");
      expect(copyTextMock).toHaveBeenCalledWith(
        `https://example.com/element/${rect.id}`,
      );
    });
  });

  describe("linkToElement", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("is enabled only for a single element when the selector is closed", () => {
      const { rect, grouped1, grouped2 } = createScene();

      API.setSelectedElements([rect]);
      expect(
        actionLinkToElement.predicate!(
          getElements(),
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(true);

      API.setSelectedElements([grouped1, grouped2]);
      expect(
        actionLinkToElement.predicate!(
          getElements(),
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);

      API.setSelectedElements([rect]);
      act(() => {
        h.setState({
          openDialog: { name: "elementLinkSelector", sourceElementId: rect.id },
        });
      });
      expect(
        actionLinkToElement.predicate!(
          getElements(),
          h.state,
          h.app.props,
          h.app,
        ),
      ).toBe(false);
    });

    it("opens the element link selector for the selected element", () => {
      const { rect } = createScene();
      API.setSelectedElements([rect]);

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toEqual({
        name: "elementLinkSelector",
        sourceElementId: rect.id,
      });
    });

    it("does nothing when more than one element is selected", () => {
      const { grouped1, grouped2 } = createScene();
      API.setSelectedElements([grouped1, grouped2]);

      const result = actionLinkToElement.perform(
        getElements(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        appState: h.state,
        elements: h.elements,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(h.state.openDialog).toBe(null);
    });

    it("does nothing when nothing is selected", () => {
      createScene();
      API.setSelectedElements([]);

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toBe(null);
    });
  });
});
