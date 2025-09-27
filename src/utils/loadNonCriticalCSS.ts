/**
 * Utility to load non-critical CSS asynchronously
 * This helps improve initial page load performance
 */

export const loadNonCriticalCSS = () => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') return;

  // Create a function to load CSS dynamically
  const loadCSS = (href: string, media = 'all') => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.media = media;
    link.crossOrigin = 'anonymous';
    
    // Add to head
    document.head.appendChild(link);
    
    return new Promise((resolve, reject) => {
      link.onload = () => resolve(link);
      link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
    });
  };

  // Load non-critical CSS after a short delay to prioritize critical rendering
  const loadNonCriticalStyles = async () => {
    try {
      // Load non-critical CSS files
      await Promise.all([
        loadCSS('/src/styles/non-critical.css'),
        // Add other non-critical CSS files here as needed
      ]);
      
    } catch (error) {
      console.warn('Failed to load some non-critical CSS:', error);
    }
  };

  // Load after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNonCriticalStyles);
  } else {
    // DOM is already ready
    setTimeout(loadNonCriticalStyles, 100);
  }
};

// Auto-load when this module is imported
loadNonCriticalCSS();
