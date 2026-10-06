import { getCommonBounds } from "@excalidraw/excalidraw";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";

import React, { useMemo } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { parseTemplateElements, STARTER_TEMPLATES } from "../data/templates";

import "./TemplatesDialog.scss";

import type { StarterTemplate } from "../data/templates";

export const STRINGS = {
  menuItem: "Start from a template",
  dialogTitle: "Start from a template",
  subtitle: "Pick a starter layout. You can edit everything afterwards.",
  ariaLabel: (name: string) => `Use the ${name} template`,
} as const;

const PREVIEW_PADDING = 24;

const getFill = (backgroundColor: string) =>
  backgroundColor === "transparent" ? "none" : backgroundColor;

const TemplatePreview: React.FC<{ template: StarterTemplate }> = ({
  template,
}) => {
  const { elements, viewBox } = useMemo(() => {
    const elements = parseTemplateElements(template).filter(
      (element) => !element.isDeleted,
    );
    const [minX, minY, maxX, maxY] = getCommonBounds(elements);

    return {
      elements,
      viewBox: [
        minX - PREVIEW_PADDING,
        minY - PREVIEW_PADDING,
        maxX - minX + PREVIEW_PADDING * 2,
        maxY - minY + PREVIEW_PADDING * 2,
      ].join(" "),
    };
  }, [template]);

  const renderElement = (element: ExcalidrawElement) => {
    const fill = getFill(element.backgroundColor);
    const stroke = element.strokeColor;

    switch (element.type) {
      case "rectangle":
        return (
          <rect
            key={element.id}
            x={element.x}
            y={element.y}
            width={element.width}
            height={element.height}
            rx={8}
            fill={fill}
            stroke={stroke}
            strokeWidth={element.strokeWidth}
          />
        );
      case "diamond":
        return (
          <polygon
            key={element.id}
            points={`${element.x + element.width / 2},${element.y} ${
              element.x + element.width
            },${element.y + element.height / 2} ${
              element.x + element.width / 2
            },${element.y + element.height} ${element.x},${
              element.y + element.height / 2
            }`}
            fill={fill}
            stroke={stroke}
            strokeWidth={element.strokeWidth}
          />
        );
      case "ellipse":
        return (
          <ellipse
            key={element.id}
            cx={element.x + element.width / 2}
            cy={element.y + element.height / 2}
            rx={element.width / 2}
            ry={element.height / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={element.strokeWidth}
          />
        );
      case "line":
      case "arrow":
        return (
          <polyline
            key={element.id}
            points={element.points
              .map(([x, y]) => `${element.x + x},${element.y + y}`)
              .join(" ")}
            fill="none"
            stroke={stroke}
            strokeWidth={element.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      case "text": {
        const lines = element.text.split("\n");
        const textAnchor =
          element.textAlign === "center"
            ? "middle"
            : element.textAlign === "right"
            ? "end"
            : "start";
        const x =
          element.textAlign === "center"
            ? element.x + element.width / 2
            : element.textAlign === "right"
            ? element.x + element.width
            : element.x;
        const y =
          element.verticalAlign === "middle"
            ? element.y +
              (element.height -
                lines.length * element.fontSize * element.lineHeight) /
                2 +
              element.fontSize
            : element.y + element.fontSize;

        return (
          <text
            key={element.id}
            x={x}
            y={y}
            fill={stroke}
            fontSize={element.fontSize}
            textAnchor={textAnchor}
          >
            {lines.map((line, index) => (
              <tspan
                key={`${element.id}-${index}`}
                x={x}
                dy={index === 0 ? 0 : element.fontSize * element.lineHeight}
              >
                {line}
              </tspan>
            ))}
          </text>
        );
      }
      default:
        return null;
    }
  };

  return (
    <svg
      aria-hidden="true"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
    >
      {elements.map(renderElement)}
    </svg>
  );
};

export const TemplatesDialog: React.FC<{
  onClose: () => void;
  onSelect: (template: StarterTemplate) => void;
}> = ({ onClose, onSelect }) => (
  <Dialog
    size="wide"
    title={STRINGS.dialogTitle}
    onCloseRequest={onClose}
    className="TemplatesDialog"
  >
    <div className="TemplatesDialog__content">
      <p className="TemplatesDialog__subtitle">{STRINGS.subtitle}</p>
      <div className="TemplatesDialog__grid">
        {STARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="TemplatesDialog__card"
            aria-label={STRINGS.ariaLabel(template.name)}
            onClick={() => onSelect(template)}
          >
            <div className="TemplatesDialog__preview">
              <TemplatePreview template={template} />
            </div>
            <h3 className="TemplatesDialog__name">{template.name}</h3>
            <p className="TemplatesDialog__description">
              {template.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  </Dialog>
);
