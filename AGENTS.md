# Guidelines

- For new DOM/browser API usage, use `app.ownerDocument` and `app.ownerWindow` instead of globals; without `app`, derive them from the mounted node's `ownerDocument` and its `defaultView`.
- This also applies in tests: after rendering `<Excalidraw />`, build events via the mounted app (e.g. `new h.app.ownerWindow.KeyboardEvent(...)`), not `new KeyboardEvent(...)`.
