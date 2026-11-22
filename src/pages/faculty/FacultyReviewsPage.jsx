import { useEffect, useState } from 'react';
import { Award, CheckCircle2, MessageSquare } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { AnimatePresence } from 'motion/react';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function FacultyReviewsPage() {
  const { showToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verifyForm, setVerifyForm] = useState({
    studentId: '',
    roleHeld: '',
    responsibilities: '',
    skillsText: '',
    tasksCompleted: 3,
    deliverablesSummary: '',
    verificationNote: '',
  });
  const [feedbackMap, setFeedbackMap] = useState({});

  const load = () => {
    apiRequest('/api/faculty/dashboard').then((d) => setProjects(d.projects || []));
  };

  useEffect(() => {
    load();
  }, []);

  const evaluateMilestone = async (milestoneId, evaluation) => {
    try {
      await apiRequest(`/api/faculty/milestones/${milestoneId}/evaluate`, {
        method: 'PATCH',
        body: { status: 'Verified', evaluation: evaluation || 'Verified milestone deliverables.' },
      });
      showToast('Milestone marked verified.', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const postFeedback = async (projectId) => {
    const comment = feedbackMap[projectId] || '';
    if (!comment.trim()) return;
    try {
      await apiRequest(`/api/faculty/projects/${projectId}/feedback`, {
        method: 'POST',
        body: { comment },
      });
      setFeedbackMap((prev) => ({ ...prev, [projectId]: '' }));
      showToast('Review comment sent to team.', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const openVerify = (project, member) => {
    setVerifyTarget(project);
    setVerifyForm({
      studentId: member.user_id,
      roleHeld: member.project_role,
      responsibilities: `Contributed to ${project.title} as ${member.project_role}.`,
      skillsText: (member.skills || []).join(', '),
      tasksCompleted: 3,
      deliverablesSummary: 'Submitted milestone documentation and working prototype.',
      verificationNote: 'Verified by Faculty Mentor on FixGrid AI.',
    });
  };

  const submitVerify = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/faculty/verify-contribution', {
        method: 'POST',
        body: {
          ...verifyForm,
          projectId: verifyTarget.id,
          skills: verifyForm.skillsText.split(',').map((s) => s.trim()).filter(Boolean),
        },
      });
      showToast('Passport entry issued for student!', 'success');
      setVerifyTarget(null);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <DashboardLayout
      title="Verify Student Work"
      subtitle="Approve project milestones, share technical feedback, and issue Contribution Passports"
    >
      <AnimatePresence mode="wait">
        {projects.length === 0 ? (
          <EmptyState
            key="empty"
            icon={Award}
            title="No active student projects to review"
            description="Accepted mentorship teams and their project milestones will appear here."
          />
        ) : (
          <StaggerGrid key="list" immediate className="space-y-6">
            {projects.map((proj) => (
              <StaggerItem key={proj.id}>
                <Card className="space-y-5">
                  <div>
                    <p className="text-xs font-mono-tabular text-[#F07832] font-semibold">
                      {proj.challenge_code} · Team {proj.team_name}
                    </p>
                    <h2 className="font-display text-lg font-bold text-[#245B45] mt-0.5">{proj.title}</h2>
                  </div>

              {/* Milestones */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-[#24332D]">Project Milestones</p>
                {proj.milestones.map((m) => (
                  <div key={m.id} className="rounded-xl bg-white border border-[#245B45]/12 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-[#24332D]">{m.title}</p>
                      <p className="text-[#55665F] mt-0.5">
                        Due {m.due_date} · Status: <strong className="text-[#245B45]">{m.status}</strong>
                      </p>
                      {m.faculty_evaluation && <p className="text-[#245B45] mt-1">{m.faculty_evaluation}</p>}
                    </div>
                    {m.status !== 'Verified' && (
                      <Button
                        size="sm"
                        variant="forest"
                        onClick={() => evaluateMilestone(m.id, 'Bench tests and technical documentation verified.')}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Milestone</span>
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Verify Team Member Contributions */}
              <div className="space-y-2.5 pt-2 border-t border-[#245B45]/10">
                <p className="text-xs font-semibold text-[#24332D]">
                  Team Members — Issue Contribution Passport
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {proj.members.map((m) => (
                    <div key={m.user_id} className="rounded-xl bg-[#FAF8EE] border border-[#245B45]/15 p-3.5 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <p className="font-bold text-[#24332D]">{m.name}</p>
                        <p className="text-[#55665F]">{m.project_role}</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => openVerify(proj, m)}>
                        <Award className="w-3.5 h-3.5" />
                        <span>Issue Passport</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Post Comment */}
              <div className="flex gap-2 pt-2 border-t border-[#245B45]/10">
                <input
                  type="text"
                  value={feedbackMap[proj.id] || ''}
                  onChange={(e) => setFeedbackMap({ ...feedbackMap, [proj.id]: e.target.value })}
                  placeholder="Write review feedback for this team..."
                  className="flex-1 rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                />
                <Button size="sm" variant="forest" onClick={() => postFeedback(proj.id)}>
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Send Feedback</span>
                </Button>
              </div>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGrid>
        )}
      </AnimatePresence>

      <Modal open={Boolean(verifyTarget)} onClose={() => setVerifyTarget(null)} title="Issue Contribution Passport Record">
        <form onSubmit={submitVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Role Held</label>
            <input
              type="text"
              required
              value={verifyForm.roleHeld}
              onChange={(e) => setVerifyForm({ ...verifyForm, roleHeld: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Verified Responsibilities</label>
            <textarea
              rows={2}
              required
              value={verifyForm.responsibilities}
              onChange={(e) => setVerifyForm({ ...verifyForm, responsibilities: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Skills Demonstrated</label>
              <input
                type="text"
                value={verifyForm.skillsText}
                onChange={(e) => setVerifyForm({ ...verifyForm, skillsText: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Tasks Completed</label>
              <input
                type="number"
                min={1}
                value={verifyForm.tasksCompleted}
                onChange={(e) => setVerifyForm({ ...verifyForm, tasksCompleted: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Faculty Verification Note</label>
            <input
              type="text"
              value={verifyForm.verificationNote}
              onChange={(e) => setVerifyForm({ ...verifyForm, verificationNote: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" variant="primary" className="w-full">Verify & Add to Passport</Button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
