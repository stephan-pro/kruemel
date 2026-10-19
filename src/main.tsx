import { render } from "preact";
import { App } from "./ui/App";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Element #app fehlt in index.html");
}
render(<App />, root);
