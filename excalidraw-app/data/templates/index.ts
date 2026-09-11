import { getCommonBounds } from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";

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

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    id: "flowchart",
    name: "Flowchart",
    description: "Process steps with a decision and a revision loop.",
    keywords: ["flowchart", "flow", "process", "decision"],
    source: flowchart,
  },
  {
    id: "mind-map",
    name: "Mind map",
    description: "A central idea branching out into four themes.",
    keywords: ["mindmap", "mind", "map", "brainstorm", "ideas"],
    source: mindMap,
  },
  {
    id: "kanban-board",
    name: "Kanban board",
    description: "To do / in progress / done columns with cards.",
    keywords: ["kanban", "board", "backlog", "sprint", "tasks"],
    source: kanbanBoard,
  },
  {
    id: "system-architecture",
    name: "System architecture",
    description: "Client, gateway, services and their datastores.",
    keywords: ["architecture", "system", "services", "infrastructure"],
    source: systemArchitecture,
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "Four milestones along a project timeline.",
    keywords: ["timeline", "roadmap", "milestones", "schedule"],
    source: timeline,
  },
  {
    id: "wireframe",
    name: "Wireframe",
    description: "A landing page layout with hero and feature cards.",
    keywords: ["wireframe", "mockup", "layout", "landing", "ui"],
    source: wireframe,
  },
];

export const parseTemplateElements = (
  template: StarterTemplate,
): ExcalidrawElement[] => {
  const scene = JSON.parse(template.source) as { elements: unknown };

  return restoreElements(scene.elements as ExcalidrawElement[], null, {
    refreshDimensions: false,
    repairBindings: true,
  });
};

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter(Boolean);

/**
 * Matches a typed query against template ids, names and keywords. Keywords
 * match whole words only, so "overflow diagram" does not match "flow".
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

  const words = new Set(tokenize(normalized));

  return (
    STARTER_TEMPLATES.find((template) =>
      template.keywords.some((keyword) =>
        tokenize(keyword).every((word) => words.has(word)),
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
