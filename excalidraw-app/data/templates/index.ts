import { CaptureUpdateAction, getCommonBounds } from "@excalidraw/excalidraw";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

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
    description: "Start, steps, a decision and an end state.",
    keywords: ["flowchart", "flow", "process", "decision", "steps"],
    source: flowchart,
  },
  {
    id: "mind-map",
    name: "Mind map",
    description: "A central idea with four branches and sub-topics.",
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
    description: "Client, load balancer, API servers, database and cache.",
    keywords: [
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
    description: "Milestones along a horizontal line.",
    keywords: ["timeline", "roadmap", "milestones", "schedule", "plan"],
    source: timeline,
  },
  {
    id: "wireframe",
    name: "Wireframe",
    description: "Landing page skeleton: header, hero and feature cards.",
    keywords: ["wireframe", "mockup", "landing", "ui", "layout", "website"],
    source: wireframe,
  },
];

export const parseTemplateElements = (
  template: StarterTemplate,
): OrderedExcalidrawElement[] => {
  const data = JSON.parse(template.source) as {
    elements?: readonly OrderedExcalidrawElement[];
  };
  return restoreElements(data.elements ?? [], null, {
    repairBindings: true,
    refreshDimensions: true,
  });
};

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Matches a query against template ids/names (exact, case-insensitive) or
 * keywords as whole words, so "overflow diagram" does not match "flow".
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
  return (
    STARTER_TEMPLATES.find((template) =>
      template.keywords.some((keyword) => {
        const keywordTokens = tokenize(keyword);
        return (
          keywordTokens.length > 0 &&
          keywordTokens.every((token) => queryTokens.includes(token))
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
