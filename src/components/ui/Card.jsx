import { motion, useReducedMotion } from 'motion/react';

export function Card({ children, className = '', padding = 'p-5', interactive = false, animate = false, delay = 0 }) {
  const reduced = useReducedMotion();
  const baseClass = `bg-[#FAF8EE] border border-[#245B45]/14 rounded-xl ${padding} ${
    interactive ? 'transition-all duration-150 hover:-translate-y-0.5 hover:border-[#245B45]/30 hover:shadow-sm' : ''
  } ${className}`;

  if (animate && !reduced) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay, ease: [0.16, 1, 0.3, 1] }}
        className={baseClass}
      >
        {children}
      </motion.div>
    );
  }

  return <div className={baseClass}>{children}</div>;
}
