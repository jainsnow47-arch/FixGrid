import { useEffect, useState } from 'react';
import { Lightbulb, CheckCircle2, XCircle, Rocket, PlusCircle } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ISSUE_CATEGORIES } from '../../utils/formatters.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { AnimatePresence } from 'motion/react';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function GovChallengesPage() {
  const { showToast } = useToast();
  const [data, setData] = useState({ challenges: [], applications: [], projects: [] });
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: ISSUE_CATEGORIES[0],
    location: 'Mathura Urban Limits',
    description: '',
    expectedOutcome: '',
    skillsText: 'IoT Sensors, GIS Mapping, React',
    difficulty: 'Intermediate',
    deadline: '2027-02-28',
  });

  const load = () => {
    apiRequest('/api/government/challenges-review')
      .then(setData)
      .catch((e) => showToast(e.message, 'error'));
  };

  useEffect(() => {
    load();
  }, []);

  const handleApplication = async (appId, status) => {
    try {
      await apiRequest(`/api/government/applications/${appId}`, {
        method: 'PATCH',
        body: { status },
      });
      showToast(`Proposal ${status.toLowerCase()}.`, 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleChallengeApproval = async (challengeId, approvalStatus) => {
    try {
      const res = await apiRequest(`/api/government/challenges/${challengeId}/approval`, {
        method: 'PATCH',
        body: { approvalStatus },
      });
      showToast(res.message, 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handlePilotToggle = async (projId, nextApproved) => {
    try {
      const res = await apiRequest(`/api/government/projects/${projId}/pilot`, {
        method: 'PATCH',
        body: { pilotApproved: nextApproved },
      });
      showToast(res.message, 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await apiRequest('/api/government/challenges', {
        method: 'POST',
        body: {
          title: form.title,
          category: form.category,
          location: form.location,
          description: form.description,
          expectedOutcome: form.expectedOutcome || 'Working municipal pilot prototype.',
          skillsRequired: form.skillsText.split(',').map((s) => s.trim()).filter(Boolean),
          difficulty: form.difficulty,
          deadline: form.deadline,
        },
      });
      showToast(res.message, 'success');
      setCreateOpen(false);
      setForm({
        title: '',
        category: ISSUE_CATEGORIES[0],
        location: 'Mathura Urban Limits',
        description: '',
        expectedOutcome: '',
        skillsText: 'IoT Sensors, GIS Mapping, React',
        difficulty: 'Intermediate',
        deadline: '2027-02-28',
      });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout
      title="Challenges & Student Pilots"
      subtitle="Create and approve civic challenges, review student team proposals, and authorize public-sector pilot trials"
      primaryAction={
        <Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>
          <PlusCircle className="w-4 h-4" />
          <span>New Civic Challenge</span>
        </Button>
      }
    >
      <div className="space-y-6">
        <Card animate className="space-y-3">
          <h2 className="font-display text-base font-bold text-[#245B45] flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#F07832]" />
            <span>Published & Pending Civic Challenges ({data.challenges.length})</span>
          </h2>
          <StaggerGrid immediate className="space-y-2.5">
            {data.challenges.map((ch) => (
              <StaggerItem key={ch.id}>
                <div className="rounded-xl bg-white border border-[#245B45]/14 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-mono-tabular text-[#55665F]">
                      {ch.challenge_code} · {ch.category} · Approval: <strong className="text-[#245B45]">{ch.approval_status}</strong>
                    </p>
                    <p className="text-sm font-bold text-[#24332D]">{ch.title}</p>
                    <p className="text-xs text-[#55665F]">{ch.location}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ch.approval_status !== 'Approved' && (
                      <Button size="sm" variant="forest" onClick={() => handleChallengeApproval(ch.id, 'Approved')}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </Button>
                    )}
                    {ch.approval_status !== 'Rejected' && (
                      <Button size="sm" variant="outline" onClick={() => handleChallengeApproval(ch.id, 'Rejected')}>
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Withdraw</span>
                      </Button>
                    )}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </Card>

        <Card animate delay={0.04} className="space-y-3">
          <h2 className="font-display text-base font-bold text-[#245B45] flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#F07832]" />
            <span>Student Team Proposals</span>
          </h2>
          <AnimatePresence mode="wait">
            {data.applications.length === 0 ? (
              <EmptyState
                key="empty-apps"
                icon={Lightbulb}
                title="No student proposals waiting"
                description="When students apply to open civic challenges, their proposals and skill-match scores will appear here."
              />
            ) : (
              <StaggerGrid key="apps-list" immediate className="space-y-3">
                {data.applications.map((app) => (
                  <StaggerItem key={app.id}>
                    <div className="rounded-xl bg-white border border-[#245B45]/14 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-[#245B45]/30">
                      <div className="space-y-1">
                        <p className="text-xs font-mono-tabular text-[#55665F]">
                          {app.challenge_code} · Match: <strong className="text-[#245B45]">{app.match_score}%</strong> · Status: <strong>{app.status}</strong>
                        </p>
                        <p className="text-sm font-bold text-[#24332D]">{app.challenge_title}</p>
                        <p className="text-xs text-[#55665F]">
                          Applicant: <strong>{app.applicant_name}</strong> {app.team_name ? `(Team: ${app.team_name})` : '(Individual)'}
                        </p>
                        <p className="text-xs text-[#24332D] pt-1 leading-relaxed">{app.proposal_summary}</p>
                      </div>

                      {app.status === 'Pending Review' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" variant="forest" onClick={() => handleApplication(app.id, 'Approved')}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve & Launch Board</span>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleApplication(app.id, 'Rejected')}>
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </StaggerItem>
                ))}
              </StaggerGrid>
            )}
          </AnimatePresence>
        </Card>

        <Card animate delay={0.08} className="space-y-3">
          <h2 className="font-display text-base font-bold text-[#245B45] flex items-center gap-2">
            <Rocket className="w-4 h-4 text-[#F07832]" />
            <span>Active Student Prototypes & Pilot Authorization</span>
          </h2>
          <p className="text-xs text-[#55665F]">
            Student prototypes require formal official approval before field testing and never auto-close official citizen complaints.
          </p>
          <StaggerGrid immediate className="space-y-3">
            {data.projects.map((p) => (
              <StaggerItem key={p.id}>
                <div className="rounded-xl bg-white border border-[#245B45]/14 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-[#245B45]/30">
                  <div>
                    <p className="text-xs font-mono-tabular text-[#55665F]">{p.challenge_code} · Team: {p.team_name}</p>
                    <p className="text-sm font-bold text-[#24332D] mt-0.5">{p.title}</p>
                    <p className="text-xs text-[#55665F] mt-0.5">{p.objectives}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={p.pilot_approved ? 'secondary' : 'primary'}
                    onClick={() => handlePilotToggle(p.id, !p.pilot_approved)}
                  >
                    {p.pilot_approved ? 'Pilot Approved (Revoke)' : 'Approve Field Pilot'}
                  </Button>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </Card>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Civic Innovation Challenge"
        subtitle="Publish a municipal challenge for university teams and faculty mentors."
      >
        <form onSubmit={handleCreateChallenge} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Challenge Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Smart Solar Drainage Silt Sensor"
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              >
                {ISSUE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Location / Zone</label>
              <input
                type="text"
                required
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Problem Statement & Scope</label>
            <textarea
              rows={3}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Expected Outcome</label>
            <input
              type="text"
              value={form.expectedOutcome}
              onChange={(e) => setForm({ ...form, expectedOutcome: e.target.value })}
              placeholder="Working field-ready prototype or dashboard"
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Skills Needed</label>
              <input
                type="text"
                value={form.skillsText}
                onChange={(e) => setForm({ ...form, skillsText: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Difficulty</label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
          </div>
          <Button type="submit" variant="forest" className="w-full" disabled={creating}>
            Publish Civic Challenge
          </Button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
