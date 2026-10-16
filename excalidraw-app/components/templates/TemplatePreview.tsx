import { getCommonBounds } from "@excalidraw/excalidraw";

import React, { useMemo } from "react";

import type {
  Arrowhead,
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

const PREVIEW_PADDING = 24;
const ARROWHEAD_LENGTH = 22;
const ARROWHEAD_ANGLE = Math.PI / 7;
const STROKE_WIDTH = 1.5;
const LINE_HEIGHT = 1.25;

type Point = readonly [number, number];

const toFill = (color: string) =>
  !color || color === "transparent" ? "none" : color;

export const getArrowheadPoints = (
  tip: Point,
  from: Point,
): [Point, Point] | null => {
  const dx = tip[0] - from[0];
  const dy = tip[1] - from[1];

  if (dx === 0 && dy === 0) {
    return null;
  }

  const angle = Math.atan2(dy, dx);
  const wing = (offset: number): Point => [
    tip[0] - ARROWHEAD_LENGTH * Math.cos(angle + offset),
    tip[1] - ARROWHEAD_LENGTH * Math.sin(angle + offset),
  ];

  return [wing(ARROWHEAD_ANGLE), wing(-ARROWHEAD_ANGLE)];
};

const ArrowheadShape = ({
  tip,
  from,
  type,
  color,
}: {
  tip: Point;
  from: Point;
  type: Arrowhead;
  color: string;
}) => {
  const wings = getArrowheadPoints(tip, from);

  if (!wings) {
    return null;
  }

  const [left, right] = wings;
  const isFilled = type === "triangle" || type === "triangle_outline";

  return (
    <path
      className="TemplatePreview__arrowhead"
      d={`M ${left[0]} ${left[1]} L ${tip[0]} ${tip[1]} L ${right[0]} ${
        right[1]
      }${isFilled ? " Z" : ""}`}
      fill={type === "triangle" ? color : "none"}
    />
  );
};

const LinearShape = ({ element }: { element: ExcalidrawLinearElement }) => {
  const points: Point[] = element.points.map(([px, py]) => [
    element.x + px,
    element.y + py,
  ]);

  if (points.length < 2) {
    return null;
  }

  const isArrow = element.type === "arrow";
  const color = element.strokeColor;
  const last = points.length - 1;

  return (
    <g>
      <polyline points={points.map((point) => point.join(",")).join(" ")} />
      {isArrow && element.endArrowhead && (
        <ArrowheadShape
          tip={points[last]}
          from={points[last - 1]}
          type={element.endArrowhead}
          color={color}
        />
      )}
      {isArrow && element.startArrowhead && (
        <ArrowheadShape
          tip={points[0]}
          from={points[1]}
          type={element.startArrowhead}
          color={color}
        />
      )}
    </g>
  );
};

const TextShape = ({ element }: { element: ExcalidrawTextElement }) => {
  const lines = element.text.split("\n");
  const lineHeight = element.fontSize * LINE_HEIGHT;
  const blockHeight = lineHeight * lines.length;
  const x =
    element.textAlign === "center"
      ? element.x + element.width / 2
      : element.textAlign === "right"
      ? element.x + element.width
      : element.x;
  const top =
    element.verticalAlign === "middle"
      ? element.y + (element.height - blockHeight) / 2
      : element.verticalAlign === "bottom"
      ? element.y + element.height - blockHeight
      : element.y;
  const anchor =
    element.textAlign === "center"
      ? "middle"
      : element.textAlign === "right"
      ? "end"
      : "start";

  return (
    <text
      x={x}
      fontSize={element.fontSize}
      textAnchor={anchor}
      fill={element.strokeColor}
      stroke="none"
    >
      {lines.map((line, index) => (
        <tspan
          key={index}
          x={x}
          y={top + lineHeight * index + lineHeight / 2}
          dominantBaseline="central"
        >
          {line}
        </tspan>
      ))}
    </text>
  );
};

const PreviewShape = ({ element }: { element: ExcalidrawElement }) => {
  const { x, y, width, height } = element;
  const fill = toFill(element.backgroundColor);

  switch (element.type) {
    case "rectangle":
      return (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={element.roundness ? Math.min(width, height) * 0.12 : 0}
          fill={fill}
        />
      );
    case "ellipse":
      return (
        <ellipse
          cx={x + width / 2}
          cy={y + height / 2}
          rx={width / 2}
          ry={height / 2}
          fill={fill}
        />
      );
    case "diamond":
      return (
        <polygon
          points={[
            [x + width / 2, y],
            [x + width, y + height / 2],
            [x + width / 2, y + height],
            [x, y + height / 2],
          ]
            .map((point) => point.join(","))
            .join(" ")}
          fill={fill}
        />
      );
    case "line":
    case "arrow":
      return <LinearShape element={element} />;
    case "text":
      return <TextShape element={element} />;
    default:
      return null;
  }
};

export const TemplatePreview = ({
  elements,
  label,
}: {
  elements: readonly ExcalidrawElement[];
  label: string;
}) => {
  const visibleElements = useMemo(
    () => elements.filter((element) => !element.isDeleted),
    [elements],
  );
  const [minX, minY, maxX, maxY] = useMemo(
    () => getCommonBounds(visibleElements),
    [visibleElements],
  );

  return (
    <svg
      className="TemplatePreview"
      role="img"
      aria-label={label}
      viewBox={`${minX - PREVIEW_PADDING} ${minY - PREVIEW_PADDING} ${
        maxX - minX + PREVIEW_PADDING * 2
      } ${maxY - minY + PREVIEW_PADDING * 2}`}
      preserveAspectRatio="xMidYMid meet"
      fontFamily="Excalifont, Virgil, Segoe UI Emoji, sans-serif"
    >
      {visibleElements.map((element) => (
        <g
          key={element.id}
          stroke={element.strokeColor}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={element.opacity / 100}
        >
          <PreviewShape element={element} />
        </g>
      ))}
    </svg>
  );
};
