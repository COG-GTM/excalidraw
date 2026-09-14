import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import React from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  STARTER_TEMPLATES,
  loadTemplateIntoScene,
  type StarterTemplate,
} from "../data/templates";

import "./TemplatesDialog.scss";

const PREVIEW_VIEWBOX = "0 0 120 80";

const previewProps = {
  viewBox: PREVIEW_VIEWBOX,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const TEMPLATE_PREVIEWS: Record<string, React.JSX.Element> = {
  flowchart: (
    <svg {...previewProps}>
      <rect x="45" y="6" width="30" height="12" rx="6" />
      <line x1="60" y1="18" x2="60" y2="28" />
      <rect x="45" y="28" width="30" height="12" rx="2" />
      <line x1="60" y1="40" x2="60" y2="48" />
      <path d="M60 48 L76 58 L60 68 L44 58 Z" />
      <line x1="76" y1="58" x2="100" y2="58" />
      <rect x="100" y="52" width="16" height="12" rx="2" />
      <line x1="44" y1="58" x2="20" y2="58" />
      <rect x="4" y="52" width="16" height="12" rx="2" />
    </svg>
  ),
  "mind-map": (
    <svg {...previewProps}>
      <ellipse cx="60" cy="40" rx="18" ry="10" />
      <line x1="44" y1="34" x2="24" y2="16" />
      <line x1="76" y1="34" x2="96" y2="16" />
      <line x1="44" y1="46" x2="24" y2="64" />
      <line x1="76" y1="46" x2="96" y2="64" />
      <rect x="6" y="8" width="26" height="12" rx="6" />
      <rect x="88" y="8" width="26" height="12" rx="6" />
      <rect x="6" y="60" width="26" height="12" rx="6" />
      <rect x="88" y="60" width="26" height="12" rx="6" />
    </svg>
  ),
  "kanban-board": (
    <svg {...previewProps}>
      <rect x="6" y="6" width="32" height="68" rx="3" />
      <rect x="44" y="6" width="32" height="68" rx="3" />
      <rect x="82" y="6" width="32" height="68" rx="3" />
      <rect x="11" y="18" width="22" height="10" rx="2" />
      <rect x="11" y="32" width="22" height="10" rx="2" />
      <rect x="11" y="46" width="22" height="10" rx="2" />
      <rect x="49" y="18" width="22" height="10" rx="2" />
      <rect x="49" y="32" width="22" height="10" rx="2" />
      <rect x="87" y="18" width="22" height="10" rx="2" />
    </svg>
  ),
  "system-architecture": (
    <svg {...previewProps}>
      <rect x="6" y="32" width="20" height="16" rx="2" />
      <line x1="26" y1="40" x2="40" y2="40" />
      <rect x="40" y="32" width="20" height="16" rx="8" />
      <line x1="60" y1="40" x2="74" y2="22" />
      <line x1="60" y1="40" x2="74" y2="58" />
      <rect x="74" y="14" width="20" height="16" rx="2" />
      <rect x="74" y="50" width="20" height="16" rx="2" />
      <line x1="94" y1="22" x2="104" y2="40" />
      <line x1="94" y1="58" x2="104" y2="40" />
      <ellipse cx="108" cy="34" rx="7" ry="3" />
      <path d="M101 34 V46 A7 3 0 0 0 115 46 V34" />
    </svg>
  ),
  timeline: (
    <svg {...previewProps}>
      <line x1="6" y1="44" x2="114" y2="44" />
      <circle cx="22" cy="44" r="4" />
      <circle cx="47" cy="44" r="4" />
      <circle cx="72" cy="44" r="4" />
      <circle cx="97" cy="44" r="4" />
      <rect x="10" y="16" width="24" height="12" rx="2" />
      <rect x="35" y="56" width="24" height="12" rx="2" />
      <rect x="60" y="16" width="24" height="12" rx="2" />
      <rect x="85" y="56" width="24" height="12" rx="2" />
    </svg>
  ),
  wireframe: (
    <svg {...previewProps}>
      <rect x="6" y="6" width="108" height="68" rx="3" />
      <line x1="6" y1="18" x2="114" y2="18" />
      <circle cx="14" cy="12" r="3" />
      <line x1="80" y1="12" x2="108" y2="12" />
      <rect x="14" y="26" width="92" height="18" rx="2" />
      <rect x="14" y="50" width="26" height="16" rx="2" />
      <rect x="47" y="50" width="26" height="16" rx="2" />
      <rect x="80" y="50" width="26" height="16" rx="2" />
    </svg>
  ),
};

const TemplateCard = ({
  template,
  onSelect,
}: {
  template: StarterTemplate;
  onSelect: (template: StarterTemplate) => void;
}) => {
  return (
    <button
      type="button"
      className="TemplatesDialog__card"
      onClick={() => onSelect(template)}
      data-testid={`template-card-${template.id}`}
    >
      <div className="TemplatesDialog__preview">
        {TEMPLATE_PREVIEWS[template.id] ?? (
          <svg {...previewProps}>
            <rect x="6" y="6" width="108" height="68" rx="3" />
          </svg>
        )}
      </div>
      <div className="TemplatesDialog__name">{template.name}</div>
      <div className="TemplatesDialog__description">{template.description}</div>
    </button>
  );
};

export const TemplatesDialog = ({
  excalidrawAPI,
  onCloseRequest,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
  onCloseRequest: () => void;
}) => {
  const onSelect = (template: StarterTemplate) => {
    trackEvent("splash", "templates.select", template.id);
    loadTemplateIntoScene(excalidrawAPI, template);
    onCloseRequest();
  };

  return (
    <Dialog
      onCloseRequest={onCloseRequest}
      size="wide"
      title="Start from a template"
      className="TemplatesDialog"
    >
      <p className="TemplatesDialog__intro">
        Pick a starting point. You can change anything afterwards.
      </p>
      <div className="TemplatesDialog__grid">
        {STARTER_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={onSelect}
          />
        ))}
      </div>
    </Dialog>
  );
};
