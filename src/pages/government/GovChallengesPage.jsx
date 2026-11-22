import { useEffect, useState } from 'react';
import { Lightbulb, CheckCircle2, XCircle, Rocket } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { AnimatePresence } from 'motion/react';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function GovChallengesPage() {
  const { showToast } = useToast();
  const [data, setData] = useState({ challenges: [], applications: [], projects: [] });

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

  return (
    <DashboardLayout
      title="Challenges & Student Pilots"
      subtitle="Approve student team proposals and authorize public-sector pilot trials"
    >
      <div className="space-y-6">
        <Card animate className="space-y-3">
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
    </DashboardLayout>
  );
}
