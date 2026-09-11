import { Dialog } from "@excalidraw/excalidraw/components/Dialog";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { STARTER_TEMPLATES, loadTemplateIntoScene } from "../data/templates";

import "./TemplatesDialog.scss";

import type { StarterTemplate } from "../data/templates";
import type { JSX } from "react";

const PREVIEW_PROPS = {
  viewBox: "0 0 160 100",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  className: "TemplatesDialog__card__preview",
  "aria-hidden": true,
} as const;

const strokeProps = {
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** hand-drawn-ish, purely decorative previews (not the real scene) */
const TEMPLATE_PREVIEWS: Record<string, JSX.Element> = {
  flowchart: (
    <svg {...PREVIEW_PROPS}>
      <rect x="60" y="8" width="40" height="18" rx="9" {...strokeProps} />
      <path d="M80 26v12" {...strokeProps} />
      <rect x="56" y="38" width="48" height="18" rx="3" {...strokeProps} />
      <path d="M80 56v8l-16 10 16 10 16-10-16-10" {...strokeProps} />
      <path d="M96 74h28" {...strokeProps} />
    </svg>
  ),
  "mind-map": (
    <svg {...PREVIEW_PROPS}>
      <ellipse cx="80" cy="50" rx="26" ry="14" {...strokeProps} />
      <path
        d="M54 44 28 28M54 56 28 72M106 44l26-16M106 56l26 16"
        {...strokeProps}
      />
      <rect x="6" y="18" width="24" height="14" rx="3" {...strokeProps} />
      <rect x="6" y="64" width="24" height="14" rx="3" {...strokeProps} />
      <rect x="130" y="18" width="24" height="14" rx="3" {...strokeProps} />
      <rect x="130" y="64" width="24" height="14" rx="3" {...strokeProps} />
    </svg>
  ),
  "kanban-board": (
    <svg {...PREVIEW_PROPS}>
      {[6, 44, 82, 120].map((x) => (
        <rect
          key={x}
          x={x}
          y="8"
          width="34"
          height="84"
          rx="4"
          {...strokeProps}
        />
      ))}
      <rect x="10" y="20" width="26" height="12" rx="2" {...strokeProps} />
      <rect x="10" y="38" width="26" height="12" rx="2" {...strokeProps} />
      <rect x="48" y="20" width="26" height="12" rx="2" {...strokeProps} />
      <rect x="86" y="20" width="26" height="12" rx="2" {...strokeProps} />
      <rect x="124" y="20" width="26" height="12" rx="2" {...strokeProps} />
      <rect x="124" y="38" width="26" height="12" rx="2" {...strokeProps} />
    </svg>
  ),
  "system-architecture": (
    <svg {...PREVIEW_PROPS}>
      <rect x="10" y="10" width="36" height="16" rx="3" {...strokeProps} />
      <rect x="62" y="10" width="36" height="16" rx="3" {...strokeProps} />
      <rect x="40" y="42" width="40" height="16" rx="3" {...strokeProps} />
      <rect x="100" y="42" width="46" height="16" rx="3" {...strokeProps} />
      <rect x="40" y="74" width="40" height="16" rx="3" {...strokeProps} />
      <path
        d="M28 26v16h12M80 26v16M80 50h20M60 58v16M120 58v16h-40"
        {...strokeProps}
      />
    </svg>
  ),
  wireframe: (
    <svg {...PREVIEW_PROPS}>
      <rect x="8" y="8" width="144" height="84" rx="4" {...strokeProps} />
      <path d="M8 24h144" {...strokeProps} />
      <rect x="18" y="32" width="60" height="10" rx="2" {...strokeProps} />
      <rect x="18" y="48" width="42" height="8" rx="2" {...strokeProps} />
      <rect x="18" y="64" width="30" height="12" rx="6" {...strokeProps} />
      <rect x="92" y="32" width="48" height="44" rx="3" {...strokeProps} />
    </svg>
  ),
  timeline: (
    <svg {...PREVIEW_PROPS}>
      <path d="M8 50h144" {...strokeProps} />
      {[32, 68, 104, 140].map((x) => (
        <circle key={x} cx={x} cy="50" r="5" {...strokeProps} />
      ))}
      <rect x="18" y="20" width="28" height="12" rx="2" {...strokeProps} />
      <rect x="54" y="68" width="28" height="12" rx="2" {...strokeProps} />
      <rect x="90" y="20" width="28" height="12" rx="2" {...strokeProps} />
      <rect x="126" y="68" width="28" height="12" rx="2" {...strokeProps} />
    </svg>
  ),
};

export const TemplatesDialog = ({
  excalidrawAPI,
  onCloseRequest,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
  onCloseRequest: () => void;
}) => {
  const onSelect = (template: StarterTemplate) => {
    loadTemplateIntoScene(excalidrawAPI, template);
    onCloseRequest();
  };

  return (
    <Dialog onCloseRequest={onCloseRequest} size="wide" title={false}>
      <div className="TemplatesDialog">
        <div className="TemplatesDialog__header">
          <h3>Start from a template</h3>
          <p>Pick a starter diagram to drop onto the canvas.</p>
        </div>
        <div className="TemplatesDialog__grid">
          {STARTER_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className="TemplatesDialog__card"
              onClick={() => onSelect(template)}
            >
              {TEMPLATE_PREVIEWS[template.id]}
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
