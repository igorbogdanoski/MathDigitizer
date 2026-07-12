import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Full backdrop wrapper classes (position/layout/background). */
  className: string;
  ariaLabel: string;
  closeOnBackdropClick?: boolean;
}

/**
 * Shared behavioural wrapper for full-screen dialogs/modals across the app.
 * Handles focus-trapping, Escape-to-close, backdrop-click-to-close, body
 * scroll locking and ARIA dialog semantics — so every modal in the codebase
 * behaves consistently instead of each component hand-rolling its own
 * `fixed inset-0` div with inconsistent (or missing) accessibility behaviour.
 *
 * This component intentionally does NOT prescribe visual styling — pass the
 * exact backdrop classes you already use via `className` so migrating an
 * existing modal is a drop-in replacement of the outer wrapper only.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  className,
  ariaLabel,
  closeOnBackdropClick = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusable = () =>
      containerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      ) ?? [];

    // Autofocus the first focusable element (or the container itself).
    const focusable = getFocusable();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      containerRef.current?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
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
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={containerRef}
      className={className}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onMouseDown={(event) => {
        if (closeOnBackdropClick && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {children}
    </div>,
    document.body
  );
};
