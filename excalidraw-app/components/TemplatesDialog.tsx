import { exportToSvg } from "@excalidraw/excalidraw";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { COLOR_PALETTE } from "@excalidraw/common";
import { getNonDeletedElements } from "@excalidraw/element";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  STARTER_TEMPLATES,
  loadTemplateIntoScene,
  parseTemplateElements,
} from "../data/templates";

import "./TemplatesDialog.scss";

import type { StarterTemplate } from "../data/templates";

const previewCache = new Map<StarterTemplate["id"], Promise<SVGSVGElement>>();

const renderTemplatePreview = (template: StarterTemplate) => {
  let preview = previewCache.get(template.id);
  if (!preview) {
    preview = exportToSvg({
      elements: getNonDeletedElements(parseTemplateElements(template)),
      appState: {
        exportBackground: false,
        viewBackgroundColor: COLOR_PALETTE.white,
      },
      files: null,
      renderEmbeddables: false,
      skipInliningFonts: true,
    }).then((svg) => {
      svg.querySelector(".style-fonts")?.remove();
      return svg;
    });
    previewCache.set(template.id, preview);
  }
  return preview;
};

const TemplatePreview = ({ template }: { template: StarterTemplate }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    renderTemplatePreview(template).then((svg) => {
      const node = ref.current;
      if (cancelled || !node) {
        return;
      }
      node.replaceChildren(svg.cloneNode(true));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [template]);

  return (
    <div
      ref={ref}
      className={clsx("templates-dialog__preview", {
        "templates-dialog__preview--loading": !loaded,
      })}
      aria-hidden
    />
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
    if (!excalidrawAPI) {
      return;
    }
    loadTemplateIntoScene(excalidrawAPI, template);
    onClose();
  };

  return (
    <Dialog
      className="templates-dialog"
      size="wide"
      title="Start from a template"
      onCloseRequest={onClose}
    >
      <p className="templates-dialog__hint">
        Pick a starter layout and tweak it to your needs.
      </p>
      <div className="templates-dialog__grid">
        {STARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="templates-dialog__item"
            disabled={!excalidrawAPI}
            onClick={() => onSelect(template)}
          >
            <TemplatePreview template={template} />
            <div className="templates-dialog__item-name">{template.name}</div>
            <div className="templates-dialog__item-description">
              {template.description}
            </div>
          </button>
        ))}
      </div>
    </Dialog>
  );
};
TemplatesDialog.displayName = "TemplatesDialog";
