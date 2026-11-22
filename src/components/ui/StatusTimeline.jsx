import { motion } from 'motion/react';
import { Check, CircleDot, AlertTriangle } from 'lucide-react';
import { COMPLAINT_STATUSES, formatDateTime } from '../../utils/formatters.js';

export function StatusTimeline({ currentStatus, history = [] }) {
  const orderedStages = COMPLAINT_STATUSES.filter(
    (s) => s !== 'Reopened' && (s !== 'Escalated' || currentStatus === 'Escalated')
  );
  if (currentStatus === 'Reopened') orderedStages.push('Reopened');

  const currentIdx = orderedStages.indexOf(currentStatus);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {orderedStages.map((stage, idx) => {
          const completed = idx < currentIdx || (currentStatus === 'Resolved' && stage === 'Resolved');
          const active = stage === currentStatus;
          const isEscalated = stage === 'Escalated';

          return (
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.2 }}
              className={`rounded-lg border p-2.5 text-left ${
                active
                  ? isEscalated
                    ? 'bg-[#F3D7DD] border-[#A93226]/40 text-[#7B1E1E]'
                    : 'bg-[#D5EBDD] border-[#245B45]/40 text-[#1A4332]'
                  : completed
                  ? 'bg-[#FAF8EE] border-[#7DBE9E]/50 text-[#245B45]'
                  : 'bg-[#F5F1DC]/60 border-[#245B45]/10 text-[#55665F]'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {completed ? (
                  <Check className="w-3.5 h-3.5 text-[#245B45] shrink-0" />
                ) : active ? (
                  isEscalated ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-[#A93226] shrink-0" />
                  ) : (
                    <CircleDot className="w-3.5 h-3.5 text-[#F07832] shrink-0" />
                  )
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-current opacity-40 inline-block shrink-0" />
                )}
                <span className="text-[11px] font-mono-tabular uppercase tracking-wide">
                  0{idx + 1}
                </span>
              </div>
              <p className="text-xs font-semibold leading-tight">{stage}</p>
            </motion.div>
          );
        })}
      </div>

      {history.length > 0 && (
        <div className="border-t border-[#245B45]/12 pt-4 space-y-2.5">
          <p className="text-xs font-semibold text-[#55665F]">Audit & Status Change Log</p>
          <div className="space-y-2">
            {history.map((item) => (
              <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs py-1.5 border-b border-[#245B45]/8 last:border-0">
                <div>
                  <span className="font-semibold text-[#245B45]">{item.status}</span>
                  <span className="mx-1.5 text-[#55665F]">·</span>
                  <span className="text-[#24332D]">{item.note}</span>
                </div>
                <span className="text-[#55665F] font-mono-tabular shrink-0">
                  {item.actor_name ? `${item.actor_name} · ` : ''}
                  {formatDateTime(item.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
