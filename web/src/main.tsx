import "@fontsource-variable/noto-sans-kr";
import "@fontsource-variable/noto-serif-kr";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import "./styles/shell.css";
import "./styles/tokens.css";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Multiverse History root element is missing");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
