import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import React from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { STARTER_TEMPLATES, loadTemplateIntoScene } from "../data/templates";

import "./TemplatesDialog.scss";

import type { StarterTemplate } from "../data/templates";

const previewProps = {
  viewBox: "0 0 160 100",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: "false",
} as const;

const TEMPLATE_PREVIEWS: Record<string, React.ReactElement> = {
  flowchart: (
    <svg {...previewProps}>
      <rect x="12" y="38" width="34" height="22" rx="11" />
      <path d="M48 49 L66 49" />
      <path d="M62 45 L66 49 L62 53" />
      <path d="M84 30 L104 49 L84 68 L64 49 Z" />
      <path d="M105 49 L120 49" />
      <path d="M116 45 L120 49 L116 53" />
      <rect x="122" y="38" width="28" height="22" rx="11" />
      <path d="M84 69 L84 86 L46 86 L46 62" />
      <path d="M42 66 L46 62 L50 66" />
    </svg>
  ),
  "mind-map": (
    <svg {...previewProps}>
      <ellipse cx="80" cy="50" rx="24" ry="14" />
      <path d="M58 44 C 44 40, 40 32, 30 26" />
      <rect x="10" y="16" width="26" height="14" rx="4" />
      <path d="M58 56 C 44 60, 40 68, 30 74" />
      <rect x="10" y="70" width="26" height="14" rx="4" />
      <path d="M102 44 C 116 40, 120 32, 130 26" />
      <rect x="124" y="16" width="26" height="14" rx="4" />
      <path d="M102 56 C 116 60, 120 68, 130 74" />
      <rect x="124" y="70" width="26" height="14" rx="4" />
    </svg>
  ),
  "kanban-board": (
    <svg {...previewProps}>
      <rect x="10" y="12" width="40" height="76" rx="4" />
      <rect x="60" y="12" width="40" height="76" rx="4" />
      <rect x="110" y="12" width="40" height="76" rx="4" />
      <path d="M16 22 L44 22 M66 22 L94 22 M116 22 L144 22" />
      <rect x="16" y="30" width="28" height="12" rx="2" />
      <rect x="16" y="48" width="28" height="12" rx="2" />
      <rect x="16" y="66" width="28" height="12" rx="2" />
      <rect x="66" y="30" width="28" height="12" rx="2" />
      <rect x="66" y="48" width="28" height="12" rx="2" />
      <rect x="116" y="30" width="28" height="12" rx="2" />
    </svg>
  ),
  "system-architecture": (
    <svg {...previewProps}>
      <rect x="8" y="16" width="26" height="18" rx="3" />
      <rect x="8" y="66" width="26" height="18" rx="3" />
      <path d="M34 25 L52 45 M34 75 L52 55" />
      <rect x="52" y="40" width="24" height="20" rx="3" />
      <path d="M76 50 L92 50" />
      <path d="M88 46 L92 50 L88 54" />
      <rect x="92" y="28" width="26" height="18" rx="3" />
      <rect x="92" y="54" width="26" height="18" rx="3" />
      <path d="M118 37 L134 44 M118 63 L134 56" />
      <ellipse cx="140" cy="42" rx="8" ry="3" />
      <path d="M132 42 L132 60 A 8 3 0 0 0 148 60 L148 42" />
    </svg>
  ),
  timeline: (
    <svg {...previewProps}>
      <path d="M10 56 L150 56" />
      <path d="M144 52 L150 56 L144 60" />
      <circle cx="30" cy="56" r="4" />
      <circle cx="65" cy="56" r="4" />
      <circle cx="100" cy="56" r="4" />
      <circle cx="132" cy="56" r="4" />
      <path d="M30 52 L30 40 M65 60 L65 72 M100 52 L100 40 M132 60 L132 72" />
      <rect x="16" y="22" width="28" height="18" rx="3" />
      <rect x="51" y="72" width="28" height="18" rx="3" />
      <rect x="86" y="22" width="28" height="18" rx="3" />
      <rect x="118" y="72" width="28" height="18" rx="3" />
    </svg>
  ),
  wireframe: (
    <svg {...previewProps}>
      <rect x="10" y="10" width="140" height="80" rx="4" />
      <path d="M10 24 L150 24" />
      <circle cx="20" cy="17" r="3" />
      <path d="M110 17 L124 17 M130 17 L142 17" />
      <rect x="18" y="32" width="124" height="22" rx="3" />
      <path d="M26 40 L70 40 M26 46 L56 46" />
      <rect x="18" y="60" width="38" height="22" rx="3" />
      <rect x="61" y="60" width="38" height="22" rx="3" />
      <rect x="104" y="60" width="38" height="22" rx="3" />
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
      aria-label={`${template.name}: ${template.description}`}
    >
      <div className="TemplatesDialog__card-preview">
        {TEMPLATE_PREVIEWS[template.id] ?? null}
      </div>
      <div className="TemplatesDialog__card-name">{template.name}</div>
      <div className="TemplatesDialog__card-description">
        {template.description}
      </div>
    </button>
  );
};

export const TemplatesDialog = ({
  excalidrawAPI,
  onCloseRequest,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onCloseRequest: () => void;
}) => {
  const onSelect = (template: StarterTemplate) => {
    if (excalidrawAPI) {
      trackEvent("splash", "template", template.id);
      loadTemplateIntoScene(excalidrawAPI, template);
    }
    onCloseRequest();
  };

  return (
    <Dialog
      onCloseRequest={onCloseRequest}
      size="wide"
      title="Start from a template"
      className="TemplatesDialog"
    >
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
