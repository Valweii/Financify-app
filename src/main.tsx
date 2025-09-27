import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Preload critical resources
const preloadCriticalResources = () => {
  // Preload critical fonts
  const fontLink = document.createElement('link');
  fontLink.rel = 'preload';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
  fontLink.as = 'style';
  document.head.appendChild(fontLink);
  
  // Preload critical images
  const imageLink = document.createElement('link');
  imageLink.rel = 'preload';
  imageLink.href = '/src/assets/financify-hero.jpg';
  imageLink.as = 'image';
  document.head.appendChild(imageLink);
};

// Initialize theme
(() => {
  try {
    const saved = localStorage.getItem('theme');
    const fallback = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const theme = (saved === 'dark' || saved === 'light') ? saved : fallback;
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch {}
})();

// Preload critical resources
preloadCriticalResources();

// Render app
createRoot(document.getElementById("root")!).render(<App />);
