import { useEffect, useState } from 'react';
import { ShieldCheck, Link2, Lightbulb, Sparkles, Search } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { COMPLAINT_STATUSES, ISSUE_CATEGORIES, formatSlaRemaining } from '../../utils/formatters.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SeverityTag, StatusTag } from '../../components/ui/StatusTag.jsx';
import { AnimatePresence, motion } from 'motion/react';
import { FG_EASE, SegmentedTabs, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function GovComplaintsPage() {
  const { showToast } = useToast();
  const [complaints, setComplaints] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [duplicateLinks, setDuplicateLinks] = useState([]);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'review' | 'escalated' | 'resolved'
  const [searchQuery, setSearchQuery] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [challengeTarget, setChallengeTarget] = useState(null);
  const [challengeForm, setChallengeForm] = useState({
    title: '',
    description: '',
    expectedOutcome: '',
    skillsText: 'IoT Sensors, GIS Mapping, React',
    difficulty: 'Intermediate',
    deadline: '2027-02-15',
  });

  const load = () => {
    apiRequest('/api/government/complaints')
      .then((d) => {
        setComplaints(d.complaints || []);
        setDepartments(d.departments || []);
        setDuplicateLinks(d.duplicateLinks || []);
      })
      .catch((e) => showToast(e.message, 'error'));
  };

  useEffect(() => {
    load();
  }, []);

  const filteredComplaints = complaints.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.tracking_code.toLowerCase().includes(q) ||
      (c.ward || '').toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filterTab === 'review') return c.status === 'Awaiting official validation' || c.status === 'Submitted' || c.status === 'AI analysis completed';
    if (filterTab === 'escalated') return c.status === 'Escalated' || c.is_overdue;
    if (filterTab === 'resolved') return c.status === 'Resolved';
    return true;
  });

  const openValidate = (c) => {
    setEditTarget(c);
    setEditForm({
      category: c.category,
      severity: c.severity,
      departmentId: c.department_id || departments[0]?.id || '',
      status: c.status === 'Awaiting official validation' ? 'Assigned' : c.status,
      assignedOfficialName: c.assigned_official_name || 'Nodal Officer',
      resolutionNotes: c.resolution_notes || '',
      note: '',
    });
  };

  const handleSaveValidation = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/government/complaints/${editTarget.id}`, {
        method: 'PATCH',
        body: editForm,
      });
      showToast(`Updated ${editTarget.tracking_code} with your official decision.`, 'success');
      setEditTarget(null);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDuplicateDecision = async (linkId, decision) => {
    try {
      const res = await apiRequest(`/api/government/duplicates/${linkId}`, {
        method: 'PATCH',
        body: { decision },
      });
      showToast(res.message, 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const openConvertChallenge = (c) => {
    setChallengeTarget(c);
    setChallengeForm({
      title: `Innovation Challenge: ${c.title}`,
      description: `Develop a practical engineering prototype addressing: ${c.description}`,
      expectedOutcome: `Field-ready pilot concept compatible with ${c.department_name || 'city operations'}.`,
      skillsText: 'IoT Sensors, Data Analytics, GIS Mapping, React',
      difficulty: 'Intermediate',
      deadline: '2027-02-15',
    });
  };

  const handleConvertChallenge = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/government/challenges/convert', {
        method: 'POST',
        body: {
          complaintId: challengeTarget.id,
          title: challengeForm.title,
          description: challengeForm.description,
          expectedOutcome: challengeForm.expectedOutcome,
          skillsRequired: challengeForm.skillsText.split(',').map((s) => s.trim()).filter(Boolean),
          difficulty: challengeForm.difficulty,
          deadline: challengeForm.deadline,
        },
      });
      showToast(`Published challenge ${res.challengeCode}.`, 'success');
      setChallengeTarget(null);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <DashboardLayout
      title="Review & Assign Issues"
      subtitle="Verify or override AI suggestions, link duplicates safely, and turn recurring problems into student challenges"
    >
      <div className="space-y-6">
        {/* Duplicate Link Review Queue */}
        <AnimatePresence>
          {duplicateLinks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: FG_EASE }}
            >
              <Card className="bg-[#FBF0D9]/65 border-[#C4841D]/30 space-y-3">
                <h2 className="font-display text-base font-bold text-[#8C520A] flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  <span>Possible Duplicate Pairs (Original reports are always preserved)</span>
                </h2>
                <div className="space-y-2.5">
                  {duplicateLinks.map((dl) => (
                    <div key={dl.id} className="rounded-xl bg-white border border-[#245B45]/12 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-semibold text-[#24332D]">
                          <span className="font-mono-tabular text-[#245B45]">{dl.primary_code}</span> ({dl.primary_title})
                          <span className="mx-2 text-[#F07832]">↔</span>
                          <span className="font-mono-tabular text-[#245B45]">{dl.duplicate_code}</span> ({dl.duplicate_title})
                        </p>
                        <p className="text-[#55665F] mt-0.5">
                          {Math.round(dl.similarity_score * 100)}% match · {Math.round(dl.distance_meters)}m apart · {dl.reason} · Status: <strong>{dl.status}</strong>
                        </p>
                      </div>
                      {dl.status === 'Pending review' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" variant="forest" onClick={() => handleDuplicateDecision(dl.id, 'Confirmed')}>
                            Confirm Link
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDuplicateDecision(dl.id, 'Rejected')}>
                            Keep Separate
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <SegmentedTabs
            layoutId="gov-complaints-filter"
            value={filterTab}
            onChange={setFilterTab}
            options={[
              { value: 'all', label: `All (${complaints.length})` },
              { value: 'review', label: 'Needs Review' },
              { value: 'escalated', label: 'Overdue' },
              { value: 'resolved', label: 'Resolved' },
            ]}
          />
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-[#55665F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, ward, category..."
              className="w-full rounded-lg border border-[#245B45]/20 bg-white pl-9 pr-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Complaints Queue */}
        <AnimatePresence mode="wait">
          <StaggerGrid key={filterTab} immediate className="space-y-3">
            {filteredComplaints.map((c) => {
              const sla = formatSlaRemaining(c.sla_deadline_at, c.status);
              return (
                <StaggerItem key={c.id}>
                  <Card interactive className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#55665F]">
                        <span className="font-mono-tabular font-bold text-[#245B45]">{c.tracking_code}</span>
                        <span>·</span>
                        <span>{c.category}</span>
                        <span>·</span>
                        <span>{c.ward || c.address}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-[#245B45]">
                          <Sparkles className="w-3 h-3 text-[#F07832]" /> AI suggested {c.ai_recommended_severity}
                        </span>
                      </div>
                      <h3 className="font-display text-base font-bold text-[#24332D]">{c.title}</h3>
                      <p className="text-xs text-[#55665F]">
                        Department: <strong className="text-[#24332D]">{c.department_name || 'Unassigned'}</strong> · Officer: {c.assigned_official_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <StatusTag status={c.status} />
                        <SeverityTag severity={c.severity} />
                        <span className={`text-xs font-mono-tabular ${sla.overdue ? 'text-[#A93226] font-bold' : 'text-[#55665F]'}`}>
                          {sla.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button size="sm" variant="forest" onClick={() => openValidate(c)}>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Review & Update</span>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openConvertChallenge(c)}>
                        <Lightbulb className="w-3.5 h-3.5" />
                        <span>Make Challenge</span>
                      </Button>
                    </div>
                  </Card>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        </AnimatePresence>
      </div>

      {/* Validate / Override Modal */}
      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={`Official Decision — ${editTarget?.tracking_code}`}
        subtitle="Compare the AI recommendation with your official assessment and assign the right team."
      >
        <form onSubmit={handleSaveValidation} className="space-y-4">
          {editTarget && (
            <div className="rounded-xl bg-[#F5F1DC]/85 border border-[#245B45]/18 p-3.5 text-xs space-y-2 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-[#245B45] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#F07832] shrink-0" />
                  <span>
                    {editTarget.ai_assessment_type ||
                      (String(editTarget.ai_provider || '').startsWith('gemini')
                        ? 'AI Assessment'
                        : 'Automated Assessment')}
                  </span>
                </p>
              </div>
              {editTarget.ai_is_fallback && (
                <p className="text-[11px] text-[#8C520A] bg-[#FBF0D9]/80 border border-[#C4841D]/25 rounded-md px-2.5 py-1.5">
                  Automated assessment used. AI service is temporarily unavailable.
                </p>
              )}
              <p className="text-[#24332D] break-words">
                Category: <strong>{editTarget.ai_predicted_category || editTarget.category}</strong> · Priority:{' '}
                <strong>{editTarget.ai_recommended_severity || editTarget.severity}</strong>
              </p>
              {editTarget.ai_suggested_action && (
                <p className="text-[#245B45] break-words">
                  <strong>Suggested Action:</strong> {editTarget.ai_suggested_action}
                </p>
              )}
              {editTarget.ai_explanation && (
                <p className="text-[#55665F] break-words leading-relaxed">{editTarget.ai_explanation}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Official Category</label>
              <select
                value={editForm.category || ''}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              >
                {ISSUE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Official Urgency</label>
              <select
                value={editForm.severity || ''}
                onChange={(e) => setEditForm({ ...editForm, severity: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              >
                {['Critical', 'High', 'Medium', 'Low'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Assigned Department</label>
              <select
                value={editForm.departmentId || ''}
                onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Report Status</label>
              <select
                value={editForm.status || ''}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              >
                {COMPLAINT_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Assigned Officer / Crew</label>
            <input
              type="text"
              value={editForm.assignedOfficialName || ''}
              onChange={(e) => setEditForm({ ...editForm, assignedOfficialName: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Action Note (Shown in timeline)</label>
            <input
              type="text"
              value={editForm.note || ''}
              onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
              placeholder="e.g., Dispatched road repair crew for morning shift"
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              {editForm.status === 'Rejected'
                ? 'Rejection Reason (Required)'
                : 'Resolution Summary (Required when Resolved)'}
            </label>
            <textarea
              rows={2}
              required={editForm.status === 'Rejected'}
              minLength={editForm.status === 'Rejected' ? 5 : undefined}
              value={editForm.resolutionNotes || ''}
              onChange={(e) => setEditForm({ ...editForm, resolutionNotes: e.target.value, rejectionReason: e.target.value })}
              placeholder={
                editForm.status === 'Rejected'
                  ? 'Explain why this report is rejected (e.g., duplicate outside jurisdiction, insufficient location evidence)...'
                  : 'Summarize field action taken when resolved...'
              }
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>

          <Button
            type="submit"
            variant={editForm.status === 'Rejected' ? 'danger' : 'forest'}
            className="w-full"
          >
            {editForm.status === 'Rejected' ? 'Reject Complaint with Reason' : 'Save Official Decision'}
          </Button>
        </form>
      </Modal>

      {/* Convert Complaint to Challenge Modal */}
      <Modal
        open={Boolean(challengeTarget)}
        onClose={() => setChallengeTarget(null)}
        title={`Publish Student Challenge — ${challengeTarget?.tracking_code}`}
        subtitle="Opens a student innovation challenge without closing the official municipal repair."
      >
        <form onSubmit={handleConvertChallenge} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Challenge Title</label>
            <input
              type="text"
              required
              value={challengeForm.title}
              onChange={(e) => setChallengeForm({ ...challengeForm, title: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Problem & Goal</label>
            <textarea
              rows={3}
              required
              value={challengeForm.description}
              onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Expected Outcome</label>
            <input
              type="text"
              required
              value={challengeForm.expectedOutcome}
              onChange={(e) => setChallengeForm({ ...challengeForm, expectedOutcome: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Skills Needed (comma-separated)</label>
              <input
                type="text"
                value={challengeForm.skillsText}
                onChange={(e) => setChallengeForm({ ...challengeForm, skillsText: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Difficulty</label>
              <select
                value={challengeForm.difficulty}
                onChange={(e) => setChallengeForm({ ...challengeForm, difficulty: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
          </div>
          <Button type="submit" variant="primary" className="w-full">
            Publish Innovation Challenge
          </Button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
