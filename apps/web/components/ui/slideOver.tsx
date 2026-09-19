"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { slideIn } from "@/lib/utils/motionUtils";

/**
 * A panel that slides in over the page from the right.
 *
 * Native <dialog> + showModal(), the same pattern as the workspace mobile
 * drawer: the browser supplies the focus trap, the Escape handling, the inert
 * background and the backdrop, none of which is worth reimplementing. framer
 * only animates the inner div, because animating the <dialog> itself fights
 * showModal()'s own display toggle.
 */
interface SlideOverProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  testId?: string;
}

export function SlideOver({ open, title, subtitle, onClose, children, testId }: SlideOverProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        // Escape would close the dialog instantly and skip the exit animation.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-label={title}
      data-testid={testId}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-2xl bg-transparent text-foreground backdrop:bg-foreground/30"
    >
      <AnimatePresence onExitComplete={() => dialog.current?.close()}>
        {open && (
          <motion.div
            className="flex h-full flex-col overflow-hidden border-l border-border bg-surface"
            variants={slideIn(reduced)}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-heading text-xl">{title}</h2>
                {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
              </div>
              <button
                autoFocus
                className="cursor-pointer rounded-lg p-2 text-muted transition duration-200 hover:bg-soft hover:text-foreground"
                aria-label="Fermer"
                data-testid="slideover-close"
                onClick={onClose}
              >
                <X size={18} />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}
