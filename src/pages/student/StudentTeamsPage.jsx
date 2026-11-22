import { useEffect, useState } from 'react';
import { Users, UserPlus, Check, X } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { AnimatePresence, motion } from 'motion/react';
import { FG_EASE, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function StudentTeamsPage() {
  const { showToast } = useToast();
  const [data, setData] = useState({ myTeams: [], incomingInvitations: [], peerStudents: [], challenges: [] });
  const [createOpen, setCreateOpen] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', description: '', challengeId: '', myRole: 'Team Lead' });
  const [inviteOpen, setInviteOpen] = useState(null);
  const [inviteForm, setInviteForm] = useState({ invitedUserId: '', proposedRole: 'Technical Contributor' });

  const load = () => {
    apiRequest('/api/teams').then(setData);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/teams', { method: 'POST', body: teamForm });
      showToast('Team created!', 'success');
      setCreateOpen(false);
      setTeamForm({ name: '', description: '', challengeId: '', myRole: 'Team Lead' });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/teams/${inviteOpen.id}/invite`, { method: 'POST', body: inviteForm });
      showToast('Invitation sent.', 'success');
      setInviteOpen(null);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const respondInvite = async (invId, decision) => {
    try {
      const res = await apiRequest(`/api/teams/invitations/${invId}/respond`, {
        method: 'POST',
        body: { decision },
      });
      showToast(res.message, 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const pendingInvites = data.incomingInvitations.filter((i) => i.status === 'Pending');

  return (
    <DashboardLayout
      title="My Teams"
      subtitle="Form multidisciplinary squads by inviting classmates across engineering, software, and design"
      primaryAction={
        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          <Users className="w-4 h-4" />
          <span>Create Team</span>
        </Button>
      }
    >
      <div className="space-y-6">
        <AnimatePresence>
          {pendingInvites.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: FG_EASE }}
            >
              <Card className="bg-[#DCEBF3]/60 space-y-3">
                <h2 className="font-display text-base font-bold text-[#245B45]">
                  Team Invitations ({pendingInvites.length})
                </h2>
                {pendingInvites.map((inv) => (
                  <div key={inv.id} className="rounded-xl bg-white border border-[#245B45]/15 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#24332D]">{inv.team_name}</p>
                      <p className="text-xs text-[#55665F]">
                        Invited by {inv.invited_by_name} · Role: <strong>{inv.proposed_role}</strong>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="forest" onClick={() => respondInvite(inv.id, 'Accepted')}>
                        <Check className="w-3.5 h-3.5" />
                        <span>Join Team</span>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => respondInvite(inv.id, 'Rejected')}>
                        <X className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {data.myTeams.length === 0 ? (
          <EmptyState
            icon={Users}
            title="You aren’t part of a team yet"
            description="Create a new team to invite peers with complementary skills before applying to a challenge."
            actionLabel="Create Your First Team"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <StaggerGrid immediate className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {data.myTeams.map((team) => (
              <StaggerItem key={team.id}>
                <Card interactive className="h-full space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg font-bold text-[#245B45]">{team.name}</h3>
                      <p className="text-xs text-[#55665F] mt-0.5">{team.description}</p>
                      {team.challenge_title && (
                        <p className="text-xs text-[#F07832] font-semibold mt-1.5">
                          Target: {team.challenge_code} · {team.challenge_title}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setInviteOpen(team);
                        setInviteForm({ invitedUserId: data.peerStudents[0]?.id || '', proposedRole: 'Technical Contributor' });
                      }}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Invite Peer</span>
                    </Button>
                  </div>

                  <div className="border-t border-[#245B45]/10 pt-3 space-y-2">
                    <p className="text-xs font-semibold text-[#24332D]">
                      Team Members ({team.members.length})
                    </p>
                    {team.members.map((m) => (
                      <div key={m.user_id} className="rounded-lg bg-white border border-[#245B45]/10 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#24332D]">{m.name}</span>
                          <span className="font-semibold text-[#245B45]">{m.project_role}</span>
                        </div>
                        <p className="text-[#55665F] mt-0.5">{(m.skills || []).join(' · ') || 'Skills not listed yet'}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGrid>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Innovation Team" maxWidth="max-w-md">
        <form onSubmit={handleCreateTeam} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Team Name</label>
            <input
              type="text"
              required
              value={teamForm.name}
              onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
              placeholder="e.g., Brij Civic Builders"
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Focus / Mission</label>
            <textarea
              rows={2}
              value={teamForm.description}
              onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
              placeholder="What kind of civic solutions does your team build?"
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Target Challenge (Optional)</label>
            <select
              value={teamForm.challengeId}
              onChange={(e) => setTeamForm({ ...teamForm, challengeId: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            >
              <option value="">General Civic Innovation Team</option>
              {data.challenges.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.challenge_code} — {ch.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Your Role in Team</label>
            <input
              type="text"
              value={teamForm.myRole}
              onChange={(e) => setTeamForm({ ...teamForm, myRole: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" variant="forest" className="w-full">Create Team</Button>
        </form>
      </Modal>

      <Modal open={Boolean(inviteOpen)} onClose={() => setInviteOpen(null)} title={`Invite Student to ${inviteOpen?.name}`} maxWidth="max-w-md">
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Choose Classmate / Peer</label>
            <select
              value={inviteForm.invitedUserId}
              onChange={(e) => setInviteForm({ ...inviteForm, invitedUserId: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            >
              {data.peerStudents.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.institution_or_org} ({(s.skills || []).slice(0, 2).join(', ')})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Proposed Project Role</label>
            <input
              type="text"
              required
              value={inviteForm.proposedRole}
              onChange={(e) => setInviteForm({ ...inviteForm, proposedRole: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" variant="primary" className="w-full">Send Invitation</Button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
