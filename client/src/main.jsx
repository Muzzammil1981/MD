import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { loadBrand } from "./lib/brand";
import "./index.css";

/* Load the shop's name / wording / categories first, so the page never flashes the wrong brand. */
loadBrand().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode><App /></React.StrictMode>
  );
});
