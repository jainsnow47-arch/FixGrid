import { useEffect, useState } from 'react';
import { Building2, AlertTriangle, Timer } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { formatDateTime } from '../../utils/formatters.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function GovDepartmentsPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiRequest('/api/government/dashboard').then(setData);
  }, []);

  return (
    <DashboardLayout
      title="Departments & Deadlines"
      subtitle="Monitor workload across city departments and review automatic SLA escalation alerts"
    >
      <div className="space-y-6">
        <StaggerGrid immediate className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data?.departments || []).map((d) => {
            const total = Math.max(1, Number(d.total_assigned) || 0);
            const pct = Math.min(100, Math.round(((Number(d.active_open) || 0) / total) * 100));
            return (
              <StaggerItem key={d.id}>
                <Card interactive className="h-full flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-tabular font-bold text-[#F07832]">{d.code}</span>
                      <span className="text-[#55665F]">{d.jurisdiction}</span>
                    </div>
                    <h3 className="font-display text-base font-bold text-[#24332D] flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#245B45] shrink-0" />
                      <span>{d.name}</span>
                    </h3>
                    <p className="text-xs text-[#55665F] leading-relaxed">{d.description}</p>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-[#245B45]/10">
                    <div className="w-full h-1.5 rounded-full bg-[#E8E4CE] overflow-hidden">
                      <div className="h-full bg-[#245B45]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs font-mono-tabular">
                      <span>Assigned: <strong>{d.total_assigned}</strong></span>
                      <span className="text-[#F07832]">Open: <strong>{d.active_open}</strong></span>
                    </div>
                  </div>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerGrid>

        <Card animate delay={0.1} className="space-y-3">
          <h2 className="font-display text-base font-bold text-[#245B45] flex items-center gap-2">
            <Timer className="w-4 h-4 text-[#F07832]" />
            <span>SLA Escalation Log</span>
          </h2>
          {!data?.recentEscalations?.length ? (
            <p className="text-xs text-[#55665F]">No overdue deadline escalations recorded.</p>
          ) : (
            <div className="space-y-2">
              {data.recentEscalations.map((e) => (
                <div key={e.id} className="rounded-xl bg-[#F3D7DD]/45 border border-[#9B2226]/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-semibold text-[#7B1E1E] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{e.tracking_code} — {e.title}</span>
                    </p>
                    <p className="text-[#24332D] mt-0.5">{e.reason}</p>
                  </div>
                  <span className="font-mono-tabular text-[#55665F] shrink-0">
                    Level {e.from_level} → {e.to_level} · {formatDateTime(e.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
