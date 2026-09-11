import { getCommonBounds } from "@excalidraw/excalidraw";
import { CaptureUpdateAction, restoreElements } from "@excalidraw/excalidraw";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import flowchartSource from "./flowchart.excalidraw?raw";
import kanbanBoardSource from "./kanban-board.excalidraw?raw";
import mindMapSource from "./mind-map.excalidraw?raw";
import systemArchitectureSource from "./system-architecture.excalidraw?raw";
import timelineSource from "./timeline.excalidraw?raw";
import wireframeSource from "./wireframe.excalidraw?raw";

export type StarterTemplate = {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  source: string;
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "flowchart",
    name: "Flowchart",
    description: "Decision flow with start, checks and outcomes.",
    keywords: ["flow", "flowchart", "process", "decision"],
    source: flowchartSource,
  },
  {
    id: "mind-map",
    name: "Mind map",
    description: "Central idea radiating into four branches.",
    keywords: ["mind", "mindmap", "brainstorm", "ideas"],
    source: mindMapSource,
  },
  {
    id: "kanban-board",
    name: "Kanban board",
    description: "To do / in progress / done columns with cards.",
    keywords: ["kanban", "board", "backlog", "sprint"],
    source: kanbanBoardSource,
  },
  {
    id: "system-architecture",
    name: "System architecture",
    description: "Clients, gateway, services and a database.",
    keywords: ["architecture", "system", "services", "infra"],
    source: systemArchitectureSource,
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "Quarterly milestones along a single axis.",
    keywords: ["timeline", "roadmap", "milestones", "schedule"],
    source: timelineSource,
  },
  {
    id: "wireframe",
    name: "Wireframe",
    description: "Landing page layout with hero and cards.",
    keywords: ["wireframe", "layout", "mockup", "ui"],
    source: wireframeSource,
  },
];

export const parseTemplateElements = (
  template: StarterTemplate,
): ExcalidrawElement[] => {
  const parsed = JSON.parse(template.source) as {
    elements?: readonly ExcalidrawElement[];
  };

  return restoreElements(parsed.elements ?? [], null);
};

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Matches a query against a template id/name, or against a keyword as a whole
 * word, so that "overflow diagram" does not match the "flow" keyword.
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

  const tokens = new Set(tokenize(normalized));

  return (
    STARTER_TEMPLATES.find((template) =>
      template.keywords.some((keyword) =>
        tokenize(keyword).every((token) => tokens.has(token)),
      ),
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
};
