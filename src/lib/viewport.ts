/**
 * Viewport utility to handle dynamic viewport height for mobile keyboards
 * Uses visualViewport API when available, falls back to window.innerHeight
 */
export function setupVisualViewport() {
  const apply = () => {
    // Use visualViewport if available (modern browsers), otherwise use innerHeight
    const vvh = (window.visualViewport?.height || window.innerHeight) / 100;
    document.documentElement.style.setProperty('--vvh', `${vvh}px`);
    
    // Also set dvh unit fallback using CSS calc
    const dvh = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty('--dvh', `${dvh}px`);
  };

  // Apply immediately
  apply();

  // Update on viewport resize (keyboard open/close)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', apply);
  }

  // Update on window resize (fallback for older browsers)
  window.addEventListener('resize', apply);
  
  // Update on orientation change
  window.addEventListener('orientationchange', apply);

  // Cleanup function (though this runs once on mount, so cleanup may not be needed)
  return () => {
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', apply);
    }
    window.removeEventListener('resize', apply);
    window.removeEventListener('orientationchange', apply);
  };
}

