import { useEffect, useState } from 'react';
import { ThumbsUp, MapPin, Building2, Clock, Sparkles, Link2, MessageSquare, Send } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDateTime, formatSlaRemaining } from '../../utils/formatters.js';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { SeverityTag, StatusTag } from '../ui/StatusTag.jsx';
import { StatusTimeline } from '../ui/StatusTimeline.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';

export function ComplaintDetailModal({ complaintId, open, onClose, onUpdated }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (!open || !complaintId) return;
    setLoading(true);
    apiRequest(`/api/complaints/${complaintId}`)
      .then((res) => setData(res))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [open, complaintId, showToast]);

  const handleVote = async () => {
    if (!user) {
      showToast('Please sign in to support community reports.', 'info');
      return;
    }
    try {
      const res = await apiRequest(`/api/complaints/${complaintId}/vote`, { method: 'POST' });
      setData((prev) =>
        prev
          ? {
              ...prev,
              complaint: { ...prev.complaint, voteCount: res.voteCount, userHasVoted: res.voted },
            }
          : prev
      );
      onUpdated?.();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast('Please sign in to post community feedback.', 'info');
      return;
    }
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await apiRequest(`/api/complaints/${complaintId}/comments`, {
        method: 'POST',
        body: { body: commentText },
      });
      setCommentText('');
      const refreshed = await apiRequest(`/api/complaints/${complaintId}`);
      setData(refreshed);
      onUpdated?.();
      showToast('Comment posted.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  const c = data?.complaint;
  const sla = c ? formatSlaRemaining(c.sla_deadline_at, c.status) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={c ? `${c.tracking_code} — ${c.title}` : 'Complaint Details'}
      subtitle={c ? `${c.category} · ${c.ward || 'Mathura'} · ${c.is_demo ? 'Demo Record' : 'Live Report'}` : ''}
      maxWidth="max-w-3xl"
    >
      {loading || !c ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Primary Media + Key Facts */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
            <div className="md:col-span-2">
              {data.media?.length > 0 ? (
                data.media[0].media_type === 'video' ? (
                  <video src={data.media[0].file_url} controls className="w-full h-48 object-cover rounded-lg border border-[#245B45]/15" />
                ) : (
                  <img
                    src={data.media[0].file_url}
                    alt={c.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-48 object-cover rounded-lg border border-[#245B45]/15"
                  />
                )
              ) : (
                <div className="w-full h-48 rounded-lg bg-[#D5EBDD]/50 border border-[#245B45]/15 flex items-center justify-center text-xs text-[#55665F]">
                  No media attached
                </div>
              )}
            </div>

            <div className="md:col-span-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusTag status={c.status} />
                <SeverityTag severity={c.severity} />
                <span className="text-xs text-[#55665F] font-mono-tabular">
                  {formatDateTime(c.created_at)}
                </span>
              </div>

              <p className="text-sm text-[#24332D] leading-relaxed">{c.description}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#55665F] pt-1">
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#F07832] mt-0.5 shrink-0" />
                  <span>{c.address} ({c.location_source})</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#245B45] mt-0.5 shrink-0" />
                  <span>{c.department_name || 'Pending Assignment'}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Clock className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${sla?.overdue ? 'text-[#A93226]' : 'text-[#245B45]'}`} />
                  <span className={sla?.overdue ? 'text-[#A93226] font-semibold' : ''}>{sla?.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={c.userHasVoted ? 'forest' : 'secondary'}
                    onClick={handleVote}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{c.userHasVoted ? 'Supported' : 'Support Issue'} ({c.voteCount})</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Transparent AI Recommendation Summary */}
          <div className="rounded-lg bg-[#DCEBF3]/55 border border-[#245B45]/15 p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#245B45]">
                <Sparkles className="w-3.5 h-3.5 text-[#F07832]" />
                <span>AI Civic Assessment ({c.ai_provider})</span>
              </div>
              <span className="text-[11px] font-mono-tabular text-[#55665F]">
                Human validation mandatory
              </span>
            </div>
            <p className="text-xs text-[#24332D] leading-relaxed">{c.ai_explanation}</p>
            {c.keywords?.length > 0 && (
              <p className="text-xs text-[#55665F]">
                Keywords: {c.keywords.join(' · ')}
              </p>
            )}
          </div>

          {/* Linked Potential Duplicates */}
          {data.duplicateLinks?.length > 0 && (
            <div className="rounded-lg bg-[#FBF0D9]/70 border border-[#C4841D]/30 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8C520A]">
                <Link2 className="w-3.5 h-3.5" />
                <span>Related / Potential Duplicate Reports (Originals Preserved)</span>
              </div>
              {data.duplicateLinks.map((dl) => (
                <div key={dl.id} className="text-xs text-[#24332D] flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{dl.primary_code}</strong> ↔ <strong>{dl.duplicate_code}</strong> ({Math.round(dl.similarity_score * 100)}% match, {Math.round(dl.distance_meters)}m)
                  </span>
                  <span className="font-semibold text-[#8C520A]">{dl.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Resolution Evidence if Resolved */}
          {c.resolution_notes && (
            <div className="rounded-lg bg-[#D5EBDD]/60 border border-[#245B45]/20 p-4">
              <p className="text-xs font-semibold text-[#1A4332]">Official Resolution Notes</p>
              <p className="text-sm text-[#24332D] mt-1">{c.resolution_notes}</p>
            </div>
          )}

          {/* 8-Stage Timeline */}
          <div className="pt-1">
            <h3 className="text-sm font-semibold text-[#245B45] mb-3">Complaint Lifecycle Timeline</h3>
            <StatusTimeline currentStatus={c.status} history={data.timeline || []} />
          </div>

          {/* Community Comments */}
          <div className="border-t border-[#245B45]/12 pt-4 space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[#245B45]">
              <MessageSquare className="w-4 h-4" />
              <span>Community Feedback & Updates ({data.comments?.length || 0})</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.comments?.length === 0 ? (
                <p className="text-xs text-[#55665F]">No community comments yet.</p>
              ) : (
                data.comments.map((cm) => (
                  <div key={cm.id} className="rounded-lg bg-[#F5F1DC]/80 px-3.5 py-2.5 text-xs">
                    <div className="flex items-center justify-between text-[#55665F]">
                      <span className="font-semibold text-[#24332D]">{cm.author_name} · {cm.author_role}</span>
                      <span className="font-mono-tabular">{formatDateTime(cm.created_at)}</span>
                    </div>
                    <p className="text-[#24332D] mt-1">{cm.body}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleComment} className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={user ? 'Add observation or local context...' : 'Sign in to post a comment'}
                disabled={!user || submittingComment}
                className="flex-1 rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm text-[#24332D] focus:outline-none focus:border-[#245B45]"
              />
              <Button type="submit" variant="forest" size="sm" disabled={!user || submittingComment || !commentText.trim()}>
                <Send className="w-3.5 h-3.5" />
                <span>Post</span>
              </Button>
            </form>
          </div>
        </div>
      )}
    </Modal>
  );
}
