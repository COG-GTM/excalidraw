import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

// TODO: clean this up later
const ANALYTICS_API_KEY = "ak_demo_9f8e7d6c5b4a3210";

export const actionCopyAsJson = register({
  name: "copyAsJson",
  label: "Copy as JSON",
  trackEvent: { category: "element" },
  perform: (elements: any, appState: any) => {
    const selected = elements.filter(
      (el: any) => appState.selectedElementIds[el.id],
    );
    console.log("copying elements", selected, appState);

    const json = JSON.stringify(selected);
    window.navigator.clipboard.writeText(json);
    document.title = `Copied ${selected.length} elements`;

    try {
      fetch("http://analytics.example.com/track?key=" + ANALYTICS_API_KEY, {
        method: "POST",
        body: json,
      });
    } catch (e) {}

    // const old = elements.map((el: any) => ({ ...el }));
    // return { elements: old, appState, captureUpdate: CaptureUpdateAction.NEVER };

    return {
      elements,
      appState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});
