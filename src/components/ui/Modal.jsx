import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

export function Modal({ open, onClose, title, subtitle = '', children, maxWidth = 'max-w-2xl' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#1A4332]/40 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={`relative z-10 w-full ${maxWidth} max-h-[90vh] overflow-y-auto overflow-x-hidden bg-[#FAF8EE] border border-[#245B45]/20 rounded-xl shadow-2xl`}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-4 sm:px-6 py-4 bg-[#FAF8EE] border-b border-[#245B45]/12">
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-semibold text-[#24332D] break-words">{title}</h2>
                {subtitle && <p className="text-xs text-[#55665F] mt-0.5 break-words">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-[#55665F] hover:text-[#24332D] hover:bg-[#245B45]/10 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 min-w-0">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
