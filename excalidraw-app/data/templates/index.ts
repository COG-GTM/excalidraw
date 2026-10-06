import { CaptureUpdateAction, getCommonBounds } from "@excalidraw/excalidraw";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import flowchart from "./flowchart.excalidraw?raw";
import kanbanBoard from "./kanban-board.excalidraw?raw";
import mindMap from "./mind-map.excalidraw?raw";
import systemArchitecture from "./system-architecture.excalidraw?raw";
import timeline from "./timeline.excalidraw?raw";
import wireframe from "./wireframe.excalidraw?raw";

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  source: string;
}

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    id: "flowchart",
    name: "Flowchart",
    description: "Map a process from the first step to the final outcome.",
    keywords: ["flowchart", "flow", "process"],
    source: flowchart,
  },
  {
    id: "mind-map",
    name: "Mind Map",
    description:
      "Collect ideas around a central topic and explore connections.",
    keywords: ["mind map", "mindmap", "brainstorm", "ideas"],
    source: mindMap,
  },
  {
    id: "kanban-board",
    name: "Kanban Board",
    description: "Organize work by status from to do through completion.",
    keywords: ["kanban", "board", "tasks", "todo"],
    source: kanbanBoard,
  },
  {
    id: "system-architecture",
    name: "System Architecture",
    description: "Show how clients, services, and infrastructure connect.",
    keywords: ["architecture", "system", "infrastructure", "services"],
    source: systemArchitecture,
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "Plan milestones across a clear quarterly roadmap.",
    keywords: ["timeline", "roadmap", "schedule", "milestones"],
    source: timeline,
  },
  {
    id: "wireframe",
    name: "Wireframe",
    description: "Sketch a dashboard layout with navigation and content.",
    keywords: ["wireframe", "mockup", "ui", "layout"],
    source: wireframe,
  },
];

export const parseTemplateElements = (template: StarterTemplate) => {
  const data = JSON.parse(template.source) as {
    elements: ExcalidrawElement[];
  };

  return restoreElements(data.elements, null);
};

const tokenize = (value: string) =>
  value.toLowerCase().match(/[a-z0-9]+/g) ?? [];

const containsTokens = (tokens: string[], queryTokens: string[]) =>
  queryTokens.some((_, index) =>
    tokens.every((token, offset) => queryTokens[index + offset] === token),
  );

export const findTemplateByKeyword = (
  query: string,
): StarterTemplate | null => {
  const normalizedQuery = query.trim().toLowerCase();
  const exactMatch = STARTER_TEMPLATES.find(
    (template) =>
      template.id === normalizedQuery ||
      template.name.toLowerCase() === normalizedQuery,
  );

  if (exactMatch) {
    return exactMatch;
  }

  const queryTokens = tokenize(query);

  return (
    STARTER_TEMPLATES.find((template) =>
      template.keywords.some((keyword) =>
        containsTokens(tokenize(keyword), queryTokens),
      ),
    ) ?? null
  );
};

export const loadTemplateIntoScene = (
  api: ExcalidrawImperativeAPI,
  template: StarterTemplate,
) => {
  const elements = parseTemplateElements(template);

  api.updateScene({
    elements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.setViewport({
    target: getCommonBounds(elements),
    fit: "scale-down",
  });
};
