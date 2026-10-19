import { act, cleanup, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { THEME } from "@excalidraw/common";

import { getDefaultAppState } from "../appState";
import { ExcalidrawAPIContext } from "../components/App";
import { AppStateObserver } from "../components/AppStateObserver";
import {
  useAppStateValue,
  useOnAppStateChange,
} from "../hooks/useAppStateValue";
import { useExcalidrawStateValue } from "../index";

import type {
  AppState,
  ExcalidrawImperativeAPI,
  UnsubscribeCallback,
} from "../types";

const createAppState = (): AppState => ({
  ...getDefaultAppState(),
  width: 0,
  height: 0,
  offsetLeft: 0,
  offsetTop: 0,
});

const createMockAPI = (initialState: AppState) => {
  let state = initialState;
  const observer = new AppStateObserver(() => state);

  return {
    api: {
      isDestroyed: false,
      getAppState: () => state,
      onStateChange: observer.onStateChange,
    } as Pick<
      ExcalidrawImperativeAPI,
      "isDestroyed" | "getAppState" | "onStateChange"
    > as ExcalidrawImperativeAPI,
    updateAppState: (partial: Partial<AppState>) => {
      const prevState = state;
      state = { ...state, ...partial };
      observer.flush(prevState);
    },
  };
};

const spyOnStateChange = (api: ExcalidrawImperativeAPI) => {
  const unsubscribeSpies: ReturnType<typeof vi.fn>[] = [];
  const originalOnStateChange = api.onStateChange;
  const onStateChangeSpy = vi.fn((...args: any[]) => {
    const unsubscribe = (originalOnStateChange as any)(
      ...args,
    ) as UnsubscribeCallback;
    const unsubscribeSpy = vi.fn(unsubscribe);
    unsubscribeSpies.push(unsubscribeSpy);
    return unsubscribeSpy;
  });
  return {
    api: {
      ...api,
      onStateChange: onStateChangeSpy as any,
    } as ExcalidrawImperativeAPI,
    onStateChangeSpy,
    unsubscribeSpies,
  };
};

describe("app state hooks", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("useAppStateValue rerenders when the selected value changes", () => {
    const renderSpy = vi.fn();
    const { api, updateAppState } = createMockAPI(createAppState());

    const ValueConsumer = () => {
      const value = useAppStateValue("viewModeEnabled");
      renderSpy(value);
      return <div data-testid="value">{String(value)}</div>;
    };

    render(
      <ExcalidrawAPIContext.Provider value={api}>
        <ValueConsumer />
      </ExcalidrawAPIContext.Provider>,
    );

    expect(screen.getByTestId("value").textContent).toBe("false");
    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      updateAppState({ viewModeEnabled: true });
    });

    expect(screen.getByTestId("value").textContent).toBe("true");
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  it("useOnAppStateChange notifies without rerendering", () => {
    const renderSpy = vi.fn();
    const callback = vi.fn();
    const { api, updateAppState } = createMockAPI(createAppState());

    const ChangeConsumer = () => {
      const value = useOnAppStateChange("viewModeEnabled", callback);
      renderSpy(value);
      return <div data-testid="value">{String(value)}</div>;
    };

    render(
      <ExcalidrawAPIContext.Provider value={api}>
        <ChangeConsumer />
      </ExcalidrawAPIContext.Provider>,
    );

    expect(screen.getByTestId("value").textContent).toBe("undefined");
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ viewModeEnabled: false }),
    );

    act(() => {
      updateAppState({ viewModeEnabled: true });
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ viewModeEnabled: true }),
    );
  });

  it("useExcalidrawStateValue initializes once the API is provided after first render", () => {
    const renderSpy = vi.fn();
    const { api, updateAppState } = createMockAPI(createAppState());
    const { api: spiedAPI, onStateChangeSpy } = spyOnStateChange(api);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const HostConsumer = () => {
      const value = useExcalidrawStateValue("viewModeEnabled");
      renderSpy(value);
      return <div data-testid="value">{String(value)}</div>;
    };

    const { rerender } = render(
      <ExcalidrawAPIContext.Provider value={null}>
        <HostConsumer />
      </ExcalidrawAPIContext.Provider>,
    );

    expect(screen.getByTestId("value").textContent).toBe("undefined");
    expect(renderSpy).toHaveBeenLastCalledWith(undefined);
    expect(onStateChangeSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    rerender(
      <ExcalidrawAPIContext.Provider value={spiedAPI}>
        <HostConsumer />
      </ExcalidrawAPIContext.Provider>,
    );

    expect(screen.getByTestId("value").textContent).toBe("false");
    expect(onStateChangeSpy).toHaveBeenCalledTimes(1);
    expect(onStateChangeSpy).toHaveBeenCalledWith(
      "viewModeEnabled",
      expect.any(Function),
    );

    act(() => {
      updateAppState({ viewModeEnabled: true });
    });

    expect(screen.getByTestId("value").textContent).toBe("true");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("useAppStateValue with _internal=false returns undefined without warning when API is missing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderSpy = vi.fn();

    const ExternalConsumer = () => {
      const value = useAppStateValue("theme", false);
      renderSpy(value);
      return null;
    };

    render(
      <ExcalidrawAPIContext.Provider value={null}>
        <ExternalConsumer />
      </ExcalidrawAPIContext.Provider>,
    );

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalledWith(undefined);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("useAppStateValue (internal) warns and falls back to default appState when API is missing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const renderSpy = vi.fn();

    const InternalConsumer = () => {
      const value = useAppStateValue((appState) => appState);
      renderSpy(value);
      return null;
    };

    render(
      <ExcalidrawAPIContext.Provider value={null}>
        <InternalConsumer />
      </ExcalidrawAPIContext.Provider>,
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain(
      "excalidrawAPI not defined yet for internal component",
    );
    expect(renderSpy).toHaveBeenCalledTimes(1);
    const fallback = renderSpy.mock.calls[0][0] as AppState;
    const defaults = getDefaultAppState();
    expect(fallback).toMatchObject({
      width: 0,
      height: 0,
      offsetLeft: 0,
      offsetTop: 0,
      theme: defaults.theme,
      viewModeEnabled: defaults.viewModeEnabled,
      zoom: defaults.zoom,
    });
  });

  it("useAppStateValue does not read or subscribe when API is destroyed", () => {
    const renderSpy = vi.fn();
    const { api, updateAppState } = createMockAPI(createAppState());
    const getAppStateSpy = vi.fn(api.getAppState);
    const { api: spiedAPI, onStateChangeSpy } = spyOnStateChange({
      ...api,
      getAppState: getAppStateSpy,
      isDestroyed: true,
    } as ExcalidrawImperativeAPI);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ValueConsumer = () => {
      const value = useAppStateValue("viewModeEnabled");
      renderSpy(value);
      return <div data-testid="value">{String(value)}</div>;
    };

    render(
      <ExcalidrawAPIContext.Provider value={spiedAPI}>
        <ValueConsumer />
      </ExcalidrawAPIContext.Provider>,
    );

    expect(screen.getByTestId("value").textContent).toBe("undefined");
    expect(getAppStateSpy).not.toHaveBeenCalled();
    expect(onStateChangeSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    act(() => {
      updateAppState({ viewModeEnabled: true });
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("value").textContent).toBe("undefined");
  });

  it("useAppStateValue with array selector returns whole appState and rerenders only on listed keys", () => {
    const renderSpy = vi.fn();
    const initialState = createAppState();
    const { api, updateAppState } = createMockAPI(initialState);

    const ArrayConsumer = () => {
      const value = useAppStateValue(["zoom", "theme"]);
      renderSpy(value);
      return <div data-testid="value">{value.theme}</div>;
    };

    render(
      <ExcalidrawAPIContext.Provider value={api}>
        <ArrayConsumer />
      </ExcalidrawAPIContext.Provider>,
    );

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy.mock.lastCall![0]).toBe(initialState);
    expect(screen.getByTestId("value").textContent).toBe(THEME.LIGHT);

    act(() => {
      updateAppState({ viewModeEnabled: true });
    });
    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      updateAppState({ theme: THEME.DARK });
    });
    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("value").textContent).toBe(THEME.DARK);
    expect(renderSpy.mock.lastCall![0]).toBe(api.getAppState());
    expect(renderSpy.mock.lastCall![0]).toMatchObject({
      theme: THEME.DARK,
      viewModeEnabled: true,
    });

    const newZoom = { value: 2 as AppState["zoom"]["value"] };
    act(() => {
      updateAppState({ zoom: newZoom });
    });
    expect(renderSpy).toHaveBeenCalledTimes(3);
    expect(renderSpy.mock.lastCall![0].zoom).toBe(newZoom);
  });

  it("useAppStateValue with function selector returns derived value and rerenders only when it changes", () => {
    const renderSpy = vi.fn();
    const { api, updateAppState } = createMockAPI(createAppState());

    const SelectorConsumer = () => {
      const value = useAppStateValue(
        (appState) => appState.width > 100 && !appState.viewModeEnabled,
      );
      renderSpy(value);
      return <div data-testid="value">{String(value)}</div>;
    };

    render(
      <ExcalidrawAPIContext.Provider value={api}>
        <SelectorConsumer />
      </ExcalidrawAPIContext.Provider>,
    );

    expect(screen.getByTestId("value").textContent).toBe("false");
    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      updateAppState({ width: 50, theme: THEME.DARK });
    });
    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      updateAppState({ width: 200 });
    });
    expect(screen.getByTestId("value").textContent).toBe("true");
    expect(renderSpy).toHaveBeenCalledTimes(2);

    act(() => {
      updateAppState({ width: 300 });
    });
    expect(renderSpy).toHaveBeenCalledTimes(2);

    act(() => {
      updateAppState({ viewModeEnabled: true });
    });
    expect(screen.getByTestId("value").textContent).toBe("false");
    expect(renderSpy).toHaveBeenCalledTimes(3);
  });

  it("useAppStateValue unsubscribes on unmount", () => {
    const renderSpy = vi.fn();
    const { api, updateAppState } = createMockAPI(createAppState());
    const {
      api: spiedAPI,
      onStateChangeSpy,
      unsubscribeSpies,
    } = spyOnStateChange(api);

    const ValueConsumer = () => {
      const value = useAppStateValue("viewModeEnabled");
      renderSpy(value);
      return null;
    };

    const { unmount } = render(
      <ExcalidrawAPIContext.Provider value={spiedAPI}>
        <ValueConsumer />
      </ExcalidrawAPIContext.Provider>,
    );

    expect(onStateChangeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpies).toHaveLength(1);
    expect(unsubscribeSpies[0]).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribeSpies[0]).toHaveBeenCalledTimes(1);

    act(() => {
      updateAppState({ viewModeEnabled: true });
    });
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
});
