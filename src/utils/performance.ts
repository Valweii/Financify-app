/**
 * Performance monitoring and optimization utilities
 */

export const measurePerformance = () => {
  if (typeof window === 'undefined') return;

  // Measure Core Web Vitals
  const measureWebVitals = () => {
    // Largest Contentful Paint (LCP)
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log('LCP:', lastEntry.startTime);
    });
    observer.observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    const measureFID = () => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          console.log('FID:', entry.processingStart - entry.startTime);
        });
      }).observe({ entryTypes: ['first-input'] });
    };

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      console.log('CLS:', clsValue);
    }).observe({ entryTypes: ['layout-shift'] });

    measureFID();
  };

  // Measure resource loading times
  const measureResourceTiming = () => {
    const resources = performance.getEntriesByType('resource');
    resources.forEach((resource) => {
      if (resource.name.includes('.css') || resource.name.includes('.js')) {
        console.log(`Resource ${resource.name}: ${resource.duration}ms`);
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

// Preload critical resources
export const preloadCriticalResources = () => {
  if (typeof window === 'undefined') return;

  const preloadResource = (href: string, as: string) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  };

  // Preload critical fonts
  preloadResource('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap', 'style');
  
  // Preload critical images
  preloadResource('/src/assets/financify-hero.jpg', 'image');
};

// Optimize images
export const optimizeImages = () => {
  if (typeof window === 'undefined') return;

  // Lazy load images
  const images = document.querySelectorAll('img[data-src]');
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        img.src = img.dataset.src || '';
        img.classList.remove('lazy');
        imageObserver.unobserve(img);
      }
    });
  });

  images.forEach((img) => imageObserver.observe(img));
};

// Initialize performance optimizations
export const initPerformanceOptimizations = () => {
  measurePerformance();
  preloadCriticalResources();
  optimizeImages();
};
