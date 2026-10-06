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
    description: "Start, decision and process steps connected with arrows.",
    keywords: ["flowchart", "flow", "process", "decision", "workflow"],
    source: flowchart,
  },
  {
    id: "mind-map",
    name: "Mind map",
    description: "A central idea with four branches and leaf ideas.",
    keywords: ["mind map", "mindmap", "brainstorm", "ideas", "map"],
    source: mindMap,
  },
  {
    id: "kanban-board",
    name: "Kanban board",
    description: "To do / In progress / Review / Done columns with cards.",
    keywords: ["kanban", "board", "sprint", "tasks", "todo", "backlog"],
    source: kanbanBoard,
  },
  {
    id: "system-architecture",
    name: "System architecture",
    description: "Clients, an API gateway, services, a database and a queue.",
    keywords: [
      "architecture",
      "system",
      "services",
      "microservices",
      "infra",
      "infrastructure",
    ],
    source: systemArchitecture,
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "Five milestones laid out along a horizontal axis.",
    keywords: ["timeline", "roadmap", "milestones", "schedule", "plan"],
    source: timeline,
  },
  {
    id: "wireframe",
    name: "Wireframe",
    description: "A landing page skeleton: nav, hero and feature cards.",
    keywords: ["wireframe", "mockup", "landing", "page", "ui", "layout"],
    source: wireframe,
  },
];

export const parseTemplateElements = (
  template: StarterTemplate,
): ExcalidrawElement[] => {
  const data = JSON.parse(template.source) as ImportedDataState;
  return restoreElements(data.elements, null, {
    refreshDimensions: true,
    repairBindings: true,
  });
};

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Exact id/name match, or a whole-word keyword match (every word of the
 * keyword must appear in the query), so "overflow diagram" does not match the
 * "flow" keyword.
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

  const queryTokens = new Set(tokenize(normalized));
  return (
    STARTER_TEMPLATES.find((template) =>
      template.keywords.some((keyword) => {
        const keywordTokens = tokenize(keyword);
        return (
          keywordTokens.length > 0 &&
          keywordTokens.every((token) => queryTokens.has(token))
        );
      }),
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
