import { useEffect, useRef } from 'react';

/**
 * Retrofits an existing hand-rolled modal/dialog element with the
 * accessibility behaviour a proper dialog needs — Escape-to-close, a focus
 * trap (Tab/Shift+Tab stays inside the dialog), body scroll locking while
 * open, and focus restoration on close — without requiring any change to
 * the component's existing DOM structure, backdrop-click handling, or
 * mount/unmount (AnimatePresence) logic.
 *
 * Usage: call this once per modal instance at the top of the component,
 * passing `enabled` = whether the modal is actually open right now. This
 * must be passed explicitly (rather than relying on conditional mounting)
 * for any component that stays mounted regardless of the modal's open
 * state — e.g. components rendered unconditionally at the App root, or
 * page components with an internal modal — otherwise the body-scroll-lock
 * effect fires once on mount and is never cleaned up, permanently
 * disabling page scroll. Attach the returned ref plus `role="dialog"` /
 * `aria-modal="true"` to the modal's existing outer container element.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(onClose: () => void, enabled: boolean = true) {
  const containerRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled]);

  return containerRef;
}
