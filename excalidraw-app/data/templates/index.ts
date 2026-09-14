import { CaptureUpdateAction, getCommonBounds } from "@excalidraw/excalidraw";
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
    description: "Start, steps, a decision and an end state.",
    keywords: ["flowchart", "flow", "process", "decision", "steps"],
    source: flowchart,
  },
  {
    id: "mind-map",
    name: "Mind map",
    description: "A central idea with branches and leaves.",
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
    description: "Client, load balancer, services, database and queue.",
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
    keywords: ["timeline", "roadmap", "milestones", "schedule", "quarters"],
    source: timeline,
  },
  {
    id: "wireframe",
    name: "Wireframe",
    description: "Landing page skeleton: header, hero, cards, footer.",
    keywords: [
      "wireframe",
      "mockup",
      "landing page",
      "website",
      "ui",
      "layout",
    ],
    source: wireframe,
  },
];

export const parseTemplateElements = (
  template: StarterTemplate,
): OrderedExcalidrawElement[] => {
  const data = JSON.parse(template.source) as { elements?: unknown };
  const elements = Array.isArray(data.elements) ? data.elements : [];
  return restoreElements(elements, null, { repairBindings: true });
};

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * Matches a free-text query against a template by exact id/name or by a
 * whole-word keyword match, so e.g. "overflow diagram" does not match "flow".
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
    if (!keywordTokens.length || keywordTokens.length > queryTokens.length) {
      return false;
    }
    return queryTokens.some(
      (_, index) =>
        index + keywordTokens.length <= queryTokens.length &&
        keywordTokens.every(
          (token, offset) => queryTokens[index + offset] === token,
        ),
    );
  };

  let best: { template: StarterTemplate; score: number } | null = null;
  for (const template of STARTER_TEMPLATES) {
    for (const keyword of template.keywords) {
      const keywordTokens = tokenize(keyword);
      if (containsPhrase(keywordTokens)) {
        const score = keywordTokens.length;
        if (!best || score > best.score) {
          best = { template, score };
        }
      }
    }
  }
  return best?.template ?? null;
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
