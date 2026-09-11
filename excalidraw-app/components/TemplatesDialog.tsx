import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import React from "react";

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
  "aria-hidden": true,
} as const;

const TEMPLATE_PREVIEWS: Record<string, JSX.Element> = {
  flowchart: (
    <svg {...previewProps}>
      <rect x="58" y="8" width="44" height="18" rx="4" />
      <path d="M60 54 80 40l20 14-20 14z" />
      <rect x="16" y="76" width="40" height="16" rx="4" />
      <rect x="104" y="76" width="40" height="16" rx="4" />
      <path d="M80 26v14M68 64 36 76M92 64l32 12" />
    </svg>
  ),
  "mind-map": (
    <svg {...previewProps}>
      <ellipse cx="80" cy="50" rx="26" ry="14" />
      <rect x="8" y="14" width="34" height="14" rx="7" />
      <rect x="118" y="14" width="34" height="14" rx="7" />
      <rect x="8" y="72" width="34" height="14" rx="7" />
      <rect x="118" y="72" width="34" height="14" rx="7" />
      <path d="M56 43 42 26M104 43l14-17M56 58 42 76M104 58l14 18" />
    </svg>
  ),
  "kanban-board": (
    <svg {...previewProps}>
      <rect x="8" y="8" width="44" height="84" rx="4" />
      <rect x="58" y="8" width="44" height="84" rx="4" />
      <rect x="108" y="8" width="44" height="84" rx="4" />
      <path d="M8 26h44M58 26h44M108 26h44" />
      <rect x="15" y="34" width="30" height="14" rx="3" />
      <rect x="15" y="54" width="30" height="14" rx="3" />
      <rect x="65" y="34" width="30" height="14" rx="3" />
      <rect x="115" y="34" width="30" height="14" rx="3" />
    </svg>
  ),
  "system-architecture": (
    <svg {...previewProps}>
      <rect x="56" y="6" width="48" height="16" rx="4" />
      <rect x="56" y="38" width="48" height="16" rx="4" />
      <rect x="10" y="70" width="40" height="16" rx="4" />
      <rect x="110" y="70" width="40" height="16" rx="4" />
      <ellipse cx="80" cy="88" rx="22" ry="8" />
      <path d="M80 22v16M68 54 44 70M92 54l24 16" />
    </svg>
  ),
  timeline: (
    <svg {...previewProps}>
      <path d="M10 50h140" />
      <circle cx="34" cy="50" r="6" />
      <circle cx="72" cy="50" r="6" />
      <circle cx="110" cy="50" r="6" />
      <rect x="16" y="18" width="36" height="14" rx="3" />
      <rect x="54" y="68" width="36" height="14" rx="3" />
      <rect x="92" y="18" width="36" height="14" rx="3" />
    </svg>
  ),
  wireframe: (
    <svg {...previewProps}>
      <rect x="8" y="8" width="144" height="84" rx="5" />
      <path d="M8 24h144" />
      <circle cx="18" cy="16" r="2.5" />
      <circle cx="27" cy="16" r="2.5" />
      <rect x="18" y="34" width="124" height="24" rx="3" />
      <rect x="18" y="66" width="36" height="16" rx="3" />
      <rect x="62" y="66" width="36" height="16" rx="3" />
      <rect x="106" y="66" width="36" height="16" rx="3" />
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
