import { useEffect, useRef } from 'react';

/**
 * Retrofits an existing hand-rolled modal/dialog element with the
 * accessibility behaviour a proper dialog needs — Escape-to-close, a focus
 * trap (Tab/Shift+Tab stays inside the dialog), body scroll locking while
 * open, and focus restoration on close — without requiring any change to
 * the component's existing DOM structure, backdrop-click handling, or
 * mount/unmount (AnimatePresence) logic.
 *
 * Usage: call this once per modal instance at the top of the component
 * (it only takes effect while the modal is actually mounted), then attach
 * the returned ref plus `role="dialog"` / `aria-modal="true"` to the modal's
 * existing outer container element.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const containerRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusable = (): HTMLElement[] =>
      Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );

    // If focus isn't already inside the dialog (e.g. an input with autoFocus),
    // move it to the first focusable element so keyboard/screen-reader users
    // land inside the dialog when it opens.
    const raf = requestAnimationFrame(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        getFocusable()[0]?.focus();
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab') {
        const items = getFocusable();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return containerRef;
}
