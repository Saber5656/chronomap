import { mount } from "./app/appShell";
import { createInitialState } from "./state/appState";
import { createStore } from "./state/store";
import "./ui/styles/base.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error("Missing #app root element.");
}

const store = createStore(createInitialState(new Date()));
mount(app, store);
