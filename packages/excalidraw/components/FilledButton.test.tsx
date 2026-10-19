import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { vi } from "vitest";

import { AbortError } from "../errors";

import { FilledButton } from "./FilledButton";

const LOADING_DELAY = 50;

const createDeferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// React discards the promise returned from DOM event handlers, so to assert
// whether `_onClick` rejects we invoke the handler React attached directly.
const invokeReactOnClick = (button: HTMLElement): Promise<void> => {
  const propsKey = Object.keys(button).find((key) =>
    key.startsWith("__reactProps$"),
  );
  if (!propsKey) {
    throw new Error("React props not found on element");
  }
  const props = (button as any)[propsKey];
  return props.onClick({} as React.MouseEvent);
};

const isLoading = (button: HTMLElement) =>
  button.classList.contains("ExcButton--status-loading") &&
  !!button.querySelector(".Spinner");

describe("FilledButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls a synchronous onClick without entering loading state", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <FilledButton label="Export" onClick={onClick} />,
    );
    const button = getByRole("button", { name: "Export" });

    fireEvent.click(button);
    act(() => {
      vi.advanceTimersByTime(LOADING_DELAY);
    });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(isLoading(button)).toBe(false);
    expect(button).not.toBeDisabled();
  });

  it("shows a delayed loading state while an async onClick is pending, then re-enables", async () => {
    const deferred = createDeferred();
    const onClick = vi.fn(() => deferred.promise);
    const { getByRole } = render(
      <FilledButton label="Export" onClick={onClick} />,
    );
    const button = getByRole("button", { name: "Export" });

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    // loading is deferred to avoid flicker on quick responses
    act(() => {
      vi.advanceTimersByTime(LOADING_DELAY - 1);
    });
    expect(isLoading(button)).toBe(false);
    expect(button).not.toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(isLoading(button)).toBe(true);
    expect(button).toBeDisabled();

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    expect(isLoading(button)).toBe(false);
    expect(button).not.toBeDisabled();
  });

  it("never shows loading when the async onClick settles before the delay", async () => {
    const onClick = vi.fn(() => Promise.resolve());
    const { getByRole } = render(
      <FilledButton label="Export" onClick={onClick} />,
    );
    const button = getByRole("button", { name: "Export" });

    await act(async () => {
      fireEvent.click(button);
    });
    act(() => {
      vi.advanceTimersByTime(LOADING_DELAY * 2);
    });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(isLoading(button)).toBe(false);
    expect(button).not.toBeDisabled();
  });

  it("swallows AbortError and resets loading state", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deferred = createDeferred();
    const { getByRole } = render(
      <FilledButton label="Export" onClick={() => deferred.promise} />,
    );
    const button = getByRole("button", { name: "Export" });

    let clickPromise!: Promise<void>;
    act(() => {
      clickPromise = invokeReactOnClick(button);
    });
    act(() => {
      vi.advanceTimersByTime(LOADING_DELAY);
    });
    expect(isLoading(button)).toBe(true);

    const abortError = new AbortError();
    await act(async () => {
      deferred.reject(abortError);
      await expect(clickPromise).resolves.toBeUndefined();
    });

    expect(warn).toHaveBeenCalledWith(abortError);
    expect(isLoading(button)).toBe(false);
    expect(button).not.toBeDisabled();
  });

  it("re-throws non-abort errors and still resets loading state", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deferred = createDeferred();
    const { getByRole } = render(
      <FilledButton label="Export" onClick={() => deferred.promise} />,
    );
    const button = getByRole("button", { name: "Export" });

    let clickPromise!: Promise<void>;
    act(() => {
      clickPromise = invokeReactOnClick(button);
    });
    act(() => {
      vi.advanceTimersByTime(LOADING_DELAY);
    });
    expect(isLoading(button)).toBe(true);

    const error = new Error("export failed");
    await act(async () => {
      deferred.reject(error);
      await expect(clickPromise).rejects.toBe(error);
    });

    expect(warn).not.toHaveBeenCalled();
    expect(isLoading(button)).toBe(false);
    expect(button).not.toBeDisabled();
  });

  it("does not enter loading state if a non-abort error rejects before the delay", async () => {
    const error = new Error("export failed");
    const { getByRole } = render(
      <FilledButton label="Export" onClick={() => Promise.reject(error)} />,
    );
    const button = getByRole("button", { name: "Export" });

    await act(async () => {
      await expect(invokeReactOnClick(button)).rejects.toBe(error);
    });
    act(() => {
      vi.advanceTimersByTime(LOADING_DELAY * 2);
    });

    expect(isLoading(button)).toBe(false);
    expect(button).not.toBeDisabled();
  });

  it("is disabled with a spinner when status is 'loading'", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <FilledButton label="Export" status="loading" onClick={onClick} />,
    );
    const button = getByRole("button", { name: "Export" });

    expect(button).toBeDisabled();
    expect(isLoading(button)).toBe(true);

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is disabled with a success icon and color when status is 'success'", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <FilledButton
        label="Export"
        color="primary"
        status="success"
        onClick={onClick}
      />,
    );
    const button = getByRole("button", { name: "Export" });

    expect(button).toBeDisabled();
    expect(button).toHaveClass("ExcButton--status-success");
    expect(button).toHaveClass("ExcButton--color-success");
    expect(button).not.toHaveClass("ExcButton--color-primary");
    expect(button.querySelector(".ExcButton__statusIcon")).not.toBeNull();
    expect(button.querySelector(".Spinner")).toBeNull();

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("respects the disabled prop when idle", () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <FilledButton label="Export" disabled onClick={onClick} />,
    );
    const button = getByRole("button", { name: "Export" });

    expect(button).toBeDisabled();
    expect(button).toHaveClass("ExcButton--color-primary");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
