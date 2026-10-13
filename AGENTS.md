# Guidelines

- For new DOM/browser API usage, use `app.ownerDocument` and `app.ownerWindow` instead of globals; without `app`, derive them from the mounted node's `ownerDocument` and its `defaultView`.
- Every commit message must include the word "feature".
- Run `yarn test:typecheck` and `yarn test:code` before opening a PR.
