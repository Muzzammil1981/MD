import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import DirectoryPage, { NotFoundPage } from "./pages/DirectoryPage";
import { loadBrand } from "./lib/brand";
import { setIndustrySlug } from "./lib/api";
import { routeInfo } from "./lib/route";
import "./index.css";

const render = (node) => ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode>{node}</React.StrictMode>);

async function start() {
  // "/" → the directory of businesses (no single brand)
  if (routeInfo.kind === "directory") { render(<DirectoryPage />); return; }

  // /<slug> or /<slug>/monitor → tell the server which business, then load ITS name/wording/categories first
  if (routeInfo.slug) setIndustrySlug(routeInfo.slug);
  const status = await loadBrand();
  if (status === "notfound") { render(<NotFoundPage />); return; }
  render(<App />);
}
start();
