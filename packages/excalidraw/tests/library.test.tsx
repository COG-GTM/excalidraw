import { act, queryByTestId, within } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";

import { KEYS, MIME_TYPES, ORIG_ID } from "@excalidraw/common";

import { getCommonBoundingBox } from "@excalidraw/element";

import type {
  ExcalidrawGenericElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { actionAddToLibrary } from "../actions/actionAddToLibrary";
import { parseLibraryJSON } from "../data/blob";
import { fileOpen } from "../data/filesystem";
import { saveLibraryAsJSON, serializeLibraryAsJSON } from "../data/json";
import { distributeLibraryItemsOnSquareGrid } from "../data/library";
import { t } from "../i18n";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { fireEvent, render, waitFor } from "./test-utils";

import type { LibraryItem, LibraryItems } from "../types";

const { h } = window;

const libraryJSONPromise = API.readFile(
  "./fixtures/fixture_library.excalidrawlib",
  "utf8",
);

const mockLibraryFilePromise = new Promise<Blob>(async (resolve, reject) => {
  try {
    resolve(
      new Blob([await libraryJSONPromise], { type: MIME_TYPES.excalidrawlib }),
    );
  } catch (error) {
    reject(error);
  }
});

vi.mock("../data/filesystem.ts", async (importOriginal) => {
  const module = await importOriginal();
  return {
    __esmodule: true,
    //@ts-ignore
    ...module,
    fileOpen: vi.fn(() => mockLibraryFilePromise),
  };
});

vi.mock("../data/json.ts", async (importOriginal) => {
  const module = await importOriginal();
  return {
    __esmodule: true,
    //@ts-ignore
    ...module,
    saveLibraryAsJSON: vi.fn(() => Promise.resolve()),
  };
});

// the real dialog renders previews via canvas and POSTs to the library
// backend; stub it so we can drive its `onSuccess` callback directly
vi.mock("../components/PublishLibrary.tsx", () => ({
  __esmodule: true,
  default: ({
    onSuccess,
  }: {
    onSuccess: (data: {
      url: string;
      authorName: string;
      items: LibraryItems;
    }) => void;
  }) => (
    <button
      data-testid="mock-publish-library-submit"
      onClick={() =>
        onSuccess({
          url: "https://libraries.excalidraw.com/test",
          authorName: "tester",
          items: [],
        })
      }
    />
  ),
}));

describe("library items inserting", () => {
  beforeEach(async () => {
    const rectangle = API.createElement({
      id: "rectangle1",
      type: "rectangle",
      boundElements: [
        { type: "text", id: "text1" },
        { type: "arrow", id: "arrow1" },
      ],
    });
    const text = API.createElement({
      id: "text1",
      type: "text",
      text: "ola",
      containerId: "rectangle1",
    });
    const arrow = API.createElement({
      id: "arrow1",
      type: "arrow",
      endBinding: {
        elementId: "rectangle1",
        fixedPoint: [0.5, 1],
        mode: "orbit",
      },
    });

    const libraryItems: LibraryItems = [
      {
        id: "libraryItem_id0",
        status: "unpublished",
        elements: [rectangle, text, arrow],
        created: 0,
        name: "test",
      },
    ];

    await render(<Excalidraw initialData={{ libraryItems }} />);
  });

  afterEach(async () => {
    await act(() => {
      return h.app.library.resetLibrary();
    });
  });

  it("should regenerate ids but retain bindings on library insert", async () => {
    const libraryItems = await h.app.library.getLatestLibrary();

    expect(libraryItems.length).toBe(1);

    await API.drop([
      {
        kind: "string",
        value: JSON.stringify({
          itemIds: [libraryItems[0].id],
        }),
        type: MIME_TYPES.excalidrawlibIds,
      },
    ]);

    await waitFor(() => {
      const rectangle = h.elements.find((e) => e.type === "rectangle")!;
      const text = h.elements.find((e) => e.type === "text")!;
      const arrow = h.elements.find((e) => e.type === "arrow")!;
      expect(h.elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "rectangle",
            id: expect.not.stringMatching("rectangle1"),
            boundElements: expect.arrayContaining([
              { type: "text", id: text.id },
              { type: "arrow", id: arrow.id },
            ]),
          }),
          expect.objectContaining({
            type: "text",
            id: expect.not.stringMatching("text1"),
            containerId: rectangle.id,
          }),
          expect.objectContaining({
            type: "arrow",
            id: expect.not.stringMatching("arrow1"),
            endBinding: expect.objectContaining({
              elementId: rectangle.id,
            }),
          }),
        ]),
      );
    });
  });
});

describe("library", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
    await act(() => {
      return h.app.library.resetLibrary();
    });
  });

  it("import library via drag&drop", async () => {
    expect(await h.app.library.getLatestLibrary()).toEqual([]);
    await API.drop([
      {
        kind: "file",
        type: MIME_TYPES.excalidrawlib,
        file: await API.loadFile("./fixtures/fixture_library.excalidrawlib"),
      },
    ]);
    await waitFor(async () => {
      expect(await h.app.library.getLatestLibrary()).toEqual([
        {
          status: "unpublished",
          elements: [expect.objectContaining({ id: "A" })],
          id: expect.any(String),
          created: expect.any(Number),
        },
      ]);
    });
  });

  // NOTE: mocked to test logic, not actual drag&drop via UI
  it("drop library item onto canvas", async () => {
    expect(h.elements).toEqual([]);
    const libraryItems = parseLibraryJSON(await libraryJSONPromise);
    await API.drop([
      {
        kind: "string",
        value: serializeLibraryAsJSON(libraryItems),
        type: MIME_TYPES.excalidrawlib,
      },
    ]);
    await waitFor(() => {
      expect(h.elements).toEqual([expect.objectContaining({ [ORIG_ID]: "A" })]);
    });
  });

  it("should fix duplicate ids between items on insert", async () => {
    // note, we're not testing for duplicate group ids and such because
    // deduplication of that happens upstream in the library component
    // which would be very hard to orchestrate in this test

    const elem1 = API.createElement({
      id: "elem1",
      type: "rectangle",
    });
    const item1: LibraryItem = {
      id: "item1",
      status: "published",
      elements: [elem1],
      created: 1,
    };

    await API.drop([
      {
        kind: "string",
        value: serializeLibraryAsJSON([item1, item1]),
        type: MIME_TYPES.excalidrawlib,
      },
    ]);

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({
          [ORIG_ID]: "elem1",
        }),
        expect.objectContaining({
          id: expect.not.stringMatching(/^elem1$/),
          [ORIG_ID]: expect.not.stringMatching(/^\w+$/),
        }),
      ]);
    });
  });

  it("inserting library item should revert to selection tool", async () => {
    UI.clickTool("rectangle");
    expect(h.elements).toEqual([]);
    const libraryItems = parseLibraryJSON(await libraryJSONPromise);
    await API.drop([
      {
        kind: "string",
        value: serializeLibraryAsJSON(libraryItems),
        type: MIME_TYPES.excalidrawlib,
      },
    ]);
    await waitFor(() => {
      expect(h.elements).toEqual([expect.objectContaining({ [ORIG_ID]: "A" })]);
    });
    // this has a high flake
    // expect(h.state.activeTool.type).toBe("selection");
  });
});

describe("library menu", () => {
  it("should load library from file picker", async () => {
    const { container } = await render(<Excalidraw />);

    const latestLibrary = await h.app.library.getLatestLibrary();
    expect(latestLibrary.length).toBe(0);

    const libraryButton = container.querySelector(".sidebar-trigger");

    fireEvent.click(libraryButton!);
    fireEvent.click(
      queryByTestId(
        container.querySelector(".layer-ui__library")!,
        "dropdown-menu-button",
      )!,
    );
    fireEvent.click(queryByTestId(container, "lib-dropdown--load")!);

    const libraryItems = parseLibraryJSON(await libraryJSONPromise);

    await waitFor(async () => {
      const latestLibrary = await h.app.library.getLatestLibrary();
      expect(latestLibrary.length).toBeGreaterThan(0);
      expect(latestLibrary.length).toBe(libraryItems.length);
      const { versionNonce, ...strippedElement } = libraryItems[0]?.elements[0]; // stripped due to mutations
      expect(latestLibrary[0].elements).toEqual([
        expect.objectContaining(strippedElement),
      ]);
    });
  });
});

const createLibraryItem = (
  id: string,
  overrides: Partial<LibraryItem> = {},
  width = 100,
): LibraryItem => ({
  id,
  status: "unpublished",
  elements: [
    API.createElement({
      id: `${id}-rect`,
      type: "rectangle",
      x: 0,
      y: 0,
      width,
    }),
  ],
  created: 1,
  ...overrides,
});

const renderWithEmptyLibrary = async () => {
  const result = await render(<Excalidraw />);
  await act(() => {
    return h.app.library.resetLibrary();
  });
  return result;
};

const getLibraryMenu = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(".layer-ui__library")!;

const openLibrarySidebar = async (container: HTMLElement) => {
  fireEvent.click(container.querySelector(".sidebar-trigger")!);
  await waitFor(() => {
    expect(getLibraryMenu(container)).not.toBeNull();
  });
};

const getPendingUnit = (container: HTMLElement) =>
  getLibraryMenu(container).querySelector<HTMLElement>(
    ".library-unit__dragger.library-unit__pulse",
  );

const getStoredUnits = async (container: HTMLElement, count: number) => {
  let units: HTMLElement[] = [];
  await waitFor(() => {
    units = Array.from(
      getLibraryMenu(container).querySelectorAll<HTMLElement>(
        ".library-unit__dragger:not(.library-unit__pulse)",
      ),
    );
    expect(units.length).toBe(count);
  });
  return units;
};

const getSelectionCounter = (container: HTMLElement) =>
  getLibraryMenu(container).querySelector(".library-actions-counter");

const openLibraryDropdown = (container: HTMLElement) => {
  // dropdown open state is kept in a jotai atom which may outlive a test
  if (!container.querySelector(".library-menu")) {
    fireEvent.click(
      queryByTestId(getLibraryMenu(container), "dropdown-menu-button")!,
    );
  }
  return container.querySelector<HTMLElement>(".library-menu")!;
};

const confirmDialog = async (container: HTMLElement) => {
  let dialog: HTMLElement | null = null;
  await waitFor(() => {
    dialog = document.querySelector<HTMLElement>(".confirm-dialog");
    expect(dialog).not.toBeNull();
  });
  fireEvent.click(within(dialog!).getByText(t("buttons.confirm")));
};

const getLibraryIds = async () =>
  (await h.app.library.getLatestLibrary()).map((item) => item.id);

describe("library sidebar", () => {
  beforeEach(async () => {
    vi.mocked(saveLibraryAsJSON).mockClear();
    vi.mocked(fileOpen).mockClear();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await act(() => {
      return h.app.library.resetLibrary();
    });
  });

  describe("adding selection to library", () => {
    it("should add selected elements as a pending item and deselect", async () => {
      const { container } = await renderWithEmptyLibrary();

      const rect = API.createElement({ type: "rectangle", id: "rect1" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      await openLibrarySidebar(container);

      await waitFor(() => {
        expect(getPendingUnit(container)).not.toBeNull();
      });

      fireEvent.click(getPendingUnit(container)!);

      await waitFor(async () => {
        const items = await h.app.library.getLatestLibrary();
        expect(items).toEqual([
          expect.objectContaining({
            status: "unpublished",
            elements: [expect.objectContaining({ id: "rect1" })],
          }),
        ]);
      });
      expect(h.state.selectedElementIds).toEqual({});
      await waitFor(() => {
        expect(getPendingUnit(container)).toBeNull();
      });
      await getStoredUnits(container, 1);
    });

    it("should prepend newly added item before existing items", async () => {
      const { container } = await renderWithEmptyLibrary();
      await act(() => h.app.library.setLibrary([createLibraryItem("item1")]));

      const rect = API.createElement({ type: "rectangle", id: "rect1" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      await openLibrarySidebar(container);
      await waitFor(() => {
        expect(getPendingUnit(container)).not.toBeNull();
      });
      fireEvent.click(getPendingUnit(container)!);

      await waitFor(async () => {
        const items = await h.app.library.getLatestLibrary();
        expect(items.length).toBe(2);
        expect(items[0].elements).toEqual([
          expect.objectContaining({ id: "rect1" }),
        ]);
        expect(items[1].id).toBe("item1");
      });
    });

    it("should update pending item when canvas selection changes while open", async () => {
      const { container } = await renderWithEmptyLibrary();

      const rect = API.createElement({ type: "rectangle", id: "rect1" });
      const ellipse = API.createElement({ type: "ellipse", id: "ellipse1" });
      API.setElements([rect, ellipse]);

      await openLibrarySidebar(container);
      expect(getPendingUnit(container)).toBeNull();

      API.setSelectedElements([ellipse]);
      await waitFor(() => {
        expect(getPendingUnit(container)).not.toBeNull();
      });

      fireEvent.click(getPendingUnit(container)!);

      await waitFor(async () => {
        const items = await h.app.library.getLatestLibrary();
        expect(items).toEqual([
          expect.objectContaining({
            elements: [expect.objectContaining({ id: "ellipse1" })],
          }),
        ]);
      });
    });

    it("should show error and not add disallowed element types", async () => {
      const { container } = await renderWithEmptyLibrary();

      const image = API.createElement({ type: "image", id: "image1" });
      API.setElements([image]);
      API.setSelectedElements([image]);

      await openLibrarySidebar(container);
      await waitFor(() => {
        expect(getPendingUnit(container)).not.toBeNull();
      });
      fireEvent.click(getPendingUnit(container)!);

      await waitFor(() => {
        expect(h.state.errorMessage).toBe(
          t("errors.libraryElementTypeError.image"),
        );
      });
      expect(await h.app.library.getLatestLibrary()).toEqual([]);
      // selection is kept so user can adjust it
      expect(h.state.selectedElementIds).toEqual({ image1: true });
    });

    it("should show error when persisting the library fails", async () => {
      const { container } = await renderWithEmptyLibrary();

      const rect = API.createElement({ type: "rectangle", id: "rect1" });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      await openLibrarySidebar(container);
      await waitFor(() => {
        expect(getPendingUnit(container)).not.toBeNull();
      });

      const setLibrarySpy = vi
        .spyOn(h.app.library, "setLibrary")
        .mockRejectedValueOnce(new Error("storage failure"));

      fireEvent.click(getPendingUnit(container)!);

      await waitFor(() => {
        expect(h.state.errorMessage).toBe(t("alerts.errorAddingToLibrary"));
      });
      expect(setLibrarySpy).toHaveBeenCalledTimes(1);
      expect(await h.app.library.getLatestLibrary()).toEqual([]);
      await waitFor(() => {
        expect(
          within(document.body).getByText(t("alerts.errorAddingToLibrary")),
        ).toBeInTheDocument();
      });
    });
  });

  describe("inserting from sidebar", () => {
    it("should insert clicked library item onto canvas", async () => {
      const { container } = await renderWithEmptyLibrary();
      await act(() =>
        h.app.library.setLibrary([
          createLibraryItem("item1"),
          createLibraryItem("item2"),
        ]),
      );
      await openLibrarySidebar(container);

      const units = await getStoredUnits(container, 2);
      fireEvent.click(units[1]);

      await waitFor(() => {
        expect(h.elements).toEqual([
          expect.objectContaining({
            type: "rectangle",
            [ORIG_ID]: "item2-rect",
          }),
        ]);
      });
      expect(h.elements[0].id).not.toBe("item2-rect");
      expect(h.state.activeTool.type).toBe("selection");
    });

    it("should insert all selected items when clicking a selected item", async () => {
      const { container } = await renderWithEmptyLibrary();
      await act(() =>
        h.app.library.setLibrary([
          createLibraryItem("item1", {}, 10),
          createLibraryItem("item2", {}, 20),
          createLibraryItem("item3", {}, 30),
        ]),
      );
      await openLibrarySidebar(container);

      let units = await getStoredUnits(container, 3);
      fireEvent.click(units[0], { shiftKey: true });
      units = await getStoredUnits(container, 3);
      fireEvent.click(units[2], { shiftKey: true });
      await waitFor(() => {
        expect(getSelectionCounter(container)).toHaveTextContent("3");
      });

      units = await getStoredUnits(container, 3);
      fireEvent.click(units[0]);

      await waitFor(() => {
        expect(h.elements.length).toBe(3);
      });
      expect(h.elements.map((el) => el.width).sort()).toEqual([10, 20, 30]);
      expect(h.elements.filter((el) => el.id.startsWith("item")).length).toBe(
        0,
      );
    });
  });

  describe("ESC handling", () => {
    it("should clear library item selection on ESC inside sidebar", async () => {
      const { container } = await renderWithEmptyLibrary();
      await act(() =>
        h.app.library.setLibrary([
          createLibraryItem("item1"),
          createLibraryItem("item2"),
        ]),
      );
      await openLibrarySidebar(container);

      let units = await getStoredUnits(container, 2);
      fireEvent.click(units[0], { shiftKey: true });
      units = await getStoredUnits(container, 2);
      fireEvent.click(units[1], { shiftKey: true });
      await waitFor(() => {
        expect(getSelectionCounter(container)).toHaveTextContent("2");
      });

      fireEvent.keyDown(units[0], { key: KEYS.ESCAPE });

      await waitFor(() => {
        expect(getSelectionCounter(container)).toBeNull();
      });
      // sidebar stays open when there was a selection to clear
      expect(h.state.openSidebar).not.toBeNull();
    });

    it("should close sidebar on ESC in empty search input", async () => {
      const { container } = await renderWithEmptyLibrary();
      await act(() => h.app.library.setLibrary([createLibraryItem("item1")]));
      await openLibrarySidebar(container);
      expect(h.state.openSidebar).not.toBeNull();

      const focusContainerSpy = vi.spyOn(h.app, "focusContainer");
      const getSearchInput = () =>
        getLibraryMenu(container).querySelector("input[type='search']")!;

      fireEvent.change(getSearchInput(), { target: { value: "foo" } });
      fireEvent.keyDown(getSearchInput(), { key: KEYS.ESCAPE });
      // non-empty search input -> library menu doesn't handle ESC
      expect(focusContainerSpy).not.toHaveBeenCalled();

      if (!h.state.openSidebar) {
        await openLibrarySidebar(container);
      }
      fireEvent.change(getSearchInput(), { target: { value: "" } });
      fireEvent.keyDown(getSearchInput(), { key: KEYS.ESCAPE });

      await waitFor(() => {
        expect(h.state.openSidebar).toBeNull();
      });
      expect(focusContainerSpy).toHaveBeenCalled();
    });
  });

  describe("header dropdown", () => {
    it("should show load/export/reset when nothing is selected", async () => {
      const { container } = await renderWithEmptyLibrary();
      await act(() => h.app.library.setLibrary([createLibraryItem("item1")]));
      await openLibrarySidebar(container);
      await getStoredUnits(container, 1);

      const menu = openLibraryDropdown(container);

      expect(queryByTestId(menu, "lib-dropdown--load")).not.toBeNull();
      expect(queryByTestId(menu, "lib-dropdown--export")).not.toBeNull();
      // publish item (reuses the `--remove` testid)
      expect(queryByTestId(menu, "lib-dropdown--remove")).toBeNull();
      expect(
        within(menu).queryByText(t("buttons.resetLibrary")),
      ).not.toBeNull();
      expect(within(menu).queryByText(t("buttons.remove"))).toBeNull();
    });

    it("should only show load when library is empty", async () => {
      const { container } = await renderWithEmptyLibrary();
      await openLibrarySidebar(container);

      const menu = openLibraryDropdown(container);

      expect(queryByTestId(menu, "lib-dropdown--load")).not.toBeNull();
      expect(queryByTestId(menu, "lib-dropdown--export")).toBeNull();
      expect(within(menu).queryByText(t("buttons.resetLibrary"))).toBeNull();
    });

    it("should reset whole library after confirming", async () => {
      const { container } = await renderWithEmptyLibrary();
      await act(() =>
        h.app.library.setLibrary([
          createLibraryItem("item1"),
          createLibraryItem("item2"),
        ]),
      );
      await openLibrarySidebar(container);
      await getStoredUnits(container, 2);

      const menu = openLibraryDropdown(container);
      fireEvent.click(within(menu).getByText(t("buttons.resetLibrary")));

      await waitFor(() => {
        expect(
          within(document.body).getByText(t("alerts.resetLibrary")),
        ).toBeInTheDocument();
      });
      await confirmDialog(container);

      await waitFor(async () => {
        expect(await h.app.library.getLatestLibrary()).toEqual([]);
      });
      await getStoredUnits(container, 0);
    });

    it("should keep library when reset is cancelled", async () => {
      const { container } = await renderWithEmptyLibrary();
      await act(() => h.app.library.setLibrary([createLibraryItem("item1")]));
      await openLibrarySidebar(container);
      await getStoredUnits(container, 1);

      const menu = openLibraryDropdown(container);
      fireEvent.click(within(menu).getByText(t("buttons.resetLibrary")));

      let dialog: HTMLElement | null = null;
      await waitFor(() => {
        dialog = document.querySelector<HTMLElement>(".confirm-dialog");
        expect(dialog).not.toBeNull();
      });
      fireEvent.click(within(dialog!).getByText(t("buttons.cancel")));

      await waitFor(() => {
        expect(document.querySelector(".confirm-dialog")).toBeNull();
      });
      expect(await getLibraryIds()).toEqual(["item1"]);
    });

    it("should remove only selected items after confirming", async () => {
      const { container } = await renderWithEmptyLibrary();
      await act(() =>
        h.app.library.setLibrary([
          createLibraryItem("item1"),
          createLibraryItem("item2"),
          createLibraryItem("item3"),
        ]),
      );
      await openLibrarySidebar(container);

      const units = await getStoredUnits(container, 3);
      fireEvent.click(units[1], { shiftKey: true });
      await waitFor(() => {
        expect(getSelectionCounter(container)).toHaveTextContent("1");
      });

      const menu = openLibraryDropdown(container);
      expect(queryByTestId(menu, "lib-dropdown--load")).toBeNull();
      expect(queryByTestId(menu, "lib-dropdown--export")).not.toBeNull();
      expect(queryByTestId(menu, "lib-dropdown--remove")).toHaveTextContent(
        t("buttons.publishLibrary"),
      );
      expect(within(menu).queryByText(t("buttons.resetLibrary"))).toBeNull();

      fireEvent.click(within(menu).getByText(t("buttons.remove")));
      await waitFor(() => {
        expect(
          within(document.body).getByText(
            t("alerts.removeItemsFromsLibrary", { count: 1 }),
          ),
        ).toBeInTheDocument();
      });
      await confirmDialog(container);

      await waitFor(async () => {
        expect(await getLibraryIds()).toEqual(["item1", "item3"]);
      });
      await waitFor(() => {
        expect(getSelectionCounter(container)).toBeNull();
      });
      await getStoredUnits(container, 2);
    });

    it("should show error when removing items fails", async () => {
      const { container } = await renderWithEmptyLibrary();
      await act(() =>
        h.app.library.setLibrary([
          createLibraryItem("item1"),
          createLibraryItem("item2"),
        ]),
      );
      await openLibrarySidebar(container);

      const units = await getStoredUnits(container, 2);
      fireEvent.click(units[0], { shiftKey: true });
      await waitFor(() => {
        expect(getSelectionCounter(container)).toHaveTextContent("1");
      });

      const setLibrarySpy = vi
        .spyOn(h.app.library, "setLibrary")
        .mockRejectedValueOnce(new Error("storage failure"));

      const menu = openLibraryDropdown(container);
      fireEvent.click(within(menu).getByText(t("buttons.remove")));
      await confirmDialog(container);

      await waitFor(() => {
        expect(h.state.errorMessage).toBe(t("alerts.errorRemovingFromLibrary"));
      });
      expect(setLibrarySpy).toHaveBeenCalledWith([
        expect.objectContaining({ id: "item2" }),
      ]);
      expect(await getLibraryIds()).toEqual(["item1", "item2"]);
    });

    it("should export whole library when nothing is selected", async () => {
      const { container } = await renderWithEmptyLibrary();
      await act(() =>
        h.app.library.setLibrary([
          createLibraryItem("item1"),
          createLibraryItem("item2"),
        ]),
      );
      await openLibrarySidebar(container);
      await getStoredUnits(container, 2);

      const menu = openLibraryDropdown(container);
      fireEvent.click(queryByTestId(menu, "lib-dropdown--export")!);

      await waitFor(() => {
        expect(saveLibraryAsJSON).toHaveBeenCalledTimes(1);
      });
      expect(
        vi.mocked(saveLibraryAsJSON).mock.calls[0][0].map((item) => item.id),
      ).toEqual(["item1", "item2"]);
    });

    it("should export only selected items", async () => {
      const { container } = await renderWithEmptyLibrary();
      await act(() =>
        h.app.library.setLibrary([
          createLibraryItem("item1"),
          createLibraryItem("item2"),
          createLibraryItem("item3"),
        ]),
      );
      await openLibrarySidebar(container);

      const units = await getStoredUnits(container, 3);
      fireEvent.click(units[2], { shiftKey: true });
      await waitFor(() => {
        expect(getSelectionCounter(container)).toHaveTextContent("1");
      });

      const menu = openLibraryDropdown(container);
      fireEvent.click(queryByTestId(menu, "lib-dropdown--export")!);

      await waitFor(() => {
        expect(saveLibraryAsJSON).toHaveBeenCalledTimes(1);
      });
      expect(
        vi.mocked(saveLibraryAsJSON).mock.calls[0][0].map((item) => item.id),
      ).toEqual(["item3"]);
    });

    it("should surface export errors but mute aborts", async () => {
      const { container } = await renderWithEmptyLibrary();
      await act(() => h.app.library.setLibrary([createLibraryItem("item1")]));
      await openLibrarySidebar(container);
      await getStoredUnits(container, 1);

      const abortError = new Error("aborted");
      abortError.name = "AbortError";
      vi.mocked(saveLibraryAsJSON).mockRejectedValueOnce(abortError);

      let menu = openLibraryDropdown(container);
      fireEvent.click(queryByTestId(menu, "lib-dropdown--export")!);
      await waitFor(() => {
        expect(saveLibraryAsJSON).toHaveBeenCalledTimes(1);
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(h.state.errorMessage).toBeNull();

      vi.mocked(saveLibraryAsJSON).mockRejectedValueOnce(
        new Error("disk full"),
      );
      menu = openLibraryDropdown(container);
      fireEvent.click(queryByTestId(menu, "lib-dropdown--export")!);
      await waitFor(() => {
        expect(h.state.errorMessage).toBe("disk full");
      });
    });

    it("should ignore aborted import but show error on failed import", async () => {
      const { container } = await renderWithEmptyLibrary();
      await openLibrarySidebar(container);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const abortError = new Error("aborted");
      abortError.name = "AbortError";
      vi.mocked(fileOpen).mockImplementationOnce(() =>
        Promise.reject(abortError),
      );

      let menu = openLibraryDropdown(container);
      fireEvent.click(queryByTestId(menu, "lib-dropdown--load")!);
      await waitFor(() => {
        expect(fileOpen).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalled();
      });
      expect(h.state.errorMessage).toBeNull();

      vi.mocked(fileOpen).mockImplementationOnce(() =>
        Promise.reject(new Error("bad file")),
      );
      menu = openLibraryDropdown(container);
      fireEvent.click(queryByTestId(menu, "lib-dropdown--load")!);
      await waitFor(() => {
        expect(h.state.errorMessage).toBe(t("errors.importLibraryError"));
      });
      expect(await h.app.library.getLatestLibrary()).toEqual([]);
    });

    it("should mark selected items as published on publish success", async () => {
      const { container } = await renderWithEmptyLibrary();
      await act(() =>
        h.app.library.setLibrary([
          createLibraryItem("item1"),
          createLibraryItem("item2"),
        ]),
      );
      await openLibrarySidebar(container);

      const units = await getStoredUnits(container, 2);
      fireEvent.click(units[0], { shiftKey: true });
      await waitFor(() => {
        expect(getSelectionCounter(container)).toHaveTextContent("1");
      });

      const menu = openLibraryDropdown(container);
      fireEvent.click(queryByTestId(menu, "lib-dropdown--remove")!);

      await waitFor(() => {
        expect(
          queryByTestId(container, "mock-publish-library-submit"),
        ).not.toBeNull();
      });
      fireEvent.click(queryByTestId(container, "mock-publish-library-submit")!);

      await waitFor(async () => {
        const items = await h.app.library.getLatestLibrary();
        expect(items).toEqual([
          expect.objectContaining({ id: "item1", status: "published" }),
          expect.objectContaining({ id: "item2", status: "unpublished" }),
        ]);
      });
      await waitFor(() => {
        expect(
          document.querySelector(".publish-library-success"),
        ).not.toBeNull();
      });
      fireEvent.click(
        queryByTestId(document.body, "publish-library-success-close")!,
      );
      await waitFor(() => {
        expect(document.querySelector(".publish-library-success")).toBeNull();
      });
    });
  });
});

describe("actionAddToLibrary", () => {
  beforeEach(async () => {
    await renderWithEmptyLibrary();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await act(() => {
      return h.app.library.resetLibrary();
    });
  });

  it("should prepend a deep copy of the selection and show toast", async () => {
    await act(() => h.app.library.setLibrary([createLibraryItem("item1")]));

    const container = API.createElement({
      type: "rectangle",
      id: "container1",
      boundElements: [{ type: "text", id: "text1" }],
    });
    const text = API.createElement({
      type: "text",
      id: "text1",
      containerId: "container1",
    });
    API.setElements([container, text]);
    API.setSelectedElements([container]);

    const setLibrarySpy = vi.spyOn(h.app.library, "setLibrary");

    API.executeAction(actionAddToLibrary);

    await waitFor(() => {
      expect(h.state.toast).toEqual({ message: t("toast.addedToLibrary") });
    });

    const items = await h.app.library.getLatestLibrary();
    expect(items.length).toBe(2);
    expect(items[0]).toEqual(
      expect.objectContaining({
        status: "unpublished",
        id: expect.any(String),
      }),
    );
    expect(items[1].id).toBe("item1");
    // bound text is included
    expect(items[0].elements.map((el) => el.id)).toEqual([
      "container1",
      "text1",
    ]);

    // deep copy: library elements are distinct objects from scene elements
    const sceneContainer = h.elements.find((el) => el.id === "container1")!;
    const passedItems = setLibrarySpy.mock.calls[0][0] as LibraryItems;
    expect(passedItems[0].elements[0]).not.toBe(sceneContainer);
    expect(passedItems[0].elements[0].boundElements).not.toBe(
      sceneContainer.boundElements,
    );
    const libContainer = items[0].elements[0];
    expect(libContainer).not.toBe(sceneContainer);
    expect(libContainer.boundElements).not.toBe(sceneContainer.boundElements);
    expect(libContainer).toEqual(sceneContainer);

    // canvas selection is unchanged
    expect(h.state.selectedElementIds).toEqual({ container1: true });
  });

  it.each(["image", "embeddable", "iframe"] as const)(
    "should refuse to add %s elements",
    async (type) => {
      const rect = API.createElement({ type: "rectangle", id: "rect1" });
      const disallowed = API.createElement({ type, id: "disallowed1" });
      API.setElements([rect, disallowed]);
      API.setSelectedElements([rect, disallowed]);

      API.executeAction(actionAddToLibrary);

      await waitFor(() => {
        expect(h.state.errorMessage).toBe(
          t(`errors.libraryElementTypeError.${type}`),
        );
      });
      expect(h.state.toast).toBeNull();
      expect(await h.app.library.getLatestLibrary()).toEqual([]);
    },
  );

  it("should show error message when persisting fails", async () => {
    const rect = API.createElement({ type: "rectangle", id: "rect1" });
    API.setElements([rect]);
    API.setSelectedElements([rect]);

    vi.spyOn(h.app.library, "setLibrary").mockRejectedValueOnce(
      new Error("storage failure"),
    );

    API.executeAction(actionAddToLibrary);

    await waitFor(() => {
      expect(h.state.errorMessage).toBe("storage failure");
    });
    expect(h.state.toast).toBeNull();
    expect(await h.app.library.getLatestLibrary()).toEqual([]);
  });
});

describe("distributeLibraryItemsOnSquareGrid()", () => {
  it("should distribute items on a grid", async () => {
    const createLibraryItem = (
      elements: NonDeleted<ExcalidrawGenericElement>[],
    ): LibraryItem => {
      return {
        id: `id-${Date.now()}`,
        elements,
        status: "unpublished",
        created: Date.now(),
      };
    };

    const PADDING = 50;

    const el1 = API.createElement({
      id: "id1",
      width: 100,
      height: 100,
      x: 0,
      y: 0,
    });

    const el2 = API.createElement({
      id: "id2",
      width: 100,
      height: 80,
      x: -100,
      y: -50,
    });

    const el3 = API.createElement({
      id: "id3",
      width: 40,
      height: 50,
      x: -100,
      y: -50,
    });

    const el4 = API.createElement({
      id: "id4",
      width: 50,
      height: 50,
      x: 0,
      y: 0,
    });

    const el5 = API.createElement({
      id: "id5",
      width: 70,
      height: 100,
      x: 40,
      y: 0,
    });

    const libraryItems: LibraryItems = [
      createLibraryItem([el1]),
      createLibraryItem([el2]),
      createLibraryItem([el3]),
      createLibraryItem([el4, el5]),
    ];

    const distributed = distributeLibraryItemsOnSquareGrid(libraryItems);
    // assert the returned library items are flattened to elements
    expect(distributed.length).toEqual(
      libraryItems.map((x) => x.elements).flat().length,
    );
    expect(distributed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: el1.id,
          x: 0,
          y: 0,
        }),
        expect.objectContaining({
          id: el2.id,
          x:
            el1.width +
            PADDING +
            (getCommonBoundingBox([el4, el5]).width - el2.width) / 2,
          y: Math.abs(el1.height - el2.height) / 2,
        }),
        expect.objectContaining({
          id: el3.id,
          x: Math.abs(el1.width - el3.width) / 2,
          y:
            Math.max(el1.height, el2.height) +
            PADDING +
            Math.abs(el3.height - Math.max(el4.height, el5.height)) / 2,
        }),
        expect.objectContaining({
          id: el4.id,
          x: Math.max(el1.width, el2.width) + PADDING,
          y: Math.max(el1.height, el2.height) + PADDING,
        }),
        expect.objectContaining({
          id: el5.id,
          x: Math.max(el1.width, el2.width) + PADDING + Math.abs(el5.x - el4.x),
          y:
            Math.max(el1.height, el2.height) +
            PADDING +
            Math.abs(el5.y - el4.y),
        }),
      ]),
    );
  });
});
