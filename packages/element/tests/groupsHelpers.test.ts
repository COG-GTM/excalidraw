import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";

import { arrayToMap } from "@excalidraw/common";

import type { AppState } from "@excalidraw/excalidraw/types";

import {
  addToGroup,
  editGroupForSelectedElement,
  getMaximumGroups,
  getNonDeletedGroupIds,
  isInGroup,
  removeFromSelectedGroups,
} from "../src/groups";

describe("group helpers", () => {
  it("editGroupForSelectedElement enters the element's innermost group", () => {
    const appState = {
      ...getDefaultAppState(),
      selectedGroupIds: { g1: true },
    } as unknown as AppState;
    const grouped = API.createElement({ groupIds: ["inner", "outer"] });
    const ungrouped = API.createElement({});

    expect(editGroupForSelectedElement(appState, grouped)).toMatchObject({
      editingGroupId: "inner",
      selectedGroupIds: {},
      selectedElementIds: { [grouped.id]: true },
    });
    expect(
      editGroupForSelectedElement(appState, ungrouped).editingGroupId,
    ).toBe(null);
  });

  it("addToGroup inserts before the editing group or appends", () => {
    expect(addToGroup(["a", "b"], "new", null)).toEqual(["a", "b", "new"]);
    expect(addToGroup(["a", "b"], "new", "b")).toEqual(["a", "new", "b"]);
    expect(addToGroup(["a", "b"], "new", "missing")).toEqual(["a", "b", "new"]);
  });

  it("removeFromSelectedGroups drops selected group ids", () => {
    expect(
      removeFromSelectedGroups(["a", "b", "c"], { b: true, c: false }),
    ).toEqual(["a", "c"]);
  });

  it("getMaximumGroups groups by outermost group and includes bound text", () => {
    const container = API.createElement({
      type: "rectangle",
      id: "container",
      boundElements: [{ type: "text", id: "label" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      containerId: "container",
    });
    const g1 = API.createElement({ groupIds: ["inner", "outer"] });
    const g2 = API.createElement({ groupIds: ["outer"] });

    const groups = getMaximumGroups(
      [container, g1, g2],
      arrayToMap([container, label, g1, g2]),
    );

    expect(groups.map((group) => group.map((el) => el.id))).toEqual([
      ["label", "container"],
      [g1.id, g2.id],
    ]);
  });

  it("getNonDeletedGroupIds skips deleted elements", () => {
    const a = API.createElement({ groupIds: ["a", "b"] });
    const deleted = API.createElement({ groupIds: ["c"], isDeleted: true });
    const ungrouped = API.createElement({});

    expect(
      [...getNonDeletedGroupIds(arrayToMap([a, deleted, ungrouped]))].sort(),
    ).toEqual(["a", "b"]);
  });

  it("isInGroup", () => {
    expect(isInGroup(API.createElement({ groupIds: ["a"] }))).toBe(true);
    expect(isInGroup(API.createElement({}))).toBe(false);
  });
});
