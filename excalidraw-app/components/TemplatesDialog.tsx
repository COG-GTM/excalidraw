import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { STARTER_TEMPLATES, loadTemplateIntoScene } from "../data/templates";

import "./TemplatesDialog.scss";

import type { StarterTemplate } from "../data/templates";

const PREVIEW_VIEWBOX = "0 0 160 100";

const previews: Record<string, React.ReactNode> = {
  flowchart: (
    <>
      <rect x="60" y="6" width="40" height="14" rx="7" />
      <line x1="80" y1="20" x2="80" y2="30" />
      <rect x="60" y="30" width="40" height="14" />
      <line x1="80" y1="44" x2="80" y2="54" />
      <polygon points="80,54 100,66 80,78 60,66" />
      <line x1="60" y1="66" x2="30" y2="66" />
      <line x1="100" y1="66" x2="130" y2="66" />
      <rect x="10" y="80" width="40" height="14" />
      <rect x="110" y="80" width="40" height="14" />
      <line x1="30" y1="66" x2="30" y2="80" />
      <line x1="130" y1="66" x2="130" y2="80" />
    </>
  ),
  "mind-map": (
    <>
      <ellipse cx="80" cy="50" rx="24" ry="12" />
      <line x1="60" y1="44" x2="30" y2="22" />
      <line x1="100" y1="44" x2="130" y2="22" />
      <line x1="60" y1="56" x2="30" y2="78" />
      <line x1="100" y1="56" x2="130" y2="78" />
      <rect x="10" y="14" width="36" height="14" rx="7" />
      <rect x="114" y="14" width="36" height="14" rx="7" />
      <rect x="10" y="72" width="36" height="14" rx="7" />
      <rect x="114" y="72" width="36" height="14" rx="7" />
    </>
  ),
  "kanban-board": (
    <>
      <rect x="8" y="8" width="42" height="84" rx="3" />
      <rect x="59" y="8" width="42" height="84" rx="3" />
      <rect x="110" y="8" width="42" height="84" rx="3" />
      <rect x="14" y="22" width="30" height="12" rx="2" />
      <rect x="14" y="40" width="30" height="12" rx="2" />
      <rect x="14" y="58" width="30" height="12" rx="2" />
      <rect x="65" y="22" width="30" height="12" rx="2" />
      <rect x="65" y="40" width="30" height="12" rx="2" />
      <rect x="116" y="22" width="30" height="12" rx="2" />
      <line x1="8" y1="17" x2="50" y2="17" />
      <line x1="59" y1="17" x2="101" y2="17" />
      <line x1="110" y1="17" x2="152" y2="17" />
    </>
  ),
  "system-architecture": (
    <>
      <rect x="8" y="42" width="26" height="16" rx="3" />
      <line x1="34" y1="50" x2="52" y2="50" />
      <rect x="52" y="42" width="26" height="16" rx="8" />
      <line x1="78" y1="50" x2="96" y2="30" />
      <line x1="78" y1="50" x2="96" y2="70" />
      <rect x="96" y="22" width="26" height="16" rx="3" />
      <rect x="96" y="62" width="26" height="16" rx="3" />
      <line x1="122" y1="30" x2="136" y2="40" />
      <line x1="122" y1="70" x2="136" y2="60" />
      <ellipse cx="144" cy="40" rx="8" ry="4" />
      <path d="M136 40 v14 a8 4 0 0 0 16 0 v-14" />
      <path d="M136 60 v14 a8 4 0 0 0 16 0 v-14" />
      <ellipse cx="144" cy="60" rx="8" ry="4" />
    </>
  ),
  timeline: (
    <>
      <line x1="8" y1="50" x2="152" y2="50" />
      <circle cx="28" cy="50" r="4" />
      <circle cx="64" cy="50" r="4" />
      <circle cx="100" cy="50" r="4" />
      <circle cx="136" cy="50" r="4" />
      <rect x="14" y="18" width="28" height="12" rx="2" />
      <rect x="50" y="70" width="28" height="12" rx="2" />
      <rect x="86" y="18" width="28" height="12" rx="2" />
      <rect x="122" y="70" width="28" height="12" rx="2" />
      <line x1="28" y1="30" x2="28" y2="46" />
      <line x1="64" y1="54" x2="64" y2="70" />
      <line x1="100" y1="30" x2="100" y2="46" />
      <line x1="136" y1="54" x2="136" y2="70" />
    </>
  ),
  wireframe: (
    <>
      <rect x="8" y="6" width="144" height="12" rx="2" />
      <rect x="8" y="24" width="144" height="34" rx="2" />
      <rect x="62" y="44" width="36" height="9" rx="4" />
      <rect x="8" y="66" width="44" height="28" rx="2" />
      <rect x="58" y="66" width="44" height="28" rx="2" />
      <rect x="108" y="66" width="44" height="28" rx="2" />
    </>
  ),
};

const TemplatePreview = ({ template }: { template: StarterTemplate }) => (
  <svg
    className="TemplatesDialog__preview"
    viewBox={PREVIEW_VIEWBOX}
    role="img"
    aria-label={`${template.name} preview`}
  >
    {previews[template.id] ?? <rect x="20" y="20" width="120" height="60" />}
  </svg>
);

export const TemplatesDialog = ({
  excalidrawAPI,
  onCloseRequest,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
  onCloseRequest: () => void;
}) => {
  const onSelect = (template: StarterTemplate) => {
    trackEvent("splash", "template", template.id);
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
      <p className="TemplatesDialog__hint">
        Pick a starter diagram. You can edit everything afterwards.
      </p>
      <div className="TemplatesDialog__grid">
        {STARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="TemplatesDialog__card"
            onClick={() => onSelect(template)}
          >
            <TemplatePreview template={template} />
            <div className="TemplatesDialog__card-name">{template.name}</div>
            <div className="TemplatesDialog__card-description">
              {template.description}
            </div>
          </button>
        ))}
      </div>
      <div className="TemplatesDialog__actions">
        <FilledButton
          size="large"
          variant="outlined"
          label="Cancel"
          onClick={onCloseRequest}
        />
      </div>
    </Dialog>
  );
};
