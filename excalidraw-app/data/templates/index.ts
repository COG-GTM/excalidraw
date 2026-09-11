import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getCommonBounds } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";
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
  /** lowercase words routing a typed query to this template */
  keywords: string[];
  source: string;
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "flowchart",
    name: "Flowchart",
    description: "Decision flow with start, steps and branches.",
    keywords: ["flowchart", "flow", "process", "decision"],
    source: flowchart,
  },
  {
    id: "mind-map",
    name: "Mind map",
    description: "Central idea radiating into four branches.",
    keywords: ["mindmap", "mind map", "brainstorm", "ideas"],
    source: mindMap,
  },
  {
    id: "kanban-board",
    name: "Kanban board",
    description: "To do / in progress / done columns with cards.",
    keywords: ["kanban", "board", "backlog", "sprint"],
    source: kanbanBoard,
  },
  {
    id: "system-architecture",
    name: "System architecture",
    description: "Clients, gateway, services, queue and database.",
    keywords: ["architecture", "system", "services", "infrastructure"],
    source: systemArchitecture,
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "Quarterly milestones along a horizontal axis.",
    keywords: ["timeline", "roadmap", "milestones", "schedule"],
    source: timeline,
  },
  {
    id: "wireframe",
    name: "Wireframe",
    description: "Web page layout with header, sidebar and cards.",
    keywords: ["wireframe", "mockup", "layout", "ui"],
    source: wireframe,
  },
];

export const parseTemplateElements = (
  template: StarterTemplate,
): ExcalidrawElement[] => {
  const scene = JSON.parse(template.source) as { elements: unknown };

  return restoreElements(scene.elements as ExcalidrawElement[], null, {
    refreshDimensions: true,
  });
};

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Matches a typed query against a template id, name or keyword. Keywords match
 * on whole words only, so "overflow diagram" does not match "flow".
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

        return keywordTokens.every((token) => queryTokens.includes(token));
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
};
