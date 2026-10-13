---
name: write-action-tests
description: Write focused, test-only vitest unit tests for one existing editor action in packages/excalidraw/actions (colocated action<Name>.test.tsx), run them plus yarn test:typecheck, and open a PR. Use when asked to add tests or coverage for an editor action, or when fanning out test-writing across untested actions. Pass the action file or name as the first argument (e.g. actionAlign).
---

# Write tests for an editor action

Target: **$1** (file `packages/excalidraw/actions/$1.ts` or `$1.tsx`).

Branch off latest `master` as `devin/$(date +%s)-tests-<slug>`. Examples of finished PRs: actionAlign (https://github.com/COG-GTM/excalidraw/pull/18), actionGroup (https://github.com/COG-GTM/excalidraw/pull/21).

## 1. Scope

- **Tests only.** Do not change production code. If you find a real bug, describe it in the PR description with a minimal repro, and don't write a test that locks in the buggy behavior.
- Read the action file and list its exports, `predicate`, `keyTest`, `perform` branches, `captureUpdate` and `PanelComponent`.
- Find existing coverage in all three places before writing anything, so you don't duplicate it:
  - colocated `packages/excalidraw/actions/*.test.tsx`
  - `packages/excalidraw/tests/` (`grep -rn "<actionName>\|<shortcut>" packages/excalidraw/tests`)
  - `packages/element/tests/` (e.g. `align.test.tsx`, `distribute.test.tsx` and `zindex.test.tsx` drive actions through shortcuts)
- Aim for roughly 6–15 meaningful cases that fill the gaps: predicate/enablement, `keyTest` mapping, groups, frames, bound text/containers, locked elements, and history (one undo entry; undo restores state, redo reapplies). Don't add snapshot files unless they're truly needed.

## 2. Write `packages/excalidraw/actions/$1.test.tsx`

Follow `actionFlip.test.tsx` and `actionElementLock.test.tsx`:

```tsx
import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { render, unmountComponent } from "../tests/test-utils";

const { h } = window;

beforeEach(async () => {
  unmountComponent();
  await render(<Excalidraw handleKeyboardGlobally={true} />);
});
```

Seed the scene with `API.createElement` + `API.setElements`, select with `API.setSelectedElements`, run `API.executeAction(action)`, and assert on `h.elements`, `h.state` and `h.history`.

Gotchas:

- `API.setSelectedElements` takes `NonDeletedExcalidrawElement[]`.
- `action.predicate!(...)` / `action.keyTest!(...)` arity is inferred per action, and tsc rejects extra args (e.g. `actionUngroup.predicate!(h.elements, h.state)`).
- Ctrl+Shift shortcuts need the uppercase key (`KEYS.G.toUpperCase()`).
- `Keyboard` helpers send only `key`. For actions that match on `event.code` (e.g. `CODES.QUOTE`), use `fireEvent.keyDown(document, { ctrlKey: true, code })`.
- Without `handleKeyboardGlobally={true}`, keydown on `document` isn't handled. `ActionManager.handleKeyDown` ignores `predicate`.
- jsdom is non-darwin (`KEYS.CTRL_OR_CMD` = `ctrlKey`). To test the mac path, call `vi.resetModules()` and `vi.doMock("@excalidraw/common", …{ isDarwin: true, KEYS: { …, CTRL_OR_CMD: "metaKey" } })`, then `await import("./$1")`.
- History: `API.setElements` isn't recorded, so the next undoable action counts the elements as additions. When a test checks undo, load the scene with `API.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER })`.
- Host props like `gridModeEnabled` aren't mirrored into appState. Read the effective value with `isGridModeEnabled(app)`.
- Non-drag actions don't remove elements from frames (`isElementInFrame` returns early unless `selectedElementsAreBeingDragged`).
- An `IconButton` with `hidden` still renders, so assert on `.hidden`, not on null.

## 3. Verify

```bash
yarn vitest run packages/excalidraw/actions/$1.test.tsx
yarn test:typecheck
yarn prettier --check packages/excalidraw/actions/$1.test.tsx
yarn eslint --max-warnings=0 packages/excalidraw/actions/$1.test.tsx
```

`yarn test:other` already flags unrelated files on master, so check only the new file. No browser testing is needed for a test-only change.

## 4. Open the PR

- One commit, and the message must include "feature" (e.g. `feature: add $1 unit tests`).
- Title: `feature: unit tests for $1`.
- Description: what's covered (grouped by predicate / keyTest / perform / history), any possible bugs with repros, and the pasted vitest + typecheck output with pass counts.
- Report the PR URL, the number of tests, and whether vitest and typecheck passed.
