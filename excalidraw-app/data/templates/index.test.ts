import { describe, expect, it, vi } from "vitest";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  findTemplateByKeyword,
  loadTemplateIntoScene,
  parseTemplateElements,
  STARTER_TEMPLATES,
} from "./index";

describe("starter templates", () => {
  it("matches template names and whole keyword phrases", () => {
    expect(findTemplateByKeyword("flowchart")?.id).toBe("flowchart");
    expect(findTemplateByKeyword("overflow diagram")).toBeNull();
    expect(findTemplateByKeyword("a kanban for my team")?.id).toBe(
      "kanban-board",
    );
    expect(findTemplateByKeyword("mind map of ideas")?.id).toBe("mind-map");
    expect(findTemplateByKeyword("user signup journey")).toBeNull();
  });

  it("restores elements from every starter template", () => {
    for (const template of STARTER_TEMPLATES) {
      expect(parseTemplateElements(template).length).toBeGreaterThan(0);
    }
  });

  it("does not replace a canvas that already has content", () => {
    const api = {
      getSceneElements: () => [{ id: "existing" }],
      updateScene: vi.fn(),
      setViewport: vi.fn(),
    } as unknown as ExcalidrawImperativeAPI;

    expect(loadTemplateIntoScene(api, STARTER_TEMPLATES[0])).toBe(false);
    expect(api.updateScene).not.toHaveBeenCalled();
  });
});
