import { vi } from "vitest";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { copyTextToSystemClipboard } from "../clipboard";
import { t } from "../i18n";
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

const elements = () => h.app.scene.getElementsIncludingDeleted();

const copyMock = vi.mocked(copyTextToSystemClipboard);

const rect = (id: string, groupIds: string[] = []) =>
  API.createElement({
    type: "rectangle",
    id,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    groupIds,
  });

describe("actionElementLink", () => {
  beforeEach(() => {
    copyMock.mockReset();
    copyMock.mockResolvedValue(undefined);
  });

  describe("copyElementLink", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("is enabled for a single element or a single group", () => {
      const a = rect("a");
      const b = rect("b");
      const g1 = rect("g1", ["group"]);
      const g2 = rect("g2", ["group"]);
      API.setElements([a, b, g1, g2]);

      API.setSelectedElements([a]);
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(true);

      API.setSelectedElements([a, b]);
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(false);

      API.setSelectedElements([g1, g2]);
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(true);

      API.setSelectedElements([]);
      expect(actionCopyElementLink.predicate!(h.elements, h.state)).toBe(false);
    });

    it("copies the default element link and shows a toast", async () => {
      const a = rect("a");
      API.setElements([a]);
      API.setSelectedElements([a]);

      const result = await actionCopyElementLink.perform(
        elements(),
        h.state,
        null,
        h.app,
      );

      expect(copyMock).toHaveBeenCalledTimes(1);
      const link = new URL(copyMock.mock.calls[0][0] as string);
      expect(link.searchParams.get("element")).toBe("a");
      expect(result).toEqual({
        appState: {
          toast: { message: t("toast.elementLinkCopied"), closable: true },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("links to the group id when a whole group is selected", async () => {
      const g1 = rect("g1", ["group"]);
      const g2 = rect("g2", ["group"]);
      API.setElements([g1, g2]);
      API.setSelectedElements([g1, g2]);

      await actionCopyElementLink.perform(elements(), h.state, null, h.app);

      const link = new URL(copyMock.mock.calls[0][0] as string);
      expect(link.searchParams.get("element")).toBe("group");
    });

    it("does not copy anything when there is no linkable selection", async () => {
      API.setElements([rect("a"), rect("b")]);
      API.setSelectedElements(
        h.elements.slice() as NonDeletedExcalidrawElement[],
      );

      const result = await actionCopyElementLink.perform(
        elements(),
        h.state,
        null,
        h.app,
      );

      expect(copyMock).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        appState: h.state,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
    });

    it("logs and returns unchanged state when copying fails", async () => {
      const error = new Error("denied");
      copyMock.mockRejectedValueOnce(error);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const a = rect("a");
      API.setElements([a]);
      API.setSelectedElements([a]);

      const result = await actionCopyElementLink.perform(
        elements(),
        h.state,
        null,
        h.app,
      );

      expect(consoleError).toHaveBeenCalledWith(error);
      expect(result).toMatchObject({
        appState: h.state,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(result && result.appState && result.appState.toast).toBeFalsy();
      consoleError.mockRestore();
    });
  });

  it("uses the host generateLinkForSelection prop when provided", async () => {
    const generateLinkForSelection = vi.fn(
      (id: string, type: "element" | "group") => `custom://${type}/${id}`,
    );
    await render(
      <Excalidraw generateLinkForSelection={generateLinkForSelection} />,
    );
    const a = rect("a");
    API.setElements([a]);
    API.setSelectedElements([a]);

    await actionCopyElementLink.perform(elements(), h.state, null, h.app);

    expect(generateLinkForSelection).toHaveBeenCalledWith("a", "element");
    expect(copyMock).toHaveBeenCalledWith("custom://element/a");
  });

  describe("linkToElement", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("is enabled only for one element while the selector is closed", () => {
      const a = rect("a");
      const g1 = rect("g1", ["group"]);
      const g2 = rect("g2", ["group"]);
      API.setElements([a, g1, g2]);

      API.setSelectedElements([a]);
      expect(
        actionLinkToElement.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(true);

      expect(
        actionLinkToElement.predicate!(
          h.elements,
          {
            ...h.state,
            openDialog: { name: "elementLinkSelector", sourceElementId: "a" },
          },
          h.app.props,
          h.app,
        ),
      ).toBe(false);

      API.setSelectedElements([g1, g2]);
      expect(
        actionLinkToElement.predicate!(h.elements, h.state, h.app.props, h.app),
      ).toBe(false);
    });

    it("opens the element link selector for the selected element", () => {
      const a = rect("a");
      API.setElements([a]);
      API.setSelectedElements([a]);

      API.executeAction(actionLinkToElement);

      expect(h.state.openDialog).toEqual({
        name: "elementLinkSelector",
        sourceElementId: "a",
      });
    });

    it("does not open the selector for a multi-element selection", () => {
      const g1 = rect("g1", ["group"]);
      const g2 = rect("g2", ["group"]);
      API.setElements([g1, g2]);
      API.setSelectedElements([g1, g2]);

      const result = actionLinkToElement.perform(
        elements(),
        h.state,
        null,
        h.app,
      );

      expect(result).toMatchObject({
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      });
      expect(
        result && result.appState && result.appState.openDialog,
      ).toBeNull();
    });
  });
});
