import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { preloadCriticalResources, deferNonCriticalResources } from "./utils/lazyLoad";

(() => {
  try {
    const saved = localStorage.getItem('theme');
    const fallback = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const theme = (saved === 'dark' || saved === 'light') ? saved : fallback;
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch {}
})();

// Preload critical resources immediately
preloadCriticalResources();

// Defer non-critical resources
deferNonCriticalResources();

createRoot(document.getElementById("root")!).render(<App />);
