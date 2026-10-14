import { Dialog } from "@excalidraw/excalidraw/components/Dialog";

import React, { useMemo } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  loadTemplateIntoScene,
  parseTemplateElements,
  STARTER_TEMPLATES,
} from "../data/templates";

import { TemplatePreview } from "./templates/TemplatePreview";
import { TEMPLATES_STRINGS } from "./templates/templatesStrings";

import "./TemplatesDialog.scss";

import type { StarterTemplate } from "../data/templates";

export const TemplatesDialog = ({
  excalidrawAPI,
  onClose,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onClose: () => void;
}) => {
  const templates = useMemo(
    () =>
      STARTER_TEMPLATES.map((template) => ({
        template,
        elements: parseTemplateElements(template),
      })),
    [],
  );

  const onSelect = (template: StarterTemplate) => {
    if (excalidrawAPI) {
      loadTemplateIntoScene(excalidrawAPI, template);
    }
    onClose();
  };

  return (
    <Dialog onCloseRequest={onClose} size="wide" title={false}>
      <div className="TemplatesDialog">
        <h3 className="TemplatesDialog__title">
          {TEMPLATES_STRINGS.dialogTitle}
        </h3>
        <p className="TemplatesDialog__description">
          {TEMPLATES_STRINGS.dialogDescription}
        </p>
        <div className="TemplatesDialog__grid">
          {templates.map(({ template, elements }) => (
            <button
              key={template.id}
              type="button"
              className="TemplatesDialog__card"
              data-testid={`template-card-${template.id}`}
              onClick={() => onSelect(template)}
            >
              <div className="TemplatesDialog__preview">
                <TemplatePreview
                  elements={elements}
                  label={TEMPLATES_STRINGS.previewLabel(template.name)}
                />
              </div>
              <span className="TemplatesDialog__name">{template.name}</span>
              <span className="TemplatesDialog__cardDescription">
                {template.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
};
