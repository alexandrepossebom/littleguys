import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { connectAppStore } from "../stores/app";
import { Popover } from "./Popover";

connectAppStore();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popover />
  </StrictMode>,
);
