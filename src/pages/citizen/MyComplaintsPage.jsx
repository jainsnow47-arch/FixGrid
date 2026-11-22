import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Star, RotateCcw, ClipboardList } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDate, formatSlaRemaining } from '../../utils/formatters.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SeverityTag, StatusTag } from '../../components/ui/StatusTag.jsx';
import { ComplaintDetailModal } from '../../components/complaints/ComplaintDetailModal.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { AnimatePresence, motion } from 'motion/react';
import { FG_EASE, SegmentedTabs, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function MyComplaintsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'active' | 'resolved'
  const [detailId, setDetailId] = useState(null);
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reopen, setReopen] = useState(false);

  const load = () => {
    setLoading(true);
    apiRequest('/api/complaints/my')
      .then((d) => setComplaints(d.complaints || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = complaints.filter((c) => {
    if (filterTab === 'active') return c.status !== 'Resolved';
    if (filterTab === 'resolved') return c.status === 'Resolved';
    return true;
  });

  const submitFeedback = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/complaints/${feedbackTarget.id}/feedback`, {
        method: 'POST',
        body: { rating, comment, reopen },
      });
      showToast(reopen ? 'Report reopened and sent back to the department.' : 'Thank you for rating the repair!', 'success');
      setFeedbackTarget(null);
      setComment('');
      setReopen(false);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <DashboardLayout
      title="My Reports"
      subtitle="Follow step-by-step progress, check repair deadlines, and review completed work"
      primaryAction={
        <Button variant="primary" size="sm" onClick={() => navigate('/citizen/report')}>
          <PlusCircle className="w-4 h-4" />
          <span>Report Issue</span>
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedTabs
            layoutId="my-complaints-filter"
            value={filterTab}
            onChange={setFilterTab}
            options={[
              { value: 'all', label: `All (${complaints.length})` },
              { value: 'active', label: `Active (${complaints.filter((c) => c.status !== 'Resolved').length})` },
              { value: 'resolved', label: `Resolved (${complaints.filter((c) => c.status === 'Resolved').length})` },
            ]}
          />
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="space-y-3"
            >
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <Skeleton className="h-5 w-1/3 mb-2" />
                  <Skeleton className="h-6 w-2/3" />
                </Card>
              ))}
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              key={`empty-${filterTab}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: FG_EASE }}
            >
              <EmptyState
                icon={ClipboardList}
                title={complaints.length === 0 ? 'No reports submitted yet' : 'No reports in this view'}
                description={
                  complaints.length === 0
                    ? 'Report a neighborhood issue to receive a tracking ID and follow its progress.'
                    : 'Switch tabs above to view your other civic reports.'
                }
                actionLabel={complaints.length === 0 ? 'Report an Issue' : 'Show All Reports'}
                onAction={() => (complaints.length === 0 ? navigate('/citizen/report') : setFilterTab('all'))}
              />
            </motion.div>
          ) : (
            <StaggerGrid key={`list-${filterTab}`} immediate className="space-y-3.5">
              {filtered.map((c) => {
                const sla = formatSlaRemaining(c.sla_deadline_at, c.status);
                return (
                  <StaggerItem key={c.id}>
                    <Card interactive className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#55665F]">
                          <span className="font-mono-tabular font-bold text-[#245B45]">{c.tracking_code}</span>
                          <span>·</span>
                          <span>{c.category}</span>
                          <span>·</span>
                          <span>{formatDate(c.created_at)}</span>
                        </div>
                        <h3 className="font-display text-base font-bold text-[#24332D]">{c.title}</h3>
                        <p className="text-xs text-[#55665F]">
                          Department: <strong className="text-[#24332D]">{c.department_name || 'Pending'}</strong> · Assigned: {c.assigned_official_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <StatusTag status={c.status} />
                          <SeverityTag severity={c.severity} />
                          <span className={`text-xs font-mono-tabular ${sla.overdue ? 'text-[#A93226] font-semibold' : 'text-[#55665F]'}`}>
                            {sla.label}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Button size="sm" variant="secondary" onClick={() => setDetailId(c.id)}>
                          View Timeline
                        </Button>
                        {c.status === 'Resolved' && !c.citizen_feedback_rating && (
                          <Button size="sm" variant="outline" onClick={() => setFeedbackTarget(c)}>
                            <Star className="w-3.5 h-3.5" />
                            <span>Rate Repair</span>
                          </Button>
                        )}
                      </div>
                    </Card>
                  </StaggerItem>
                );
              })}
            </StaggerGrid>
          )}
        </AnimatePresence>
      </div>

      <ComplaintDetailModal
        complaintId={detailId}
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        onUpdated={load}
      />

      <Modal
        open={Boolean(feedbackTarget)}
        onClose={() => setFeedbackTarget(null)}
        title={`Rate Repair — ${feedbackTarget?.tracking_code}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={submitFeedback} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#24332D] mb-2">How satisfied are you with the repair?</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                    rating >= n
                      ? 'bg-[#FDE6D8] border-[#F07832] text-[#B84A14]'
                      : 'bg-white border-[#245B45]/15 text-[#55665F]'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${rating >= n ? 'fill-[#F07832] text-[#F07832]' : ''}`} />
                  <span>{n}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#24332D] mb-1">Comments</label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Was the problem fixed properly?"
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-[#24332D] cursor-pointer">
            <input type="checkbox" checked={reopen} onChange={(e) => setReopen(e.target.checked)} />
            <RotateCcw className="w-3.5 h-3.5 text-[#F07832]" />
            <span>The problem is still there — reopen this report</span>
          </label>
          <Button type="submit" variant="forest" className="w-full">
            Submit Review
          </Button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
