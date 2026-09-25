import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import React from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { loadTemplateIntoScene, STARTER_TEMPLATES } from "../data/templates";

import "./TemplatesDialog.scss";

import type { StarterTemplate } from "../data/templates";

const PREVIEW_WIDTH = 160;
const PREVIEW_HEIGHT = 100;

type PreviewProps = { arrow: string };

const FlowchartPreview = ({ arrow }: PreviewProps) => (
  <>
    <rect x="60" y="8" width="40" height="16" rx="8" />
    <path d="M80 24v10" markerEnd={arrow} />
    <path d="M80 36l18 12l-18 12l-18 -12z" />
    <path d="M62 48h-22" markerEnd={arrow} />
    <path d="M98 48h22" markerEnd={arrow} />
    <rect x="10" y="66" width="36" height="18" rx="2" />
    <rect x="114" y="66" width="36" height="18" rx="2" />
    <path d="M28 66v-18" />
    <path d="M132 66v-18" />
  </>
);

const MindMapPreview = () => (
  <>
    <ellipse cx="80" cy="50" rx="22" ry="12" />
    <path d="M62 42L30 22" />
    <path d="M98 42L130 22" />
    <path d="M62 58L30 78" />
    <path d="M98 58L130 78" />
    <rect x="8" y="14" width="30" height="14" rx="7" />
    <rect x="122" y="14" width="30" height="14" rx="7" />
    <rect x="8" y="72" width="30" height="14" rx="7" />
    <rect x="122" y="72" width="30" height="14" rx="7" />
  </>
);

const KanbanPreview = () => (
  <>
    <rect x="8" y="8" width="32" height="84" rx="3" />
    <rect x="46" y="8" width="32" height="84" rx="3" />
    <rect x="84" y="8" width="32" height="84" rx="3" />
    <rect x="122" y="8" width="32" height="84" rx="3" />
    <rect x="13" y="24" width="22" height="12" rx="2" className="fill" />
    <rect x="13" y="42" width="22" height="12" rx="2" className="fill" />
    <rect x="13" y="60" width="22" height="12" rx="2" className="fill" />
    <rect x="51" y="24" width="22" height="12" rx="2" className="fill" />
    <rect x="51" y="42" width="22" height="12" rx="2" className="fill" />
    <rect x="89" y="24" width="22" height="12" rx="2" className="fill" />
    <rect x="127" y="24" width="22" height="12" rx="2" className="fill" />
    <rect x="127" y="42" width="22" height="12" rx="2" className="fill" />
  </>
);

const SystemArchitecturePreview = ({ arrow }: PreviewProps) => (
  <>
    <rect x="8" y="12" width="26" height="18" rx="2" />
    <rect x="8" y="70" width="26" height="18" rx="2" />
    <rect x="58" y="41" width="30" height="18" rx="9" />
    <path d="M34 21L58 46" markerEnd={arrow} />
    <path d="M34 79L58 54" markerEnd={arrow} />
    <rect x="108" y="14" width="30" height="16" rx="2" />
    <rect x="108" y="66" width="30" height="16" rx="2" />
    <path d="M88 46L108 24" markerEnd={arrow} />
    <path d="M88 54L108 72" markerEnd={arrow} />
    <ellipse cx="150" cy="22" rx="6" ry="3" />
    <path d="M144 22v10a6 3 0 0 0 12 0v-10" />
    <path d="M144 76h12M144 80h12" />
  </>
);

const TimelinePreview = ({ arrow }: PreviewProps) => (
  <>
    <path d="M10 50h140" markerEnd={arrow} />
    <circle cx="28" cy="50" r="4" className="fill" />
    <circle cx="56" cy="50" r="4" className="fill" />
    <circle cx="84" cy="50" r="4" className="fill" />
    <circle cx="112" cy="50" r="4" className="fill" />
    <circle cx="140" cy="50" r="4" className="fill" />
    <rect x="14" y="20" width="28" height="12" rx="2" />
    <rect x="42" y="68" width="28" height="12" rx="2" />
    <rect x="70" y="20" width="28" height="12" rx="2" />
    <rect x="98" y="68" width="28" height="12" rx="2" />
    <rect x="126" y="20" width="28" height="12" rx="2" />
  </>
);

const WireframePreview = () => (
  <>
    <rect x="8" y="8" width="144" height="84" rx="3" />
    <path d="M8 22h144" />
    <circle cx="18" cy="15" r="3" />
    <path d="M110 15h10M124 15h10M138 15h10" />
    <rect x="18" y="30" width="60" height="8" rx="2" className="fill" />
    <rect x="18" y="42" width="44" height="5" rx="2" />
    <rect x="18" y="52" width="24" height="8" rx="4" className="fill" />
    <path d="M96 30h46v32h-46zM96 62l18-16l14 10l14-8" />
    <rect x="18" y="70" width="38" height="16" rx="2" />
    <rect x="61" y="70" width="38" height="16" rx="2" />
    <rect x="104" y="70" width="38" height="16" rx="2" />
  </>
);

const TEMPLATE_PREVIEWS: Record<string, React.FC<PreviewProps>> = {
  flowchart: FlowchartPreview,
  "mind-map": MindMapPreview,
  "kanban-board": KanbanPreview,
  "system-architecture": SystemArchitecturePreview,
  timeline: TimelinePreview,
  wireframe: WireframePreview,
};

const TemplatePreview = ({ template }: { template: StarterTemplate }) => {
  const Preview = TEMPLATE_PREVIEWS[template.id];
  const markerId = `templates-arrow-${template.id}`;
  return (
    <svg
      className="TemplatesDialog__preview"
      viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10z" className="fill" />
        </marker>
      </defs>
      {Preview && <Preview arrow={`url(#${markerId})`} />}
    </svg>
  );
};

export const TemplatesDialog = ({
  excalidrawAPI,
  onClose,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onClose: () => void;
}) => {
  const onSelect = (template: StarterTemplate) => {
    if (excalidrawAPI) {
      trackEvent("templates", "load", template.id);
      loadTemplateIntoScene(excalidrawAPI, template);
    }
    onClose();
  };

  return (
    <Dialog
      onCloseRequest={onClose}
      title="Start from a template"
      size="wide"
      className="TemplatesDialog"
    >
      <p className="TemplatesDialog__hint">
        Pick a starting point and make it your own. You can always tweak, move
        or delete anything once it is on the canvas.
      </p>
      <div className="TemplatesDialog__grid">
        {STARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="TemplatesDialog__card"
            onClick={() => onSelect(template)}
            aria-label={`${template.name}: ${template.description}`}
          >
            <TemplatePreview template={template} />
            <div className="TemplatesDialog__card-name">{template.name}</div>
            <div className="TemplatesDialog__card-description">
              {template.description}
            </div>
          </button>
        ))}
      </div>
    </Dialog>
  );
};
