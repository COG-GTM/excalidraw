import { CaptureUpdateAction, restoreElements } from "@excalidraw/excalidraw";
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
  /** lowercase keywords used for keyword routing (e.g. the launcher input) */
  keywords: readonly string[];
  /** raw `.excalidraw` JSON */
  source: string;
};

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    id: "flowchart",
    name: "Flowchart",
    description: "Start → steps → decision → end",
    keywords: ["flowchart", "flow", "process", "decision"],
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
    keywords: ["kanban", "board", "tasks", "sprint", "todo"],
    source: kanbanBoard,
  },
  {
    id: "system-architecture",
    name: "System architecture",
    description: "Clients, gateway, services, database, queue",
    keywords: ["architecture", "system", "infra", "services", "backend"],
    source: systemArchitecture,
  },
  {
    id: "wireframe",
    name: "Landing page wireframe",
    description: "Header, hero, CTA and feature cards",
    keywords: ["wireframe", "landing", "page", "mockup", "ui"],
    source: wireframe,
  },
  {
    id: "timeline",
    name: "Project timeline",
    description: "Milestones along a horizontal axis",
    keywords: ["timeline", "roadmap", "milestones", "schedule"],
    source: timeline,
  },
];

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** true when `keyword` appears in `words` as a whole word (or whole-word phrase) */
const hasKeyword = (words: readonly string[], keyword: string) => {
  const parts = tokenize(keyword);
  if (!parts.length || parts.length > words.length) {
    return false;
  }
  return words.some((_, i) => parts.every((part, j) => words[i + j] === part));
};

/**
 * Matches a template by exact id / name, or by any keyword appearing as a
 * whole word in the query ("overflow" does not match "flow").
 */
export const findTemplateByKeyword = (
  query: string,
): StarterTemplate | null => {
  const q = query.trim().toLowerCase();
  if (!q) {
    return null;
  }
  const words = tokenize(q);
  return (
    STARTER_TEMPLATES.find(
      (template) =>
        template.id === q ||
        template.name.toLowerCase() === q ||
        template.keywords.some((keyword) => hasKeyword(words, keyword)),
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
 * Replaces the current (empty) scene with the template's elements and fits
 * them into the viewport.
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
