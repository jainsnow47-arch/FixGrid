import { motion, useReducedMotion } from 'motion/react';
import { AnimatedCounter } from './AnimatedCounter.jsx';

export const FG_EASE = [0.16, 1, 0.3, 1];

export function PageTransition({ children, className = '' }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: FG_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function RevealSection({ children, className = '', delay = 0, immediate = false }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  if (immediate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay, ease: FG_EASE }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.32, delay, ease: FG_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerGrid({ children, className = '', immediate = false, stagger = 0.05 }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger },
    },
  };
  if (immediate) {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        exit="hidden"
        variants={containerVariants}
        className={className}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.06 }}
      variants={containerVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '' }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.26, ease: FG_EASE },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MetricTile({
  label,
  value,
  textValue = null,
  hint = '',
  icon: Icon = null,
  accent = 'forest', // 'forest' | 'orange' | 'danger' | 'sage'
  onClick = null,
}) {
  const reduced = useReducedMotion();
  const toneMap = {
    forest: { value: 'text-[#245B45]', iconBg: 'bg-[#D5EBDD] text-[#245B45]' },
    orange: { value: 'text-[#D96522]', iconBg: 'bg-[#FDE6D8] text-[#B84A14]' },
    danger: { value: 'text-[#9B2226]', iconBg: 'bg-[#F3D7DD] text-[#9B2226]' },
    sage: { value: 'text-[#1A4332]', iconBg: 'bg-[#DCEBF3] text-[#245B45]' },
  };
  const tone = toneMap[accent] || toneMap.forest;
  const Wrapper = onClick ? motion.button : motion.div;

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick || undefined}
      whileHover={reduced ? undefined : { y: -2 }}
      transition={{ duration: 0.16, ease: FG_EASE }}
      className={`text-left w-full h-full rounded-xl bg-[#FAF8EE] border border-[#245B45]/14 p-4 sm:p-5 transition-colors hover:border-[#245B45]/30 ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#55665F]">{label}</span>
        {Icon && (
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone.iconBg}`}>
            <Icon className="w-4 h-4" />
          </span>
        )}
      </div>
      <div className={`mt-2.5 text-2xl sm:text-3xl font-bold font-display tracking-tight ${tone.value}`}>
        {textValue !== null ? (
          <span className="text-base sm:text-lg font-semibold">{textValue}</span>
        ) : (
          <AnimatedCounter value={value} />
        )}
      </div>
      {hint && <p className="text-[11px] text-[#55665F] mt-1">{hint}</p>}
    </Wrapper>
  );
}

export function SegmentedTabs({ options, value, onChange, layoutId = 'fg-tabs', className = '' }) {
  return (
    <div className={`inline-flex items-center gap-1 p-1 bg-[#E8E4CE] rounded-lg ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              active ? 'text-[#245B45]' : 'text-[#55665F] hover:text-[#24332D]'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                className="absolute inset-0 bg-white rounded-md shadow-xs"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
              <span>{opt.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
