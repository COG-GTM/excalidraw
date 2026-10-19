# Guidelines

- For new DOM/browser API usage, use `app.ownerDocument` and `app.ownerWindow` instead of globals; without `app`, derive them from the mounted node's `ownerDocument` and its `defaultView`.
- In tests, the same applies: mock browser APIs on `h.app.ownerWindow` (e.g. `h.app.ownerWindow.HTMLElement.prototype.scrollIntoView`, `h.app.ownerWindow.devicePixelRatio`), and restore any prototype you patch in `afterEach` so it doesn't leak into other tests.
