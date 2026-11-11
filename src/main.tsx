import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";
// tarus kabuk animasyon standardı (§13a), yerleşime dokunmadan.
import "./hareket.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
