import { Dialog } from "@excalidraw/excalidraw/components/Dialog";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { STARTER_TEMPLATES, loadTemplateIntoScene } from "../data/templates";

import "./TemplatesDialog.scss";

import type { StarterTemplate } from "../data/templates";
import type { JSX } from "react";

const previewProps = {
  viewBox: "0 0 160 100",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const TEMPLATE_PREVIEWS: Record<string, JSX.Element> = {
  flowchart: (
    <svg {...previewProps}>
      <rect x="60" y="8" width="40" height="18" rx="4" />
      <path d="M80 26v12" />
      <path d="M80 38l18 12-18 12-18-12z" />
      <path d="M62 50H30v26" />
      <path d="M98 50h32v26" />
      <rect x="10" y="76" width="40" height="16" rx="4" />
      <rect x="110" y="76" width="40" height="16" rx="4" />
    </svg>
  ),
  "mind-map": (
    <svg {...previewProps}>
      <ellipse cx="80" cy="50" rx="26" ry="14" />
      <path d="M54 44L24 26M54 56L24 76M106 44l30-18M106 56l30 20" />
      <rect x="4" y="16" width="26" height="14" rx="7" />
      <rect x="4" y="68" width="26" height="14" rx="7" />
      <rect x="130" y="16" width="26" height="14" rx="7" />
      <rect x="130" y="68" width="26" height="14" rx="7" />
    </svg>
  ),
  "kanban-board": (
    <svg {...previewProps}>
      <rect x="8" y="8" width="42" height="84" rx="4" />
      <rect x="59" y="8" width="42" height="84" rx="4" />
      <rect x="110" y="8" width="42" height="84" rx="4" />
      <rect x="14" y="20" width="30" height="14" rx="3" />
      <rect x="14" y="40" width="30" height="14" rx="3" />
      <rect x="65" y="20" width="30" height="14" rx="3" />
      <rect x="116" y="20" width="30" height="14" rx="3" />
    </svg>
  ),
  "system-architecture": (
    <svg {...previewProps}>
      <rect x="12" y="10" width="34" height="16" rx="4" />
      <rect x="114" y="10" width="34" height="16" rx="4" />
      <rect x="56" y="42" width="48" height="18" rx="4" />
      <path d="M29 26v16h27M131 26v16h-27" />
      <path d="M80 60v10" />
      <ellipse cx="80" cy="76" rx="24" ry="6" />
      <path d="M56 76v10c0 3 11 6 24 6s24-3 24-6V76" />
    </svg>
  ),
  timeline: (
    <svg {...previewProps}>
      <path d="M10 60h140" />
      <circle cx="34" cy="60" r="5" />
      <circle cx="70" cy="60" r="5" />
      <circle cx="106" cy="60" r="5" />
      <circle cx="142" cy="60" r="5" />
      <path d="M34 55V34M70 65v18M106 55V34M142 65v18" />
      <rect x="18" y="16" width="32" height="14" rx="3" />
      <rect x="90" y="16" width="32" height="14" rx="3" />
    </svg>
  ),
  wireframe: (
    <svg {...previewProps}>
      <rect x="8" y="8" width="144" height="84" rx="4" />
      <path d="M8 24h144" />
      <rect x="18" y="32" width="60" height="10" rx="3" />
      <rect x="18" y="48" width="44" height="6" rx="3" />
      <rect x="96" y="32" width="46" height="26" rx="3" />
      <rect x="18" y="68" width="36" height="16" rx="3" />
      <rect x="62" y="68" width="36" height="16" rx="3" />
      <rect x="106" y="68" width="36" height="16" rx="3" />
    </svg>
  ),
};

export const TemplatesDialog = ({
  excalidrawAPI,
  onClose,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
  onClose: () => void;
}) => {
  const onSelect = (template: StarterTemplate) => {
    loadTemplateIntoScene(excalidrawAPI, template);
    onClose();
  };

  return (
    <Dialog onCloseRequest={onClose} title="Start from a template" size="wide">
      <div className="TemplatesDialog">
        <p className="TemplatesDialog__description">
          Pick a starter scene to drop onto the canvas. You can edit everything
          afterwards.
        </p>
        <div className="TemplatesDialog__grid">
          {STARTER_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className="TemplatesDialog__card"
              data-testid={`template-${template.id}`}
              onClick={() => onSelect(template)}
            >
              <div className="TemplatesDialog__card__preview">
                {TEMPLATE_PREVIEWS[template.id]}
              </div>
              <div className="TemplatesDialog__card__name">{template.name}</div>
              <div className="TemplatesDialog__card__description">
                {template.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
};
