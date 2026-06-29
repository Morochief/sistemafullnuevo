// Shared animation variants for consistent motion across all components
import { Variants, Transition } from 'motion/react';

// Page/tab transitions
export const pageTransition: Transition = { duration: 0.22 };

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

// Card/metric animations
export const cardEasing = [0.22, 1, 0.36, 1] as const;

export const cardTransition: Transition = { duration: 0.3, ease: cardEasing };

export const cardVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

// Modal animations (spring physics)
export const modalSpring = { type: 'spring' as const, stiffness: 300, damping: 25 };

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
};

// Simple fade
export const fadeTransition: Transition = { duration: 0.15 };
export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// Staggered children
export const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: cardEasing } },
};
