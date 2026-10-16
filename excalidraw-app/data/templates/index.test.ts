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

  it("loads a template as a new drawing without the active file handle", () => {
    const updateScene = vi.fn();
    const api = {
      updateScene,
      setViewport: vi.fn(),
    } as unknown as ExcalidrawImperativeAPI;

    loadTemplateIntoScene(api, STARTER_TEMPLATES[0]);

    expect(updateScene).toHaveBeenCalledWith(
      expect.objectContaining({
        appState: { fileHandle: null, name: null },
      }),
    );
  });
});
