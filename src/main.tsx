import { render } from "preact";
import { App } from "./ui/App";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Element #app fehlt in index.html");
}

// `npm run demo` builds in mode "demo". Vite replaces the condition at build time, so the demo
// code is not part of the real app.
if (import.meta.env.MODE === "demo") {
  const { startDemo } = await import("./demo/start");
  const demo = await startDemo(localStorage, location.search);
  if (demo.wasReset) {
    // Otherwise every reload would reset the data again.
    history.replaceState(null, "", location.pathname);
  }
  render(<App demo={demo} />, root);
} else {
  render(<App />, root);
}
