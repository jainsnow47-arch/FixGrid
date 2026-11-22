import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardCheck, Clock, MapPin, PlusCircle, ThumbsUp } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatDate, formatSlaRemaining } from '../../utils/formatters.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { SeverityTag, StatusTag } from '../../components/ui/StatusTag.jsx';
import { ComplaintDetailModal } from '../../components/complaints/ComplaintDetailModal.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { AnimatePresence, motion } from 'motion/react';
import { FG_EASE, MetricTile, RevealSection, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function CitizenDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);

  const load = () => {
    setLoading(true);
    apiRequest('/api/complaints/my')
      .then((d) => setComplaints(d.complaints || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const resolvedCount = complaints.filter((c) => c.status === 'Resolved').length;
  const activeCount = complaints.filter((c) => c.status !== 'Resolved').length;
  const totalVotes = complaints.reduce((acc, c) => acc + (c.vote_count || 0), 0);

  return (
    <DashboardLayout
      title="Citizen Overview"
      subtitle="Report local problems, follow repair progress, and support neighborhood fixes"
      primaryAction={
        <Button variant="primary" size="sm" onClick={() => navigate('/citizen/report')}>
          <PlusCircle className="w-4 h-4" />
          <span>Report Issue</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Welcome Action Banner */}
        <RevealSection immediate>
          <div className="rounded-2xl bg-[#1A4332] text-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#7DBE9E]">Resident Portal · {user?.city || 'Mathura'}</p>
              <h2 className="font-display text-xl sm:text-2xl font-bold">
                Welcome back, {user?.name?.split(' ')[0] || 'Neighbor'}
              </h2>
              <p className="text-xs sm:text-sm text-[#D5EBDD] max-w-xl leading-relaxed">
                Spot a pothole, broken streetlight, water leak, or waste pile? Report it in under a minute with a map pin and track every step until repair.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 shrink-0">
              <Button variant="primary" onClick={() => navigate('/citizen/report')}>
                <PlusCircle className="w-4 h-4" />
                <span>Report New Issue</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate('/citizen/community')}
              >
                <MapPin className="w-4 h-4" />
                <span>View City Map</span>
              </Button>
            </div>
          </div>
        </RevealSection>

        {/* KPI Grid */}
        <StaggerGrid immediate className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem>
            <MetricTile
              label="My Reports"
              value={complaints.length}
              icon={ClipboardCheck}
              accent="forest"
              hint="Total issues you logged"
              onClick={() => navigate('/citizen/my-complaints')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="In Progress"
              value={activeCount}
              icon={Clock}
              accent="orange"
              hint="Currently under review or repair"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Completed Repairs"
              value={resolvedCount}
              icon={CheckCircle2}
              accent="sage"
              hint="Verified fixed by officials"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Community Support"
              value={totalVotes}
              icon={ThumbsUp}
              accent="forest"
              hint="Neighbor upvotes on your reports"
            />
          </StaggerItem>
        </StaggerGrid>

        {/* Recent Reports */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[#245B45]">Your Recent Reports</h2>
              <p className="text-xs text-[#55665F]">Click any report to view its full timeline and officer notes.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/citizen/my-complaints')}>
              <span>All Reports</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {[1, 2].map((i) => (
                  <Card key={i}>
                    <Skeleton className="h-5 w-1/3 mb-3" />
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </Card>
                ))}
              </motion.div>
            ) : complaints.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: FG_EASE }}
              >
                <EmptyState
                  icon={PlusCircle}
                  title="You haven’t reported any issues yet"
                  description="Submit your first geotagged report to get a tracking ID and automatic department routing."
                  actionLabel="Report Your First Issue"
                  onAction={() => navigate('/citizen/report')}
                />
              </motion.div>
            ) : (
              <StaggerGrid key="list" immediate className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {complaints.slice(0, 4).map((c) => {
                  const sla = formatSlaRemaining(c.sla_deadline_at, c.status);
                  return (
                    <StaggerItem key={c.id}>
                      <Card interactive className="h-full flex flex-col justify-between space-y-3">
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between text-xs text-[#55665F]">
                            <span className="font-mono-tabular font-semibold text-[#245B45]">{c.tracking_code}</span>
                            <span>{formatDate(c.created_at)}</span>
                          </div>
                          <h3 className="font-display text-base font-bold text-[#24332D] leading-snug">{c.title}</h3>
                          <p className="text-xs text-[#55665F]">
                            {c.category} · {c.department_name || 'Awaiting Department Assignment'}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <StatusTag status={c.status} />
                            <SeverityTag severity={c.severity} />
                          </div>
                        </div>
                        <div className="pt-3 border-t border-[#245B45]/10 flex items-center justify-between text-xs">
                          <span className={sla.overdue ? 'text-[#A93226] font-semibold' : 'text-[#55665F]'}>
                            {sla.label}
                          </span>
                          <Button size="sm" variant="secondary" onClick={() => setDetailId(c.id)}>
                            Track Timeline
                          </Button>
                        </div>
                      </Card>
                    </StaggerItem>
                  );
                })}
              </StaggerGrid>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ComplaintDetailModal
        complaintId={detailId}
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        onUpdated={load}
      />
    </DashboardLayout>
  );
}
