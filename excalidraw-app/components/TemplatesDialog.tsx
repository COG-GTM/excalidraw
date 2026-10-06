import { getCommonBounds } from "@excalidraw/excalidraw";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import React, { useMemo } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  STARTER_TEMPLATES,
  loadTemplateIntoScene,
  parseTemplateElements,
} from "../data/templates";

import "./TemplatesDialog.scss";

import type { StarterTemplate } from "../data/templates";

const PREVIEW_PADDING = 20;

const fillOf = (element: ExcalidrawElement) =>
  element.backgroundColor === "transparent" ? "none" : element.backgroundColor;

const PreviewShape = ({ element }: { element: ExcalidrawElement }) => {
  const { x, y, width, height, strokeColor } = element;
  const common = {
    stroke: strokeColor,
    strokeWidth: 2,
    fill: fillOf(element),
    opacity: element.opacity / 100,
  };

  switch (element.type) {
    case "rectangle":
      return (
        <rect
          {...common}
          x={x}
          y={y}
          width={width}
          height={height}
          rx={element.roundness ? Math.min(width, height) * 0.15 : 0}
        />
      );
    case "ellipse":
      return (
        <ellipse
          {...common}
          cx={x + width / 2}
          cy={y + height / 2}
          rx={width / 2}
          ry={height / 2}
        />
      );
    case "diamond":
      return (
        <polygon
          {...common}
          points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${
            x + width / 2
          },${y + height} ${x},${y + height / 2}`}
        />
      );
    case "line":
    case "arrow":
      return (
        <polyline
          {...common}
          fill="none"
          points={element.points
            .map(([px, py]) => `${x + px},${y + py}`)
            .join(" ")}
        />
      );
    case "text":
      // text is unreadable at thumbnail size; draw a placeholder bar instead
      return (
        <rect
          x={x + width * 0.1}
          y={y + height * 0.3}
          width={width * 0.8}
          height={height * 0.4}
          rx={height * 0.2}
          fill={strokeColor}
          opacity={0.35}
        />
      );
    default:
      return null;
  }
};

const TemplatePreview = ({ template }: { template: StarterTemplate }) => {
  const elements = useMemo(() => parseTemplateElements(template), [template]);
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);

  return (
    <svg
      className="TemplatesDialog__preview"
      viewBox={`${minX - PREVIEW_PADDING} ${minY - PREVIEW_PADDING} ${
        maxX - minX + PREVIEW_PADDING * 2
      } ${maxY - minY + PREVIEW_PADDING * 2}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {elements.map((element) => (
        <PreviewShape key={element.id} element={element} />
      ))}
    </svg>
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
    onCloseRequest();
    loadTemplateIntoScene(excalidrawAPI, template);
  };

  return (
    <Dialog
      onCloseRequest={onCloseRequest}
      size="wide"
      title="Start from a template"
      className="TemplatesDialog"
    >
      <ul className="TemplatesDialog__grid">
        {STARTER_TEMPLATES.map((template) => (
          <li key={template.id}>
            <button
              type="button"
              className="TemplatesDialog__card"
              onClick={() => onSelect(template)}
              aria-label={`${template.name}: ${template.description}`}
              data-testid={`template-card-${template.id}`}
            >
              <TemplatePreview template={template} />
              <span className="TemplatesDialog__name">{template.name}</span>
              <span className="TemplatesDialog__description">
                {template.description}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
};
