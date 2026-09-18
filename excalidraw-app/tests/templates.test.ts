import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { vi } from "vitest";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  STARTER_TEMPLATES,
  findTemplateByKeyword,
  loadTemplateIntoScene,
  parseTemplateElements,
} from "../data/templates";

describe("findTemplateByKeyword", () => {
  it("matches an exact template id", () => {
    expect(findTemplateByKeyword("kanban-board")?.id).toBe("kanban-board");
  });

  it("matches an exact template name, case-insensitively", () => {
    expect(findTemplateByKeyword("Kanban board")?.id).toBe("kanban-board");
    expect(findTemplateByKeyword("SYSTEM ARCHITECTURE")?.id).toBe(
      "system-architecture",
    );
  });

  it("matches keywords as whole words inside a longer prompt", () => {
    expect(findTemplateByKeyword("a kanban for sprint")?.id).toBe(
      "kanban-board",
    );
    expect(findTemplateByKeyword("draw me a roadmap")?.id).toBe("timeline");
  });

  it("is case and whitespace insensitive", () => {
    expect(findTemplateByKeyword("  KANBAN  ")?.id).toBe("kanban-board");
    expect(findTemplateByKeyword("\tFlowChart\n")?.id).toBe("flowchart");
  });

  it("matches multi-word keywords only when every token is present", () => {
    expect(findTemplateByKeyword("a mind map of ideas")?.id).toBe("mind-map");
    expect(findTemplateByKeyword("map of europe")).toBeNull();
  });

  it("does not match keywords as substrings", () => {
    expect(findTemplateByKeyword("overflow diagram")).toBeNull();
    expect(findTemplateByKeyword("keyboard")).toBeNull();
  });

  it("returns null for unknown or empty queries", () => {
    expect(findTemplateByKeyword("a picture of a cat")).toBeNull();
    expect(findTemplateByKeyword("")).toBeNull();
    expect(findTemplateByKeyword("   ")).toBeNull();
  });
});

describe("parseTemplateElements", () => {
  it("ships six starter templates with unique ids", () => {
    expect(STARTER_TEMPLATES).toHaveLength(6);
    expect(new Set(STARTER_TEMPLATES.map((t) => t.id)).size).toBe(6);
  });

  it.each(STARTER_TEMPLATES.map((template) => [template.id, template]))(
    "parses %s into a non-empty element array",
    (_id, template) => {
      const elements = parseTemplateElements(template);
      expect(Array.isArray(elements)).toBe(true);
      expect(elements.length).toBeGreaterThan(0);
      for (const element of elements) {
        expect(typeof element.id).toBe("string");
        expect(typeof element.type).toBe("string");
        expect(typeof element.index).toBe("string");
      }
    },
  );
});

describe("loadTemplateIntoScene", () => {
  it("replaces the scene immediately and fits the viewport", () => {
    const excalidrawAPI = {
      updateScene: vi.fn(),
      setViewport: vi.fn(),
    } as unknown as ExcalidrawImperativeAPI;
    const template = STARTER_TEMPLATES.find((t) => t.id === "flowchart")!;

    const elements = loadTemplateIntoScene(excalidrawAPI, template);

    expect(elements.length).toBeGreaterThan(0);
    expect(excalidrawAPI.updateScene).toHaveBeenCalledTimes(1);
    expect(excalidrawAPI.updateScene).toHaveBeenCalledWith({
      elements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    expect(excalidrawAPI.setViewport).toHaveBeenCalledWith(
      expect.objectContaining({ fit: "scale-down" }),
    );
  });
});
