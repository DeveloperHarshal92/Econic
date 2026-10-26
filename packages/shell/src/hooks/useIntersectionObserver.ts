import { useEffect, useState, useRef, RefObject } from 'react';

/**
 * Options configuration for the `useIntersectionObserver` hook.
 */
export interface UseIntersectionObserverOptions {
  /**
   * The element that is used as the viewport for checking visibility of the target.
   * Defaults to the browser viewport if null or omitted.
   */
  root?: Element | Document | null;

  /**
   * Margin around the root. Can have values similar to the CSS margin property,
   * e.g. "0px 0px -50px 0px". Defaults to "0px".
   */
  rootMargin?: string;

  /**
   * A single number or array of numbers indicating at what percentage of target
   * visibility the observer callback should execute (e.g. 0.15 = 15% visible).
   * Defaults to 0.15.
   */
  threshold?: number | number[];

  /**
   * If true, the observer disconnects immediately after the target element first
   * qualifies as intersecting, preserving `isIntersecting: true` permanently.
   * This is optimal for one-time editorial scroll reveals.
   * Defaults to true.
   */
  once?: boolean;

  /**
   * If true, observer attachment is skipped (useful for conditionally deferred components).
   * Defaults to false.
   */
  disabled?: boolean;
}

/**
 * Return shape for the `useIntersectionObserver` hook.
 */
export interface UseIntersectionObserverReturn<T extends HTMLElement = HTMLElement> {
  /**
   * React ref to attach to the target DOM element.
   */
  ref: RefObject<T>;

  /**
   * Boolean state indicating whether the element is currently (or has once been) intersecting.
   */
  isIntersecting: boolean;

  /**
   * The latest IntersectionObserverEntry object for inspection (ratio, boundingClientRect, etc.),
   * or null prior to initial intersection.
   */
  entry: IntersectionObserverEntry | null;
}

/**
 * Reusable IntersectionObserver hook for VÊTU — Minimal Editorial Luxury
 * 
 * Features:
 * - Supports observing elements via returned ref or passed-in external RefObject.
 * - Supports one-time scroll reveals (`once: true`) to permanently disconnect and save CPU cycles.
 * - Prevents redundant React re-renders when intersection state hasn't changed.
 * - Graceful fallback: If `IntersectionObserver` is unsupported, defaults `isIntersecting: true`
 *   to ensure content is never trapped or hidden.
 * - Strict cleanup on unmount or options alteration to prevent memory leaks.
 * - Zero external dependencies, pure React 18 hook.
 */
export function useIntersectionObserver<T extends HTMLElement = HTMLElement>(
  targetRefOrOptions?: RefObject<T> | UseIntersectionObserverOptions,
  maybeOptions?: UseIntersectionObserverOptions
): UseIntersectionObserverReturn<T> {
  const isRefPassed = targetRefOrOptions && 'current' in targetRefOrOptions;
  const passedRef = isRefPassed ? (targetRefOrOptions as RefObject<T>) : null;
  const options: UseIntersectionObserverOptions = (isRefPassed ? maybeOptions : (targetRefOrOptions as UseIntersectionObserverOptions)) || {};

  const {
    root = null,
    rootMargin = '0px',
    threshold = 0.15,
    once = true,
    disabled = false,
  } = options;

  const fallbackRef = useRef<T>(null);
  const targetRef = (passedRef || fallbackRef) as RefObject<T>;

  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const [isIntersecting, setIsIntersecting] = useState<boolean>(() => {
    // Graceful fallback for non-browser or unsupported environments
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return true;
    }
    return false;
  });

  // Track intersection in a ref to avoid duplicate state dispatches
  const isIntersectingRef = useRef<boolean>(isIntersecting);
  const hasTriggeredOnceRef = useRef<boolean>(false);

  useEffect(() => {
    if (disabled) return;

    // Graceful fallback for environments lacking IntersectionObserver
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      if (!isIntersectingRef.current) {
        isIntersectingRef.current = true;
        setIsIntersecting(true);
      }
      return;
    }

    // If already triggered once and once option is enabled, skip re-observing
    if (once && hasTriggeredOnceRef.current) {
      return;
    }

    const node = targetRef.current;
    if (!node) return;

    let observer: IntersectionObserver | null = null;

    try {
      observer = new IntersectionObserver(
        (entries) => {
          const firstEntry = entries[0];
          if (!firstEntry) return;

          const intersecting = firstEntry.isIntersecting;

          // Only trigger state updates when state actually changes or on initial entry
          if (intersecting !== isIntersectingRef.current || entry === null) {
            isIntersectingRef.current = intersecting;
            setEntry(firstEntry);
            setIsIntersecting(intersecting);
          }

          if (intersecting && once) {
            hasTriggeredOnceRef.current = true;
            if (observer) {
              observer.disconnect();
              observer = null;
            }
          }
        },
        { root, rootMargin, threshold }
      );

      observer.observe(node);
    } catch {
      // Fallback on unexpected observer initialization error: reveal content
      if (!isIntersectingRef.current) {
        isIntersectingRef.current = true;
        setIsIntersecting(true);
      }
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [targetRef, root, rootMargin, threshold, once, disabled]);

  return {
    ref: targetRef,
    isIntersecting,
    entry,
  };
}

export default useIntersectionObserver;
