import type { Transition, Variants } from "framer-motion";

/**
 * The app's motion vocabulary, in one file.
 *
 * These are the durations and distances the app already used, lifted out of the
 * three components that had them inline so a fourth does not invent a fifth.
 * Nothing new is introduced here: 0.3s / y:10 is components/ui/reveal.tsx,
 * 0.2s / x:-20 is the mobile drawer in workspaceShell.tsx.
 *
 * Every variant takes `reduced` from useReducedMotion(). globals.css already
 * kills CSS animation under prefers-reduced-motion, but framer-motion writes
 * inline styles the stylesheet cannot reach, so the guard has to be passed in.
 */

export const EASE: Transition = { duration: 0.3, ease: [0.16, 1, 0.3, 1] };

/** The house entrance: fade up a little. */
export function fadeUp(reduced: boolean | null, distance = 10): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : distance },
    visible: { opacity: 1, y: 0, transition: EASE },
    exit: { opacity: 0, y: reduced ? 0 : -distance / 2, transition: { duration: 0.15 } },
  };
}

/** For a panel arriving from an edge. Negative distance comes from the left. */
export function slideIn(reduced: boolean | null, distance = 32): Variants {
  return {
    hidden: { opacity: 0, x: reduced ? 0 : distance },
    visible: { opacity: 1, x: 0, transition: { duration: 0.2 } },
    exit: { opacity: 0, x: reduced ? 0 : distance, transition: { duration: 0.15 } },
  };
}

/**
 * A list whose children arrive one after another rather than all at once.
 * Reduced motion collapses the stagger to zero, so the list simply appears.
 */
export function stagger(reduced: boolean | null, gap = 0.05): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: reduced ? 0 : gap } },
  };
}

/** For a number or badge that should land rather than appear. */
export function popIn(reduced: boolean | null): Variants {
  return {
    hidden: { opacity: 0, scale: reduced ? 1 : 0.92 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 28 },
    },
  };
}
