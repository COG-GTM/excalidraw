import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";

import {
  restoreCaretPosition,
  saveCaretPosition,
  temporarilyDisableTextEditorBlur,
  useTextEditorFocus,
  withCaretPositionPreservation,
} from "./useTextEditorFocus";

const createTextEditor = (ownerDocument: Document = document) => {
  const textEditor = ownerDocument.createElement("textarea");
  textEditor.className = "excalidraw-wysiwyg";
  textEditor.value = "hello world";
  ownerDocument.body.append(textEditor);
  textEditor.setSelectionRange(2, 4);
  return textEditor;
};

const moveCaretAway = (textEditor: HTMLTextAreaElement) => {
  textEditor.setSelectionRange(0, 0);
  textEditor.blur();
};

describe("useTextEditorFocus helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  describe("saveCaretPosition", () => {
    it("returns the selection of the wysiwyg text editor", () => {
      createTextEditor();
      expect(saveCaretPosition()).toEqual({ start: 2, end: 4 });
    });

    it("returns null when no text editor is mounted", () => {
      expect(saveCaretPosition()).toBeNull();
    });

    it("ignores textareas that are not the wysiwyg editor", () => {
      const textarea = document.createElement("textarea");
      textarea.value = "hello";
      document.body.append(textarea);
      textarea.setSelectionRange(1, 3);
      expect(saveCaretPosition()).toBeNull();
    });
  });

  describe("restoreCaretPosition", () => {
    it("focuses the editor and restores the selection on the next tick", () => {
      const textEditor = createTextEditor();
      moveCaretAway(textEditor);

      restoreCaretPosition({ start: 2, end: 4 });

      expect(document.activeElement).not.toBe(textEditor);
      expect(textEditor.selectionStart).toBe(0);

      vi.runAllTimers();

      expect(document.activeElement).toBe(textEditor);
      expect(textEditor.selectionStart).toBe(2);
      expect(textEditor.selectionEnd).toBe(4);
    });

    it("focuses the editor without touching the selection when position is null", () => {
      const textEditor = createTextEditor();
      textEditor.setSelectionRange(5, 7);
      textEditor.blur();

      restoreCaretPosition(null);
      vi.runAllTimers();

      expect(document.activeElement).toBe(textEditor);
      expect(textEditor.selectionStart).toBe(5);
      expect(textEditor.selectionEnd).toBe(7);
    });

    it("does nothing when the editor is gone by the time the timer fires", () => {
      const textEditor = createTextEditor();
      restoreCaretPosition({ start: 1, end: 1 });
      textEditor.remove();

      expect(() => vi.runAllTimers()).not.toThrow();
      expect(document.activeElement).toBe(document.body);
    });

    it("schedules the restore on the ownerDocument's window", () => {
      const iframe = document.createElement("iframe");
      document.body.append(iframe);
      const ownerDocument = iframe.contentDocument!;
      const ownerWindow = iframe.contentWindow!;
      const setTimeoutSpy = vi
        .spyOn(ownerWindow, "setTimeout")
        .mockImplementation(((cb: () => void) => {
          cb();
          return 0;
        }) as typeof ownerWindow.setTimeout);
      const textEditor = createTextEditor(ownerDocument);
      moveCaretAway(textEditor);
      createTextEditor(document).setSelectionRange(0, 0);

      expect(saveCaretPosition(ownerDocument)).toEqual({ start: 0, end: 0 });

      restoreCaretPosition({ start: 3, end: 6 }, ownerDocument);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
      expect(textEditor.selectionStart).toBe(3);
      expect(textEditor.selectionEnd).toBe(6);
      const mainDocumentEditor = document.querySelector(
        ".excalidraw-wysiwyg",
      ) as HTMLTextAreaElement;
      expect(mainDocumentEditor.selectionStart).toBe(0);
    });

    it("falls back to the global window when ownerDocument has no defaultView", () => {
      const detachedDocument =
        document.implementation.createHTMLDocument("detached");
      expect(detachedDocument.defaultView).toBeNull();
      const textEditor = createTextEditor(detachedDocument);
      textEditor.setSelectionRange(0, 0);

      restoreCaretPosition({ start: 1, end: 5 }, detachedDocument);
      expect(textEditor.selectionStart).toBe(0);

      vi.runAllTimers();

      expect(textEditor.selectionStart).toBe(1);
      expect(textEditor.selectionEnd).toBe(5);
    });
  });

  describe("withCaretPositionPreservation", () => {
    it("prevents close, runs the callback and restores caret in compact text editing", () => {
      const textEditor = createTextEditor();
      const onPreventClose = vi.fn();
      const callback = vi.fn(() => moveCaretAway(textEditor));

      withCaretPositionPreservation(callback, true, true, onPreventClose);

      expect(onPreventClose).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(onPreventClose.mock.invocationCallOrder[0]).toBeLessThan(
        callback.mock.invocationCallOrder[0],
      );
      expect(document.activeElement).not.toBe(textEditor);
      expect(textEditor.selectionStart).toBe(0);

      vi.runAllTimers();

      expect(document.activeElement).toBe(textEditor);
      expect(textEditor.selectionStart).toBe(2);
      expect(textEditor.selectionEnd).toBe(4);
    });

    it("prevents close but does not touch the editor when not editing text", () => {
      const textEditor = createTextEditor();
      const onPreventClose = vi.fn();
      const callback = vi.fn(() => moveCaretAway(textEditor));

      withCaretPositionPreservation(callback, true, false, onPreventClose);
      vi.runAllTimers();

      expect(onPreventClose).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(document.activeElement).not.toBe(textEditor);
      expect(textEditor.selectionStart).toBe(0);
    });

    it("only runs the callback outside compact mode", () => {
      const textEditor = createTextEditor();
      const focus = vi.spyOn(textEditor, "focus");
      const onPreventClose = vi.fn();
      const callback = vi.fn(() => moveCaretAway(textEditor));

      withCaretPositionPreservation(callback, false, true, onPreventClose);
      vi.runAllTimers();

      expect(onPreventClose).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(focus).not.toHaveBeenCalled();
      expect(document.activeElement).not.toBe(textEditor);
      expect(textEditor.selectionStart).toBe(0);
    });

    it("works without an onPreventClose handler", () => {
      const textEditor = createTextEditor();
      const callback = vi.fn(() => moveCaretAway(textEditor));

      expect(() =>
        withCaretPositionPreservation(callback, true, true),
      ).not.toThrow();
      vi.runAllTimers();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(textEditor.selectionStart).toBe(2);
      expect(textEditor.selectionEnd).toBe(4);
    });

    it("still focuses the editor if it only appears after the callback", () => {
      const callback = vi.fn(() => {
        createTextEditor().setSelectionRange(6, 6);
      });

      withCaretPositionPreservation(callback, true, true);
      vi.runAllTimers();

      const textEditor = document.querySelector(
        ".excalidraw-wysiwyg",
      ) as HTMLTextAreaElement;
      expect(document.activeElement).toBe(textEditor);
      expect(textEditor.selectionStart).toBe(6);
    });
  });

  describe("useTextEditorFocus", () => {
    it("saves the caret position to state and restores it", () => {
      const textEditor = createTextEditor();
      const { result } = renderHook(() => useTextEditorFocus());

      expect(result.current.hasSavedPosition).toBe(false);

      act(() => {
        result.current.saveCaretPosition();
      });
      expect(result.current.hasSavedPosition).toBe(true);

      moveCaretAway(textEditor);

      act(() => {
        result.current.restoreCaretPosition();
      });
      expect(textEditor.selectionStart).toBe(0);
      expect(result.current.hasSavedPosition).toBe(true);

      act(() => {
        vi.runAllTimers();
      });

      expect(document.activeElement).toBe(textEditor);
      expect(textEditor.selectionStart).toBe(2);
      expect(textEditor.selectionEnd).toBe(4);
      expect(result.current.hasSavedPosition).toBe(false);
    });

    it("clears a saved position", () => {
      createTextEditor();
      const { result } = renderHook(() => useTextEditorFocus());

      act(() => {
        result.current.saveCaretPosition();
      });
      expect(result.current.hasSavedPosition).toBe(true);

      act(() => {
        result.current.clearSavedPosition();
      });
      expect(result.current.hasSavedPosition).toBe(false);
    });

    it("has no saved position when saving without an editor", () => {
      const { result } = renderHook(() => useTextEditorFocus());

      act(() => {
        result.current.saveCaretPosition();
      });
      expect(result.current.hasSavedPosition).toBe(false);
    });

    it("focuses the editor without changing selection when nothing was saved", () => {
      const textEditor = createTextEditor();
      textEditor.setSelectionRange(5, 7);
      textEditor.blur();
      const { result } = renderHook(() => useTextEditorFocus());

      act(() => {
        result.current.restoreCaretPosition();
        vi.runAllTimers();
      });

      expect(document.activeElement).toBe(textEditor);
      expect(textEditor.selectionStart).toBe(5);
      expect(textEditor.selectionEnd).toBe(7);
    });

    it("uses the provided ownerDocument", () => {
      const detachedDocument =
        document.implementation.createHTMLDocument("detached");
      const textEditor = createTextEditor(detachedDocument);
      createTextEditor(document).setSelectionRange(0, 0);
      const { result } = renderHook(() => useTextEditorFocus(detachedDocument));

      act(() => {
        result.current.saveCaretPosition();
      });
      expect(result.current.hasSavedPosition).toBe(true);

      textEditor.setSelectionRange(0, 0);
      act(() => {
        result.current.restoreCaretPosition();
        vi.runAllTimers();
      });

      expect(textEditor.selectionStart).toBe(2);
      expect(textEditor.selectionEnd).toBe(4);
      expect(result.current.hasSavedPosition).toBe(false);
    });
  });

  describe("temporarilyDisableTextEditorBlur", () => {
    it("disables onblur and restores the original handler after the duration", () => {
      const textEditor = createTextEditor();
      const onBlur = vi.fn();
      textEditor.onblur = onBlur;

      temporarilyDisableTextEditorBlur(document, 100);

      expect(textEditor.onblur).toBeNull();
      textEditor.focus();
      textEditor.blur();
      expect(onBlur).not.toHaveBeenCalled();

      vi.advanceTimersByTime(99);
      expect(textEditor.onblur).toBeNull();

      vi.advanceTimersByTime(1);
      expect(textEditor.onblur).toBe(onBlur);

      textEditor.focus();
      textEditor.blur();
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it("defaults to a 100ms duration", () => {
      const textEditor = createTextEditor();
      const onBlur = vi.fn();
      textEditor.onblur = onBlur;

      temporarilyDisableTextEditorBlur();

      vi.advanceTimersByTime(99);
      expect(textEditor.onblur).toBeNull();
      vi.advanceTimersByTime(1);
      expect(textEditor.onblur).toBe(onBlur);
    });

    it("is a no-op when no text editor is mounted", () => {
      const timerCount = vi.getTimerCount();
      expect(() =>
        temporarilyDisableTextEditorBlur(document, 50),
      ).not.toThrow();
      expect(vi.getTimerCount()).toBe(timerCount);
    });
  });
});
