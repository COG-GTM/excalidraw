import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { parseTemplateElements, STARTER_TEMPLATES } from "../../data/templates";

import { getArrowheadPoints, TemplatePreview } from "./TemplatePreview";

const countMatches = (markup: string, pattern: RegExp) =>
  markup.match(pattern)?.length ?? 0;

describe("TemplatePreview", () => {
  it("draws an arrowhead for every arrow end", () => {
    for (const template of STARTER_TEMPLATES) {
      const elements = parseTemplateElements(template);
      const arrowheads = elements.reduce(
        (count, element) =>
          element.type === "arrow"
            ? count +
              (element.endArrowhead ? 1 : 0) +
              (element.startArrowhead ? 1 : 0)
            : count,
        0,
      );
      const markup = renderToStaticMarkup(
        <TemplatePreview elements={elements} label={template.name} />,
      );

      expect(countMatches(markup, /TemplatePreview__arrowhead/g)).toBe(
        arrowheads,
      );
    }
  });

  it("renders every shape and text label of a template", () => {
    const template = STARTER_TEMPLATES.find(({ id }) => id === "flowchart")!;
    const markup = renderToStaticMarkup(
      <TemplatePreview
        elements={parseTemplateElements(template)}
        label={template.name}
      />,
    );

    expect(countMatches(markup, /<rect /g)).toBe(3);
    expect(countMatches(markup, /<ellipse /g)).toBe(1);
    expect(countMatches(markup, /<polygon /g)).toBe(1);
    expect(markup).toContain("Details complete?");
  });

  it("points arrowhead wings back along the arrow direction", () => {
    const wings = getArrowheadPoints([100, 0], [0, 0]);

    expect(wings).not.toBeNull();
    for (const [x] of wings!) {
      expect(x).toBeLessThan(100);
    }
    expect(getArrowheadPoints([5, 5], [5, 5])).toBeNull();
  });
});
