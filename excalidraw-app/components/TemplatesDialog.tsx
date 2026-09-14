import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  STARTER_TEMPLATES,
  loadTemplateIntoScene,
} from "../data/templates/index";

import "./TemplatesDialog.scss";

import type { StarterTemplate } from "../data/templates/index";

const PREVIEW_WIDTH = 160;
const PREVIEW_HEIGHT = 100;

const previewProps = {
  viewBox: `0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`,
  className: "TemplatesDialog__preview",
  "aria-hidden": true,
  focusable: "false",
} as const;

const FlowchartPreview = () => (
  <svg {...previewProps}>
    <rect x="60" y="6" width="40" height="16" rx="8" />
    <path d="M80 22v10" />
    <rect x="58" y="32" width="44" height="16" rx="2" />
    <path d="M80 48v8" />
    <path d="M80 56l16 12-16 12-16-12z" />
    <path d="M96 68h30v-12" />
    <rect x="106" y="40" width="34" height="16" rx="2" />
    <path d="M80 80v10" />
    <rect x="60" y="88" width="40" height="10" rx="5" />
  </svg>
);

const MindMapPreview = () => (
  <svg {...previewProps}>
    <ellipse cx="80" cy="50" rx="24" ry="13" />
    <path d="M60 42c-14-4-22-14-32-18" />
    <path d="M60 58c-14 4-22 14-32 18" />
    <path d="M100 42c14-4 22-14 32-18" />
    <path d="M100 58c14 4 22 14 32 18" />
    <rect x="8" y="14" width="26" height="12" rx="6" />
    <rect x="8" y="72" width="26" height="12" rx="6" />
    <rect x="126" y="14" width="26" height="12" rx="6" />
    <rect x="126" y="72" width="26" height="12" rx="6" />
    <path d="M34 20h14M34 78h14M112 20h14M112 78h14" />
  </svg>
);

const KanbanBoardPreview = () => (
  <svg {...previewProps}>
    <rect x="8" y="8" width="42" height="84" rx="3" />
    <rect x="59" y="8" width="42" height="84" rx="3" />
    <rect x="110" y="8" width="42" height="84" rx="3" />
    <path d="M14 18h30M65 18h30M116 18h30" />
    <rect x="13" y="26" width="32" height="12" rx="2" />
    <rect x="13" y="42" width="32" height="12" rx="2" />
    <rect x="13" y="58" width="32" height="12" rx="2" />
    <rect x="64" y="26" width="32" height="12" rx="2" />
    <rect x="64" y="42" width="32" height="12" rx="2" />
    <rect x="115" y="26" width="32" height="12" rx="2" />
  </svg>
);

const SystemArchitecturePreview = () => (
  <svg {...previewProps}>
    <rect x="8" y="40" width="28" height="20" rx="2" />
    <path d="M36 50h14" />
    <rect x="50" y="40" width="26" height="20" rx="10" />
    <path d="M76 50l12-24M76 50h12M76 50l12 24" />
    <rect x="88" y="16" width="28" height="18" rx="2" />
    <rect x="88" y="41" width="28" height="18" rx="2" />
    <rect x="88" y="66" width="28" height="18" rx="2" />
    <path d="M116 25h14v10M116 50h14M116 75h14v-10" />
    <ellipse cx="140" cy="36" rx="10" ry="3" />
    <path d="M130 36v10c0 2 4 3 10 3s10-1 10-3v-10" />
    <rect x="130" y="60" width="20" height="12" rx="2" />
    <path d="M135 60v12M140 60v12M145 60v12" />
  </svg>
);

const TimelinePreview = () => (
  <svg {...previewProps}>
    <path d="M8 56h144" />
    <path d="M144 50l8 6-8 6" />
    <circle cx="28" cy="56" r="4" />
    <circle cx="64" cy="56" r="4" />
    <circle cx="100" cy="56" r="4" />
    <circle cx="136" cy="56" r="4" />
    <path d="M28 52v-14M64 60v14M100 52v-14M136 60v14" />
    <rect x="14" y="20" width="28" height="18" rx="2" />
    <rect x="50" y="74" width="28" height="18" rx="2" />
    <rect x="86" y="20" width="28" height="18" rx="2" />
    <rect x="122" y="74" width="28" height="18" rx="2" />
  </svg>
);

const WireframePreview = () => (
  <svg {...previewProps}>
    <rect x="8" y="6" width="144" height="88" rx="3" />
    <path d="M8 20h144" />
    <circle cx="18" cy="13" r="3" />
    <path d="M110 13h10M124 13h10M138 13h10" />
    <rect x="16" y="28" width="128" height="22" rx="2" />
    <path d="M24 36h50M24 42h36" />
    <rect x="16" y="56" width="38" height="24" rx="2" />
    <rect x="61" y="56" width="38" height="24" rx="2" />
    <rect x="106" y="56" width="38" height="24" rx="2" />
    <path d="M8 86h144" />
  </svg>
);

const TEMPLATE_PREVIEWS: Record<string, () => React.JSX.Element> = {
  flowchart: FlowchartPreview,
  "mind-map": MindMapPreview,
  "kanban-board": KanbanBoardPreview,
  "system-architecture": SystemArchitecturePreview,
  timeline: TimelinePreview,
  wireframe: WireframePreview,
};

const FallbackPreview = () => (
  <svg {...previewProps}>
    <rect x="20" y="16" width="120" height="68" rx="4" />
  </svg>
);

const TemplateCard = ({
  template,
  onSelect,
}: {
  template: StarterTemplate;
  onSelect: (template: StarterTemplate) => void;
}) => {
  const Preview = TEMPLATE_PREVIEWS[template.id] ?? FallbackPreview;
  return (
    <button
      type="button"
      className="TemplatesDialog__card"
      onClick={() => onSelect(template)}
      aria-label={`${template.name}: ${template.description}`}
    >
      <div className="TemplatesDialog__card-preview">
        <Preview />
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
  onClose,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onClose: () => void;
}) => {
  const handleSelect = (template: StarterTemplate) => {
    if (!excalidrawAPI) {
      return;
    }
    try {
      loadTemplateIntoScene(excalidrawAPI, template);
      trackEvent("splash", "template", template.id);
      onClose();
    } catch (error: any) {
      console.error(error);
      excalidrawAPI.setToast({
        message: `Could not load template "${template.name}": ${
          error?.message ?? "unknown error"
        }`,
        closable: true,
      });
    }
  };

  return (
    <Dialog
      onCloseRequest={onClose}
      title="Start from a template"
      size="wide"
      className="TemplatesDialog"
    >
      <p className="TemplatesDialog__hint">
        Pick a starting point. You can edit everything afterwards.
      </p>
      <div className="TemplatesDialog__grid" role="list">
        {STARTER_TEMPLATES.map((template) => (
          <div role="listitem" key={template.id}>
            <TemplateCard template={template} onSelect={handleSelect} />
          </div>
        ))}
      </div>
      <div className="TemplatesDialog__footer">
        <FilledButton
          variant="outlined"
          color="muted"
          size="large"
          label="Blank canvas"
          onClick={onClose}
        />
      </div>
    </Dialog>
  );
};
