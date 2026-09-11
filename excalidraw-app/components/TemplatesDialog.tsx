import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import React from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { STARTER_TEMPLATES, loadTemplateIntoScene } from "../data/templates";

import "./TemplatesDialog.scss";

import type { StarterTemplate } from "../data/templates";

const previewProps = {
  viewBox: "0 0 160 100",
  className: "TemplatesDialog__preview",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const TEMPLATE_PREVIEWS: Record<string, React.ReactNode> = {
  flowchart: (
    <svg {...previewProps}>
      <rect x="60" y="8" width="40" height="16" rx="8" />
      <path d="M80 24v12" />
      <rect x="58" y="36" width="44" height="18" />
      <path d="M80 54v8l-30 8" />
      <path d="M80 62l30 8" />
      <rect x="20" y="70" width="40" height="18" />
      <rect x="100" y="70" width="40" height="18" />
    </svg>
  ),
  "mind-map": (
    <svg {...previewProps}>
      <circle cx="80" cy="50" r="16" />
      <path d="M64 44L30 26M96 44l34-18M64 56L30 74M96 56l34 18" />
      <rect x="6" y="18" width="26" height="14" rx="3" />
      <rect x="128" y="18" width="26" height="14" rx="3" />
      <rect x="6" y="66" width="26" height="14" rx="3" />
      <rect x="128" y="66" width="26" height="14" rx="3" />
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
      <rect x="8" y="40" width="32" height="20" rx="3" />
      <path d="M40 50h20" />
      <rect x="60" y="40" width="32" height="20" rx="3" />
      <path d="M92 50h20M92 50l20-26M92 50l20 26" />
      <rect x="112" y="14" width="40" height="18" rx="3" />
      <rect x="112" y="41" width="40" height="18" rx="3" />
      <ellipse cx="132" cy="74" rx="20" ry="6" />
      <path d="M112 74v12c0 3.3 9 6 20 6s20-2.7 20-6V74" />
    </svg>
  ),
  timeline: (
    <svg {...previewProps}>
      <path d="M8 60h144" />
      <circle cx="32" cy="60" r="5" />
      <circle cx="72" cy="60" r="5" />
      <circle cx="112" cy="60" r="5" />
      <path d="M32 55V34M72 55V22M112 55V34" />
      <rect x="14" y="20" width="36" height="14" rx="3" />
      <rect x="54" y="8" width="36" height="14" rx="3" />
      <rect x="94" y="20" width="36" height="14" rx="3" />
    </svg>
  ),
  wireframe: (
    <svg {...previewProps}>
      <rect x="8" y="8" width="144" height="84" rx="4" />
      <path d="M8 26h144M44 26v66" />
      <rect x="16" y="34" width="20" height="6" rx="2" />
      <rect x="16" y="48" width="20" height="6" rx="2" />
      <rect x="16" y="62" width="20" height="6" rx="2" />
      <rect x="54" y="34" width="42" height="24" rx="3" />
      <rect x="102" y="34" width="42" height="24" rx="3" />
      <rect x="54" y="66" width="90" height="18" rx="3" />
    </svg>
  ),
};

export const TemplatesDialog: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI;
  onClose: () => void;
}> = ({ excalidrawAPI, onClose }) => {
  const onSelect = (template: StarterTemplate) => {
    loadTemplateIntoScene(excalidrawAPI, template);
    onClose();
  };

  return (
    <Dialog size="wide" onCloseRequest={onClose} title="Start from a template">
      <div className="TemplatesDialog">
        <p className="TemplatesDialog__intro">
          Pick a starter scene to drop onto the canvas. You can edit everything
          afterwards.
        </p>
        <div className="TemplatesDialog__grid">
          {STARTER_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className="TemplatesDialog__card"
              onClick={() => onSelect(template)}
            >
              {TEMPLATE_PREVIEWS[template.id]}
              <div className="TemplatesDialog__name">{template.name}</div>
              <div className="TemplatesDialog__description">
                {template.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
};
