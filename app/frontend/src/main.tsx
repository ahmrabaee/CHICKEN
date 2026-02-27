import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Mark WebView (Tauri) for layout consistency with browser
if (typeof window !== "undefined" && (window as Window & { __TAURI__?: unknown }).__TAURI__) {
  document.documentElement.setAttribute("data-tauri", "true");
}

createRoot(document.getElementById("root")!).render(<App />);
