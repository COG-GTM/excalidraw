import React from "react";
import { vi } from "vitest";

import { KEYS } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { t } from "../i18n";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { fireEvent, GlobalTestState, render } from "./test-utils";

import type { ExcalidrawProps } from "../types";

const { h } = window;

const queryPopup = () =>
  GlobalTestState.renderResult.container.querySelector<HTMLElement>(
    ".excalidraw-hyperlinkContainer",
  );

const queryInput = () =>
  GlobalTestState.renderResult.container.querySelector<HTMLInputElement>(
    ".excalidraw-hyperlinkContainer-input",
  );

const queryLink = () =>
  GlobalTestState.renderResult.container.querySelector<HTMLAnchorElement>(
    "a.excalidraw-hyperlinkContainer-link",
  );

const getEmbedValidationStatus = (element: ExcalidrawElement) =>
  (
    h.app as unknown as {
      embedsValidationStatus: Map<ExcalidrawElement["id"], boolean>;
    }
  ).embedsValidationStatus.get(element.id);

const createElementWithLink = (
  opts: Parameters<typeof API.createElement>[0],
  link: string,
) => {
  const element = API.createElement(opts);
  API.setElements([element]);
  API.updateElement(element, { link });
  return API.getElement(element);
};

const selectAndOpenLinkEditor = (element: NonDeletedExcalidrawElement) => {
  API.setSelectedElements([element]);
  Keyboard.withModifierKeys({ ctrl: true }, () => {
    Keyboard.keyPress(KEYS.K);
  });
  const input = queryInput();
  expect(input).not.toBeNull();
  return input!;
};

const submitLink = (input: HTMLInputElement, value: string) => {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: KEYS.ENTER });
};

describe("hyperlink popup", () => {
  describe("regular elements", () => {
    beforeEach(async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
    });

    it("sets the link via Ctrl+K and shows it in info mode", () => {
      const rect = API.createElement({ type: "rectangle", width: 100 });
      API.setElements([rect]);

      const input = selectAndOpenLinkEditor(rect);
      expect(h.state.showHyperlinkPopup).toBe("editor");

      submitLink(input, "  https://example.com  ");

      expect(API.getElement(rect).link).toBe("https://example.com");
      expect(h.state.showHyperlinkPopup).toBe("info");
      expect(queryInput()).toBeNull();
      const anchor = queryLink();
      expect(anchor).not.toBeNull();
      expect(anchor!.textContent).toBe("https://example.com");
      expect(anchor!.getAttribute("href")).toBe("https://example.com");
      expect(anchor!.getAttribute("target")).toBe("_blank");
    });

    it("submits on Escape and clears the link when the input is emptied", () => {
      const rect = createElementWithLink(
        { type: "rectangle" },
        "https://example.com",
      );

      const input = selectAndOpenLinkEditor(rect);
      expect(input.value).toBe("https://example.com");

      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.keyDown(input, { key: KEYS.ESCAPE });

      expect(API.getElement(rect).link).toBe(null);
      expect(h.state.showHyperlinkPopup).toBe("info");
      expect(queryPopup()!.textContent).toContain(t("labels.link.empty"));
    });

    it("sanitizes javascript: links on submit", () => {
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([rect]);

      const input = selectAndOpenLinkEditor(rect);
      // eslint-disable-next-line no-script-url
      submitLink(input, "javascript:alert(1)");

      expect(API.getElement(rect).link).toBe("about:blank");
    });

    it("removes the link and hides the popup via the remove button", () => {
      const rect = createElementWithLink(
        { type: "rectangle" },
        "https://example.com",
      );
      API.setSelectedElements([rect]);
      API.setAppState({ showHyperlinkPopup: "info" });

      const removeButton = queryPopup()!.querySelector<HTMLButtonElement>(
        ".excalidraw-hyperlinkContainer--remove",
      );
      expect(removeButton).not.toBeNull();
      fireEvent.click(removeButton!);

      expect(API.getElement(rect).link).toBe(null);
      expect(h.state.showHyperlinkPopup).toBe(false);
      expect(queryPopup()).toBeNull();
    });

    it("switches from info to editor mode via the edit button", () => {
      const rect = createElementWithLink(
        { type: "rectangle" },
        "https://example.com",
      );
      API.setSelectedElements([rect]);
      API.setAppState({ showHyperlinkPopup: "info" });

      fireEvent.click(
        queryPopup()!.querySelector(".excalidraw-hyperlinkContainer--edit")!,
      );

      expect(h.state.showHyperlinkPopup).toBe("editor");
      expect(queryInput()!.value).toBe("https://example.com");
    });

    it("prevents the Ctrl+K shortcut while editing", () => {
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([rect]);
      const input = selectAndOpenLinkEditor(rect);

      const notCancelled = fireEvent.keyDown(input, {
        key: KEYS.K,
        ctrlKey: true,
      });

      expect(notCancelled).toBe(false);
      expect(h.state.showHyperlinkPopup).toBe("editor");
    });

    it.each([
      ["contextMenu", { contextMenu: { items: [], top: 0, left: 0 } }],
      [
        "selectedElementsAreBeingDragged",
        { selectedElementsAreBeingDragged: true },
      ],
      ["isRotating", { isRotating: true }],
      ["openMenu", { openMenu: "canvas" }],
      ["viewModeEnabled", { viewModeEnabled: true }],
    ] as const)("hides the popup when %s is set", (_, appState) => {
      const rect = createElementWithLink(
        { type: "rectangle" },
        "https://example.com",
      );
      API.setSelectedElements([rect]);
      API.setAppState({ showHyperlinkPopup: "info" });
      expect(queryPopup()).not.toBeNull();

      API.setAppState(appState as any);

      expect(queryPopup()).toBeNull();
    });
  });

  describe("onLinkOpen", () => {
    const setupLinkedRect = async (
      onLinkOpen: ExcalidrawProps["onLinkOpen"],
    ) => {
      await render(<Excalidraw onLinkOpen={onLinkOpen} />);
      const rect = createElementWithLink(
        { type: "rectangle" },
        "https://example.com",
      );
      API.setSelectedElements([rect]);
      API.setAppState({ showHyperlinkPopup: "info" });
      return rect;
    };

    it("prevents anchor navigation when the host calls preventDefault", async () => {
      const onLinkOpen = vi.fn<NonNullable<ExcalidrawProps["onLinkOpen"]>>(
        (_element, event) => {
          event.preventDefault();
        },
      );
      const rect = await setupLinkedRect(onLinkOpen);

      const notCancelled = fireEvent.click(queryLink()!);

      expect(notCancelled).toBe(false);
      expect(onLinkOpen).toHaveBeenCalledTimes(1);
      const [element, event] = onLinkOpen.mock.calls[0];
      expect(element.id).toBe(rect.id);
      expect(element.link).toBe("https://example.com");
      expect(event.type).toBe("excalidraw-link");
    });

    it("does not prevent anchor navigation when the host doesn't", async () => {
      const onLinkOpen = vi.fn();
      await setupLinkedRect(onLinkOpen);

      const notCancelled = fireEvent.click(queryLink()!);

      expect(notCancelled).toBe(true);
      expect(onLinkOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe("embeddables", () => {
    it("marks the embed invalid and shows a toast when validation fails", async () => {
      await render(
        <Excalidraw handleKeyboardGlobally={true} validateEmbeddable={false} />,
      );
      const embeddable = API.createElement({
        type: "embeddable",
        width: 400,
        height: 300,
      });
      API.setElements([embeddable]);

      const input = selectAndOpenLinkEditor(embeddable);
      submitLink(input, "https://example.com/page");

      const updated = API.getElement(embeddable);
      expect(updated.link).toBe("https://example.com/page");
      expect(updated.width).toBe(400);
      expect(updated.height).toBe(300);
      expect(getEmbedValidationStatus(embeddable)).toBe(false);
      expect(h.state.toast?.message).toBe(t("toast.unableToEmbed"));
    });

    it("clears the link and marks the embed invalid when the input is emptied", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const embeddable = createElementWithLink(
        { type: "embeddable" },
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      );

      const input = selectAndOpenLinkEditor(embeddable);
      submitLink(input, "");

      expect(API.getElement(embeddable).link).toBe(null);
      expect(getEmbedValidationStatus(embeddable)).toBe(false);
      expect(h.state.toast).toBe(null);
    });

    it("does not render the remove button for embeddables", async () => {
      await render(<Excalidraw />);
      const embeddable = createElementWithLink(
        { type: "embeddable" },
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      );
      API.setSelectedElements([embeddable]);
      API.setAppState({ showHyperlinkPopup: "info" });

      expect(queryPopup()).not.toBeNull();
      expect(
        queryPopup()!.querySelector(".excalidraw-hyperlinkContainer--remove"),
      ).toBeNull();
    });

    it("resizes a tall embed to the 16:9 video aspect ratio", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const embeddable = API.createElement({
        type: "embeddable",
        width: 300,
        height: 450,
      });
      API.setElements([embeddable]);

      const input = selectAndOpenLinkEditor(embeddable);
      submitLink(input, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");

      const updated = API.getElement(embeddable);
      expect(updated.link).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(updated.height).toBe(450);
      expect(updated.width).toBeCloseTo(450 * (560 / 315));
      expect(getEmbedValidationStatus(embeddable)).toBe(true);
      expect(h.state.toast).toBe(null);
    });

    it("resizes a wide embed to the 16:9 video aspect ratio", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const embeddable = API.createElement({
        type: "embeddable",
        width: 600,
        height: 100,
      });
      API.setElements([embeddable]);

      const input = selectAndOpenLinkEditor(embeddable);
      submitLink(input, "https://youtu.be/dQw4w9WgXcQ");

      const updated = API.getElement(embeddable);
      expect(updated.width).toBe(600);
      expect(updated.height).toBeCloseTo(600 / (560 / 315));
      expect(getEmbedValidationStatus(embeddable)).toBe(true);
    });

    it("shows a toast for a malformed but allowed video link", async () => {
      await render(<Excalidraw handleKeyboardGlobally={true} />);
      const embeddable = API.createElement({
        type: "embeddable",
        width: 300,
        height: 450,
      });
      API.setElements([embeddable]);

      const input = selectAndOpenLinkEditor(embeddable);
      submitLink(input, "https://vimeo.com/not-a-video-id");

      expect(API.getElement(embeddable).link).toBe(
        "https://vimeo.com/not-a-video-id",
      );
      expect(getEmbedValidationStatus(embeddable)).toBe(true);
      expect(h.state.toast?.message).toBe(t("toast.unrecognizedLinkFormat"));
    });

    it("skips the aspect-ratio resize when the link matches the cached one", async () => {
      const invalidLink = "https://www.youtube.com/watch?v=blocked00001";
      await render(
        <Excalidraw
          handleKeyboardGlobally={true}
          validateEmbeddable={(url) =>
            url === invalidLink ? false : undefined
          }
        />,
      );
      const embeddable = API.createElement({
        type: "embeddable",
        width: 300,
        height: 450,
      });
      API.setElements([embeddable]);

      // first invalid submit caches the previous link (none)
      submitLink(selectAndOpenLinkEditor(embeddable), invalidLink);
      expect(getEmbedValidationStatus(embeddable)).toBe(false);
      expect(h.state.toast?.message).toBe(t("toast.unableToEmbed"));

      // resubmitting the same invalid link caches it as the current link
      submitLink(selectAndOpenLinkEditor(embeddable), invalidLink);
      expect(API.getElement(embeddable).link).toBe(invalidLink);

      // valid link: cached link === current link, so no resize
      submitLink(
        selectAndOpenLinkEditor(embeddable),
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      );
      let updated = API.getElement(embeddable);
      expect(updated.link).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(updated.width).toBe(300);
      expect(updated.height).toBe(450);
      expect(getEmbedValidationStatus(embeddable)).toBe(true);

      // cache entry is cleared after a valid submit, so the next change resizes
      submitLink(
        selectAndOpenLinkEditor(embeddable),
        "https://www.youtube.com/watch?v=9bZkp7q19f0",
      );
      updated = API.getElement(embeddable);
      expect(updated.height).toBe(450);
      expect(updated.width).toBeCloseTo(450 * (560 / 315));
    });

    it("keeps the size of non-video embeds", async () => {
      await render(
        <Excalidraw handleKeyboardGlobally={true} validateEmbeddable={true} />,
      );
      const embeddable = API.createElement({
        type: "embeddable",
        width: 300,
        height: 450,
      });
      API.setElements([embeddable]);

      const input = selectAndOpenLinkEditor(embeddable);
      submitLink(input, "https://example.com/page");

      const updated = API.getElement(embeddable);
      expect(updated.link).toBe("https://example.com/page");
      expect(updated.width).toBe(300);
      expect(updated.height).toBe(450);
      expect(getEmbedValidationStatus(embeddable)).toBe(true);
    });
  });
});
