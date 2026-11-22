import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Lightbulb,
  Link2,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { StatusDistributionChart } from '../../components/charts/CivicCharts.jsx';
import { AnimatePresence, motion } from 'motion/react';
import { FG_EASE, MetricTile, RevealSection, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function GovernmentDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [runningSla, setRunningSla] = useState(false);

  const load = () => {
    apiRequest('/api/government/dashboard').then(setData).catch((e) => showToast(e.message, 'error'));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRunEscalation = async () => {
    setRunningSla(true);
    try {
      const res = await apiRequest('/api/government/sla/run-escalation', { method: 'POST' });
      showToast(
        res.escalatedCount > 0
          ? `Escalated ${res.escalatedCount} overdue report(s).`
          : 'Deadline check finished: no newly overdue reports.',
        'info'
      );
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRunningSla(false);
    }
  };

  const kpis = data?.kpis || {
    total: 0,
    pendingValidation: 0,
    escalated: 0,
    resolved: 0,
    pendingDuplicates: 0,
    pendingPilotRequests: 0,
  };

  return (
    <DashboardLayout
      title="Command Center"
      subtitle="Verify AI sorting, enforce repair deadlines, and approve student challenges"
      primaryAction={
        <Button variant="primary" size="sm" onClick={handleRunEscalation} disabled={runningSla}>
          <Timer className="w-4 h-4" />
          <span>{runningSla ? 'Checking Deadlines...' : 'Check Overdue SLAs'}</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Urgent SLA & Validation Callout Banner */}
        <AnimatePresence>
          {(kpis.escalated > 0 || kpis.pendingValidation > 0) && (
            <RevealSection immediate>
              <div className="rounded-2xl bg-[#1A4332] text-white p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#F07832]">Priority Queue Attention</p>
                  <h2 className="font-display text-lg sm:text-xl font-bold">
                    {kpis.pendingValidation} report(s) need official review · {kpis.escalated} overdue escalation(s)
                  </h2>
                  <p className="text-xs sm:text-sm text-[#D5EBDD]">
                    Review AI-suggested severity and department assignments, or dispatch field crews immediately.
                  </p>
                </div>
                <Button variant="primary" onClick={() => navigate('/government/complaints')}>
                  <span>Open Review Queue</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </RevealSection>
          )}
        </AnimatePresence>

        {/* KPI Row */}
        <StaggerGrid immediate className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StaggerItem>
            <MetricTile
              label="Needs Review"
              value={kpis.pendingValidation}
              icon={ClipboardCheck}
              accent="orange"
              onClick={() => navigate('/government/complaints')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Overdue / Escalated"
              value={kpis.escalated}
              icon={AlertTriangle}
              accent="danger"
              onClick={() => navigate('/government/departments')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Possible Duplicates"
              value={kpis.pendingDuplicates}
              icon={Link2}
              accent="forest"
              onClick={() => navigate('/government/complaints')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Resolved Issues"
              value={kpis.resolved}
              icon={CheckCircle2}
              accent="sage"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Student Proposals"
              value={kpis.pendingPilotRequests}
              icon={Lightbulb}
              accent="forest"
              onClick={() => navigate('/government/challenges')}
            />
          </StaggerItem>
        </StaggerGrid>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card animate delay={0.05} className="lg:col-span-7">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#245B45]">
                  Issue Pipeline by Status
                </h2>
                <p className="text-xs text-[#55665F]">Current count of complaints across all lifecycle stages</p>
              </div>
            </div>
            <StatusDistributionChart data={data?.statusBreakdown || []} />
          </Card>

          <Card animate delay={0.1} className="lg:col-span-5 space-y-4">
            <h2 className="font-display text-base font-bold text-[#245B45]">Quick Official Actions</h2>
            <div className="space-y-2.5">
              <Button variant="forest" className="w-full justify-between" onClick={() => navigate('/government/complaints')}>
                <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Review & Assign Reports</span>
                <span className="font-mono-tabular">{kpis.pendingValidation}</span>
              </Button>
              <Button variant="secondary" className="w-full justify-between" onClick={() => navigate('/government/complaints')}>
                <span className="flex items-center gap-2"><Link2 className="w-4 h-4" /> Check Duplicate Links</span>
                <span className="font-mono-tabular">{kpis.pendingDuplicates}</span>
              </Button>
              <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/government/challenges')}>
                <span className="flex items-center gap-2"><Lightbulb className="w-4 h-4" /> Review Student Pilots</span>
                <span className="font-mono-tabular">{kpis.pendingPilotRequests}</span>
              </Button>
            </div>

            {data?.recentEscalations?.length > 0 && (
              <div className="pt-3 border-t border-[#245B45]/10 space-y-2">
                <p className="text-xs font-semibold text-[#9B2226] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Recent Deadline Alerts</span>
                </p>
                {data.recentEscalations.slice(0, 3).map((esc) => (
                  <div key={esc.id} className="text-xs bg-[#F3D7DD]/50 rounded-lg p-2.5">
                    <span className="font-mono-tabular font-bold text-[#7B1E1E]">{esc.tracking_code}</span>
                    <span className="mx-1">·</span>
                    <span>Level {esc.to_level}</span>
                    <p className="text-[#55665F] mt-0.5">{esc.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card animate delay={0.14}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#245B45]">
                Department Workloads
              </h2>
              <p className="text-xs text-[#55665F]">Active open issues per municipal department</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/government/departments')}>
              View SLA Logs
            </Button>
          </div>
          <StaggerGrid immediate className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(data?.departments || []).map((dept) => {
              const total = Math.max(1, Number(dept.total_assigned) || 0);
              const pct = Math.min(100, Math.round(((Number(dept.active_open) || 0) / total) * 100));
              return (
                <StaggerItem key={dept.id}>
                  <motion.div
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.16, ease: FG_EASE }}
                    className="rounded-xl border border-[#245B45]/14 bg-white p-4 space-y-2.5 h-full"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-tabular font-semibold text-[#F07832]">{dept.code}</span>
                      <span className="text-[#55665F] tabular-nums">{dept.active_open} open</span>
                    </div>
                    <p className="text-sm font-bold text-[#24332D]">{dept.name}</p>
                    <p className="text-xs text-[#55665F]">{dept.jurisdiction}</p>
                    <div className="w-full h-1.5 rounded-full bg-[#E8E4CE] overflow-hidden">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.45, ease: FG_EASE }}
                        style={{ originX: 0, width: `${pct}%` }}
                        className="h-full bg-[#245B45]"
                      />
                    </div>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        </Card>
      </div>
    </DashboardLayout>
  );
}
