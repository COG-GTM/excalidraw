import { Excalidraw, WelcomeScreen } from "@excalidraw/excalidraw";
import { chatHistoryAtom } from "@excalidraw/excalidraw/components/TTDDialog/TTDContext";
import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";
import { t } from "@excalidraw/excalidraw/i18n";
import {
  fireEvent,
  render,
  screen,
} from "@excalidraw/excalidraw/tests/test-utils";

import { AISplash } from "./AISplash";
import { isAIEnabled } from "./splashVariant";

vi.mock("./splashVariant", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./splashVariant")>()),
  isAIEnabled: vi.fn(() => true),
}));

const renderSplash = (aiEnabled?: boolean) =>
  render(
    <Excalidraw aiEnabled={aiEnabled}>
      <WelcomeScreen>
        <WelcomeScreen.Center>
          <WelcomeScreen.Center.Menu>
            <AISplash excalidrawAPI={null} />
          </WelcomeScreen.Center.Menu>
        </WelcomeScreen.Center>
      </WelcomeScreen>
    </Excalidraw>,
  );

describe("AISplash", () => {
  beforeEach(() => {
    vi.mocked(isAIEnabled).mockReturnValue(true);
  });

  it("submits the trimmed prompt and opens the text-to-diagram dialog", async () => {
    const { h } = window;
    await renderSplash();

    const input = screen.getByLabelText(t("labels.prompt"));
    fireEvent.change(input, { target: { value: " user signup journey " } });
    fireEvent.submit(input.closest("form")!);

    expect(h.state.openDialog).toEqual({
      name: "ttd",
      tab: "text-to-diagram",
    });
    expect(editorJotaiStore.get(chatHistoryAtom).currentPrompt).toBe(
      "user signup journey",
    );
  });

  it("opens the text-to-diagram dialog from the menu item", async () => {
    const { h } = window;
    await renderSplash();

    fireEvent.click(screen.getByRole("button", { name: /Generate with AI/ }));

    expect(h.state.openDialog).toEqual({
      name: "ttd",
      tab: "text-to-diagram",
    });
  });

  it("does not render when AI is disabled in the app props", async () => {
    await renderSplash(false);

    expect(
      screen.queryByRole("button", { name: /Generate with AI/ }),
    ).toBeNull();
    expect(screen.queryByLabelText(t("labels.prompt"))).toBeNull();
  });

  it("does not render when the AI splash feature is disabled", async () => {
    vi.mocked(isAIEnabled).mockReturnValue(false);
    await renderSplash();

    expect(
      screen.queryByRole("button", { name: /Generate with AI/ }),
    ).toBeNull();
    expect(screen.queryByLabelText(t("labels.prompt"))).toBeNull();
  });
});
