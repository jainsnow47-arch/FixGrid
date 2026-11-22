import { Button } from './Button.jsx';
import { EmptyCanvasIllustration } from './CivicIllustrations.jsx';

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="rounded-xl border border-dashed border-[#245B45]/25 bg-[#FAF8EE]/80 px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex flex-col items-center">
        <EmptyCanvasIllustration className="w-24 h-18 mb-2" />
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-[#D5EBDD] text-[#245B45] flex items-center justify-center -mt-4 border border-[#FAF8EE]">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <h3 className="font-display text-base font-bold text-[#24332D]">{title}</h3>
      <p className="text-sm text-[#55665F] mt-1 max-w-md mx-auto leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-5">
          <Button variant="forest" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
