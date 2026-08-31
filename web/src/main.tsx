import "@fontsource-variable/noto-sans-kr";
import "@fontsource-variable/noto-serif-kr";
import "maplibre-gl/dist/maplibre-gl.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import "./styles/shell.css";
import "./styles/tokens.css";
import "./styles/open-historia.css";
import "./features/controls/searchable-select.css";

const enableDevTools =
  import.meta.env.DEV &&
  import.meta.env.VITE_DISABLE_REACT_DEVTOOLS !== "true" &&
  !navigator.webdriver;

if (enableDevTools) {
  void import("react-grab");
  void import("react-scan");
}

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Multiverse History root element is missing");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
