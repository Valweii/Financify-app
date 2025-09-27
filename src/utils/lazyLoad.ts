/**
 * Lazy loading utilities for performance optimization
 */

// Lazy load components to reduce initial bundle size
export const lazyLoadComponent = (importFn: () => Promise<any>) => {
  return importFn().then(module => module.default || module);
};

// Lazy load screens to reduce critical path
export const lazyLoadScreen = (screenName: string) => {
  return () => import(`@/screens/${screenName}Screen`);
};

// Lazy load heavy libraries
export const lazyLoadSupabase = () => {
  return import('@/integrations/supabase/client');
};

export const lazyLoadCharts = () => {
  return import('recharts');
};

export const lazyLoadPDF = () => {
  return import('pdfjs-dist');
};

// Intersection Observer for lazy loading images
export const createLazyImageObserver = () => {
  if (typeof window === 'undefined') return null;
  
  return new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          img.observer?.unobserve(img);
        }
      }
    });
  }, {
    rootMargin: '50px 0px',
    threshold: 0.01
  });
};

// Preload critical resources
export const preloadCriticalResources = () => {
  if (typeof window === 'undefined') return;
  
  const criticalResources = [
    '/src/main.tsx',
    '/src/index.css'
  ];
  
  criticalResources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource;
    link.as = resource.endsWith('.css') ? 'style' : 'script';
    if (resource.endsWith('.tsx') || resource.endsWith('.js')) {
      link.crossOrigin = 'anonymous';
    }
    document.head.appendChild(link);
  });
};

// Defer non-critical resources
export const deferNonCriticalResources = () => {
  if (typeof window === 'undefined') return;
  
  // Defer Supabase connection until needed
  const deferSupabase = () => {
    const script = document.createElement('script');
    script.src = '/src/integrations/supabase/client.ts';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  };
  
  // Defer after initial load
  setTimeout(deferSupabase, 1000);
};
