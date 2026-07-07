import "@fontsource/cinzel/400.css";
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/cormorant-sc/400.css";
import "@fontsource/cormorant-sc/600.css";
import "@fontsource/spectral/400.css";
import "@fontsource/spectral/500.css";
import "./index.css";

import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
