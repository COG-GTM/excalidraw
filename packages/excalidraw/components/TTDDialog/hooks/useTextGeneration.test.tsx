import React from "react";
import { act, renderHook } from "@testing-library/react";
// eslint-disable-next-line no-restricted-imports
import { createStore } from "jotai";

import { EditorJotaiProvider } from "../../../editor-jotai";
import { RequestError } from "../../../errors";
import { chatHistoryAtom, errorAtom, rateLimitsAtom } from "../TTDContext";

import { useTextGeneration } from "./useTextGeneration";

import type { TChat, TTTDDialog } from "../types";

const { parseMermaidToExcalidrawMock } = vi.hoisted(() => ({
  parseMermaidToExcalidrawMock: vi.fn(),
}));

vi.mock("@excalidraw/mermaid-to-excalidraw", async (importActual) => {
  const module = (await importActual()) as any;
  return {
    __esModule: true,
    ...module,
    parseMermaidToExcalidraw: parseMermaidToExcalidrawMock,
  };
});

type OnTextSubmit = (
  props: TTTDDialog.OnTextSubmitProps,
) => Promise<TTTDDialog.OnTextSubmitRetValue>;

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const message = (
  id: string,
  type: TChat.ChatMessage["type"],
  content?: string,
  extra: Partial<TChat.ChatMessage> = {},
): TChat.ChatMessage => ({
  id,
  type,
  content,
  timestamp: new Date("2024-01-01"),
  ...extra,
});

const setup = ({
  onTextSubmit,
  messages = [],
  rateLimits = null,
}: {
  onTextSubmit: OnTextSubmit;
  messages?: TChat.ChatMessage[];
  rateLimits?: { rateLimit: number; rateLimitRemaining: number } | null;
}) => {
  const store = createStore();
  store.set(chatHistoryAtom, {
    id: "chat-1",
    currentPrompt: "",
    messages,
  });
  store.set(rateLimitsAtom, rateLimits);
  store.set(errorAtom, null);

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <EditorJotaiProvider store={store}>{children}</EditorJotaiProvider>
  );

  const hook = renderHook(() => useTextGeneration({ onTextSubmit }), {
    wrapper,
  });

  return {
    store,
    hook,
    getMessages: () => store.get(chatHistoryAtom).messages,
    getError: () => store.get(errorAtom),
    generate: async (prompt: string, isRepairFlow?: boolean) => {
      await act(async () => {
        await hook.result.current.onGenerate({ prompt, isRepairFlow });
      });
    },
  };
};

describe("useTextGeneration", () => {
  beforeEach(() => {
    parseMermaidToExcalidrawMock.mockReset();
    parseMermaidToExcalidrawMock.mockResolvedValue({ elements: [] });
  });

  describe("prompt validation", () => {
    it("rejects prompts shorter than 3 characters", async () => {
      const onTextSubmit = vi.fn<OnTextSubmit>();
      const { generate, getError, getMessages } = setup({ onTextSubmit });

      await generate("ab");

      expect(onTextSubmit).not.toHaveBeenCalled();
      expect(getError()?.message).toBe(
        "Prompt is too short (min 3 characters)",
      );
      expect(getMessages()).toEqual([]);
    });

    it("rejects prompts longer than 10000 characters", async () => {
      const onTextSubmit = vi.fn<OnTextSubmit>();
      const { generate, getError, getMessages } = setup({ onTextSubmit });

      await generate("a".repeat(10001));

      expect(onTextSubmit).not.toHaveBeenCalled();
      expect(getError()?.message).toBe(
        "Prompt is too long (max 10000 characters)",
      );
      expect(getMessages()).toEqual([]);
    });

    it("accepts prompts at the length boundaries", async () => {
      const onTextSubmit = vi.fn<OnTextSubmit>().mockResolvedValue({
        generatedResponse: "flowchart TD\n A-->B",
        error: null,
      });
      const { generate, getError } = setup({ onTextSubmit });

      await generate("abc");
      await generate("a".repeat(10000));

      expect(onTextSubmit).toHaveBeenCalledTimes(2);
      expect(getError()).toBeNull();
    });

    it("blocks generation when no rate limit remains", async () => {
      const onTextSubmit = vi.fn<OnTextSubmit>();
      const { generate, getError, getMessages } = setup({
        onTextSubmit,
        rateLimits: { rateLimit: 10, rateLimitRemaining: 0 },
      });

      await generate("draw a flowchart");

      expect(onTextSubmit).not.toHaveBeenCalled();
      expect(getError()).toBeNull();
      expect(getMessages()).toEqual([]);
    });
  });

  describe("successful generation", () => {
    it("streams chunks into the assistant message and stores rate limits", async () => {
      const deferred = createDeferred<TTTDDialog.OnTextSubmitRetValue>();
      let submitProps: TTTDDialog.OnTextSubmitProps | undefined;
      const onTextSubmit = vi.fn<OnTextSubmit>((props) => {
        submitProps = props;
        return deferred.promise;
      });
      const { hook, store, getMessages, getError } = setup({ onTextSubmit });

      let pending!: Promise<void>;
      act(() => {
        pending = hook.result.current.onGenerate({
          prompt: "draw a flowchart",
        });
      });

      expect(getMessages()).toMatchObject([
        { type: "user", content: "draw a flowchart" },
        { type: "assistant", content: "", isGenerating: true },
      ]);

      act(() => {
        submitProps!.onChunk!("flowchart TD\n");
        submitProps!.onChunk!(" A-->B");
      });

      expect(getMessages()[1]).toMatchObject({
        type: "assistant",
        content: "flowchart TD\n A-->B",
        isGenerating: true,
      });

      await act(async () => {
        deferred.resolve({
          generatedResponse: "flowchart TD\n A-->B",
          error: null,
          rateLimit: 10,
          rateLimitRemaining: 7,
        });
        await pending;
      });

      expect(getMessages()).toHaveLength(2);
      expect(getMessages()[1]).toMatchObject({
        type: "assistant",
        content: "flowchart TD\n A-->B",
        isGenerating: false,
      });
      expect(getMessages()[1].error).toBeUndefined();
      expect(store.get(rateLimitsAtom)).toEqual({
        rateLimit: 10,
        rateLimitRemaining: 7,
      });
      expect(getError()).toBeNull();
      expect(parseMermaidToExcalidrawMock).toHaveBeenCalledWith(
        "flowchart TD\n A-->B",
      );
      expect(submitProps!.signal).toBeInstanceOf(AbortSignal);
      expect(submitProps!.signal!.aborted).toBe(false);
    });

    it("does not update rate limits when values are not finite numbers", async () => {
      const onTextSubmit = vi.fn<OnTextSubmit>().mockResolvedValue({
        generatedResponse: "flowchart TD\n A-->B",
        error: null,
        rateLimit: 10,
        rateLimitRemaining: null,
      });
      const { generate, store } = setup({
        onTextSubmit,
        rateLimits: { rateLimit: 5, rateLimitRemaining: 4 },
      });

      await generate("draw a flowchart");

      expect(store.get(rateLimitsAtom)).toEqual({
        rateLimit: 5,
        rateLimitRemaining: 4,
      });
    });

    it("sends only the last 3 previous messages plus the prompt as context", async () => {
      const onTextSubmit = vi.fn<OnTextSubmit>().mockResolvedValue({
        generatedResponse: "flowchart TD\n A-->B",
        error: null,
      });
      const { generate } = setup({
        onTextSubmit,
        messages: [
          message("1", "user", "u1"),
          message("2", "assistant", "a1"),
          message("3", "warning", undefined, {
            warningType: "rateLimitExceeded",
          }),
          message("4", "user", "u2"),
          message("5", "assistant", ""),
          message("6", "assistant", "a2"),
        ],
      });

      await generate("new prompt");

      expect(onTextSubmit.mock.calls[0][0].messages).toEqual([
        { role: "assistant", content: "a1" },
        { role: "user", content: "u2" },
        { role: "assistant", content: "a2" },
        { role: "user", content: "new prompt" },
      ]);
    });
  });

  describe("rate limiting", () => {
    it("removes the assistant message and adds a single rateLimitExceeded warning on 429", async () => {
      const onTextSubmit = vi.fn<OnTextSubmit>().mockResolvedValue({
        error: new RequestError({ message: "Too many requests", status: 429 }),
      });
      const { generate, getMessages, getError } = setup({ onTextSubmit });

      await generate("draw a flowchart");

      expect(getMessages()).toMatchObject([
        { type: "user", content: "draw a flowchart" },
        { type: "warning", warningType: "rateLimitExceeded" },
      ]);
      expect(getError()?.message).toBe("Too many requests");
      expect(
        getMessages().some((msg) => msg.type === "assistant" && msg.error),
      ).toBe(false);

      await generate("draw another flowchart");

      const messages = getMessages();
      expect(messages.filter((msg) => msg.type === "assistant")).toHaveLength(
        0,
      );
      expect(messages.map((msg) => msg.type)).toEqual([
        "user",
        "warning",
        "user",
        "warning",
      ]);
      expect(
        messages.every(
          (msg) =>
            msg.type !== "warning" || msg.warningType === "rateLimitExceeded",
        ),
      ).toBe(true);
    });

    it("adds a messageLimitExceeded warning when rateLimitRemaining hits 0", async () => {
      const onTextSubmit = vi.fn<OnTextSubmit>().mockResolvedValue({
        generatedResponse: "flowchart TD\n A-->B",
        error: null,
        rateLimit: 10,
        rateLimitRemaining: 0,
      });
      const { generate, getMessages, store, getError } = setup({
        onTextSubmit,
      });

      await generate("draw a flowchart");

      expect(getMessages()).toMatchObject([
        { type: "user", content: "draw a flowchart" },
        { type: "assistant", isGenerating: false },
        { type: "warning", warningType: "messageLimitExceeded" },
      ]);
      expect(store.get(rateLimitsAtom)).toEqual({
        rateLimit: 10,
        rateLimitRemaining: 0,
      });
      expect(getError()).toBeNull();

      // subsequent generation is blocked by the stored rate limit
      await generate("draw another flowchart");
      expect(onTextSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("errors", () => {
    it.each([
      ["error.name === 'AbortError'", { name: "AbortError", message: "x" }],
      ["error.message === 'Aborted'", { message: "Aborted" }],
    ])("silently ignores aborted requests (%s)", async (_, errorProps) => {
      const error = Object.assign(
        new RequestError({ status: 500 }),
        errorProps,
      );
      const onTextSubmit = vi.fn<OnTextSubmit>().mockResolvedValue({ error });
      const { generate, getMessages, getError } = setup({ onTextSubmit });

      await generate("draw a flowchart");

      expect(getError()).toBeNull();
      expect(getMessages()).toHaveLength(2);
      expect(getMessages()[1]).toMatchObject({
        type: "assistant",
        isGenerating: false,
      });
      expect(getMessages()[1].error).toBeUndefined();
      expect(getMessages()[1].errorType).toBeUndefined();
      expect(parseMermaidToExcalidrawMock).not.toHaveBeenCalled();
    });

    it("sets a network error on the assistant message for generic request errors", async () => {
      const onTextSubmit = vi.fn<OnTextSubmit>().mockResolvedValue({
        error: new RequestError({ message: "Server exploded", status: 500 }),
      });
      const { generate, getMessages, getError } = setup({ onTextSubmit });

      await generate("draw a flowchart");

      expect(getMessages()[1]).toMatchObject({
        type: "assistant",
        isGenerating: false,
        error: "Server exploded",
        errorType: "network",
      });
      expect(getError()?.message).toBe("Server exploded");
      expect(parseMermaidToExcalidrawMock).not.toHaveBeenCalled();
    });

    it("falls back to the requestFailed message when the error has no message", async () => {
      const error = new RequestError({ status: 500 });
      error.message = "";
      const onTextSubmit = vi.fn<OnTextSubmit>().mockResolvedValue({ error });
      const { generate, getMessages, getError } = setup({ onTextSubmit });

      await generate("draw a flowchart");

      expect(getMessages()[1]).toMatchObject({
        error: "Request failed",
        errorType: "network",
      });
      expect(getError()?.message).toBe("Request failed");
    });

    it("sets a parse error when the generated mermaid fails to parse", async () => {
      parseMermaidToExcalidrawMock.mockRejectedValue(
        new Error("Parse error on line 1"),
      );
      const onTextSubmit = vi.fn<OnTextSubmit>().mockResolvedValue({
        generatedResponse: "not mermaid",
        error: null,
      });
      const { generate, getMessages, getError } = setup({ onTextSubmit });

      await generate("draw a flowchart");

      expect(parseMermaidToExcalidrawMock).toHaveBeenCalledWith("not mermaid");
      expect(getMessages()[1]).toMatchObject({
        type: "assistant",
        isGenerating: false,
        error: "Parse error on line 1",
        errorType: "parse",
      });
      expect(getError()?.message).toBe("Parse error on line 1");
    });

    it("sets an 'other' error when onTextSubmit throws", async () => {
      const onTextSubmit = vi
        .fn<OnTextSubmit>()
        .mockRejectedValue(new Error("Unexpected failure"));
      const { generate, getMessages, getError } = setup({ onTextSubmit });

      await generate("draw a flowchart");

      expect(getMessages()[1]).toMatchObject({
        type: "assistant",
        isGenerating: false,
        error: "Unexpected failure",
        errorType: "other",
      });
      expect(getError()?.message).toBe("Unexpected failure");
    });

    it("clears a previous error when a new valid generation starts", async () => {
      const onTextSubmit = vi.fn<OnTextSubmit>().mockResolvedValue({
        generatedResponse: "flowchart TD\n A-->B",
        error: null,
      });
      const { generate, getError } = setup({ onTextSubmit });

      await generate("ab");
      expect(getError()).not.toBeNull();

      await generate("draw a flowchart");
      expect(getError()).toBeNull();
    });
  });

  describe("repair flow", () => {
    it("reuses the last assistant message instead of adding new messages", async () => {
      let submitProps: TTTDDialog.OnTextSubmitProps | undefined;
      const onTextSubmit = vi.fn<OnTextSubmit>(async (props) => {
        submitProps = props;
        props.onStreamCreated?.();
        props.onChunk?.("flowchart TD\n A-->C");
        return { generatedResponse: "flowchart TD\n A-->C", error: null };
      });
      const { generate, getMessages } = setup({
        onTextSubmit,
        messages: [
          message("1", "user", "u1"),
          message("2", "assistant", "a1"),
          message("3", "user", "u2"),
          message("4", "assistant", "broken mermaid", {
            error: "Parse error",
            errorType: "parse",
            errorDetails: "{}",
          }),
        ],
      });

      await generate("fix the diagram", true);

      expect(submitProps!.messages).toEqual([
        { role: "assistant", content: "a1" },
        { role: "user", content: "u2" },
        { role: "assistant", content: "broken mermaid" },
        { role: "user", content: "fix the diagram" },
      ]);

      const messages = getMessages();
      expect(messages).toHaveLength(4);
      expect(messages.filter((msg) => msg.type === "user")).toHaveLength(2);
      expect(messages[3]).toMatchObject({
        id: "4",
        type: "assistant",
        content: "flowchart TD\n A-->C",
        isGenerating: false,
      });
      expect(messages[3].error).toBeFalsy();
      expect(messages[3].errorType).toBeUndefined();
      expect(messages[3].errorDetails).toBeUndefined();
    });
  });

  describe("aborting", () => {
    it("handleAbort aborts the in-flight request signal and no error is surfaced", async () => {
      const deferred = createDeferred<TTTDDialog.OnTextSubmitRetValue>();
      let signal: AbortSignal | undefined;
      const onTextSubmit = vi.fn<OnTextSubmit>((props) => {
        signal = props.signal;
        return deferred.promise;
      });
      const { hook, getMessages, getError } = setup({ onTextSubmit });

      let pending!: Promise<void>;
      act(() => {
        pending = hook.result.current.onGenerate({
          prompt: "draw a flowchart",
        });
      });

      expect(signal!.aborted).toBe(false);

      act(() => {
        hook.result.current.handleAbort();
      });

      expect(signal!.aborted).toBe(true);

      await act(async () => {
        // error shape that relies solely on `signal.aborted` for detection
        deferred.resolve({
          error: new RequestError({ message: "boom", status: 500 }),
        });
        await pending;
      });

      expect(getError()).toBeNull();
      expect(getMessages()[1].error).toBeUndefined();
      expect(getMessages()[1].isGenerating).toBe(false);
    });

    it("handleAbort is a no-op when nothing is generating", () => {
      const onTextSubmit = vi.fn<OnTextSubmit>();
      const { hook } = setup({ onTextSubmit });

      expect(() => hook.result.current.handleAbort()).not.toThrow();
    });

    it("aborts the previous in-flight request when a new generation starts", async () => {
      const first = createDeferred<TTTDDialog.OnTextSubmitRetValue>();
      const signals: AbortSignal[] = [];
      const onTextSubmit = vi
        .fn<OnTextSubmit>()
        .mockImplementationOnce((props) => {
          signals.push(props.signal!);
          return first.promise;
        })
        .mockImplementationOnce(async (props) => {
          signals.push(props.signal!);
          return { generatedResponse: "flowchart TD\n A-->B", error: null };
        });
      const { hook } = setup({ onTextSubmit });

      let pending!: Promise<void>;
      act(() => {
        pending = hook.result.current.onGenerate({ prompt: "first prompt" });
      });

      await act(async () => {
        await hook.result.current.onGenerate({ prompt: "second prompt" });
      });

      expect(signals).toHaveLength(2);
      expect(signals[0].aborted).toBe(true);
      expect(signals[1].aborted).toBe(false);

      await act(async () => {
        first.resolve({ error: new RequestError({ message: "Aborted" }) });
        await pending;
      });
    });
  });
});
