import {
  CaptureUpdateAction,
  getCommonBounds,
  restoreElements,
} from "@excalidraw/excalidraw";

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
  /** lowercase keywords used for keyword routing (whole-word match) */
  keywords: readonly string[];
  /** raw `.excalidraw` JSON */
  source: string;
};

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    id: "flowchart",
    name: "Flowchart",
    description: "Start, steps, a decision and an end",
    keywords: ["flowchart", "flow", "process", "decision", "steps"],
    source: flowchart,
  },
  {
    id: "mind-map",
    name: "Mind map",
    description: "Central idea with branching topics",
    keywords: ["mind map", "mindmap", "brainstorm", "ideas"],
    source: mindMap,
  },
  {
    id: "kanban-board",
    name: "Kanban board",
    description: "To do / In progress / Review / Done",
    keywords: ["kanban", "board", "tasks", "sprint", "todo", "backlog"],
    source: kanbanBoard,
  },
  {
    id: "system-architecture",
    name: "System architecture",
    description: "Clients, gateway, services, database and queue",
    keywords: ["architecture", "system", "infra", "services", "backend"],
    source: systemArchitecture,
  },
  {
    id: "timeline",
    name: "Project timeline",
    description: "Milestones along a horizontal axis",
    keywords: ["timeline", "roadmap", "milestones", "schedule", "plan"],
    source: timeline,
  },
  {
    id: "wireframe",
    name: "Landing page wireframe",
    description: "Header, hero, call to action and feature cards",
    keywords: ["wireframe", "landing", "page", "mockup", "ui", "website"],
    source: wireframe,
  },
];

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** true when every token of `keyword` appears consecutively in `words` */
const containsKeyword = (words: readonly string[], keyword: string) => {
  const parts = tokenize(keyword);
  if (!parts.length || parts.length > words.length) {
    return false;
  }
  return words.some((_, i) => parts.every((part, j) => words[i + j] === part));
};

/**
 * Matches a template by exact id / name or by any keyword appearing as a
 * whole word in the query (so "overflow diagram" does not match "flow").
 */
export const findTemplateByKeyword = (
  query: string,
): StarterTemplate | null => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const words = tokenize(normalized);
  return (
    STARTER_TEMPLATES.find(
      (template) =>
        template.id === normalized ||
        template.name.toLowerCase() === normalized ||
        template.keywords.some((keyword) => containsKeyword(words, keyword)),
    ) ?? null
  );
};

export const parseTemplateElements = (
  template: StarterTemplate,
): ExcalidrawElement[] => {
  const data = JSON.parse(template.source) as {
    elements?: readonly ExcalidrawElement[];
  };
  return restoreElements(data.elements ?? [], null, {
    refreshDimensions: true,
    repairBindings: true,
  });
};

/**
 * Replaces the current scene with the template's elements and fits them into
 * the viewport.
 */
export const loadTemplateIntoScene = (
  excalidrawAPI: ExcalidrawImperativeAPI,
  template: StarterTemplate,
) => {
  const elements = parseTemplateElements(template);

  excalidrawAPI.updateScene({
    elements,
    appState: { selectedElementIds: {} },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  excalidrawAPI.setViewport({
    target: getCommonBounds(elements),
    fit: "scale-down",
    animation: false,
  });

  return elements;
};
