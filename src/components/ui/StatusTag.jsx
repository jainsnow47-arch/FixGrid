import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Wrench,
  FileText,
  Sparkles,
  RotateCcw,
  XCircle,
} from 'lucide-react';

// Clean, non-pill semantic indicator pairing an icon + explicit label (WCAG accessible)
export function SeverityTag({ severity }) {
  const map = {
    Critical: { icon: ShieldAlert, text: 'text-[#9B2226]', bg: 'bg-[#F3D7DD]' },
    High: { icon: AlertTriangle, text: 'text-[#B84A14]', bg: 'bg-[#FDE6D8]' },
    Medium: { icon: Clock, text: 'text-[#245B45]', bg: 'bg-[#DCEBF3]' },
    Low: { icon: FileText, text: 'text-[#3D5A4D]', bg: 'bg-[#D5EBDD]' },
  };
  const cfg = map[severity] || map.Medium;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{severity}</span>
    </span>
  );
}

export function StatusTag({ status }) {
  const map = {
    'Submitted': { icon: FileText, cls: 'text-[#55665F] bg-[#E8E4CE]' },
    'AI analysis completed': { icon: Sparkles, cls: 'text-[#2B5876] bg-[#DCEBF3]' },
    'Awaiting official validation': { icon: Clock, cls: 'text-[#9A5B13] bg-[#FBF0D9]' },
    'Assigned': { icon: Wrench, cls: 'text-[#245B45] bg-[#D5EBDD]' },
    'In progress': { icon: Wrench, cls: 'text-[#1E5B70] bg-[#DCEBF3]' },
    'Escalated': { icon: ShieldAlert, cls: 'text-[#9B2226] bg-[#F3D7DD]' },
    'Resolved': { icon: CheckCircle2, cls: 'text-[#1A4332] bg-[#D5EBDD]' },
    'Reopened': { icon: RotateCcw, cls: 'text-[#B84A14] bg-[#FDE6D8]' },
    'Rejected': { icon: XCircle, cls: 'text-[#9B2226] bg-[#F3D7DD]' },
  };
  const cfg = map[status] || map.Submitted;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${cfg.cls}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}
