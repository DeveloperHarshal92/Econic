import { useState, useEffect } from 'react';

/**
 * Custom React hook to detect and respond to the user's `prefers-reduced-motion` media query.
 * 
 * Features:
 * - Reads `window.matchMedia('(prefers-reduced-motion: reduce)')`.
 * - Attaches standard change event listener (`addEventListener` / fallback `addListener`).
 * - Cleans up event listeners on unmount.
 * - Safely handles SSR, headless, and older browser environments.
 * - Avoids duplicate component re-renders.
 * 
 * @returns boolean `true` if the user prefers reduced motion, `false` otherwise.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
    } else if (typeof (mediaQuery as any).addListener === 'function') {
      (mediaQuery as any).addListener(handleChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (typeof (mediaQuery as any).removeListener === 'function') {
        (mediaQuery as any).removeListener(handleChange);
      }
    };
  }, []);

  return prefersReducedMotion;
}

export default usePrefersReducedMotion;
