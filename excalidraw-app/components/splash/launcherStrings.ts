export const LAUNCHER_STRINGS = {
  inputPlaceholder: "Type a template or describe a diagram…",
  inputAriaLabel: "Type a template name or describe a diagram",
  go: "Go",
  browse: "Browse…",
  dropPasteHint: "or drop / paste a .excalidraw file here",
  dragOverHint: "Drop to open the .excalidraw file",
  libraryFileMessage: "That's a library file — open it from the Library panel.",
  templateLoaded: (name: string) => `Loaded the “${name}” template.`,
  fileOpened: (fileName: string) => `Opened “${fileName}”.`,
  noMatch: (query: string) =>
    `No template matches “${query}”. Try one of the templates below.`,
} as const;
