import { queryByText, queryByTestId } from "@testing-library/react";
import { useMemo } from "react";

import { THEME } from "@excalidraw/common";

import { t } from "../i18n";
import { Excalidraw, Footer, MainMenu } from "../index";
import { actionExportWithDarkMode } from "../actions/actionExport";

import {
  act,
  fireEvent,
  GlobalTestState,
  toggleMenu,
  render,
  waitFor,
} from "./test-utils";

import type { ExcalidrawProps } from "../types";

const { h } = window;

describe("<Excalidraw/>", () => {
  afterEach(() => {
    const menu = document.querySelector(".dropdown-menu");
    if (menu) {
      toggleMenu(document.querySelector(".excalidraw")!);
    }
  });

  describe("Test zenModeEnabled prop", () => {
    it('should show exit zen mode button when zen mode is set and zen mode option in context menu when zenModeEnabled is "undefined"', async () => {
      const { container } = await render(<Excalidraw />);
      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
      expect(h.state.zenModeEnabled).toBe(false);

      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });
      const contextMenu = document.querySelector(".context-menu");
      fireEvent.click(queryByText(contextMenu as HTMLElement, "Zen mode")!);
      expect(h.state.zenModeEnabled).toBe(true);
      expect(container.querySelector(".excalidraw")).toHaveClass(
        "excalidraw--zen-mode",
      );
      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(1);
    });

    it("should not show exit zen mode button and zen mode option in context menu when zenModeEnabled is set", async () => {
      const { container } = await render(<Excalidraw zenModeEnabled={true} />);
      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
      expect(h.state.zenModeEnabled).toBe(true);

      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });
      const contextMenu = document.querySelector(".context-menu");
      expect(queryByText(contextMenu as HTMLElement, "Zen mode")).toBe(null);
      expect(h.state.zenModeEnabled).toBe(true);
      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
    });
  });

  it("should render the footer only when Footer is passed as children", async () => {
    //Footer not passed hence it will not render the footer
    let { container } = await render(
      <Excalidraw>
        <div>This is a custom footer</div>
      </Excalidraw>,
    );
    expect(container.querySelector(".footer-center")).toBe(null);

    // Footer passed hence it will render the footer
    ({ container } = await render(
      <Excalidraw>
        <Footer>
          <div>This is a custom footer</div>
        </Footer>
      </Excalidraw>,
    ));
    expect(container.querySelector(".footer-center")).toMatchInlineSnapshot(
      `
      <div
        class="footer-center zen-mode-transition"
      >
        <div>
          This is a custom footer
        </div>
      </div>
    `,
    );
  });

  describe("Test gridModeEnabled prop", () => {
    it('should show grid mode in context menu when gridModeEnabled is "undefined"', async () => {
      const { container } = await render(<Excalidraw />);
      expect(h.state.gridModeEnabled).toBe(false);

      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });
      const contextMenu = document.querySelector(".context-menu");
      fireEvent.click(queryByText(contextMenu as HTMLElement, "Toggle grid")!);
      expect(h.state.gridModeEnabled).toBe(true);
    });

    it('should not show grid mode in context menu when gridModeEnabled is not "undefined"', async () => {
      const { container } = await render(
        <Excalidraw gridModeEnabled={false} />,
      );
      expect(h.state.gridModeEnabled).toBe(false);

      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });
      const contextMenu = document.querySelector(".context-menu");
      expect(queryByText(contextMenu as HTMLElement, "Show grid")).toBe(null);
      expect(h.state.gridModeEnabled).toBe(false);
    });
  });

  describe("Test UIOptions prop", () => {
    describe("Test canvasActions", () => {
      it('should render menu with default items when "UIOPtions" is "undefined"', async () => {
        const { container } = await render(
          <Excalidraw UIOptions={undefined} />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "dropdown-menu")).toMatchSnapshot();
      });

      it("should hide clear canvas button when clearCanvas is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { clearCanvas: false } }} />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "clear-canvas-button")).toBeNull();
      });

      it("should hide export button when export is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { export: false } }} />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "json-export-button")).toBeNull();
      });

      it("should hide 'Save as image' button when 'saveAsImage' is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { saveAsImage: false } }} />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "image-export-button")).toBeNull();
      });

      it("should hide load button when loadScene is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { loadScene: false } }} />,
        );

        expect(queryByTestId(container, "load-button")).toBeNull();
      });

      it("should hide save as button when saveFileToDisk is false", async () => {
        const { container } = await render(
          <Excalidraw
            UIOptions={{ canvasActions: { export: { saveFileToDisk: false } } }}
          />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "save-as-button")).toBeNull();
      });

      it("should hide save button when saveToActiveFile is false", async () => {
        const { container } = await render(
          <Excalidraw
            UIOptions={{ canvasActions: { saveToActiveFile: false } }}
          />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "save-button")).toBeNull();
      });

      it("should hide the canvas background picker when changeViewBackgroundColor is false", async () => {
        const { container } = await render(
          <Excalidraw
            UIOptions={{ canvasActions: { changeViewBackgroundColor: false } }}
          />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "canvas-background-label")).toBeNull();
        expect(queryByTestId(container, "canvas-background-picker")).toBeNull();
      });

      it("should hide the canvas background picker even if passed if the `canvasActions.changeViewBackgroundColor` is set to false", async () => {
        const { container } = await render(
          <Excalidraw
            UIOptions={{ canvasActions: { changeViewBackgroundColor: false } }}
          >
            <MainMenu>
              <MainMenu.DefaultItems.ChangeCanvasBackground />
            </MainMenu>
          </Excalidraw>,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "canvas-background-label")).toBeNull();
        expect(queryByTestId(container, "canvas-background-picker")).toBeNull();
      });

      it("should hide the theme toggle when theme is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { toggleTheme: false } }} />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "toggle-dark-mode")).toBeNull();
      });

      it("should not render default items in custom menu even if passed if the prop in `canvasActions` is set to false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { loadScene: false } }}>
            <MainMenu>
              <MainMenu.ItemCustom>
                <button
                  style={{ height: "2rem" }}
                  onClick={() => window.alert("custom menu item")}
                >
                  custom item
                </button>
              </MainMenu.ItemCustom>
              <MainMenu.DefaultItems.LoadScene />
            </MainMenu>
          </Excalidraw>,
        );
        //open menu
        toggleMenu(container);
        // load button shouldn't be rendered since `UIActions.canvasActions.loadScene` is `false`
        expect(queryByTestId(container, "load-button")).toBeNull();
      });
    });
  });

  describe("Test theme prop", () => {
    it("should show the theme toggle by default", async () => {
      const { container } = await render(<Excalidraw />);
      expect(h.state.theme).toBe(THEME.LIGHT);
      //open menu
      toggleMenu(container);
      const darkModeToggle = queryByTestId(container, "toggle-dark-mode");
      expect(darkModeToggle).toBeTruthy();
    });

    it("should not show theme toggle when the theme prop is defined", async () => {
      const { container } = await render(<Excalidraw theme={THEME.DARK} />);

      expect(h.state.theme).toBe(THEME.DARK);
      //open menu
      toggleMenu(container);
      expect(queryByTestId(container, "toggle-dark-mode")).toBe(null);
    });

    it("should show theme mode toggle when `UIOptions.canvasActions.toggleTheme` is true", async () => {
      const { container } = await render(
        <Excalidraw
          theme={THEME.DARK}
          UIOptions={{ canvasActions: { toggleTheme: true } }}
        />,
      );
      expect(h.state.theme).toBe(THEME.DARK);
      //open menu
      toggleMenu(container);
      const darkModeToggle = queryByTestId(container, "toggle-dark-mode");
      expect(darkModeToggle).toBeTruthy();
    });

    it("should not show theme toggle when `UIOptions.canvasActions.toggleTheme` is false", async () => {
      const { container } = await render(
        <Excalidraw
          UIOptions={{ canvasActions: { toggleTheme: false } }}
          theme={THEME.DARK}
        />,
      );
      expect(h.state.theme).toBe(THEME.DARK);
      //open menu
      toggleMenu(container);
      const darkModeToggle = queryByTestId(container, "toggle-dark-mode");
      expect(darkModeToggle).toBe(null);
    });

    it("should sync export theme with the UI theme when there is no session override", async () => {
      await render(<Excalidraw theme={THEME.DARK} />);

      expect(h.state.exportWithDarkMode).toBe(true);

      act(() => {
        h.setState({ exportWithDarkMode: false });
      });

      await waitFor(() => {
        expect(h.state.exportWithDarkMode).toBe(true);
      });
    });

    it("should keep the export theme override for the current session", async () => {
      await render(<Excalidraw theme={THEME.LIGHT} />);

      act(() => {
        (h.app as any).actionManager.executeAction(
          actionExportWithDarkMode,
          "ui",
          true,
        );
      });

      expect(h.app.sessionExportThemeOverride).toBe(THEME.DARK);
      expect(h.state.exportWithDarkMode).toBe(true);

      act(() => {
        h.setState({ theme: THEME.DARK });
      });

      act(() => {
        h.setState({ theme: THEME.LIGHT });
      });

      await waitFor(() => {
        expect(h.state.exportWithDarkMode).toBe(true);
      });
    });
  });

  describe("Test name prop", () => {
    it("should allow editing name", async () => {
      const { container } = await render(<Excalidraw />);
      //open menu
      toggleMenu(container);
      fireEvent.click(queryByTestId(container, "image-export-button")!);
      const textInput: HTMLInputElement | null = document.querySelector(
        ".ImageExportModal .ImageExportModal__preview__filename .TextInput",
      );
      expect(textInput?.value).toContain(`${t("labels.untitled")}`);
      expect(textInput?.nodeName).toBe("INPUT");
    });

    it('should set the name when the name prop is present"', async () => {
      const name = "test";
      const { container } = await render(<Excalidraw name={name} />);
      //open menu
      toggleMenu(container);
      await fireEvent.click(queryByTestId(container, "image-export-button")!);
      const textInput = document.querySelector(
        ".ImageExportModal .ImageExportModal__preview__filename .TextInput",
      ) as HTMLInputElement;
      expect(textInput?.value).toEqual(name);
      expect(textInput?.nodeName).toBe("INPUT");
    });
  });

  describe("Test autoFocus prop", () => {
    it("should not focus when autoFocus is false", async () => {
      const { container } = await render(<Excalidraw />);

      expect(
        container.querySelector(".excalidraw") === document.activeElement,
      ).toBe(false);
    });

    it("should focus when autoFocus is true", async () => {
      const { container } = await render(<Excalidraw autoFocus={true} />);

      expect(
        container.querySelector(".excalidraw") === document.activeElement,
      ).toBe(true);
    });
  });

  describe("<MainMenu/>", () => {
    it("should render main menu with host menu items if passed from host", async () => {
      const { container } = await render(
        <Excalidraw>
          <MainMenu>
            <MainMenu.Item onSelect={() => window.alert("Clicked")}>
              Click me
            </MainMenu.Item>
            <MainMenu.ItemLink href="blog.excalidaw.com">
              Excalidraw blog
            </MainMenu.ItemLink>
            <MainMenu.ItemCustom>
              <button
                style={{ height: "2rem" }}
                onClick={() => window.alert("custom menu item")}
              >
                custom menu item
              </button>
            </MainMenu.ItemCustom>
            <MainMenu.DefaultItems.Help />
          </MainMenu>
        </Excalidraw>,
      );
      //open menu
      toggleMenu(container);
      expect(queryByTestId(container, "dropdown-menu")).toMatchSnapshot();
    });

    it("should update themeToggle text even if MainMenu memoized", async () => {
      const CustomExcalidraw = () => {
        const customMenu = useMemo(() => {
          return (
            <MainMenu>
              <MainMenu.DefaultItems.ToggleTheme allowSystemTheme={false} />
            </MainMenu>
          );
        }, []);

        return <Excalidraw>{customMenu}</Excalidraw>;
      };

      const { container } = await render(<CustomExcalidraw />);
      //open menu
      toggleMenu(container);

      expect(h.state.theme).toBe(THEME.LIGHT);

      expect(
        queryByTestId(container, "toggle-dark-mode")?.textContent,
      ).toContain(t("buttons.darkMode"));

      fireEvent.click(queryByTestId(container, "toggle-dark-mode")!);

      expect(
        queryByTestId(container, "toggle-dark-mode")?.textContent,
      ).toContain(t("buttons.lightMode"));
    });

    it("should show theme toggle when the theme prop and onThemeChange are defined", async () => {
      const onThemeChange = vi.fn();
      const { container } = await render(
        <Excalidraw theme={THEME.DARK} onThemeChange={onThemeChange} />,
      );

      expect(h.state.theme).toBe(THEME.DARK);
      //open menu
      toggleMenu(container);
      const darkModeToggle = queryByTestId(container, "toggle-dark-mode");
      expect(darkModeToggle).toBeTruthy();
    });

    it("should call onThemeChange instead of mutating theme when defined", async () => {
      const onThemeChange = vi.fn();
      const { container } = await render(
        <Excalidraw theme={THEME.LIGHT} onThemeChange={onThemeChange} />,
      );

      //open menu
      toggleMenu(container);
      fireEvent.click(queryByTestId(container, "toggle-dark-mode")!);

      expect(onThemeChange).toHaveBeenCalledWith(THEME.DARK);
      expect(h.state.theme).toBe(THEME.LIGHT);
    });
  });

  it("should apply a custom class name to the editor root", async () => {
    const { container } = await render(
      <Excalidraw className="custom-excalidraw" />,
    );

    expect(container.querySelector(".excalidraw")).toHaveClass(
      "custom-excalidraw",
    );
  });
});

describe("<Excalidraw/> memo comparator", () => {
  const areEqual = (
    Excalidraw as unknown as {
      compare: (prev: ExcalidrawProps, next: ExcalidrawProps) => boolean;
    }
  ).compare;

  it("is wired into React.memo", () => {
    expect(typeof areEqual).toBe("function");
  });

  it("treats identical primitive and callback props as equal", () => {
    const onChange = () => {};
    expect(
      areEqual(
        { viewModeEnabled: true, theme: THEME.DARK, onChange },
        { viewModeEnabled: true, theme: THEME.DARK, onChange },
      ),
    ).toBe(true);
  });

  it("detects changes to props compared shallowly", () => {
    expect(
      areEqual({ viewModeEnabled: false }, { viewModeEnabled: true }),
    ).toBe(false);
    expect(areEqual({ theme: THEME.LIGHT }, { theme: THEME.DARK })).toBe(false);
    expect(areEqual({ onChange: () => {} }, { onChange: () => {} })).toBe(
      false,
    );
    expect(areEqual({}, { zenModeEnabled: true })).toBe(false);
  });

  it("ignores initialData changes", () => {
    expect(
      areEqual({ initialData: { elements: [] } }, { initialData: null }),
    ).toBe(true);
  });

  it("short-circuits on children identity", () => {
    const child = <div />;
    expect(areEqual({ children: child }, { children: child })).toBe(true);
    expect(areEqual({ children: <div /> }, { children: <div /> })).toBe(false);
  });

  describe("activeTool", () => {
    it("treats inline objects with the same tool as equal", () => {
      expect(
        areEqual(
          { activeTool: { type: "laser" } },
          { activeTool: { type: "laser" } },
        ),
      ).toBe(true);
      expect(
        areEqual(
          { activeTool: { type: "custom", customType: "comment" } },
          { activeTool: { type: "custom", customType: "comment" } },
        ),
      ).toBe(true);
    });

    it("detects tool type and customType changes", () => {
      expect(
        areEqual(
          { activeTool: { type: "laser" } },
          { activeTool: { type: "rectangle" } },
        ),
      ).toBe(false);
      expect(
        areEqual(
          { activeTool: { type: "custom", customType: "comment" } },
          { activeTool: { type: "custom", customType: "pin" } },
        ),
      ).toBe(false);
      expect(areEqual({}, { activeTool: { type: "laser" } })).toBe(false);
      expect(areEqual({ activeTool: { type: "laser" } }, {})).toBe(false);
    });
  });

  describe("interaction", () => {
    it("treats identical booleans and inline configs as equal", () => {
      expect(areEqual({ interaction: false }, { interaction: false })).toBe(
        true,
      );
      expect(
        areEqual(
          {
            interaction: {
              enabled: { links: true, tools: { laser: true } },
            },
          },
          {
            interaction: {
              enabled: { links: true, tools: { laser: true } },
            },
          },
        ),
      ).toBe(true);
    });

    it("treats missing and false flags as equal", () => {
      expect(
        areEqual(
          { interaction: { enabled: {} } },
          {
            interaction: {
              enabled: { links: false, tools: { laser: false } },
            },
          },
        ),
      ).toBe(true);
    });

    it("detects boolean <-> config changes", () => {
      expect(areEqual({ interaction: true }, { interaction: false })).toBe(
        false,
      );
      expect(
        areEqual({ interaction: false }, { interaction: { enabled: {} } }),
      ).toBe(false);
      expect(areEqual({}, { interaction: false })).toBe(false);
    });

    it.each([
      ["links", { links: true }],
      ["embeds", { embeds: true }],
      ["interactiveContent", { interactiveContent: true }],
      ["navigation", { navigation: true }],
      ["browserZoom", { browserZoom: true }],
      ["tools.laser", { tools: { laser: true } }],
      ["tools.custom", { tools: { custom: true } }],
    ] as const)("detects a change of enabled.%s", (_, enabled) => {
      expect(
        areEqual(
          { interaction: { enabled: {} } },
          { interaction: { enabled } },
        ),
      ).toBe(false);
    });
  });

  describe("ui", () => {
    it("treats identical booleans and inline configs as equal", () => {
      expect(areEqual({ ui: false }, { ui: false })).toBe(true);
      expect(
        areEqual(
          { ui: { enabled: { zoom: true } } },
          { ui: { enabled: { zoom: true, scrollBackToContent: false } } },
        ),
      ).toBe(true);
    });

    it("detects boolean <-> config changes", () => {
      expect(areEqual({ ui: true }, { ui: false })).toBe(false);
      expect(areEqual({ ui: false }, { ui: { enabled: {} } })).toBe(false);
    });

    it.each([
      ["zoom", { zoom: true }],
      ["scrollBackToContent", { scrollBackToContent: true }],
    ] as const)("detects a change of enabled.%s", (_, enabled) => {
      expect(areEqual({ ui: { enabled: {} } }, { ui: { enabled } })).toBe(
        false,
      );
    });
  });

  describe("UIOptions", () => {
    it("treats inline objects with the same canvasActions as equal", () => {
      expect(
        areEqual(
          {
            UIOptions: {
              canvasActions: {
                loadScene: false,
                export: { saveFileToDisk: true },
              },
            },
          },
          {
            UIOptions: {
              canvasActions: {
                loadScene: false,
                export: { saveFileToDisk: true },
              },
            },
          },
        ),
      ).toBe(true);
    });

    it("treats a missing UIOptions as an empty one", () => {
      expect(areEqual({}, { UIOptions: {} })).toBe(true);
    });

    it("detects added/removed UIOptions keys", () => {
      expect(
        areEqual(
          { UIOptions: {} },
          { UIOptions: { canvasActions: { loadScene: false } } },
        ),
      ).toBe(false);
    });

    it("detects canvasActions value changes", () => {
      expect(
        areEqual(
          { UIOptions: { canvasActions: { loadScene: false } } },
          { UIOptions: { canvasActions: { loadScene: true } } },
        ),
      ).toBe(false);
    });

    it("detects export.saveFileToDisk changes", () => {
      expect(
        areEqual(
          {
            UIOptions: { canvasActions: { export: { saveFileToDisk: true } } },
          },
          {
            UIOptions: { canvasActions: { export: { saveFileToDisk: false } } },
          },
        ),
      ).toBe(false);
    });

    it("ignores getFormFactor identity", () => {
      expect(
        areEqual(
          { UIOptions: { getFormFactor: () => "desktop" } },
          { UIOptions: { getFormFactor: () => "phone" } },
        ),
      ).toBe(true);
    });

    it("compares other UIOptions keys by reference", () => {
      const dockedSidebarBreakpoint = 800;
      expect(
        areEqual(
          { UIOptions: { dockedSidebarBreakpoint } },
          { UIOptions: { dockedSidebarBreakpoint } },
        ),
      ).toBe(true);
      expect(
        areEqual(
          { UIOptions: { dockedSidebarBreakpoint: 800 } },
          { UIOptions: { dockedSidebarBreakpoint: 900 } },
        ),
      ).toBe(false);
    });
  });

  describe("imageOptions", () => {
    it("treats inline objects with the same values as equal", () => {
      expect(
        areEqual(
          { imageOptions: { maxWidthOrHeight: 800, maxFileSizeBytes: 1024 } },
          { imageOptions: { maxWidthOrHeight: 800, maxFileSizeBytes: 1024 } },
        ),
      ).toBe(true);
    });

    it("treats explicit defaults as equal to omitted options", () => {
      expect(
        areEqual(
          {},
          {
            imageOptions: {
              maxWidthOrHeight: 1440,
              maxFileSizeBytes: 4 * 1024 * 1024,
            },
          },
        ),
      ).toBe(true);
    });

    it("detects maxWidthOrHeight and maxFileSizeBytes changes", () => {
      expect(
        areEqual(
          { imageOptions: { maxWidthOrHeight: 800 } },
          { imageOptions: { maxWidthOrHeight: 1000 } },
        ),
      ).toBe(false);
      expect(areEqual({}, { imageOptions: { maxFileSizeBytes: 1024 } })).toBe(
        false,
      );
    });
  });

  it("skips re-rendering the editor for identical inline props and re-renders on change", async () => {
    const renderEditor = (maxWidthOrHeight: number) => (
      <Excalidraw
        interaction={{ enabled: { links: true, tools: { laser: true } } }}
        ui={{ enabled: { zoom: true } }}
        activeTool={{ type: "laser" }}
        UIOptions={{ canvasActions: { export: { saveFileToDisk: true } } }}
        imageOptions={{ maxWidthOrHeight }}
      />
    );

    await render(renderEditor(1000));
    const initialAppProps = h.app.props;

    GlobalTestState.renderResult.rerender(renderEditor(1000));
    expect(h.app.props).toBe(initialAppProps);

    GlobalTestState.renderResult.rerender(renderEditor(800));
    expect(h.app.props).not.toBe(initialAppProps);
    expect(h.app.props.imageOptions.maxWidthOrHeight).toBe(800);
  });
});
