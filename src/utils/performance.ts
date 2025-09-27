/**
 * Performance monitoring and optimization utilities
 */

export const measurePerformance = () => {
  if (typeof window === 'undefined') return;

  // Measure Core Web Vitals
  const measureWebVitals = () => {
    // Largest Contentful Paint (LCP)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
    }).observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
    }).observe({ entryTypes: ['layout-shift'] });

  };

  // Measure resource loading times
  const measureResourceTiming = () => {
    const resources = performance.getEntriesByType('resource');
    resources.forEach((resource) => {
      if (resource.name.includes('.css') || resource.name.includes('.js')) {
        // Resource timing measurement
      }
    });
  };

  // Run measurements after page load
  if (document.readyState === 'complete') {
    measureWebVitals();
    measureResourceTiming();
  } else {
    window.addEventListener('load', () => {
      measureWebVitals();
      measureResourceTiming();
    });
  }
};


// Initialize performance optimizations
export const initPerformanceOptimizations = () => {
  measurePerformance();
};
