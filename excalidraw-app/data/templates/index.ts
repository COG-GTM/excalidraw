import { CaptureUpdateAction, getCommonBounds } from "@excalidraw/excalidraw";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
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
    description: "Start, decision and end nodes connected with arrows.",
    keywords: ["flowchart", "flow", "process", "decision", "steps"],
    source: flowchart,
  },
  {
    id: "mind-map",
    name: "Mind map",
    description: "A central idea with branches and sub-topics.",
    keywords: ["mind map", "mindmap", "brainstorm", "ideas", "branches"],
    source: mindMap,
  },
  {
    id: "kanban-board",
    name: "Kanban board",
    description: "To do, in progress and done columns with cards.",
    keywords: ["kanban", "board", "tasks", "todo", "sprint", "backlog"],
    source: kanbanBoard,
  },
  {
    id: "system-architecture",
    name: "System architecture",
    description: "Clients, load balancer, services, queue, cache and database.",
    keywords: [
      "architecture",
      "system",
      "infrastructure",
      "services",
      "backend",
      "cloud",
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
    description: "A landing page layout with header, hero, cards and footer.",
    keywords: ["wireframe", "mockup", "landing", "website", "layout", "ui"],
    source: wireframe,
  },
];

export const parseTemplateElements = (
  template: StarterTemplate,
): ExcalidrawElement[] => {
  const data = JSON.parse(template.source) as ImportedDataState;
  return restoreElements(data.elements, null, {
    repairBindings: true,
    refreshDimensions: true,
  });
};

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Finds a template by exact id/name or by whole-word keyword match, so that a
 * query like "overflow diagram" does not match the `flow` keyword.
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
  const containsPhrase = (keywordTokens: string[]) => {
    if (
      keywordTokens.length === 0 ||
      keywordTokens.length > queryTokens.length
    ) {
      return false;
    }
    for (let i = 0; i + keywordTokens.length <= queryTokens.length; i++) {
      if (keywordTokens.every((token, j) => queryTokens[i + j] === token)) {
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
  excalidrawAPI.setViewport({
    target: getCommonBounds(elements),
    fit: "scale-down",
  });
  return elements;
};
