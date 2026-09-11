import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import React from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { STARTER_TEMPLATES, loadTemplateIntoScene } from "../data/templates";

import "./TemplatesDialog.scss";

import type { StarterTemplate } from "../data/templates";

const previews: Record<string, React.ReactNode> = {
  flowchart: (
    <>
      <rect x="42" y="6" width="36" height="18" rx="3" />
      <rect x="42" y="38" width="36" height="18" rx="3" />
      <path d="M60 24v14" />
      <path d="M60 56l14 14-14 14-14-14z" />
      <rect x="6" y="84" width="36" height="18" rx="3" />
      <rect x="78" y="84" width="36" height="18" rx="3" />
      <path d="M46 70H24v14" />
      <path d="M74 70h22v14" />
    </>
  ),
  "mind-map": (
    <>
      <circle cx="60" cy="54" r="16" />
      <path d="M44 54H16M76 54h28M60 38V14M60 70v24" />
      <rect x="2" y="44" width="26" height="18" rx="9" />
      <rect x="92" y="44" width="26" height="18" rx="9" />
      <rect x="47" y="2" width="26" height="16" rx="8" />
      <rect x="47" y="90" width="26" height="16" rx="8" />
    </>
  ),
  "kanban-board": (
    <>
      <rect x="4" y="6" width="32" height="96" rx="4" />
      <rect x="44" y="6" width="32" height="96" rx="4" />
      <rect x="84" y="6" width="32" height="96" rx="4" />
      <rect x="10" y="22" width="20" height="14" rx="2" />
      <rect x="10" y="42" width="20" height="14" rx="2" />
      <rect x="50" y="22" width="20" height="14" rx="2" />
      <rect x="90" y="22" width="20" height="14" rx="2" />
      <rect x="90" y="42" width="20" height="14" rx="2" />
    </>
  ),
  "system-architecture": (
    <>
      <rect x="42" y="4" width="36" height="16" rx="3" />
      <rect x="42" y="34" width="36" height="16" rx="3" />
      <path d="M60 20v14M60 50v10M60 60H24v10M60 60h36v10" />
      <rect x="6" y="70" width="36" height="16" rx="3" />
      <rect x="78" y="70" width="36" height="16" rx="3" />
      <ellipse cx="24" cy="98" rx="12" ry="6" />
      <ellipse cx="96" cy="98" rx="12" ry="6" />
      <path d="M24 86v6M96 86v6" />
    </>
  ),
  timeline: (
    <>
      <path d="M8 54h104" />
      <circle cx="24" cy="54" r="6" />
      <circle cx="52" cy="54" r="6" />
      <circle cx="80" cy="54" r="6" />
      <circle cx="106" cy="54" r="6" />
      <rect x="10" y="18" width="28" height="16" rx="3" />
      <rect x="38" y="74" width="28" height="16" rx="3" />
      <rect x="66" y="18" width="28" height="16" rx="3" />
      <rect x="92" y="74" width="26" height="16" rx="3" />
    </>
  ),
  wireframe: (
    <>
      <rect x="6" y="4" width="108" height="14" rx="3" />
      <rect x="6" y="26" width="108" height="34" rx="3" />
      <path d="M40 38h40M46 48h28" />
      <rect x="6" y="68" width="32" height="34" rx="3" />
      <rect x="44" y="68" width="32" height="34" rx="3" />
      <rect x="82" y="68" width="32" height="34" rx="3" />
    </>
  ),
};

const TemplatePreview: React.FC<{ templateId: string }> = ({ templateId }) => (
  <svg
    className="TemplatesDialog__preview"
    viewBox="0 0 120 106"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {previews[templateId]}
  </svg>
);

export const TemplatesDialog: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onClose: () => void;
}> = ({ excalidrawAPI, onClose }) => {
  const onSelect = (template: StarterTemplate) => {
    if (excalidrawAPI) {
      loadTemplateIntoScene(excalidrawAPI, template);
    }
    onClose();
  };

  return (
    <Dialog size="wide" onCloseRequest={onClose} title="Start from a template">
      <div className="TemplatesDialog">
        <div className="TemplatesDialog__grid">
          {STARTER_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className="TemplatesDialog__card"
              onClick={() => onSelect(template)}
            >
              <TemplatePreview templateId={template.id} />
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
