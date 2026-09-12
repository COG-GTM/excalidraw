import { CaptureUpdateAction, getCommonBounds } from "@excalidraw/element";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import flowchart from "./flowchart.excalidraw?raw";
import kanbanBoard from "./kanban-board.excalidraw?raw";
import mindMap from "./mind-map.excalidraw?raw";
import systemArchitecture from "./system-architecture.excalidraw?raw";
import timeline from "./timeline.excalidraw?raw";
import wireframe from "./wireframe.excalidraw?raw";

export type StarterTemplate = {
  id: string;
  name: string;
  description: string;
  keywords: readonly string[];
  /** raw `.excalidraw` JSON */
  source: string;
};

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    id: "flowchart",
    name: "Flowchart",
    description: "Start, steps, a decision and two outcomes.",
    keywords: ["flowchart", "flow", "process", "decision", "steps"],
    source: flowchart,
  },
  {
    id: "mind-map",
    name: "Mind map",
    description: "A central idea with four branches and details.",
    keywords: ["mind map", "mindmap", "brainstorm", "ideas", "branches"],
    source: mindMap,
  },
  {
    id: "kanban-board",
    name: "Kanban board",
    description: "To do / In progress / Done columns with cards.",
    keywords: ["kanban", "board", "tasks", "todo", "sprint", "backlog"],
    source: kanbanBoard,
  },
  {
    id: "system-architecture",
    name: "System architecture",
    description: "Client, load balancer, API servers, cache and database.",
    keywords: [
      "system architecture",
      "architecture",
      "system",
      "infrastructure",
      "services",
      "backend",
    ],
    source: systemArchitecture,
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "Quarterly milestones along a horizontal axis.",
    keywords: ["timeline", "roadmap", "milestones", "schedule", "plan"],
    source: timeline,
  },
  {
    id: "wireframe",
    name: "Wireframe",
    description: "Landing page layout: nav, hero, CTA and feature cards.",
    keywords: ["wireframe", "mockup", "landing", "page", "layout", "ui"],
    source: wireframe,
  },
];

export const parseTemplateElements = (
  template: StarterTemplate,
): OrderedExcalidrawElement[] => {
  const data = JSON.parse(template.source) as { elements?: unknown[] };
  return restoreElements(
    (data.elements ?? []) as OrderedExcalidrawElement[],
    null,
    { repairBindings: true, refreshDimensions: true },
  );
};

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Finds a template by exact id/name or by a whole-word keyword match against
 * the query (so "overflow diagram" does not match the "flow" keyword).
 */
export const findTemplateByKeyword = (
  query: string,
): StarterTemplate | null => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const exact = STARTER_TEMPLATES.find(
    (template) =>
      template.id === normalized || template.name.toLowerCase() === normalized,
  );
  if (exact) {
    return exact;
  }
  const queryTokens = tokenize(normalized);
  const containsPhrase = (phraseTokens: string[]) => {
    if (!phraseTokens.length || phraseTokens.length > queryTokens.length) {
      return false;
    }
    for (let i = 0; i + phraseTokens.length <= queryTokens.length; i++) {
      if (phraseTokens.every((token, j) => queryTokens[i + j] === token)) {
        return true;
      }
    }
    return false;
  };
  return (
    STARTER_TEMPLATES.find((template) =>
      template.keywords.some((keyword) => containsPhrase(tokenize(keyword))),
    ) ?? null
  );
};

export const loadTemplateIntoScene = (
  excalidrawAPI: ExcalidrawImperativeAPI,
  template: StarterTemplate,
) => {
  const elements = parseTemplateElements(template);
  excalidrawAPI.updateScene({
    elements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  if (elements.length) {
    excalidrawAPI.setViewport({
      target: getCommonBounds(elements),
      fit: "scale-down",
    });
  }
  return elements;
};
