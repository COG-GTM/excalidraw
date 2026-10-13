---
name: add-editor-action
description: Add a new editor action to packages/excalidraw/actions (e.g. "Select all of same type") and expose it in the element context menu and command palette, with i18n, tests, an in-browser recording and a PR. Use when asked to add, implement or build a new editor action, context-menu item or command-palette command. Pass the action description as the argument.
---

# Add an editor action

Action to build: **$ARGUMENTS**

Branch off latest `master` (`devin/$(date +%s)-<action-slug>`). Reference implementation: the "Select all of same type" PR (https://github.com/COG-GTM/excalidraw/pull/16), action file `actionSelectAllOfSameType.ts`.

## 1. Write the action

- Actions are plain objects implementing `Action` in `packages/excalidraw/actions/types.ts` (required: `name`, `label`, `perform`; optional: `icon`, `keyTest`, `predicate`, `keywords`, `trackEvent`, `viewMode`, `PanelComponent`).
- Create `packages/excalidraw/actions/action<Name>.ts` (`.tsx` only if it renders JSX). Model it on the closest existing action, for example `actionSelectAll.ts` for selection changes.
- Wrap the object in `register({...})` from `./register`, which adds it to the global `actions` array at module load.
- Add the `name` string to the `ActionName` union in `types.ts`.
- Export it from `packages/excalidraw/actions/index.ts`. `App.tsx` calls `this.actionManager.registerAll(actions)`, and `ActionManager` (`manager.tsx`) keys actions by name and runs them through `executeAction(action, source)`.
- `perform(elements, appState, formData, app)` returns `{ elements?, appState?, captureUpdate }`, or `false` for a no-op. Use `CaptureUpdateAction.IMMEDIATELY` for user-visible edits that should be undoable.
- Add a `predicate` that decides when the action applies (e.g. `getSelectedElements(elements, appState).length > 0`). Set `viewMode: false` if it edits the scene.
- Reuse the filtering of the existing action you modelled it on (for selection: skip `isDeleted`, text bound to a container, and `locked`; run ids through `selectGroupsForSelectedElements`).

## 2. Wire up the UI

- **Context menu**: add the action to the right list in `App.tsx` → `getContextMenuItems` (the element menu is the list with `actionCopy`, `actionPaste`, `CONTEXT_MENU_SEPARATOR`, ...). Import it from `../actions`. `ContextMenu.tsx` already filters items by `predicate` and runs them with source `"contextMenu"`.
- **Command palette**: add `actionManager.actions.<name>` to `elementsCommands` (or the matching list) in `components/CommandPalette/CommandPalette.tsx`. `actionToCommand` converts it, and the elements category applies a "selection non-empty" predicate when the action has none.

## 3. i18n

- Add label keys to `packages/excalidraw/locales/en.json`, under `labels`, next to related keys.
- `ContextMenu` and `CommandPalette` translate labels with `t(label(...))` and **no interpolation params**. For dynamic wording, make `label` a function `(elements, appState, app) => key` that returns a different key per case (e.g. `labels.selectAllOfType.rectangle` → "Select all rectangles"). Keep a generic fallback key. Do not use `{{placeholders}}`.

## 4. Tests

- **`packages/excalidraw/tests/contextmenu.test.tsx`**: a new element-menu item changes three expected-item lists in `describe("contextMenu element")`. Add the action name to each list, in menu order. One list is typed `ShortcutName[]`; widen it to `(ShortcutName | ActionName)[]` and import `ActionName`. Then refresh the appState snapshots: `yarn vitest run -u packages/excalidraw/tests/contextmenu.test.tsx` Check the snapshot diff only adds the expected entries.
- **Colocated test** `packages/excalidraw/actions/action<Name>.test.tsx`, following `actionFlip.test.tsx` / `actionElementLock.test.tsx`: render `<Excalidraw handleKeyboardGlobally={true} />`, seed with `API.createElement` + `API.setElements`, select with `API.setSelectedElements`, run `API.executeAction(action)`, and assert on `h.elements` / `h.state`. Cover the happy path, each filter (deleted/locked/bound text, etc.), the `predicate`, the label keys, and undo when `captureUpdate` is `IMMEDIATELY`.

## 5. Checks

```bash
yarn test:typecheck
yarn test:code
yarn vitest run packages/excalidraw/actions/action<Name>.test.tsx packages/excalidraw/tests/contextmenu.test.tsx
yarn prettier --check <changed files>
```

`yarn test:other` already flags files on master (`polyfill.ts`, `subset/*`, `tests/helpers/api.ts`), so run prettier on your changed files only and ignore failures elsewhere.

## 6. Prove it in the browser

- Start the app: `cd excalidraw-app && VITE_APP_PORT=3000 yarn -s vite --strictPort` (the port comes from `VITE_APP_PORT`, not `PORT`). Open http://localhost:3000.
- Hand off to the testing agent, which records the flow: build a scene the action applies to, trigger it from the **context menu** and from the **command palette** (Ctrl+/), and show the resulting state. Also show one negative case, such as the item being hidden when the predicate is false or a filtered element being left alone.
- Keep the recording and 2 or more screenshots (menu item visible, result).

## 7. Open the PR

- Every commit message must include the word "feature" (e.g. `feature: add "<label>" action`).
- PR title: `feature: "<label>" action (context menu + command palette)`.
- Description: what the action does, its filtering/predicate, where it is wired, and the label keys. Add the screenshots as a table and the recording, plus the test and typecheck output.
- Post the recording and screenshots as a PR comment too.
