import React, { useRef } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { vi } from "vitest";

import { useOutsideClick } from "./useOutsideClick";

type IsInside = Parameters<typeof useOutsideClick>[2];

const Harness = ({
  callback,
  isInside,
}: {
  callback: (event: Event) => void;
  isInside?: IsInside;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, callback, isInside);
  return (
    <div>
      <div ref={ref} data-testid="container">
        <button data-testid="child">child</button>
      </div>
      <button data-testid="sibling">sibling</button>
      <div data-prevent-outside-click>
        <button data-testid="prevent-outside">prevent</button>
      </div>
      <div data-radix-portal>
        <button data-testid="radix-portal">portal</button>
      </div>
    </div>
  );
};

describe("useOutsideClick", () => {
  afterEach(() => {
    cleanup();
    document.body.style.pointerEvents = "";
    vi.restoreAllMocks();
  });

  it("calls callback on pointerdown outside the container", () => {
    const callback = vi.fn();
    const { getByTestId } = render(<Harness callback={callback} />);

    const sibling = getByTestId("sibling");
    fireEvent.pointerDown(sibling);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].target).toBe(sibling);
  });

  it("calls callback on touchstart outside the container", () => {
    const callback = vi.fn();
    const { getByTestId } = render(<Harness callback={callback} />);

    fireEvent.touchStart(getByTestId("sibling"));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("ignores pointerdown on the container and its descendants", () => {
    const callback = vi.fn();
    const { getByTestId } = render(<Harness callback={callback} />);

    fireEvent.pointerDown(getByTestId("container"));
    fireEvent.pointerDown(getByTestId("child"));

    expect(callback).not.toHaveBeenCalled();
  });

  it("ignores targets inside [data-prevent-outside-click]", () => {
    const callback = vi.fn();
    const { getByTestId } = render(<Harness callback={callback} />);

    fireEvent.pointerDown(getByTestId("prevent-outside"));

    expect(callback).not.toHaveBeenCalled();
  });

  it("ignores targets inside [data-radix-portal]", () => {
    const callback = vi.fn();
    const { getByTestId } = render(<Harness callback={callback} />);

    fireEvent.pointerDown(getByTestId("radix-portal"));

    expect(callback).not.toHaveBeenCalled();
  });

  it("ignores <html> target while a modal radix popup disables body pointer events", () => {
    const callback = vi.fn();
    render(<Harness callback={callback} />);

    document.body.style.pointerEvents = "none";
    fireEvent.pointerDown(document.documentElement);
    expect(callback).not.toHaveBeenCalled();

    document.body.style.pointerEvents = "";
    fireEvent.pointerDown(document.documentElement);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("ignores targets detached from the DOM during dispatch", () => {
    const callback = vi.fn();
    const { getByTestId } = render(<Harness callback={callback} />);

    const sibling = getByTestId("sibling");
    sibling.addEventListener("pointerdown", () => sibling.remove());
    fireEvent.pointerDown(sibling);

    expect(sibling.isConnected).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });

  it("isInside returning true suppresses callback for outside targets", () => {
    const callback = vi.fn();
    const isInside = vi.fn(() => true);
    const { getByTestId } = render(
      <Harness callback={callback} isInside={isInside} />,
    );

    const sibling = getByTestId("sibling");
    fireEvent.pointerDown(sibling);

    expect(isInside).toHaveBeenCalledTimes(1);
    expect(isInside).toHaveBeenCalledWith(
      expect.objectContaining({ target: sibling }),
      getByTestId("container"),
    );
    expect(callback).not.toHaveBeenCalled();
  });

  it("isInside returning false calls callback even for ignored targets", () => {
    const callback = vi.fn();
    const isInside = vi.fn(() => false);
    const { getByTestId } = render(
      <Harness callback={callback} isInside={isInside} />,
    );

    fireEvent.pointerDown(getByTestId("child"));
    fireEvent.pointerDown(getByTestId("prevent-outside"));
    fireEvent.pointerDown(getByTestId("radix-portal"));

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("isInside returning undefined falls back to default behavior", () => {
    const callback = vi.fn();
    const isInside = vi.fn(() => undefined);
    const { getByTestId } = render(
      <Harness callback={callback} isInside={isInside} />,
    );

    fireEvent.pointerDown(getByTestId("child"));
    expect(callback).not.toHaveBeenCalled();

    fireEvent.pointerDown(getByTestId("sibling"));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(isInside).toHaveBeenCalledTimes(2);
  });

  it("does not subscribe when the ref is not attached", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");
    const callback = vi.fn();
    const Unattached = () => {
      const ref = useRef<HTMLDivElement>(null);
      useOutsideClick(ref, callback);
      return null;
    };
    render(<Unattached />);

    expect(addEventListener).not.toHaveBeenCalledWith(
      "pointerdown",
      expect.any(Function),
    );
    fireEvent.pointerDown(document.body);
    expect(callback).not.toHaveBeenCalled();
  });

  it("removes document listeners on unmount", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");
    const removeEventListener = vi.spyOn(document, "removeEventListener");
    const callback = vi.fn();
    const { getByTestId, unmount } = render(<Harness callback={callback} />);

    const pointerDownHandler = addEventListener.mock.calls.find(
      ([type]) => type === "pointerdown",
    )?.[1];
    const touchStartHandler = addEventListener.mock.calls.find(
      ([type]) => type === "touchstart",
    )?.[1];
    expect(pointerDownHandler).toBeDefined();
    expect(touchStartHandler).toBe(pointerDownHandler);

    const sibling = getByTestId("sibling");
    unmount();

    expect(removeEventListener).toHaveBeenCalledWith(
      "pointerdown",
      pointerDownHandler,
    );
    expect(removeEventListener).toHaveBeenCalledWith(
      "touchstart",
      touchStartHandler,
    );

    document.body.append(sibling);
    fireEvent.pointerDown(sibling);
    sibling.remove();
    expect(callback).not.toHaveBeenCalled();
  });

  it("listens on the container's ownerDocument", () => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const ownerDocument = iframe.contentDocument!;
    const mountNode = ownerDocument.createElement("div");
    ownerDocument.body.append(mountNode);

    try {
      const callback = vi.fn();
      render(<Harness callback={callback} />, {
        container: mountNode,
        baseElement: ownerDocument.body,
      });

      fireEvent.pointerDown(document.body);
      expect(callback).not.toHaveBeenCalled();

      const sibling = mountNode.querySelector('[data-testid="sibling"]')!;
      fireEvent.pointerDown(sibling);
      expect(callback).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
      iframe.remove();
    }
  });
});
